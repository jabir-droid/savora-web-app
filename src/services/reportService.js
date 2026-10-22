import { supabase } from '../supabaseClient'
import { settingsService } from './settingsService'
import { buildCsv } from '../utils/csv'

// Program Penyempurnaan: laporan berkala. File CSV laporan
// disimpan di bucket Storage PRIVAT 'laporan' pada folder
// {user_id}/...; PDF dihasilkan sebagai tampilan siap-cetak.
const BUCKET = 'laporan'
export const REPORT_PERIODS = {
  mingguan: 7 * 24 * 3600 * 1000,
  bulanan: 30 * 24 * 3600 * 1000
}
const MAX_REPORTS = 24

const escapeHtml = (v) => String(v ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')

async function fetchPeriodTransactions(userId, days) {
  const from = new Date(Date.now() - days).toISOString()
  const { data, error } = await supabase
    .from('transactions')
    .select('*')
    .eq('user_id', userId)
    .gte('created_at', from)
    .order('created_at', { ascending: true })
  if (error) throw error
  return { rows: data || [], from, to: new Date().toISOString() }
}

function summarize(rows) {
  let pemasukan = 0
  let pengeluaran = 0
  const perKategori = {}
  rows.forEach(tx => {
    const j = Number(tx.jumlah) || 0
    if (tx.tipe === 'Pemasukan') pemasukan += j
    if (tx.tipe === 'Pengeluaran') pengeluaran += j
    if (tx.tipe !== 'Transfer') {
      const k = tx.kategori || 'Lainnya'
      perKategori[k] = (perKategori[k] || 0) + (tx.tipe === 'Pengeluaran' ? j : 0)
    }
  })
  return { pemasukan, pengeluaran, bersih: pemasukan - pengeluaran, perKategori }
}

export const reportService = {
  /**
   * Membuat laporan CSV untuk rentang `days` hari terakhir dan
   * menyimpannya ke bucket. MELEMPAR error bila gagal.
   */
  async generateReport(days) {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('not-signed-in')

    const { rows } = await fetchPeriodTransactions(user.id, days)
    const header = ['Tanggal', 'Tipe', 'Kategori', 'Deskripsi', 'Akun', 'Akun Tujuan', 'Jumlah']
    const csvRows = rows.map(tx => [
      new Date(tx.created_at).toLocaleString('id-ID'),
      tx.tipe,
      tx.kategori,
      tx.deskripsi || '',
      tx.akun,
      tx.transferke || '',
      Number(tx.jumlah) || 0
    ])
    const csv = buildCsv(header, csvRows)

    const stamp = new Date().toISOString().slice(0, 10)
    const name = `laporan-${days === REPORT_PERIODS.mingguan ? 'mingguan' : days === REPORT_PERIODS.bulanan ? 'bulanan' : `${days}hari`}-${stamp}.csv`
    const path = `${user.id}/${Date.now()}-${name}`
    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(path, new Blob([csv], { type: 'text/csv;charset=utf-8;' }), { contentType: 'text/csv', upsert: false })
    if (error) throw error
    return { name, path, count: rows.length }
  },

  /** Daftar laporan tersimpan (terbaru dulu). */
  async listReports() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return []
    const { data, error } = await supabase.storage.from(BUCKET).list(user.id, {
      limit: MAX_REPORTS,
      sortBy: { column: 'created_at', order: 'desc' }
    })
    if (error) throw error
    return (data || []).map(f => ({
      name: f.name.replace(/^\d+-/, ''),
      path: `${user.id}/${f.name}`,
      created_at: f.created_at
    }))
  },

  /** URL bertanda tangan (1 jam) untuk mengunduh laporan. */
  async getReportUrl(path) {
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 3600)
    if (error || !data) return null
    return data.signedUrl
  },

  /**
   * Membuka jendela siap-cetak (Simpan sebagai PDF dari dialog
   * cetak) berisi ringkasan + tabel transaksi rentang `days`.
   */
  async openPrintReport(days) {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('not-signed-in')
    const { rows, from, to } = await fetchPeriodTransactions(user.id, days)
    const s = summarize(rows)
    const rp = (n) => 'Rp ' + Math.round(n).toLocaleString('id-ID')
    const katRows = Object.entries(s.perKategori)
      .sort((a, b) => b[1] - a[1])
      .map(([k, v]) => `<tr><td>${escapeHtml(k)}</td><td class="r">${rp(v)}</td></tr>`).join('')
    const txRows = rows.map(tx => `<tr>
      <td>${new Date(tx.created_at).toLocaleDateString('id-ID')}</td>
      <td>${escapeHtml(tx.tipe)}</td><td>${escapeHtml(tx.kategori)}</td>
      <td>${escapeHtml(tx.deskripsi || '')}</td><td>${escapeHtml(tx.akun)}</td>
      <td class="r">${rp(Number(tx.jumlah) || 0)}</td></tr>`).join('')
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>Laporan Savora</title>
<style>body{font-family:Arial,sans-serif;color:#0f172a;margin:32px}h1{font-size:20px;margin:0 0 4px}
.sub{color:#64748b;font-size:12px;margin-bottom:20px}table{width:100%;border-collapse:collapse;font-size:12px;margin-bottom:20px}
th,td{border:1px solid #e2e8f0;padding:6px 8px;text-align:left}th{background:#f1f5f9}.r{text-align:right}
.sum{display:flex;gap:24px;margin-bottom:20px}.sum div b{display:block;font-size:16px}</style></head>
<body><h1>Laporan Keuangan Savora</h1>
<p class="sub">Periode: ${new Date(from).toLocaleDateString('id-ID')} — ${new Date(to).toLocaleDateString('id-ID')} · ${rows.length} transaksi</p>
<div class="sum"><div>Pemasukan<b>${rp(s.pemasukan)}</b></div><div>Pengeluaran<b>${rp(s.pengeluaran)}</b></div><div>Arus Bersih<b>${rp(s.bersih)}</b></div></div>
<h3>Pengeluaran per Kategori</h3><table><tr><th>Kategori</th><th class="r">Total</th></tr>${katRows || '<tr><td colspan="2">Tidak ada data</td></tr>'}</table>
<h3>Transaksi</h3><table><tr><th>Tanggal</th><th>Tipe</th><th>Kategori</th><th>Deskripsi</th><th>Akun</th><th class="r">Jumlah</th></tr>${txRows || '<tr><td colspan="6">Tidak ada data</td></tr>'}</table>
<script>window.onload = function(){ setTimeout(function(){ window.print() }, 300) }</script>
</body></html>`
    const win = window.open('', '_blank')
    if (!win) throw new Error('popup-blocked')
    win.document.open()
    win.document.write(html)
    win.document.close()
  },

  /**
   * Laporan terjadwal: bila periode terkonfigurasi sudah terlewati
   * sejak laporan terakhir, buat laporan dan catat waktunya.
   * Best-effort, dipanggil saat login (pola maybeAutoSnapshot).
   */
  async maybeGenerateScheduledReport() {
    try {
      const settings = await settingsService.getSettings()
      const period = settings && settings.laporan_periode
      if (!period || !REPORT_PERIODS[period]) return
      const last = settings.laporan_terakhir ? new Date(settings.laporan_terakhir).getTime() : 0
      if (Date.now() - last < REPORT_PERIODS[period]) return
      await this.generateReport(REPORT_PERIODS[period])
      await settingsService.updateSettings({ laporan_terakhir: new Date().toISOString() })
    } catch { /* abaikan */ }
  }
}
