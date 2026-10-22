import React, { useState, useEffect } from 'react'
import { transactionService } from '../services/transactionService'
import { formatCurrency } from '../utils/formatCurrency'
import { accountService } from '../services/accountService'
import { formatMoneyNative } from '../utils/currency'
import { downloadCsv } from '../utils/csv'
import { activityService } from '../services/activityService'
import { useToast } from '../contexts/ToastContext'
import { useLanguage } from '../contexts/LanguageContext'
import { CATEGORY_ICONS } from '../utils/categoryIcons'
import ConfirmModal from './modals/ConfirmModal'
import TransactionModal from './modals/TransactionModal'
import { SkeletonList } from './SkeletonLoader'

export default function Transactions() {
  const { t } = useLanguage()
  const { showToast } = useToast()
  const [transactions, setTransactions] = useState([])
  const [accountCurrencies, setAccountCurrencies] = useState({})

  // Peta akun -> mata uang: nominal akun asing ditampilkan apa adanya
  useEffect(() => {
    let cancelled = false
    accountService.getAccounts()
      .then(rows => {
        if (cancelled) return
        const map = {}
        ;(rows || []).forEach(a => { map[a.namaakun] = a.mata_uang || 'IDR' })
        setAccountCurrencies(map)
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [])

  const fmtTxAmount = (tx) => {
    const kode = accountCurrencies[tx.akun] || 'IDR'
    return kode !== 'IDR' ? formatMoneyNative(tx.jumlah, kode) : formatCurrency(tx.jumlah)
  }
  const [isLoading, setIsLoading] = useState(true)
  const [isDeleting, setIsDeleting] = useState(false)
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, item: null })
  const [editModal, setEditModal] = useState({ isOpen: false, item: null })

  // Filters
  const [showFilter, setShowFilter] = useState(false)
  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState('Semua')
  const [filterCategory, setFilterCategory] = useState('Semua')
  const [filterAccount, setFilterAccount] = useState(() => {
    const saved = sessionStorage.getItem('savora_active_account')
    return (saved && saved !== 'null') ? saved : 'Semua'
  })
  const [sort, setSort] = useState('Terbaru')
  const [filterDateFrom, setFilterDateFrom] = useState('')
  const [filterDateTo, setFilterDateTo] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const ITEMS_PER_PAGE = 25

  const handleFilterAccountChange = (val) => {
    setFilterAccount(val)
    sessionStorage.setItem('savora_active_account', val === 'Semua' ? 'null' : val)
  }

  // Preset rentang tanggal: today / week / month / all
  const applyPreset = (preset) => {
    const today = new Date()
    const fmt = (d) => {
      const tz = d.getTimezoneOffset() * 60000
      return new Date(d - tz).toISOString().slice(0, 10)
    }
    if (preset === 'today') {
      const s = fmt(today)
      setFilterDateFrom(s)
      setFilterDateTo(s)
    } else if (preset === 'week') {
      const d = new Date(today)
      d.setDate(d.getDate() - 6)
      setFilterDateFrom(fmt(d))
      setFilterDateTo(fmt(today))
    } else if (preset === 'month') {
      const d = new Date(today.getFullYear(), today.getMonth(), 1)
      setFilterDateFrom(fmt(d))
      setFilterDateTo(fmt(today))
    } else {
      setFilterDateFrom('')
      setFilterDateTo('')
    }
  }

  const loadData = async () => {
    try {
      setIsLoading(true)
      const data = await transactionService.getTransactions()
      setTransactions(data || [])
    } catch (e) {
      console.error(e)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  // Reset ke halaman 1 setiap kali filter berubah
  useEffect(() => {
    setCurrentPage(1)
  }, [search, filterType, filterCategory, filterAccount, filterDateFrom, filterDateTo, sort])

  const handleDelete = async () => {
    const tx = confirmModal.item
    if (!tx) return
    
    try {
      setIsDeleting(true)
      await transactionService.deleteTransaction(tx.id, tx.tipe, tx.jumlah, tx.akun, tx.transferke)
      showToast(t('tx.delete_success'), 'success')
      setConfirmModal({ isOpen: false, item: null })
      loadData()
    } catch (e) {
      showToast(t('tx.delete_fail') + e.message, 'error')
    } finally {
      setIsDeleting(false)
    }
  }

  const formatDate = (dateString) => {
    const options = { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }
    return new Intl.DateTimeFormat('id-ID', options).format(new Date(dateString))
  }

  // Derive unique categories and accounts for filters
  const uniqueCategories = ['Semua', ...new Set(transactions.map(t => t.kategori))]
  const uniqueAccounts = ['Semua', ...new Set(transactions.map(t => t.akun))]

  const handleExportCSV = () => {
    if (transactions.length === 0) {
      return showToast(t('tx.not_found'), 'error')
    }

    const header = [t('tx.col_date'), t('tx.col_type'), t('tx.col_category'), t('tx.col_amount'), t('tx.account'), t('modal_tx.dest_account'), t('tx.col_desc')]
    const rows = filteredTransactions.map(tx => [
      formatDate(tx.created_at),
      tx.tipe === 'Pemasukan' ? t('tx.type_income') : tx.tipe === 'Pengeluaran' ? t('tx.type_expense') : tx.tipe === 'Transfer' ? t('tx.type_transfer') : tx.tipe,
      tx.kategori,
      tx.jumlah,
      tx.akun,
      tx.transferke || '-',
      tx.deskripsi || '-'
    ])
    
    downloadCsv(`savora_transaksi_${new Date().getTime()}.csv`, header, rows)
    activityService.logEvent('ekspor_data', { jumlah: rows.length })
    showToast(t('tx.export_success'), 'success')
  }

  // Apply filters and sort
  const filteredTransactions = transactions.filter(tx => {
    const matchSearch = tx.deskripsi?.toLowerCase().includes(search.toLowerCase()) || tx.kategori?.toLowerCase().includes(search.toLowerCase())
    const matchType = filterType === 'Semua' || tx.tipe === filterType
    const matchCat = filterCategory === 'Semua' || tx.kategori === filterCategory
    const matchAcc = filterAccount === 'Semua' || tx.akun === filterAccount || tx.transferke === filterAccount
    const matchDateFrom = !filterDateFrom || new Date(tx.created_at) >= new Date(filterDateFrom + 'T00:00:00')
    const matchDateTo = !filterDateTo || new Date(tx.created_at) <= new Date(filterDateTo + 'T23:59:59')
    return matchSearch && matchType && matchCat && matchAcc && matchDateFrom && matchDateTo
  }).sort((a, b) => {
    if (sort === 'Terbaru') return new Date(b.created_at) - new Date(a.created_at)
    if (sort === 'Terlama') return new Date(a.created_at) - new Date(b.created_at)
    if (sort === 'Tertinggi') return b.jumlah - a.jumlah
    if (sort === 'Terendah') return a.jumlah - b.jumlah
    return 0
  })

  // --- Pagination ---
  const totalPages = Math.max(1, Math.ceil(filteredTransactions.length / ITEMS_PER_PAGE))
  const safePage = Math.min(currentPage, totalPages)
  const paginatedTransactions = filteredTransactions.slice((safePage - 1) * ITEMS_PER_PAGE, safePage * ITEMS_PER_PAGE)
  const pageStart = Math.max(1, Math.min(safePage - 2, totalPages - 4))
  const pageNumbers = []
  for (let i = pageStart; i <= Math.min(pageStart + 4, totalPages); i++) pageNumbers.push(i)

  if (isLoading) {
    return (
      <section className="space-y-6 animate-fade-in w-full">
        <SkeletonList count={8} />
      </section>
    )
  }

  return (
    <section className="space-y-6 animate-fade-in">
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/60 space-y-6">
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h3 className="font-bold text-xl text-slate-800">{t('tx.title')}</h3>
            <p className="text-xs text-slate-400">{t('tx.subtitle')}</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setShowFilter(!showFilter)} className={`px-4 py-2.5 rounded-xl transition flex items-center gap-2 text-xs font-semibold shadow-md ${showFilter ? 'bg-savora-800 text-white' : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'}`}>
              <i className="fa-solid fa-filter"></i> <span>Filter</span>
            </button>
            <button onClick={handleExportCSV} className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold px-4 py-2.5 rounded-xl transition flex items-center gap-2 shadow-md">
              <i className="fa-solid fa-file-excel"></i> <span>{t('tx.export')}</span>
            </button>
          </div>
        </div>

        {showFilter && (
        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/60 animate-fade-in-sm space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-slate-500 font-semibold uppercase">{t('tx.period')}:</span>
          {[
            { key: 'today', label: t('tx.preset_today') },
            { key: 'week', label: t('tx.preset_week') },
            { key: 'month', label: t('tx.preset_month') },
            { key: 'all', label: t('tx.preset_all') },
          ].map(p => (
            <button key={p.key} type="button" onClick={() => applyPreset(p.key)}
              className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-600 transition">
              {p.label}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs text-slate-500 mb-1 font-semibold uppercase">{t('tx.search_desc')}</label>
            <div className="relative">
              <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder={t('tx.search_placeholder')}
                className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-savora-800 pl-8" />
              <i className="fa-solid fa-magnifying-glass absolute left-3 top-3 text-xs text-slate-400"></i>
            </div>
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1 font-semibold uppercase">{t('tx.type')}</label>
            <select value={filterType} onChange={e => setFilterType(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-savora-800 font-medium">
              <option value="Semua">{t('tx.type_all')}</option>
              <option value="Pemasukan">{t('tx.type_income')}</option>
              <option value="Pengeluaran">{t('tx.type_expense')}</option>
              <option value="Transfer">{t('tx.type_transfer')}</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1 font-semibold uppercase">{t('tx.category')}</label>
            <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-savora-800">
              {uniqueCategories.map(c => (
                <option key={c} value={c}>{c === 'Semua' ? t('tx.category_all') : c}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1 font-semibold uppercase">{t('tx.account')}</label>
            <select value={filterAccount} onChange={e => handleFilterAccountChange(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-savora-800">
              {uniqueAccounts.map(c => (
                <option key={c} value={c}>{c === 'Semua' ? t('tx.account_all') : c}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1 font-semibold uppercase">{t('tx.sort')}</label>
            <select value={sort} onChange={e => setSort(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-savora-800">
              <option value="Terbaru">{t('tx.sort_newest')}</option>
              <option value="Terlama">{t('tx.sort_oldest')}</option>
              <option value="Tertinggi">{t('tx.sort_highest')}</option>
              <option value="Terendah">{t('tx.sort_lowest')}</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1 font-semibold uppercase">{t('tx.date_from')}</label>
            <input type="date" value={filterDateFrom} onChange={e => setFilterDateFrom(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-savora-800" />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1 font-semibold uppercase">{t('tx.date_to')}</label>
            <input type="date" value={filterDateTo} onChange={e => setFilterDateTo(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-savora-800" />
          </div>
        </div>
        </div>
        )}

        <div className="hidden md:block overflow-x-auto mt-4">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 text-xs font-semibold text-slate-400 uppercase">
                <th className="py-3 px-4">{t('tx.col_date')}</th>
                <th className="py-3 px-4">{t('tx.col_type')}</th>
                <th className="py-3 px-4">{t('tx.col_category')}</th>
                <th className="py-3 px-4">{t('tx.col_desc')}</th>
                <th className="py-3 px-4 text-right">{t('tx.col_amount')}</th>
                <th className="py-3 px-4 text-center">{t('tx.col_action')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm text-slate-700">
              {isLoading ? (
                <tr>
                  <td colSpan="6" className="text-center py-12 text-slate-400">{t('tx.loading')}</td>
                </tr>
              ) : filteredTransactions.length === 0 ? (
                <tr>
                  <td colSpan="6" className="text-center py-12 text-slate-400">
                    <i className="fa-solid fa-folder-open text-4xl mb-3 text-slate-200"></i>
                    <p>{t('tx.not_found')}</p>
                  </td>
                </tr>
              ) : (
                paginatedTransactions.map(tx => (
                  <tr key={tx.id} className="hover:bg-slate-50 transition">
                    <td className="py-3 px-4 whitespace-nowrap">{formatDate(tx.created_at)}</td>
                    <td className="py-3 px-4">
                      <span className={`px-2.5 py-1 rounded-lg text-xs font-bold ${
                        tx.tipe === 'Pemasukan' ? 'bg-emerald-100 text-emerald-700' :
                        tx.tipe === 'Pengeluaran' ? 'bg-rose-100 text-rose-700' : 'bg-blue-100 text-blue-700'
                      }`}>
                        {tx.tipe === 'Pemasukan' ? t('tx.type_income') : tx.tipe === 'Pengeluaran' ? t('tx.type_expense') : tx.tipe === 'Transfer' ? t('tx.type_transfer') : tx.tipe}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-semibold">
                      {CATEGORY_ICONS[tx.kategori]?.tKey ? t(CATEGORY_ICONS[tx.kategori].tKey) : tx.kategori}
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-medium text-slate-800">{tx.deskripsi || '-'} {tx.foto_path && <i className="fa-solid fa-camera text-[10px] text-slate-400" title={t('tx.has_photo')}></i>}</div>
                      <div className="text-xs text-slate-400 mt-0.5">{tx.akun} {tx.transferke && `→ ${tx.transferke}`}</div>
                    </td>
                    <td className={`py-3 px-4 text-right font-bold whitespace-nowrap ${
                      tx.tipe === 'Pemasukan' ? 'text-emerald-500' : 
                      tx.tipe === 'Pengeluaran' ? 'text-rose-500' : 'text-blue-500'
                    }`}>
                      {tx.tipe === 'Pemasukan' ? '+' : tx.tipe === 'Pengeluaran' ? '-' : ''} {fmtTxAmount(tx)}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button onClick={() => setEditModal({ isOpen: true, item: tx })} disabled={isDeleting} className="bg-blue-50 hover:bg-blue-100 text-blue-600 w-8 h-8 rounded-xl flex items-center justify-center transition disabled:opacity-50" title="Edit">
                          <i className="fa-solid fa-pen"></i>
                        </button>
                        <button onClick={() => setConfirmModal({ isOpen: true, item: tx })} disabled={isDeleting} className="bg-rose-50 hover:bg-rose-100 text-rose-600 w-8 h-8 rounded-xl flex items-center justify-center transition disabled:opacity-50" title={t('tx.delete')}>
                          <i className="fa-solid fa-trash"></i>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* MOBILE CARDS VIEW */}
        <div className="flex flex-col gap-4 md:hidden mt-4">
           {isLoading ? (
             <div className="text-center py-8 text-slate-400">{t('tx.loading')}</div>
           ) : filteredTransactions.length === 0 ? (
             <div className="text-center py-8 text-slate-400">
                <i className="fa-solid fa-folder-open text-4xl mb-3 text-slate-200"></i>
                <p>{t('tx.not_found')}</p>
             </div>
           ) : (
             paginatedTransactions.map(tx => (
               <div key={tx.id} className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex flex-col gap-3">
                 <div className="flex justify-between items-start">
                   <div className="flex items-center gap-2">
                     <span className={`px-2 py-1 rounded-md text-[10px] font-bold ${
                        tx.tipe === 'Pemasukan' ? 'bg-emerald-100 text-emerald-700' :
                        tx.tipe === 'Pengeluaran' ? 'bg-rose-100 text-rose-700' : 'bg-blue-100 text-blue-700'
                      }`}>
                        {tx.tipe === 'Pemasukan' ? t('tx.type_income') : tx.tipe === 'Pengeluaran' ? t('tx.type_expense') : tx.tipe === 'Transfer' ? t('tx.type_transfer') : tx.tipe}
                     </span>
                     <span className="text-xs font-semibold text-slate-600">{tx.kategori}</span>
                   </div>
                   <div className="flex items-center gap-2">
                     <button onClick={() => setEditModal({ isOpen: true, item: tx })} disabled={isDeleting} className="text-blue-400 hover:text-blue-600 p-1" title="Edit">
                       <i className="fa-solid fa-pen text-sm"></i>
                     </button>
                     <button onClick={() => setConfirmModal({ isOpen: true, item: tx })} disabled={isDeleting} className="text-rose-400 hover:text-rose-600 p-1" title={t('tx.delete')}>
                       <i className="fa-solid fa-trash text-sm"></i>
                     </button>
                   </div>
                 </div>
                 
                 <div>
                   <h4 className="text-sm font-bold text-slate-800">{tx.deskripsi || '-'} {tx.foto_path && <i className="fa-solid fa-camera text-[10px] text-slate-400" title={t('tx.has_photo')}></i>}</h4>
                   <p className="text-xs text-slate-500 mt-1">{tx.akun} {tx.transferke && `→ ${tx.transferke}`}</p>
                 </div>
                 
                 <div className="flex justify-between items-end mt-1 pt-3 border-t border-slate-100">
                   <span className="text-[11px] text-slate-400">{formatDate(tx.created_at)}</span>
                   <span className={`text-base font-extrabold ${
                      tx.tipe === 'Pemasukan' ? 'text-emerald-500' : 
                      tx.tipe === 'Pengeluaran' ? 'text-rose-500' : 'text-blue-500'
                    }`}>
                      {tx.tipe === 'Pemasukan' ? '+' : tx.tipe === 'Pengeluaran' ? '-' : ''} {fmtTxAmount(tx)}
                   </span>
                 </div>
               </div>
             ))
           )}
        </div>

        {filteredTransactions.length > 0 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 mt-4 border-t border-slate-100">
            <p className="text-xs text-slate-400">
              {t('tx.showing')} {(safePage - 1) * ITEMS_PER_PAGE + 1}&ndash;{Math.min(safePage * ITEMS_PER_PAGE, filteredTransactions.length)} {t('tx.of')} {filteredTransactions.length}
            </p>
            {totalPages > 1 && (
              <div className="flex items-center gap-1">
                <button type="button" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={safePage === 1}
                  className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-40 transition text-xs">
                  <i className="fa-solid fa-chevron-left"></i>
                </button>
                {pageNumbers.map(n => (
                  <button key={n} type="button" onClick={() => setCurrentPage(n)}
                    className={`w-8 h-8 rounded-lg text-xs font-bold transition ${n === safePage ? 'bg-savora-800 text-white' : 'border border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                    {n}
                  </button>
                ))}
                <button type="button" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={safePage === totalPages}
                  className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-40 transition text-xs">
                  <i className="fa-solid fa-chevron-right"></i>
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      <ConfirmModal 
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal({ isOpen: false, item: null })}
        onConfirm={handleDelete}
        title={t('tx.delete_confirm').replace('?', '')}
        message={t('tx.delete_confirm')}
        confirmText="Hapus"
        cancelText="Batal"
      />

      {editModal.isOpen && (
        <TransactionModal 
          isOpen={editModal.isOpen} 
          onClose={() => setEditModal({ isOpen: false, item: null })} 
          onSuccess={() => {
            setEditModal({ isOpen: false, item: null })
            loadData()
          }}
          initialData={editModal.item}
        />
      )}
    </section>
  )
}
