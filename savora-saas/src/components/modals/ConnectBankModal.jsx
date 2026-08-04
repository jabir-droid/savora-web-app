import React, { useState, useEffect } from 'react'
import { accountService } from '../../services/accountService'
import { notificationService } from '../../services/notificationService'
import { useToast } from '../../contexts/ToastContext'
import { useLanguage } from '../../contexts/LanguageContext'

export default function ConnectBankModal({ isOpen, onClose, onSuccess }) {
  const { t } = useLanguage()
  const { showToast } = useToast()
  const [selectedBank, setSelectedBank] = useState(null)
  const [step, setStep] = useState(1) // 1: Select Bank, 2: Login, 3: Connecting
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  
  const banks = [
    { id: 'bca', name: 'BCA', color: 'bg-blue-600', logo: 'fa-building-columns' },
    { id: 'mandiri', name: 'Mandiri', color: 'bg-yellow-500', logo: 'fa-building-columns' },
    { id: 'bni', name: 'BNI', color: 'bg-orange-500', logo: 'fa-building-columns' },
    { id: 'bri', name: 'BRI', color: 'bg-blue-800', logo: 'fa-building-columns' },
    { id: 'jago', name: 'Bank Jago', color: 'bg-orange-400', logo: 'fa-building-columns' },
    { id: 'seabank', name: 'SeaBank', color: 'bg-orange-600', logo: 'fa-building-columns' },
  ]

  const handleConnect = async (e) => {
    e.preventDefault()
    setStep(3)
    
    // Simulate connection delay
      setTimeout(async () => {
      try {
        // Create a new account with a random balance between 1M and 10M to simulate real connection
        const randomBalance = Math.floor(Math.random() * 9000000) + 1000000
        await accountService.createAccount(`${selectedBank.name} (Auto)`, 'BANK', randomBalance)
        
        // Save connected state to Supabase
        const settings = await notificationService.getSettings()
        const connectedBanks = settings.connected_banks || []
        
        if (!connectedBanks.includes(selectedBank.name)) {
          connectedBanks.push(selectedBank.name)
          await notificationService.updateSettings({ connected_banks: connectedBanks })
        }

        showToast(`${t('modal_bank.success_pt1')}${selectedBank.name}${t('modal_bank.success_pt2')}`, 'success')
        onSuccess()
        handleClose()
      } catch (error) {
        showToast(`${t('modal_bank.fail')}${selectedBank.name}: ` + error.message, 'error')
        setStep(2)
      }
    }, 2500)
  }

  const handleClose = () => {
    setStep(1)
    setSelectedBank(null)
    setUsername('')
    setPassword('')
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4 transition-opacity duration-300">
      <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl transform transition-transform duration-300">
        <div className="flex justify-between items-center mb-6">
          <h3 className="font-extrabold text-lg text-slate-800">
            {step === 1 ? t('modal_bank.title_select') : step === 2 ? `${t('modal_bank.title_login')} ${selectedBank?.name}` : t('modal_bank.title_connect')}
          </h3>
          <button onClick={handleClose} disabled={step === 3} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-xl transition disabled:opacity-50">
            <i className="fa-solid fa-xmark text-lg"></i>
          </button>
        </div>

        {step === 1 && (
          <div className="space-y-4">
            <p className="text-xs text-slate-500 mb-2">{t('modal_bank.desc_select')}</p>
            <div className="grid grid-cols-2 gap-3">
              {banks.map(bank => (
                <button
                  key={bank.id}
                  onClick={() => { setSelectedBank(bank); setStep(2); }}
                  className="flex flex-col items-center justify-center p-4 border border-slate-200 rounded-xl hover:border-savora-800 hover:bg-slate-50 transition gap-2"
                >
                  <div className={`w-10 h-10 rounded-full ${bank.color} text-white flex items-center justify-center shadow-sm`}>
                    <i className={`fa-solid ${bank.logo}`}></i>
                  </div>
                  <span className="text-xs font-bold text-slate-700">{bank.name}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 2 && (
          <form onSubmit={handleConnect} className="space-y-4">
            <div className="p-3 bg-blue-50 text-blue-700 text-xs rounded-xl border border-blue-100 flex gap-2">
              <i className="fa-solid fa-shield-halved mt-0.5"></i>
              <p>{t('modal_bank.desc_secure')}</p>
            </div>
            
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">{t('modal_bank.user_lbl')}</label>
              <input type="text" required value={username} onChange={e => setUsername(e.target.value)}
                placeholder={t('modal_bank.user_ph')}
                className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-savora-800 transition"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">{t('modal_bank.pass_lbl')}</label>
              <input type="password" required value={password} onChange={e => setPassword(e.target.value)}
                placeholder={t('modal_bank.pass_ph')}
                className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-savora-800 transition"
              />
            </div>
            
            <div className="pt-2 flex gap-3">
              <button type="button" onClick={() => setStep(1)} className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-3 rounded-xl transition">
                {t('modal_bank.btn_back')}
              </button>
              <button type="submit" className="flex-1 bg-savora-800 hover:bg-savora-900 text-white font-bold py-3 rounded-xl shadow-lg transition">
                {t('modal_bank.btn_connect')}
              </button>
            </div>
          </form>
        )}

        {step === 3 && (
          <div className="py-8 flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 border-4 border-slate-100 border-t-savora-800 rounded-full animate-spin mb-4"></div>
            <h4 className="font-bold text-slate-800 mb-1">{t('modal_bank.sync_title')}</h4>
            <p className="text-xs text-slate-500">{t('modal_bank.sync_desc_pt1')}{selectedBank?.name}{t('modal_bank.sync_desc_pt2')}</p>
          </div>
        )}
      </div>
    </div>
  )
}
