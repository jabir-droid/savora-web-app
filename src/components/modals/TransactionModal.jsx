import React, { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { transactionService } from '../../services/transactionService'
import { receiptService } from '../../services/receiptService'
import { accountService } from '../../services/accountService'
import { categoryService } from '../../services/categoryService'
import { useToast } from '../../contexts/ToastContext'
import { useLanguage } from '../../contexts/LanguageContext'
import { triggerHaptic } from '../../utils/haptics'
import { CATEGORY_ICONS } from '../../utils/categoryIcons'
import { formatNumberInput, parseNumberInput, formatCurrency } from '../../utils/formatCurrency'
import { currencySymbol } from '../../utils/currency'

const MAX_NOMINAL = 999000000000 // Rp999 miliar — batas maksimum nominal transaksi

export default function TransactionModal({ isOpen, onClose, onSuccess, initialData }) {
  const { t } = useLanguage()
  const { showToast } = useToast()
  const [tipe, setTipe] = useState('Pengeluaran')
  const [kategori, setKategori] = useState('')
  const [jumlah, setJumlah] = useState('')
  const [deskripsi, setDeskripsi] = useState('')
  const [akun, setAkun] = useState('')
  const [transferKe, setTransferKe] = useState('')
  const [tanggal, setTanggal] = useState('')
  
  const [accounts, setAccounts] = useState([])
  const [categories, setCategories] = useState([])
  const [isLoading, setIsLoading] = useState(false)

  // Foto struk (Fase 3): berkas baru yang dipilih, path foto lama
  // (mode edit), URL pratinjau, dan penanda penghapusan.
  const [fotoFile, setFotoFile] = useState(null)
  const [fotoExistingPath, setFotoExistingPath] = useState(null)
  const [fotoPreview, setFotoPreview] = useState('')
  const [fotoRemoved, setFotoRemoved] = useState(false)

  useEffect(() => {
    if (isOpen) {
      // Foto struk: siapkan state dari data awal (mode edit)
      setFotoFile(null)
      setFotoRemoved(false)
      setFotoExistingPath(initialData?.foto_path || null)
      setFotoPreview('')
      if (initialData?.foto_path) {
        receiptService.getReceiptUrl(initialData.foto_path)
          .then(url => { if (url) setFotoPreview(url) })
          .catch(() => {})
      }
      loadData(initialData)
      if (initialData) {
        if (initialData.jumlah) setJumlah(formatNumberInput(initialData.jumlah))
        if (initialData.deskripsi) setDeskripsi(initialData.deskripsi)
        if (initialData.tipe) setTipe(initialData.tipe === 'Transfer' ? 'Transfer Kas' : initialData.tipe)
        if (initialData.created_at) {
          const d = new Date(initialData.created_at)
          const tz = d.getTimezoneOffset() * 60000
          setTanggal(new Date(d - tz).toISOString().slice(0, 10))
        } else {
          const now = new Date()
          const tz = now.getTimezoneOffset() * 60000
          setTanggal(new Date(now - tz).toISOString().slice(0, 10))
        }
      } else {
        setJumlah('')
        setDeskripsi('')
        setTipe('Pengeluaran')
        const now = new Date()
        const tz = now.getTimezoneOffset() * 60000
        setTanggal(new Date(now - tz).toISOString().slice(0, 10))
      }
    }
  }, [isOpen, initialData])

  const loadData = async (initData = null) => {
    try {
      const [accData, catData] = await Promise.all([
        accountService.getAccounts(),
        categoryService.getCategories()
      ])
      
      setAccounts(accData)
      if (accData.length > 0) {
        const activeAcc = sessionStorage.getItem('savora_active_account')
        let defaultAcc = accData[0].namaakun
        
        if (activeAcc && activeAcc !== 'null' && activeAcc !== 'Semua') {
          const exists = accData.find(a => a.namaakun === activeAcc)
          if (exists) defaultAcc = activeAcc
        }
        
        setAkun(initData?.akun || defaultAcc)
        
        const defaultTransferDest = accData.length > 1 
          ? (accData[0].namaakun === defaultAcc ? accData[1].namaakun : accData[0].namaakun) 
          : defaultAcc
          
        setTransferKe(initData?.transferke || defaultTransferDest)
      }

      setCategories(catData)
      if (catData.length > 0) {
        setKategori(initData?.kategori || catData[0].namakategori)
      } else {
        setKategori(initData?.kategori || 'Lainnya') // Fallback
      }
    } catch (e) {
      console.error(e)
    }
  }

  const handleFotoChange = (e) => {
    const file = e.target.files && e.target.files[0]
    e.target.value = ''
    if (!file) return
    if (!file.type.startsWith('image/')) {
      showToast(t('modal_tx.photo_err_type'), 'error')
      return
    }
    if (file.size > 15 * 1024 * 1024) {
      showToast(t('modal_tx.photo_err_size'), 'error')
      return
    }
    if (fotoPreview.startsWith('blob:')) URL.revokeObjectURL(fotoPreview)
    setFotoFile(file)
    setFotoRemoved(false)
    setFotoPreview(URL.createObjectURL(file))
  }

  const handleFotoRemove = () => {
    if (fotoPreview.startsWith('blob:')) URL.revokeObjectURL(fotoPreview)
    setFotoFile(null)
    setFotoPreview('')
    setFotoRemoved(true)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const jumlahNum = parseNumberInput(jumlah)
    if (!jumlahNum || jumlahNum <= 0) {
      showToast(t('modal_tx.amount_invalid'), 'error')
      return
    }
    if (jumlahNum > MAX_NOMINAL) {
      showToast(`${t('modal_tx.amount_max')} ${formatCurrency(MAX_NOMINAL)}`, 'error')
      return
    }
    setIsLoading(true)

    // Foto struk: unggah dulu bila ada berkas baru. Kegagalan unggah
    // membatalkan penyimpanan agar tidak ada transaksi yang mengaku
    // memiliki foto yang sebenarnya tidak tersimpan.
    let fotoPath = fotoExistingPath
    let uploadedPath = null
    if (fotoFile) {
      try {
        uploadedPath = await receiptService.uploadReceipt(fotoFile)
        fotoPath = uploadedPath
      } catch (upErr) {
        showToast(t('modal_tx.photo_err_upload') + upErr.message, 'error')
        setIsLoading(false)
        return
      }
    } else if (fotoRemoved) {
      fotoPath = null
    }

    try {
      const payload = {
        tipe: tipe === 'Tabungan' ? 'Pengeluaran' : (tipe === 'Transfer Kas' ? 'Transfer' : tipe),
        // Transfer antar-kas selalu berkategori 'Transfer' agar tidak
        // mengacaukan laporan kategori pemasukan/pengeluaran.
        kategori: tipe === 'Tabungan' ? 'Tabungan' : (tipe === 'Transfer Kas' ? 'Transfer' : kategori),
        jumlah: jumlahNum,
        deskripsi,
        akun,
        transferke: tipe === 'Transfer Kas' ? transferKe : null,
        tanggal: new Date(tanggal).toISOString(),
        foto_path: fotoPath
      }

      if (initialData && initialData.id) {
        await transactionService.updateTransaction(initialData.id, initialData, payload)
        showToast("Transaksi berhasil diperbarui!", 'success')
      } else {
        await transactionService.addTransaction(payload)
        showToast(t('modal_tx.success'), 'success')
      }
      // Simpan berhasil: bersihkan berkas lama bila diganti/dihapus
      if (fotoExistingPath && fotoPath !== fotoExistingPath) {
        receiptService.deleteReceipt(fotoExistingPath)
      }
      triggerHaptic([50])
      onSuccess() // Memicu refresh dashboard
      onClose()

      // Reset form
      setJumlah('')
      setDeskripsi('')
    } catch (e) {
      // Simpan gagal setelah foto terunggah: bersihkan berkas yatimnya
      if (uploadedPath) receiptService.deleteReceipt(uploadedPath)
      showToast(t('modal_tx.fail') + e.message, 'error')
    } finally {
      setIsLoading(false)
    }
  }

  if (!isOpen) return null

  return createPortal(
    <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4 transition-opacity duration-300">
      <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl transform transition-transform duration-300 max-h-[90vh] overflow-y-auto">
        
        <div className="flex justify-between items-center mb-6">
          <h3 className="font-extrabold text-xl text-slate-800">
            {initialData && initialData.id ? "Edit Transaksi" : t('modal_tx.title_new')}
          </h3>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-xl transition">
            <i className="fa-solid fa-xmark text-lg"></i>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          
          <div>
            <label className="block text-xs text-slate-500 mb-2 font-semibold">{t('modal_tx.type_label')}</label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <button type="button" onClick={() => setTipe('Pemasukan')}
                className={`py-2 px-1 rounded-xl border-2 text-[10px] font-bold text-center flex flex-col items-center justify-center gap-1 transition ${tipe === 'Pemasukan' ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-slate-200 text-slate-500 hover:bg-slate-50'}`}>
                <i className="fa-solid fa-circle-arrow-down text-base"></i>
                <span>{t('modal_tx.income')}</span>
              </button>
              <button type="button" onClick={() => setTipe('Pengeluaran')}
                className={`py-2 px-1 rounded-xl border-2 text-[10px] font-bold text-center flex flex-col items-center justify-center gap-1 transition ${tipe === 'Pengeluaran' ? 'border-rose-500 bg-rose-50 text-rose-700' : 'border-slate-200 text-slate-500 hover:bg-slate-50'}`}>
                <i className="fa-solid fa-circle-arrow-up text-base"></i>
                <span>{t('modal_tx.expense')}</span>
              </button>
              <button type="button" onClick={() => setTipe('Tabungan')}
                className={`py-2 px-1 rounded-xl border-2 text-[10px] font-bold text-center flex flex-col items-center justify-center gap-1 transition ${tipe === 'Tabungan' ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-200 text-slate-500 hover:bg-slate-50'}`}>
                <i className="fa-solid fa-piggy-bank text-base"></i>
                <span>{t('modal_tx.saving')}</span>
              </button>
              <button type="button" onClick={() => setTipe('Transfer Kas')}
                className={`py-2 px-1 rounded-xl border-2 text-[10px] font-bold text-center flex flex-col items-center justify-center gap-1 transition ${tipe === 'Transfer Kas' ? 'border-amber-500 bg-amber-50 text-amber-700' : 'border-slate-200 text-slate-500 hover:bg-slate-50'}`}>
                <i className="fa-solid fa-money-bill-transfer text-base"></i>
                <span>{t('modal_tx.transfer')}</span>
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs text-slate-500 mb-1 font-semibold">{t('modal_tx.amount_label')}</label>
            <div className="relative">
              <span className="absolute left-3 top-2.5 font-bold text-slate-400 text-sm">{currencySymbol((accounts.find(a => a.namaakun === akun) || {}).mata_uang || 'IDR')}</span>
              <input type="text" inputMode="numeric" required value={jumlah} onChange={e => setJumlah(formatNumberInput(e.target.value))}
                placeholder={t('modal_tx.amount_ph')}
                className="w-full border-2 border-slate-200 rounded-xl px-3 py-2 text-base font-bold text-slate-800 focus:outline-none focus:border-savora-800 pl-10 transition-all duration-300"
              />
            </div>
          </div>

          {tipe !== 'Tabungan' && tipe !== 'Transfer Kas' && (
            <div>
              <label className="block text-xs text-slate-500 mb-2 font-semibold">{t('modal_tx.category_label')}</label>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2 pb-2">
                {categories.filter(c => c.tipe === tipe).length > 0 ? (
                  categories.filter(c => c.tipe === tipe).map(c => {
                    const iconData = CATEGORY_ICONS[c.namakategori] || { icon: 'fa-tag', color: 'text-slate-500', bg: 'bg-slate-50', tKey: null }
                    const displayName = iconData.tKey ? t(iconData.tKey) : c.namakategori
                    
                    return (
                      <button 
                        key={c.id} 
                        type="button"
                        onClick={() => setKategori(c.namakategori)}
                        className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold transition-all border ${kategori === c.namakategori ? 'bg-savora-800 text-white border-savora-800 shadow-md' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50 active:scale-95'}`}
                      >
                        <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${kategori === c.namakategori ? 'bg-white/20 text-white' : `${iconData.bg} ${iconData.color}`}`}>
                          <i className={`fa-solid ${iconData.icon}`}></i>
                        </div>
                        <span className="truncate text-left">{displayName}</span>
                      </button>
                    )
                  })
                ) : (
                  <div className="col-span-2 md:col-span-3 bg-slate-50 border border-slate-200 border-dashed rounded-xl p-4 text-center">
                    <p className="text-xs text-slate-500 mb-2">Belum ada kategori untuk {tipe === 'Pemasukan' ? t('tx.type_income') : t('tx.type_expense')}.</p>
                    <button 
                      type="button"
                      onClick={() => {
                        onClose()
                        // Since we can't easily redirect, we just show toast/info
                        alert('Silakan menuju halaman Pengaturan Kategori, lalu tekan tombol "Muat Bawaan" untuk memuat kategori standar.')
                      }}
                      className="text-xs font-bold bg-savora-800 text-white px-4 py-2 rounded-lg shadow-md hover:bg-slate-800 transition"
                    >
                      Buka Pengaturan Kategori
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs text-slate-500 mb-1 font-semibold">{t('modal_tx.desc_label')}</label>
            <input type="text" required value={deskripsi} onChange={e => setDeskripsi(e.target.value)}
              placeholder={t('modal_tx.desc_ph')}
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-savora-800"
            />
          </div>

          <div>
            <label className="block text-xs text-slate-500 mb-1 font-semibold">{t('modal_tx.date_label')}</label>
            <input type="date" required value={tanggal} onChange={e => setTanggal(e.target.value)}
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-savora-800"
            />
          </div>

          <div>
            <label className="block text-xs text-slate-500 mb-1 font-semibold">{t('modal_tx.photo_label')}</label>
            {fotoPreview ? (
              <div className="space-y-2">
                <img src={fotoPreview} alt="" className="w-full max-h-48 object-cover rounded-xl border border-slate-200" />
                <div className="flex gap-2">
                  <label className="flex-1 flex items-center justify-center gap-2 border border-slate-200 rounded-xl py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 transition cursor-pointer">
                    <i className="fa-solid fa-rotate"></i> {t('modal_tx.photo_change')}
                    <input type="file" accept="image/*" className="hidden" onChange={handleFotoChange} />
                  </label>
                  <button type="button" onClick={handleFotoRemove}
                    className="flex-1 flex items-center justify-center gap-2 border border-rose-200 bg-rose-50 rounded-xl py-2 text-xs font-bold text-rose-600 hover:bg-rose-100 transition">
                    <i className="fa-solid fa-trash"></i> {t('modal_tx.photo_remove')}
                  </button>
                </div>
              </div>
            ) : (
              <label className="flex items-center justify-center gap-2 w-full border-2 border-dashed border-slate-200 rounded-xl py-3 text-xs font-bold text-slate-500 hover:bg-slate-50 transition cursor-pointer">
                <i className="fa-solid fa-camera"></i> {t('modal_tx.photo_add')}
                <input type="file" accept="image/*" className="hidden" onChange={handleFotoChange} />
              </label>
            )}
          </div>

          <div>
            <label className="block text-xs text-slate-500 mb-1 font-semibold">{tipe === 'Transfer Kas' ? t('modal_tx.source_account') : t('modal_tx.account')}</label>
            <select value={akun} onChange={e => setAkun(e.target.value)}
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-savora-800">
              {accounts.map(acc => (
                <option key={acc.id} value={acc.namaakun}>{acc.namaakun}</option>
              ))}
            </select>
          </div>

          {tipe === 'Transfer Kas' && (
            <div>
              <label className="block text-xs text-slate-500 mb-1 font-semibold">{t('modal_tx.dest_account')}</label>
              <select value={transferKe} onChange={e => setTransferKe(e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-savora-800">
                {accounts.map(acc => (
                  <option key={acc.id} value={acc.namaakun}>{acc.namaakun}</option>
                ))}
              </select>
              {(() => {
                const src = accounts.find(a => a.namaakun === akun)
                const dst = accounts.find(a => a.namaakun === transferKe)
                const fxDiffers = src && dst && (src.mata_uang || 'IDR') !== (dst.mata_uang || 'IDR')
                return fxDiffers ? (
                  <p className="text-[11px] text-amber-600 mt-1.5 flex items-start gap-1">
                    <i className="fa-solid fa-triangle-exclamation mt-0.5"></i>
                    <span>{t('modal_tx.fx_transfer_warn')}</span>
                  </p>
                ) : null
              })()}
            </div>
          )}

          <button disabled={isLoading} type="submit"
            className="w-full bg-savora-800 hover:bg-savora-900 text-white font-bold py-3 rounded-xl shadow-lg shadow-savora-800/20 active:scale-95 transition mt-4">
            {isLoading ? t('modal_tx.btn_saving') : (initialData && initialData.id ? "Simpan Perubahan" : t('modal_tx.btn_save'))}
          </button>
        </form>
      </div>
    </div>,
    document.body
  )
}
