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
  const { message: originalMessage, callback_query } = req.body

  let processingMessage = originalMessage;
  let forcedAccount = null;

  if (callback_query) {
    if (callback_query.data && callback_query.data.startsWith('wallet:')) {
      forcedAccount = callback_query.data.split(':')[1];
      processingMessage = callback_query.message.reply_to_message;

      // Answer callback to remove loading state on button
      await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/answerCallbackQuery`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ callback_query_id: callback_query.id })
      });

      // Edit message to show we are processing
      await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/editMessageText`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          chat_id: callback_query.message.chat.id, 
          message_id: callback_query.message.message_id, 
          text: `⏳ Memproses nota menggunakan dompet *${forcedAccount}*... Mohon tunggu.`,
          parse_mode: 'Markdown'
        })
      });
    } else {
      return res.status(200).send('OK')
    }
  }

  if (!processingMessage) {
    return res.status(200).send('OK')
  }

  const message = processingMessage;
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

  // Utility to send persistent menu
  const sendMenu = async (text) => {
    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        chat_id: chatId, 
        text,
        reply_markup: {
          keyboard: [
            [{ text: '📝 Catat Manual' }, { text: '📊 Laporan Bulan Ini' }],
            [{ text: '💬 Konsultasi AI' }, { text: 'ℹ️ Bantuan' }]
          ],
          resize_keyboard: true,
          is_persistent: true
        }
      })
    })
  }

  try {
    // 1. Handle Account Linking (/start SAVORA-XXXXX)
    if (text.startsWith('/start SAVORA-')) {
      const fullCode = text.split(' ')[1] 
      const code = fullCode.replace('SAVORA-', '') 
      
      const { data: users, error: searchErr } = await supabase
        .from('user_settings')
        .select('user_id')
        .eq('telegram_link_code', code)
        .limit(1)

      if (searchErr || !users || users.length === 0) {
        await sendMessage('❌ Kode tautan tidak valid atau sudah kedaluwarsa.')
        return res.status(200).send('OK')
      }

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
        await sendMenu('✅ Akun Savora Anda berhasil dihubungkan!\n\nSekarang Anda bisa mengirim foto nota langsung, atau menggunakan menu di bawah untuk fitur lainnya.')
      }
      return res.status(200).send('OK')
    }

    // For all other features, check if user is linked
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
    const defaultAccount = linkedUsers[0].default_account || 'Dompet' 

    // Handle Menu Navigation Clicks
    if (text === '📝 Catat Manual') {
      await sendMenu('Untuk mencatat pengeluaran tanpa nota, ketik pengeluaran Anda dengan awalan "Catat:".\n\nContoh: "Catat: Beli bensin 50rb pakai BCA patungan berdua"');
      return res.status(200).send('OK');
    }
    if (text === '💬 Konsultasi AI') {
      await sendMenu('Untuk konsultasi keuangan, ketik pertanyaan Anda dengan awalan "Tanya:".\n\nContoh: "Tanya: Bagaimana cara menabung untuk beli motor dengan gaji 3 juta?"');
      return res.status(200).send('OK');
    }
    if (text === 'ℹ️ Bantuan') {
      await sendMenu('Savora Telegram Bot dapat membantu Anda:\n\n📷 Kirim foto nota untuk dicatat otomatis.\n📝 Gunakan "Catat: [deskripsi]" untuk mencatat manual.\n💬 Gunakan "Tanya: [pertanyaan]" untuk konsultasi AI.\n📊 Tekan "Laporan Bulan Ini" untuk ringkasan pengeluaran.');
      return res.status(200).send('OK');
    }

    // Smart Reporting Feature
    if (text === '📊 Laporan Bulan Ini') {
      await sendMessage('⏳ Sedang menyusun laporan bulan ini... Mohon tunggu.');
      const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
      const { data: txs } = await supabase.from('transactions').select('kategori, jumlah').eq('user_id', userId).eq('tipe', 'Pengeluaran').gte('created_at', startOfMonth);
      
      const summaryObj = {};
      let total = 0;
      if (txs) {
        txs.forEach(t => {
          summaryObj[t.kategori] = (summaryObj[t.kategori] || 0) + Number(t.jumlah);
          total += Number(t.jumlah);
        });
      }
      
      const ai = new GoogleGenAI({ apiKey: GEMINI_KEY || GROQ_KEY });
      const interaction = await ai.interactions.create({
        model: 'gemini-3.6-flash',
        input: [
          { type: 'text', text: `You are a friendly financial advisor in Indonesian. The user's expenses this month: ${JSON.stringify(summaryObj)}. Total: ${total}. Write a short, engaging, and friendly financial summary (max 3 paragraphs). Give a tip based on their highest category. IMPORTANT: Do NOT use any Markdown formatting, asterisks (*), or bold text. Use plain text only.` }
        ]
      });
      const content = interaction.output_text ? interaction.output_text.trim() : interaction.text ? interaction.text.trim() : '';
      await sendMenu(`📊 Laporan Bulanan\n\n${content}`);
      return res.status(200).send('OK');
    }

    // Consultation Feature
    if (text.toLowerCase().startsWith('tanya:')) {
      await sendMessage('⏳ Savora sedang berpikir...');
      const question = text.substring(6).trim();
      const ai = new GoogleGenAI({ apiKey: GEMINI_KEY || GROQ_KEY });
      const interaction = await ai.interactions.create({
        model: 'gemini-3.6-flash',
        input: [
          { type: 'text', text: `You are Savora, a friendly Indonesian financial advisor. Answer this concisely: ${question}. IMPORTANT: Do NOT use any Markdown formatting, asterisks (*), or bold text. Use plain text only.` }
        ]
      });
      const content = interaction.output_text ? interaction.output_text.trim() : interaction.text ? interaction.text.trim() : '';
      await sendMenu(`💬 Konsultasi Savora\n\n${content}`);
      return res.status(200).send('OK');
    }

    // Expense Recording (Photo or Manual Text)
    const isImage = message.photo && message.photo.length > 0;
    const isManualExpense = text.toLowerCase().startsWith('catat:');

    if (isImage || isManualExpense) {
      // Fetch user accounts
      const { data: userAccounts } = await supabase
        .from('accounts')
        .select('id, namaakun, saldo')
        .eq('user_id', userId)

      const accountNamesList = userAccounts ? userAccounts.map(a => a.namaakun).join(', ') : defaultAccount;
      
      // Fetch user categories to allow AI to guess and for budget alerts
      const { data: userCategories } = await supabase
        .from('categories')
        .select('namakategori, limit_anggaran')
        .eq('user_id', userId)
        
      const categoryNamesList = userCategories && userCategories.length > 0 ? userCategories.map(c => c.namakategori).join(', ') : 'Lainnya';

      const inputString = isImage ? (message.caption || '') : text.substring(6).trim();

      // Show inline keyboard if no forced account and no explicit caption/text
      if (!forcedAccount && !inputString.trim() && userAccounts && userAccounts.length > 0) {
        const keyboard = [];
        for (let i = 0; i < userAccounts.length; i += 2) {
          const row = [];
          row.push({ text: userAccounts[i].namaakun, callback_data: `wallet:${userAccounts[i].namaakun}` });
          if (i + 1 < userAccounts.length) {
            row.push({ text: userAccounts[i+1].namaakun, callback_data: `wallet:${userAccounts[i+1].namaakun}` });
          }
          keyboard.push(row);
        }

        await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            reply_to_message_id: message.message_id,
            text: 'Pilih dompet untuk pembayaran ini:',
            reply_markup: { inline_keyboard: keyboard }
          })
        });

        return res.status(200).send('OK');
      }

      if (!forcedAccount) {
        await sendMessage('⏳ Memproses transaksi... Mohon tunggu sebentar.')
      }

      const ai = new GoogleGenAI({ apiKey: GEMINI_KEY || GROQ_KEY });
      let extractedData = null;

      const aiPrompt = `You are an intelligent financial parser. Extract the total final amount and a short description (max 5 words). 
If the user mentions splitting the bill (e.g. 'patungan', 'bagi 3'), divide the total amount accordingly and return ONLY the user's portion in "jumlah". Append "(Patungan)" to "deskripsi".
Determine the account to use for payment based on the user's input: "${inputString}". 
Valid accounts are: [${accountNamesList}]. 
If the input mentions an account, pick the closest match. If no match is found, return exactly "${defaultAccount}".
Guess the most appropriate category for this purchase from this list: [${categoryNamesList}]. If nothing fits, pick "Lainnya".
Return ONLY a valid JSON object without markdown formatting, like this: {"jumlah": 50000, "deskripsi": "Makan Siang KFC", "akun": "${defaultAccount}", "kategori": "Makan"}. Ensure jumlah is a plain integer number.`;

      const inputPayload = [];
      if (isImage) {
        let photoIndex = message.photo.length - 1;
        if (message.photo.length >= 3) {
          photoIndex = message.photo.length - 2; 
        }
        const fileId = message.photo[photoIndex].file_id
        const fileRes = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getFile?file_id=${fileId}`)
        const fileData = await fileRes.json()
        
        if (!fileData.ok) {
          await sendMessage('❌ Gagal mengunduh foto dari Telegram.')
          return res.status(200).send('OK')
        }
        
        const filePath = fileData.result.file_path
        const fileUrl = `https://api.telegram.org/file/bot${BOT_TOKEN}/${filePath}`
        const imageRes = await fetch(fileUrl)
        const imageBuffer = await imageRes.arrayBuffer()
        
        inputPayload.push({ type: 'text', text: aiPrompt });
        inputPayload.push({ type: 'image', mime_type: 'image/jpeg', data: Buffer.from(imageBuffer).toString('base64') });
      } else {
        inputPayload.push({ type: 'text', text: aiPrompt + `\n\nUser Input to Parse: ${inputString}` });
      }

      try {
        const interaction = await ai.interactions.create({
          model: 'gemini-3.6-flash',
          input: inputPayload
        });

        const content = interaction.output_text ? interaction.output_text.trim() : interaction.text ? interaction.text.trim() : ''
        
        if (!content) throw new Error("Empty response from AI")
        const jsonMatch = content.match(/\{[\s\S]*\}/)
        if (jsonMatch) extractedData = JSON.parse(jsonMatch[0])
      } catch (err) {
        console.error("AI Error:", err)
        await sendMessage(`❌ Error dari AI: ${err.message || err.toString()}`)
        return res.status(200).send('OK')
      }

      if (!extractedData || !extractedData.jumlah) {
        await sendMessage('❌ Gagal membaca transaksi. Pastikan foto atau teks jelas.')
        return res.status(200).send('OK')
      }

      // Insert into Savora DB
      const accountToUse = forcedAccount || extractedData.akun;
      const matchedAccount = (userAccounts || []).find(a => a.namaakun === accountToUse) || (userAccounts || []).find(a => a.namaakun === defaultAccount);
      const finalAccountName = matchedAccount ? matchedAccount.namaakun : (accountToUse || defaultAccount);

      const matchedCategory = (userCategories || []).find(c => c.namakategori === extractedData.kategori);
      const finalCategoryName = matchedCategory ? matchedCategory.namakategori : 'Lainnya';

      const transactionData = {
        user_id: userId,
        tipe: 'Pengeluaran',
        kategori: finalCategoryName,
        jumlah: extractedData.jumlah,
        deskripsi: extractedData.deskripsi || 'Manual/Otomatis',
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
        // Update account balance
        if (matchedAccount) {
          const newBalance = Number(matchedAccount.saldo) - Number(extractedData.jumlah)
          await supabase
            .from('accounts')
            .update({ saldo: newBalance })
            .eq('id', matchedAccount.id)
        }

        // Budget Alerts
        let alertMessage = '';
        if (matchedCategory && matchedCategory.limit_anggaran > 0) {
          const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
          const { data: catTxs } = await supabase.from('transactions')
            .select('jumlah')
            .eq('user_id', userId)
            .eq('kategori', finalCategoryName)
            .eq('tipe', 'Pengeluaran')
            .gte('created_at', startOfMonth);
          
          const totalSpent = catTxs ? catTxs.reduce((sum, tx) => sum + Number(tx.jumlah), 0) : 0;
          if (totalSpent > matchedCategory.limit_anggaran) {
            alertMessage = `\n\n⚠️ Peringatan: Pengeluaran kategori ${finalCategoryName} bulan ini (Rp ${totalSpent.toLocaleString('id-ID')}) telah melebihi batas (Rp ${matchedCategory.limit_anggaran.toLocaleString('id-ID')})!`;
          }
        }

        await sendMenu(`✅ Berhasil! Transaksi sebesar Rp ${extractedData.jumlah.toLocaleString('id-ID')} (${transactionData.deskripsi}) telah dicatat ke akun ${finalAccountName}.${alertMessage}`)
      }

      return res.status(200).send('OK')
    }

    // Fallback for random unformatted text
    await sendMenu('Halo! 👋 Saya adalah bot Savora AI.\n\nKirimkan foto nota untuk dicatat otomatis, atau pilih menu di bawah ini untuk menggunakan fitur lainnya.');
    return res.status(200).send('OK')

  } catch (error) {
    console.error('Webhook error:', error)
    return res.status(500).json({ error: 'Internal Server Error' })
  }
}
