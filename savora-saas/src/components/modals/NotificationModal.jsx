import React, { useState, useEffect } from 'react'
import { notificationService } from '../../services/notificationService'
import { useLanguage } from '../../contexts/LanguageContext'

export default function NotificationModal({ isOpen, onClose, onViewAll, onMarkAsRead, onOpenTransaction }) {
  const { t } = useLanguage()
  const [notifications, setNotifications] = useState([])
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (isOpen) {
      loadData()
    }
  }, [isOpen])

  const loadData = async () => {
    setIsLoading(true)
    try {
      const notifs = await notificationService.getNotifications()
      // Display unread, or if none, up to 3 most recent
      const unread = notifs.filter(n => !n.read)
      if (unread.length > 0) {
        setNotifications(unread.slice(0, 3))
        setTimeout(async () => {
          await notificationService.markAsRead()
          if (onMarkAsRead) onMarkAsRead()
        }, 1000)
      } else {
        setNotifications(notifs.slice(0, 3))
      }
    } catch (e) {
      console.error(e)
    } finally {
      setIsLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4 transition-opacity duration-300">
      <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl transform transition-transform duration-300">
        
        <div className="flex justify-between items-start mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-500 flex items-center justify-center">
              <i className="fa-solid fa-bell text-lg"></i>
            </div>
            <div>
              <h3 className="font-extrabold text-lg text-slate-800">{t('modal_notif.title')}</h3>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{t('modal_notif.subtitle')}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-xl transition">
            <i className="fa-solid fa-xmark text-xl"></i>
          </button>
        </div>

        <div className="border-t border-slate-100/50 pt-6 mb-6 space-y-4">
          {isLoading ? (
            <p className="text-sm text-slate-400 text-center">{t('modal_notif.loading')}</p>
          ) : notifications.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-4">{t('modal_notif.empty')}</p>
          ) : (
            notifications.map(n => {
              const isWarning = n.type === 'warning' || n.type === 'error'
              
              // Extract title and description if format is "Title: Description"
              let title = isWarning ? t('modal_notif.warn_title') : t('modal_notif.info_title')
              let desc = n.text
              
              if (n.text.includes(':')) {
                const parts = n.text.split(':')
                title = parts[0].trim()
                desc = parts.slice(1).join(':').trim()
              }

              return (
                <div key={n.id} className={`p-4 rounded-2xl border flex flex-col sm:flex-row gap-3 ${isWarning ? 'bg-rose-50/50 border-rose-100' : 'bg-slate-50 border-slate-100'}`}>
                  <div className="flex gap-3 flex-1">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs shrink-0 ${isWarning ? 'bg-rose-100 text-rose-500' : 'bg-blue-100 text-blue-500'}`}>
                      <i className={`fa-solid ${isWarning ? 'fa-triangle-exclamation' : 'fa-info'}`}></i>
                    </div>
                    <div>
                      <h4 className="font-bold text-sm text-slate-800">{title}</h4>
                      <p className="text-xs text-slate-500 mt-1 leading-relaxed">{desc}</p>
                    </div>
                  </div>
                  {isWarning && title.includes('Kritis') && (
                    <button onClick={() => {
                        onClose()
                        if (onOpenTransaction) onOpenTransaction({ tipe: 'Transfer Kas', deskripsi: 'Pemindahan Dana Darurat' })
                      }} 
                      className="bg-[#1e293b] hover:bg-slate-800 text-white text-[11px] font-bold px-4 py-2 rounded-xl transition shadow-sm shrink-0 sm:self-center mt-2 sm:mt-0">
                      Pindahkan Dana
                    </button>
                  )}
                </div>
              )
            })
          )}
        </div>

        <div className="space-y-2">
          <button onClick={onViewAll} className="w-full bg-[#1e293b] hover:bg-slate-800 text-white font-bold py-3 rounded-xl shadow-md transition">
            {t('modal_notif.btn_all')}
          </button>
          <button onClick={onClose} className="w-full bg-slate-50 hover:bg-slate-100 text-slate-600 font-bold py-3 rounded-xl transition">
            {t('modal_notif.btn_close')}
          </button>
        </div>

      </div>
    </div>
  )
}
