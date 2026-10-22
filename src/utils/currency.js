// Multi-mata uang (Program Penyempurnaan): mata uang per akun,
// total gabungan dikonversi ke mata uang dasar IDR memakai kurs
// manual pengguna (atau nilai perkiraan bawaan di bawah).
export const BASE_CURRENCY = 'IDR'

export const SUPPORTED_CURRENCIES = [
  { kode: 'IDR', simbol: 'Rp', nama: 'Rupiah (IDR)' },
  { kode: 'USD', simbol: '$', nama: 'US Dollar (USD)' },
  { kode: 'SGD', simbol: 'S$', nama: 'Singapore Dollar (SGD)' },
  { kode: 'EUR', simbol: '€', nama: 'Euro (EUR)' },
  { kode: 'MYR', simbol: 'RM', nama: 'Ringgit Malaysia (MYR)' },
  { kode: 'JPY', simbol: '¥', nama: 'Yen Jepang (JPY)' }
]

// Kurs PERKIRAAN (IDR per 1 unit) — hanya dipakai bila pengguna
// belum mengatur kursnya sendiri di Pengaturan → Kurs Mata Uang.
export const DEFAULT_RATES = {
  USD: 16000,
  SGD: 11850,
  EUR: 16900,
  MYR: 3420,
  JPY: 106
}

export const currencySymbol = (kode) => {
  const found = SUPPORTED_CURRENCIES.find(c => c.kode === kode)
  return found ? found.simbol : 'Rp'
}

export const rateFor = (rates, kode) => {
  if (!kode || kode === BASE_CURRENCY) return 1
  if (rates && rates[kode]) return Number(rates[kode])
  return DEFAULT_RATES[kode] || 1
}

export const convertToBase = (amount, kode, rates) =>
  (Number(amount) || 0) * rateFor(rates, kode)

/** Format nominal dalam mata uang aslinya (tanpa konversi). */
export const formatMoneyNative = (amount, kode) => {
  const code = kode || BASE_CURRENCY
  const noDecimals = code === 'IDR' || code === 'JPY'
  return new Intl.NumberFormat(code === 'IDR' ? 'id-ID' : 'en-US', {
    style: 'currency',
    currency: code,
    minimumFractionDigits: noDecimals ? 0 : 2,
    maximumFractionDigits: noDecimals ? 0 : 2
  }).format(amount || 0)
}
