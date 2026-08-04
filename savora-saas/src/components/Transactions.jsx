import React, { useState, useEffect } from 'react'
import { transactionService } from '../services/transactionService'
import { formatCurrency } from '../utils/formatCurrency'
import { useToast } from '../contexts/ToastContext'
import { useLanguage } from '../contexts/LanguageContext'
import ConfirmModal from './modals/ConfirmModal'
import { SkeletonList } from './SkeletonLoader'

export default function Transactions() {
  const { t } = useLanguage()
  const { showToast } = useToast()
  const [transactions, setTransactions] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [isDeleting, setIsDeleting] = useState(false)
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, item: null })

  // Filters
  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState('Semua')
  const [filterCategory, setFilterCategory] = useState('Semua')
  const [filterAccount, setFilterAccount] = useState(() => {
    const saved = sessionStorage.getItem('savora_active_account')
    return (saved && saved !== 'null') ? saved : 'Semua'
  })
  const [sort, setSort] = useState('Terbaru')

  const handleFilterAccountChange = (val) => {
    setFilterAccount(val)
    sessionStorage.setItem('savora_active_account', val === 'Semua' ? 'null' : val)
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
    
    const csvContent = [
      header.join(","),
      ...rows.map(r => r.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(","))
    ].join("\n")

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.setAttribute("href", url)
    link.setAttribute("download", `savora_transaksi_${new Date().getTime()}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    showToast(t('tx.export_success'), 'success')
  }

  // Apply filters and sort
  const filteredTransactions = transactions.filter(tx => {
    const matchSearch = tx.deskripsi?.toLowerCase().includes(search.toLowerCase()) || tx.kategori?.toLowerCase().includes(search.toLowerCase())
    const matchType = filterType === 'Semua' || tx.tipe === filterType
    const matchCat = filterCategory === 'Semua' || tx.kategori === filterCategory
    const matchAcc = filterAccount === 'Semua' || tx.akun === filterAccount || tx.transferke === filterAccount
    return matchSearch && matchType && matchCat && matchAcc
  }).sort((a, b) => {
    if (sort === 'Terbaru') return new Date(b.created_at) - new Date(a.created_at)
    if (sort === 'Terlama') return new Date(a.created_at) - new Date(b.created_at)
    if (sort === 'Tertinggi') return b.jumlah - a.jumlah
    if (sort === 'Terendah') return a.jumlah - b.jumlah
    return 0
  })

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
          <button onClick={handleExportCSV} className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold px-4 py-2.5 rounded-xl transition flex items-center gap-2 shadow-md">
            <i className="fa-solid fa-file-excel"></i> <span>{t('tx.export')}</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200/60">
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
        </div>

        <div className="overflow-x-auto">
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
                filteredTransactions.map(tx => (
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
                    <td className="py-3 px-4 font-semibold">{tx.kategori}</td>
                    <td className="py-3 px-4">
                      <div className="font-medium text-slate-800">{tx.deskripsi || '-'}</div>
                      <div className="text-xs text-slate-400 mt-0.5">{tx.akun} {tx.transferke && `→ ${tx.transferke}`}</div>
                    </td>
                    <td className={`py-3 px-4 text-right font-bold whitespace-nowrap ${
                      tx.tipe === 'Pemasukan' ? 'text-emerald-500' : 
                      tx.tipe === 'Pengeluaran' ? 'text-rose-500' : 'text-blue-500'
                    }`}>
                      {tx.tipe === 'Pemasukan' ? '+' : tx.tipe === 'Pengeluaran' ? '-' : ''} {formatCurrency(tx.jumlah)}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <button onClick={() => setConfirmModal({ isOpen: true, item: tx })} disabled={isDeleting} className="bg-rose-50 hover:bg-rose-100 text-rose-600 w-8 h-8 rounded-xl flex items-center justify-center transition disabled:opacity-50" title={t('tx.delete')}>
                        <i className="fa-solid fa-trash"></i>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
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
    </section>
  )
}
