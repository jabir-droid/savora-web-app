// ============================================================
// Savora — Edge Function: ingest-transaction
// Sinkron Otomatis Pilot BSI (2026-10-22)
//
// Menerima email notifikasi BYOND by BSI (JSON: subject + body),
// mengurainya, mencatat transaksi ke Savora, menyesuaikan saldo
// dompet sumber, dan menyimpan jejak tangkapan di
// ingested_transactions untuk ditinjau pengguna.
//
// Secrets yang WAJIB diatur di Dashboard (Edge Functions > Secrets):
//   INGEST_TOKEN    — token rahasia pemanggil (header x-ingest-token)
//   TARGET_USER_ID  — user_id pemilik data tujuan
//   ACCOUNT_NAME    — nama akun sumber di Savora (bawaan 'BSI')
// SUPABASE_URL & SUPABASE_SERVICE_ROLE_KEY tersedia otomatis.
// ============================================================
import { createClient } from 'jsr:@supabase/supabase-js@2'

const BULAN: Record<string, string> = {
  Jan: '01', Feb: '02', Mar: '03', Apr: '04', Mei: '05', Jun: '06',
  Jul: '07', Agu: '08', Sep: '09', Okt: '10', Nov: '11', Des: '12',
}

function parseRupiah(text: string | null): number {
  if (!text) return 0
  const t = text.replace('Rp', '').trim().replace(/\./g, '').replace(',', '.')
  const n = parseFloat(t)
  return Number.isFinite(n) ? Math.round(n) : 0
}

function field(body: string, label: string): string | null {
  const esc = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const m = body.match(new RegExp(`\\|\\s*${esc}\\s*\\|\\s*([^|]+)\\|`))
  return m ? m[1].trim() : null
}

function blockAfter(body: string, marker: string): string[] {
  const idx = body.indexOf(marker)
  if (idx < 0) return []
  const lines: string[] = []
  for (const raw of body.slice(idx + marker.length).split('\n')) {
    const line = raw.trim().replace(/^\||\|$/g, '').trim()
    if (line) lines.push(line)
    if (lines.length >= 3) break
  }
  return lines
}

function tanggalISO(body: string): string | null {
  const tgl = field(body, 'Tanggal')
  const jam = (field(body, 'Jam') || '00:00:00 WIB').replace('WIB', '').trim()
  if (!tgl) return null
  const m = tgl.match(/(\d{1,2})\s+(\w{3})\s+(\d{4})/)
  if (!m || !BULAN[m[2]]) return null
  const hh = jam.length === 5 ? jam + ':00' : jam
  return `${m[3]}-${BULAN[m[2]]}-${m[1].padStart(2, '0')}T${hh}+07:00`
}

function externalId(body: string): string | null {
  return field(body, 'No. Transaksi') || field(body, 'Nomor Transaksi') ||
    field(body, 'Transactions ID')
}

interface Parsed {
  jenis: 'qris' | 'topup' | 'transfer'
  arah: 'keluar' | 'masuk'
  jumlah: number
  jumlahPokok: number
  biaya: number
  deskripsi: string
  tujuanNama: string | null
  tanggalISO: string | null
  externalId: string | null
  kategori: string
}

function parseByond(subject: string, body: string): Parsed | null {
  if (subject.includes('QRIS')) {
    const total = parseRupiah(field(body, 'Total')) ||
      parseRupiah(field(body, 'Nominal Transaksi'))
    const merchant = field(body, 'Nama Merchant') || 'QRIS'
    return {
      jenis: 'qris', arah: 'keluar', jumlah: total, jumlahPokok: total,
      biaya: 0, deskripsi: `QRIS — ${merchant}`, tujuanNama: null,
      tanggalISO: tanggalISO(body), externalId: externalId(body),
      kategori: 'Belanja',
    }
  }
  if (subject.includes('E-Wallet')) {
    const pokok = parseRupiah(field(body, 'Nominal Top Up'))
    const biaya = parseRupiah(field(body, 'Biaya Admin'))
    const total = parseRupiah(field(body, 'Total')) || (pokok + biaya)
    const dompet = field(body, 'Pembelian') || 'E-Wallet'
    return {
      jenis: 'topup', arah: 'keluar', jumlah: total, jumlahPokok: pokok,
      biaya, deskripsi: `Top Up ${dompet}`, tujuanNama: dompet,
      tanggalISO: tanggalISO(body), externalId: externalId(body),
      kategori: 'Transfer',
    }
  }
  if (subject.includes('Transfer')) {
    const nominal = parseRupiah(field(body, 'Nominal Transfer'))
    const penerima = blockAfter(body, 'Rekening Penerima')
    const pengirim = blockAfter(body, 'Rekening Pengirim')
    const pengirimMasked = pengirim.some(l => l.includes('*'))
    const penerimaMasked = penerima.some(l => l.includes('*'))
    const arah = (penerimaMasked && !pengirimMasked) ? 'masuk' : 'keluar'
    let deskripsi: string
    if (arah === 'keluar') {
      const nama = penerima[0] || 'Penerima'
      const bank = penerima[1] ? penerima[1].split(' - ')[0] : ''
      deskripsi = `Transfer ke ${nama}` + (bank ? ` — ${bank}` : '')
    } else {
      deskripsi = `Transfer dari ${pengirim[0] || 'Pengirim'}`
    }
    return {
      jenis: 'transfer', arah, jumlah: nominal, jumlahPokok: nominal,
      biaya: 0, deskripsi, tujuanNama: null,
      tanggalISO: tanggalISO(body), externalId: externalId(body),
      kategori: 'Transfer',
    }
  }
  return null
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status, headers: { 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'method-not-allowed' }, 405)

  const token = Deno.env.get('INGEST_TOKEN') || ''
  if (!token || req.headers.get('x-ingest-token') !== token) {
    return json({ error: 'unauthorized' }, 401)
  }
  const userId = Deno.env.get('TARGET_USER_ID') || ''
  const accountName = Deno.env.get('ACCOUNT_NAME') || 'BSI'
  if (!userId) return json({ error: 'target-not-configured' }, 500)

  let payload: { gmail_message_id?: string; subject?: string; body?: string }
  try {
    payload = await req.json()
  } catch {
    return json({ error: 'invalid-json' }, 400)
  }
  const subject = payload.subject || ''
  const body = payload.body || ''
  const gmailId = payload.gmail_message_id || null

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  const parsed = parseByond(subject, body)
  const externalRef = parsed?.externalId || (gmailId ? `gmail:${gmailId}` : null)

  // Anti-duplikat: nomor transaksi yang sama tidak diproses dua kali.
  if (externalRef) {
    const { data: existing } = await supabase
      .from('ingested_transactions')
      .select('id, status')
      .eq('user_id', userId)
      .eq('external_ref', externalRef)
      .limit(1)
    if (existing && existing.length > 0) {
      return json({ status: 'duplicate', capture_id: existing[0].id })
    }
  }

  const baseCapture = {
    user_id: userId,
    sumber: 'bsi-byond-email',
    external_ref: externalRef || `unknown:${Date.now()}`,
    gmail_message_id: gmailId,
    raw_subject: subject,
    raw_body: body,
    parsed: parsed as unknown as Record<string, unknown> | null,
    jenis: parsed?.jenis ?? null,
    arah: parsed?.arah ?? null,
    jumlah: parsed?.jumlah ?? null,
    deskripsi: parsed?.deskripsi ?? null,
  }

  if (!parsed || !parsed.externalId || !parsed.tanggalISO || parsed.jumlah <= 0) {
    await supabase.from('ingested_transactions')
      .insert([{ ...baseCapture, status: 'unparsed' }])
    return json({ status: 'unparsed' })
  }

  // Resolusi akun milik pengguna target.
  const { data: accounts } = await supabase
    .from('accounts')
    .select('id, namaakun, saldo')
    .eq('user_id', userId)
  const norm = (s: string) => s.trim().toLowerCase()
  const source = (accounts || []).find(a => norm(a.namaakun) === norm(accountName))
  if (!source) {
    await supabase.from('ingested_transactions')
      .insert([{ ...baseCapture, status: 'error' }])
    return json({ status: 'error', reason: 'source-account-not-found' })
  }
  const dest = parsed.jenis === 'topup' && parsed.tujuanNama
    ? (accounts || []).find(a => norm(a.namaakun) === norm(parsed.tujuanNama!))
    : undefined

  const txIds: string[] = []
  const insertTx = async (row: Record<string, unknown>) => {
    const { data, error } = await supabase
      .from('transactions')
      .insert([{ user_id: userId, created_at: parsed.tanggalISO, ...row }])
      .select('id')
      .single()
    if (error) throw error
    txIds.push(data.id as string)
  }
  const adjust = async (accId: string, current: number, delta: number) => {
    const { error } = await supabase
      .from('accounts')
      .update({ saldo: current + delta })
      .eq('id', accId)
    if (error) throw error
  }

  try {
    if (parsed.jenis === 'qris') {
      await insertTx({
        tipe: 'Pengeluaran', kategori: parsed.kategori, jumlah: parsed.jumlah,
        deskripsi: parsed.deskripsi, akun: source.namaakun, transferke: null,
      })
      await adjust(source.id, Number(source.saldo), -parsed.jumlah)
    } else if (parsed.jenis === 'topup' && dest) {
      // Transfer antar dompet sendiri + biaya admin sebagai pengeluaran.
      await insertTx({
        tipe: 'Transfer', kategori: 'Transfer', jumlah: parsed.jumlahPokok,
        deskripsi: parsed.deskripsi, akun: source.namaakun,
        transferke: dest.namaakun,
      })
      await adjust(source.id, Number(source.saldo), -parsed.jumlahPokok)
      await adjust(dest.id, Number(dest.saldo), parsed.jumlahPokok)
      if (parsed.biaya > 0) {
        await insertTx({
          tipe: 'Pengeluaran', kategori: 'Lainnya', jumlah: parsed.biaya,
          deskripsi: `Biaya Admin ${parsed.deskripsi}`, akun: source.namaakun,
          transferke: null,
        })
        const { data: srcNow } = await supabase
          .from('accounts').select('saldo').eq('id', source.id).single()
        await adjust(source.id, Number(srcNow?.saldo ?? source.saldo), -parsed.biaya)
      }
    } else if (parsed.jenis === 'topup') {
      // Dompet tujuan tidak dikenal di Savora: catat sebagai pengeluaran.
      await insertTx({
        tipe: 'Pengeluaran', kategori: 'Transfer', jumlah: parsed.jumlah,
        deskripsi: parsed.deskripsi, akun: source.namaakun, transferke: null,
      })
      await adjust(source.id, Number(source.saldo), -parsed.jumlah)
    } else if (parsed.jenis === 'transfer' && parsed.arah === 'keluar') {
      await insertTx({
        tipe: 'Pengeluaran', kategori: 'Transfer', jumlah: parsed.jumlah,
        deskripsi: parsed.deskripsi, akun: source.namaakun, transferke: null,
      })
      await adjust(source.id, Number(source.saldo), -parsed.jumlah)
    } else if (parsed.jenis === 'transfer' && parsed.arah === 'masuk') {
      await insertTx({
        tipe: 'Pemasukan', kategori: 'Transfer', jumlah: parsed.jumlah,
        deskripsi: parsed.deskripsi, akun: source.namaakun, transferke: null,
      })
      await adjust(source.id, Number(source.saldo), parsed.jumlah)
    }
  } catch (e) {
    await supabase.from('ingested_transactions')
      .insert([{ ...baseCapture, status: 'error' }])
    return json({ status: 'error', reason: String(e) }, 500)
  }

  const { data: capture } = await supabase
    .from('ingested_transactions')
    .insert([{ ...baseCapture, status: 'posted', transaction_ids: txIds }])
    .select('id')
    .single()

  return json({ status: 'posted', capture_id: capture?.id, transaction_ids: txIds })
})
