import React, { useState, useEffect } from 'react'
import { transactionService } from '../../services/transactionService'
import { accountService } from '../../services/accountService'
import { categoryService } from '../../services/categoryService'
import { useToast } from '../../contexts/ToastContext'
import { useLanguage } from '../../contexts/LanguageContext'
import { triggerHaptic } from '../../utils/haptics'

export default function TransactionModal({ isOpen, onClose, onSuccess, initialData }) {
  const { t } = useLanguage()
  const { showToast } = useToast()
  const [tipe, setTipe] = useState('Pengeluaran')
  const [kategori, setKategori] = useState('')
  const [jumlah, setJumlah] = useState('')
  const [deskripsi, setDeskripsi] = useState('')
  const [akun, setAkun] = useState('')
  const [transferKe, setTransferKe] = useState('')
  
  const [accounts, setAccounts] = useState([])
  const [categories, setCategories] = useState([])
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (isOpen) {
      loadData()
      if (initialData) {
        if (initialData.jumlah) setJumlah(initialData.jumlah.toString())
        if (initialData.deskripsi) setDeskripsi(initialData.deskripsi)
        if (initialData.tipe) setTipe(initialData.tipe)
      } else {
        setJumlah('')
        setDeskripsi('')
        setTipe('Pengeluaran')
      }
    }
  }, [isOpen, initialData])

  const loadData = async () => {
    try {
      const [accData, catData] = await Promise.all([
        accountService.getAccounts(),
        categoryService.getCategories()
      ])
      
      setAccounts(accData)
      if (accData.length > 0) {
        setAkun(accData[0].namaakun)
        setTransferKe(accData.length > 1 ? accData[1].namaakun : accData[0].namaakun)
      }

      setCategories(catData)
      if (catData.length > 0) {
        setKategori(catData[0].namakategori)
      } else {
        setKategori('Lainnya') // Fallback
      }
    } catch (e) {
      console.error(e)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setIsLoading(true)
    try {
      await transactionService.addTransaction({
        tipe: tipe === 'Tabungan' ? 'Pengeluaran' : (tipe === 'Transfer Kas' ? 'Transfer' : tipe),
        kategori: tipe === 'Tabungan' ? 'Tabungan' : kategori,
        jumlah: Number(jumlah.replace(/\D/g, '')),
        deskripsi,
        akun,
        transferke: tipe === 'Transfer Kas' ? transferKe : null
      })
      showToast(t('modal_tx.success'), 'success')
      triggerHaptic([50])
      onSuccess() // Memicu refresh dashboard
      onClose()
      
      // Reset form
      setJumlah('')
      setDeskripsi('')
    } catch (e) {
      showToast(t('modal_tx.fail') + e.message, 'error')
    } finally {
      setIsLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4 transition-opacity duration-300">
      <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl transform transition-transform duration-300 max-h-[90vh] overflow-y-auto">
        
        <div className="flex justify-between items-center mb-6">
          <h3 className="font-extrabold text-xl text-slate-800">{t('modal_tx.title_new')}</h3>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-xl transition">
            <i className="fa-solid fa-xmark text-lg"></i>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          
          <div>
            <label className="block text-xs text-slate-500 mb-2 font-semibold">{t('modal_tx.type_label')}</label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <button type="button" onClick={() => setTipe('Pemasukan')}
                className={`py-2 px-1 rounded-xl border-2 text-[10px] font-bold text-center flex flex-col items-center justify-center gap-1 transition ${tipe === 'Pemasukan' ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-slate-200 text-slate-500 hover:bg-slate-50'}`}>
                <i className="fa-solid fa-circle-arrow-down text-base"></i>
                <span>{t('modal_tx.income')}</span>
              </button>
              <button type="button" onClick={() => setTipe('Pengeluaran')}
                className={`py-2 px-1 rounded-xl border-2 text-[10px] font-bold text-center flex flex-col items-center justify-center gap-1 transition ${tipe === 'Pengeluaran' ? 'border-rose-500 bg-rose-50 text-rose-700' : 'border-slate-200 text-slate-500 hover:bg-slate-50'}`}>
                <i className="fa-solid fa-circle-arrow-up text-base"></i>
                <span>{t('modal_tx.expense')}</span>
              </button>
              <button type="button" onClick={() => setTipe('Tabungan')}
                className={`py-2 px-1 rounded-xl border-2 text-[10px] font-bold text-center flex flex-col items-center justify-center gap-1 transition ${tipe === 'Tabungan' ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-200 text-slate-500 hover:bg-slate-50'}`}>
                <i className="fa-solid fa-piggy-bank text-base"></i>
                <span>{t('modal_tx.saving')}</span>
              </button>
              <button type="button" onClick={() => setTipe('Transfer Kas')}
                className={`py-2 px-1 rounded-xl border-2 text-[10px] font-bold text-center flex flex-col items-center justify-center gap-1 transition ${tipe === 'Transfer Kas' ? 'border-amber-500 bg-amber-50 text-amber-700' : 'border-slate-200 text-slate-500 hover:bg-slate-50'}`}>
                <i className="fa-solid fa-money-bill-transfer text-base"></i>
                <span>{t('modal_tx.transfer')}</span>
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs text-slate-500 mb-1 font-semibold">{t('modal_tx.amount_label')}</label>
            <div className="relative">
              <span className="absolute left-3 top-2.5 font-bold text-slate-400 text-sm">{localStorage.getItem('savora_currency') === 'USD' ? '$' : 'Rp'}</span>
              <input type="number" required value={jumlah} onChange={e => setJumlah(e.target.value)}
                placeholder={t('modal_tx.amount_ph')}
                className="w-full border-2 border-slate-200 rounded-xl px-3 py-2 text-base font-bold text-slate-800 focus:outline-none focus:border-savora-800 pl-10 transition-all duration-300"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs text-slate-500 mb-1 font-semibold">{t('modal_tx.category_label')}</label>
            <select value={kategori} onChange={e => setKategori(e.target.value)}
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-savora-800">
              {categories.length > 0 ? (
                categories.map(c => (
                  <option key={c.id} value={c.namakategori}>{c.namakategori}</option>
                ))
              ) : (
                <option value="Lainnya">{t('modal_tx.category_other')}</option>
              )}
            </select>
          </div>

          <div>
            <label className="block text-xs text-slate-500 mb-1 font-semibold">{t('modal_tx.desc_label')}</label>
            <input type="text" required value={deskripsi} onChange={e => setDeskripsi(e.target.value)}
              placeholder={t('modal_tx.desc_ph')}
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-savora-800"
            />
          </div>

          <div>
            <label className="block text-xs text-slate-500 mb-1 font-semibold">{tipe === 'Transfer Kas' ? t('modal_tx.source_account') : t('modal_tx.account')}</label>
            <select value={akun} onChange={e => setAkun(e.target.value)}
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-savora-800">
              {accounts.map(acc => (
                <option key={acc.id} value={acc.namaakun}>{acc.namaakun}</option>
              ))}
            </select>
          </div>

          {tipe === 'Transfer Kas' && (
            <div>
              <label className="block text-xs text-slate-500 mb-1 font-semibold">{t('modal_tx.dest_account')}</label>
              <select value={transferKe} onChange={e => setTransferKe(e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-savora-800">
                {accounts.map(acc => (
                  <option key={acc.id} value={acc.namaakun}>{acc.namaakun}</option>
                ))}
              </select>
            </div>
          )}

          <button disabled={isLoading} type="submit"
            className="w-full bg-savora-800 hover:bg-savora-900 text-white font-bold py-3 rounded-xl shadow-lg shadow-savora-800/20 active:scale-95 transition mt-4">
            {isLoading ? t('modal_tx.btn_saving') : t('modal_tx.btn_save')}
          </button>
        </form>
      </div>
    </div>
  )
}
