import React, { useState, useEffect, useMemo } from 'react'
import { transactionService } from '../services/transactionService'
import { accountService } from '../services/accountService'
import { formatCurrency } from '../utils/formatCurrency'
import { SkeletonCard } from './SkeletonLoader'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import { useLanguage } from '../contexts/LanguageContext'

const COLORS = ['#F97316', '#10b981', '#3b82f6', '#8b5cf6', '#ec4899', '#f43f5e']

export default function Statistics() {
  const { t } = useLanguage()
  const [subTab, setSubTab] = useState('cashflow')
  const [transactions, setTransactions] = useState([])
  const [accounts, setAccounts] = useState([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const loadData = async () => {
      try {
        setIsLoading(true)
        const txData = await transactionService.getTransactions()
        const accData = await accountService.getAccounts()
        setTransactions(txData || [])
        setAccounts(accData || [])
      } catch (e) {
        console.error(e)
      } finally {
        setIsLoading(false)
      }
    }
    loadData()
  }, [])

  const formatFullMoney = (number) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(number || 0)
  }

  // --- CHART CALCULATION ---
  const chartData = useMemo(() => {
    const daysData = {}
    for (let d = 1; d <= 31; d++) daysData[d] = { name: d.toString(), inc: 0, exp: 0 }

    transactions.forEach(t => {
      if (!t.created_at) return
      const date = new Date(t.created_at)
      const day = date.getDate()
      
      if (day >= 1 && day <= 31) {
        if (t.tipe === 'Pemasukan') daysData[day].inc += Number(t.jumlah)
        else if (t.tipe === 'Pengeluaran') daysData[day].exp += Number(t.jumlah)
      }
    })

    return Object.values(daysData)
  }, [transactions])

  // --- BREAKDOWN CALCULATION ---
  const breakdownData = useMemo(() => {
    let total = 0
    const catMap = {}
    transactions.forEach(t => {
      if (t.tipe === 'Pengeluaran') {
        catMap[t.kategori] = (catMap[t.kategori] || 0) + Number(t.jumlah)
        total += Number(t.jumlah)
      }
    })
    return { 
      total, 
      categories: Object.entries(catMap).sort((a,b) => b[1] - a[1]).map(c => ({ name: c[0], value: c[1] })) 
    }
  }, [transactions])

  // --- ASSETS CALCULATION ---
  const assetsData = useMemo(() => {
    let total = 0
    accounts.forEach(a => total += Number(a.saldo))
    return { total, accounts: [...accounts].sort((a,b) => Number(b.saldo) - Number(a.saldo)) }
  }, [accounts])

  const activeTotal = assetsData.total
  const healthAdvice = activeTotal > breakdownData.total 
    ? t('stat.health_good')
    : t('stat.health_bad')

  if (isLoading) {
    return (
      <section className="space-y-6 animate-fade-in w-full">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <SkeletonCard />
          <SkeletonCard />
        </div>
      </section>
    )
  }

  return (
    <section className="space-y-6 animate-fade-in">
      <div className="flex gap-2 bg-slate-100 p-1 rounded-2xl w-fit mb-4">
        <button onClick={() => setSubTab('cashflow')} className={`px-4 py-2 rounded-xl text-xs transition ${subTab === 'cashflow' ? 'font-bold bg-white text-savora-900 shadow-sm' : 'font-medium text-slate-500 hover:text-slate-800'}`}>
          {t('stat.tab_cashflow')}
        </button>
        <button onClick={() => setSubTab('breakdown')} className={`px-4 py-2 rounded-xl text-xs transition ${subTab === 'breakdown' ? 'font-bold bg-white text-savora-900 shadow-sm' : 'font-medium text-slate-500 hover:text-slate-800'}`}>
          {t('stat.tab_breakdown')}
        </button>
        <button onClick={() => setSubTab('assets')} className={`px-4 py-2 rounded-xl text-xs transition ${subTab === 'assets' ? 'font-bold bg-white text-savora-900 shadow-sm' : 'font-medium text-slate-500 hover:text-slate-800'}`}>
          {t('stat.tab_assets')}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-2xl p-6 shadow-sm border border-slate-200/60 min-h-[300px]">
          
          {/* CASHFLOW */}
          {subTab === 'cashflow' && (
            <div className="space-y-4 animate-fade-in">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="font-bold text-lg text-slate-800">{t('stat.cf_title')}</h3>
                  <p className="text-xs text-slate-400">{t('stat.cf_subtitle')}</p>
                </div>
                <div className="flex gap-2">
                  <span className="flex items-center gap-1.5 text-xs text-emerald-600 font-semibold"><i className="fa-solid fa-square"></i> {t('stat.cf_income')}</span>
                  <span className="flex items-center gap-1.5 text-xs text-savora-orange font-semibold"><i className="fa-solid fa-square"></i> {t('stat.cf_expense')}</span>
                </div>
              </div>
              <div className="w-full flex justify-center py-4 rounded-xl" style={{ height: 350 }}>
                {isLoading ? <p className="text-xs text-slate-400 py-10">{t('stat.loading_chart')}</p> : (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorInc" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.8}/>
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                        </linearGradient>
                        <linearGradient id="colorExp" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#F97316" stopOpacity={0.8}/>
                          <stop offset="95%" stopColor="#F97316" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                      <YAxis tickFormatter={(val) => val / 1000 + 'k'} axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                      <Tooltip formatter={(value) => formatCurrency(value)} />
                      <Area type="monotone" dataKey="inc" stroke="#10b981" fillOpacity={1} fill="url(#colorInc)" />
                      <Area type="monotone" dataKey="exp" stroke="#F97316" fillOpacity={1} fill="url(#colorExp)" />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          )}

          {/* BREAKDOWN PIE CHART */}
          {subTab === 'breakdown' && (
            <div className="space-y-4 animate-fade-in">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="font-bold text-lg text-slate-800">{t('stat.bd_title')}</h3>
                  <p className="text-xs text-slate-400">{t('stat.bd_total')} <span className="font-bold text-rose-500">{formatCurrency(breakdownData.total)}</span></p>
                </div>
              </div>
              <div className="w-full flex flex-col md:flex-row gap-4 items-center justify-center py-4" style={{ height: 350 }}>
                {isLoading ? <p className="text-xs text-slate-400 py-10">{t('stat.loading_chart')}</p> : (
                  <>
                    <div className="w-full md:w-1/2 h-full min-h-[250px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={breakdownData.categories}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={80}
                            paddingAngle={5}
                            dataKey="value"
                          >
                            {breakdownData.categories.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip formatter={(value) => formatCurrency(value)} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="w-full md:w-1/2 flex flex-col gap-3 max-h-full overflow-y-auto pr-2 no-scrollbar">
                      {breakdownData.categories.map((cat, i) => {
                        const pct = breakdownData.total > 0 ? (cat.value / breakdownData.total * 100).toFixed(1) : 0
                        return (
                          <div key={i} className="flex justify-between items-center p-2 rounded-lg hover:bg-slate-50 transition">
                            <div className="flex items-center gap-2">
                              <span className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }}></span>
                              <span className="text-sm font-semibold text-slate-700">{cat.name}</span>
                            </div>
                            <div className="text-right">
                              <p className="text-xs font-bold text-slate-800">{formatCurrency(cat.value)}</p>
                              <p className="text-[10px] text-slate-400">{pct}%</p>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {/* ASSETS */}
          {subTab === 'assets' && (
            <div className="space-y-4 animate-fade-in">
              <h3 className="font-bold text-lg text-slate-800 mb-1">{t('stat.assets_title')}</h3>
              <p className="text-xs text-slate-400 mb-4">{t('stat.assets_subtitle')}</p>
              <div className="space-y-4">
                {assetsData.total === 0 ? <p className="text-xs text-slate-400 text-center py-6">{t('stat.assets_empty')}</p> : assetsData.accounts.map(acc => {
                  const amt = Number(acc.saldo)
                  const percent = Math.round((amt / assetsData.total) * 100) || 0
                  return (
                    <div key={acc.id} className="space-y-1">
                      <div className="flex justify-between text-xs font-semibold">
                        <span className="flex items-center gap-1.5"><i className={`fa-solid ${acc.tipe === 'Savings' ? 'fa-piggy-bank' : 'fa-wallet'} text-slate-400`}></i> {acc.namaakun}</span>
                        <span>{formatFullMoney(amt)} ({percent}%)</span>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                        <div className="bg-emerald-500 h-1.5 rounded-full" style={{ width: `${percent}%` }}></div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

        </div>

        <div className="bg-slate-800 rounded-2xl p-6 shadow-sm flex flex-col justify-between text-white overflow-hidden relative border-none">
          <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500 rounded-bl-full opacity-10"></div>
          
          <div className="space-y-4 relative z-10">
            <h3 className="font-bold text-base text-emerald-400">{t('stat.status_title')}</h3>
            <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-700 space-y-2">
              <p className="text-xs text-slate-400 uppercase font-semibold">{t('stat.status_monitored')}</p>
              <h4 className="font-extrabold text-slate-200 text-base">{t('stat.status_all')}</h4>
              <div className="flex justify-between items-center text-xs text-slate-400 pt-2 border-t border-slate-700">
                <span>{t('stat.status_total')}</span>
                <span className="font-bold text-emerald-400">{formatFullMoney(activeTotal)}</span>
              </div>
            </div>
          </div>

          <div className="mt-6 pt-6 border-t border-slate-700 bg-emerald-900/20 p-4 rounded-xl border border-emerald-900/30 text-xs relative z-10">
            <h4 className="font-bold text-emerald-400 flex items-center gap-1 mb-1">
              <i className="fa-solid fa-heart-pulse text-emerald-400"></i> {t('stat.health_title')}
            </h4>
            <p className="text-slate-300 leading-relaxed">{healthAdvice}</p>
          </div>
        </div>
      </div>
    </section>
  )
}
