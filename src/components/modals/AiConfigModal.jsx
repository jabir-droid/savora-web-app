import React, { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { settingsService } from '../../services/settingsService'
import { useToast } from '../../contexts/ToastContext'
import { useLanguage } from '../../contexts/LanguageContext'
import ConfirmModal from './ConfirmModal'

// Pengaturan Groq API Key (untuk AI Scan & AI Chat).
// Kunci tersimpan TIDAK PERNAH ditampilkan kembali di sini — yang
// terlihat hanya statusnya; kolom isian selalu mulai dari kosong.
export default function AiConfigModal({ isOpen, onClose, initialSettings, onSettingsChange }) {
  const { showToast } = useToast()
  const { t } = useLanguage()
  const [apiKey, setApiKey] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  const isConfigured = !!(initialSettings && initialSettings.groq_api_key)

  useEffect(() => {
    if (isOpen) setApiKey('')
  }, [isOpen])

  const handleSave = async () => {
    const key = apiKey.trim()
    if (!key.startsWith('gsk_') || key.length < 20) {
      showToast(t('settings.ai_err_format'), 'error')
      return
    }
    setIsSaving(true)
    try {
      const updated = await settingsService.updateSettings({ groq_api_key: key })
      onSettingsChange(updated)
      showToast(t('settings.ai_saved'), 'success')
      setApiKey('')
      onClose()
    } catch (e) {
      showToast(t('settings.ai_save_fail') + e.message, 'error')
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async () => {
    setShowDeleteConfirm(false)
    setIsSaving(true)
    try {
      const updated = await settingsService.updateSettings({ groq_api_key: null })
      onSettingsChange(updated)
      showToast(t('settings.ai_deleted'), 'success')
    } catch (e) {
      showToast(t('settings.ai_save_fail') + e.message, 'error')
    } finally {
      setIsSaving(false)
    }
  }

  if (!isOpen) return null

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose}></div>

      <div className="bg-white rounded-3xl w-full max-w-md relative z-10 p-6 shadow-2xl animate-slide-up md:animate-fade-in flex flex-col max-h-[90vh]">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-violet-50 text-violet-600 rounded-xl flex items-center justify-center text-lg shadow-sm border border-violet-100">
              <i className="fa-solid fa-robot"></i>
            </div>
            <div>
              <h2 className="text-xl font-extrabold text-slate-800">{t('settings.ai_title')}</h2>
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">{t('settings.ai_subtitle')}</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center bg-slate-100 text-slate-500 rounded-full hover:bg-slate-200 transition">
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>

        <div className="overflow-y-auto no-scrollbar pb-2 space-y-5 flex-1">
          <p className="text-sm text-slate-600">{t('settings.ai_desc')}</p>

          <div className={`flex items-center gap-2 px-4 py-3 rounded-2xl border text-sm font-bold ${isConfigured ? 'bg-emerald-50 border-emerald-100 text-emerald-700' : 'bg-slate-50 border-slate-200 text-slate-500'}`}>
            <i className={`fa-solid ${isConfigured ? 'fa-circle-check' : 'fa-circle-exclamation'}`}></i>
            {isConfigured ? t('settings.ai_status_on') : t('settings.ai_status_off')}
          </div>

          <div>
            <label className="block text-xs text-slate-500 mb-1 font-semibold">{t('settings.ai_key_label')}</label>
            <input
              type="password"
              value={apiKey}
              onChange={e => setApiKey(e.target.value)}
              placeholder={t('settings.ai_key_ph')}
              autoComplete="off"
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-savora-800"
            />
            <a
              href="https://console.groq.com/keys"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 mt-2 text-xs font-bold text-violet-600 hover:text-violet-800 transition"
            >
              <i className="fa-solid fa-arrow-up-right-from-square"></i>
              {t('settings.ai_get_key')}
            </a>
          </div>

          <button
            onClick={handleSave}
            disabled={isSaving || !apiKey.trim()}
            className="w-full bg-savora-800 hover:bg-savora-900 disabled:opacity-50 text-white font-bold py-3 rounded-xl shadow-lg shadow-savora-800/20 active:scale-95 transition text-sm"
          >
            {isSaving ? t('settings.ai_saving') : t('settings.ai_save')}
          </button>

          {isConfigured && (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              disabled={isSaving}
              className="w-full bg-rose-50 text-rose-600 hover:bg-rose-100 font-bold py-3 px-4 rounded-xl transition text-sm flex items-center justify-center gap-2"
            >
              <i className="fa-solid fa-trash"></i>
              {t('settings.ai_delete')}
            </button>
          )}

          <p className="text-[11px] text-slate-400 text-center">{t('settings.ai_note')}</p>
        </div>
      </div>

      <ConfirmModal
        isOpen={showDeleteConfirm}
        title={t('settings.ai_delete_title')}
        message={t('settings.ai_delete_msg')}
        confirmText={t('settings.ai_delete')}
        onConfirm={handleDelete}
        onCancel={() => setShowDeleteConfirm(false)}
        type="warning"
      />
    </div>,
    document.body
  )
}
