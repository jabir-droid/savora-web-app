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
    Lunas: 'bg-emerald-100 text-emerald-700',
    Sebagian: 'bg-amber-100 text-amber-700',
    Belum: 'bg-rose-100 text-rose-700'
  }
  return (
    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${styles[status] || styles.Belum}`}>
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

  // Form kelola
  const [personForm, setPersonForm] = useState({ nama: '', catatan: '' })
  const [itemForm, setItemForm] = useState({ nama: '', harga: '', jenis: 'Makanan' })
  const [editPerson, setEditPerson] = useState(null) // { id, nama, catatan }
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
      const p = await orderService.addPerson({ nama: newPersonName })
      setPeople(prev => [...prev, p].sort((a, b) => a.nama.localeCompare(b.nama)))
      setNewPersonName('')
      setSelectedChildId(p.id)
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
        payer_id: selectedPayerId
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
    try {
      await orderService.setPayerForChild(detail.session.id, selectedChildId, payerId)
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
      setPersonForm({ nama: '', catatan: '' })
      showToast(t('orders.saved'), 'success')
    } catch (error) {
      console.error(error)
      showToast(t('orders.save_fail'), 'error')
    }
  }

  const handleSavePerson = async () => {
    try {
      await orderService.updatePerson(editPerson.id, { nama: editPerson.nama.trim(), catatan: editPerson.catatan?.trim() || null })
      setPeople(prev => prev.map(p => p.id === editPerson.id ? { ...p, nama: editPerson.nama, catatan: editPerson.catatan || null } : p))
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
      <div className="space-y-4">
        <SkeletonCard />
        <SkeletonList />
      </div>
    )
  }

  return (
    <div className="space-y-5 pb-4">
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
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => { setShowNewSession(!showNewSession); setNewSessionTime(toLocalInputValue(new Date().toISOString())) }}
              className="bg-savora-orange hover:bg-savora-orangeHover text-white text-sm font-semibold px-4 py-2.5 rounded-xl flex items-center gap-2 shadow-sm active:scale-95 transition"
            >
              <i className="fa-solid fa-plus"></i> {t('orders.new_session')}
            </button>
            <button
              onClick={() => setView('kelola')}
              className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-sm font-semibold px-4 py-2.5 rounded-xl flex items-center gap-2 shadow-sm transition"
            >
              <i className="fa-solid fa-gear"></i> {t('orders.manage')}
            </button>
          </div>

          {showNewSession && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-500">{t('orders.session_title_label')}</label>
                <input
                  value={newSessionTitle}
                  onChange={(e) => setNewSessionTitle(e.target.value)}
                  placeholder={t('orders.session_title_ph')}
                  className="mt-1 w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-savora-orange/40"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500">{t('orders.session_time_label')}</label>
                <input
                  type="datetime-local"
                  value={newSessionTime}
                  onChange={(e) => setNewSessionTime(e.target.value)}
                  className="mt-1 w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-savora-orange/40"
                />
              </div>
              <button
                onClick={handleCreateSession}
                className="w-full bg-savora-orange hover:bg-savora-orangeHover text-white text-sm font-semibold py-2.5 rounded-xl active:scale-[0.98] transition"
              >
                {t('orders.create_session')}
              </button>
            </div>
          )}

          {sessions.length === 0 && !isLoading && (
            <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-8 text-center text-slate-400 text-sm">
              <i className="fa-solid fa-clipboard-list text-3xl mb-2 block"></i>
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
                <div key={s.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 flex items-start gap-3">
                  <button onClick={() => openSession(s)} className="flex-1 text-left">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-slate-800 text-sm">{s.judul}</span>
                      {s.ditutup
                        ? <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-200 text-slate-600">{t('orders.closed')}</span>
                        : <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">{t('orders.open')}</span>}
                    </div>
                    <div className="text-xs text-slate-500 mt-1">
                      {new Date(s.waktu).toLocaleString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}
                      {' · '}{st?.children?.size || 0} {t('orders.people_count')}
                    </div>
                    <div className="flex gap-2 mt-2 flex-wrap">
                      <span className="text-[11px] font-semibold bg-slate-100 text-slate-600 px-2 py-1 rounded-lg">{t('orders.total')} {formatCurrency(total)}</span>
                      {sisa > 0
                        ? <span className="text-[11px] font-semibold bg-rose-50 text-rose-600 px-2 py-1 rounded-lg">{t('orders.remaining')} {formatCurrency(sisa)}</span>
                        : total > 0 && <span className="text-[11px] font-semibold bg-emerald-50 text-emerald-600 px-2 py-1 rounded-lg">Lunas</span>}
                    </div>
                  </button>
                  <button onClick={() => handleDeleteSession(s)} className="text-slate-300 hover:text-rose-500 p-1 transition" title={t('orders.delete')}>
                    <i className="fa-solid fa-trash"></i>
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
          <div className="flex items-start gap-3">
            <button onClick={backToSessions} className="p-2 bg-white border border-slate-200 rounded-xl text-slate-600 shadow-sm">
              <i className="fa-solid fa-arrow-left"></i>
            </button>
            <div className="flex-1 min-w-0">
              <h3 className="font-extrabold text-slate-800 truncate">{detail.session.judul}</h3>
              <p className="text-xs text-slate-500">
                {new Date(detail.session.waktu).toLocaleString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
            <button
              onClick={handleToggleClosed}
              className={`text-xs font-semibold px-3 py-2 rounded-xl shadow-sm transition ${closed ? 'bg-white border border-slate-200 text-slate-600' : 'bg-slate-800 text-white'}`}
            >
              {closed ? t('orders.reopen') : t('orders.close_session')}
            </button>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div className="bg-white rounded-2xl border border-slate-200 p-3 text-center">
              <div className="text-[10px] font-bold text-slate-400 uppercase">{t('orders.total')}</div>
              <div className="font-extrabold text-slate-800 text-sm mt-0.5">{formatCurrency(sessionTotal)}</div>
            </div>
            <div className="bg-white rounded-2xl border border-slate-200 p-3 text-center">
              <div className="text-[10px] font-bold text-slate-400 uppercase">{t('orders.paid')}</div>
              <div className="font-extrabold text-emerald-600 text-sm mt-0.5">{formatCurrency(sessionSettled)}</div>
            </div>
            <div className="bg-white rounded-2xl border border-slate-200 p-3 text-center">
              <div className="text-[10px] font-bold text-slate-400 uppercase">{t('orders.remaining')}</div>
              <div className="font-extrabold text-rose-500 text-sm mt-0.5">{formatCurrency(sessionTotal - sessionSettled)}</div>
            </div>
          </div>

          <div className="flex bg-white border border-slate-200 rounded-xl p-1 shadow-sm">
            {[
              ['catat', 'fa-pen-to-square', t('orders.tab_record')],
              ['anak', 'fa-user', t('orders.tab_children')],
              ['pembayar', 'fa-wallet', t('orders.tab_payers')],
              ['belanja', 'fa-basket-shopping', t('orders.tab_shopping')]
            ].map(([key, icon, label]) => (
              <button
                key={key}
                onClick={() => setDetailTab(key)}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition ${detailTab === key ? 'bg-savora-orange text-white shadow' : 'text-slate-500 hover:bg-slate-50'}`}
              >
                <i className={`fa-solid ${icon}`}></i><span className="hidden sm:inline">{label}</span>
              </button>
            ))}
          </div>

          {/* ---- TAB CATAT ---- */}
          {detailTab === 'catat' && (
            <div className="space-y-4">
              <div>
                <div className="text-xs font-bold text-slate-500 mb-2">{t('orders.pick_child')}</div>
                <div className="flex flex-wrap gap-2">
                  {people.filter(p => p.aktif || childGroups.some(g => g.childId === p.id)).map(p => (
                    <button
                      key={p.id}
                      onClick={() => setSelectedChildId(p.id)}
                      className={`px-3 py-2 rounded-xl text-sm font-semibold transition active:scale-95 ${selectedChildId === p.id ? 'bg-savora-orange text-white shadow' : 'bg-white border border-slate-200 text-slate-600'}`}
                    >
                      {p.nama}
                      {childGroups.some(g => g.childId === p.id) && <i className="fa-solid fa-check ml-1.5 text-[10px]"></i>}
                    </button>
                  ))}
                </div>
                {!closed && (
                  <div className="flex gap-2 mt-2">
                    <input
                      value={newPersonName}
                      onChange={(e) => setNewPersonName(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleAddPersonInline()}
                      placeholder={t('orders.new_person_ph')}
                      className="flex-1 border border-slate-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-savora-orange/40"
                    />
                    <button onClick={handleAddPersonInline} className="px-3 py-2 bg-slate-800 text-white rounded-xl text-sm font-semibold active:scale-95 transition">
                      <i className="fa-solid fa-user-plus"></i>
                    </button>
                  </div>
                )}
              </div>

              {selectedChildId && (
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 space-y-4">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span className="font-bold text-slate-800">{nameOf(selectedChildId)}</span>
                    <label className="flex items-center gap-2 text-xs text-slate-500 font-semibold">
                      {t('orders.paid_by')}
                      <select
                        value={selectedPayerId}
                        onChange={(e) => handlePayerChange(e.target.value)}
                        disabled={closed}
                        className="border border-slate-200 rounded-lg px-2 py-1.5 text-xs font-semibold text-slate-700 bg-white"
                      >
                        {people.filter(p => p.aktif || p.id === selectedPayerId).map(p => (
                          <option key={p.id} value={p.id}>{p.nama}{p.id === selectedChildId ? ` (${t('orders.self')})` : ''}</option>
                        ))}
                      </select>
                    </label>
                  </div>

                  {!closed && (
                    <>
                      <div className="relative">
                        <i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-slate-300 text-sm"></i>
                        <input
                          value={itemSearch}
                          onChange={(e) => setItemSearch(e.target.value)}
                          placeholder={t('orders.search_item_ph')}
                          className="w-full border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-savora-orange/40"
                        />
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {items
                          .filter(i => i.aktif && i.nama.toLowerCase().includes(itemSearch.toLowerCase()))
                          .map(i => (
                            <button
                              key={i.id}
                              onClick={() => handleTapItem(i)}
                              className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 hover:border-savora-orange text-left active:scale-95 transition"
                            >
                              <span className="block text-sm font-semibold text-slate-700">{i.nama}</span>
                              <span className="block text-[11px] text-slate-400">{formatCurrency(i.harga)}</span>
                            </button>
                          ))}
                        {items.filter(i => i.aktif && i.nama.toLowerCase().includes(itemSearch.toLowerCase())).length === 0 && (
                          <span className="text-xs text-slate-400">{t('orders.no_item_match')}</span>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <input
                          value={newItemName}
                          onChange={(e) => setNewItemName(e.target.value)}
                          placeholder={t('orders.new_item_name_ph')}
                          className="flex-1 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-savora-orange/40"
                        />
                        <input
                          value={newItemPrice}
                          onChange={(e) => setNewItemPrice(formatNumberInput(e.target.value))}
                          placeholder={t('orders.price_ph')}
                          inputMode="numeric"
                          className="w-28 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-savora-orange/40"
                        />
                        <button onClick={handleAddNewItem} className="px-3 py-2 bg-slate-800 text-white rounded-xl text-sm font-semibold active:scale-95 transition">
                          <i className="fa-solid fa-plus"></i>
                        </button>
                      </div>
                    </>
                  )}

                  <div className="divide-y divide-slate-100">
                    {(selectedGroup?.lines || []).map(line => (
                      <div key={line.id} className="py-2.5 flex items-center gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-semibold text-slate-700 truncate">{line.nama_snapshot}</div>
                          <div className="flex items-center gap-1 text-xs text-slate-400">
                            <span>Rp</span>
                            <input
                              defaultValue={formatNumberInput(line.harga_snapshot)}
                              key={`${line.id}-${line.harga_snapshot}`}
                              onBlur={(e) => handleLinePrice(line, e.target.value)}
                              onKeyDown={(e) => e.key === 'Enter' && e.target.blur()}
                              disabled={closed}
                              inputMode="numeric"
                              className="w-20 border border-transparent hover:border-slate-200 focus:border-savora-orange rounded px-1 py-0.5 text-xs text-slate-500 focus:outline-none"
                            />
                            <span>/ {t('orders.per_item')}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <button onClick={() => handleLineQty(line, -1)} disabled={closed} className="w-7 h-7 rounded-lg bg-slate-100 text-slate-600 font-bold disabled:opacity-40">−</button>
                          <span className="w-6 text-center text-sm font-bold text-slate-700">{line.qty}</span>
                          <button onClick={() => handleLineQty(line, 1)} disabled={closed} className="w-7 h-7 rounded-lg bg-slate-100 text-slate-600 font-bold disabled:opacity-40">+</button>
                        </div>
                        <div className="w-20 text-right text-sm font-bold text-slate-700">
                          {formatCurrency((Number(line.harga_snapshot) || 0) * (line.qty || 1))}
                        </div>
                        {!closed && (
                          <button onClick={() => handleDeleteLine(line)} className="text-slate-300 hover:text-rose-500 p-1 transition">
                            <i className="fa-solid fa-trash text-xs"></i>
                          </button>
                        )}
                      </div>
                    ))}
                    {(!selectedGroup || selectedGroup.lines.length === 0) && (
                      <div className="py-4 text-center text-xs text-slate-400">{t('orders.no_lines_yet')}</div>
                    )}
                  </div>

                  {selectedGroup && (
                    <div className="flex justify-between items-center pt-1 border-t border-slate-100">
                      <span className="text-xs font-bold text-slate-400 uppercase">{t('orders.total')}</span>
                      <span className="font-extrabold text-slate-800">{formatCurrency(selectedGroup.total)}</span>
                    </div>
                  )}
                </div>
              )}

              {!selectedChildId && (
                <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-6 text-center text-slate-400 text-sm">
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
                  <div key={g.childId} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <span className="font-bold text-slate-800 text-sm">{nameOf(g.childId)}</span>
                      <StatusBadge status={paymentStatus(g.total, settledByChild.get(g.childId) || 0)} />
                    </div>
                    <div className="mt-2 space-y-1">
                      {g.lines.map(l => (
                        <div key={l.id} className="flex items-center gap-2 text-sm">
                          <button
                            onClick={() => handleToggleLineDelivered(l)}
                            className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 transition ${l.diserahkan ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-slate-300 text-transparent'}`}
                            title={t('orders.delivered')}
                          >
                            <i className="fa-solid fa-check text-[10px]"></i>
                          </button>
                          <span className={`flex-1 ${l.diserahkan ? 'text-slate-400 line-through' : 'text-slate-600'}`}>
                            {l.nama_snapshot} ×{l.qty}
                          </span>
                          <span className="font-semibold text-slate-700">{formatCurrency((Number(l.harga_snapshot) || 0) * (l.qty || 1))}</span>
                        </div>
                      ))}
                    </div>
                    <div className="flex justify-between items-center mt-3 pt-2 border-t border-slate-100 text-xs">
                      <span className="text-slate-400">
                        {t('orders.paid_by')}: <b className="text-slate-600">{nameOf(g.payerId)}</b>
                        {settled > 0 && settled < g.total && <> · {t('orders.paid')} {formatCurrency(settled)}</>}
                      </span>
                      <span className="font-extrabold text-slate-800 text-sm">{formatCurrency(g.total)}</span>
                    </div>
                  </div>
                )
              })}
              {childGroups.length === 0 && (
                <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-6 text-center text-slate-400 text-sm">{t('orders.no_lines_yet')}</div>
              )}
            </div>
          )}

          {/* ---- TAB PER PEMBAYAR ---- */}
          {detailTab === 'pembayar' && (
            <div className="space-y-3">
              {payerGroups.map(g => {
                const status = g.sisa <= 0 ? 'Lunas' : (g.settled > 0 ? 'Sebagian' : 'Belum')
                return (
                  <div key={g.payerId} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <span className="font-bold text-slate-800 text-sm">
                        <i className="fa-solid fa-wallet text-slate-400 mr-2"></i>{nameOf(g.payerId)}
                      </span>
                      <StatusBadge status={status} />
                    </div>
                    <div className="flex gap-2 mt-2 flex-wrap text-[11px] font-semibold">
                      <span className="bg-slate-100 text-slate-600 px-2 py-1 rounded-lg">{t('orders.total')} {formatCurrency(g.total)}</span>
                      <span className="bg-emerald-50 text-emerald-600 px-2 py-1 rounded-lg">{t('orders.paid')} {formatCurrency(g.settled)}</span>
                      {g.sisa > 0 && <span className="bg-rose-50 text-rose-600 px-2 py-1 rounded-lg">{t('orders.remaining')} {formatCurrency(g.sisa)}</span>}
                    </div>

                    <div className="mt-3 space-y-2">
                      {g.children.map(child => {
                        const childGroup = childGroups.find(cg => cg.childId === child.childId)
                        return (
                          <div key={child.childId} className="flex items-center gap-2 bg-slate-50 rounded-xl px-3 py-2">
                            <button
                              onClick={() => handleToggleChildPaid(null, child, child.status !== 'Lunas')}
                              disabled={closed}
                              className={`w-6 h-6 rounded-lg border flex items-center justify-center shrink-0 transition disabled:opacity-40 ${child.status === 'Lunas' ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-slate-300 bg-white text-transparent'}`}
                              title={t('orders.mark_paid')}
                            >
                              <i className="fa-solid fa-check text-[11px]"></i>
                            </button>
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-semibold text-slate-700 truncate">{nameOf(child.childId)}</div>
                              <div className="text-[11px] text-slate-400 truncate">
                                {childGroup?.lines.map(l => `${l.nama_snapshot} ×${l.qty}`).join(', ')}
                              </div>
                              {child.status === 'Sebagian' && (
                                <div className="text-[11px] text-amber-600 font-semibold">{t('orders.paid')} {formatCurrency(child.settled)} / {formatCurrency(child.total)}</div>
                              )}
                            </div>
                            <span className="text-sm font-bold text-slate-700">{formatCurrency(child.total)}</span>
                            <button
                              onClick={() => childGroup && handleToggleChildDelivered(childGroup)}
                              className={`text-[10px] font-bold px-2 py-1.5 rounded-lg shrink-0 transition ${childGroup?.semuaDiserahkan ? 'bg-emerald-100 text-emerald-700' : 'bg-white border border-slate-200 text-slate-500'}`}
                            >
                              <i className="fa-solid fa-box-open mr-1"></i>{t('orders.delivered')}
                            </button>
                          </div>
                        )
                      })}
                    </div>

                    {!closed && g.sisa > 0 && (
                      <div className="flex gap-2 mt-3">
                        <div className="relative flex-1">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-semibold">Rp</span>
                          <input
                            value={payInputs[g.payerId] || ''}
                            onChange={(e) => setPayInputs(prev => ({ ...prev, [g.payerId]: formatNumberInput(e.target.value) }))}
                            placeholder={t('orders.record_payment_ph')}
                            inputMode="numeric"
                            className="w-full border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-savora-orange/40"
                          />
                        </div>
                        <button
                          onClick={() => handleRecordPayment(g.payerId)}
                          className="px-3 py-2 bg-slate-800 text-white rounded-xl text-sm font-semibold active:scale-95 transition"
                        >
                          {t('orders.record')}
                        </button>
                        <button
                          onClick={() => handleSettleAll(g)}
                          className="px-3 py-2 bg-emerald-600 text-white rounded-xl text-sm font-semibold active:scale-95 transition"
                        >
                          {t('orders.settle_all')}
                        </button>
                      </div>
                    )}
                  </div>
                )
              })}
              {payerGroups.length === 0 && (
                <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-6 text-center text-slate-400 text-sm">{t('orders.no_lines_yet')}</div>
              )}
            </div>
          )}

          {/* ---- TAB BELANJA ---- */}
          {detailTab === 'belanja' && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
              <div className="divide-y divide-slate-100">
                {shoppingList.map(row => (
                  <div key={row.nama} className="py-2.5 flex items-center gap-3">
                    <span className="w-10 text-center font-extrabold text-savora-orange bg-orange-50 rounded-lg py-1 text-sm">×{row.qty}</span>
                    <span className="flex-1 text-sm font-semibold text-slate-700">{row.nama}</span>
                    <span className="text-sm font-bold text-slate-700">{formatCurrency(row.amount)}</span>
                  </div>
                ))}
                {shoppingList.length === 0 && (
                  <div className="py-4 text-center text-xs text-slate-400">{t('orders.no_lines_yet')}</div>
                )}
              </div>
              {shoppingList.length > 0 && (
                <div className="flex justify-between items-center pt-3 mt-1 border-t border-slate-200">
                  <span className="text-xs font-bold text-slate-400 uppercase">{t('orders.total')}</span>
                  <span className="font-extrabold text-slate-800">{formatCurrency(sessionTotal)}</span>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* ================= KELOLA ================= */}
      {view === 'kelola' && (
        <>
          <div className="flex items-center gap-3">
            <button onClick={() => setView('sessions')} className="p-2 bg-white border border-slate-200 rounded-xl text-slate-600 shadow-sm">
              <i className="fa-solid fa-arrow-left"></i>
            </button>
            <h3 className="font-extrabold text-slate-800">{t('orders.manage')}</h3>
          </div>

          <div className="flex bg-white border border-slate-200 rounded-xl p-1 shadow-sm">
            {[
              ['orang', 'fa-users', t('orders.people')],
              ['item', 'fa-tags', t('orders.items')]
            ].map(([key, icon, label]) => (
              <button
                key={key}
                onClick={() => setKelolaTab(key)}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition ${kelolaTab === key ? 'bg-savora-orange text-white shadow' : 'text-slate-500 hover:bg-slate-50'}`}
              >
                <i className={`fa-solid ${icon}`}></i>{label}
              </button>
            ))}
          </div>

          {kelolaTab === 'orang' && (
            <div className="space-y-3">
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 space-y-2">
                <div className="flex gap-2">
                  <input
                    value={personForm.nama}
                    onChange={(e) => setPersonForm({ ...personForm, nama: e.target.value })}
                    placeholder={t('orders.person_name_ph')}
                    className="flex-1 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-savora-orange/40"
                  />
                  <input
                    value={personForm.catatan}
                    onChange={(e) => setPersonForm({ ...personForm, catatan: e.target.value })}
                    placeholder={t('orders.person_note_ph')}
                    className="w-32 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-savora-orange/40"
                  />
                  <button onClick={handleAddPerson} className="px-3 py-2 bg-savora-orange text-white rounded-xl text-sm font-semibold active:scale-95 transition">
                    <i className="fa-solid fa-plus"></i>
                  </button>
                </div>
              </div>
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm divide-y divide-slate-100">
                {people.map(p => (
                  <div key={p.id} className="p-3 flex items-center gap-2">
                    {editPerson?.id === p.id ? (
                      <>
                        <input value={editPerson.nama} onChange={(e) => setEditPerson({ ...editPerson, nama: e.target.value })} className="flex-1 border border-slate-200 rounded-lg px-2 py-1.5 text-sm" />
                        <input value={editPerson.catatan || ''} onChange={(e) => setEditPerson({ ...editPerson, catatan: e.target.value })} placeholder={t('orders.person_note_ph')} className="w-28 border border-slate-200 rounded-lg px-2 py-1.5 text-sm" />
                        <button onClick={handleSavePerson} className="text-emerald-600 p-1.5"><i className="fa-solid fa-check"></i></button>
                        <button onClick={() => setEditPerson(null)} className="text-slate-400 p-1.5"><i className="fa-solid fa-xmark"></i></button>
                      </>
                    ) : (
                      <>
                        <div className="flex-1 min-w-0">
                          <span className={`text-sm font-semibold ${p.aktif ? 'text-slate-700' : 'text-slate-400 line-through'}`}>{p.nama}</span>
                          {p.catatan && <span className="text-xs text-slate-400 ml-2">{p.catatan}</span>}
                        </div>
                        <button onClick={() => setEditPerson({ id: p.id, nama: p.nama, catatan: p.catatan || '' })} className="text-slate-400 hover:text-slate-600 p-1.5"><i className="fa-solid fa-pen text-xs"></i></button>
                        <button onClick={() => handleTogglePersonActive(p)} className={`text-[10px] font-bold px-2 py-1 rounded-lg ${p.aktif ? 'bg-slate-100 text-slate-500' : 'bg-amber-100 text-amber-700'}`}>
                          {p.aktif ? t('orders.deactivate') : t('orders.activate')}
                        </button>
                        <button onClick={() => handleDeletePerson(p)} className="text-slate-300 hover:text-rose-500 p-1.5"><i className="fa-solid fa-trash text-xs"></i></button>
                      </>
                    )}
                  </div>
                ))}
                {people.length === 0 && <div className="p-4 text-center text-xs text-slate-400">{t('orders.people_empty')}</div>}
              </div>
            </div>
          )}

          {kelolaTab === 'item' && (
            <div className="space-y-3">
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
                <div className="flex gap-2 flex-wrap">
                  <input
                    value={itemForm.nama}
                    onChange={(e) => setItemForm({ ...itemForm, nama: e.target.value })}
                    placeholder={t('orders.new_item_name_ph')}
                    className="flex-1 min-w-[120px] border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-savora-orange/40"
                  />
                  <input
                    value={itemForm.harga}
                    onChange={(e) => setItemForm({ ...itemForm, harga: formatNumberInput(e.target.value) })}
                    placeholder={t('orders.price_ph')}
                    inputMode="numeric"
                    className="w-28 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-savora-orange/40"
                  />
                  <select
                    value={itemForm.jenis}
                    onChange={(e) => setItemForm({ ...itemForm, jenis: e.target.value })}
                    className="border border-slate-200 rounded-xl px-2 py-2 text-sm bg-white"
                  >
                    {JENIS.map(j => <option key={j} value={j}>{t(`orders.jenis.${j}`)}</option>)}
                  </select>
                  <button onClick={handleAddItem} className="px-3 py-2 bg-savora-orange text-white rounded-xl text-sm font-semibold active:scale-95 transition">
                    <i className="fa-solid fa-plus"></i>
                  </button>
                </div>
              </div>
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm divide-y divide-slate-100">
                {items.map(i => (
                  <div key={i.id} className="p-3 flex items-center gap-2">
                    {editItem?.id === i.id ? (
                      <>
                        <input value={editItem.nama} onChange={(e) => setEditItem({ ...editItem, nama: e.target.value })} className="flex-1 border border-slate-200 rounded-lg px-2 py-1.5 text-sm" />
                        <input value={editItem.harga} onChange={(e) => setEditItem({ ...editItem, harga: formatNumberInput(e.target.value) })} inputMode="numeric" className="w-24 border border-slate-200 rounded-lg px-2 py-1.5 text-sm" />
                        <select value={editItem.jenis} onChange={(e) => setEditItem({ ...editItem, jenis: e.target.value })} className="border border-slate-200 rounded-lg px-2 py-1.5 text-sm bg-white">
                          {JENIS.map(j => <option key={j} value={j}>{t(`orders.jenis.${j}`)}</option>)}
                        </select>
                        <button onClick={handleSaveItem} className="text-emerald-600 p-1.5"><i className="fa-solid fa-check"></i></button>
                        <button onClick={() => setEditItem(null)} className="text-slate-400 p-1.5"><i className="fa-solid fa-xmark"></i></button>
                      </>
                    ) : (
                      <>
                        <div className="flex-1 min-w-0">
                          <span className={`text-sm font-semibold ${i.aktif ? 'text-slate-700' : 'text-slate-400 line-through'}`}>{i.nama}</span>
                          <span className="text-xs text-slate-400 ml-2">{t(`orders.jenis.${i.jenis}`)}</span>
                        </div>
                        <span className="text-sm font-bold text-slate-700">{formatCurrency(i.harga)}</span>
                        <button onClick={() => setEditItem({ id: i.id, nama: i.nama, harga: formatNumberInput(i.harga), jenis: i.jenis })} className="text-slate-400 hover:text-slate-600 p-1.5"><i className="fa-solid fa-pen text-xs"></i></button>
                        <button onClick={() => handleToggleItemActive(i)} className={`text-[10px] font-bold px-2 py-1 rounded-lg ${i.aktif ? 'bg-slate-100 text-slate-500' : 'bg-amber-100 text-amber-700'}`}>
                          {i.aktif ? t('orders.deactivate') : t('orders.activate')}
                        </button>
                        <button onClick={() => handleDeleteItem(i)} className="text-slate-300 hover:text-rose-500 p-1.5"><i className="fa-solid fa-trash text-xs"></i></button>
                      </>
                    )}
                  </div>
                ))}
                {items.length === 0 && <div className="p-4 text-center text-xs text-slate-400">{t('orders.items_empty')}</div>}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
