import { createClient } from '@supabase/supabase-js'
import { GoogleGenAI } from '@google/genai'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN
  const SUPABASE_URL = process.env.SUPABASE_URL
  const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
  const GROQ_KEY = process.env.GROQ_API_KEY
  const GEMINI_KEY = process.env.GEMINI_API_KEY

  if (!BOT_TOKEN || !SUPABASE_URL || !SUPABASE_KEY) {
    console.error("Missing environment variables")
    return res.status(500).json({ error: 'Server misconfiguration' })
  }

  if (!GEMINI_KEY && !GROQ_KEY) {
    console.error("Missing AI API Key")
    return res.status(500).json({ error: 'Missing AI API Key' })
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

      // Fetch all user accounts to allow AI to map caption to correct account
      const { data: userAccounts } = await supabase
        .from('accounts')
        .select('id, namaakun, saldo')
        .eq('user_id', userId)

      const accountNamesList = userAccounts ? userAccounts.map(a => a.namaakun).join(', ') : defaultAccount;
      const userCaption = message.caption || '';

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

      // Call Gemini API
      let extractedData = null;
      try {
        const ai = new GoogleGenAI({ apiKey: GEMINI_KEY || GROQ_KEY });
        const interaction = await ai.interactions.create({
          model: 'gemini-3.6-flash',
          input: [
            {
              type: 'text',
              text: `You are a receipt parser. Extract the total final amount and a short description of the purchase (max 5 words, e.g. "Makan Siang KFC"). 
Also, determine the account to use for payment based on the user's caption: "${userCaption}". 
Valid accounts are: [${accountNamesList}]. 
If the caption mentions an account, pick the closest match from the valid accounts list. If no caption is provided or no match is found, return exactly "${defaultAccount}".
Return ONLY a valid JSON object without markdown formatting, like this: {"jumlah": 50000, "deskripsi": "Makan Siang KFC", "akun": "${defaultAccount}"}. Ensure jumlah is a plain integer number.`
            },
            {
              type: 'image',
              mime_type: 'image/jpeg',
              data: Buffer.from(imageBuffer).toString('base64')
            }
          ]
        });

        const content = interaction.output_text ? interaction.output_text.trim() : interaction.text ? interaction.text.trim() : ''
        
        if (!content) {
          throw new Error("Empty response from AI")
        }

        const jsonMatch = content.match(/\{[\s\S]*\}/)
        if (jsonMatch) {
          extractedData = JSON.parse(jsonMatch[0])
        }
      } catch (err) {
        console.error("AI Error:", err)
        await sendMessage(`❌ Error dari AI: ${err.message || err.toString()}`)
        return res.status(200).send('OK')
      }

      if (!extractedData || !extractedData.jumlah) {
        await sendMessage('❌ Gagal membaca nota. Pastikan foto jelas dan menampilkan total belanja.')
        return res.status(200).send('OK')
      }

      // Insert into Savora DB
      const matchedAccount = (userAccounts || []).find(a => a.namaakun === extractedData.akun) || (userAccounts || []).find(a => a.namaakun === defaultAccount);
      const finalAccountName = matchedAccount ? matchedAccount.namaakun : (extractedData.akun || defaultAccount);

      const transactionData = {
        user_id: userId,
        tipe: 'Pengeluaran',
        kategori: 'Lainnya', // Default category since AI doesn't categorize perfectly yet
        jumlah: extractedData.jumlah,
        deskripsi: extractedData.deskripsi || 'Nota Otomatis',
        akun: finalAccountName,
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
        if (matchedAccount) {
          const newBalance = Number(matchedAccount.saldo) - Number(extractedData.jumlah)
          await supabase
            .from('accounts')
            .update({ saldo: newBalance })
            .eq('id', matchedAccount.id)
        }

        await sendMessage(`✅ Berhasil! Transaksi sebesar Rp ${extractedData.jumlah.toLocaleString('id-ID')} (${transactionData.deskripsi}) telah dicatat ke akun ${finalAccountName}.`)
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
