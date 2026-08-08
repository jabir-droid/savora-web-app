import React, { useState, useEffect } from 'react'
import { categoryService } from '../services/categoryService'
import { formatCurrency } from '../utils/formatCurrency'
import { useToast } from '../contexts/ToastContext'
import { useLanguage } from '../contexts/LanguageContext'
import { CATEGORY_ICONS, getDefaultCategories } from '../utils/categoryIcons'
import { supabase } from '../supabaseClient'

export default function Categories() {
  const { t } = useLanguage()
  const { showToast } = useToast()
  const [categories, setCategories] = useState([])
  const [namakategori, setNamakategori] = useState('')
  const [tipe, setTipe] = useState('Pengeluaran')
  const [limitAnggaran, setLimitAnggaran] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const loadData = async () => {
    try {
      const data = await categoryService.getCategories()
      setCategories(data || [])
    } catch (e) {
      console.error(e)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setIsLoading(true)
    try {
      await categoryService.addCategory({
        namakategori,
        tipe,
        limit_anggaran: limitAnggaran ? Number(limitAnggaran) : null
      })
      showToast(t('cat.add_success'), 'success')
      loadData()
      setNamakategori('')
      setLimitAnggaran('')
    } catch (e) {
      showToast(t('cat.add_fail') + e.message, 'error')
    } finally {
      setIsLoading(false)
    }
  }

  const handleLoadDefaults = async () => {
    setIsLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const defaults = getDefaultCategories(user.id)
      
      const missingDefaults = defaults.filter(def => 
        !categories.find(c => c.namakategori.toLowerCase() === def.namakategori.toLowerCase())
      )

      if (missingDefaults.length > 0) {
        const { error } = await supabase.from('categories').insert(missingDefaults)
        if (error) throw error
        showToast(`Berhasil memuat ${missingDefaults.length} kategori bawaan`, 'success')
        loadData()
      } else {
        showToast('Semua kategori bawaan sudah tersedia', 'info')
      }
    } catch (e) {
      showToast('Gagal memuat kategori: ' + e.message, 'error')
    } finally {
      setIsLoading(false)
    }
  }

  const handleDelete = async (id) => {
    if (!confirm(t('cat.delete_confirm'))) return
    try {
      await categoryService.deleteCategory(id)
      showToast(t('cat.delete_success'), 'success')
      loadData()
    } catch (e) {
      showToast(t('cat.delete_fail') + e.message, 'error')
    }
  }

  return (
    <section className="space-y-6 animate-fade-in">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-slate-800 rounded-2xl p-6 shadow-sm flex flex-col text-white overflow-hidden relative h-fit border-none">
          <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500 rounded-bl-full opacity-10"></div>
          
          <div className="relative z-10 mb-6">
            <h3 className="font-bold text-lg text-emerald-400 mb-1">{t('cat.add_title')}</h3>
            <p className="text-xs text-slate-300">{t('cat.add_subtitle')}</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4 relative z-10">
            <div>
              <label className="block text-xs text-slate-400 mb-1 font-semibold">{t('cat.label_name')}</label>
              <input type="text" required value={namakategori} onChange={e => setNamakategori(e.target.value)} placeholder={t('cat.placeholder_name')}
                className="w-full bg-slate-900/50 border border-slate-700 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-emerald-500 text-white" />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1 font-semibold">{t('cat.label_type')}</label>
              <select value={tipe} onChange={e => setTipe(e.target.value)}
                className="w-full bg-slate-900/50 border border-slate-700 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-emerald-500 text-white">
                <option value="Pengeluaran">{t('tx.type_expense')}</option>
                <option value="Pemasukan">{t('tx.type_income')}</option>
                <option value="Tabungan">Tabungan</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1 font-semibold">
                {t('cat.label_limit')} <span className="text-[10px] text-slate-500 font-normal">{t('cat.label_optional')}</span>
              </label>
              <input type="number" value={limitAnggaran} onChange={e => setLimitAnggaran(e.target.value)} placeholder={t('cat.placeholder_limit')}
                className="w-full bg-slate-900/50 border border-slate-700 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-emerald-500 text-white" />
            </div>
            <button type="submit" disabled={isLoading}
              className="w-full bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-bold py-2.5 rounded-xl shadow-lg transition duration-200 active:scale-95 mt-2">
              {isLoading ? t('cat.btn_saving') : t('cat.btn_save')}
            </button>
          </form>
        </div>

        <div className="lg:col-span-2 bg-white rounded-2xl p-6 shadow-sm border border-slate-200/60">
          <div className="flex justify-between items-start mb-6">
            <div>
              <h3 className="font-bold text-lg text-slate-800 mb-1">{t('cat.list_title')}</h3>
              <p className="text-xs text-slate-400">{t('cat.list_subtitle')}</p>
            </div>
            <button 
              onClick={handleLoadDefaults}
              disabled={isLoading}
              className="text-xs bg-savora-100 text-savora-800 hover:bg-savora-200 px-3 py-1.5 rounded-lg font-bold transition flex items-center gap-2"
            >
              <i className="fa-solid fa-rotate-right"></i>
              <span className="hidden sm:inline">Muat Bawaan</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 text-xs font-semibold text-slate-400 uppercase">
                  <th className="py-3 px-4">{t('cat.col_name')}</th>
                  <th className="py-3 px-4">{t('cat.col_type')}</th>
                  <th className="py-3 px-4 text-right">{t('cat.col_limit')}</th>
                  <th className="py-3 px-4 text-center">{t('cat.col_action')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm text-slate-700">
                {categories.length === 0 ? (
                  <tr><td colSpan="4" className="py-8 text-center text-slate-400">{t('cat.empty')}</td></tr>
                ) : categories.map(cat => {
                  const iconData = CATEGORY_ICONS[cat.namakategori] || { icon: 'fa-tag', color: 'text-slate-500', bg: 'bg-slate-50', tKey: null }
                  const displayName = iconData.tKey ? t(iconData.tKey) : cat.namakategori
                  return (
                  <tr key={cat.id} className="hover:bg-slate-50 transition">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${iconData.bg} ${iconData.color}`}>
                          <i className={`fa-solid ${iconData.icon}`}></i>
                        </div>
                        <span className="font-semibold">{displayName}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-1 text-[10px] font-bold rounded-full ${cat.tipe === 'Pemasukan' ? 'bg-emerald-50 text-emerald-600' : cat.tipe === 'Pengeluaran' ? 'bg-rose-50 text-rose-600' : 'bg-savora-orange/10 text-savora-orange'}`}>
                        {cat.tipe}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-xs">{formatCurrency(cat.limit_anggaran)}</td>
                    <td className="py-3 px-4 text-center">
                      <button onClick={() => handleDelete(cat.id)} className="text-rose-400 hover:text-rose-600 p-1">
                        <i className="fa-solid fa-trash-can"></i>
                      </button>
                    </td>
                  </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  )
}
