import React, { useState, useEffect } from 'react'
import { settingsService } from '../services/settingsService'
import { accountService } from '../services/accountService'
import { transactionService } from '../services/transactionService'
import { supabase } from '../supabaseClient'
import { useLanguage } from '../contexts/LanguageContext'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import { triggerHaptic } from '../utils/haptics'

// Modals
import AddAccountModal from './modals/AddAccountModal'
import EditAccountModal from './modals/EditAccountModal'
import ConnectBankModal from './modals/ConnectBankModal'
import EditProfileModal from './modals/EditProfileModal'
import FinanceConfigModal from './modals/FinanceConfigModal'
import SecurityModal from './modals/SecurityModal'
import DataManagementModal from './modals/DataManagementModal'
import AboutModal from './modals/AboutModal'
import TelegramModal from './modals/TelegramModal'

export default function Settings() {
  const { t } = useLanguage()
  const { showToast } = useToast()
  const { user } = useAuth()
  
  const [settings, setSettings] = useState({})
  const [accounts, setAccounts] = useState([])
  const [displayName, setDisplayName] = useState(user?.user_metadata?.display_name || '')
  const [avatarUrl, setAvatarUrl] = useState(user?.user_metadata?.avatar_url || '')
  const [email, setEmail] = useState(user?.email || '')
  const [summary, setSummary] = useState({ transactions: 0, income: 0, expense: 0 })

  // Modal States
  const [activeModal, setActiveModal] = useState(null) // 'profile', 'finance', 'security', 'data', 'about'
  const [isAddAccountOpen, setIsAddAccountOpen] = useState(false)
  const [editAccountTarget, setEditAccountTarget] = useState(null)
  const [showConnectModal, setShowConnectModal] = useState(false)

  const loadData = async () => {
    const s = await settingsService.getSettings()
    const accs = await accountService.getAccounts()
    if (s) setSettings(s)
    if (accs) setAccounts(accs)
    
    if (user) {
      setDisplayName(user.user_metadata?.display_name || '')
      setAvatarUrl(user.user_metadata?.avatar_url || '')
      setEmail(user.email || '')
      
      try {
        const summaryData = await transactionService.getTransactionSummary()
        const { count } = await supabase.from('transactions').select('*', { count: 'exact', head: true }).eq('user_id', user.id)
        setSummary({
          transactions: count || 0,
          income: summaryData.pemasukan || 0,
          expense: summaryData.pengeluaran || 0
        })
      } catch (e) { console.error(e) }
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const handleDeleteAccount = async (id) => {
    if (!confirm(t('settings.del_confirm'))) return
    try {
      await accountService.deleteAccount(id)
      showToast(t('settings.del_success'), 'success')
      loadData()
    } catch (e) {
      showToast(t('settings.del_fail') + e.message, 'error')
    }
  }

  const handleUpdateConnectedBanks = (bankName) => {
    const newBanks = [...(settings.connected_banks || []), bankName]
    setSettings(prev => ({ ...prev, connected_banks: newBanks }))
    settingsService.updateSettings({ connected_banks: newBanks })
  }

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: settings.currency || 'IDR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount)
  }

  const formatCompactNumber = (number) => {
    if (number >= 1e9) return (number / 1e9).toFixed(1) + 'M'
    if (number >= 1e6) return (number / 1e6).toFixed(1) + 'Jt'
    if (number >= 1e3) return (number / 1e3).toFixed(1) + 'K'
    return number.toString()
  }

  const MenuItem = ({ icon, label, colorClass, onClick }) => (
    <button onClick={onClick} className="w-full flex items-center justify-between p-4 bg-white hover:bg-slate-50 transition border-b border-slate-100 last:border-0 group">
      <div className="flex items-center gap-4">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-sm ${colorClass}`}>
          <i className={`${icon.includes('fa-') && icon.includes(' ') ? icon : 'fa-solid ' + icon} text-lg`}></i>
        </div>
        <span className="font-bold text-slate-700 group-hover:text-savora-800 transition">{label}</span>
      </div>
      <i className="fa-solid fa-chevron-right text-slate-300 group-hover:text-savora-800 transition text-sm"></i>
    </button>
  )

  return (
    <section className="space-y-6 animate-fade-in pb-12 max-w-lg mx-auto">
      
      {/* Profile Header */}
      <div className="bg-white rounded-[2rem] p-6 shadow-sm border border-emerald-100 flex flex-col items-center text-center mt-2 relative overflow-hidden">
        <div className="absolute top-0 inset-x-0 h-24 bg-gradient-to-b from-emerald-50 to-transparent pointer-events-none"></div>
        <div 
          className="relative w-24 h-24 rounded-full bg-gradient-to-tr from-savora-800 to-emerald-500 p-1 shadow-xl shadow-emerald-500/20 mb-4 z-10 cursor-pointer group"
          onClick={() => { triggerHaptic([30]); setActiveModal('profile') }}
        >
          {avatarUrl ? (
            <img src={avatarUrl} alt="Avatar" className="w-full h-full rounded-full object-cover border-2 border-white bg-white group-hover:opacity-80 transition" />
          ) : (
            <div className="w-full h-full rounded-full bg-white flex items-center justify-center text-3xl font-bold text-savora-800 border-2 border-white group-hover:bg-slate-50 transition">
              {displayName ? displayName.charAt(0).toUpperCase() : 'U'}
            </div>
          )}
          <div className="absolute bottom-0 right-0 bg-emerald-500 text-white w-7 h-7 rounded-full flex items-center justify-center shadow-md border-2 border-white z-20 transition group-hover:scale-110 group-active:scale-95">
            <i className="fa-solid fa-camera text-[11px]"></i>
          </div>
        </div>
        <h2 className="text-xl font-extrabold text-slate-800 z-10">{displayName || 'Pengguna'}</h2>
        <p className="text-sm text-slate-500 mt-1 z-10">{email}</p>
        
        <div className="mt-4 bg-emerald-50 text-emerald-600 px-4 py-1.5 rounded-full text-xs font-bold border border-emerald-100/50 flex items-center gap-1.5 z-10">
          <i className="fa-brands fa-google text-[10px]"></i> Akun Google
        </div>
      </div>

      {/* Summary Stats */}
      <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-100 flex justify-between">
        <div className="flex flex-col items-center flex-1">
          <i className="fa-solid fa-receipt text-emerald-500 mb-2 text-lg"></i>
          <span className="font-extrabold text-slate-800">{summary.transactions}</span>
          <span className="text-[10px] text-slate-400 font-semibold uppercase mt-0.5">Transaksi</span>
        </div>
        <div className="w-px bg-slate-100 my-1"></div>
        <div className="flex flex-col items-center flex-1">
          <i className="fa-solid fa-arrow-trend-up text-emerald-500 mb-2 text-lg"></i>
          <span className="font-extrabold text-slate-800">{settings.currency === 'USD' ? '$' : 'Rp'}{formatCompactNumber(summary.income)}</span>
          <span className="text-[10px] text-slate-400 font-semibold uppercase mt-0.5">Pemasukan</span>
        </div>
        <div className="w-px bg-slate-100 my-1"></div>
        <div className="flex flex-col items-center flex-1">
          <i className="fa-solid fa-arrow-trend-down text-rose-500 mb-2 text-lg"></i>
          <span className="font-extrabold text-slate-800">{settings.currency === 'USD' ? '$' : 'Rp'}{formatCompactNumber(summary.expense)}</span>
          <span className="text-[10px] text-slate-400 font-semibold uppercase mt-0.5">Pengeluaran</span>
        </div>
      </div>

      {/* Settings Menu List */}
      <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden flex flex-col">
        <MenuItem 
          icon="fa-user" 
          label={t('settings.profile') || 'Edit Profil'} 
          colorClass="bg-emerald-50 text-emerald-600" 
          onClick={() => { triggerHaptic([30]); setActiveModal('profile') }} 
        />
        <MenuItem 
          icon="fa-coins" 
          label={t('settings.lbl_fin_config') || 'Keuangan & Cloud'} 
          colorClass="bg-sky-50 text-sky-600" 
          onClick={() => { triggerHaptic([30]); setActiveModal('finance') }} 
        />
        <MenuItem 
          icon="fa-shield-halved" 
          label={t('settings.lbl_security') || 'Keamanan'} 
          colorClass="bg-indigo-50 text-indigo-500" 
          onClick={() => { triggerHaptic([30]); setActiveModal('security') }} 
        />
        <MenuItem 
          icon="fa-database" 
          label={t('settings.data') || 'Manajemen Data'} 
          colorClass="bg-orange-50 text-orange-500" 
          onClick={() => { triggerHaptic([30]); setActiveModal('data') }} 
        />
        <MenuItem 
          icon="fa-circle-info" 
          label={t('settings.about_savora') || 'Tentang Savora'} 
          colorClass="bg-slate-50 text-slate-500" 
          onClick={() => { triggerHaptic([30]); setActiveModal('about') }} 
        />
        <MenuItem 
          icon="fa-brands fa-telegram" 
          label="Integrasi Telegram Bot" 
          colorClass="bg-blue-50 text-blue-500" 
          onClick={() => { triggerHaptic([30]); setActiveModal('telegram') }} 
        />
      </div>

      {/* Logic Modals */}
      <EditProfileModal 
        isOpen={activeModal === 'profile'} 
        onClose={() => setActiveModal(null)} 
        initialName={displayName}
        initialAvatar={avatarUrl}
        onSuccess={(name, avatar) => {
          setDisplayName(name)
          setAvatarUrl(avatar)
          setActiveModal(null)
        }}
      />
      
      <FinanceConfigModal 
        isOpen={activeModal === 'finance'} 
        onClose={() => setActiveModal(null)}
        initialSettings={settings}
        accounts={accounts}
        onSettingsChange={(newSettings) => { setSettings(newSettings); loadData() }}
        onOpenAddAccount={() => setIsAddAccountOpen(true)}
        onOpenEditAccount={(acc) => setEditAccountTarget(acc)}
        onDeleteAccount={handleDeleteAccount}
        onOpenConnectBank={() => setShowConnectModal(true)}
      />

      <SecurityModal
        isOpen={activeModal === 'security'}
        onClose={() => setActiveModal(null)}
        initialSettings={settings}
        onSettingsChange={(newSettings) => setSettings(newSettings)}
      />

      <DataManagementModal
        isOpen={activeModal === 'data'}
        onClose={() => setActiveModal(null)}
        onDataChanged={loadData}
      />

      <AboutModal
        isOpen={activeModal === 'about'}
        onClose={() => setActiveModal(null)}
      />

      <TelegramModal
        isOpen={activeModal === 'telegram'}
        onClose={() => setActiveModal(null)}
        initialSettings={settings}
        onSettingsChange={(newSettings) => setSettings({ ...settings, ...newSettings })}
      />

      {/* Reused Original Modals */}
      <AddAccountModal 
        isOpen={isAddAccountOpen} 
        onClose={() => setIsAddAccountOpen(false)} 
        onSuccess={loadData} 
      />
      <EditAccountModal
        isOpen={!!editAccountTarget}
        account={editAccountTarget}
        onClose={() => setEditAccountTarget(null)}
        onSuccess={loadData}
      />
      <ConnectBankModal
        isOpen={showConnectModal}
        onClose={() => setShowConnectModal(false)}
        onSuccess={(bankName) => {
          handleUpdateConnectedBanks(bankName)
          setShowConnectModal(false)
        }}
      />

    </section>
  )
}
