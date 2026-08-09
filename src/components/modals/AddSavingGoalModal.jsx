import React, { useState } from 'react'
import { savingService } from '../../services/savingService'
import { useToast } from '../../contexts/ToastContext'
import { useLanguage } from '../../contexts/LanguageContext'
import { formatNumberInput, parseNumberInput } from '../../utils/formatCurrency'

export default function AddSavingGoalModal({ isOpen, onClose, onSuccess }) {
  const { t } = useLanguage()
  const { showToast } = useToast()
  const [namatarget, setNamatarget] = useState('')
  const [targetjumlah, setTargetjumlah] = useState('')
  const [terkumpul, setTerkumpul] = useState('0')
  const [kategori, setKategori] = useState('Personal')
  const [customKategori, setCustomKategori] = useState('')
  const [tenggatwaktu, setTenggatwaktu] = useState('')
  const [jadwalrutin, setJadwalrutin] = useState('Bebas')
  const [harisetoran, setHarisetoran] = useState('')
  
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setIsLoading(true)
    
    try {
      const finalKategori = kategori === 'CUSTOM' ? customKategori : kategori
      
      await savingService.addSavingGoal({
        namatarget,
        targetjumlah: parseNumberInput(targetjumlah),
        terkumpul: parseNumberInput(terkumpul),
        tenggatwaktu,
        kategori: finalKategori,
        jadwalrutin,
        harisetoran
      })
      
      showToast(t('modal_sg.success'), 'success')
      onSuccess()
      onClose()
      
      // Reset form
      setNamatarget('')
      setTargetjumlah('')
      setTerkumpul('0')
      setKategori('Personal')
      setTenggatwaktu('')
      setJadwalrutin('Bebas')
    } catch (e) {
      showToast(t('modal_sg.fail') + e.message, 'error')
    } finally {
      setIsLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4 transition-opacity duration-300">
      <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl transform transition-transform duration-300 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h3 className="font-extrabold text-xl text-slate-800">{t('modal_sg.title')}</h3>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-xl transition">
            <i className="fa-solid fa-xmark text-lg"></i>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs text-slate-500 mb-1 font-semibold">{t('modal_sg.name_label')}</label>
            <input type="text" required value={namatarget} onChange={e => setNamatarget(e.target.value)}
              placeholder={t('modal_sg.name_ph')}
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-savora-800" />
          </div>

          <div>
            <label className="block text-xs text-slate-500 mb-1 font-semibold">{t('modal_sg.amount_label')}</label>
            <input type="text" inputMode="numeric" required value={targetjumlah} onChange={e => setTargetjumlah(formatNumberInput(e.target.value))}
              placeholder={t('modal_sg.amount_ph')}
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-savora-800" />
          </div>

          <div>
            <label className="block text-xs text-slate-500 mb-1 font-semibold">{t('modal_sg.category_label')}</label>
            <div className="flex gap-2">
              <select value={kategori} onChange={e => setKategori(e.target.value)}
                className="flex-1 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-savora-800 bg-white">
                <option value="Personal">{t('modal_sg.cat_personal')}</option>
                <option value="Mutual">{t('modal_sg.cat_mutual')}</option>
                <option value="Family">{t('modal_sg.cat_family')}</option>
                <option value="CUSTOM">{t('modal_sg.cat_custom')}</option>
              </select>
              {kategori === 'CUSTOM' && (
                <input type="text" value={customKategori} onChange={e => setCustomKategori(e.target.value)} required
                  placeholder={t('modal_sg.cat_custom_ph')}
                  className="flex-1 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-savora-800" />
              )}
            </div>
          </div>

          <div>
            <label className="block text-xs text-slate-500 mb-1 font-semibold">{t('modal_sg.init_balance_label')}</label>
            <input type="text" inputMode="numeric" value={terkumpul} onChange={e => setTerkumpul(formatNumberInput(e.target.value))}
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-savora-800" />
          </div>

          <div>
            <label className="block text-xs text-slate-500 mb-1 font-semibold">{t('modal_sg.deadline_label')}</label>
            <input type="date" required value={tenggatwaktu} onChange={e => setTenggatwaktu(e.target.value)}
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-savora-800" />
          </div>

          <div>
            <label className="block text-xs text-slate-500 mb-1 font-semibold">
              <i className="fa-solid fa-calendar-days text-savora-orange mr-1"></i> {t('modal_sg.schedule_label')}
            </label>
            <select value={jadwalrutin} onChange={e => setJadwalrutin(e.target.value)}
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-savora-800 bg-white">
              <option value="Bebas">{t('modal_sg.sch_manual')}</option>
              <option value="Setiap Awal Bulan">{t('modal_sg.sch_first_day')}</option>
              <option value="Setiap Akhir Bulan">{t('modal_sg.sch_last_day')}</option>
              <option value="Tanggal Spesifik">{t('modal_sg.sch_specific_date')}</option>
            </select>
          </div>

          {jadwalrutin === 'Tanggal Spesifik' && (
            <div>
              <label className="block text-xs text-slate-500 mb-1 font-semibold">
                <i className="fa-solid fa-clock-rotate-left text-savora-orange mr-1"></i> {t('modal_sg.date_label')}
              </label>
              <input type="number" min="1" max="28" required value={harisetoran} onChange={e => setHarisetoran(e.target.value)}
                placeholder={t('modal_sg.date_ph')}
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-savora-800" />
            </div>
          )}

          <button type="submit" disabled={isLoading}
            className="w-full bg-savora-800 hover:bg-savora-900 text-white font-bold py-3 rounded-xl shadow-lg transition duration-200 mt-4">
            {isLoading ? t('modal_sg.btn_saving') : t('modal_sg.btn_save')}
          </button>
        </form>
      </div>
    </div>
  )
}
