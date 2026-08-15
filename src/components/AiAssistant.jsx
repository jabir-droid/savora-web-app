import React, { useState, useRef, useEffect } from 'react'
import { transactionService } from '../services/transactionService'
import { accountService } from '../services/accountService'
import { formatCurrency } from '../utils/formatCurrency'
import { useLanguage } from '../contexts/LanguageContext'
import ConfirmModal from './modals/ConfirmModal'
import { settingsService } from '../services/settingsService'

const parseMarkdown = (text) => {
  if (!text) return { __html: '' }
  let html = text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/\n/g, '<br />')
  return { __html: html }
}

export default function AiAssistant() {
  const { t } = useLanguage()
  
  const [consultMessages, setConsultMessages] = useState(() => {
    const saved = localStorage.getItem('savora_ai_consult')
    if (saved) return JSON.parse(saved)
    return [{ sender: 'ai', text: t('ai.consult_welcome') }]
  })
  
  const [catatMessages, setCatatMessages] = useState(() => {
    const saved = localStorage.getItem('savora_ai_catat')
    if (saved) return JSON.parse(saved)
    return [{ sender: 'ai', text: t('ai.catat_welcome') }]
  })

  const [input, setInput] = useState('')
  const [mode, setMode] = useState('consult')
  const [isTyping, setIsTyping] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  
  const endOfMessagesRef = useRef(null)

  const activeMessages = mode === 'consult' ? consultMessages : catatMessages

  // Save to local storage whenever messages change
  useEffect(() => {
    localStorage.setItem('savora_ai_consult', JSON.stringify(consultMessages))
  }, [consultMessages])

  useEffect(() => {
    localStorage.setItem('savora_ai_catat', JSON.stringify(catatMessages))
  }, [catatMessages])

  const clearHistory = () => {
    if (mode === 'consult') {
      setConsultMessages([{ sender: 'ai', text: t('ai.consult_cleared') }])
    } else {
      setCatatMessages([{ sender: 'ai', text: t('ai.catat_cleared') }])
    }
  }


  useEffect(() => {
    endOfMessagesRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [activeMessages, isTyping])

  const handleSend = () => {
    if (!input.trim()) return
    
    const userMsg = input.trim()
    const currentMode = mode
    const currentSetMessages = currentMode === 'consult' ? setConsultMessages : setCatatMessages

    currentSetMessages(prev => [...prev, { sender: 'user', text: userMsg }])
    setInput('')
    setIsTyping(true)

    // Mengirim ke API Groq jika tersedia
    setTimeout(async () => {
      let aiResponse = ""
      try {
        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            mode: currentMode,
            message: userMsg
          })
        })

        if (!response.ok) {
           const errData = await response.json().catch(() => ({}))
           throw new Error(errData.error || 'Gagal menghubungi server AI')
        }
        
        const data = await response.json()

        if (currentMode === 'consult') {
          aiResponse = data.response
        } else {
          // Mode Catat menggunakan NLP
          const content = data.response
          
          let parsed = null
          const jsonStr = content.replace(/```json/g, '').replace(/```/g, '').trim()
          try {
            parsed = JSON.parse(jsonStr)
          } catch (e) {
            throw new Error('Format balasan AI tidak valid')
          }

          if (parsed.error) {
             aiResponse = "Maaf, saya tidak mengerti maksud pencatatan tersebut. Mohon gunakan format yang lebih jelas (misal: 'Beli makan 50 ribu pakai cash')."
          } else {
            const tipe = parsed.action === 'pemasukan' ? 'Pemasukan' : 'Pengeluaran'
            const kategori = tipe === 'Pemasukan' ? 'Pendapatan AI' : 'Belanja AI'
            const amount = Number(parsed.amount)
            const desc = parsed.desc
            const accountStr = parsed.account || 'Dompet Utama'

            const accounts = await accountService.getAccounts()
            let targetAccount = accounts.find(a => a.namaakun.toLowerCase() === accountStr.toLowerCase())
            
            let accountMsg = ""
            if (!targetAccount) {
               const capitalizedAcc = accountStr.charAt(0).toUpperCase() + accountStr.slice(1)
               await accountService.createAccount(capitalizedAcc, 'CASH', 0)
               targetAccount = { namaakun: capitalizedAcc }
               accountMsg = t('ai.acc_created').replace('{account}', capitalizedAcc)
            }

            await transactionService.addTransaction({
               tipe,
               kategori,
               jumlah: amount,
               akun: targetAccount.namaakun,
               transferke: '',
               deskripsi: desc,
            })
            
            aiResponse = t('ai.response_catat_success')
              .replace('{type}', tipe === 'Pemasukan' ? t('tx.type_income') : t('tx.type_expense'))
              .replace('{amount}', formatCurrency(amount))
              .replace('{desc}', desc)
              .replace('{account}', targetAccount.namaakun)
              .replace('{accMsg}', accountMsg)
          }
        }
      } catch (err) {
        aiResponse = "Maaf, terjadi kesalahan: " + err.message
      }

      currentSetMessages(prev => [...prev, { sender: 'ai', text: aiResponse }])
      setIsTyping(false)
    }, 500)
  }

  return (
    <section className="space-y-6 animate-fade-in h-full flex flex-col">
      <div className="bg-white rounded-2xl p-4 md:p-6 shadow-sm border border-slate-200/60 flex flex-col flex-1 min-h-[calc(100vh-140px)] md:min-h-0 md:h-[520px]">
        
        <div className="border-b border-slate-100 pb-4 mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-savora-100 rounded-full flex items-center justify-center text-savora-800">
              <i className="fa-solid fa-robot text-xl"></i>
            </div>
            <div>
              <h3 className="font-bold text-slate-800 text-sm">{t('ai.title')}</h3>
              <p className="text-xs text-slate-400 flex items-center gap-1">
                <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span> {t('ai.status')}
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            <div className="flex bg-slate-100 p-1 rounded-xl self-start sm:self-center">
              <button onClick={() => setMode('consult')} className={`px-3.5 py-1.5 rounded-lg text-xs transition-all duration-200 flex items-center gap-1.5 ${mode === 'consult' ? 'font-bold bg-savora-800 text-white shadow-sm' : 'font-semibold text-slate-500 hover:text-slate-800'}`}>
                <i className="fa-solid fa-comments"></i> {t('ai.mode_consult')}
              </button>
              <button onClick={() => setMode('catat')} className={`px-3.5 py-1.5 rounded-lg text-xs transition-all duration-200 flex items-center gap-1.5 ${mode === 'catat' ? 'font-bold bg-savora-800 text-white shadow-sm' : 'font-semibold text-slate-500 hover:text-slate-800'}`}>
                <i className="fa-solid fa-bolt"></i> {t('ai.mode_catat')}
              </button>
            </div>
            <button onClick={() => setShowConfirm(true)} title="Hapus Riwayat" className="p-2 text-rose-500 hover:bg-rose-50 rounded-xl transition-all self-start sm:self-center flex items-center justify-center shrink-0 border border-transparent hover:border-rose-200">
              <i className="fa-solid fa-trash-can text-sm"></i>
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto space-y-4 p-4 bg-slate-50 rounded-xl border border-slate-100">
          {activeMessages.map((m, i) => (
            <div key={i} className={`flex gap-2 max-w-lg ${m.sender === 'user' ? 'ml-auto flex-row-reverse' : ''}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs flex-shrink-0 ${m.sender === 'ai' ? 'bg-savora-800 text-savora-orange' : 'bg-slate-200 text-slate-500'}`}>
                <i className={`fa-solid ${m.sender === 'ai' ? 'fa-robot' : 'fa-user'}`}></i>
              </div>
              <div className={`rounded-2xl px-4 py-2.5 text-sm shadow-sm leading-relaxed ${m.sender === 'user' ? 'bg-savora-800 text-white' : 'bg-white text-slate-700'}`}>
                {m.sender === 'user' ? m.text : <div dangerouslySetInnerHTML={parseMarkdown(m.text)} />}
              </div>
            </div>
          ))}
          {isTyping && (
            <div className="flex gap-2 max-w-lg">
              <div className="w-8 h-8 rounded-full bg-savora-800 text-savora-orange flex items-center justify-center text-xs flex-shrink-0">
                <i className="fa-solid fa-robot"></i>
              </div>
              <div className="bg-white rounded-2xl px-4 py-2.5 text-sm shadow-sm text-slate-700 leading-relaxed flex items-center gap-1">
                <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce"></span>
                <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></span>
                <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></span>
              </div>
            </div>
          )}
          <div ref={endOfMessagesRef} />
        </div>

        <div className="mt-4 flex gap-2">
          <div className="relative flex-grow flex items-center">
            <input type="text" value={input} onChange={e => setInput(e.target.value)} onKeyPress={e => e.key === 'Enter' && handleSend()}
              placeholder={t('ai.placeholder')}
              className="flex-1 border-2 border-slate-200 rounded-xl px-4 py-2.5 pr-12 text-sm focus:outline-none focus:border-savora-800 transition-all duration-300" />
            <button className="absolute right-3 p-1.5 text-slate-400 hover:text-savora-orange transition duration-150 flex items-center justify-center">
              <i className="fa-solid fa-microphone text-base"></i>
            </button>
          </div>
          <button onClick={handleSend} className="bg-savora-800 hover:bg-savora-900 text-white rounded-xl px-4 py-2.5 flex items-center justify-center transition active:scale-95 shrink-0">
            <i className="fa-solid fa-paper-plane"></i>
          </button>
        </div>
        
      </div>

      <ConfirmModal 
        isOpen={showConfirm}
        onClose={() => setShowConfirm(false)}
        onConfirm={clearHistory}
        title={t('ai.clear_confirm').replace('?', '')}
        message={t('ai.clear_confirm')}
      />
    </section>
  )
}
