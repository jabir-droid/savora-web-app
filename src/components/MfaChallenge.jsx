import React, { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import { mfaService } from '../services/mfaService'

// Layar tantangan Verifikasi Dua Langkah (2FA) setelah login.
// Muncul saat pengguna punya faktor TOTP terverifikasi dan sesi masih AAL1.
// Alternatif: satu kode pemulihan sekali pakai.
export default function MfaChallenge({ factorId, onVerified }) {
  const { user, signOut } = useAuth()
  const { showToast } = useToast()
  const [mode, setMode] = useState('totp') // 'totp' | 'recovery'
  const [code, setCode] = useState('')
  const [recoveryCode, setRecoveryCode] = useState('')
  const [error, setError] = useState('')
  const [isVerifying, setIsVerifying] = useState(false)

  const handleVerifyTotp = async (e) => {
    e.preventDefault()
    if (!factorId) return
    setIsVerifying(true)
    setError('')
    try {
      await mfaService.completeLoginChallenge(factorId, code)
      showToast('Verifikasi dua langkah berhasil.', 'success')
      onVerified()
    } catch {
      setError('Kode autentikator salah atau sudah kedaluwarsa. Coba lagi dengan kode terbaru.')
      setCode('')
    } finally {
      setIsVerifying(false)
    }
  }

  const handleVerifyRecovery = async (e) => {
    e.preventDefault()
    if (!user) return
    setIsVerifying(true)
    setError('')
    try {
      const ok = await mfaService.redeemRecoveryCode(user.id, recoveryCode)
      if (!ok) {
        setError('Kode pemulihan tidak cocok atau sudah pernah dipakai.')
        return
      }
      showToast('Kode pemulihan diterima. Satu kode terpakai dan tidak bisa digunakan lagi.', 'success')
      onVerified()
    } catch {
      setError('Gagal memeriksa kode pemulihan. Periksa koneksi lalu coba lagi.')
    } finally {
      setIsVerifying(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-slate-50 font-sans">
      <div className="bg-white rounded-3xl shadow-sm border border-slate-200/60 w-full max-w-sm p-8">
        <div className="text-center mb-8">
          <img src="/favicon.svg" alt="Savora Logo" className="h-16 w-16 mx-auto mb-4 drop-shadow-sm" />
          <h1 className="text-xl font-extrabold text-savora-900">Verifikasi Dua Langkah</h1>
          <p className="text-xs text-slate-400 mt-2 leading-relaxed">
            Akun ini dilindungi 2FA. Masukkan kode dari aplikasi autentikator untuk melanjutkan.
          </p>
        </div>

        {mode === 'totp' ? (
          <form className="space-y-4" onSubmit={handleVerifyTotp}>
            <div>
              <label className="block text-[11px] font-bold text-savora-900 mb-1.5 ml-1">Kode autentikator (6 digit)</label>
              <input
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                required
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                className="w-full bg-slate-50 border border-slate-200 text-slate-800 text-center text-lg tracking-[0.4em] font-bold rounded-xl focus:ring-1 focus:ring-savora-800 focus:border-savora-800 block p-3 outline-none transition placeholder-slate-300"
                placeholder="••••••"
              />
            </div>
            {error && <p className="text-xs text-rose-500 font-medium ml-1">{error}</p>}
            <button
              disabled={isVerifying || code.length !== 6}
              className="w-full bg-savora-orange hover:bg-orange-600 text-white font-bold py-3 px-4 rounded-xl transition shadow-sm text-sm disabled:opacity-50"
            >
              {isVerifying ? 'Memverifikasi...' : 'Verifikasi'}
            </button>
            <button
              type="button"
              onClick={() => { setMode('recovery'); setError('') }}
              className="w-full text-xs text-savora-orange hover:underline font-bold transition"
            >
              Gunakan kode pemulihan
            </button>
          </form>
        ) : (
          <form className="space-y-4" onSubmit={handleVerifyRecovery}>
            <div>
              <label className="block text-[11px] font-bold text-savora-900 mb-1.5 ml-1">Kode pemulihan</label>
              <input
                type="text"
                autoComplete="off"
                required
                value={recoveryCode}
                onChange={(e) => setRecoveryCode(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 text-slate-800 text-center text-base tracking-widest font-bold rounded-xl focus:ring-1 focus:ring-savora-800 focus:border-savora-800 block p-3 outline-none transition placeholder-slate-300 uppercase"
                placeholder="XXXX-XXXX"
              />
              <p className="text-[11px] text-slate-400 mt-1.5 ml-1">Setiap kode hanya bisa dipakai satu kali.</p>
            </div>
            {error && <p className="text-xs text-rose-500 font-medium ml-1">{error}</p>}
            <button
              disabled={isVerifying || recoveryCode.trim().length < 8}
              className="w-full bg-savora-orange hover:bg-orange-600 text-white font-bold py-3 px-4 rounded-xl transition shadow-sm text-sm disabled:opacity-50"
            >
              {isVerifying ? 'Memeriksa...' : 'Pakai Kode Pemulihan'}
            </button>
            <button
              type="button"
              onClick={() => { setMode('totp'); setError('') }}
              className="w-full text-xs text-savora-orange hover:underline font-bold transition"
            >
              Kembali ke kode autentikator
            </button>
          </form>
        )}

        <div className="mt-6 text-center">
          <button
            onClick={() => signOut()}
            className="text-xs text-slate-400 hover:text-rose-500 font-bold transition"
          >
            Keluar akun
          </button>
        </div>
      </div>
    </div>
  )
}
