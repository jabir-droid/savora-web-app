import React, { useState, useEffect } from 'react'
import { settingsService } from '../../services/settingsService'
import { useLanguage } from '../../contexts/LanguageContext'
import { triggerHaptic } from '../../utils/haptics'
import { useToast } from '../../contexts/ToastContext'

export default function FinanceConfigModal({ 
  isOpen, 
  onClose, 
  initialSettings, 
  accounts, 
  onSettingsChange,
  onOpenAddAccount,
  onOpenEditAccount,
  onDeleteAccount,
  onOpenConnectBank
}) {
  const { t } = useLanguage()
  const { showToast } = useToast()
  
  const [settings, setSettings] = useState(initialSettings || {})

  useEffect(() => {
    if (isOpen && initialSettings) {
      setSettings(initialSettings)
    }
  }, [isOpen, initialSettings])

  if (!isOpen) return null

  const handleUpdate = async (key, value) => {
    const updated = { ...settings, [key]: value }
    setSettings(updated)
    try {
      await settingsService.updateSettings({ [key]: value })
      triggerHaptic([30])
      onSettingsChange(updated)
    } catch (e) {
      showToast(t('settings.up_fail') + e.message, 'error')
    }
  }

  const connectedBanks = settings.connected_banks || []

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-3xl w-full max-w-md shadow-xl flex flex-col max-h-[90vh] animate-slide-up">
        <div className="flex justify-between items-center p-5 border-b border-slate-100 shrink-0">
          <h3 className="font-bold text-slate-800 flex items-center gap-2">
            <i className="fa-solid fa-coins text-slate-400"></i>
            {t('settings.lbl_fin_config') || 'Keuangan & Cloud'}
          </h3>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 transition">
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>
        
        <div className="p-6 overflow-y-auto space-y-6">
          
          {/* Cloud & Connectivity */}
          <div className="space-y-4">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">{t('settings.cloud') || 'Konektivitas Cloud'}</h4>
            <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 flex flex-col gap-3">
              <div className="flex justify-between items-start gap-4">
                <div>
                  <h4 className="font-bold text-sm text-slate-800">{t('settings.uji')}</h4>
                  <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">{t('settings.uji_desc')}</p>
                </div>
                <button onClick={onOpenConnectBank} className="bg-savora-800 text-white text-[11px] font-bold px-3 py-2 rounded-lg hover:bg-savora-900 transition shrink-0 whitespace-nowrap">
                  <i className="fa-solid fa-link mr-1"></i> Hubungkan
                </button>
              </div>
              
              {connectedBanks.length > 0 && (
                <div className="flex gap-2 flex-wrap mt-1 pt-3 border-t border-slate-200/50">
                  {connectedBanks.map((bank, idx) => (
                    <div key={idx} className="bg-white border border-emerald-200 shadow-sm rounded-lg px-2.5 py-1.5 flex items-center gap-1.5">
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
                      <span className="text-[10px] font-bold text-slate-700">{bank} terhubung</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Account Management */}
          <div className="space-y-4 border-t border-slate-100 pt-6">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">{t('settings.lbl_acc_list') || 'Manajemen Rekening'}</h4>
              <button onClick={onOpenAddAccount} className="text-savora-800 text-xs font-bold hover:underline">
                + {t('settings.btn_add_acc')}
              </button>
            </div>
            
            <div className="grid grid-cols-1 gap-2">
              {accounts.map(acc => (
                <div key={acc.id} className="border border-slate-200 rounded-xl p-3 flex justify-between items-center bg-white shadow-sm">
                  <div>
                    <p className="text-sm font-bold text-slate-800">{acc.namaakun}</p>
                    <p className="text-[10px] font-bold text-slate-400 uppercase mt-0.5">{acc.tipe}</p>
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => onOpenEditAccount(acc)} className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 transition" title={t('settings.edit_wallet')}>
                      <i className="fa-solid fa-pen text-xs"></i>
                    </button>
                    <button onClick={() => onDeleteAccount(acc.id)} className="w-8 h-8 flex items-center justify-center rounded-lg text-rose-400 hover:bg-rose-50 transition" title={t('settings.del_wallet')}>
                      <i className="fa-solid fa-trash-can text-xs"></i>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Basic Config */}
          <div className="space-y-4 border-t border-slate-100 pt-6">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Preferensi Default</h4>
            
            <div className="flex items-center justify-between gap-4">
              <div className="flex-1">
                <h4 className="font-bold text-sm text-slate-800">{t('settings.lbl_def_acc')}</h4>
                <p className="text-xs text-slate-400 mt-1">{t('settings.desc_def_acc')}</p>
              </div>
              <select value={settings.default_account || ''} onChange={e => handleUpdate('default_account', e.target.value)}
                className="border border-slate-200 rounded-xl px-3 py-2.5 text-xs focus:outline-none focus:border-savora-800 bg-slate-50 min-w-[110px]">
                <option value="">{t('settings.select')}</option>
                {accounts.map(a => <option key={a.id} value={a.namaakun}>{a.namaakun}</option>)}
              </select>
            </div>

            <div className="flex items-center justify-between gap-4">
              <div className="flex-1">
                <h4 className="font-bold text-sm text-slate-800">{t('settings.lbl_currency')}</h4>
                <p className="text-xs text-slate-400 mt-1">{t('settings.desc_currency')}</p>
              </div>
              <select value={settings.currency || 'IDR'} onChange={e => handleUpdate('currency', e.target.value)}
                className="border border-slate-200 rounded-xl px-3 py-2.5 text-xs focus:outline-none focus:border-savora-800 bg-slate-50 min-w-[110px]">
                <option value="IDR">Rupiah (Rp)</option>
                <option value="USD">Dollar ($)</option>
              </select>
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}
