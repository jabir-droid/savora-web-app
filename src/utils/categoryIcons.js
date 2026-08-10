export const CATEGORY_ICONS = {
  'Konsumsi': { icon: 'fa-utensils', color: 'text-orange-500', bg: 'bg-orange-50', tKey: 'cat.default_konsumsi' },
  'Transport': { icon: 'fa-car', color: 'text-sky-500', bg: 'bg-sky-50', tKey: 'cat.default_transport' },
  'Tagihan': { icon: 'fa-file-invoice', color: 'text-rose-500', bg: 'bg-rose-50', tKey: 'cat.default_tagihan' },
  'Hiburan': { icon: 'fa-film', color: 'text-purple-500', bg: 'bg-purple-50', tKey: 'cat.default_hiburan' },
  'Belanja': { icon: 'fa-bag-shopping', color: 'text-pink-500', bg: 'bg-pink-50', tKey: 'cat.default_belanja' },
  'Medis': { icon: 'fa-notes-medical', color: 'text-teal-500', bg: 'bg-teal-50', tKey: 'cat.default_medis' },
  'Edukasi': { icon: 'fa-graduation-cap', color: 'text-amber-500', bg: 'bg-amber-50', tKey: 'cat.default_edukasi' },
  'Bayar Utang': { icon: 'fa-hand-holding-dollar', color: 'text-red-500', bg: 'bg-red-50', tKey: 'cat.default_bayar_utang' },
  'Lainnya': { icon: 'fa-ellipsis', color: 'text-slate-500', bg: 'bg-slate-50', tKey: 'cat.default_lainnya' },
  
  'Gaji': { icon: 'fa-money-bill-wave', color: 'text-emerald-500', bg: 'bg-emerald-50', tKey: 'cat.default_gaji' },
  'Usaha': { icon: 'fa-store', color: 'text-orange-500', bg: 'bg-orange-50', tKey: 'cat.default_usaha' },
  'Investasi': { icon: 'fa-chart-line', color: 'text-blue-500', bg: 'bg-blue-50', tKey: 'cat.default_investasi' },
  'Bonus': { icon: 'fa-gift', color: 'text-amber-500', bg: 'bg-amber-50', tKey: 'cat.default_bonus' },
  'Lain-lain': { icon: 'fa-ellipsis', color: 'text-slate-500', bg: 'bg-slate-50', tKey: 'cat.default_lainnya_in' },
  'Transfer': { icon: 'fa-money-bill-transfer', color: 'text-indigo-500', bg: 'bg-indigo-50', tKey: 'tx.type_transfer' }
}

export const getDefaultCategories = (userId) => [
  { user_id: userId, namakategori: 'Konsumsi', tipe: 'Pengeluaran' },
  { user_id: userId, namakategori: 'Transport', tipe: 'Pengeluaran' },
  { user_id: userId, namakategori: 'Tagihan', tipe: 'Pengeluaran' },
  { user_id: userId, namakategori: 'Hiburan', tipe: 'Pengeluaran' },
  { user_id: userId, namakategori: 'Belanja', tipe: 'Pengeluaran' },
  { user_id: userId, namakategori: 'Medis', tipe: 'Pengeluaran' },
  { user_id: userId, namakategori: 'Edukasi', tipe: 'Pengeluaran' },
  { user_id: userId, namakategori: 'Bayar Utang', tipe: 'Pengeluaran' },
  { user_id: userId, namakategori: 'Transfer', tipe: 'Pengeluaran' },
  { user_id: userId, namakategori: 'Lainnya', tipe: 'Pengeluaran' },
  
  { user_id: userId, namakategori: 'Gaji', tipe: 'Pemasukan' },
  { user_id: userId, namakategori: 'Usaha', tipe: 'Pemasukan' },
  { user_id: userId, namakategori: 'Investasi', tipe: 'Pemasukan' },
  { user_id: userId, namakategori: 'Bonus', tipe: 'Pemasukan' },
  { user_id: userId, namakategori: 'Transfer', tipe: 'Pemasukan' },
  { user_id: userId, namakategori: 'Lain-lain', tipe: 'Pemasukan' }
]
