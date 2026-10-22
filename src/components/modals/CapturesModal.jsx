import React, { useState, useEffect } from 'react'
import { captureService } from '../../services/captureService'
import { categoryService } from '../../services/categoryService'
import { useToast } from '../../contexts/ToastContext'
import { useLanguage } from '../../contexts/LanguageContext'
import { triggerHaptic } from '../../utils/haptics'
import ConfirmModal from './ConfirmModal'

// Tangkapan Otomatis (Sinkron Otomatis Pilot BSI, 2026-10-22):
// daftar transaksi yang tercatat otomatis dari email notifikasi
// BYOND by BSI. Pengguna meninjau, memperbaiki kategori tebakan,
// atau menghapus tangkapan yang keliru (saldo ikut dikembalikan).
export default function CapturesModal({ isOpen, onClose }) {
  const { t } = useLanguage()
  const { showToast } = useToast()
  const [captures, setCaptures] = useState([])
  const [categories, setCategories] = useState([])
  const [catChoice, setCatChoice] = useState({})
  const [isLoading, setIsLoading] = useState(false)
  const [busyId, setBusyId] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)

  const fmtIdr = (n) => new Intl.NumberFormat('id-ID', {
    style: 'currency', currency: 'IDR', minimumFractionDigits: 0
  }).format(Number(n) || 0)

  const fmtDate = (iso) => {
    if (!iso) return ''
    try {
      return new Date(iso).toLocaleString('id-ID', {
        day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
      })
    } catch { return '' }
  }

  const load = async () => {
    setIsLoading(true)
    try {
      const [caps, cats] = await Promise.all([
        captureService.getCaptures(),
        categoryService.getCategories()
      ])
      setCaptures(caps)
      setCategories((cats || []).filter(c => c.tipe === 'Pengeluaran').map(c => c.namakategori))
      const init = {}
      caps.forEach(c => { init[c.id] = c.parsed?.kategori || '' })
      setCatChoice(init)
    } catch {
      showToast(t('captures.load_fail'), 'error')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (!isOpen) return
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen])

  if (!isOpen) return null

  const jenisLabel = (jenis) => {
    if (jenis === 'qris') return t('captures.jenis_qris')
    if (jenis === 'topup') return t('captures.jenis_topup')
    if (jenis === 'transfer') return t('captures.jenis_transfer')
    return t('captures.jenis_other')
  }

  const statusChip = (c) => {
    if (c.status === 'reviewed') return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-600">{t('captures.reviewed')}</span>
    if (c.status === 'posted') return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-50 text-sky-600">{t('captures.status_posted')}</span>
    if (c.status === 'unparsed') return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-600">{t('captures.status_unparsed')}</span>
    if (c.status === 'error') return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-600">{t('captures.status_error')}</span>
    return null
  }

  const handleMarkOk = async (capture) => {
    setBusyId(capture.id)
    try {
      await captureService.markReviewed(capture.id)
      triggerHaptic([30])
      showToast(t('captures.marked'))
      await load()
    } catch { showToast(t('captures.load_fail'), 'error') }
    finally { setBusyId(null) }
  }

  const handleSaveCategory = async (capture) => {
    const kategori = catChoice[capture.id]
    if (!kategori) return
    setBusyId(capture.id)
    try {
      await captureService.updateCategory(capture, kategori)
      setCaptures(prev => prev.map(c => c.id === capture.id
        ? { ...c, parsed: { ...(c.parsed || {}), kategori } } : c))
      showToast(t('captures.saved'))
    } catch { showToast(t('captures.load_fail'), 'error') }
    finally { setBusyId(null) }
  }

  const handleConfirmDelete = async () => {
    const capture = deleteTarget
    setDeleteTarget(null)
    if (!capture) return
    setBusyId(capture.id)
    try {
      if ((capture.transaction_ids || []).length > 0) {
        await captureService.deleteCapture(capture)
      } else {
        await captureService.discardCapture(capture.id)
      }
      triggerHaptic([30])
      showToast(t('captures.deleted_toast'))
      await load()
    } catch { showToast(t('captures.load_fail'), 'error') }
    finally { setBusyId(null) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm animate-fade-in" onClick={onClose}>
      <div className="bg-white w-full max-w-lg rounded-t-3xl sm:rounded-3xl shadow-xl max-h-[88vh] flex flex-col animate-slide-up" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-slate-100">
          <h3 className="font-extrabold text-slate-800 text-lg flex items-center gap-2">
            <i className="fa-solid fa-inbox text-amber-500"></i>
            {t('captures.title')}
          </h3>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center hover:bg-slate-200 transition">
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>

        <div className="p-5 overflow-y-auto space-y-3">
          <p className="text-xs text-slate-400 leading-relaxed">{t('captures.note')}</p>

          {isLoading ? (
            <div className="py-10 text-center text-slate-400">
              <i className="fa-solid fa-circle-notch fa-spin text-2xl"></i>
            </div>
          ) : captures.length === 0 ? (
            <div className="py-10 text-center text-slate-400 space-y-2">
              <i className="fa-solid fa-inbox text-3xl block"></i>
              <p className="text-sm font-semibold">{t('captures.empty')}</p>
            </div>
          ) : captures.map(c => {
            const posted = c.status === 'posted' || c.status === 'reviewed'
            const tanggal = c.parsed?.tanggalISO || c.created_at
            const hasExpenseTx = posted && c.jenis !== 'transfer'
            return (
              <div key={c.id} className="border border-slate-100 rounded-2xl p-4 space-y-2 bg-white shadow-sm">
                <div className="flex items-center justify-between gap-2">
                  {statusChip(c)}
                  <span className="text-[11px] text-slate-400 font-semibold">{fmtDate(tanggal)}</span>
                </div>

                {posted ? (
                  <>
                    <div className="flex items-start justify-between gap-3">
                      <p className="font-bold text-slate-700 text-sm leading-snug">{c.deskripsi || '-'}</p>
                      <p className={`font-extrabold text-sm whitespace-nowrap ${c.arah === 'masuk' ? 'text-emerald-600' : 'text-slate-700'}`}>
                        {c.arah === 'masuk' ? '+' : '−'}{fmtIdr(c.jumlah)}
                      </p>
                    </div>
                    <p className="text-[11px] text-slate-400 font-semibold">
                      {jenisLabel(c.jenis)} • {t('captures.source')}
                    </p>

                    {hasExpenseTx && c.status !== 'reviewed' && (
                      <div className="flex items-center gap-2 pt-1">
                        <label className="text-[11px] font-bold text-slate-400">{t('captures.category')}</label>
                        <select
                          value={catChoice[c.id] || ''}
                          onChange={e => setCatChoice(prev => ({ ...prev, [c.id]: e.target.value }))}
                          className="flex-1 text-sm font-semibold text-slate-700 border border-slate-200 rounded-xl px-2 py-1.5 bg-white"
                        >
                          {categories.map(name => <option key={name} value={name}>{name}</option>)}
                        </select>
                        <button
                          onClick={() => handleSaveCategory(c)}
                          disabled={busyId === c.id}
                          className="px-3 py-1.5 rounded-xl bg-slate-800 text-white text-xs font-bold disabled:opacity-50"
                        >
                          {t('captures.save_category')}
                        </button>
                      </div>
                    )}

                    <div className="flex items-center gap-2 pt-1">
                      {c.status !== 'reviewed' && (
                        <button
                          onClick={() => handleMarkOk(c)}
                          disabled={busyId === c.id}
                          className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold disabled:opacity-50"
                        >
                          {t('captures.mark_ok')}
                        </button>
                      )}
                      <button
                        onClick={() => setDeleteTarget(c)}
                        disabled={busyId === c.id}
                        className="px-3 py-1.5 rounded-xl bg-rose-50 text-rose-600 text-xs font-bold disabled:opacity-50"
                      >
                        {t('captures.delete')}
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <p className="font-bold text-slate-700 text-sm">{c.raw_subject || '-'}</p>
                    <p className="text-[11px] text-slate-400 leading-relaxed">
                      {c.status === 'unparsed' ? t('captures.unparsed_note') : t('captures.error_note')}
                    </p>
                    <button
                      onClick={() => setDeleteTarget(c)}
                      disabled={busyId === c.id}
                      className="px-3 py-1.5 rounded-xl bg-rose-50 text-rose-600 text-xs font-bold disabled:opacity-50"
                    >
                      {t('captures.delete')}
                    </button>
                  </>
                )}
              </div>
            )
          })}
        </div>
      </div>

      <ConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleConfirmDelete}
        title={t('captures.delete_title')}
        message={t('captures.delete_msg')}
        confirmText={t('captures.delete')}
      />
    </div>
  )
}
