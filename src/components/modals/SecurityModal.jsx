import React, { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { settingsService } from '../../services/settingsService'
import { mfaService } from '../../services/mfaService'
import { activityService } from '../../services/activityService'
import { useAuth } from '../../contexts/AuthContext'
import { triggerHaptic } from '../../utils/haptics'
import { useToast } from '../../contexts/ToastContext'
import { useLanguage } from '../../contexts/LanguageContext'

export default function SecurityModal({ isOpen, onClose, initialSettings, onSettingsChange }) {
  const { t, lang } = useLanguage()
  const { showToast } = useToast()
  const { user, signOutOthers } = useAuth()

  const [settings, setSettings] = useState(initialSettings || {})
  const [newPin, setNewPin] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  // --- Verifikasi Dua Langkah (2FA/TOTP) ---
  const [mfaLoading, setMfaLoading] = useState(true)
  const [mfaFactor, setMfaFactor] = useState(null)
  const [enrollData, setEnrollData] = useState(null)
  const [enrollCode, setEnrollCode] = useState('')
  const [freshCodes, setFreshCodes] = useState(null)
  const [mfaBusy, setMfaBusy] = useState(false)

  // --- Perangkat & Sesi + Log Aktivitas (Fase 3 Paket 1) ---
  const [sessions, setSessions] = useState([])
  const [activity, setActivity] = useState([])
  const [sessLoading, setSessLoading] = useState(true)
  const [currentSessionId, setCurrentSessionId] = useState(null)
  const [sessBusy, setSessBusy] = useState(false)
  const [confirmSignOutOthers, setConfirmSignOutOthers] = useState(false)

  const fmtDateTime = (iso) => {
    if (!iso) return '-'
    try {
      return new Date(iso).toLocaleString(lang === 'en' ? 'en-US' : 'id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    } catch {
      return iso
    }
  }

  const loadSessionsAndActivity = async () => {
    const [sess, act, curId] = await Promise.all([
      activityService.listSessions().catch(() => []),
      activityService.listActivity(20).catch(() => []),
      activityService.getCurrentSessionId().catch(() => null),
    ])
    setSessions(sess)
    setActivity(act)
    setCurrentSessionId(curId)
  }

  useEffect(() => {
    if (isOpen && initialSettings) {
      setSettings(initialSettings)
    }
  }, [isOpen, initialSettings])

  useEffect(() => {
    if (!isOpen) return
    let cancelled = false
    setMfaLoading(true)
    mfaService.listVerifiedTotpFactors()
      .then((factors) => { if (!cancelled) setMfaFactor(factors[0] ?? null) })
      .catch(() => { if (!cancelled) setMfaFactor(null) })
      .finally(() => { if (!cancelled) setMfaLoading(false) })
    return () => { cancelled = true }
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return
    let cancelled = false
    setSessLoading(true)
    setConfirmSignOutOthers(false)
    loadSessionsAndActivity()
      .catch(() => { /* daftar kosong bila tabel belum dimigrasi */ })
      .finally(() => { if (!cancelled) setSessLoading(false) })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen])

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

  // --- Handler 2FA ---
  const handleEnroll = async () => {
    setMfaBusy(true)
    try {
      const data = await mfaService.enrollTotp()
      setEnrollData(data)
      setEnrollCode('')
    } catch (e) {
      showToast(e.message, 'error')
    } finally {
      setMfaBusy(false)
    }
  }

  const handleVerifyEnroll = async () => {
    if (!enrollData || !user) return
    setMfaBusy(true)
    try {
      await mfaService.verifyNewFactor(enrollData.id, enrollCode)
      // 2FA aktif: buat kode pemulihan pertama dan tampilkan sekali
      const codes = await mfaService.regenerateRecoveryCodes(user.id)
      setMfaFactor({ id: enrollData.id, status: 'verified' })
      setEnrollData(null)
      setEnrollCode('')
      setFreshCodes(codes)
      activityService.logEvent('2fa_diaktifkan')
      showToast(t('settings.twofa_toast_on'), 'success')
    } catch {
      showToast(t('settings.twofa_err_code'), 'error')
    } finally {
      setMfaBusy(false)
    }
  }

  const handleCancelEnroll = async () => {
    if (!enrollData) return
    setMfaBusy(true)
    try {
      await mfaService.unenrollFactor(enrollData.id)
    } catch (e) {
      // Faktor belum terverifikasi; abaikan kegagalan bersih-bersih
      console.error(e)
    } finally {
      setEnrollData(null)
      setEnrollCode('')
      setMfaBusy(false)
    }
  }

  const handleRegenerateCodes = async () => {
    if (!user) return
    setMfaBusy(true)
    try {
      const codes = await mfaService.regenerateRecoveryCodes(user.id)
      setFreshCodes(codes)
      showToast(t('settings.twofa_toast_codes'), 'success')
    } catch (e) {
      showToast(e.message, 'error')
    } finally {
      setMfaBusy(false)
    }
  }

  const handleDisableMfa = async () => {
    if (!mfaFactor) return
    setMfaBusy(true)
    try {
      await mfaService.unenrollFactor(mfaFactor.id)
      setMfaFactor(null)
      setFreshCodes(null)
      activityService.logEvent('2fa_dinonaktifkan')
      showToast(t('settings.twofa_toast_off'), 'success')
    } catch (e) {
      if ((e.message || '').toLowerCase().includes('aal')) {
        showToast(t('settings.twofa_err_disable_aal'), 'error')
      } else {
        showToast(e.message, 'error')
      }
    } finally {
      setMfaBusy(false)
    }
  }

  // --- Handler Perangkat & Sesi ---
  const handleSignOutOthers = async () => {
    if (!confirmSignOutOthers) {
      setConfirmSignOutOthers(true)
      return
    }
    setSessBusy(true)
    try {
      const { error } = await signOutOthers()
      if (error) throw error
      setConfirmSignOutOthers(false)
      showToast(t('settings.session_signout_others_done'), 'success')
      await loadSessionsAndActivity()
    } catch (e) {
      showToast(e.message, 'error')
    } finally {
      setSessBusy(false)
    }
  }

  const handleDeleteSessionRecord = async (id) => {
    setSessBusy(true)
    try {
      await activityService.deleteSessionRecord(id)
      setSessions((prev) => prev.filter((s) => s.id !== id))
    } catch (e) {
      showToast(e.message, 'error')
    } finally {
      setSessBusy(false)
    }
  }

  const renderQr = (qr) => {
    if (!qr) return null
    if (qr.startsWith('data:') || qr.startsWith('http')) {
      return <img src={qr} alt="QR 2FA" className="w-44 h-44" />
    }
    return <div className="w-44 h-44 [&>svg]:w-full [&>svg]:h-full" dangerouslySetInnerHTML={{ __html: qr }} />
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



  if (!isOpen) return null

  return createPortal(
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

            {settings.is_pin_enabled ? (
              <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4">
                <h4 className="font-bold text-xs text-slate-600 mb-3">{t('settings.lbl_change_pin')}</h4>
                <div className="flex gap-2">
                  <input type="password" autoComplete="new-password" value={newPin} onChange={e => setNewPin(e.target.value)} maxLength="4" placeholder="PIN (4 digit)"
                    className="flex-1 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-emerald-500 bg-white" />
                  <button onClick={handleSavePin} disabled={isSaving || newPin.length !== 4} className="bg-emerald-500 hover:bg-emerald-600 disabled:bg-slate-300 text-white text-xs font-bold px-5 py-2.5 rounded-xl transition shadow">
                    {t('settings.btn_save')}
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-400 bg-slate-50 border border-slate-100 rounded-2xl p-4">{t('settings.pin_disabled_hint')}</p>
            )}
          </div>

          {/* Verifikasi Dua Langkah (2FA) */}
          <div className="border-t border-slate-100 pt-6 space-y-4">
            <div>
              <h4 className="font-bold text-sm text-slate-800">{t('settings.twofa_title')}</h4>
              <p className="text-xs text-slate-400 mt-1">{mfaFactor ? t('settings.twofa_desc_on') : t('settings.twofa_desc_off')}</p>
            </div>

            {mfaLoading ? (
              <p className="text-xs text-slate-400">{t('settings.twofa_loading')}</p>
            ) : freshCodes ? (
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
                <h4 className="font-bold text-xs text-amber-800 mb-2">{t('settings.twofa_codes_title')}</h4>
                <div className="grid grid-cols-2 gap-2 mb-3">
                  {freshCodes.map((code) => (
                    <div key={code} className="bg-white border border-amber-200 rounded-lg px-3 py-2 text-center font-mono font-bold text-sm text-slate-700 tracking-widest">{code}</div>
                  ))}
                </div>
                <p className="text-[11px] text-amber-700 leading-relaxed mb-3">{t('settings.twofa_codes_warning')}</p>
                <button onClick={() => setFreshCodes(null)} className="w-full bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold px-4 py-2.5 rounded-xl transition shadow">
                  {t('settings.twofa_btn_codes_done')}
                </button>
              </div>
            ) : mfaFactor ? (
              <div className="space-y-3">
                <p className="text-xs font-bold text-emerald-600 bg-emerald-50 border border-emerald-100 rounded-2xl px-4 py-3">{t('settings.twofa_status_active')}</p>
                <div className="flex gap-2">
                  <button onClick={handleRegenerateCodes} disabled={mfaBusy} className="flex-1 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-700 text-xs font-bold px-4 py-2.5 rounded-xl transition">
                    {t('settings.twofa_btn_regen')}
                  </button>
                  <button onClick={handleDisableMfa} disabled={mfaBusy} className="flex-1 bg-rose-50 hover:bg-rose-100 disabled:opacity-50 text-rose-600 text-xs font-bold px-4 py-2.5 rounded-xl transition">
                    {t('settings.twofa_btn_disable')}
                  </button>
                </div>
              </div>
            ) : enrollData ? (
              <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 space-y-4">
                <p className="text-xs text-slate-500">{t('settings.twofa_scan')}</p>
                <div className="flex justify-center bg-white rounded-2xl p-3 border border-slate-100">
                  {renderQr(enrollData.qrCode)}
                </div>
                <div>
                  <p className="text-[11px] text-slate-400 mb-1">{t('settings.twofa_secret')}</p>
                  <p className="font-mono text-xs font-bold text-slate-700 bg-white border border-slate-200 rounded-lg px-3 py-2 break-all select-all">{enrollData.secret}</p>
                </div>
                <div>
                  <p className="text-[11px] text-slate-400 mb-1">{t('settings.twofa_code_label')}</p>
                  <div className="flex gap-2">
                    <input type="text" inputMode="numeric" autoComplete="one-time-code" value={enrollCode} onChange={e => setEnrollCode(e.target.value.replace(/\D/g, ''))} maxLength={6} placeholder="••••••"
                      className="flex-1 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-center tracking-[0.3em] font-bold focus:outline-none focus:border-emerald-500 bg-white" />
                    <button onClick={handleVerifyEnroll} disabled={mfaBusy || enrollCode.length !== 6} className="bg-emerald-500 hover:bg-emerald-600 disabled:bg-slate-300 text-white text-xs font-bold px-4 py-2.5 rounded-xl transition shadow">
                      {t('settings.twofa_btn_verify')}
                    </button>
                  </div>
                </div>
                <button onClick={handleCancelEnroll} disabled={mfaBusy} className="text-xs text-slate-400 hover:text-rose-500 font-bold transition disabled:opacity-50">
                  {t('settings.twofa_btn_cancel')}
                </button>
              </div>
            ) : (
              <button onClick={handleEnroll} disabled={mfaBusy} className="w-full bg-emerald-500 hover:bg-emerald-600 disabled:bg-slate-300 text-white text-xs font-bold px-4 py-3 rounded-xl transition shadow">
                {t('settings.twofa_btn_enable')}
              </button>
            )}
          </div>

          {/* Perangkat & Sesi (Fase 3 Paket 1) */}
          <div className="border-t border-slate-100 pt-6 space-y-4">
            <div>
              <h4 className="font-bold text-sm text-slate-800">{t('settings.session_title')}</h4>
              <p className="text-xs text-slate-400 mt-1">{t('settings.session_desc')}</p>
            </div>

            {sessLoading ? (
              <p className="text-xs text-slate-400">{t('settings.session_loading')}</p>
            ) : sessions.length === 0 ? (
              <p className="text-xs text-slate-400 bg-slate-50 border border-slate-100 rounded-2xl p-4">{t('settings.session_empty')}</p>
            ) : (
              <div className="space-y-2">
                {sessions.map((s) => {
                  const isCurrent = currentSessionId && s.session_id === currentSessionId
                  return (
                    <div key={s.id} className="flex items-center justify-between gap-3 bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3">
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-slate-700 flex items-center gap-2 flex-wrap">
                          <span className="truncate">{s.device_label || 'Perangkat'}</span>
                          {isCurrent && <span className="bg-emerald-100 text-emerald-700 text-[10px] font-bold px-2 py-0.5 rounded-full">{t('settings.session_current')}</span>}
                        </p>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          {t('settings.session_login_at')}: {fmtDateTime(s.created_at)} · {t('settings.session_last_active')}: {fmtDateTime(s.last_seen_at)}
                        </p>
                      </div>
                      {!isCurrent && (
                        <button onClick={() => handleDeleteSessionRecord(s.id)} disabled={sessBusy} className="shrink-0 text-[11px] font-bold text-slate-400 hover:text-rose-500 transition disabled:opacity-50">
                          {t('settings.session_delete_record')}
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            )}

            <button onClick={handleSignOutOthers} disabled={sessBusy} className={`w-full text-xs font-bold px-4 py-3 rounded-xl transition shadow disabled:opacity-50 ${confirmSignOutOthers ? 'bg-rose-500 hover:bg-rose-600 text-white' : 'bg-slate-800 hover:bg-slate-900 text-white'}`}>
              {confirmSignOutOthers ? t('settings.session_signout_others_confirm') : t('settings.session_signout_others')}
            </button>
            <p className="text-[11px] text-slate-400 leading-relaxed">{t('settings.session_note')}</p>
          </div>

          {/* Aktivitas Terakhir (Fase 3 Paket 1) */}
          <div className="border-t border-slate-100 pt-6 space-y-4">
            <div>
              <h4 className="font-bold text-sm text-slate-800">{t('settings.activity_title')}</h4>
            </div>
            {sessLoading ? (
              <p className="text-xs text-slate-400">{t('settings.session_loading')}</p>
            ) : activity.length === 0 ? (
              <p className="text-xs text-slate-400 bg-slate-50 border border-slate-100 rounded-2xl p-4">{t('settings.activity_empty')}</p>
            ) : (
              <div className="space-y-1.5">
                {activity.map((a) => (
                  <div key={a.id} className="flex items-center justify-between gap-3 px-1 py-1">
                    <p className="text-xs text-slate-600">{t('settings.act_' + a.event)}</p>
                    <p className="text-[11px] text-slate-400 shrink-0">{fmtDateTime(a.created_at)}</p>
                  </div>
                ))}
              </div>
            )}
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
    </div>,
    document.body
  )
}
