import React, { useState, useEffect, useRef } from 'react'
import { accountService } from '../services/accountService'
import { transactionService } from '../services/transactionService'
import { useAuth } from '../contexts/AuthContext'
import { useLanguage } from '../contexts/LanguageContext'
import { formatCurrency } from '../utils/formatCurrency'
import { useToast } from '../contexts/ToastContext'
import { settingsService } from '../services/settingsService'
import TransactionModal from './modals/TransactionModal'
import { SkeletonDashboardCard, SkeletonAccountList, SkeletonCard } from './SkeletonLoader'

export default function Dashboard({ setActiveTab }) {
  const { user } = useAuth()
  const { t } = useLanguage()
  const { showToast } = useToast()
  const scrollRef = useRef(null)
  
  const [totalBalance, setTotalBalance] = useState(0)
  const [accounts, setAccounts] = useState([])
  const [transactions, setTransactions] = useState([])
  const [summary, setSummary] = useState({ pemasukan: 0, pengeluaran: 0 })
  const [isLoading, setIsLoading] = useState(true)
  const [selectedAccount, setSelectedAccount] = useState(() => {
    const saved = sessionStorage.getItem('savora_active_account')
    return saved && saved !== 'null' ? saved : null
  })
  const [isOcrLoading, setIsOcrLoading] = useState(false)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [ocrResult, setOcrResult] = useState(null)
  
  const [isBalanceHidden, setIsBalanceHidden] = useState(() => {
    return localStorage.getItem('savora_hide_balance') === 'true'
  })
  
  const toggleBalanceVisibility = () => {
    setIsBalanceHidden(prev => {
      const next = !prev
      localStorage.setItem('savora_hide_balance', String(next))
      return next
    })
  }

  // Create a ref for the hidden file input
  const fileInputRef = useRef(null)

  useEffect(() => {
    // If this is the first time the app is loaded in this session
    if (!sessionStorage.getItem('savora_session_started')) {
      sessionStorage.setItem('savora_session_started', 'true')
      import('../services/settingsService').then(mod => {
        mod.settingsService.getSettings().then(s => {
          if (s && s.default_account) {
            sessionStorage.setItem('savora_active_account', s.default_account)
            setSelectedAccount(s.default_account)
          }
        })
      })
    }
  }, [])

  // Format Date
  const formatDate = (dateString) => {
    const options = { day: 'numeric', month: 'short', year: 'numeric' }
    return new Intl.DateTimeFormat('id-ID', options).format(new Date(dateString))
  }

  const loadData = async () => {
    try {
      setIsLoading(true)
      
      const [accData, totalBal, txData, sumData] = await Promise.all([
        accountService.getAccounts(),
        accountService.getTotalBalance(),
        transactionService.getTransactions(5, selectedAccount),
        transactionService.getTransactionSummary(selectedAccount)
      ])

      // Jika user belum punya akun satupun, buatkan akun default
      if (accData.length === 0) {
        await accountService.createAccount('Dompet Utama', 'CASH', 0)
        // Refresh data akun
        const newAccData = await accountService.getAccounts()
        setAccounts(newAccData)
      } else {
        setAccounts(accData)
      }

      setTotalBalance(totalBal)
      setTransactions(txData)
      setSummary(sumData)
    } catch (error) {
      console.error("Gagal memuat data dashboard:", error)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [selectedAccount])

  if (isLoading) {
    return (
      <section className="space-y-6 animate-fade-in w-full">
        <SkeletonDashboardCard />
        <div className="space-y-3">
          <div className="h-4 bg-slate-200 rounded animate-skeleton-pulse w-1/4 mb-4"></div>
          <SkeletonAccountList />
        </div>
        <SkeletonCard />
      </section>
    )
  }

  const handleAccountClick = (accountName) => {
    setSelectedAccount(accountName)
    sessionStorage.setItem('savora_active_account', accountName || 'null')
  }

  const scrollContainer = (direction) => {
    if (scrollRef.current) {
      const scrollAmount = 200
      scrollRef.current.scrollBy({ left: direction === 'left' ? -scrollAmount : scrollAmount, behavior: 'smooth' })
    }
  }

  const handleOcrScan = async (e) => {
    const file = e.target.files[0]
    if (!file) return

    setIsOcrLoading(true)
    showToast(t('dashboard.ocr_start'), 'info')

    try {
      // 1. Get Groq API Key
      const s = await settingsService.getSettings()
      if (!s || !s.groq_api_key) {
        throw new Error(t('dashboard.ocr_err_key'))
      }

      // 2. Compress and Convert file to Base64
      const getCompressedBase64 = (file) => new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.readAsDataURL(file)
        reader.onload = (event) => {
          const img = new Image()
          img.src = event.target.result
          img.onload = () => {
            const canvas = document.createElement('canvas')
            const MAX_WIDTH = 1000
            const MAX_HEIGHT = 1000
            let width = img.width
            let height = img.height

            if (width > height) {
              if (width > MAX_WIDTH) {
                height *= MAX_WIDTH / width
                width = MAX_WIDTH
              }
            } else {
              if (height > MAX_HEIGHT) {
                width *= MAX_HEIGHT / height
                height = MAX_HEIGHT
              }
            }
            canvas.width = width
            canvas.height = height
            const ctx = canvas.getContext('2d')
            ctx.drawImage(img, 0, 0, width, height)
            resolve(canvas.toDataURL('image/jpeg', 0.7)) // Compress to 70% quality JPEG
          }
          img.onerror = (error) => reject(error)
        }
        reader.onerror = error => reject(error)
      })
      
      const base64Image = await getCompressedBase64(file)

      // 3. Call Groq API
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${s.groq_api_key}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'llama-3.2-11b-vision-preview',
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: 'You are a receipt parser. Extract the total final amount and a short description of the purchase (max 5 words, e.g. "Makan Siang KFC"). Return ONLY a valid JSON object without markdown formatting, like this: {"jumlah": 50000, "deskripsi": "Makan Siang KFC"}. Ensure jumlah is a plain number.'
                },
                {
                  type: 'image_url',
                  image_url: {
                    url: base64Image
                  }
                }
              ]
            }
          ],
          temperature: 0.1,
          max_tokens: 150
        })
      })

      const data = await response.json()
      
      if (!response.ok) {
        throw new Error(data.error?.message || t('dashboard.ocr_err_api'))
      }

      const content = data.choices[0].message.content.trim()
      let parsed = null
      
      // Remove possible markdown formatting from response if AI ignored instruction
      const jsonStr = content.replace(/```json/g, '').replace(/```/g, '').trim()
      
      try {
        parsed = JSON.parse(jsonStr)
      } catch (e) {
        throw new Error(t('dashboard.ocr_err_format'))
      }

      if (parsed.jumlah && parsed.jumlah > 0) {
        showToast(t('dashboard.ocr_success'), 'success')
        setOcrResult({
          jumlah: parsed.jumlah,
          deskripsi: parsed.deskripsi || 'Belanja'
        })
        setIsModalOpen(true)
      } else {
        showToast(t('dashboard.ocr_invalid'), 'error')
      }
    } catch (err) {
      showToast(t('dashboard.ocr_fail') + err.message, 'error')
    } finally {
      setIsOcrLoading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  // Derive displayed balance
  let displayedBalance = totalBalance
  let activeAccountLabel = t('dashboard.total_dana')
  if (selectedAccount) {
    const acc = accounts.find(a => a.namaakun === selectedAccount)
    if (acc) {
      displayedBalance = acc.saldo
      activeAccountLabel = `Saldo ${acc.namaakun}`
    }
  }

  return (
    <section className="space-y-6 animate-fade-in">
      {/* Kartu Utama */}
      <div className="bg-gradient-to-br from-savora-900 to-savora-800 text-white rounded-3xl p-6 md:p-8 shadow-2xl relative overflow-hidden flex flex-col justify-between border border-savora-800/40 min-h-[190px]">
        <svg className="absolute bottom-0 right-0 w-full h-24 z-0 pointer-events-none opacity-20"
          viewBox="0 0 1440 320" fill="none" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none">
          <path
            d="M0,160L48,176C96,192,192,224,288,213.3C384,203,480,149,576,149.3C672,149,768,203,864,224C960,245,1056,235,1152,213.3C1248,192,1344,160,1392,144L1440,128L1440,320L1392,320C1344,320,1248,320,1152,320C1056,320,960,320,864,320C768,320,672,320,576,320C480,320,384,320,288,320C192,320,96,320,48,320L0,320Z"
            fill="#FFF" />
        </svg>

        <div className="relative z-10 flex justify-between items-start">
          <div>
            <div className="flex items-center gap-2 text-slate-300 text-xs font-semibold tracking-wider uppercase mb-1">
              <i className="fa-solid fa-wallet text-savora-orange text-lg"></i>
              <span>{activeAccountLabel}</span>
            </div>
            <div className="flex items-center gap-3 mt-1">
              <h3 className="text-3xl md:text-4xl font-extrabold tracking-tight">
                {isBalanceHidden ? '********' : formatCurrency(displayedBalance)}
              </h3>
              <button type="button" onClick={toggleBalanceVisibility} className="p-2 text-slate-300 hover:text-white transition relative z-20 cursor-pointer">
                <i className={`fa-solid ${isBalanceHidden ? 'fa-eye-slash' : 'fa-eye'}`}></i>
              </button>
            </div>
          </div>
          <div className="flex items-center gap-2.5 bg-white/5 border border-white/10 p-2 rounded-2xl">
            <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-savora-orange to-amber-400 flex items-center justify-center font-bold text-sm text-white uppercase">
              {user?.email?.[0] || 'S'}
            </div>
            <div className="hidden sm:block text-left pr-2">
              <p className="text-[9px] text-slate-400">{t('dashboard.welcome')}</p>
              <p className="text-xs font-bold text-white leading-none truncate max-w-[100px]">
                {user?.email?.split('@')[0] || t('dashboard.user_default')}
              </p>
            </div>
          </div>
        </div>

        <div className="relative z-10 grid grid-cols-2 gap-4 mt-6 bg-white/5 backdrop-blur-md rounded-2xl p-3 border border-white/10 text-xs">
          <div className="flex items-center gap-3 border-r border-white/10 pr-2">
            <span className="w-8 h-8 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-400 text-base shrink-0">
              <i className="fa-solid fa-arrow-down"></i>
            </span>
            <div className="truncate">
              <p className="text-slate-400 font-semibold tracking-wider uppercase text-[9px]">{t('dashboard.pemasukan')}</p>
              <p className="font-extrabold text-sm text-emerald-400 truncate">
                {isBalanceHidden ? '******' : formatCurrency(summary.pemasukan)}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 pl-2">
            <span className="w-8 h-8 rounded-xl bg-rose-500/10 flex items-center justify-center text-rose-400 text-base shrink-0">
              <i className="fa-solid fa-arrow-up"></i>
            </span>
            <div className="truncate">
              <p className="text-slate-400 font-semibold tracking-wider uppercase text-[9px]">{t('dashboard.pengeluaran')}</p>
              <p className="font-extrabold text-sm text-rose-400 truncate">
                {isBalanceHidden ? '******' : formatCurrency(summary.pengeluaran)}
              </p>
            </div>
          </div>
        </div>
      </div>
      
      {/* Menu Cepat (Quick Actions) */}
      <div className="grid grid-cols-4 gap-3">
        <button 
          onClick={() => { setOcrResult({ tipe: 'Pemasukan' }); setIsModalOpen(true); }} 
          className="bg-white p-3 rounded-2xl shadow-sm border border-slate-100 flex flex-col items-center justify-center gap-2 hover:bg-slate-50 transition active:scale-95"
        >
          <div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-500 text-lg">
            <i className="fa-solid fa-plus"></i>
          </div>
          <span className="text-[10px] font-bold text-slate-600">Pemasukan</span>
        </button>
        <button 
          onClick={() => { setOcrResult({ tipe: 'Pengeluaran' }); setIsModalOpen(true); }} 
          className="bg-white p-3 rounded-2xl shadow-sm border border-slate-100 flex flex-col items-center justify-center gap-2 hover:bg-slate-50 transition active:scale-95"
        >
          <div className="w-10 h-10 rounded-full bg-rose-50 flex items-center justify-center text-rose-500 text-lg">
            <i className="fa-solid fa-minus"></i>
          </div>
          <span className="text-[10px] font-bold text-slate-600">Pengeluaran</span>
        </button>
        <button 
          onClick={() => setActiveTab('savings')} 
          className="bg-white p-3 rounded-2xl shadow-sm border border-slate-100 flex flex-col items-center justify-center gap-2 hover:bg-slate-50 transition active:scale-95"
        >
          <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-500 text-lg">
            <i className="fa-solid fa-piggy-bank"></i>
          </div>
          <span className="text-[10px] font-bold text-slate-600">Tabungan</span>
        </button>
        <button 
          onClick={() => setActiveTab('ai_assistant')} 
          className="bg-white p-3 rounded-2xl shadow-sm border border-slate-100 flex flex-col items-center justify-center gap-2 hover:bg-slate-50 transition active:scale-95"
        >
          <div className="w-10 h-10 rounded-full bg-purple-50 flex items-center justify-center text-purple-500 text-lg">
            <i className="fa-solid fa-robot"></i>
          </div>
          <span className="text-[10px] font-bold text-slate-600">Asisten AI</span>
        </button>
      </div>
      
      {isModalOpen && (
        <TransactionModal 
          isOpen={isModalOpen} 
          onClose={() => setIsModalOpen(false)} 
          onSuccess={loadData}
          initialData={ocrResult}
        />
      )}

      {/* Akun & Saldo */}
      <div className="space-y-3">
        <div className="flex justify-between items-center px-1">
          <h4 className="font-extrabold text-sm text-slate-800 flex items-center gap-1.5">
            {t('dashboard.akun_saldo')}
          </h4>
          <div className="flex items-center gap-3 shrink-0">
            <div className="flex items-center gap-1 mr-2 hidden md:flex">
              <button onClick={() => scrollContainer('left')} className="p-1.5 bg-white border border-slate-200 text-slate-500 rounded-lg hover:bg-slate-50 hover:text-slate-700 transition">
                <i className="fa-solid fa-chevron-left text-xs"></i>
              </button>
              <button onClick={() => scrollContainer('right')} className="p-1.5 bg-white border border-slate-200 text-slate-500 rounded-lg hover:bg-slate-50 hover:text-slate-700 transition">
                <i className="fa-solid fa-chevron-right text-xs"></i>
              </button>
            </div>
            <button onClick={() => setActiveTab('settings')} className="text-xs font-bold text-savora-orange hover:underline">{t('dashboard.kelola_akun')}</button>
            <span className="text-slate-300">|</span>
            <button onClick={() => setActiveTab('categories')} className="text-xs font-bold text-savora-orange hover:underline">{t('dashboard.kelola_kategori')}</button>
          </div>
        </div>

        <div ref={scrollRef} className="flex gap-4 overflow-x-auto no-scrollbar pb-2 pt-1 -mx-4 px-4 md:mx-0 md:px-0 scroll-smooth">
          <div onClick={() => handleAccountClick(null)} className={`min-w-[140px] border rounded-2xl p-3 shadow-sm transition cursor-pointer ${!selectedAccount ? 'bg-savora-900 border-savora-800 text-white' : 'bg-white border-slate-200 hover:border-savora-800 hover:bg-slate-50'}`}>
            <p className={`text-[10px] font-bold uppercase mb-1 ${!selectedAccount ? 'text-slate-300' : 'text-slate-400'}`}>{t('dashboard.semua_rekening')}</p>
            <p className={`text-sm font-extrabold ${!selectedAccount ? 'text-white' : 'text-slate-800'}`}>
              {isBalanceHidden ? '******' : formatCurrency(totalBalance)}
            </p>
          </div>
          
          {accounts.map(acc => {
            const isActive = selectedAccount === acc.namaakun
            return (
              <div key={acc.id} onClick={() => handleAccountClick(acc.namaakun)} className={`min-w-[140px] border rounded-2xl p-3 shadow-sm transition cursor-pointer ${isActive ? 'bg-savora-900 border-savora-800 text-white' : 'bg-white border-slate-200 hover:border-savora-800 hover:bg-slate-50'}`}>
                <p className={`text-[10px] font-bold uppercase mb-1 flex items-center gap-1.5 ${isActive ? 'text-slate-300' : 'text-slate-400'}`}>
                  <i className={`fa-solid ${acc.tipe === 'BANK' ? 'fa-building-columns' : 'fa-wallet'}`}></i> {acc.tipe || 'CASH'}
                </p>
                <p className={`text-sm font-extrabold mt-1 ${isActive ? 'text-white' : 'text-slate-800'}`}>{acc.namaakun}</p>
                <p className={`text-xs font-semibold mt-0.5 ${isActive ? 'text-slate-400' : 'text-slate-500'}`}>
                  {isBalanceHidden ? '******' : formatCurrency(acc.saldo)}
                </p>
              </div>
            )
          })}
        </div>
      </div>

      {/* Savora AI Scan Banner moved up */}
      <div className="bg-savora-100/50 rounded-2xl p-4 border border-savora-200/60 flex items-center justify-between gap-4 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-savora-800 rounded-xl text-white shrink-0">
            <i className={`fa-solid ${isOcrLoading ? 'fa-spinner fa-spin' : 'fa-wand-magic-sparkles'} text-savora-orange`}></i>
          </div>
          <div>
            <h4 className="font-bold text-savora-900 text-sm">{isOcrLoading ? t('dashboard.ocr_title_loading') : t('dashboard.ocr_title')}</h4>
            <p className="text-xs text-savora-800/70 mt-0.5">{isOcrLoading ? t('dashboard.ocr_subtitle_loading') : t('dashboard.ocr_subtitle')}</p>
          </div>
        </div>
        
        <input 
          type="file" 
          accept="image/*" 
          capture="environment" 
          ref={fileInputRef} 
          onChange={handleOcrScan} 
          className="hidden" 
        />
        
        <button 
          onClick={() => fileInputRef.current?.click()} 
          disabled={isOcrLoading}
          className="bg-savora-800 hover:bg-savora-900 text-white text-xs font-semibold px-4 py-2.5 rounded-xl transition shadow-sm whitespace-nowrap disabled:opacity-50 flex items-center gap-2"
        >
          <i className="fa-solid fa-camera"></i> {isOcrLoading ? t('dashboard.btn_scanning') : t('dashboard.btn_scan')}
        </button>
      </div>

      {/* Transaksi Terakhir */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/60">
        <div className="flex justify-between items-center mb-6">
            <div>
              <h3 className="font-bold text-lg text-slate-800">{t('dashboard.transaksi_terakhir')}</h3>
              <p className="text-xs text-slate-400">{t('dashboard.aktivitas_terbaru')}</p>
            </div>
            <button onClick={() => setActiveTab('transactions')} className="text-xs text-savora-orange hover:underline font-bold flex items-center gap-1">
              <span>{t('dashboard.lihat_semua')}</span> <span>»</span>
            </button>
          </div>

          <div className="space-y-4">
            {transactions.length === 0 ? (
              <div className="text-center py-8 text-slate-400 text-sm">
                <span className="text-3xl mb-2 text-slate-200 animate-pulse block">📄</span>
                <p>{t('dashboard.tx_empty')}</p>
              </div>
            ) : (
              transactions.map(tx => (
                <div key={tx.id} className="flex justify-between items-center p-3 hover:bg-slate-50 rounded-xl transition cursor-pointer border border-transparent hover:border-slate-100">
                  <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                      tx.tipe === 'Pemasukan' ? 'bg-emerald-100 text-emerald-600' : 
                      tx.tipe === 'Pengeluaran' ? 'bg-rose-100 text-rose-600' : 'bg-blue-100 text-blue-600'
                    }`}>
                      <i className={`fa-solid ${tx.tipe === 'Pemasukan' ? 'fa-arrow-down' : tx.tipe === 'Pengeluaran' ? 'fa-arrow-up' : 'fa-right-left'}`}></i>
                    </div>
                    <div>
                      <p className="font-bold text-sm text-slate-800">{tx.kategori}</p>
                      <div className="flex items-center gap-2 text-[10px] font-semibold text-slate-400 mt-0.5">
                        <span className="bg-slate-100 px-1.5 py-0.5 rounded text-slate-500">{tx.akun}</span>
                        <span>•</span>
                        <span>{formatDate(tx.created_at)}</span>
                      </div>
                      {tx.deskripsi && (
                        <p className="text-xs text-slate-500 mt-0.5">{tx.deskripsi}</p>
                      )}
                    </div>
                  </div>
                  <div className={`font-extrabold text-sm ${
                    tx.tipe === 'Pemasukan' ? 'text-emerald-500' : 
                    tx.tipe === 'Pengeluaran' ? 'text-rose-500' : 'text-blue-500'
                  }`}>
                    {isBalanceHidden ? '******' : (
                      <>{tx.tipe === 'Pemasukan' ? '+' : tx.tipe === 'Pengeluaran' ? '-' : ''} {formatCurrency(tx.jumlah)}</>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
    </section>
  )
}
