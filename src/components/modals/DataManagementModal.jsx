import React, { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { supabase } from '../../supabaseClient'
import { settingsService } from '../../services/settingsService'
import { triggerHaptic } from '../../utils/haptics'
import { useToast } from '../../contexts/ToastContext'
import { useLanguage } from '../../contexts/LanguageContext'
import { downloadCsv } from '../../utils/csv'
import { activityService } from '../../services/activityService'
import { backupService } from '../../services/backupService'
import { reportService, REPORT_PERIODS } from '../../services/reportService'
import ConfirmModal from './ConfirmModal'

export default function DataManagementModal({ isOpen, onClose, onDataChanged }) {
  const { t } = useLanguage()
  const { showToast } = useToast()
  
  const [restoreJson, setRestoreJson] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)

  // Penjaga Factory Reset berlapis (Fase 3 Paket 2): panel peringatan
  // khusus + kewajiban mengetik kata konfirmasi sebelum eksekusi aktif.
  const [showResetGuard, setShowResetGuard] = useState(false)
  const [resetConfirmText, setResetConfirmText] = useState('')
  const resetTyped = resetConfirmText.trim()
  const resetArmed = resetTyped === 'HAPUS' || resetTyped === 'DELETE'

  const handleClose = () => {
    setShowResetGuard(false)
    setResetConfirmText('')
    onClose()
  }

  // Cadangan otomatis (Paket Perlindungan)
  const [snapshots, setSnapshots] = useState([])
  const [isBackingUp, setIsBackingUp] = useState(false)
  const [confirmRestoreSnap, setConfirmRestoreSnap] = useState(null)

  const refreshSnapshots = async () => {
    try { setSnapshots(await backupService.listSnapshots()) } catch { /* abaikan */ }
  }

  useEffect(() => {
    if (!isOpen) return
    let cancelled = false
    backupService.listSnapshots()
      .then(rows => { if (!cancelled) setSnapshots(rows) })
      .catch(() => { if (!cancelled) setSnapshots([]) })
    return () => { cancelled = true }
  }, [isOpen])

  // Laporan berkala (Program Penyempurnaan)
  const [reportPeriod, setReportPeriod] = useState('off')
  const [reports, setReports] = useState([])
  const [isGeneratingReport, setIsGeneratingReport] = useState(false)

  const refreshReports = async () => {
    try { setReports(await reportService.listReports()) } catch { /* abaikan */ }
  }

  useEffect(() => {
    if (!isOpen) return
    let cancelled = false
    settingsService.getSettings()
      .then(s => { if (!cancelled && s) setReportPeriod(s.laporan_periode || 'off') })
      .catch(() => {})
    reportService.listReports()
      .then(rows => { if (!cancelled) setReports(rows) })
      .catch(() => { if (!cancelled) setReports([]) })
    return () => { cancelled = true }
  }, [isOpen])

  const reportDays = () => (reportPeriod === 'bulanan' ? REPORT_PERIODS.bulanan : REPORT_PERIODS.mingguan)

  const handleReportPeriodChange = async (e) => {
    const value = e.target.value
    setReportPeriod(value)
    try {
      // Garis awal di-reset: jadwal dihitung sejak pengaturan diubah.
      await settingsService.updateSettings({
        laporan_periode: value === 'off' ? null : value,
        laporan_terakhir: new Date().toISOString()
      })
      showToast(t('settings.report_saved'), 'success')
    } catch (err) {
      showToast(t('settings.report_fail') + err.message, 'error')
    }
  }

  const handleGenerateReport = async () => {
    setIsGeneratingReport(true)
    try {
      await reportService.generateReport(reportDays())
      activityService.logEvent('laporan_dibuat')
      await settingsService.updateSettings({ laporan_terakhir: new Date().toISOString() }).catch(() => {})
      await refreshReports()
      showToast(t('settings.report_generated'), 'success')
    } catch (err) {
      showToast(t('settings.report_fail') + err.message, 'error')
    } finally {
      setIsGeneratingReport(false)
    }
  }

  const handlePrintReport = async () => {
    setIsGeneratingReport(true)
    try {
      await reportService.openPrintReport(reportDays())
    } catch (err) {
      showToast(t('settings.report_fail') + err.message, 'error')
    } finally {
      setIsGeneratingReport(false)
    }
  }

  const handleDownloadReport = async (rep) => {
    const url = await reportService.getReportUrl(rep.path)
    if (url) window.open(url, '_blank')
  }

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

      const header = [t('tx.col_date'), t('tx.col_type'), t('tx.col_category'), t('tx.col_amount'), t('tx.account'), t('modal_tx.dest_account'), t('tx.col_desc')]
      const rows = oldTx.map(tx => [
        new Date(tx.created_at).toLocaleString(),
        tx.tipe === 'Pemasukan' ? t('tx.type_income') : tx.tipe === 'Pengeluaran' ? t('tx.type_expense') : tx.tipe === 'Transfer' ? t('tx.type_transfer') : tx.tipe,
        tx.kategori,
        tx.jumlah,
        tx.akun,
        tx.transferke || '',
        tx.deskripsi || ''
      ])

      downloadCsv(`savora_arsip_transaksi_${new Date().getTime()}.csv`, header, rows)

      const idsToDelete = oldTx.map(tx => tx.id)
      const { error: delErr } = await supabase
        .from('transactions')
        .delete()
        .in('id', idsToDelete)

      if (delErr) throw delErr

      activityService.logEvent('ekspor_arsip', { jumlah: idsToDelete.length })
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

  // Rutin pemulihan bersama: dipakai tempel-JSON manual dan pulihkan
  // snapshot cadangan otomatis. Perilaku sama seperti semula.
  const applyRestoreData = async (data) => {
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
  }

  const handleRestoreJSON = async () => {
    if (!restoreJson) return
    setIsProcessing(true)
    try {
      const data = JSON.parse(restoreJson)
      await applyRestoreData(data)
    } catch (e) {
      showToast(t('settings.restore_fail'), 'error')
    } finally {
      setIsProcessing(false)
    }
  }

  const handleCreateBackup = async () => {
    setIsBackingUp(true)
    try {
      await backupService.createSnapshot('manual')
      activityService.logEvent('cadangan_dibuat', { jenis: 'manual' })
      showToast(t('settings.backup_created'), 'success')
      refreshSnapshots()
    } catch (e) {
      showToast(t('settings.backup_create_fail') + e.message, 'error')
    } finally {
      setIsBackingUp(false)
    }
  }

  const handleRestoreSnapshot = async () => {
    const snap = confirmRestoreSnap
    setConfirmRestoreSnap(null)
    if (!snap) return
    setIsProcessing(true)
    try {
      const data = await backupService.getSnapshotData(snap.id)
      activityService.logEvent('cadangan_dipulihkan', { jenis: snap.kind })
      await applyRestoreData(data)
    } catch {
      showToast(t('settings.restore_fail'), 'error')
    } finally {
      setIsProcessing(false)
    }
  }

  const handleFactoryReset = async () => {
    // Hanya boleh berjalan dari panel penjaga setelah kata konfirmasi cocok.
    if (!resetArmed) return
    setIsProcessing(true)
    // Paket Perlindungan: snapshot pengaman WAJIB dibuat sebelum
    // penghapusan apa pun. Bila cadangan gagal dibuat, reset dibatalkan
    // agar penghapusan tidak pernah terjadi tanpa jalan pulang.
    try {
      await backupService.createSnapshot('pra-reset')
    } catch {
      showToast(t('settings.backup_prereset_fail'), 'error')
      setIsProcessing(false)
      return
    }
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if(user) {
        // Catat dulu ke log aktivitas (tabel log tidak ikut terhapus).
        await activityService.logEvent('factory_reset')
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

  if (!isOpen) return null

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-3xl w-full max-w-md shadow-xl flex flex-col max-h-[90vh] animate-slide-up">
        <div className="flex justify-between items-center p-5 border-b border-slate-100 shrink-0">
          <h3 className="font-bold text-slate-800 flex items-center gap-2">
            <i className="fa-solid fa-database text-savora-orange"></i>
            {t('settings.data') || 'Manajemen Data'}
          </h3>
          <button onClick={handleClose} disabled={isProcessing} className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 transition">
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

          <div className="space-y-3 bg-sky-50 border border-sky-100 rounded-2xl p-4">
            <div>
              <h4 className="font-bold text-sm text-sky-700">{t('settings.backup_auto')}</h4>
              <p className="text-xs text-sky-500/80 mt-1">{t('settings.backup_auto_desc')}</p>
            </div>
            <button onClick={handleCreateBackup} disabled={isBackingUp || isProcessing} className="w-full bg-sky-600 hover:bg-sky-700 disabled:bg-slate-300 text-white text-xs font-bold py-3 rounded-xl transition shadow flex items-center justify-center gap-2">
              <i className="fa-solid fa-cloud-arrow-up"></i> {t('settings.btn_create_backup')}
            </button>
            {snapshots.length === 0 ? (
              <p className="text-[11px] text-slate-400 text-center">{t('settings.backup_empty')}</p>
            ) : (
              <div className="space-y-1.5">
                {snapshots.map(snap => (
                  <div key={snap.id} className="flex items-center justify-between bg-white border border-sky-100 rounded-xl px-3 py-2">
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-slate-700">{t('settings.backup_kind_' + snap.kind.replace('-', '_'))}</p>
                      <p className="text-[10px] text-slate-400">{new Date(snap.created_at).toLocaleString()}</p>
                    </div>
                    <button onClick={() => setConfirmRestoreSnap(snap)} disabled={isProcessing} className="shrink-0 text-[11px] font-bold text-sky-600 hover:text-sky-800 disabled:text-slate-300 transition px-2 py-1">
                      {t('settings.backup_restore_btn')}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-3 bg-violet-50 border border-violet-100 rounded-2xl p-4">
            <div>
              <h4 className="font-bold text-sm text-violet-700">{t('settings.report_title')}</h4>
              <p className="text-xs text-violet-500/80 mt-1">{t('settings.report_desc')}</p>
            </div>
            <div>
              <label className="block text-xs text-violet-600 mb-1 font-semibold">{t('settings.report_period_label')}</label>
              <select value={reportPeriod} onChange={handleReportPeriodChange}
                className="w-full border border-violet-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:border-violet-500">
                <option value="off">{t('settings.report_period_off')}</option>
                <option value="mingguan">{t('settings.report_period_weekly')}</option>
                <option value="bulanan">{t('settings.report_period_monthly')}</option>
              </select>
            </div>
            <div className="flex gap-2">
              <button onClick={handleGenerateReport} disabled={isGeneratingReport || isProcessing} className="flex-1 bg-violet-600 hover:bg-violet-700 disabled:bg-slate-300 text-white text-xs font-bold py-3 rounded-xl transition shadow flex items-center justify-center gap-2">
                <i className="fa-solid fa-file-csv"></i> {t('settings.report_generate')}
              </button>
              <button onClick={handlePrintReport} disabled={isGeneratingReport || isProcessing} className="flex-1 bg-white border border-violet-200 text-violet-700 hover:bg-violet-100 disabled:text-slate-300 text-xs font-bold py-3 rounded-xl transition flex items-center justify-center gap-2">
                <i className="fa-solid fa-file-pdf"></i> {t('settings.report_print')}
              </button>
            </div>
            {reports.length === 0 ? (
              <p className="text-[11px] text-slate-400 text-center">{t('settings.report_empty')}</p>
            ) : (
              <div className="space-y-1.5">
                {reports.map(rep => (
                  <div key={rep.path} className="flex items-center justify-between bg-white border border-violet-100 rounded-xl px-3 py-2">
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-slate-700 truncate">{rep.name}</p>
                      <p className="text-[10px] text-slate-400">{rep.created_at ? new Date(rep.created_at).toLocaleString() : ''}</p>
                    </div>
                    <button onClick={() => handleDownloadReport(rep)} className="shrink-0 text-[11px] font-bold text-violet-600 hover:text-violet-800 transition px-2 py-1">
                      {t('settings.report_download')}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {!showResetGuard ? (
            <div className="space-y-3 bg-rose-50 border border-rose-100 rounded-2xl p-4">
              <div>
                <h4 className="font-bold text-sm text-rose-600">{t('settings.reset')}</h4>
                <p className="text-xs text-rose-400/80 mt-1">{t('settings.reset_desc')}</p>
              </div>
              <button onClick={() => { setResetConfirmText(''); setShowResetGuard(true) }} disabled={isProcessing} className="w-full bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold py-3 rounded-xl transition shadow flex items-center justify-center gap-2">
                <i className="fa-solid fa-triangle-exclamation"></i> {t('settings.btn_run_reset')}
              </button>
            </div>
          ) : (
            <div className="space-y-3 bg-rose-50 border-2 border-rose-300 rounded-2xl p-4">
              <div>
                <h4 className="font-bold text-sm text-rose-700 flex items-center gap-2">
                  <i className="fa-solid fa-triangle-exclamation"></i> {t('settings.reset_guard_title')}
                </h4>
                <p className="text-xs text-rose-500 mt-1 leading-relaxed">{t('settings.reset_guard_desc')}</p>
              </div>
              <button onClick={handleBackupJSON} disabled={isProcessing} className="w-full bg-white border border-rose-200 hover:bg-rose-100 text-rose-600 text-xs font-bold py-3 rounded-xl transition flex items-center justify-center gap-2">
                <i className="fa-solid fa-copy"></i> {t('settings.reset_guard_backup')}
              </button>
              <div>
                <label className="block text-xs font-bold text-rose-600 mb-1.5">{t('settings.reset_guard_type_label')}</label>
                <input
                  type="text"
                  value={resetConfirmText}
                  onChange={e => setResetConfirmText(e.target.value)}
                  placeholder="HAPUS"
                  autoComplete="off"
                  className="w-full border border-rose-200 rounded-xl px-4 py-2.5 text-sm font-bold tracking-widest focus:outline-none focus:border-rose-500 bg-white"
                />
              </div>
              <button onClick={handleFactoryReset} disabled={!resetArmed || isProcessing} className="w-full bg-rose-600 hover:bg-rose-700 disabled:bg-slate-300 text-white text-xs font-bold py-3 rounded-xl transition shadow flex items-center justify-center gap-2">
                <i className="fa-solid fa-trash-can"></i> {t('settings.reset_guard_execute')}
              </button>
              <button onClick={() => { setShowResetGuard(false); setResetConfirmText('') }} disabled={isProcessing} className="w-full text-xs font-bold text-slate-400 hover:text-slate-600 transition py-1">
                {t('settings.reset_guard_cancel')}
              </button>
            </div>
          )}

        </div>
        <ConfirmModal
          isOpen={!!confirmRestoreSnap}
          onClose={() => setConfirmRestoreSnap(null)}
          onConfirm={handleRestoreSnapshot}
          title={t('settings.backup_restore_title')}
          message={t('settings.backup_restore_msg')}
          confirmText={t('settings.backup_restore_btn')}
          cancelText={t('settings.reset_guard_cancel')}
          type="warning"
        />
      </div>
    </div>,
    document.body
  )
}
