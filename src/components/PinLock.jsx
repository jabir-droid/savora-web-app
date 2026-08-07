import React, { useState, useEffect } from 'react'
import { settingsService } from '../services/settingsService'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'

export default function PinLock({ onUnlock }) {
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [correctPin, setCorrectPin] = useState(null)
  const { signOut } = useAuth()
  const { showToast } = useToast()

  useEffect(() => {
    // Ambil PIN yang tersimpan
    settingsService.getSettings().then(s => {
      if (s && s.pin_code) {
        setCorrectPin(s.pin_code)
      }
    })
  }, [])

  const handleKeyPress = (num) => {
    if (pin.length < 4) {
      setPin(prev => prev + num)
      setError('')
    }
  }

  const handleDelete = () => {
    setPin(prev => prev.slice(0, -1))
    setError('')
  }

  useEffect(() => {
    if (pin.length === 4) {
      if (pin === correctPin) {
        onUnlock()
      } else {
        setError('PIN salah')
        setTimeout(() => setPin(''), 500)
      }
    }
  }, [pin, correctPin, onUnlock])

  const handleLogout = async () => {
    try {
      await signOut()
      window.location.reload()
    } catch (e) {
      showToast('Gagal keluar akun', 'error')
    }
  }

  return (
    <div className="fixed inset-0 bg-savora-900 z-[100] flex flex-col items-center justify-center font-sans">
      <div className="text-center mb-10">
        <div className="w-16 h-16 bg-white/10 rounded-2xl mx-auto flex items-center justify-center text-3xl mb-4 border border-white/20 shadow-xl">
          <i className="fa-solid fa-lock text-savora-orange"></i>
        </div>
        <h2 className="text-2xl font-black text-white">Masukkan PIN</h2>
        <p className="text-sm text-slate-400 mt-2">Aplikasi Anda terkunci</p>
      </div>

      <div className="flex gap-4 mb-8">
        {[1, 2, 3, 4].map(idx => (
          <div key={idx} className={`w-4 h-4 rounded-full transition-all duration-300 ${pin.length >= idx ? 'bg-savora-orange scale-110 shadow-[0_0_10px_rgba(249,115,22,0.6)]' : 'bg-slate-700'}`}></div>
        ))}
      </div>
      
      {error && <p className="text-rose-400 text-sm font-bold mb-4 animate-shake">{error}</p>}

      <div className="grid grid-cols-3 gap-4 md:gap-6 max-w-[260px]">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
          <button 
            key={num}
            onClick={() => handleKeyPress(num.toString())}
            className="w-16 h-16 rounded-full bg-white/5 hover:bg-white/10 text-white text-2xl font-bold flex items-center justify-center transition active:scale-95 border border-white/5"
          >
            {num}
          </button>
        ))}
        <div className="w-16 h-16"></div>
        <button 
          onClick={() => handleKeyPress('0')}
          className="w-16 h-16 rounded-full bg-white/5 hover:bg-white/10 text-white text-2xl font-bold flex items-center justify-center transition active:scale-95 border border-white/5"
        >
          0
        </button>
        <button 
          onClick={handleDelete}
          className="w-16 h-16 rounded-full bg-transparent hover:bg-white/5 text-slate-300 text-xl flex items-center justify-center transition active:scale-95"
        >
          <i className="fa-solid fa-delete-left"></i>
        </button>
      </div>

      <button 
        onClick={handleLogout}
        className="mt-12 text-slate-400 hover:text-white text-sm font-semibold transition"
      >
        Lupa PIN? Keluar Akun
      </button>
    </div>
  )
}
