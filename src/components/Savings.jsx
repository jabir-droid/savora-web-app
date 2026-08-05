import React, { useState, useEffect } from 'react'
import { savingService } from '../services/savingService'
import { formatCurrency } from '../utils/formatCurrency'
import AddSavingGoalModal from './modals/AddSavingGoalModal'
import AddContributionModal from './modals/AddContributionModal'
import { useToast } from '../contexts/ToastContext'
import { useLanguage } from '../contexts/LanguageContext'
import { SkeletonCard, SkeletonList } from './SkeletonLoader'

export default function Savings() {
  const { t } = useLanguage()
  const { showToast } = useToast()
  const [savings, setSavings] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [activeFilter, setActiveFilter] = useState('Semua')

  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [isContributionModalOpen, setIsContributionModalOpen] = useState(false)
  const [selectedSaving, setSelectedSaving] = useState(null)

  const loadData = async () => {
    try {
      setIsLoading(true)
      const data = await savingService.getSavings()
      setSavings(data || [])
    } catch (e) {
      console.error(e)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const handleDelete = async (id) => {
    if (!confirm(t('savings.delete_confirm'))) return
    try {
      await savingService.deleteSavingGoal(id)
      showToast(t('savings.delete_success'), 'success')
      loadData()
    } catch (e) {
      showToast(t('savings.delete_fail') + e.message, 'error')
    }
  }

  const formatFullMoney = (number) => {
    return formatCurrency(number)
  }

  const uniqueCategories = [t('savings.filter_all'), ...new Set(savings.map(s => s.kategori))]

  const filteredSavings = activeFilter === t('savings.filter_all') ? savings : savings.filter(s => s.kategori === activeFilter)

  return (
    <>
      <section className="space-y-6 animate-fade-in w-full">
        {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      ) : (
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/60">
        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 mb-6">
          <div>
            <h3 className="font-extrabold text-xl text-slate-800 mb-1">{t('savings.title')}</h3>
            <p className="text-xs text-slate-400">{t('savings.subtitle')}</p>
          </div>
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
            {uniqueCategories.map(cat => (
              <button 
                key={cat}
                onClick={() => setActiveFilter(cat)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition duration-200 ${
                  activeFilter === cat 
                    ? 'bg-slate-800 text-white shadow-md' 
                    : 'bg-white border border-slate-200 text-slate-500 hover:bg-slate-50 hover:border-slate-300'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div 
            onClick={() => setIsAddModalOpen(true)} 
            className="border-2 border-dashed border-slate-200 hover:border-savora-orange/50 rounded-3xl p-6 flex flex-col items-center justify-center text-center cursor-pointer bg-slate-50/50 hover:bg-slate-100/50 transition duration-200 min-h-[180px] group"
          >
            <div className="w-12 h-12 rounded-full bg-orange-50 text-savora-orange flex items-center justify-center text-xl shadow-sm mb-3 group-hover:scale-110 transition">
              <i className="fa-solid fa-plus"></i>
            </div>
            <h4 className="font-extrabold text-sm text-slate-700">{t('savings.add_title')}</h4>
            <p className="text-[10px] text-slate-400 mt-1">{t('savings.add_subtitle')}</p>
          </div>

          {filteredSavings.map(s => {
            const target = Number(s.targetjumlah)
            const current = Number(s.terkumpul)
            const percent = Math.min(100, Math.round((current / target) * 100))
            const catLower = (s.kategori || "").toLowerCase()
            
            let badgeBg = "bg-slate-50 text-slate-600 border-slate-100"
            let cardBg = "bg-white border-slate-200/80 shadow-sm"

            if (catLower.includes("personal") || catLower.includes("pribadi")) {
                badgeBg = "bg-orange-500/20 text-orange-600"
                cardBg = "bg-orange-50/10 border-orange-500/10 hover:border-orange-500/25 hover:shadow-orange-500/5 shadow-sm"
            } else if (catLower.includes("family") || catLower.includes("keluarga")) {
                badgeBg = "bg-emerald-500/20 text-emerald-600"
                cardBg = "bg-emerald-50/10 border-emerald-500/10 hover:border-emerald-500/25 hover:shadow-emerald-500/5 shadow-sm"
            } else if (catLower.includes("mutual") || catLower.includes("bersama")) {
                badgeBg = "bg-purple-500/20 text-purple-600"
                cardBg = "bg-purple-50/10 border-purple-500/10 hover:border-purple-500/25 hover:shadow-purple-500/5 shadow-sm"
            }

            const isCompleted = percent >= 100 || s.status === 'Tercapai'

            return (
              <div key={s.id} className={`${cardBg} border rounded-3xl p-6 shadow-sm hover:shadow-md transition duration-200 flex flex-col justify-between min-h-[220px]`}>
                <div>
                  <div className="flex justify-between items-start gap-2">
                    <span className={`px-2.5 py-0.5 text-[9px] font-extrabold uppercase rounded-full ${badgeBg}`}>
                      {s.kategori}
                    </span>
                    <div className="flex gap-1.5">
                      {!isCompleted && (
                        <button 
                          onClick={() => { setSelectedSaving(s); setIsContributionModalOpen(true); }}
                          className="px-3 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-600 font-bold rounded-xl text-[10px] transition"
                        >
                          <i className="fa-solid fa-circle-arrow-down mr-1"></i>{t('savings.btn_deposit')}
                        </button>
                      )}
                      <button onClick={() => handleDelete(s.id)} className="p-1 hover:bg-rose-50 text-rose-500 rounded-lg transition">
                        <i className="fa-regular fa-trash-can text-xs"></i>
                      </button>
                    </div>
                  </div>
                  <h4 className="font-extrabold text-slate-800 text-sm mt-3 truncate" title={s.namatarget}>{s.namatarget}</h4>
                  <p className="text-[10px] text-slate-400 font-medium flex items-center gap-1.5 mt-1">
                    <span>{t('savings.deadline')}: {s.tenggatwaktu}</span>
                    <span>•</span>
                    <span className="text-savora-orange font-bold uppercase text-[9px]">{s.jadwalrutin !== 'Bebas' ? `📅 ${t('savings.schedule_auto')}` : t('savings.schedule_manual')}</span>
                  </p>
                </div>
                
                <div className="space-y-2 mt-4">
                  <div className="flex justify-between text-xs font-semibold">
                    <span className="text-slate-500 font-mono">{percent}%</span>
                    <span className="text-slate-700 font-bold" title={formatFullMoney(current)}>{formatCurrency(current)} <span className="text-slate-400 font-normal">/ {formatCurrency(target)}</span></span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden border border-slate-200/30">
                    <div className="bg-[#00ff66] h-2 rounded-full transition-all duration-300 shadow-[0_0_8px_rgba(0,255,102,0.5)]" style={{ width: `${percent}%` }}></div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
        </div>
      )}
      </section>

      <AddSavingGoalModal 
        isOpen={isAddModalOpen} 
        onClose={() => setIsAddModalOpen(false)} 
        onSuccess={loadData} 
      />
      
      <AddContributionModal 
        isOpen={isContributionModalOpen} 
        onClose={() => { setIsContributionModalOpen(false); setSelectedSaving(null); }} 
        onSuccess={loadData} 
        saving={selectedSaving}
      />
    </>
  )
}
