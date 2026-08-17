import { GoogleGenAI } from '@google/genai'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const GEMINI_KEY = process.env.GEMINI_API_KEY || process.env.GROQ_API_KEY
  if (!GEMINI_KEY) {
    return res.status(500).json({ error: 'Server AI Key is missing' })
  }

  const { mode, message } = req.body

  if (!message) {
    return res.status(400).json({ error: 'Message is required' })
  }

  let systemInstruction = ''
  let temperature = 0.7
  let maxOutputTokens = 500

  if (mode === 'consult') {
    systemInstruction = 'Anda adalah Savora, Asisten AI Keuangan yang ramah, ahli mengatur keuangan, investasi, dan budgeting. Jawab dengan ringkas, jelas, dan gunakan bahasa Indonesia yang bersahabat.'
  } else if (mode === 'catat') {
    systemInstruction = `Ekstrak data transaksi dari input user. Kembalikan HANYA JSON object dengan format: {"action": "pemasukan" atau "pengeluaran", "desc": "deskripsi singkat", "amount": angka_nominal, "account": "nama akun (misal Dompet Utama)"}. Jika tidak bisa diekstrak, kembalikan {"error": "Tidak dimengerti"}. Jangan tambahkan teks lain. Contoh user: "Beli kopi 25rb pakai bca" -> {"action":"pengeluaran", "desc":"Beli Kopi", "amount":25000, "account":"bca"}`
    temperature = 0.1
    maxOutputTokens = 150
  } else {
    return res.status(400).json({ error: 'Invalid mode' })
  }

  try {
    const ai = new GoogleGenAI({ apiKey: GEMINI_KEY })
    const interaction = await ai.interactions.create({
      model: 'gemini-3.6-flash',
      input: systemInstruction ? `${systemInstruction}\n\nUser: ${message}` : message
    })

    const content = interaction.output_text ? interaction.output_text.trim() : interaction.text ? interaction.text.trim() : ''
    if (!content) {
      throw new Error('Empty response from AI')
    }
    return res.status(200).json({ response: content })
  } catch (err) {
    console.error("Server Error:", err)
    return res.status(500).json({ error: 'Internal Server Error' })
  }
}
