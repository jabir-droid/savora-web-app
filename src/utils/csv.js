// Util ekspor CSV yang aman dibuka di Excel (termasuk Excel lokal Indonesia):
// - BOM UTF-8 di awal berkas agar Excel membaca karakter non-ASCII dengan benar
// - Pemisah ";" karena Excel id-ID memakai titik koma sebagai pemisah daftar
// - Setiap nilai dikutip; tanda kutip di dalam nilai digandakan (RFC 4180)
// - Jumlah dibiarkan numerik mentah agar bisa dijumlahkan di Excel
const escapeCsvCell = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`

export const buildCsv = (header, rows) => {
  const lines = [header, ...rows].map((cols) => cols.map(escapeCsvCell).join(';'))
  return '\uFEFF' + lines.join('\r\n')
}

export const downloadCsv = (filename, header, rows) => {
  const blob = new Blob([buildCsv(header, rows)], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.setAttribute('href', url)
  link.setAttribute('download', filename)
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
