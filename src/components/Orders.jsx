import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { orderService, groupLinesByChild, groupByPayer, paymentStatus } from '../services/orderService'
import { useLanguage } from '../contexts/LanguageContext'
import { useToast } from '../contexts/ToastContext'
import { SkeletonCard, SkeletonList } from './SkeletonLoader'
import { formatCurrency, formatNumberInput, parseNumberInput } from '../utils/formatCurrency'
import { triggerHaptic } from '../utils/haptics'
import ConfirmModal from './modals/ConfirmModal'

const JENIS = ['Makanan', 'Minuman', 'Barang']

function toLocalInputValue(iso) {
  const d = new Date(iso)
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function StatusBadge({ status }) {
  const styles = {
    Lunas: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    Sebagian: 'bg-amber-100 text-amber-700 border-amber-200',
    Belum: 'bg-rose-100 text-rose-700 border-rose-200'
  }
  return (
    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border shrink-0 ${styles[status] || styles.Belum}`}>
      {status === 'Belum' ? 'Belum Bayar' : status}
    </span>
  )
}

export default function Orders() {
  const { t } = useLanguage()
  const { showToast } = useToast()

  const [isLoading, setIsLoading] = useState(true)
  const [people, setPeople] = useState([])
  const [items, setItems] = useState([])
  const [sessions, setSessions] = useState([])
  const [sessionStats, setSessionStats] = useState(new Map())

  const [view, setView] = useState('sessions') // sessions | session | kelola
  const [kelolaTab, setKelolaTab] = useState('orang')
  const [detail, setDetail] = useState(null) // { session, lines, settlements }
  const [detailTab, setDetailTab] = useState('catat')
  const [selectedChildId, setSelectedChildId] = useState(null)
  const [showAddChild, setShowAddChild] = useState(false)

  const [confirmModal, setConfirmModal] = useState({ isOpen: false, title: '', message: '', onConfirm: null })

  // Form sesi baru
  const [newSessionTitle, setNewSessionTitle] = useState('')
  const [newSessionTime, setNewSessionTime] = useState(toLocalInputValue(new Date().toISOString()))
  const [showNewSession, setShowNewSession] = useState(false)

  // Form catat
  const [itemSearch, setItemSearch] = useState('')
  const [newItemName, setNewItemName] = useState('')
  const [newItemPrice, setNewItemPrice] = useState('')
  const [newPersonName, setNewPersonName] = useState('')
  const [payInputs, setPayInputs] = useState({}) // payerId -> string angka terformat
  const [childPayInputs, setChildPayInputs] = useState({}) // `${payerId}:${childId}` -> string angka terformat
  const [payerDraft, setPayerDraft] = useState({}) // childId -> payerId pilihan "Dibayar oleh" sebelum anak punya baris

  // Form kelola
  const [personForm, setPersonForm] = useState({ nama: '', catatan: '', peran: 'keduanya' })
  const [itemForm, setItemForm] = useState({ nama: '', harga: '', jenis: 'Makanan' })
  const [editPerson, setEditPerson] = useState(null) // { id, nama, catatan, peran }
  const [editItem, setEditItem] = useState(null) // { id, nama, harga, jenis }

  const nameOf = (id) => people.find(p => p.id === id)?.nama || '-'

  const loadAll = useCallback(async () => {
    try {
      setIsLoading(true)
      const [ppl, itm, sess, stats] = await Promise.all([
        orderService.getPeople(),
        orderService.getItems(),
        orderService.getSessions(),
        orderService.getSessionsStats()
      ])
      setPeople(ppl)
      setItems(itm)
      setSessions(sess)
      setSessionStats(stats)
    } catch (error) {
      console.error(error)
      showToast(t('orders.load_fail'), 'error')
    } finally {
      setIsLoading(false)
    }
  }, [showToast, t])

  useEffect(() => { loadAll() }, [loadAll])

  const refreshDetail = async (sessionId) => {
    const d = await orderService.getSessionDetail(sessionId)
    setDetail(d)
    return d
  }

  const openSession = async (session) => {
    try {
      setIsLoading(true)
      await refreshDetail(session.id)
      setView('session')
      setDetailTab('catat')
      setSelectedChildId(null)
      setShowAddChild(false)
    } catch (error) {
      console.error(error)
      showToast(t('orders.load_fail'), 'error')
    } finally {
      setIsLoading(false)
    }
  }

  const backToSessions = async () => {
    setView('sessions')
    setDetail(null)
    await loadAll()
  }

  // ---------- Turunan detail sesi ----------
  const lines = useMemo(() => detail?.lines || [], [detail])
  const settlements = useMemo(() => detail?.settlements || [], [detail])
  const settledByChild = useMemo(
    () => new Map(settlements.map(s => [s.child_id, Number(s.jumlah_dibayar) || 0])),
    [settlements]
  )
  const childGroups = useMemo(() => groupLinesByChild(lines), [lines])
  const payerGroups = useMemo(() => groupByPayer(lines, settlements), [lines, settlements])
  const sessionTotal = childGroups.reduce((a, g) => a + g.total, 0)
  const sessionSettled = childGroups.reduce(
    (a, g) => a + Math.min(settledByChild.get(g.childId) || 0, g.total), 0
  )
  const shoppingList = useMemo(() => {
    const map = new Map()
    for (const l of lines) {
      const key = l.nama_snapshot
      if (!map.has(key)) map.set(key, { nama: key, qty: 0, amount: 0 })
      const row = map.get(key)
      row.qty += l.qty || 1
      row.amount += (Number(l.harga_snapshot) || 0) * (l.qty || 1)
    }
    return [...map.values()].sort((a, b) => b.qty - a.qty)
  }, [lines])

  const selectedGroup = childGroups.find(g => g.childId === selectedChildId) || null
  const selectedPayerId = selectedGroup?.payerId || selectedChildId
  // Peran orang (kolom order_people.peran; orang lama tanpa peran = 'keduanya').
  const roleOf = (p) => p?.peran || 'keduanya'
  const isChildRole = (p) => ['santri', 'keduanya'].includes(roleOf(p))
  const isPayerRole = (p) => ['pembayar', 'keduanya'].includes(roleOf(p))
  // Pilihan pembayar yang dibuat sebelum anak punya baris harus menempel:
  // nilai turunan di atas selalu kembali ke anak sendiri bila belum ada baris.
  const effectivePayerId = (selectedChildId && payerDraft[selectedChildId]) || selectedPayerId

  useEffect(() => { setPayerDraft({}) }, [detail?.session?.id])
  const closed = detail?.session?.ditutup

  // ---------- Aksi sesi ----------
  const handleCreateSession = async () => {
    const judul = newSessionTitle.trim() || t('orders.default_title')
    try {
      const s = await orderService.createSession({
        judul,
        waktu: new Date(newSessionTime).toISOString()
      })
      setShowNewSession(false)
      setNewSessionTitle('')
      showToast(t('orders.session_created'), 'success')
      await openSession(s)
    } catch (error) {
      console.error(error)
      showToast(t('orders.save_fail'), 'error')
    }
  }

  const handleDeleteSession = (session) => {
    setConfirmModal({
      isOpen: true,
      title: t('orders.delete_session_title'),
      message: t('orders.delete_session_msg'),
      onConfirm: async () => {
        try {
          await orderService.deleteSession(session.id)
          setConfirmModal({ isOpen: false })
          showToast(t('orders.deleted'), 'success')
          if (view === 'session') await backToSessions()
          else await loadAll()
        } catch (error) {
          console.error(error)
          showToast(t('orders.save_fail'), 'error')
        }
      }
    })
  }

  const handleToggleClosed = async () => {
    try {
      await orderService.updateSession(detail.session.id, { ditutup: !closed })
      await refreshDetail(detail.session.id)
    } catch (error) {
      console.error(error)
      showToast(t('orders.save_fail'), 'error')
    }
  }

  // ---------- Aksi catat ----------
  const handleAddPersonInline = async () => {
    if (!newPersonName.trim()) return
    try {
      // Anak yang ditambahkan dari tab Catat otomatis berperan Santri —
      // tidak mengotori daftar calon pembayar.
      const p = await orderService.addPerson({ nama: newPersonName, peran: 'santri' })
      setPeople(prev => [...prev, p].sort((a, b) => a.nama.localeCompare(b.nama)))
      setNewPersonName('')
      setSelectedChildId(p.id)
      setShowAddChild(false)
      triggerHaptic()
    } catch (error) {
      console.error(error)
      showToast(t('orders.save_fail'), 'error')
    }
  }

  const handleTapItem = async (item) => {
    if (!selectedChildId || closed) return
    try {
      triggerHaptic()
      await orderService.addLine({
        session_id: detail.session.id,
        child_id: selectedChildId,
        item,
        payer_id: effectivePayerId
      })
      await refreshDetail(detail.session.id)
    } catch (error) {
      console.error(error)
      showToast(t('orders.save_fail'), 'error')
    }
  }

  const handleAddNewItem = async () => {
    if (!newItemName.trim() || !selectedChildId) return
    try {
      const item = await orderService.addItem({
        nama: newItemName,
        harga: parseNumberInput(newItemPrice),
        jenis: 'Makanan'
      })
      setItems(prev => [...prev, item].sort((a, b) => a.nama.localeCompare(b.nama)))
      setNewItemName('')
      setNewItemPrice('')
      await handleTapItem(item)
    } catch (error) {
      console.error(error)
      showToast(t('orders.save_fail'), 'error')
    }
  }

  const handleLineQty = async (line, delta) => {
    const qty = (line.qty || 1) + delta
    if (qty < 1) return
    try {
      await orderService.updateLine(line.id, { qty }, detail.session.id)
      await refreshDetail(detail.session.id)
    } catch (error) {
      console.error(error)
      showToast(t('orders.save_fail'), 'error')
    }
  }

  const handleLinePrice = async (line, value) => {
    try {
      await orderService.updateLine(line.id, { harga_snapshot: parseNumberInput(value) }, detail.session.id)
      await refreshDetail(detail.session.id)
    } catch (error) {
      console.error(error)
      showToast(t('orders.save_fail'), 'error')
    }
  }

  const handleDeleteLine = (line) => {
    setConfirmModal({
      isOpen: true,
      title: t('orders.delete_line_title'),
      message: `${line.nama_snapshot} — ${nameOf(line.child_id)}`,
      onConfirm: async () => {
        try {
          await orderService.deleteLine(line.id, detail.session.id)
          setConfirmModal({ isOpen: false })
          await refreshDetail(detail.session.id)
        } catch (error) {
          console.error(error)
          showToast(t('orders.save_fail'), 'error')
        }
      }
    })
  }

  const handlePayerChange = async (payerId) => {
    // Selalu ingat pilihan terakhir; bila anak sudah punya baris,
    // terapkan juga ke baris-baris yang ada.
    setPayerDraft(prev => ({ ...prev, [selectedChildId]: payerId }))
    if (!selectedGroup) return
    try {
      await orderService.setPayerForChild(detail.session.id, selectedChildId, payerId)
      await refreshDetail(detail.session.id)
    } catch (error) {
      console.error(error)
      showToast(t('orders.save_fail'), 'error')
    }
  }

  // Cicil untuk satu anak tertentu (mis. "Dulloh baru bayar 5000"):
  // hanya saldo anak itu yang berkurang, bukan tunggakan tertua pembayar.
  const handleRecordChildPayment = async (payerId, childId) => {
    const key = `${payerId}:${childId}`
    const amount = parseNumberInput(childPayInputs[key])
    if (!amount) return
    try {
      await orderService.recordChildPayment(detail.session.id, childId, amount)
      setChildPayInputs(prev => ({ ...prev, [key]: '' }))
      showToast(t('orders.payment_saved'), 'success')
      await refreshDetail(detail.session.id)
    } catch (error) {
      console.error(error)
      showToast(t('orders.save_fail'), 'error')
    }
  }

  // ---------- Aksi pembayaran ----------
  const handleToggleChildPaid = async (childGroup, payerChild, checked) => {
    try {
      await orderService.setSettlement(
        detail.session.id,
        payerChild.childId,
        checked ? payerChild.total : 0
      )
      await refreshDetail(detail.session.id)
    } catch (error) {
      console.error(error)
      showToast(t('orders.save_fail'), 'error')
    }
  }

  const handleRecordPayment = async (payerId) => {
    const amount = parseNumberInput(payInputs[payerId])
    if (!amount) return
    try {
      await orderService.recordPayerPayment(detail.session.id, payerId, amount)
      setPayInputs(prev => ({ ...prev, [payerId]: '' }))
      showToast(t('orders.payment_saved'), 'success')
      await refreshDetail(detail.session.id)
    } catch (error) {
      console.error(error)
      showToast(t('orders.save_fail'), 'error')
    }
  }

  const handleSettleAll = async (group) => {
    try {
      for (const child of group.children) {
        if (child.settled < child.total) {
          await orderService.setSettlement(detail.session.id, child.childId, child.total)
        }
      }
      showToast(t('orders.payment_saved'), 'success')
      await refreshDetail(detail.session.id)
    } catch (error) {
      console.error(error)
      showToast(t('orders.save_fail'), 'error')
    }
  }

  const handleToggleLineDelivered = async (line) => {
    try {
      await orderService.updateLine(line.id, { diserahkan: !line.diserahkan })
      await refreshDetail(detail.session.id)
    } catch (error) {
      console.error(error)
      showToast(t('orders.save_fail'), 'error')
    }
  }

  const handleToggleChildDelivered = async (childGroup) => {
    try {
      await orderService.setChildDelivered(detail.session.id, childGroup.childId, !childGroup.semuaDiserahkan)
      await refreshDetail(detail.session.id)
    } catch (error) {
      console.error(error)
      showToast(t('orders.save_fail'), 'error')
    }
  }

  // ---------- Kelola ----------
  const handleAddPerson = async () => {
    if (!personForm.nama.trim()) return
    try {
      const p = await orderService.addPerson(personForm)
      setPeople(prev => [...prev, p].sort((a, b) => a.nama.localeCompare(b.nama)))
      setPersonForm({ nama: '', catatan: '', peran: 'keduanya' })
      showToast(t('orders.saved'), 'success')
    } catch (error) {
      console.error(error)
      showToast(t('orders.save_fail'), 'error')
    }
  }

  const handleSavePerson = async () => {
    try {
      await orderService.updatePerson(editPerson.id, { nama: editPerson.nama.trim(), catatan: editPerson.catatan?.trim() || null, peran: editPerson.peran || 'keduanya' })
      setPeople(prev => prev.map(p => p.id === editPerson.id ? { ...p, nama: editPerson.nama, catatan: editPerson.catatan || null, peran: editPerson.peran || 'keduanya' } : p))
      setEditPerson(null)
      showToast(t('orders.saved'), 'success')
    } catch (error) {
      console.error(error)
      showToast(t('orders.save_fail'), 'error')
    }
  }

  const handleTogglePersonActive = async (person) => {
    try {
      await orderService.updatePerson(person.id, { aktif: !person.aktif })
      setPeople(prev => prev.map(p => p.id === person.id ? { ...p, aktif: !person.aktif } : p))
    } catch (error) {
      console.error(error)
      showToast(t('orders.save_fail'), 'error')
    }
  }

  const handleDeletePerson = (person) => {
    setConfirmModal({
      isOpen: true,
      title: t('orders.delete_person_title'),
      message: person.nama,
      onConfirm: async () => {
        try {
          await orderService.deletePerson(person.id)
          setPeople(prev => prev.filter(p => p.id !== person.id))
          setConfirmModal({ isOpen: false })
          showToast(t('orders.deleted'), 'success')
        } catch (error) {
          console.error(error)
          setConfirmModal({ isOpen: false })
          showToast(t('orders.delete_used_fail'), 'error')
        }
      }
    })
  }

  const handleAddItem = async () => {
    if (!itemForm.nama.trim()) return
    try {
      const it = await orderService.addItem({ nama: itemForm.nama, harga: parseNumberInput(itemForm.harga), jenis: itemForm.jenis })
      setItems(prev => [...prev, it].sort((a, b) => a.nama.localeCompare(b.nama)))
      setItemForm({ nama: '', harga: '', jenis: 'Makanan' })
      showToast(t('orders.saved'), 'success')
    } catch (error) {
      console.error(error)
      showToast(t('orders.save_fail'), 'error')
    }
  }

  const handleSaveItem = async () => {
    try {
      await orderService.updateItem(editItem.id, { nama: editItem.nama.trim(), harga: parseNumberInput(editItem.harga), jenis: editItem.jenis })
      setItems(prev => prev.map(i => i.id === editItem.id ? { ...i, nama: editItem.nama, harga: parseNumberInput(editItem.harga), jenis: editItem.jenis } : i))
      setEditItem(null)
      showToast(t('orders.saved'), 'success')
    } catch (error) {
      console.error(error)
      showToast(t('orders.save_fail'), 'error')
    }
  }

  const handleToggleItemActive = async (item) => {
    try {
      await orderService.updateItem(item.id, { aktif: !item.aktif })
      setItems(prev => prev.map(i => i.id === item.id ? { ...i, aktif: !item.aktif } : i))
    } catch (error) {
      console.error(error)
      showToast(t('orders.save_fail'), 'error')
    }
  }

  const handleDeleteItem = (item) => {
    setConfirmModal({
      isOpen: true,
      title: t('orders.delete_item_title'),
      message: item.nama,
      onConfirm: async () => {
        try {
          await orderService.deleteItem(item.id)
          setItems(prev => prev.filter(i => i.id !== item.id))
          setConfirmModal({ isOpen: false })
          showToast(t('orders.deleted'), 'success')
        } catch (error) {
          console.error(error)
          setConfirmModal({ isOpen: false })
          showToast(t('orders.save_fail'), 'error')
        }
      }
    })
  }

  // ================= RENDER =================
  if (isLoading && view === 'sessions' && sessions.length === 0) {
    return (
      <div className="space-y-4 max-w-4xl mx-auto">
        <SkeletonCard />
        <SkeletonList />
      </div>
    )
  }

  return (
    <div className="space-y-4 sm:space-y-5 pb-28 sm:pb-12 max-w-4xl mx-auto">
      <ConfirmModal
        isOpen={confirmModal.isOpen}
        title={confirmModal.title}
        message={confirmModal.message}
        onClose={() => setConfirmModal({ isOpen: false })}
        onConfirm={confirmModal.onConfirm}
      />

      {/* ================= DAFTAR SESI ================= */}
      {view === 'sessions' && (
        <>
          <div className="flex items-center justify-between gap-2">
            <button
              onClick={() => { setShowNewSession(!showNewSession); setNewSessionTime(toLocalInputValue(new Date().toISOString())) }}
              className="bg-savora-orange hover:bg-savora-orangeHover text-white text-xs sm:text-sm font-semibold px-4 py-2.5 rounded-xl flex items-center gap-2 shadow-sm active:scale-95 transition"
            >
              <i className="fa-solid fa-plus"></i> {t('orders.new_session')}
            </button>
            <button
              onClick={() => setView('kelola')}
              className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs sm:text-sm font-semibold px-4 py-2.5 rounded-xl flex items-center gap-2 shadow-sm active:scale-95 transition"
            >
              <i className="fa-solid fa-gear"></i> {t('orders.manage')}
            </button>
          </div>

          {showNewSession && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 space-y-3 animate-fadeIn">
              <div>
                <label className="text-xs font-semibold text-slate-500">{t('orders.session_title_label')}</label>
                <input
                  value={newSessionTitle}
                  onChange={(e) => setNewSessionTitle(e.target.value)}
                  placeholder={t('orders.session_title_ph')}
                  className="mt-1 w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-savora-orange/40 bg-white"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500">{t('orders.session_time_label')}</label>
                <input
                  type="datetime-local"
                  value={newSessionTime}
                  onChange={(e) => setNewSessionTime(e.target.value)}
                  className="mt-1 w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-savora-orange/40 bg-white"
                />
              </div>
              <button
                onClick={handleCreateSession}
                className="w-full bg-savora-orange hover:bg-savora-orangeHover text-white text-sm font-semibold py-2.5 rounded-xl active:scale-[0.98] transition shadow-sm"
              >
                {t('orders.create_session')}
              </button>
            </div>
          )}

          {sessions.length === 0 && !isLoading && (
            <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-8 text-center text-slate-400 text-sm">
              <i className="fa-solid fa-clipboard-list text-3xl mb-2 block text-slate-300"></i>
              {t('orders.empty_sessions')}
            </div>
          )}

          <div className="space-y-3">
            {sessions.map((s) => {
              const st = sessionStats.get(s.id)
              const total = st?.total || 0
              const settled = st?.settled || 0
              const sisa = total - settled
              return (
                <div key={s.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-3.5 sm:p-4 flex items-start gap-3 hover:border-slate-300 transition">
                  <button onClick={() => openSession(s)} className="flex-1 text-left min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-slate-800 text-sm sm:text-base truncate">{s.judul}</span>
                      {s.ditutup
                        ? <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-200 text-slate-600 shrink-0">{t('orders.closed')}</span>
                        : <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 shrink-0">{t('orders.open')}</span>}
                    </div>
                    <div className="text-xs text-slate-500 mt-1 flex items-center gap-1.5 flex-wrap">
                      <span>{new Date(s.waktu).toLocaleString('id-ID', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                      <span>·</span>
                      <span className="font-medium text-slate-600">{st?.children?.size || 0} {t('orders.people_count')}</span>
                    </div>
                    <div className="flex gap-2 mt-2.5 flex-wrap">
                      <span className="text-[11px] font-semibold bg-slate-100 text-slate-600 px-2 py-1 rounded-lg">{t('orders.total')} {formatCurrency(total)}</span>
                      {sisa > 0
                        ? <span className="text-[11px] font-semibold bg-rose-50 text-rose-600 px-2 py-1 rounded-lg">{t('orders.remaining')} {formatCurrency(sisa)}</span>
                        : total > 0 && <span className="text-[11px] font-semibold bg-emerald-50 text-emerald-600 px-2 py-1 rounded-lg">Lunas</span>}
                    </div>
                  </button>
                  <button onClick={() => handleDeleteSession(s)} className="text-slate-300 hover:text-rose-500 p-2 rounded-lg hover:bg-rose-50 transition shrink-0" title={t('orders.delete')}>
                    <i className="fa-solid fa-trash text-xs"></i>
                  </button>
                </div>
              )
            })}
          </div>
        </>
      )}

      {/* ================= DETAIL SESI ================= */}
      {view === 'session' && detail && (
        <>
          {/* Header Sesi */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex items-center gap-3 min-w-0">
              <button
                onClick={backToSessions}
                className="w-9 h-9 shrink-0 flex items-center justify-center bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-slate-600 active:scale-95 transition"
                title="Kembali"
              >
                <i className="fa-solid fa-arrow-left text-sm"></i>
              </button>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-extrabold text-slate-800 text-base sm:text-lg truncate">{detail.session.judul}</h3>
                  {closed ? (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-200 text-slate-600 shrink-0">{t('orders.closed')}</span>
                  ) : (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 shrink-0">{t('orders.open')}</span>
                  )}
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  {new Date(detail.session.waktu).toLocaleString('id-ID', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
              <button
                onClick={handleToggleClosed}
                className={`text-xs font-semibold px-3.5 py-2 rounded-xl shadow-sm active:scale-95 transition flex items-center gap-1.5 ${
                  closed ? 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50' : 'bg-slate-800 hover:bg-slate-700 text-white'
                }`}
              >
                <i className={`fa-solid ${closed ? 'fa-lock-open' : 'fa-lock'} text-[11px]`}></i>
                <span>{closed ? t('orders.reopen') : t('orders.close_session')}</span>
              </button>
            </div>
          </div>

          {/* Kartu Ringkasan Metrik */}
          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            <div className="bg-white rounded-2xl border border-slate-200 p-2.5 sm:p-3 text-center shadow-sm">
              <div className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider">{t('orders.total')}</div>
              <div className="font-extrabold text-slate-800 text-xs sm:text-base mt-0.5 truncate" title={formatCurrency(sessionTotal)}>
                {formatCurrency(sessionTotal)}
              </div>
            </div>
            <div className="bg-white rounded-2xl border border-slate-200 p-2.5 sm:p-3 text-center shadow-sm">
              <div className="text-[10px] sm:text-xs font-bold text-emerald-600 uppercase tracking-wider">{t('orders.paid')}</div>
              <div className="font-extrabold text-emerald-600 text-xs sm:text-base mt-0.5 truncate" title={formatCurrency(sessionSettled)}>
                {formatCurrency(sessionSettled)}
              </div>
            </div>
            <div className="bg-white rounded-2xl border border-slate-200 p-2.5 sm:p-3 text-center shadow-sm">
              <div className="text-[10px] sm:text-xs font-bold text-rose-500 uppercase tracking-wider">{t('orders.remaining')}</div>
              <div className="font-extrabold text-rose-500 text-xs sm:text-base mt-0.5 truncate" title={formatCurrency(sessionTotal - sessionSettled)}>
                {formatCurrency(sessionTotal - sessionSettled)}
              </div>
            </div>
          </div>

          {/* Tab Navigasi Sesi (Jelas & Terbaca di HP) */}
          <div className="grid grid-cols-4 bg-white border border-slate-200 rounded-2xl p-1 shadow-sm gap-1">
            {[
              ['catat', 'fa-pen-to-square', t('orders.tab_record')],
              ['anak', 'fa-user', t('orders.tab_children')],
              ['pembayar', 'fa-wallet', t('orders.tab_payers')],
              ['belanja', 'fa-basket-shopping', t('orders.tab_shopping')]
            ].map(([key, icon, label]) => {
              const active = detailTab === key
              return (
                <button
                  key={key}
                  onClick={() => setDetailTab(key)}
                  className={`flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-1.5 py-2 px-1 rounded-xl text-[11px] sm:text-xs font-semibold transition active:scale-95 ${
                    active
                      ? 'bg-savora-orange text-white shadow-sm'
                      : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
                  }`}
                >
                  <i className={`fa-solid ${icon} text-xs sm:text-sm`}></i>
                  <span className="truncate max-w-full">{label}</span>
                </button>
              )
            })}
          </div>

          {/* ---- TAB CATAT ---- */}
          {detailTab === 'catat' && (
            <div className="space-y-4">
              {/* Pemilihan Anak */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-3.5 sm:p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">{t('orders.pick_child')}</span>
                  {!closed && (
                    <button
                      onClick={() => setShowAddChild(!showAddChild)}
                      className="text-xs font-semibold text-savora-orange hover:text-savora-orangeHover flex items-center gap-1 active:scale-95 transition"
                    >
                      <i className={`fa-solid ${showAddChild ? 'fa-xmark' : 'fa-plus'} text-[11px]`}></i>
                      <span>{showAddChild ? 'Batal' : '+ Anak Baru'}</span>
                    </button>
                  )}
                </div>

                {/* Form Tambah Anak Cepat */}
                {showAddChild && !closed && (
                  <div className="flex gap-2 pt-1 pb-2 border-b border-slate-100 animate-fadeIn">
                    <input
                      value={newPersonName}
                      onChange={(e) => setNewPersonName(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleAddPersonInline()}
                      placeholder={t('orders.new_person_ph')}
                      autoFocus
                      className="flex-1 border border-slate-200 rounded-xl px-3 py-2 text-xs sm:text-sm bg-white focus:outline-none focus:ring-2 focus:ring-savora-orange/40"
                    />
                    <button
                      onClick={handleAddPersonInline}
                      disabled={!newPersonName.trim()}
                      className="px-3.5 py-2 bg-savora-orange hover:bg-savora-orangeHover text-white rounded-xl text-xs font-semibold active:scale-95 transition flex items-center gap-1 shrink-0 disabled:opacity-40"
                    >
                      <i className="fa-solid fa-plus"></i>
                      <span>Simpan</span>
                    </button>
                  </div>
                )}

                {/* Daftar Chip Anak (Swipeable di HP) */}
                <div className="flex gap-2 overflow-x-auto pb-1 pt-0.5 scrollbar-thin">
                  {people.filter(p => (p.aktif || childGroups.some(g => g.childId === p.id)) && isChildRole(p)).map(p => {
                    const isSelected = selectedChildId === p.id
                    const hasLines = childGroups.some(g => g.childId === p.id)
                    return (
                      <button
                        key={p.id}
                        onClick={() => setSelectedChildId(p.id)}
                        className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold shrink-0 transition active:scale-95 flex items-center gap-1.5 ${
                          isSelected
                            ? 'bg-savora-orange text-white shadow-sm'
                            : 'bg-slate-50 border border-slate-200 text-slate-700 hover:border-slate-300'
                        }`}
                      >
                        <span>{p.nama}</span>
                        {hasLines && (
                          <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] ${isSelected ? 'bg-white/20 text-white' : 'bg-emerald-100 text-emerald-700'}`}>
                            <i className="fa-solid fa-check"></i>
                          </span>
                        )}
                      </button>
                    )
                  })}
                  {people.length === 0 && (
                    <div className="text-xs text-slate-400 py-1">Belum ada anak terdaftar. Klik "+ Anak Baru" di atas.</div>
                  )}
                </div>
              </div>

              {/* Detail Pesanan Anak Terpilih */}
              {selectedChildId && (
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 space-y-4">
                  {/* Header Anak & Pilihan Pembayar */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-3 border-b border-slate-100">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-8 h-8 rounded-xl bg-orange-50 text-savora-orange flex items-center justify-center font-bold text-sm shrink-0">
                        <i className="fa-solid fa-user"></i>
                      </div>
                      <div className="min-w-0">
                        <div className="text-[11px] text-slate-400 font-medium">Pesanan untuk:</div>
                        <div className="font-bold text-slate-800 text-base truncate">{nameOf(selectedChildId)}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200 self-start sm:self-auto">
                      <span className="text-xs text-slate-500 font-medium shrink-0">{t('orders.paid_by')}:</span>
                      <select
                        value={effectivePayerId}
                        onChange={(e) => handlePayerChange(e.target.value)}
                        disabled={closed}
                        className="bg-transparent text-xs font-bold text-slate-700 focus:outline-none cursor-pointer max-w-[160px] truncate"
                      >
                        {people.filter(p => (p.aktif || p.id === effectivePayerId) && (isPayerRole(p) || p.id === selectedChildId)).map(p => (
                          <option key={p.id} value={p.id}>{p.nama}{p.id === selectedChildId ? ` (${t('orders.self')})` : ''}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {!closed && (
                    <div className="space-y-3">
                      {/* Pencarian Item */}
                      <div className="relative">
                        <i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs"></i>
                        <input
                          value={itemSearch}
                          onChange={(e) => setItemSearch(e.target.value)}
                          placeholder={t('orders.search_item_ph')}
                          className="w-full border border-slate-200 rounded-xl pl-8 pr-3 py-2 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-savora-orange/40 bg-white"
                        />
                        {itemSearch && (
                          <button onClick={() => setItemSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                            <i className="fa-solid fa-xmark text-xs"></i>
                          </button>
                        )}
                      </div>

                      {/* Katalog Cepat (Tap-Tap) */}
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-48 overflow-y-auto pr-1 scrollbar-thin">
                        {items
                          .filter(i => i.aktif && i.nama.toLowerCase().includes(itemSearch.toLowerCase()))
                          .map(i => (
                            <button
                              key={i.id}
                              onClick={() => handleTapItem(i)}
                              className="p-2.5 rounded-xl bg-slate-50 hover:bg-orange-50/50 border border-slate-200 hover:border-savora-orange text-left active:scale-95 transition flex flex-col justify-between group"
                            >
                              <div className="text-xs font-semibold text-slate-800 group-hover:text-savora-orange line-clamp-1">{i.nama}</div>
                              <div className="text-[11px] font-bold text-slate-500 mt-1 flex items-center justify-between">
                                <span>{formatCurrency(i.harga)}</span>
                                <span className="w-5 h-5 rounded-full bg-slate-200/70 group-hover:bg-savora-orange group-hover:text-white flex items-center justify-center text-[10px] text-slate-600 transition">
                                  <i className="fa-solid fa-plus"></i>
                                </span>
                              </div>
                            </button>
                          ))}
                        {items.filter(i => i.aktif && i.nama.toLowerCase().includes(itemSearch.toLowerCase())).length === 0 && (
                          <div className="col-span-full py-2 text-center text-xs text-slate-400">{t('orders.no_item_match')}</div>
                        )}
                      </div>

                      {/* Tambah Item Baru & Catat Langsung (Responsive Grid Bebas Luapan) */}
                      <div className="grid grid-cols-12 gap-2 pt-1 border-t border-slate-100">
                        <div className="col-span-6 sm:col-span-7">
                          <input
                            value={newItemName}
                            onChange={(e) => setNewItemName(e.target.value)}
                            placeholder={t('orders.new_item_name_ph')}
                            className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-savora-orange/40 bg-white"
                          />
                        </div>
                        <div className="col-span-4 sm:col-span-3">
                          <input
                            value={newItemPrice}
                            onChange={(e) => setNewItemPrice(formatNumberInput(e.target.value))}
                            placeholder={t('orders.price_ph')}
                            inputMode="numeric"
                            className="w-full border border-slate-200 rounded-xl px-2.5 py-2 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-savora-orange/40 bg-white"
                          />
                        </div>
                        <div className="col-span-2 sm:col-span-2">
                          <button
                            onClick={handleAddNewItem}
                            disabled={!newItemName.trim()}
                            className="w-full h-full min-h-[36px] flex items-center justify-center bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-semibold active:scale-95 transition disabled:opacity-40"
                            title="Tambah & Catat"
                          >
                            <i className="fa-solid fa-plus"></i>
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Daftar Item Terpesona (Mobile-Optimized Layout) */}
                  <div className="space-y-2 pt-2">
                    <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Item Terpilih</div>
                    {(selectedGroup?.lines || []).map(line => (
                      <div
                        key={line.id}
                        className="p-3 bg-slate-50/80 rounded-xl border border-slate-200/70 flex flex-col gap-2"
                      >
                        {/* Baris 1: Nama Item & Subtotal */}
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="text-sm font-bold text-slate-800 truncate">{line.nama_snapshot}</div>
                            <div className="flex items-center gap-1.5 text-xs text-slate-400 mt-0.5">
                              <span>@ Rp</span>
                              <input
                                defaultValue={formatNumberInput(line.harga_snapshot)}
                                key={`${line.id}-${line.harga_snapshot}`}
                                onBlur={(e) => handleLinePrice(line, e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && e.target.blur()}
                                disabled={closed}
                                inputMode="numeric"
                                className="w-20 bg-white border border-slate-200 hover:border-slate-300 focus:border-savora-orange rounded px-1.5 py-0.5 text-xs font-semibold text-slate-700 focus:outline-none"
                              />
                            </div>
                          </div>
                          <div className="text-right font-extrabold text-sm text-slate-900 shrink-0">
                            {formatCurrency((Number(line.harga_snapshot) || 0) * (line.qty || 1))}
                          </div>
                        </div>

                        {/* Baris 2: Stepper (-) QTY (+) & Tombol Hapus */}
                        <div className="flex items-center justify-between pt-2 border-t border-slate-200/60">
                          <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-xl p-0.5 shadow-sm">
                            <button
                              onClick={() => handleLineQty(line, -1)}
                              disabled={closed || line.qty <= 1}
                              className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold flex items-center justify-center text-sm disabled:opacity-40 active:scale-95 transition"
                            >
                              −
                            </button>
                            <span className="w-8 text-center text-xs font-bold text-slate-800">{line.qty}</span>
                            <button
                              onClick={() => handleLineQty(line, 1)}
                              disabled={closed}
                              className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold flex items-center justify-center text-sm disabled:opacity-40 active:scale-95 transition"
                            >
                              +
                            </button>
                          </div>

                          {!closed && (
                            <button
                              onClick={() => handleDeleteLine(line)}
                              className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-rose-500 hover:bg-rose-50 active:scale-95 transition"
                              title={t('orders.delete')}
                            >
                              <i className="fa-solid fa-trash text-xs"></i>
                            </button>
                          )}
                        </div>
                      </div>
                    ))}

                    {(!selectedGroup || selectedGroup.lines.length === 0) && (
                      <div className="py-6 text-center text-xs text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                        <i className="fa-solid fa-bag-shopping text-2xl text-slate-300 block mb-1"></i>
                        {t('orders.no_lines_yet')}
                      </div>
                    )}
                  </div>

                  {selectedGroup && selectedGroup.lines.length > 0 && (
                    <div className="flex justify-between items-center pt-3 border-t border-slate-200">
                      <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">{t('orders.total')} {nameOf(selectedChildId)}</span>
                      <span className="font-extrabold text-slate-800 text-base">{formatCurrency(selectedGroup.total)}</span>
                    </div>
                  )}
                </div>
              )}

              {!selectedChildId && (
                <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-8 text-center text-slate-400 text-sm">
                  <i className="fa-solid fa-hand-pointer text-2xl text-slate-300 block mb-2"></i>
                  {t('orders.pick_child_first')}
                </div>
              )}
            </div>
          )}

          {/* ---- TAB PER ANAK ---- */}
          {detailTab === 'anak' && (
            <div className="space-y-3">
              {childGroups.map(g => {
                const settled = Math.min(settledByChild.get(g.childId) || 0, g.total)
                return (
                  <div key={g.childId} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-7 h-7 rounded-lg bg-orange-50 text-savora-orange flex items-center justify-center text-xs font-bold shrink-0">
                          <i className="fa-solid fa-user"></i>
                        </div>
                        <span className="font-bold text-slate-800 text-sm truncate">{nameOf(g.childId)}</span>
                      </div>
                      <StatusBadge status={paymentStatus(g.total, settledByChild.get(g.childId) || 0)} />
                    </div>

                    <div className="space-y-1.5 bg-slate-50/70 p-2.5 rounded-xl border border-slate-100">
                      {g.lines.map(l => (
                        <div key={l.id} className="flex items-center justify-between gap-2 text-xs sm:text-sm">
                          <div className="flex items-center gap-2 min-w-0 flex-1">
                            <button
                              onClick={() => handleToggleLineDelivered(l)}
                              className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 transition ${
                                l.diserahkan ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-slate-300 bg-white text-transparent'
                              }`}
                              title={t('orders.delivered')}
                            >
                              <i className="fa-solid fa-check text-[10px]"></i>
                            </button>
                            <span className={`truncate ${l.diserahkan ? 'text-slate-400 line-through' : 'text-slate-700 font-medium'}`}>
                              {l.nama_snapshot} <span className="text-slate-400 font-normal">×{l.qty}</span>
                            </span>
                          </div>
                          <span className="font-bold text-slate-700 shrink-0">
                            {formatCurrency((Number(l.harga_snapshot) || 0) * (l.qty || 1))}
                          </span>
                        </div>
                      ))}
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-center justify-between pt-2 border-t border-slate-100 gap-1 text-xs">
                      <span className="text-slate-400">
                        {t('orders.paid_by')}: <b className="text-slate-600">{nameOf(g.payerId)}</b>
                        {settled > 0 && settled < g.total && <> · {t('orders.paid')} {formatCurrency(settled)}</>}
                      </span>
                      <div className="flex items-center justify-between sm:justify-end gap-2">
                        <span className="text-slate-400 uppercase text-[10px] font-bold sm:hidden">Total:</span>
                        <span className="font-extrabold text-slate-800 text-sm">{formatCurrency(g.total)}</span>
                      </div>
                    </div>
                  </div>
                )
              })}
              {childGroups.length === 0 && (
                <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-8 text-center text-slate-400 text-sm">{t('orders.no_lines_yet')}</div>
              )}
            </div>
          )}

          {/* ---- TAB PER PEMBAYAR ---- */}
          {detailTab === 'pembayar' && (
            <div className="space-y-3">
              {payerGroups.map(g => {
                const status = g.sisa <= 0 ? 'Lunas' : (g.settled > 0 ? 'Sebagian' : 'Belum')
                return (
                  <div key={g.payerId} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-7 h-7 rounded-lg bg-orange-50 text-savora-orange flex items-center justify-center text-xs shrink-0">
                          <i className="fa-solid fa-wallet"></i>
                        </div>
                        <span className="font-bold text-slate-800 text-sm truncate">{nameOf(g.payerId)}</span>
                      </div>
                      <StatusBadge status={status} />
                    </div>

                    <div className="grid grid-cols-3 gap-2 text-center bg-slate-50 p-2 rounded-xl border border-slate-100">
                      <div>
                        <div className="text-[10px] font-bold text-slate-400 uppercase">{t('orders.total')}</div>
                        <div className="text-xs font-extrabold text-slate-700 mt-0.5 truncate">{formatCurrency(g.total)}</div>
                      </div>
                      <div>
                        <div className="text-[10px] font-bold text-emerald-600 uppercase">{t('orders.paid')}</div>
                        <div className="text-xs font-extrabold text-emerald-600 mt-0.5 truncate">{formatCurrency(g.settled)}</div>
                      </div>
                      <div>
                        <div className="text-[10px] font-bold text-rose-500 uppercase">{t('orders.remaining')}</div>
                        <div className="text-xs font-extrabold text-rose-500 mt-0.5 truncate">{formatCurrency(g.sisa)}</div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      {g.children.map(child => {
                        const childGroup = childGroups.find(cg => cg.childId === child.childId)
                        return (
                          <div key={child.childId} className="p-2.5 bg-slate-50/70 rounded-xl border border-slate-100 space-y-2">
                            <div className="flex items-center gap-2 min-w-0 flex-1">
                              <button
                                onClick={() => handleToggleChildPaid(null, child, child.status !== 'Lunas')}
                                disabled={closed}
                                className={`w-6 h-6 rounded-lg border flex items-center justify-center shrink-0 transition disabled:opacity-40 ${
                                  child.status === 'Lunas' ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-slate-300 bg-white text-transparent'
                                }`}
                                title={t('orders.mark_paid')}
                              >
                                <i className="fa-solid fa-check text-[10px]"></i>
                              </button>
                              <div className="min-w-0 flex-1">
                                <div className="text-xs sm:text-sm font-bold text-slate-800 truncate">{nameOf(child.childId)}</div>
                                <div className="text-[11px] text-slate-400 truncate">
                                  {childGroup?.lines.map(l => `${l.nama_snapshot} ×${l.qty}`).join(', ')}
                                </div>
                                {child.status === 'Sebagian' && (
                                  <div className="text-[10px] text-amber-600 font-semibold">{t('orders.paid')} {formatCurrency(child.settled)} / {formatCurrency(child.total)}</div>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center justify-between sm:justify-end gap-2 pt-1 sm:pt-0 border-t border-slate-200/50 sm:border-t-0">
                              <span className="text-xs sm:text-sm font-extrabold text-slate-800">{formatCurrency(child.total)}</span>
                              <button
                                onClick={() => childGroup && handleToggleChildDelivered(childGroup)}
                                className={`text-[10px] font-bold px-2 py-1 rounded-lg shrink-0 transition ${
                                  childGroup?.semuaDiserahkan ? 'bg-emerald-100 text-emerald-700' : 'bg-white border border-slate-200 text-slate-500'
                                }`}
                              >
                                <i className="fa-solid fa-box-open mr-1"></i>{t('orders.delivered')}
                              </button>
                            </div>
                            {!closed && child.status !== 'Lunas' && (
                              <div className="flex gap-2 pt-1 border-t border-slate-200/50">
                                <div className="relative flex-1">
                                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-semibold">Rp</span>
                                  <input
                                    value={childPayInputs[`${g.payerId}:${child.childId}`] || ''}
                                    onChange={(e) => setChildPayInputs(prev => ({ ...prev, [`${g.payerId}:${child.childId}`]: formatNumberInput(e.target.value) }))}
                                    placeholder={t('orders.child_payment_ph')}
                                    inputMode="numeric"
                                    className="w-full border border-slate-200 rounded-xl pl-9 pr-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-savora-orange/40 bg-white"
                                  />
                                </div>
                                <button
                                  onClick={() => handleRecordChildPayment(g.payerId, child.childId)}
                                  className="px-3 py-1.5 bg-slate-800 text-white rounded-xl text-xs font-semibold active:scale-95 transition shrink-0"
                                >
                                  {t('orders.record')}
                                </button>
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>

                    {!closed && g.sisa > 0 && (
                      <div className="space-y-2 pt-2 border-t border-slate-100">
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-semibold">Rp</span>
                          <input
                            value={payInputs[g.payerId] || ''}
                            onChange={(e) => setPayInputs(prev => ({ ...prev, [g.payerId]: formatNumberInput(e.target.value) }))}
                            placeholder={t('orders.record_payment_ph')}
                            inputMode="numeric"
                            className="w-full border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-savora-orange/40 bg-white"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            onClick={() => handleRecordPayment(g.payerId)}
                            className="py-2 px-3 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-semibold active:scale-95 transition text-center shadow-sm"
                          >
                            {t('orders.record')}
                          </button>
                          <button
                            onClick={() => handleSettleAll(g)}
                            className="py-2 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold active:scale-95 transition text-center shadow-sm"
                          >
                            {t('orders.settle_all')}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
              {payerGroups.length === 0 && (
                <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-8 text-center text-slate-400 text-sm">{t('orders.no_lines_yet')}</div>
              )}
            </div>
          )}

          {/* ---- TAB BELANJA ---- */}
          {detailTab === 'belanja' && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
              <div className="divide-y divide-slate-100">
                {shoppingList.map(row => (
                  <div key={row.nama} className="py-2.5 flex items-center gap-3">
                    <span className="w-9 h-8 flex items-center justify-center font-extrabold text-savora-orange bg-orange-50 rounded-xl text-xs shrink-0">
                      ×{row.qty}
                    </span>
                    <span className="flex-1 text-xs sm:text-sm font-semibold text-slate-700 truncate">{row.nama}</span>
                    <span className="text-xs sm:text-sm font-extrabold text-slate-800 shrink-0">{formatCurrency(row.amount)}</span>
                  </div>
                ))}
                {shoppingList.length === 0 && (
                  <div className="py-6 text-center text-xs text-slate-400">{t('orders.no_lines_yet')}</div>
                )}
              </div>
              {shoppingList.length > 0 && (
                <div className="flex justify-between items-center pt-3 mt-1 border-t border-slate-200">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">{t('orders.total')}</span>
                  <span className="font-extrabold text-slate-800 text-base">{formatCurrency(sessionTotal)}</span>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* ================= KELOLA (ORANG & ITEM) ================= */}
      {view === 'kelola' && (
        <>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setView('sessions')}
              className="w-9 h-9 shrink-0 flex items-center justify-center bg-white hover:bg-slate-50 border border-slate-200 rounded-xl text-slate-600 shadow-sm active:scale-95 transition"
              title="Kembali"
            >
              <i className="fa-solid fa-arrow-left text-sm"></i>
            </button>
            <h3 className="font-extrabold text-slate-800 text-lg">{t('orders.manage')}</h3>
          </div>

          <div className="grid grid-cols-2 bg-white border border-slate-200 rounded-2xl p-1 shadow-sm gap-1">
            {[
              ['orang', 'fa-users', t('orders.people')],
              ['item', 'fa-tags', t('orders.items')]
            ].map(([key, icon, label]) => (
              <button
                key={key}
                onClick={() => setKelolaTab(key)}
                className={`flex items-center justify-center gap-2 py-2 rounded-xl text-xs sm:text-sm font-semibold transition active:scale-95 ${
                  kelolaTab === key ? 'bg-savora-orange text-white shadow-sm' : 'text-slate-500 hover:bg-slate-50'
                }`}
              >
                <i className={`fa-solid ${icon}`}></i>
                <span>{label}</span>
              </button>
            ))}
          </div>

          {/* Tab Kelola Orang */}
          {kelolaTab === 'orang' && (
            <div className="space-y-3">
              {/* Form Tambah Orang (Responsive Grid Bebas Terpotong) */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-3.5 sm:p-4">
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                  <div className="sm:col-span-4">
                    <input
                      value={personForm.nama}
                      onChange={(e) => setPersonForm({ ...personForm, nama: e.target.value })}
                      placeholder={t('orders.person_name_ph')}
                      className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-savora-orange/40 bg-white"
                    />
                  </div>
                  <div className="sm:col-span-3">
                    <input
                      value={personForm.catatan}
                      onChange={(e) => setPersonForm({ ...personForm, catatan: e.target.value })}
                      placeholder={t('orders.person_note_ph')}
                      className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-savora-orange/40 bg-white"
                    />
                  </div>
                  <div className="sm:col-span-3">
                    <select
                      value={personForm.peran}
                      onChange={(e) => setPersonForm({ ...personForm, peran: e.target.value })}
                      className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-savora-orange/40 bg-white"
                    >
                      <option value="santri">{t('orders.role_santri')}</option>
                      <option value="pembayar">{t('orders.role_payer')}</option>
                      <option value="keduanya">{t('orders.role_both')}</option>
                    </select>
                  </div>
                  <div className="sm:col-span-2">
                    <button
                      onClick={handleAddPerson}
                      disabled={!personForm.nama.trim()}
                      className="w-full py-2.5 bg-savora-orange hover:bg-savora-orangeHover text-white rounded-xl text-xs sm:text-sm font-semibold active:scale-95 transition flex items-center justify-center gap-1.5 shadow-sm disabled:opacity-40"
                    >
                      <i className="fa-solid fa-plus"></i>
                      <span>Tambah</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Daftar Orang */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm divide-y divide-slate-100 overflow-hidden">
                {people.map(p => (
                  <div key={p.id} className="p-3 sm:p-3.5 flex items-center gap-2">
                    {editPerson?.id === p.id ? (
                      <div className="flex flex-col sm:flex-row gap-2 w-full">
                        <div className="flex-1 flex gap-2">
                          <input
                            value={editPerson.nama}
                            onChange={(e) => setEditPerson({ ...editPerson, nama: e.target.value })}
                            className="flex-1 border border-slate-200 rounded-xl px-3 py-1.5 text-xs sm:text-sm bg-white"
                            placeholder="Nama"
                          />
                          <input
                            value={editPerson.catatan || ''}
                            onChange={(e) => setEditPerson({ ...editPerson, catatan: e.target.value })}
                            placeholder={t('orders.person_note_ph')}
                            className="w-28 sm:w-36 border border-slate-200 rounded-xl px-3 py-1.5 text-xs sm:text-sm bg-white"
                          />
                          <select
                            value={editPerson.peran || 'keduanya'}
                            onChange={(e) => setEditPerson({ ...editPerson, peran: e.target.value })}
                            className="border border-slate-200 rounded-xl px-2 py-1.5 text-xs sm:text-sm bg-white"
                          >
                            <option value="santri">{t('orders.role_santri')}</option>
                            <option value="pembayar">{t('orders.role_payer')}</option>
                            <option value="keduanya">{t('orders.role_both')}</option>
                          </select>
                        </div>
                        <div className="flex items-center justify-end gap-2">
                          <button onClick={handleSavePerson} className="px-3 py-1.5 bg-emerald-600 text-white rounded-xl text-xs font-semibold flex items-center gap-1 active:scale-95 shadow-sm">
                            <i className="fa-solid fa-check"></i> Simpan
                          </button>
                          <button onClick={() => setEditPerson(null)} className="px-3 py-1.5 bg-slate-100 text-slate-600 rounded-xl text-xs font-semibold active:scale-95">
                            Batal
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="flex-1 min-w-0">
                          <span className={`text-xs sm:text-sm font-semibold ${p.aktif ? 'text-slate-800' : 'text-slate-400 line-through'}`}>{p.nama}</span>
                          <span className={`text-[10px] font-bold ml-2 px-1.5 py-0.5 rounded-md ${
                            roleOf(p) === 'santri' ? 'bg-sky-100 text-sky-700'
                            : roleOf(p) === 'pembayar' ? 'bg-violet-100 text-violet-700'
                            : 'bg-slate-100 text-slate-600'
                          }`}>{t(roleOf(p) === 'pembayar' ? 'orders.role_payer' : roleOf(p) === 'santri' ? 'orders.role_santri' : 'orders.role_both')}</span>
                          {p.catatan && <span className="text-[11px] text-slate-400 ml-2 bg-slate-100 px-1.5 py-0.5 rounded-md">({p.catatan})</span>}
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => setEditPerson({ id: p.id, nama: p.nama, catatan: p.catatan || '', peran: p.peran || 'keduanya' })}
                            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
                            title="Edit"
                          >
                            <i className="fa-solid fa-pen text-xs"></i>
                          </button>
                          <button
                            onClick={() => handleTogglePersonActive(p)}
                            className={`text-[10px] font-bold px-2 py-1 rounded-lg ${p.aktif ? 'bg-slate-100 text-slate-600 hover:bg-slate-200' : 'bg-amber-100 text-amber-700 hover:bg-amber-200'}`}
                          >
                            {p.aktif ? t('orders.deactivate') : t('orders.activate')}
                          </button>
                          <button
                            onClick={() => handleDeletePerson(p)}
                            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-300 hover:text-rose-500 hover:bg-rose-50 transition"
                            title={t('orders.delete')}
                          >
                            <i className="fa-solid fa-trash text-xs"></i>
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                ))}
                {people.length === 0 && <div className="p-8 text-center text-xs text-slate-400">{t('orders.people_empty')}</div>}
              </div>
            </div>
          )}

          {/* Tab Kelola Item */}
          {kelolaTab === 'item' && (
            <div className="space-y-3">
              {/* Form Tambah Item (Responsive Grid) */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-3.5 sm:p-4">
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                  <div className="sm:col-span-5">
                    <input
                      value={itemForm.nama}
                      onChange={(e) => setItemForm({ ...itemForm, nama: e.target.value })}
                      placeholder={t('orders.new_item_name_ph')}
                      className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-savora-orange/40 bg-white"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2 sm:col-span-5">
                    <input
                      value={itemForm.harga}
                      onChange={(e) => setItemForm({ ...itemForm, harga: formatNumberInput(e.target.value) })}
                      placeholder={t('orders.price_ph')}
                      inputMode="numeric"
                      className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-savora-orange/40 bg-white"
                    />
                    <select
                      value={itemForm.jenis}
                      onChange={(e) => setItemForm({ ...itemForm, jenis: e.target.value })}
                      className="w-full border border-slate-200 rounded-xl px-2 py-2.5 text-xs sm:text-sm bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-savora-orange/40"
                    >
                      {JENIS.map(j => <option key={j} value={j}>{t(`orders.jenis.${j}`)}</option>)}
                    </select>
                  </div>
                  <div className="sm:col-span-2">
                    <button
                      onClick={handleAddItem}
                      disabled={!itemForm.nama.trim()}
                      className="w-full py-2.5 bg-savora-orange hover:bg-savora-orangeHover text-white rounded-xl text-xs sm:text-sm font-semibold active:scale-95 transition flex items-center justify-center gap-1.5 shadow-sm disabled:opacity-40"
                    >
                      <i className="fa-solid fa-plus"></i>
                      <span>Tambah</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Daftar Item */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm divide-y divide-slate-100 overflow-hidden">
                {items.map(i => (
                  <div key={i.id} className="p-3 sm:p-3.5 flex items-center gap-2">
                    {editItem?.id === i.id ? (
                      <div className="flex flex-col sm:flex-row gap-2 w-full">
                        <div className="flex-1 grid grid-cols-1 sm:grid-cols-12 gap-2">
                          <input
                            value={editItem.nama}
                            onChange={(e) => setEditItem({ ...editItem, nama: e.target.value })}
                            className="sm:col-span-5 border border-slate-200 rounded-xl px-3 py-1.5 text-xs sm:text-sm bg-white"
                            placeholder="Nama item"
                          />
                          <input
                            value={editItem.harga}
                            onChange={(e) => setEditItem({ ...editItem, harga: formatNumberInput(e.target.value) })}
                            inputMode="numeric"
                            className="sm:col-span-4 border border-slate-200 rounded-xl px-3 py-1.5 text-xs sm:text-sm bg-white"
                            placeholder="Harga"
                          />
                          <select
                            value={editItem.jenis}
                            onChange={(e) => setEditItem({ ...editItem, jenis: e.target.value })}
                            className="sm:col-span-3 border border-slate-200 rounded-xl px-2 py-1.5 text-xs sm:text-sm bg-white"
                          >
                            {JENIS.map(j => <option key={j} value={j}>{t(`orders.jenis.${j}`)}</option>)}
                          </select>
                        </div>
                        <div className="flex items-center justify-end gap-2">
                          <button onClick={handleSaveItem} className="px-3 py-1.5 bg-emerald-600 text-white rounded-xl text-xs font-semibold flex items-center gap-1 active:scale-95 shadow-sm">
                            <i className="fa-solid fa-check"></i> Simpan
                          </button>
                          <button onClick={() => setEditItem(null)} className="px-3 py-1.5 bg-slate-100 text-slate-600 rounded-xl text-xs font-semibold active:scale-95">
                            Batal
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`text-xs sm:text-sm font-semibold ${i.aktif ? 'text-slate-800' : 'text-slate-400 line-through'}`}>{i.nama}</span>
                            <span className="text-[10px] font-medium text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-md">{t(`orders.jenis.${i.jenis}`)}</span>
                          </div>
                          <div className="text-xs font-extrabold text-savora-orange mt-0.5">{formatCurrency(i.harga)}</div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => setEditItem({ id: i.id, nama: i.nama, harga: formatNumberInput(i.harga), jenis: i.jenis })}
                            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
                            title="Edit"
                          >
                            <i className="fa-solid fa-pen text-xs"></i>
                          </button>
                          <button
                            onClick={() => handleToggleItemActive(i)}
                            className={`text-[10px] font-bold px-2 py-1 rounded-lg ${i.aktif ? 'bg-slate-100 text-slate-600 hover:bg-slate-200' : 'bg-amber-100 text-amber-700 hover:bg-amber-200'}`}
                          >
                            {i.aktif ? t('orders.deactivate') : t('orders.activate')}
                          </button>
                          <button
                            onClick={() => handleDeleteItem(i)}
                            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-300 hover:text-rose-500 hover:bg-rose-50 transition"
                            title={t('orders.delete')}
                          >
                            <i className="fa-solid fa-trash text-xs"></i>
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                ))}
                {items.length === 0 && <div className="p-8 text-center text-xs text-slate-400">{t('orders.items_empty')}</div>}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
