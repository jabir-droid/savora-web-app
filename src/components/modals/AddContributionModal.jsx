import React, { useState, useEffect } from 'react'
import { savingService } from '../../services/savingService'
import { accountService } from '../../services/accountService'
import { useToast } from '../../contexts/ToastContext'
import { useLanguage } from '../../contexts/LanguageContext'

export default function AddContributionModal({ isOpen, onClose, onSuccess, saving }) {
  const { t } = useLanguage()
  const { showToast } = useToast()
  const [nominal, setNominal] = useState('')
  const [akunSumber, setAkunSumber] = useState('')
  const [accounts, setAccounts] = useState([])
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (isOpen) {
      loadAccounts()
    }
  }, [isOpen])

  const loadAccounts = async () => {
    try {
      const accData = await accountService.getAccounts()
      // Filter out 'Savings Pocket' to prevent recursive saving
      const validAccounts = accData.filter(a => a.tipe !== 'Savings')
      setAccounts(validAccounts)
      if (validAccounts.length > 0) {
        setAkunSumber(validAccounts[0].namaakun)
      }
    } catch (e) {
      console.error(e)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setIsLoading(true)
    
    const setorAmount = Number(nominal.replace(/\D/g, ''))
    
    // VALIDASI SALDO
    const sourceAcc = accounts.find(a => a.namaakun === akunSumber)
    if (sourceAcc && sourceAcc.saldo < setorAmount) {
      showToast(`${t('modal_contrib.insufficient_pt1')}${akunSumber}${t('modal_contrib.insufficient_pt2')}${sourceAcc.saldo.toLocaleString('id-ID')})`, 'error')
      setIsLoading(false)
      return
    }

    try {
      await savingService.addContribution(saving.id, setorAmount, akunSumber, saving.namatarget)
      showToast(t('modal_contrib.success'), 'success')
      onSuccess()
      onClose()
      setNominal('')
    } catch (e) {
      showToast(t('modal_contrib.fail') + e.message, 'error')
    } finally {
      setIsLoading(false)
    }
  }

  if (!isOpen || !saving) return null

  return (
    <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4 transition-opacity duration-300">
      <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl transform transition-transform duration-300 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h3 className="font-extrabold text-lg text-slate-800">{t('modal_contrib.title')}</h3>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-xl transition">
            <i className="fa-solid fa-xmark text-lg"></i>
          </button>
        </div>

        <div className="mb-4 text-center p-3 bg-emerald-50 rounded-xl border border-emerald-100">
          <p className="text-xs text-emerald-600 font-bold mb-1">{t('modal_contrib.target_lbl')}</p>
          <p className="font-extrabold text-sm text-slate-800">{saving.namatarget}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs text-slate-500 mb-1 font-semibold">{t('modal_contrib.amount_lbl')}</label>
            <div className="relative">
              <span className="absolute left-3 top-2.5 font-bold text-slate-400 text-sm">Rp</span>
              <input type="number" required value={nominal} onChange={e => setNominal(e.target.value)}
                placeholder={t('modal_contrib.amount_ph')}
                className="w-full border-2 border-slate-200 rounded-xl px-3 py-2 text-base font-bold text-slate-800 focus:outline-none focus:border-savora-800 pl-10 transition-all duration-300"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs text-slate-500 mb-1 font-semibold">{t('modal_contrib.source_lbl')}</label>
            <select value={akunSumber} onChange={e => setAkunSumber(e.target.value)}
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-savora-800">
              {accounts.map(acc => (
                <option key={acc.id} value={acc.namaakun}>{acc.namaakun} ({acc.tipe})</option>
              ))}
            </select>
          </div>

          <button type="submit" disabled={isLoading}
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 rounded-xl shadow-lg transition duration-200 mt-4">
            {isLoading ? t('modal_contrib.btn_saving') : t('modal_contrib.btn_save')}
          </button>
          <div className="mt-4 text-center">
            <p className="text-[10px] text-slate-400 italic">
              {t('modal_contrib.note')}
            </p>
          </div>
        </form>
      </div>
    </div>
  )
}
