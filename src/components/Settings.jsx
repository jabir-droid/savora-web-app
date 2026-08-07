import React, { useState, useEffect } from 'react'
import { settingsService } from '../services/settingsService'
import { accountService } from '../services/accountService'
import { supabase } from '../supabaseClient'
import { useLanguage } from '../contexts/LanguageContext'
import AddAccountModal from './modals/AddAccountModal'
import EditAccountModal from './modals/EditAccountModal'
import ConnectBankModal from './modals/ConnectBankModal'
import { useToast } from '../contexts/ToastContext'
import { triggerHaptic } from '../utils/haptics'

export default function Settings() {
  const { t } = useLanguage()
  const { showToast } = useToast()
  const [settings, setSettings] = useState({
    default_account: '',
    currency: 'IDR',
    is_pin_enabled: false,
    haptic_enabled: false,
    groq_api_key: '',
    connected_banks: []
  })
  const [accounts, setAccounts] = useState([])
  const [newPin, setNewPin] = useState('')
  const [newGroqKey, setNewGroqKey] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [restoreJson, setRestoreJson] = useState('')
  const [isAddAccountOpen, setIsAddAccountOpen] = useState(false)
  const [editAccountTarget, setEditAccountTarget] = useState(null)
  const [showConnectModal, setShowConnectModal] = useState(false)
  
  const connectedBanks = settings.connected_banks || []

  const loadData = async () => {
    const s = await settingsService.getSettings()
    const accs = await accountService.getAccounts()
    if (s) {
      setSettings(s)
      setNewGroqKey(s.groq_api_key || '')
    }
    if (accs) setAccounts(accs)
    
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      setDisplayName(user.user_metadata?.display_name || '')
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

  const handleUpdate = async (key, value) => {
    const updated = { ...settings, [key]: value }
    setSettings(updated)
    try {
      await settingsService.updateSettings({ [key]: value })
      if (key === 'haptic_enabled' && value) {
        // Test haptic immediately if turned on
        if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate([50, 100, 50])
      } else {
        triggerHaptic([30])
      }
    } catch (e) {
      showToast(t('settings.up_fail') + e.message, 'error')
    }
  }

  const handleSavePin = async () => {
    if (newPin.length !== 4) return showToast(t('settings.pin_err'), 'error')
    try {
      await settingsService.updateSettings({ pin_code: newPin, is_pin_enabled: true })
      setSettings(prev => ({ ...prev, is_pin_enabled: true }))
      setNewPin('')
      triggerHaptic([50])
      showToast(t('settings.pin_success'), 'success')
    } catch (e) {
      showToast(t('settings.pin_fail') + e.message, 'error')
    }
  }

  const handleSaveGroqKey = async () => {
    try {
      await settingsService.updateSettings({ groq_api_key: newGroqKey })
      setSettings(prev => ({ ...prev, groq_api_key: newGroqKey }))
      triggerHaptic([50])
      showToast(t('settings.groq_success'), 'success')
    } catch (e) {
      showToast(t('settings.groq_fail') + e.message, 'error')
    }
  }

  const handleFactoryReset = async () => {
    if (!confirm(t('settings.reset_warn'))) return
    
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if(user) {
        await supabase.from('transactions').delete().eq('user_id', user.id)
        await supabase.from('savings').delete().eq('user_id', user.id)
        await supabase.from('categories').delete().eq('user_id', user.id)
        await supabase.from('accounts').delete().eq('user_id', user.id)
        await supabase.from('calendar_notes').delete().eq('user_id', user.id)
        
        localStorage.clear()
        
        showToast(t('settings.reset_success'), 'success')
        window.location.reload()
      }
    } catch (e) {
      showToast(t('settings.reset_fail') + e.message, 'error')
    }
  }

  const handleArchive = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if(!user) return

      const date30DaysAgo = new Date()
      date30DaysAgo.setDate(date30DaysAgo.getDate() - 30)
      const isoDateString = date30DaysAgo.toISOString()

      const { data: oldTx, error: fetchErr } = await supabase
        .from('transactions')
        .select('*')
        .lt('created_at', isoDateString)

      if (fetchErr) throw fetchErr

      if (!oldTx || oldTx.length === 0) {
        showToast(t('settings.archive_empty'), 'info')
        return
      }

      const header = [t('tx.col_date'), t('tx.col_type'), t('tx.col_category'), t('tx.col_amount'), t('tx.account'), t('tx.col_desc')]
      const rows = oldTx.map(tx => [
        new Date(tx.created_at).toLocaleString(),
        tx.tipe === 'Pemasukan' ? t('tx.type_income') : tx.tipe === 'Pengeluaran' ? t('tx.type_expense') : tx.tipe === 'Transfer' ? t('tx.type_transfer') : tx.tipe,
        tx.kategori,
        tx.jumlah,
        tx.akun,
        tx.deskripsi || ''
      ])
      
      const csvContent = [
        header.join(","),
        ...rows.map(r => r.map(cell => `"${cell}"`).join(","))
      ].join("\n")

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.setAttribute("href", url)
      link.setAttribute("download", `savora_arsip_transaksi_${new Date().getTime()}.csv`)
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)

      const idsToDelete = oldTx.map(tx => tx.id)
      const { error: delErr } = await supabase
        .from('transactions')
        .delete()
        .in('id', idsToDelete)

      if (delErr) throw delErr

      showToast(t('settings.archive_success'), 'success')
      
    } catch (e) {
      showToast(t('settings.archive_fail') + e.message, 'error')
    }
  }

  const handleSaveProfile = async () => {
    try {
      const { error } = await supabase.auth.updateUser({
        data: { display_name: displayName }
      })
      if (error) throw error
      showToast(t('settings.profile_save_success'), 'success')
      triggerHaptic([50])
    } catch (e) {
      showToast(e.message, 'error')
    }
  }

  const handleBackupJSON = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      
      const [tx, acc, cat, sav, cal] = await Promise.all([
        supabase.from('transactions').select('*').eq('user_id', user.id),
        supabase.from('accounts').select('*').eq('user_id', user.id),
        supabase.from('categories').select('*').eq('user_id', user.id),
        supabase.from('savings').select('*').eq('user_id', user.id),
        supabase.from('calendar_notes').select('*').eq('user_id', user.id)
      ])

      const backupData = {
        transactions: tx.data || [],
        accounts: acc.data || [],
        categories: cat.data || [],
        savings: sav.data || [],
        calendar_notes: cal.data || [],
        settings: settings
      }

      const jsonStr = JSON.stringify(backupData, null, 2)
      await navigator.clipboard.writeText(jsonStr)
      showToast(t('settings.backup_success'), 'success')
      triggerHaptic([50, 100, 50])
    } catch (e) {
      showToast(t('settings.backup_fail') + ': ' + e.message, 'error')
    }
  }

  const handleRestoreJSON = async () => {
    if (!restoreJson) return
    try {
      const data = JSON.parse(restoreJson)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      
      const insertData = async (table, items) => {
        if (!items || items.length === 0) return
        const cleanItems = items.map(item => {
           const { id, user_id, created_at, updated_at, ...rest } = item
           return { ...rest, user_id: user.id }
        })
        await supabase.from(table).insert(cleanItems)
      }

      await insertData('accounts', data.accounts)
      await insertData('categories', data.categories)
      await insertData('savings', data.savings)
      await insertData('transactions', data.transactions)
      await insertData('calendar_notes', data.calendar_notes)

      if (data.settings) {
        // preserve current user settings except data
        const { id, user_id, created_at, ...restSettings } = data.settings
        await settingsService.updateSettings(restSettings)
      }

      showToast(t('settings.restore_success'), 'success')
      setRestoreJson('')
      loadData()
      triggerHaptic([50, 100, 50])
    } catch (e) {
      showToast(t('settings.restore_fail'), 'error')
    }
  }

  return (
    <section className="space-y-6 animate-fade-in">
      <div className="mb-4">
        <h3 className="font-bold text-lg text-slate-800 mb-1">{t('settings.title')}</h3>
        <p className="text-xs text-slate-400">{t('settings.desc')}</p>
      </div>

      {/* Profil Pengguna */}
      <div className="bg-white rounded-3xl p-6 shadow-sm border border-emerald-100 space-y-4">
        <h3 className="text-xs font-bold text-emerald-600 uppercase tracking-wider mb-2 flex items-center gap-1.5 border-b border-slate-100 pb-2">
          <i className="fa-solid fa-user"></i> {t('settings.profile') || 'Profil Pengguna'}
        </h3>
        <div className="flex flex-col gap-4 max-w-md">
          <p className="text-xs text-slate-500">{t('settings.profile_desc') || 'Ubah nama tampilan Anda di aplikasi.'}</p>
          <div className="flex flex-col gap-2">
            <label className="text-xs font-bold text-slate-600">{t('settings.profile_name_label') || 'Nama Tampilan'}</label>
            <div className="flex gap-2">
              <input 
                type="text" 
                value={displayName} 
                onChange={e => setDisplayName(e.target.value)}
                placeholder="Nama Anda"
                className="flex-1 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-emerald-500"
              />
              <button 
                onClick={handleSaveProfile} 
                className="bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold px-4 py-2 rounded-xl transition shadow"
              >
                {t('settings.profile_save') || 'Simpan'}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200/60 space-y-4">
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5 border-b border-slate-100 pb-2">
          <i className="fa-solid fa-server"></i> {t('settings.cloud')}
        </h3>
        
        <div className="flex flex-col py-2 gap-4">
          <div className="flex items-center justify-between gap-4">
            <div className="max-w-md">
              <h4 className="font-bold text-sm text-slate-800 flex items-center gap-2">{t('settings.uji')}</h4>
              <p className="text-xs text-slate-400 mt-1">{t('settings.uji_desc')}</p>
            </div>
            <div className="flex items-center gap-3 shrink-0 self-center">
              <button onClick={() => setShowConnectModal(true)} className="bg-savora-800 text-white text-xs font-semibold px-4 py-2.5 rounded-xl hover:bg-savora-900 transition cursor-pointer flex items-center gap-2">
                <i className="fa-solid fa-link"></i> {t('settings.btn_connect_bank')}
              </button>
            </div>
          </div>
          
          {connectedBanks.length > 0 && (
            <div className="flex gap-3 overflow-x-auto pb-2">
              {connectedBanks.map((bank, idx) => (
                <div key={idx} className="bg-slate-50 border border-emerald-200 shadow-sm rounded-lg px-3 py-2 flex items-center gap-2 shrink-0">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                  <span className="text-xs font-bold text-slate-700">{bank} {t('settings.lbl_connected')}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200/60 space-y-4">
        <h3 className="text-xs font-bold text-savora-orange uppercase tracking-wider mb-2 flex items-center gap-1.5 border-b border-slate-100 pb-2">
          <i className="fa-solid fa-database"></i> {t('settings.data')}
        </h3>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between py-2 border-b border-slate-100/50 gap-4">
          <div className="max-w-md">
            <h4 className="font-bold text-sm text-slate-800 flex items-center gap-2">{t('settings.arsip')}</h4>
            <p className="text-xs text-slate-400 mt-1">{t('settings.arsip_desc')}</p>
          </div>
          <div className="flex items-center gap-3 shrink-0 self-end sm:self-center">
            <button onClick={handleArchive} className="bg-savora-orange text-white text-xs font-semibold px-4 py-2.5 rounded-xl hover:bg-orange-600 transition shadow hover:shadow-md cursor-pointer">
              <i className="fa-solid fa-box-archive mr-1.5"></i> {t('settings.btn_run_archive')}
            </button>
          </div>
        </div>

        <div className="flex flex-col py-2 border-b border-slate-100/50 gap-4">
          <div className="max-w-md">
            <h4 className="font-bold text-sm text-emerald-600 flex items-center gap-2">{t('settings.backup_restore') || 'Backup & Restore Data'}</h4>
            <p className="text-xs text-slate-400 mt-1">{t('settings.backup_restore_desc') || 'Salin atau pulihkan data Anda dalam format JSON. Berbeda dengan arsip, data Anda tidak akan dihapus.'}</p>
          </div>
          <div className="flex flex-col gap-3">
            <button onClick={handleBackupJSON} className="self-start bg-emerald-500 text-white text-xs font-semibold px-4 py-2.5 rounded-xl hover:bg-emerald-600 transition shadow hover:shadow-md cursor-pointer">
              <i className="fa-solid fa-copy mr-1.5"></i> {t('settings.btn_backup') || 'Salin Backup ke Clipboard'}
            </button>
            <div className="flex flex-col gap-2 mt-2">
              <textarea 
                value={restoreJson} 
                onChange={e => setRestoreJson(e.target.value)}
                placeholder={t('settings.restore_ph') || 'Tempel (Paste) JSON backup Anda di sini...'}
                className="w-full h-24 border border-slate-200 rounded-xl p-3 text-xs focus:outline-none focus:border-emerald-500 font-mono bg-slate-50"
              />
              <button 
                onClick={handleRestoreJSON} 
                disabled={!restoreJson}
                className="self-start bg-emerald-600 disabled:bg-slate-300 text-white text-xs font-semibold px-4 py-2.5 rounded-xl hover:bg-emerald-700 transition shadow cursor-pointer"
              >
                <i className="fa-solid fa-upload mr-1.5"></i> {t('settings.btn_restore') || 'Pulihkan Data'}
              </button>
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between py-2 gap-4">
          <div className="max-w-md">
            <h4 className="font-bold text-sm text-rose-600 flex items-center gap-2">{t('settings.reset')}</h4>
            <p className="text-xs text-slate-400 mt-1">{t('settings.reset_desc')}</p>
          </div>
          <div className="shrink-0 self-end sm:self-center">
            <button onClick={handleFactoryReset} className="bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold px-4 py-2.5 rounded-xl transition shadow hover:shadow-md">
              {t('settings.btn_run_reset')}
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200/60 space-y-4">
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5 border-b border-slate-100 pb-2">
          <i className="fa-solid fa-coins"></i> {t('settings.lbl_fin_config')}
        </h3>

        <div className="flex items-center justify-between py-2 border-b border-slate-100/50 gap-4">
          <div className="max-w-md">
            <h4 className="font-bold text-sm text-slate-800">{t('settings.lbl_def_acc')}</h4>
            <p className="text-xs text-slate-400 mt-1">{t('settings.desc_def_acc')}</p>
          </div>
          <select value={settings.default_account} onChange={e => handleUpdate('default_account', e.target.value)}
            className="border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-savora-800 bg-white min-w-[120px]">
            <option value="">{t('settings.select')}</option>
            {accounts.map(a => <option key={a.id} value={a.namaakun}>{a.namaakun}</option>)}
          </select>
        </div>

        <div className="flex flex-col border-b border-slate-100/50 pb-4">
          <div className="flex items-center justify-between py-2">
            <div className="max-w-md">
              <h4 className="font-bold text-sm text-slate-800">{t('settings.lbl_acc_list')}</h4>
              <p className="text-xs text-slate-400 mt-1">{t('settings.desc_acc_list')}</p>
            </div>
            <button onClick={() => setIsAddAccountOpen(true)} className="bg-savora-100 hover:bg-savora-200 text-savora-800 text-xs font-bold px-4 py-2 rounded-xl transition flex items-center gap-1.5 shrink-0">
              <i className="fa-solid fa-plus"></i> {t('settings.btn_add_acc')}
            </button>
          </div>
          
          <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {accounts.map(acc => (
              <div key={acc.id} className="border border-slate-200 rounded-xl p-3 flex justify-between items-center bg-slate-50">
                <div>
                  <p className="text-sm font-bold text-slate-800">{acc.namaakun}</p>
                  <p className="text-[10px] font-bold text-slate-400 uppercase mt-0.5">{acc.tipe}</p>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => setEditAccountTarget(acc)} className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:bg-slate-200 transition" title={t('settings.edit_wallet')}>
                    <i className="fa-solid fa-pen text-xs"></i>
                  </button>
                  <button onClick={() => handleDeleteAccount(acc.id)} className="w-8 h-8 flex items-center justify-center rounded-lg text-rose-400 hover:bg-rose-100 transition" title={t('settings.del_wallet')}>
                    <i className="fa-solid fa-trash-can text-xs"></i>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between py-2 gap-4">
          <div className="max-w-md">
            <h4 className="font-bold text-sm text-slate-800">{t('settings.lbl_currency')}</h4>
            <p className="text-xs text-slate-400 mt-1">{t('settings.desc_currency')}</p>
          </div>
          <select value={settings.currency} onChange={e => handleUpdate('currency', e.target.value)}
            className="border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-savora-800 bg-white min-w-[120px]">
            <option value="IDR">Rupiah (Rp)</option>
            <option value="USD">Dollar ($)</option>
          </select>
        </div>
      </div>

      <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200/60 space-y-4">
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5 border-b border-slate-100 pb-2">
          <i className="fa-solid fa-shield-halved"></i> {t('settings.lbl_security')}
        </h3>

        <div className="flex items-center justify-between py-2 border-b border-slate-100/50 gap-4">
          <div className="max-w-md">
            <h4 className="font-bold text-sm text-slate-800">{t('settings.lbl_pin_lock')}</h4>
            <p className="text-xs text-slate-400 mt-1">{t('settings.desc_pin_lock')}</p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer shrink-0">
            <input type="checkbox" className="sr-only peer" checked={settings.is_pin_enabled} onChange={e => handleUpdate('is_pin_enabled', e.target.checked)} />
            <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-savora-800"></div>
          </label>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between py-2 border-b border-slate-100/50 gap-4">
          <div className="max-w-md">
            <h4 className="font-bold text-sm text-slate-800">{t('settings.lbl_change_pin')}</h4>
            <p className="text-xs text-slate-400 mt-1">{t('settings.desc_change_pin')}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
            <input type="password" value={newPin} onChange={e => setNewPin(e.target.value)} maxLength="4" placeholder="PIN (4 digit)"
              className="border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-savora-800 w-36" />
            <button onClick={handleSavePin} className="bg-savora-800 hover:bg-savora-900 text-white text-xs font-semibold px-4 py-2 rounded-xl transition shadow">{t('settings.btn_save')}</button>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between py-2 border-b border-slate-100/50 gap-4">
          <div className="max-w-md">
            <h4 className="font-bold text-sm text-slate-800 flex items-center gap-2">
              <i className="fa-solid fa-brain text-savora-orange"></i> {t('settings.lbl_ai_integ')}
            </h4>
            <p className="text-xs text-slate-400 mt-1">{t('settings.desc_ai_integ')}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
            <input type="password" value={newGroqKey} onChange={e => setNewGroqKey(e.target.value)} placeholder="gsk_..."
              className="border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-savora-800 w-48" />
            <button onClick={handleSaveGroqKey} className="bg-savora-800 hover:bg-savora-900 text-white text-xs font-semibold px-4 py-2 rounded-xl transition shadow">{t('settings.btn_save')}</button>
          </div>
        </div>

        <div className="flex items-center justify-between py-2 gap-4">
          <div className="max-w-md">
            <h4 className="font-bold text-sm text-slate-800">{t('settings.lbl_haptic')}</h4>
            <p className="text-xs text-slate-400 mt-1">{t('settings.desc_haptic')}</p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer shrink-0">
            <input type="checkbox" className="sr-only peer" checked={settings.haptic_enabled} onChange={e => handleUpdate('haptic_enabled', e.target.checked)} />
            <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-savora-800"></div>
          </label>
        </div>
      </div>
      
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
          const newBanks = [...connectedBanks, bankName]
          handleUpdate('connected_banks', newBanks)
          setShowConnectModal(false)
        }}
      />
      
      {/* TENTANG SAVORA AI */}
      <div className="mt-8 mb-4 bg-white rounded-3xl p-6 shadow-sm border border-savora-100 flex flex-col items-center justify-center text-center">
        <div className="w-12 h-12 bg-savora-800 rounded-2xl flex items-center justify-center text-savora-orange shadow-lg shadow-savora-800/20 mb-4">
          <i className="fa-solid fa-robot text-2xl"></i>
        </div>
        <h2 className="text-xl font-extrabold text-slate-800 tracking-tight">Savora AI</h2>
        <p className="text-xs text-slate-500 mt-2 max-w-xs leading-relaxed">
          {t('settings.about_desc') || 'Aplikasi pencatatan keuangan cerdas dengan integrasi AI (LLaMA 3) untuk analisis dan kemudahan Anda.'}
        </p>
        
        <div className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 mt-6 text-left space-y-3">
          <div className="flex justify-between items-center border-b border-slate-200/60 pb-2">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Versi</span>
            <span className="text-xs font-bold text-slate-700">{t('settings.about_version') || '1.0.0 (AI Edition)'}</span>
          </div>
          <div className="flex justify-between items-center border-b border-slate-200/60 pb-2">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Developer</span>
            <span className="text-xs font-bold text-slate-700">{t('settings.about_dev') || 'Dikembangkan oleh Anda'}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Mesin AI</span>
            <span className="text-xs font-bold text-savora-orange bg-savora-orange/10 px-2 py-0.5 rounded-md">LLaMA 3 (Groq API)</span>
          </div>
        </div>
      </div>
    </section>
  )
}
