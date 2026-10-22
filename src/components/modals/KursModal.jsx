import React, { useState, useEffect } from 'react'
import { currencyService } from '../../services/currencyService'
import { useToast } from '../../contexts/ToastContext'
import { useLanguage } from '../../contexts/LanguageContext'
import { SUPPORTED_CURRENCIES, DEFAULT_RATES } from '../../utils/currency'
import { formatNumberInput, parseNumberInput } from '../../utils/formatCurrency'

// Pengaturan kurs mata uang asing (Program Penyempurnaan).
// Kurs dipakai untuk mengonversi saldo & arus akun asing ke mata
// uang dasar IDR pada total gabungan dan statistik.
export default function KursModal({ isOpen, onClose }) {
  const { t } = useLanguage()
  const { showToast } = useToast()
  const [values, setValues] = useState({})
  const [customCodes, setCustomCodes] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  const foreign = SUPPORTED_CURRENCIES.filter(c => c.kode !== 'IDR')

  useEffect(() => {
    if (!isOpen) return
    let cancelled = false
    setIsLoading(true)
    Promise.all([currencyService.getRates(), currencyService.getCustomCodes()])
      .then(([rates, codes]) => {
        if (cancelled) return
        const init = {}
        foreign.forEach(c => { init[c.kode] = formatNumberInput(String(rates[c.kode] || DEFAULT_RATES[c.kode] || '')) })
        setValues(init)
        setCustomCodes(codes)
      })
      .catch(() => { if (!cancelled) showToast(t('settings.rates_fail'), 'error') })
      .finally(() => { if (!cancelled) setIsLoading(false) })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen])

  if (!isOpen) return null

  const handleSave = async () => {
    setIsSaving(true)
    try {
      for (const c of foreign) {
        const kurs = parseNumberInput(values[c.kode])
        if (!kurs || kurs <= 0) throw new Error(c.kode)
        await currencyService.saveRate(c.kode, kurs)
      }
      showToast(t('settings.rates_saved'), 'success')
      onClose()
    } catch (err) {
      showToast(t('settings.rates_fail') + err.message, 'error')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-2">
          <h3 className="font-extrabold text-lg text-slate-800">{t('settings.rates_title')}</h3>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-xl transition">
            <i className="fa-solid fa-xmark text-lg"></i>
          </button>
        </div>
        <p className="text-xs text-slate-400 mb-5">{t('settings.rates_desc')}</p>

        {isLoading ? (
          <p className="text-sm text-slate-400 text-center py-6">{t('settings.session_loading')}</p>
        ) : (
          <div className="space-y-4">
            {foreign.map(c => (
              <div key={c.kode}>
                <label className="block text-xs text-slate-500 mb-1 font-semibold">
                  1 {c.kode} ={' '}
                  <span className={customCodes.includes(c.kode) ? 'text-teal-600' : 'text-amber-500'}>
                    {customCodes.includes(c.kode) ? t('settings.rates_custom') : t('settings.rates_default')}
                  </span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 font-bold text-slate-400 text-sm">Rp</span>
                  <input type="text" inputMode="numeric"
                    value={values[c.kode] || ''}
                    onChange={e => setValues(v => ({ ...v, [c.kode]: formatNumberInput(e.target.value) }))}
                    className="w-full border-2 border-slate-200 rounded-xl px-3 py-2 text-base font-bold text-slate-800 focus:outline-none focus:border-savora-800 pl-10"
                    placeholder="0" />
                </div>
              </div>
            ))}

            <button onClick={handleSave} disabled={isSaving}
              className="w-full bg-savora-800 hover:bg-savora-900 disabled:bg-slate-300 text-white font-bold py-3 rounded-xl shadow-lg transition mt-2">
              {isSaving ? t('modal_acc.btn_saving') : t('settings.rates_save')}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
