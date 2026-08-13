import React, { useState, useEffect } from 'react'
import { supabase } from '../../supabaseClient'
import { settingsService } from '../../services/settingsService'
import { useToast } from '../../contexts/ToastContext'
import { useLanguage } from '../../contexts/LanguageContext'

export default function TelegramModal({ isOpen, onClose, initialSettings, onSettingsChange }) {
  const { showToast } = useToast()
  const { t } = useLanguage()
  const [isLoading, setIsLoading] = useState(false)
  const [linkCode, setLinkCode] = useState('')

  useEffect(() => {
    if (isOpen) {
      checkOrGenerateCode()
    }
  }, [isOpen])

  const checkOrGenerateCode = async () => {
    if (initialSettings?.telegram_chat_id) return // Already linked
    
    let code = initialSettings?.telegram_link_code
    if (!code) {
      code = Math.floor(10000 + Math.random() * 90000).toString()
      try {
        const updated = await settingsService.updateSettings({ telegram_link_code: code })
        onSettingsChange(updated)
        setLinkCode(code)
      } catch (err) {
        console.error(err)
      }
    } else {
      setLinkCode(code)
    }
  }

  const handleUnlink = async () => {
    if (!confirm(t('tg.unlink_confirm') || 'Yakin ingin memutuskan koneksi dengan Telegram? Anda tidak akan bisa mencatat transaksi via Telegram lagi.')) return
    
    setIsLoading(true)
    try {
      const updated = await settingsService.updateSettings({ 
        telegram_chat_id: null,
        telegram_link_code: null
      })
      onSettingsChange(updated)
      showToast(t('tg.unlink_success') || 'Koneksi Telegram berhasil diputus', 'success')
      setLinkCode('')
      checkOrGenerateCode()
    } catch (e) {
      showToast(t('tg.unlink_fail') || 'Gagal memutuskan koneksi', 'error')
    } finally {
      setIsLoading(false)
    }
  }

  if (!isOpen) return null

  const isLinked = !!initialSettings?.telegram_chat_id

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose}></div>
      
      <div className="bg-white rounded-3xl w-full max-w-md relative z-10 p-6 shadow-2xl animate-slide-up md:animate-fade-in flex flex-col max-h-[90vh]">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-50 text-blue-500 rounded-xl flex items-center justify-center text-lg shadow-sm border border-blue-100">
              <i className="fa-brands fa-telegram"></i>
            </div>
            <div>
              <h2 className="text-xl font-extrabold text-slate-800">{t('tg.title') || 'Telegram Bot'}</h2>
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">{t('tg.subtitle') || 'Integrasi Asisten Pintar'}</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center bg-slate-100 text-slate-500 rounded-full hover:bg-slate-200 transition">
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>

        <div className="overflow-y-auto no-scrollbar pb-6 space-y-6 flex-1">
          {isLinked ? (
            <div className="text-center py-6">
              <div className="w-20 h-20 bg-emerald-50 text-emerald-500 rounded-full mx-auto flex items-center justify-center text-4xl mb-4 border-4 border-emerald-100">
                <i className="fa-solid fa-check"></i>
              </div>
              <h3 className="text-lg font-bold text-slate-800">{t('tg.linked_title') || 'Akun Terhubung!'}</h3>
              <p className="text-sm text-slate-500 mt-2 mb-6">{t('tg.linked_desc') || 'Anda sudah bisa mencatat pengeluaran dengan mengirimkan foto nota ke Bot Telegram Anda.'}</p>
              
              <button 
                onClick={handleUnlink}
                disabled={isLoading}
                className="w-full bg-rose-50 text-rose-600 hover:bg-rose-100 font-bold py-3 px-4 rounded-xl transition text-sm flex items-center justify-center gap-2"
              >
                <i className="fa-solid fa-link-slash"></i>
                {isLoading ? (t('tg.btn_processing') || 'Memproses...') : (t('tg.btn_unlink') || 'Putuskan Koneksi')}
              </button>
            </div>
          ) : (
            <div>
              <p className="text-sm text-slate-600 mb-6">
                {t('tg.unlinked_desc') || 'Hubungkan Savora dengan Telegram untuk mencatat transaksi secara otomatis hanya dengan mengirimkan foto nota ke bot Anda.'}
              </p>
              
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 mb-6 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-3 opacity-10">
                  <i className="fa-brands fa-telegram text-6xl"></i>
                </div>
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">{t('tg.step1_title') || 'Langkah 1'}</h4>
                <p className="text-sm text-slate-700 font-medium mb-1">
                  {t('tg.step1_desc') || 'Buka Bot Telegram Savora Anda.'}
                </p>
                <p className="text-xs text-slate-500">
                  {t('tg.step1_note') || '(Pastikan Anda sudah membuat bot via BotFather dan memasukkan Token di Vercel).'}
                </p>
              </div>

              <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100 relative">
                <h4 className="text-xs font-bold text-blue-500 uppercase tracking-wider mb-3">{t('tg.step2_title') || 'Langkah 2'}</h4>
                <p className="text-sm text-blue-900 font-medium mb-3">
                  {t('tg.step2_desc') || 'Kirimkan kode rahasia ini ke obrolan bot tersebut:'}
                </p>
                
                <div className="bg-white p-3 rounded-xl border border-blue-200 flex items-center justify-between shadow-sm">
                  <code className="text-lg font-bold text-blue-600 select-all tracking-wider">
                    {linkCode ? `/start SAVORA-${linkCode}` : 'Memuat...'}
                  </code>
                  <button 
                    onClick={() => {
                      navigator.clipboard.writeText(`/start SAVORA-${linkCode}`)
                      showToast(t('tg.btn_copy') || 'Kode disalin!', 'success')
                    }}
                    className="w-8 h-8 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg flex items-center justify-center transition"
                  >
                    <i className="fa-regular fa-copy"></i>
                  </button>
                </div>
                
                <p className="text-[11px] text-blue-600 mt-3 text-center opacity-80">
                  {t('tg.step2_note') || 'Setelah mengirim kode, tutup jendela ini lalu muat ulang halaman.'}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
