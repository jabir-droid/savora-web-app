import React, { useState, useEffect } from 'react'
import { debtService } from '../services/debtService'
import { accountService } from '../services/accountService'
import { useLanguage } from '../contexts/LanguageContext'
import { SkeletonCard, SkeletonList } from './SkeletonLoader'
import { useToast } from '../contexts/ToastContext'
import { formatCurrency } from '../utils/formatCurrency'
import { triggerHaptic } from '../utils/haptics'

export default function Debts() {
  const { t } = useLanguage()
  const { showToast } = useToast()
  
  const [debts, setDebts] = useState([])
  const [accounts, setAccounts] = useState([])
  const [debtHistory, setDebtHistory] = useState([])
  const [activeTab, setActiveTab] = useState('active')
  const [isLoading, setIsLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [activeDebtToPay, setActiveDebtToPay] = useState(null)
  
  // Payment Form State
  const [payAmount, setPayAmount] = useState('')
  const [payAccount, setPayAccount] = useState('')

  // Form State
  const [namaPihak, setNamaPihak] = useState('')
  const [tipe, setTipe] = useState('Hutang')
  const [jumlah, setJumlah] = useState('')
  const [keterangan, setKeterangan] = useState('')
  const [tenggatWaktu, setTenggatWaktu] = useState('')

  useEffect(() => {
    loadDebts()
  }, [])

  const loadDebts = async () => {
    try {
      setIsLoading(true)
      const [data, accData, historyData] = await Promise.all([
        debtService.getDebts(),
        accountService.getAccounts(),
        debtService.getDebtTransactions()
      ])
      setDebts(data || [])
      setAccounts(accData || [])
      setDebtHistory(historyData || [])
      if (accData && accData.length > 0) setPayAccount(accData[0].namaakun)
    } catch (error) {
      console.error(error)
      showToast(t('debts.load_fail'), 'error')
    } finally {
      setIsLoading(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      await debtService.addDebt({
        nama_pihak: namaPihak,
        tipe,
        jumlah: Number(jumlah.replace(/\D/g, '')),
        keterangan,
        tenggat_waktu: tenggatWaktu
      })
      showToast(t('debts.add_success'), 'success')
      triggerHaptic([50])
      setIsModalOpen(false)
      loadDebts()
      // Reset form
      setNamaPihak('')
      setJumlah('')
      setKeterangan('')
      setTenggatWaktu('')
    } catch (error) {
      showToast(t('debts.add_fail') + error.message, 'error')
    }
  }

  const handleDelete = async (id) => {
    if (window.confirm(t('debts.delete_confirm'))) {
      try {
        await debtService.deleteDebt(id)
        showToast(t('debts.delete_success'), 'success')
        triggerHaptic([50, 50])
        loadDebts()
      } catch (error) {
        showToast(t('debts.delete_fail'), 'error')
      }
    }
  }

  const handlePay = (debt) => {
    setActiveDebtToPay(debt)
    setPayAmount('')
  }

  const submitPayment = async (e) => {
    e.preventDefault()
    if (!activeDebtToPay) return
    
    const numAmount = Number(payAmount.replace(/\D/g, ''))
    if (!isNaN(numAmount) && numAmount > 0) {
      try {
        await debtService.payDebt(activeDebtToPay, numAmount, payAccount)
        showToast(t('debts.pay_success'), 'success')
        triggerHaptic([50])
        setActiveDebtToPay(null)
        loadDebts()
      } catch (error) {
        showToast(t('debts.pay_fail'), 'error')
      }
    }
  }

  return (
    <section className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-black text-savora-900">{t('debts.title')}</h2>
          <p className="text-sm text-slate-500 mt-1">{t('debts.subtitle')}</p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="bg-savora-800 hover:bg-savora-900 text-white px-4 py-2 rounded-xl text-sm font-bold shadow-sm flex items-center gap-2 transition"
        >
          <i className="fa-solid fa-plus"></i> {t('debts.btn_add')}
        </button>
      </div>

      {/* TABS */}
      <div className="flex gap-2 bg-slate-100 p-1 rounded-2xl w-fit mb-6">
        <button 
          onClick={() => setActiveTab('active')} 
          className={`px-4 py-2 rounded-xl text-xs transition ${activeTab === 'active' ? 'font-bold bg-white text-savora-900 shadow-sm' : 'font-medium text-slate-500 hover:text-slate-800'}`}
        >
          {t('debts.tab_active')}
        </button>
        <button 
          onClick={() => setActiveTab('history')} 
          className={`px-4 py-2 rounded-xl text-xs transition ${activeTab === 'history' ? 'font-bold bg-white text-savora-900 shadow-sm' : 'font-medium text-slate-500 hover:text-slate-800'}`}
        >
          {t('debts.tab_history')}
        </button>
      </div>

      {isLoading ? (
        <section className="space-y-6 animate-fade-in w-full">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <SkeletonCard />
            <SkeletonList count={4} />
          </div>
        </section>
      ) : activeTab === 'active' ? (
        debts.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 text-center border border-slate-200/60 shadow-sm">
          <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto mb-4 text-slate-300">
            <i className="fa-solid fa-handshake text-3xl"></i>
          </div>
          <h3 className="font-bold text-slate-800 mb-1">{t('debts.empty_active_title')}</h3>
          <p className="text-sm text-slate-500">{t('debts.empty_active_desc')}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {debts.map(debt => {
            const isLunas = debt.status === 'Lunas'
            const sisa = Number(debt.jumlah) - Number(debt.terbayar)
            
            return (
              <div key={debt.id} className="bg-white rounded-2xl p-5 border border-slate-200/60 shadow-sm flex flex-col justify-between">
                <div>
                  <div className="flex justify-between items-start mb-3">
                    <span className={`text-[10px] font-bold px-2 py-1 rounded-lg uppercase ${debt.tipe === 'Hutang' ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-600'}`}>
                      {debt.tipe}
                    </span>
                    <span className={`text-xs font-semibold ${isLunas ? 'text-emerald-500' : 'text-slate-400'}`}>
                      {isLunas ? t('debts.status_lunas') : t('debts.status_aktif')}
                    </span>
                  </div>
                  <h4 className="font-extrabold text-slate-800 text-lg">{debt.nama_pihak}</h4>
                  <p className="text-xs text-slate-500 mt-1">{debt.keterangan || t('debts.no_desc')}</p>
                  
                  <div className="mt-4 space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-500">{t('debts.total')}</span>
                      <span className="font-bold text-slate-800">{formatCurrency(debt.jumlah)}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-500">{t('debts.paid')}</span>
                      <span className="font-semibold text-savora-600">{formatCurrency(debt.terbayar)}</span>
                    </div>
                    <div className="flex justify-between text-xs pt-1 border-t border-slate-100 mt-1">
                      <span className="text-slate-500">{t('debts.remaining')}</span>
                      <span className="font-black text-rose-500">{formatCurrency(sisa > 0 ? sisa : 0)}</span>
                    </div>
                  </div>
                </div>

                <div className="mt-5 flex gap-2">
                  <button 
                    onClick={() => handlePay(debt)}
                    disabled={isLunas}
                    className="flex-1 bg-savora-50 hover:bg-savora-100 text-savora-800 text-xs font-bold py-2 rounded-xl transition disabled:opacity-50"
                  >
                    {t('debts.btn_pay')}
                  </button>
                  <button 
                    onClick={() => handleDelete(debt.id)}
                    className="w-10 flex items-center justify-center bg-slate-50 hover:bg-rose-50 text-slate-400 hover:text-rose-500 rounded-xl transition"
                  >
                    <i className="fa-regular fa-trash-can"></i>
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      ) ) : (
        // History View
        <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden">
          {debtHistory.length === 0 ? (
            <div className="p-12 text-center">
              <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto mb-4 text-slate-300">
                <i className="fa-solid fa-clock-rotate-left text-3xl"></i>
              </div>
              <h3 className="font-bold text-slate-800 mb-1">{t('debts.empty_history_title')}</h3>
              <p className="text-sm text-slate-500">{t('debts.empty_history_desc')}</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {debtHistory.map(tx => {
                const isBayar = tx.kategori === 'Bayar Hutang'
                return (
                  <div key={tx.id} className="p-4 flex items-center justify-between hover:bg-slate-50 transition">
                    <div className="flex items-center gap-4">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg ${isBayar ? 'bg-rose-50 text-rose-500' : 'bg-emerald-50 text-emerald-500'}`}>
                        <i className={`fa-solid ${isBayar ? 'fa-arrow-up-right-from-square' : 'fa-arrow-down'}`}></i>
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-800 text-sm">{tx.deskripsi}</h4>
                        <p className="text-xs text-slate-500 mt-0.5">{tx.akun} &bull; {new Date(tx.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                      </div>
                    </div>
                    <div className={`font-black ${isBayar ? 'text-slate-800' : 'text-emerald-500'}`}>
                      {isBayar ? '-' : '+'}{formatCurrency(tx.jumlah)}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Modal Tambah */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl">
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-extrabold text-lg text-slate-800">{t('debts.modal_add_title')}</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">{t('debts.modal_type')}</label>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setTipe('Hutang')} className={`flex-1 py-2 text-xs font-bold rounded-xl border-2 transition ${tipe === 'Hutang' ? 'border-rose-500 bg-rose-50 text-rose-600' : 'border-slate-100 text-slate-400'}`}>{t('debts.type_debt')}</button>
                  <button type="button" onClick={() => setTipe('Piutang')} className={`flex-1 py-2 text-xs font-bold rounded-xl border-2 transition ${tipe === 'Piutang' ? 'border-emerald-500 bg-emerald-50 text-emerald-600' : 'border-slate-100 text-slate-400'}`}>{t('debts.type_receive')}</button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">{t('debts.modal_name')}</label>
                <input required type="text" value={namaPihak} onChange={e => setNamaPihak(e.target.value)} className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:border-savora-800 outline-none" placeholder={t('debts.modal_name_ph')} />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">{t('debts.modal_amount')}</label>
                <input required type="number" value={jumlah} onChange={e => setJumlah(e.target.value)} className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:border-savora-800 outline-none" placeholder={t('debts.modal_amount_ph')} />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">{t('debts.modal_desc')}</label>
                <input type="text" value={keterangan} onChange={e => setKeterangan(e.target.value)} className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:border-savora-800 outline-none" placeholder={t('debts.modal_desc_ph')} />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">{t('debts.modal_deadline')}</label>
                <input type="date" value={tenggatWaktu} onChange={e => setTenggatWaktu(e.target.value)} className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:border-savora-800 outline-none" />
              </div>

              <button type="submit" className="w-full bg-savora-800 text-white font-bold py-3 rounded-xl mt-2">{t('debts.modal_btn_save')}</button>
            </form>
          </div>
        </div>
      )}

      {/* Modal Bayar */}
      {activeDebtToPay && (
        <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl">
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-extrabold text-lg text-slate-800">{t('debts.modal_pay_title')}</h3>
              <button onClick={() => setActiveDebtToPay(null)} className="text-slate-400 hover:text-slate-600">
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>
            
            <form onSubmit={submitPayment} className="space-y-4">
              <div>
                <p className="text-xs text-slate-500 mb-1">{t('debts.modal_pay_for')}</p>
                <p className="font-bold text-slate-800">{activeDebtToPay.nama_pihak}</p>
                <p className="text-xs text-slate-500 mt-2">{t('debts.modal_pay_remain')} <span className="font-bold text-rose-500">{formatCurrency(Number(activeDebtToPay.jumlah) - Number(activeDebtToPay.terbayar))}</span></p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">{t('debts.modal_pay_amount')}</label>
                <input required type="number" value={payAmount} onChange={e => setPayAmount(e.target.value)} className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:border-savora-800 outline-none" placeholder={t('debts.modal_amount_ph')} />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">{t('debts.modal_pay_acc')}</label>
                <select value={payAccount} onChange={e => setPayAccount(e.target.value)} className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:border-savora-800 outline-none">
                  {accounts.map(acc => (
                    <option key={acc.id} value={acc.namaakun}>{acc.namaakun} ({formatCurrency(acc.saldo)})</option>
                  ))}
                </select>
                <p className="text-[10px] text-slate-400 mt-1">{activeDebtToPay.tipe === 'Hutang' ? t('debts.modal_pay_note_dec') : t('debts.modal_pay_note_inc')}</p>
              </div>

              <button type="submit" className="w-full bg-savora-800 text-white font-bold py-3 rounded-xl mt-2">{t('debts.modal_btn_pay')}</button>
            </form>
          </div>
        </div>
      )}
    </section>
  )
}
