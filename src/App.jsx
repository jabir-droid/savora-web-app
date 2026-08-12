import React, { useState, useEffect } from 'react'
import Dashboard from './components/Dashboard'
import Transactions from './components/Transactions'
import Savings from './components/Savings'
import Statistics from './components/Statistics'
import Calendar from './components/Calendar'
import Categories from './components/Categories'
import AiAssistant from './components/AiAssistant'
import Settings from './components/Settings'
import Notifications from './components/Notifications'
import Help from './components/Help'
import Debts from './components/Debts'
import TransactionModal from './components/modals/TransactionModal'
import NotificationModal from './components/modals/NotificationModal'
import PinLock from './components/PinLock'
import { useAuth } from './contexts/AuthContext'
import { useLanguage } from './contexts/LanguageContext'
import { useToast } from './contexts/ToastContext'
import { notificationService } from './services/notificationService'
import { calendarService } from './services/calendarService'
import { settingsService } from './services/settingsService'

export default function App() {
  const [isLoginMode, setIsLoginMode] = useState(true)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [refreshTrigger, setRefreshTrigger] = useState(0)
  const [activeTab, setActiveTab] = useState('dashboard')
  const [currentTime, setCurrentTime] = useState(new Date())
  const [unreadNotifsCount, setUnreadNotifsCount] = useState(0)
  const [isNotifModalOpen, setIsNotifModalOpen] = useState(false)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [transactionInitialData, setTransactionInitialData] = useState(null)
  
  const [isAppLocked, setIsAppLocked] = useState(false)
  const [isSettingsLoaded, setIsSettingsLoaded] = useState(false)
  
  const { user, signIn, signUp, signOut } = useAuth()
  const { t, toggleLanguage } = useLanguage()
  const { showToast } = useToast()

  // Real-time clock effect
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date())
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  // Cek Checklist Hari Ini & Unread Notifs
  useEffect(() => {
    if (user) {
      checkDailyReminders()
      fetchUnreadCount()
      
      // Cek PIN Settings
      settingsService.getSettings().then(s => {
        if (s && s.is_pin_enabled) {
          setIsAppLocked(true)
        }
        setIsSettingsLoaded(true)
      })
    }
  }, [user, refreshTrigger])

  const fetchUnreadCount = async () => {
    try {
      const notifs = await notificationService.getNotifications()
      const unread = notifs.filter(n => !n.read).length
      setUnreadNotifsCount(unread)
    } catch (e) {
      console.error(e)
    }
  }

  const checkDailyReminders = async () => {
    try {
      const settings = await notificationService.getSettings()
      if (settings && settings.notif_checklist) {
        const today = new Date().toISOString().split('T')[0]
        // Get month data
        const monthPrefix = today.substring(0, 7)
        const notes = await calendarService.getNotesForMonth(monthPrefix)
        const todayNote = notes.find(n => n.date === today)
        
        if (todayNote && todayNote.reminders && todayNote.reminders.length > 0) {
          const pending = todayNote.reminders.filter(r => !r.done)
          if (pending.length > 0) {
            await notificationService.createNotification(
              `Pengingat Checklist: Anda memiliki ${pending.length} tugas/tagihan yang belum selesai hari ini.`,
              'info'
            )
          }
        }
      }
    } catch (e) {
      console.error("Gagal mengecek reminder harian", e)
    }
  }

  const handleAuth = async (e) => {
    e.preventDefault()
    setIsLoading(true)
    try {
      if (isLoginMode) {
        const { error } = await signIn(email, password)
        if (error) throw error
        showToast('Berhasil masuk ke Savora!', 'success')
      } else {
        const { error } = await signUp(email, password)
        if (error) throw error
        showToast('Pendaftaran berhasil! Silakan masuk.', 'success')
      }
    } catch (error) {
      showToast(error.message, 'error')
    } finally {
      setIsLoading(false)
    }
  }

  const openTransactionWithData = (data) => {
    setTransactionInitialData(data)
    setIsModalOpen(true)
  }

  // Tampilan Login / Register (Sama seperti desain awal / Light Mode Savora)
  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-slate-50 font-sans">
        <div className="bg-white rounded-3xl shadow-sm border border-slate-200/60 w-full max-w-sm p-8">
          <div className="text-center mb-8">
            <div className="h-16 w-16 bg-savora-800 text-white rounded-2xl mx-auto flex items-center justify-center text-3xl mb-4 shadow-sm">
              <span className="font-black italic">S</span>
            </div>
            <h1 className="text-2xl font-extrabold text-savora-900">Savora</h1>
          </div>
          
          <form className="space-y-4" onSubmit={handleAuth}>
            <div>
              <label className="block text-[11px] font-bold text-savora-900 mb-1.5 ml-1">E-mail</label>
              <input 
                type="email" 
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 text-slate-800 text-sm rounded-xl focus:ring-1 focus:ring-savora-800 focus:border-savora-800 block p-3 outline-none transition placeholder-slate-400" 
                placeholder="nama@email.com"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-savora-900 mb-1.5 ml-1">Kata sandi</label>
              <input 
                type="password"
                required 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 text-slate-800 text-sm rounded-xl focus:ring-1 focus:ring-savora-800 focus:border-savora-800 block p-3 outline-none transition placeholder-slate-400" 
                placeholder="••••••••"
              />
            </div>

            <button 
              disabled={isLoading}
              className="w-full bg-savora-orange hover:bg-orange-600 text-white font-bold py-3 px-4 rounded-xl transition shadow-sm mt-6 text-sm disabled:opacity-50"
            >
              {isLoading ? 'Memproses...' : (isLoginMode ? 'Masuk ke Savora' : 'Daftar Gratis')}
            </button>
          </form>

          <div className="mt-6 text-center">
            <button 
              onClick={() => setIsLoginMode(!isLoginMode)} 
              className="text-xs text-savora-orange hover:underline font-bold transition"
            >
              {isLoginMode ? 'Belum punya akun? Daftar' : 'Sudah punya akun? Masuk'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Helper untuk menutup sidebar saat menu di-klik di mobile
  const handleMenuClick = (tab) => {
    setActiveTab(tab)
    setIsMobileMenuOpen(false)
  }

  // Tampilan Menunggu Settings / Terkunci PIN
  if (!isSettingsLoaded && user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 font-sans">
        <div className="w-10 h-10 border-4 border-savora-200 border-t-savora-800 rounded-full animate-spin"></div>
      </div>
    )
  }

  if (isAppLocked && user) {
    return <PinLock onUnlock={() => setIsAppLocked(false)} />
  }

  // Tampilan Utama (Persis sama seperti original Savora)
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row font-sans">
      
      {/* MOBILE OVERLAY */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/50 z-30 md:hidden" 
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* 🧭 MAIN SIDEBAR */}
      <aside className={`fixed left-0 top-0 bottom-0 w-64 bg-gradient-to-b from-savora-900 to-savora-800 text-white p-6 z-40 flex flex-col overflow-y-auto no-scrollbar shadow-2xl border-r border-savora-800/40 transition-transform duration-300 md:translate-x-0 ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'} md:flex`}>
        <div className="flex items-center gap-3 mb-6 flex-shrink-0">
          <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center shadow-lg border border-white/10">
            <i className="fa-solid fa-wallet text-xl text-savora-orange"></i>
          </div>
          <div>
            <h1 className="text-xl font-extrabold tracking-tight">Savora AI</h1>
            <p className="text-[10px] text-savora-orange tracking-wider uppercase font-bold">Smart Wallet Advisor</p>
          </div>
          {/* Close button for mobile */}
          <button 
            onClick={() => setIsMobileMenuOpen(false)}
            className="md:hidden ml-auto text-slate-400 hover:text-white"
          >
            <i className="fa-solid fa-xmark text-xl"></i>
          </button>
        </div>

        <nav className="space-y-1 pr-1 pb-4">
          <button onClick={() => handleMenuClick('dashboard')} className={`tab-btn w-full flex items-center gap-3 px-4 py-2.5 rounded-xl transition duration-200 text-[13px] ${activeTab === 'dashboard' ? 'font-bold bg-white/10 text-white' : 'font-medium hover:bg-white/5 text-slate-300'}`}>
            <i className="fa-solid fa-house w-5 text-center text-slate-400"></i> <span>{t('menu.dashboard')}</span>
          </button>
          <button onClick={() => handleMenuClick('transactions')} className={`tab-btn w-full flex items-center gap-3 px-4 py-2.5 rounded-xl transition duration-200 text-[13px] ${activeTab === 'transactions' ? 'font-bold bg-white/10 text-white' : 'font-medium hover:bg-white/5 text-slate-300'}`}>
            <i className="fa-solid fa-list-ul w-5 text-center text-slate-400"></i> <span>{t('menu.transactions')}</span>
          </button>
          <button onClick={() => handleMenuClick('savings')} className={`tab-btn w-full flex items-center gap-3 px-4 py-2.5 rounded-xl transition duration-200 text-[13px] ${activeTab === 'savings' ? 'font-bold bg-white/10 text-white' : 'font-medium hover:bg-white/5 text-slate-300'}`}>
            <i className="fa-solid fa-piggy-bank w-5 text-center text-slate-400"></i> <span>{t('menu.savings')}</span>
          </button>
          <button onClick={() => handleMenuClick('statistics')} className={`tab-btn w-full flex items-center gap-3 px-4 py-2.5 rounded-xl transition duration-200 text-[13px] ${activeTab === 'statistics' ? 'font-bold bg-white/10 text-white' : 'font-medium hover:bg-white/5 text-slate-300'}`}>
            <i className="fa-solid fa-chart-pie w-5 text-center text-slate-400"></i> <span>{t('menu.statistics')}</span>
          </button>
          <button onClick={() => handleMenuClick('debts')} className={`tab-btn w-full flex items-center gap-3 px-4 py-2.5 rounded-xl transition duration-200 text-[13px] ${activeTab === 'debts' ? 'font-bold bg-white/10 text-white' : 'font-medium hover:bg-white/5 text-slate-300'}`}>
            <i className="fa-solid fa-handshake w-5 text-center text-slate-400"></i> <span>{t('menu.debts')}</span>
          </button>
          <button onClick={() => handleMenuClick('calendar')} className={`tab-btn w-full flex items-center gap-3 px-4 py-2.5 rounded-xl transition duration-200 text-[13px] ${activeTab === 'calendar' ? 'font-bold bg-white/10 text-white' : 'font-medium hover:bg-white/5 text-slate-300'}`}>
            <i className="fa-regular fa-calendar w-5 text-center text-slate-400"></i> <span>{t('menu.calendar')}</span>
          </button>
          <button onClick={() => handleMenuClick('categories')} className={`tab-btn w-full flex items-center gap-3 px-4 py-2.5 rounded-xl transition duration-200 text-[13px] ${activeTab === 'categories' ? 'font-bold bg-white/10 text-white' : 'font-medium hover:bg-white/5 text-slate-300'}`}>
            <i className="fa-solid fa-tags w-5 text-center text-slate-400"></i> <span>{t('menu.categories')}</span>
          </button>
          <button onClick={() => handleMenuClick('ai_assistant')} className={`tab-btn w-full flex items-center gap-3 px-4 py-2.5 rounded-xl transition duration-200 text-[13px] ${activeTab === 'ai_assistant' ? 'font-bold bg-white/10 text-white' : 'font-medium hover:bg-white/5 text-slate-300'}`}>
            <i className="fa-solid fa-robot text-savora-orange w-5 text-center"></i> <span>{t('menu.ai')}</span>
          </button>
          <button onClick={() => handleMenuClick('notifications')} className={`tab-btn w-full flex items-center gap-3 px-4 py-2.5 rounded-xl transition duration-200 text-[13px] ${activeTab === 'notifications' ? 'font-bold bg-white/10 text-white' : 'font-medium hover:bg-white/5 text-slate-300'}`}>
            <i className="fa-solid fa-bell w-5 text-center text-slate-400"></i> <span>{t('menu.notifications')}</span>
          </button>
        </nav>

        <div className="space-y-3 pt-3 mt-auto border-t border-savora-800/60 flex-shrink-0">
          <div className="bg-savora-800/40 p-3.5 rounded-xl border border-white/5 text-xs transition-all duration-300">
            <div className="flex items-center gap-2 mb-1">
              <span className="w-2.5 h-2.5 bg-emerald-50 rounded-full flex items-center justify-center shrink-0">
                <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-ping"></span>
              </span>
              <span className="font-semibold text-slate-200">Mode Online</span>
            </div>
            <p className="text-slate-400 text-[11px] leading-tight mt-1">Tersinkronisasi otomatis dengan Cloud Aman.</p>
          </div>

          <div className="space-y-1">
            <button onClick={() => handleMenuClick('settings')} className={`tab-btn w-full flex items-center gap-3 px-4 py-2 rounded-lg text-[13px] transition ${activeTab === 'settings' ? 'bg-white/10 text-white' : 'text-slate-300 hover:bg-white/5'}`}>
              <i className="fa-solid fa-gears w-5 text-center text-slate-400"></i> <span>{t('menu.settings')}</span>
            </button>
            <button onClick={() => handleMenuClick('help')} className={`tab-btn w-full flex items-center gap-3 px-4 py-2 rounded-lg text-[13px] transition ${activeTab === 'help' ? 'bg-white/10 text-white' : 'text-slate-300 hover:bg-white/5'}`}>
              <i className="fa-solid fa-circle-question w-5 text-center text-slate-400"></i> <span>{t('menu.help')}</span>
            </button>
            <button 
              onClick={() => {
                signOut()
                showToast('Anda telah keluar akun.', 'info')
              }}
              className="tab-btn w-full flex items-center gap-3 px-4 py-2 rounded-lg text-[13px] text-rose-400 hover:text-white hover:bg-rose-500/20 transition mt-2"
            >
              <i className="fa-solid fa-right-from-bracket w-5 text-center"></i> <span>{t('menu.logout')}</span>
            </button>
          </div>
        </div>
      </aside>

      {/* CONTENT CONTAINER */}
      <main className="flex-1 p-4 pb-24 md:pb-8 md:p-8 md:pl-72 max-w-7xl w-full">
        
        {/* MOBILE HEADER */}
        <div className="flex md:hidden justify-between items-center mb-6 pb-4 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setIsMobileMenuOpen(true)}
              className="p-2 -ml-2 text-slate-600 hover:bg-slate-100 rounded-lg transition"
            >
              <i className="fa-solid fa-bars text-xl"></i>
            </button>
            <h2 className="text-xl font-extrabold text-slate-800 tracking-tight">
              {activeTab === 'dashboard' && t('header.title.dashboard')}
              {activeTab === 'transactions' && t('header.title.transactions')}
              {activeTab === 'savings' && t('header.title.savings')}
              {activeTab === 'statistics' && t('header.title.statistics')}
              {activeTab === 'debts' && t('header.title.debts')}
              {activeTab === 'calendar' && t('header.title.calendar')}
              {activeTab === 'categories' && t('header.title.categories')}
              {activeTab === 'ai_assistant' && t('header.title.ai')}
              {activeTab === 'settings' && t('header.title.settings')}
              {activeTab === 'notifications' && t('header.title.notifications')}
              {activeTab === 'help' && t('header.title.help')}
            </h2>
          </div>
          
          <div className="flex items-center gap-2">
            <button onClick={() => setIsNotifModalOpen(true)} className="relative p-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg shadow-sm transition">
              <i className="fa-solid fa-bell text-sm"></i>
              {unreadNotifsCount > 0 && (
                <span className="absolute -top-1 -right-1 w-3 h-3 bg-rose-500 border-2 border-slate-50 rounded-full animate-pulse"></span>
              )}
            </button>
          </div>
        </div>

        {/* TOP NOTIFICATION HEADER (Desktop Only) */}
        <div className="hidden md:flex justify-between items-center mb-8 pb-4 border-b border-slate-200">
          <div>
            <h2 className="text-2xl font-extrabold text-slate-800 tracking-tight">
              {activeTab === 'dashboard' && t('header.title.dashboard')}
              {activeTab === 'transactions' && t('header.title.transactions')}
              {activeTab === 'savings' && t('header.title.savings')}
              {activeTab === 'statistics' && t('header.title.statistics')}
              {activeTab === 'debts' && t('header.title.debts')}
              {activeTab === 'calendar' && t('header.title.calendar')}
              {activeTab === 'categories' && t('header.title.categories')}
              {activeTab === 'ai_assistant' && t('header.title.ai')}
              {activeTab === 'settings' && t('header.title.settings')}
              {activeTab === 'notifications' && t('header.title.notifications')}
              {activeTab === 'help' && t('header.title.help')}
            </h2>
            <p className="text-sm text-slate-500">
              {activeTab === 'help' ? t('header.subtitle.help') : t('header.subtitle')}
            </p>
          </div>

          <div className="flex items-center gap-4">
            <button onClick={() => setIsNotifModalOpen(true)} className="relative p-2.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl shadow-sm transition">
              <i className="fa-solid fa-bell text-sm"></i>
              {unreadNotifsCount > 0 && (
                <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-rose-500 border-2 border-slate-50 rounded-full animate-pulse"></span>
              )}
            </button>

            <span className="text-sm bg-slate-100 text-slate-600 px-3 py-1.5 rounded-xl font-medium shadow-sm shrink-0 whitespace-nowrap">
              <i className="fa-solid fa-clock mr-1 text-savora-orange"></i> 
              {currentTime.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
            <button onClick={toggleLanguage} className="flex items-center gap-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs px-3 py-1.5 rounded-xl font-semibold shadow-sm transition">
              <i className="fa-solid fa-globe"></i>
              <span>{t('btn.lang')}</span>
            </button>
            <button onClick={() => setIsModalOpen(true)} className="bg-savora-orange hover:bg-savora-orangeHover text-white text-sm font-semibold px-4 py-2 rounded-xl flex items-center gap-2 shadow-lg shadow-savora-orange/20 active:scale-95 transition">
              <i className="fa-solid fa-circle-plus"></i> <span>{t('btn.add_tx')}</span>
            </button>
          </div>
        </div>

        {activeTab === 'dashboard' && <Dashboard key={refreshTrigger} setActiveTab={setActiveTab} />}
        {activeTab === 'transactions' && <Transactions key={refreshTrigger} />}
        {activeTab === 'savings' && <Savings key={refreshTrigger} />}
        {activeTab === 'statistics' && <Statistics key={refreshTrigger} />}
        {activeTab === 'debts' && <Debts key={refreshTrigger} />}
        {activeTab === 'calendar' && <Calendar key={refreshTrigger} />}
        {activeTab === 'categories' && <Categories key={refreshTrigger} />}
        {activeTab === 'ai_assistant' && <AiAssistant key={refreshTrigger} />}
        {activeTab === 'settings' && <Settings key={refreshTrigger} />}
        {activeTab === 'notifications' && <Notifications key={refreshTrigger} onOpenTransaction={openTransactionWithData} onMarkAsRead={fetchUnreadCount} />}
        {activeTab === 'help' && <Help key={refreshTrigger} setActiveTab={setActiveTab} />}

        <TransactionModal 
          isOpen={isModalOpen} 
          onClose={() => {
            setIsModalOpen(false)
            setTransactionInitialData(null)
          }} 
          onSuccess={() => setRefreshTrigger(prev => prev + 1)} 
          initialData={transactionInitialData}
        />

        <NotificationModal
          isOpen={isNotifModalOpen}
          onClose={() => setIsNotifModalOpen(false)}
          onViewAll={() => {
            setIsNotifModalOpen(false)
            setActiveTab('notifications')
          }}
          onMarkAsRead={fetchUnreadCount}
          onOpenTransaction={openTransactionWithData}
        />
      </main>

      {/* MOBILE BOTTOM NAVIGATION */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 flex justify-around items-center px-2 pb-safe pt-2 shadow-[0_-4px_15px_rgba(0,0,0,0.05)] z-40 h-16">
        <button onClick={() => setActiveTab('dashboard')} className={`flex flex-col items-center justify-center w-16 h-full transition ${activeTab === 'dashboard' ? 'text-savora-orange' : 'text-slate-400 hover:text-slate-600'}`}>
          <i className={`fa-solid fa-house text-xl mb-1 ${activeTab === 'dashboard' ? 'scale-110' : ''}`}></i>
          <span className="text-[10px] font-medium">Beranda</span>
        </button>
        <button onClick={() => setActiveTab('transactions')} className={`flex flex-col items-center justify-center w-16 h-full transition ${activeTab === 'transactions' ? 'text-savora-orange' : 'text-slate-400 hover:text-slate-600'}`}>
          <i className={`fa-solid fa-list-ul text-xl mb-1 ${activeTab === 'transactions' ? 'scale-110' : ''}`}></i>
          <span className="text-[10px] font-medium">Riwayat</span>
        </button>
        
        <div className="relative w-16 h-full flex justify-center">
          <button 
            onClick={() => setIsModalOpen(true)} 
            className="absolute -top-5 w-14 h-14 bg-savora-orange rounded-full text-white shadow-lg shadow-savora-orange/40 flex items-center justify-center text-2xl border-4 border-slate-50 transition active:scale-95"
          >
            <i className="fa-solid fa-plus"></i>
          </button>
        </div>

        <button onClick={() => setActiveTab('ai_assistant')} className={`flex flex-col items-center justify-center w-16 h-full transition ${activeTab === 'ai_assistant' ? 'text-savora-orange' : 'text-slate-400 hover:text-slate-600'}`}>
          <i className={`fa-solid fa-robot text-xl mb-1 ${activeTab === 'ai_assistant' ? 'scale-110' : ''}`}></i>
          <span className="text-[10px] font-medium">AI</span>
        </button>
        <button onClick={() => setActiveTab('settings')} className={`flex flex-col items-center justify-center w-16 h-full transition ${activeTab === 'settings' ? 'text-savora-orange' : 'text-slate-400 hover:text-slate-600'}`}>
          <i className={`fa-solid fa-user text-xl mb-1 ${activeTab === 'settings' ? 'scale-110' : ''}`}></i>
          <span className="text-[10px] font-medium">Profil</span>
        </button>
      </nav>
    </div>
  )
}
