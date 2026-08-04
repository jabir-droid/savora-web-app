import React, { useState, useEffect } from 'react'
import { accountService } from '../../services/accountService'
import { useToast } from '../../contexts/ToastContext'
import { useLanguage } from '../../contexts/LanguageContext'

export default function EditAccountModal({ isOpen, onClose, onSuccess, account }) {
  const { t } = useLanguage()
  const { showToast } = useToast()
  const [namaakun, setNamaAkun] = useState('')
  const [tipe, setTipe] = useState('CASH')
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (account) {
      setNamaAkun(account.namaakun)
      setTipe(account.tipe)
    }
  }, [account])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setIsLoading(true)
    
    try {
      await accountService.updateAccount(account.id, {
        namaakun,
        tipe
      })
      showToast(t('modal_acc.success_edit'), 'success')
      onSuccess()
      onClose()
    } catch (e) {
      showToast(t('modal_acc.fail_edit') + e.message, 'error')
    } finally {
      setIsLoading(false)
    }
  }

  if (!isOpen || !account) return null

  return (
    <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4 transition-opacity duration-300">
      <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl transform transition-transform duration-300 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h3 className="font-extrabold text-lg text-slate-800">{t('modal_acc.title_edit')}</h3>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-xl transition">
            <i className="fa-solid fa-xmark text-lg"></i>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs text-slate-500 mb-1 font-semibold">{t('modal_acc.name_new_label')}</label>
            <input type="text" required value={namaakun} onChange={e => setNamaAkun(e.target.value)}
              placeholder={t('modal_acc.name_ph')}
              className="w-full border-2 border-slate-200 rounded-xl px-3 py-2 text-sm font-semibold text-slate-800 focus:outline-none focus:border-savora-800 transition-all duration-300"
            />
          </div>

          <div>
            <label className="block text-xs text-slate-500 mb-1 font-semibold">{t('modal_acc.type_label')}</label>
            <select value={tipe} onChange={e => setTipe(e.target.value)}
              className="w-full border-2 border-slate-200 rounded-xl px-3 py-2 text-sm font-semibold text-slate-800 focus:outline-none focus:border-savora-800 transition-all duration-300">
              <option value="CASH">{t('modal_acc.type_cash')}</option>
              <option value="BANK">{t('modal_acc.type_bank')}</option>
              <option value="E-WALLET">{t('modal_acc.type_ewallet')}</option>
            </select>
            <p className="text-[10px] text-slate-400 mt-2">{t('modal_acc.note')}</p>
          </div>

          <button type="submit" disabled={isLoading}
            className="w-full bg-savora-800 hover:bg-savora-900 text-white font-bold py-3 rounded-xl shadow-lg transition duration-200 mt-4">
            {isLoading ? t('modal_acc.btn_saving') : t('modal_acc.btn_save_edit')}
          </button>
        </form>
      </div>
    </div>
  )
}
