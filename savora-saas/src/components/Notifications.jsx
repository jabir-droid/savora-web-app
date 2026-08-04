import React, { useState, useEffect } from 'react'
import { notificationService } from '../services/notificationService'
import { useToast } from '../contexts/ToastContext'
import { useLanguage } from '../contexts/LanguageContext'
import { formatCurrency } from '../utils/formatCurrency'
import ConfirmModal from './modals/ConfirmModal'

export default function Notifications({ onOpenTransaction, onMarkAsRead }) {
  const { t } = useLanguage()
  const { showToast } = useToast()
  const [filter, setFilter] = useState('all')
  const [notifications, setNotifications] = useState([])
  const [prefs, setPrefs] = useState({
    notif_overbudget: true,
    notif_critical: true,
    notif_critical_threshold: 1000000,
    notif_checklist: true
  })
  const [isLoading, setIsLoading] = useState(true)
  const [showConfirm, setShowConfirm] = useState(false)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      setIsLoading(true)
      const [notifs, settings] = await Promise.all([
        notificationService.getNotifications(),
        notificationService.getSettings()
      ])
      setNotifications(notifs || [])
      if (settings) {
        setPrefs(settings)
      }
      
      // Mark as read after a short delay so user sees them as new temporarily
      setTimeout(() => {
        notificationService.markAsRead()
        setNotifications(prev => prev.map(n => ({...n, read: true})))
        if (onMarkAsRead) onMarkAsRead()
      }, 5000)
    } catch (e) {
      console.error(e)
      showToast(t('notif.load_fail'), 'error')
    } finally {
      setIsLoading(false)
    }
  }

  const updateSetting = async (key, value) => {
    try {
      setPrefs(prev => ({...prev, [key]: value}))
      await notificationService.updateSettings({ [key]: value })
    } catch (e) {
      showToast(t('notif.save_fail'), 'error')
      // revert (simplistic)
      setPrefs(prev => ({...prev, [key]: !value}))
    }
  }

  const handleThresholdBlur = async () => {
    try {
      await notificationService.updateSettings({ notif_critical_threshold: Number(prefs.notif_critical_threshold) })
      showToast(t('notif.limit_success'), 'success')
    } catch (e) {
      console.error(e)
      showToast(t('notif.limit_fail') + (e.message || JSON.stringify(e)), 'error')
    }
  }

  const clearHistory = async () => {
    try {
      await notificationService.clearHistory()
      setNotifications([])
      showToast(t('notif.clear_success'), 'success')
    } catch (e) {
      showToast(t('notif.clear_fail'), 'error')
    }
  }

  const filteredNotifs = filter === 'unread' ? notifications.filter(n => !n.read) : notifications
  const unreadCount = notifications.filter(n => !n.read).length

  // Helper formatter for time
  const formatTime = (isoString) => {
    const d = new Date(isoString)
    return new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short' }).format(d)
  }

  return (
    <section className="space-y-6 animate-fade-in">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* LEFT COLUMN */}
        <div className="lg:col-span-2 bg-white rounded-2xl p-6 shadow-sm border border-slate-200/60 flex flex-col justify-between">
          <div>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 pb-4 border-b border-slate-100">
              <div>
                <h3 className="font-extrabold text-lg text-slate-800">{t('notif.title')}</h3>
                <p className="text-xs text-slate-400">{t('notif.subtitle')}</p>
                <div className="flex gap-2 mt-3">
                  <button onClick={() => setFilter('all')} className={`px-3.5 py-1.5 rounded-xl text-xs transition duration-150 ${filter === 'all' ? 'font-bold bg-savora-800 text-white shadow-sm' : 'font-semibold bg-slate-100 text-slate-500 hover:text-slate-800'}`}>{t('notif.filter_all')}</button>
                  <button onClick={() => setFilter('unread')} className={`px-3.5 py-1.5 rounded-xl text-xs transition duration-150 flex items-center gap-1.5 ${filter === 'unread' ? 'font-bold bg-savora-800 text-white shadow-sm' : 'font-semibold bg-slate-100 text-slate-500 hover:text-slate-800'}`}>
                    {unreadCount > 0 && filter !== 'unread' && <span className="inline-block w-2 h-2 rounded-full bg-[#F97316] animate-pulse"></span>}
                    <span>{t('notif.filter_unread')}</span>
                    {unreadCount > 0 && <span className="bg-[#F97316] text-white text-[9px] font-extrabold px-1.5 py-0.5 rounded-full">{unreadCount}</span>}
                  </button>
                </div>
              </div>
              <button onClick={() => setShowConfirm(true)} className="bg-rose-50 hover:bg-rose-100 text-rose-600 text-xs font-semibold px-3 py-2 rounded-xl transition flex items-center gap-1.5 shadow-sm">
                <i className="fa-regular fa-trash-can"></i> <span>{t('notif.btn_clear')}</span>
              </button>
            </div>

            <div className="space-y-3 max-h-[450px] overflow-y-auto pr-1">
              {filteredNotifs.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-8">{t('notif.empty')}</p>
              ) : filteredNotifs.map(n => {
                const isWarning = n.type === 'warning' || n.type === 'error'
                let title = isWarning ? t('notif.warn_title') : t('notif.info_title')
                let desc = n.text
                if (n.text.includes(':')) {
                  const parts = n.text.split(':')
                  title = parts[0].trim()
                  desc = parts.slice(1).join(':').trim()
                }

                if (title === 'Saldo Kritis') title = t('notif.cfg_critical')
                else if (title === 'Pengingat Checklist') title = t('notif.cfg_checklist')
                else if (title === 'Overbudget') title = t('notif.cfg_overbudget')
                
                if (desc.includes('di bawah batas aman')) {
                  const match = desc.match(/Saldo rekening (.*?) kamu sekarang di bawah batas aman \(Rp (.*?)\)/)
                  if (match) {
                    const amt = parseFloat(match[2].replace(/\./g, '').replace(/,/g, '.')) || 0
                    desc = t('notif.msg_critical_desc').replace('{account}', match[1]).replace('{amount}', formatCurrency(amt))
                  }
                }
                if (desc.includes('tugas/tagihan yang belum selesai')) {
                  const match = desc.match(/Anda memiliki (\d+) tugas\/tagihan yang belum selesai hari ini/)
                  if (match) {
                    desc = t('notif.msg_checklist_desc').replace('{count}', match[1])
                  }
                }
                if (desc.includes('telah melebihi batas')) {
                  const match = desc.match(/Pengeluaran untuk kategori (.*?) bulan ini \(Rp (.*?)\) telah melebihi batas \(Rp (.*?)\)/)
                  if (match) {
                    const spentNum = parseFloat(match[2].replace(/\./g, '').replace(/,/g, '.')) || 0
                    const limitNum = parseFloat(match[3].replace(/\./g, '').replace(/,/g, '.')) || 0
                    desc = t('notif.msg_overbudget_desc')
                      .replace('{category}', match[1])
                      .replace('{spent}', formatCurrency(spentNum))
                      .replace('{limit}', formatCurrency(limitNum))
                  }
                }

                return (
                  <div key={n.id} className={`p-4 rounded-xl border flex justify-between items-center gap-4 ${n.read ? 'bg-slate-50 border-slate-100' : (isWarning ? 'bg-rose-50/30 border-rose-100 shadow-sm' : 'bg-white border-savora-200 shadow-sm')} relative overflow-hidden`}>
                    {!n.read && <div className={`absolute left-0 top-0 bottom-0 w-1 ${isWarning ? 'bg-rose-500' : 'bg-savora-orange'}`}></div>}
                    <div className="flex gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs shrink-0 ${isWarning ? 'bg-rose-100 text-rose-500' : 'bg-blue-50 text-blue-500'}`}>
                        <i className={`fa-solid ${isWarning ? 'fa-triangle-exclamation' : 'fa-bell'}`}></i>
                      </div>
                      <div>
                        <p className={`text-sm ${n.read ? 'text-slate-600' : (isWarning ? 'text-rose-600' : 'text-slate-800')} font-bold`}>{title}</p>
                        <p className="text-xs text-slate-500 mt-1">{desc}</p>
                        <p className="text-[10px] text-slate-400 mt-1">{formatTime(n.created_at)}</p>
                      </div>
                    </div>
                    {isWarning && (title.includes('Kritis') || desc.includes('Kritis') || title.includes('Critical') || desc.includes('Critical')) && (
                      <button onClick={() => onOpenTransaction && onOpenTransaction({ tipe: 'Transfer Kas', deskripsi: 'Pemindahan Dana Darurat' })} 
                        className="bg-[#1e293b] hover:bg-slate-800 text-white text-[11px] font-bold px-4 py-2 rounded-xl transition shadow-sm shrink-0 sm:self-center mt-2 sm:mt-0">
                        {t('notif.btn_transfer')}
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN */}
        <div className="bg-slate-800 rounded-2xl p-6 shadow-sm flex flex-col text-white overflow-hidden relative h-fit border-none space-y-6">
          <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500 rounded-bl-full opacity-10"></div>
          
          <div className="relative z-10">
            <h3 className="font-bold text-base text-emerald-400 mb-1">{t('notif.config_title')}</h3>
            <p className="text-xs text-slate-300">{t('notif.config_subtitle')}</p>
          </div>

          <div className="space-y-5 relative z-10">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-bold text-xs text-slate-200">{t('notif.cfg_overbudget')}</h4>
                <p className="text-[10px] text-slate-400">{t('notif.cfg_overbudget_desc')}</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" className="sr-only peer" checked={prefs.notif_overbudget} onChange={e => updateSetting('notif_overbudget', e.target.checked)} />
                <div className="w-9 h-5 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500"></div>
              </label>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-bold text-xs text-slate-200">{t('notif.cfg_critical')}</h4>
                <p className="text-[10px] text-slate-400">{t('notif.cfg_critical_desc')}</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" className="sr-only peer" checked={prefs.notif_critical} onChange={e => updateSetting('notif_critical', e.target.checked)} />
                <div className="w-9 h-5 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500"></div>
              </label>
            </div>

            {prefs.notif_critical && (
              <div className="space-y-2">
                <label className="block text-xs text-slate-300 font-semibold">{t('notif.cfg_critical_min')}</label>
                <div className="relative">
                  <span className="absolute left-3 top-2 font-bold text-slate-400 text-xs">{localStorage.getItem('savora_currency') === 'USD' ? '$' : 'Rp'}</span>
                  <input type="number" value={prefs.notif_critical_threshold} onChange={e => setPrefs({...prefs, notif_critical_threshold: e.target.value})} onBlur={handleThresholdBlur} placeholder="1000000"
                    className="w-full bg-slate-900/50 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white font-bold focus:outline-none focus:border-emerald-500 pl-8 transition" />
                </div>
              </div>
            )}

            <div className="flex items-center justify-between pt-2 border-t border-slate-700/50">
              <div>
                <h4 className="font-bold text-xs text-slate-200">{t('notif.cfg_checklist')}</h4>
                <p className="text-[10px] text-slate-400">{t('notif.cfg_checklist_desc')}</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" className="sr-only peer" checked={prefs.notif_checklist} onChange={e => updateSetting('notif_checklist', e.target.checked)} />
                <div className="w-9 h-5 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500"></div>
              </label>
            </div>
          </div>
        </div>

      </div>

      <ConfirmModal 
        isOpen={showConfirm}
        onClose={() => setShowConfirm(false)}
        onConfirm={clearHistory}
        title={t('notif.clear_confirm').replace('?', '')}
        message={t('notif.clear_confirm')}
      />
    </section>
  )
}
