import React, { useState } from 'react'
import { supabase } from '../../supabaseClient'
import { settingsService } from '../../services/settingsService'
import { triggerHaptic } from '../../utils/haptics'
import { useToast } from '../../contexts/ToastContext'
import { useLanguage } from '../../contexts/LanguageContext'

export default function DataManagementModal({ isOpen, onClose, onDataChanged }) {
  const { t } = useLanguage()
  const { showToast } = useToast()
  
  const [restoreJson, setRestoreJson] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)

  if (!isOpen) return null

  const handleArchive = async () => {
    setIsProcessing(true)
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
        setIsProcessing(false)
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
      onDataChanged && onDataChanged()
    } catch (e) {
      showToast(t('settings.archive_fail') + e.message, 'error')
    } finally {
      setIsProcessing(false)
    }
  }

  const handleBackupJSON = async () => {
    setIsProcessing(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      
      const [tx, acc, cat, sav, cal, settingsData] = await Promise.all([
        supabase.from('transactions').select('*').eq('user_id', user.id),
        supabase.from('accounts').select('*').eq('user_id', user.id),
        supabase.from('categories').select('*').eq('user_id', user.id),
        supabase.from('savings').select('*').eq('user_id', user.id),
        supabase.from('calendar_notes').select('*').eq('user_id', user.id),
        settingsService.getSettings()
      ])

      const backupData = {
        transactions: tx.data || [],
        accounts: acc.data || [],
        categories: cat.data || [],
        savings: sav.data || [],
        calendar_notes: cal.data || [],
        settings: settingsData
      }

      const jsonStr = JSON.stringify(backupData, null, 2)
      await navigator.clipboard.writeText(jsonStr)
      showToast(t('settings.backup_success'), 'success')
      triggerHaptic([50, 100, 50])
    } catch (e) {
      showToast(t('settings.backup_fail') + ': ' + e.message, 'error')
    } finally {
      setIsProcessing(false)
    }
  }

  const handleRestoreJSON = async () => {
    if (!restoreJson) return
    setIsProcessing(true)
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
        const { id, user_id, created_at, ...restSettings } = data.settings
        await settingsService.updateSettings(restSettings)
      }

      showToast(t('settings.restore_success'), 'success')
      setRestoreJson('')
      triggerHaptic([50, 100, 50])
      onDataChanged && onDataChanged()
      setTimeout(() => window.location.reload(), 1000)
    } catch (e) {
      showToast(t('settings.restore_fail'), 'error')
    } finally {
      setIsProcessing(false)
    }
  }

  const handleFactoryReset = async () => {
    if (!confirm(t('settings.reset_warn'))) return
    setIsProcessing(true)
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
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-3xl w-full max-w-md shadow-xl flex flex-col max-h-[90vh] animate-slide-up">
        <div className="flex justify-between items-center p-5 border-b border-slate-100 shrink-0">
          <h3 className="font-bold text-slate-800 flex items-center gap-2">
            <i className="fa-solid fa-database text-savora-orange"></i>
            {t('settings.data') || 'Manajemen Data'}
          </h3>
          <button onClick={onClose} disabled={isProcessing} className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 transition">
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>
        
        <div className="p-6 overflow-y-auto space-y-6">
          
          <div className="space-y-3 bg-slate-50 border border-slate-100 rounded-2xl p-4">
            <div>
              <h4 className="font-bold text-sm text-slate-800">{t('settings.arsip')}</h4>
              <p className="text-xs text-slate-400 mt-1">{t('settings.arsip_desc')}</p>
            </div>
            <button onClick={handleArchive} disabled={isProcessing} className="w-full bg-savora-orange text-white text-xs font-bold py-3 rounded-xl hover:bg-orange-600 transition shadow flex items-center justify-center gap-2">
              <i className="fa-solid fa-box-archive"></i> {t('settings.btn_run_archive')}
            </button>
          </div>

          <div className="space-y-3 bg-slate-50 border border-slate-100 rounded-2xl p-4">
            <div>
              <h4 className="font-bold text-sm text-emerald-600">{t('settings.backup_restore') || 'Backup & Restore Data'}</h4>
              <p className="text-xs text-slate-400 mt-1">{t('settings.backup_restore_desc') || 'Salin atau pulihkan data Anda dalam format JSON.'}</p>
            </div>
            <button onClick={handleBackupJSON} disabled={isProcessing} className="w-full bg-emerald-500 text-white text-xs font-bold py-3 rounded-xl hover:bg-emerald-600 transition shadow flex items-center justify-center gap-2">
              <i className="fa-solid fa-copy"></i> {t('settings.btn_backup') || 'Salin Backup ke Clipboard'}
            </button>
            <div className="pt-2">
              <textarea 
                value={restoreJson} 
                onChange={e => setRestoreJson(e.target.value)}
                placeholder={t('settings.restore_ph') || 'Tempel (Paste) JSON backup di sini...'}
                className="w-full h-24 border border-slate-200 rounded-xl p-3 text-xs focus:outline-none focus:border-emerald-500 font-mono bg-white"
              />
              <button 
                onClick={handleRestoreJSON} 
                disabled={!restoreJson || isProcessing}
                className="w-full mt-2 bg-emerald-600 disabled:bg-slate-300 text-white text-xs font-bold py-3 rounded-xl hover:bg-emerald-700 transition shadow flex items-center justify-center gap-2"
              >
                <i className="fa-solid fa-upload"></i> {t('settings.btn_restore') || 'Pulihkan Data'}
              </button>
            </div>
          </div>

          <div className="space-y-3 bg-rose-50 border border-rose-100 rounded-2xl p-4">
            <div>
              <h4 className="font-bold text-sm text-rose-600">{t('settings.reset')}</h4>
              <p className="text-xs text-rose-400/80 mt-1">{t('settings.reset_desc')}</p>
            </div>
            <button onClick={handleFactoryReset} disabled={isProcessing} className="w-full bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold py-3 rounded-xl transition shadow flex items-center justify-center gap-2">
              <i className="fa-solid fa-triangle-exclamation"></i> {t('settings.btn_run_reset')}
            </button>
          </div>
          
        </div>
      </div>
    </div>
  )
}
