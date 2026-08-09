import React, { useState, useEffect, useMemo } from 'react'
import { transactionService } from '../services/transactionService'
import { calendarService } from '../services/calendarService'
import { formatCurrency, formatNumberInput, parseNumberInput } from '../utils/formatCurrency'
import { useLanguage } from '../contexts/LanguageContext'

export default function Calendar() {
  const { t } = useLanguage()
  const [currentDate, setCurrentDate] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState(new Date())
  
  const [transactions, setTransactions] = useState([])
  const [notesData, setNotesData] = useState({})
  
  // Day panel state
  const [journal, setJournal] = useState('')
  const [dailyLimit, setDailyLimit] = useState('')
  const [reminderInput, setReminderInput] = useState('')
  const [reminders, setReminders] = useState([])

  const year = currentDate.getFullYear()
  const month = currentDate.getMonth()

  const formatMonth = (date) => {
    return new Intl.DateTimeFormat('id-ID', { month: 'long', year: 'numeric' }).format(date)
  }
  
  const loadData = async () => {
    try {
      const txData = await transactionService.getTransactions()
      setTransactions(txData || [])
      
      const prefix = `${year}-${String(month + 1).padStart(2, '0')}`
      const notesList = await calendarService.getNotesForMonth(prefix)
      const map = {}
      notesList.forEach(n => {
        map[n.date] = n
      })
      setNotesData(map)
    } catch (e) {
      console.error(e)
    }
  }

  useEffect(() => {
    loadData()
  }, [currentDate])

  // Sync day panel when selectedDate changes
  useEffect(() => {
    const dStr = selectedDate.toISOString().split('T')[0]
    const note = notesData[dStr]
    if (note) {
      setJournal(note.journal || '')
      setDailyLimit(note.daily_limit || '')
      setReminders(note.reminders || [])
    } else {
      setJournal('')
      setDailyLimit('')
      setReminders([])
    }
  }, [selectedDate, notesData])

  const changeMonth = (offset) => {
    const newD = new Date(currentDate)
    newD.setMonth(newD.getMonth() + offset)
    setCurrentDate(newD)
  }

  const saveDayData = async (payload) => {
    const dStr = selectedDate.toISOString().split('T')[0]
    try {
      const updated = await calendarService.upsertNote(dStr, payload)
      setNotesData(prev => ({ ...prev, [dStr]: updated }))
    } catch (e) {
      console.error(t('cal.save_fail'), e)
    }
  }

  const handleJournalChange = (e) => {
    setJournal(e.target.value)
  }
  
  const handleJournalBlur = () => {
    saveDayData({ journal })
  }

  const handleLimitChange = (e) => {
    const formatted = formatNumberInput(e.target.value)
    setDailyLimit(formatted)
    saveDayData({ daily_limit: formatted ? parseNumberInput(formatted) : null })
  }

  const addReminder = () => {
    if (!reminderInput.trim()) return
    const newReminders = [...reminders, { text: reminderInput, done: false }]
    setReminders(newReminders)
    setReminderInput('')
    saveDayData({ reminders: newReminders })
  }

  const toggleReminder = (idx) => {
    const newReminders = [...reminders]
    newReminders[idx].done = !newReminders[idx].done
    setReminders(newReminders)
    saveDayData({ reminders: newReminders })
  }

  const removeReminder = (idx) => {
    const newReminders = reminders.filter((_, i) => i !== idx)
    setReminders(newReminders)
    saveDayData({ reminders: newReminders })
  }

  // Monthly stats
  const monthlyStats = useMemo(() => {
    let income = 0, expense = 0
    transactions.forEach(t => {
      const d = new Date(t.created_at)
      if (d.getFullYear() === year && d.getMonth() === month) {
        if (t.tipe === 'Pemasukan') income += Number(t.jumlah)
        else if (t.tipe === 'Pengeluaran') expense += Number(t.jumlah)
      }
    })
    return { income, expense, net: income - expense }
  }, [transactions, year, month])

  // Daily stats for selected day
  const dailyStats = useMemo(() => {
    const dStr = selectedDate.toISOString().split('T')[0]
    const dayTxs = transactions.filter(t => t.created_at && t.created_at.startsWith(dStr))
    let expense = 0
    dayTxs.forEach(t => {
      if (t.tipe === 'Pengeluaran') expense += Number(t.jumlah)
    })
    return { txs: dayTxs, expense }
  }, [transactions, selectedDate])

  // Calendar Grid generation
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const firstDay = new Date(year, month, 1).getDay() // 0 = Sunday
  const blanks = Array(firstDay).fill(null)
  const days = Array.from({length: daysInMonth}, (_, i) => i + 1)
  
  const limitNum = Number(dailyLimit)
  const limitPercent = limitNum > 0 ? Math.min(100, Math.round((dailyStats.expense / limitNum) * 100)) : 0
  const isOverLimit = limitNum > 0 && dailyStats.expense > limitNum

  return (
    <section className="space-y-6 animate-fade-in">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-gradient-to-br from-emerald-600 to-emerald-500 text-white rounded-2xl p-4 shadow-md relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-white rounded-bl-full opacity-10"></div>
          <div className="relative z-10">
            <p className="text-[10px] uppercase font-bold text-emerald-100">{t('cal.month_income')}</p>
            <p className="font-extrabold text-lg mt-0.5">{formatCurrency(monthlyStats.income)}</p>
          </div>
        </div>
        <div className="bg-gradient-to-br from-rose-600 to-rose-500 text-white rounded-2xl p-4 shadow-md relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-white rounded-bl-full opacity-10"></div>
          <div className="relative z-10">
            <p className="text-[10px] uppercase font-bold text-rose-100">{t('cal.month_expense')}</p>
            <p className="font-extrabold text-lg mt-0.5">{formatCurrency(monthlyStats.expense)}</p>
          </div>
        </div>
        <div className="bg-gradient-to-br from-blue-600 to-blue-500 text-white rounded-2xl p-4 shadow-md relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-white rounded-bl-full opacity-10"></div>
          <div className="relative z-10">
            <p className="text-[10px] uppercase font-bold text-blue-100">{t('cal.month_net')}</p>
            <p className="font-extrabold text-lg mt-0.5">{formatCurrency(monthlyStats.net)}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        <div className="md:col-span-2 bg-white rounded-2xl p-6 shadow-sm border border-slate-200/60 flex flex-col h-[520px]">
          <div className="flex justify-between items-center mb-6">
            <h3 className="font-bold text-xl text-slate-800 capitalize">{formatMonth(currentDate)}</h3>
            <div className="flex gap-2">
              <button onClick={() => changeMonth(-1)} className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition"><i className="fa-solid fa-chevron-left"></i></button>
              <button onClick={() => changeMonth(1)} className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition"><i className="fa-solid fa-chevron-right"></i></button>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-2 mb-2 text-center">
            {['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'].map((d, i) => (
              <div key={d} className={`text-[10px] font-bold uppercase ${i === 0 || i === 6 ? 'text-rose-400' : 'text-slate-400'}`}>{t(`cal.${['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'][i]}`)}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-2 flex-1">
            {blanks.map((_, i) => <div key={`b-${i}`} className="p-2 border border-slate-100/50 rounded-xl bg-slate-50/30"></div>)}
            {days.map(d => {
              const dStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
              const isSelected = selectedDate.toISOString().split('T')[0] === dStr
              const todayStr = new Date().toISOString().split('T')[0]
              const isToday = todayStr === dStr
              
              const dayTxs = transactions.filter(t => t.created_at && t.created_at.startsWith(dStr))
              let inc = 0, exp = 0
              dayTxs.forEach(t => {
                if (t.tipe === 'Pemasukan') inc += Number(t.jumlah)
                if (t.tipe === 'Pengeluaran') exp += Number(t.jumlah)
              })
              const hasNotes = !!notesData[dStr] && (!!notesData[dStr].journal || notesData[dStr].reminders?.length > 0)

              return (
                <div 
                  key={d} 
                  onClick={() => setSelectedDate(new Date(year, month, d, 12, 0, 0))}
                  className={`p-2 border rounded-xl flex flex-col items-center justify-start cursor-pointer transition ${
                    isSelected ? 'border-savora-800 bg-savora-50 shadow-md ring-2 ring-savora-800/20' 
                    : isToday ? 'border-savora-300 bg-orange-50' 
                    : 'border-slate-100 hover:border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  <span className={`text-sm font-bold ${isToday ? 'text-savora-orange' : 'text-slate-700'}`}>{d}</span>
                  {hasNotes && <div className="w-1.5 h-1.5 rounded-full bg-slate-400 mt-0.5"></div>}
                  <div className="mt-1 space-y-0.5 w-full px-0.5">
                    {inc > 0 && <div className="h-1 bg-emerald-400 rounded-full w-full"></div>}
                    {exp > 0 && <div className="h-1 bg-rose-400 rounded-full w-full"></div>}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <div className="bg-slate-800 rounded-2xl p-6 shadow-sm flex flex-col h-[520px] text-white overflow-hidden relative">
          <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500 rounded-bl-full opacity-10"></div>
          
          <div className="mb-6 relative z-10">
            <h3 className="font-bold text-sm text-emerald-400 uppercase tracking-wider">{t('cal.panel_title')}</h3>
            <p className="text-2xl font-black mt-1">
              {new Intl.DateTimeFormat('id-ID', { weekday: 'long', day: 'numeric', month: 'long' }).format(selectedDate)}
            </p>
          </div>

          <div className="flex-1 overflow-y-auto no-scrollbar space-y-6 relative z-10 pr-2">
            
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-400 flex items-center gap-2"><i className="fa-solid fa-book text-emerald-400"></i> {t('cal.journal')}</label>
              <textarea 
                value={journal}
                onChange={handleJournalChange}
                onBlur={handleJournalBlur}
                placeholder={t('cal.journal_ph')}
                className="w-full h-24 bg-slate-900/50 border border-slate-700 rounded-xl p-3 text-sm focus:outline-none focus:border-emerald-500 resize-none"
              ></textarea>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-400 flex items-center gap-2"><i className="fa-solid fa-bullseye text-emerald-400"></i> {t('cal.budget_limit')}</label>
              <div className="relative">
                <input 
                  type="text" 
                  inputMode="numeric"
                  value={formatNumberInput(dailyLimit)}
                  onChange={handleLimitChange}
                  placeholder={t('cal.budget_limit_ph')}
                  className="w-full bg-slate-900/50 border border-slate-700 rounded-xl p-2.5 text-sm focus:outline-none focus:border-emerald-500 pl-8"
                />
                <span className="absolute left-3 top-2.5 text-slate-400 text-sm">Rp</span>
              </div>
              {limitNum > 0 && (
                <div className="mt-2">
                  <div className="flex justify-between text-[10px] font-semibold mb-1">
                    <span className="text-slate-400">{t('cal.usage')}: {limitPercent}%</span>
                    <span className={isOverLimit ? 'text-rose-400' : 'text-emerald-400'}>{isOverLimit ? t('cal.overbudget') : t('cal.safe')}</span>
                  </div>
                  <div className="w-full bg-slate-700 rounded-full h-1.5">
                    <div className={`h-1.5 rounded-full transition-all ${isOverLimit ? 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.5)]' : 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]'}`} style={{ width: `${Math.min(limitPercent, 100)}%` }}></div>
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-400 flex items-center gap-2"><i className="fa-solid fa-bell text-emerald-400"></i> {t('cal.reminders')}</label>
              <div className="flex gap-2">
                <input 
                  type="text" 
                  value={reminderInput}
                  onChange={(e) => setReminderInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addReminder()}
                  placeholder={t('cal.reminder_ph')}
                  className="flex-1 bg-slate-900/50 border border-slate-700 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-emerald-500"
                />
                <button onClick={addReminder} className="bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold px-3 py-2 rounded-xl transition">+</button>
              </div>
              <div className="space-y-2 max-h-[120px] overflow-y-auto pr-1 text-xs font-medium">
                {reminders.map((r, i) => (
                  <div key={i} className="flex justify-between items-center bg-slate-900/50 p-2 rounded-lg border border-slate-700 group">
                    <div className="flex items-center gap-2 cursor-pointer" onClick={() => toggleReminder(i)}>
                      <i className={`fa-solid ${r.done ? 'fa-square-check text-emerald-500' : 'fa-square text-slate-500'}`}></i>
                      <span className={r.done ? 'line-through text-slate-500' : 'text-slate-300'}>{r.text}</span>
                    </div>
                    <button onClick={() => removeReminder(i)} className="text-rose-500 hover:text-rose-400 opacity-0 group-hover:opacity-100 transition"><i className="fa-solid fa-xmark"></i></button>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-3 pt-4 border-t border-slate-700">
              <label className="text-xs font-bold text-slate-400 flex items-center gap-2"><i className="fa-solid fa-receipt text-emerald-400"></i> {t('cal.tx_history')}</label>
              {dailyStats.txs.length === 0 ? (
                <p className="text-xs text-slate-500 italic text-center py-4 bg-slate-900/30 rounded-xl border border-slate-800 border-dashed">{t('cal.tx_empty')}</p>
              ) : (
                <div className="space-y-2">
                  {dailyStats.txs.map(tx => (
                    <div key={tx.id} className="bg-slate-900/50 p-3 rounded-xl border border-slate-700 flex justify-between items-center">
                      <div className="flex flex-col">
                        <span className="text-xs font-bold text-slate-200">{tx.deskripsi}</span>
                        <span className="text-[10px] text-slate-500">{tx.kategori} • {tx.akun}</span>
                      </div>
                      <span className={`text-xs font-black ${tx.tipe === 'Pengeluaran' ? 'text-savora-orange' : 'text-emerald-400'}`}>
                        {tx.tipe === 'Pengeluaran' ? '-' : '+'}{formatCurrency(tx.jumlah)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            
          </div>
        </div>
      </div>
    </section>
  )
}
