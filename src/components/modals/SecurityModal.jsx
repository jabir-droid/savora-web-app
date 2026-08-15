import React, { useState, useEffect } from 'react'
import { settingsService } from '../../services/settingsService'
import { triggerHaptic } from '../../utils/haptics'
import { useToast } from '../../contexts/ToastContext'
import { useLanguage } from '../../contexts/LanguageContext'

export default function SecurityModal({ isOpen, onClose, initialSettings, onSettingsChange }) {
  const { t } = useLanguage()
  const { showToast } = useToast()
  
  const [settings, setSettings] = useState(initialSettings || {})
  const [newPin, setNewPin] = useState('')
  const [isSaving, setIsSaving] = useState(false)

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
      if (key === 'haptic_enabled' && value) {
        if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate([50, 100, 50])
      } else {
        triggerHaptic([30])
      }
      onSettingsChange(updated)
    } catch (e) {
      showToast(t('settings.up_fail') + e.message, 'error')
    }
  }

  const handleSavePin = async () => {
    if (newPin.length !== 4) return showToast(t('settings.pin_err') || 'PIN harus 4 digit', 'error')
    setIsSaving(true)
    try {
      await settingsService.updateSettings({ pin_code: newPin, is_pin_enabled: true })
      const updated = { ...settings, is_pin_enabled: true }
      setSettings(updated)
      setNewPin('')
      triggerHaptic([50])
      showToast(t('settings.pin_success') || 'PIN berhasil disimpan', 'success')
      onSettingsChange(updated)
    } catch (e) {
      showToast(t('settings.pin_fail') + e.message, 'error')
    } finally {
      setIsSaving(false)
    }
  }



  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-3xl w-full max-w-md shadow-xl flex flex-col max-h-[90vh] animate-slide-up">
        <div className="flex justify-between items-center p-5 border-b border-slate-100 shrink-0">
          <h3 className="font-bold text-slate-800 flex items-center gap-2">
            <i className="fa-solid fa-shield-halved text-emerald-500"></i>
            {t('settings.lbl_security') || 'Keamanan'}
          </h3>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 transition">
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>
        
        <div className="p-6 overflow-y-auto space-y-6">
          {/* PIN Lock */}
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-4">
              <div className="flex-1">
                <h4 className="font-bold text-sm text-slate-800">{t('settings.lbl_pin_lock')}</h4>
                <p className="text-xs text-slate-400 mt-1">{t('settings.desc_pin_lock')}</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer shrink-0">
                <input type="checkbox" className="sr-only peer" checked={settings.is_pin_enabled || false} onChange={e => handleUpdate('is_pin_enabled', e.target.checked)} />
                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
              </label>
            </div>

            <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4">
              <h4 className="font-bold text-xs text-slate-600 mb-3">{t('settings.lbl_change_pin')}</h4>
              <div className="flex gap-2">
                <input type="password" value={newPin} onChange={e => setNewPin(e.target.value)} maxLength="4" placeholder="PIN (4 digit)"
                  className="flex-1 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-emerald-500 bg-white" />
                <button onClick={handleSavePin} disabled={isSaving || newPin.length !== 4} className="bg-emerald-500 hover:bg-emerald-600 disabled:bg-slate-300 text-white text-xs font-bold px-5 py-2.5 rounded-xl transition shadow">
                  {t('settings.btn_save')}
                </button>
              </div>
            </div>
          </div>



          <div className="border-t border-slate-100 pt-6 flex items-center justify-between gap-4">
            <div className="flex-1">
              <h4 className="font-bold text-sm text-slate-800">{t('settings.lbl_haptic')}</h4>
              <p className="text-xs text-slate-400 mt-1">{t('settings.desc_haptic')}</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer shrink-0">
              <input type="checkbox" className="sr-only peer" checked={settings.haptic_enabled || false} onChange={e => handleUpdate('haptic_enabled', e.target.checked)} />
              <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
            </label>
          </div>
        </div>
      </div>
    </div>
  )
}
