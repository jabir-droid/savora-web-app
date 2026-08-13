import { createClient } from '@supabase/supabase-js'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN
  const SUPABASE_URL = process.env.SUPABASE_URL
  const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
  const GROQ_KEY = process.env.GROQ_API_KEY

  if (!BOT_TOKEN || !SUPABASE_URL || !SUPABASE_KEY || !GROQ_KEY) {
    console.error("Missing environment variables")
    return res.status(500).json({ error: 'Server misconfiguration' })
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)
  const { message } = req.body

  if (!message) {
    return res.status(200).send('OK')
  }

  const chatId = message.chat.id
  const text = message.text || ''

  // Utility to send message back to Telegram
  const sendMessage = async (text) => {
    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text })
    })
  }

  try {
    // 1. Handle Account Linking (/start SAVORA-XXXXX)
    if (text.startsWith('/start SAVORA-')) {
      const fullCode = text.split(' ')[1] // e.g. "SAVORA-88356"
      const code = fullCode.replace('SAVORA-', '') // e.g. "88356"
      
      // Find user with this link code
      const { data: users, error: searchErr } = await supabase
        .from('user_settings')
        .select('user_id')
        .eq('telegram_link_code', code)
        .limit(1)

      if (searchErr || !users || users.length === 0) {
        await sendMessage('❌ Kode tautan tidak valid atau sudah kedaluwarsa.')
        return res.status(200).send('OK')
      }

      // Update user_settings with telegram_chat_id and clear the code
      const userId = users[0].user_id
      const { error: updateErr } = await supabase
        .from('user_settings')
        .update({ 
          telegram_chat_id: chatId.toString(),
          telegram_link_code: null
        })
        .eq('user_id', userId)

      if (updateErr) {
        console.error("Update error:", updateErr)
        await sendMessage('❌ Gagal menautkan akun. Silakan coba lagi nanti.')
      } else {
        await sendMessage('✅ Akun Savora Anda berhasil dihubungkan! Sekarang Anda bisa mengirim foto nota ke chat ini untuk dicatat otomatis sebagai Pengeluaran.')
      }
      return res.status(200).send('OK')
    }

    // 2. Handle Receipt Photo
    if (message.photo && message.photo.length > 0) {
      // Check if user is linked
      const { data: linkedUsers, error: linkErr } = await supabase
        .from('user_settings')
        .select('user_id, default_account')
        .eq('telegram_chat_id', chatId.toString())
        .limit(1)

      if (linkErr || !linkedUsers || linkedUsers.length === 0) {
        await sendMessage('⚠️ Akun Telegram Anda belum dihubungkan dengan Savora. Silakan atur di menu Pengaturan Savora terlebih dahulu.')
        return res.status(200).send('OK')
      }

      const userId = linkedUsers[0].user_id
      const defaultAccount = linkedUsers[0].default_account || 'Dompet' // Fallback account

      // Acknowledge receipt
      await sendMessage('⏳ Memproses nota... Mohon tunggu sebentar.')

      // Get a medium resolution photo to avoid payload limits (usually index 1 or 2)
      let photoIndex = message.photo.length - 1;
      if (message.photo.length >= 3) {
        photoIndex = message.photo.length - 2; // Use medium size
      }
      const photo = message.photo[photoIndex]
      const fileId = photo.file_id

      // Get file path from Telegram
      const fileRes = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getFile?file_id=${fileId}`)
      const fileData = await fileRes.json()
      
      if (!fileData.ok) {
        await sendMessage('❌ Gagal mengunduh foto dari Telegram.')
        return res.status(200).send('OK')
      }

      const filePath = fileData.result.file_path
      const fileUrl = `https://api.telegram.org/file/bot${BOT_TOKEN}/${filePath}`

      // Fetch the actual image and convert to base64
      const imageRes = await fetch(fileUrl)
      const imageBuffer = await imageRes.arrayBuffer()
      const base64Image = `data:image/jpeg;base64,${Buffer.from(imageBuffer).toString('base64')}`

      // Call Groq Vision API
      const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${GROQ_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'llama-3.2-11b-vision-preview',
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: 'You are a receipt parser. Extract the total final amount and a short description of the purchase (max 5 words, e.g. "Makan Siang KFC"). Return ONLY a valid JSON object without markdown formatting, like this: {"jumlah": 50000, "deskripsi": "Makan Siang KFC"}. Ensure jumlah is a plain integer number.'
                },
                {
                  type: 'image_url',
                  image_url: { url: base64Image }
                }
              ]
            }
          ],
          temperature: 0.1,
          max_tokens: 150
        })
      })

      const groqData = await groqRes.json()

      if (groqData.error) {
        console.error("Groq API Error:", groqData.error)
        await sendMessage(`❌ Error dari Groq AI: ${groqData.error.message || JSON.stringify(groqData.error)}`)
        return res.status(200).send('OK')
      }

      let extractedData = null

      try {
        const content = groqData.choices[0].message.content
        const jsonMatch = content.match(/\{[\s\S]*\}/)
        if (jsonMatch) {
          extractedData = JSON.parse(jsonMatch[0])
        }
      } catch (err) {
        console.error("Failed to parse Groq response:", err)
        await sendMessage(`❌ Gagal membaca format data dari AI. Format tidak valid.`)
        return res.status(200).send('OK')
      }

      if (!extractedData || !extractedData.jumlah) {
        await sendMessage('❌ Gagal membaca nota. Pastikan foto jelas dan menampilkan total belanja.')
        return res.status(200).send('OK')
      }

      // Insert into Savora DB
      const transactionData = {
        user_id: userId,
        tipe: 'Pengeluaran',
        kategori: 'Lainnya', // Default category since AI doesn't categorize perfectly yet
        jumlah: extractedData.jumlah,
        deskripsi: extractedData.deskripsi || 'Nota Otomatis',
        akun: defaultAccount,
        created_at: new Date().toISOString()
      }

      const { error: insertErr } = await supabase
        .from('transactions')
        .insert([transactionData])

      if (insertErr) {
        console.error("DB Insert Error:", insertErr)
        await sendMessage('❌ Terjadi kesalahan saat menyimpan transaksi ke database.')
      } else {
        // Also update account balance
        const { data: accounts } = await supabase
          .from('accounts')
          .select('id, saldo')
          .eq('user_id', userId)
          .eq('namaakun', defaultAccount)
          .limit(1)

        if (accounts && accounts.length > 0) {
          const newBalance = Number(accounts[0].saldo) - Number(extractedData.jumlah)
          await supabase
            .from('accounts')
            .update({ saldo: newBalance })
            .eq('id', accounts[0].id)
        }

        await sendMessage(`✅ Berhasil! Transaksi sebesar Rp ${extractedData.jumlah.toLocaleString('id-ID')} (${transactionData.deskripsi}) telah dicatat ke akun ${defaultAccount}.`)
      }

      return res.status(200).send('OK')
    }

    // Unrecognized text message
    if (text) {
      await sendMessage('Halo! 👋 Saya adalah bot Savora AI. Kirimkan foto nota Anda ke sini, dan saya akan mencatatnya otomatis di aplikasi Savora!')
    }

    return res.status(200).send('OK')

  } catch (error) {
    console.error('Webhook error:', error)
    return res.status(500).json({ error: 'Internal Server Error' })
  }
}
