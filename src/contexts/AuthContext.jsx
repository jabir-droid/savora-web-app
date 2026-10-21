import React, { createContext, useState, useEffect, useContext } from 'react'
import { supabase } from '../supabaseClient'
import { activityService } from '../services/activityService'
import { backupService } from '../services/backupService'

// Penanda sesi pemulihan dari tautan email reset: fragment URL hasil
// verifikasi tautan memuat "type=recovery". Event PASSWORD_RECOVERY dapat
// terbit sebelum listener React terpasang (klien Supabase memproses fragment
// lebih dulu), jadi tangkap penandanya di sini — saat modul dimuat,
// fragment belum dibersihkan dari URL.
const arrivedViaRecoveryLink =
  typeof window !== 'undefined' && window.location.hash.includes('type=recovery')

const AuthContext = createContext({})

export const useAuth = () => useContext(AuthContext)

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [passwordRecovery, setPasswordRecovery] = useState(arrivedViaRecoveryLink)

  useEffect(() => {
    // Mengecek sesi saat ini saat aplikasi dimuat
    const getSession = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      setUser(session?.user ?? null)
      setLoading(false)
      // Sesi yang sudah ada saat aplikasi dimuat: segarkan catatan
      // perangkatnya (last_seen_at) tanpa mencatat login baru.
      if (session) activityService.registerCurrentSession(session)
    }
    
    getSession()

    // Mendengarkan perubahan status autentikasi (login, logout)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      // Tautan reset password di email menghasilkan sesi pemulihan:
      // aplikasi wajib menampilkan form kata sandi baru, bukan dashboard.
      if (event === 'PASSWORD_RECOVERY') setPasswordRecovery(true)
      if (event === 'SIGNED_IN' || event === 'PASSWORD_RECOVERY') {
        // Catat perangkat ini sebagai sesi aktif. Login dicatat ke log
        // aktivitas, kecuali kedatangan lewat tautan reset (peristiwa
        // pemulihannya sendiri tercatat saat kata sandi diubah).
        if (session) activityService.registerCurrentSession(session)
        if (event === 'SIGNED_IN' && !arrivedViaRecoveryLink) {
          activityService.logEvent('login')
          // Paket Perlindungan: snapshot otomatis harian (best-effort).
          backupService.maybeAutoSnapshot()
        }
      }
      setUser(session?.user ?? null)
      setLoading(false)
    })

    return () => {
      subscription?.unsubscribe()
    }
  }, [])

  const signUp = async (email, password) => {
    return await supabase.auth.signUp({
      email,
      password,
      options: {
        // Tautan verifikasi di email mengembalikan pengguna ke aplikasi ini
        emailRedirectTo: window.location.origin,
      },
    })
  }

  const signIn = async (email, password) => {
    return await supabase.auth.signInWithPassword({
      email,
      password,
    })
  }

  const signOut = async () => {
    // Catat sebelum sesi berakhir (sesudah keluar, identitas pengguna
    // tidak bisa lagi diketahui untuk penulisan log).
    await activityService.logEvent('logout')
    return await supabase.auth.signOut()
  }

  // Akhiri sesi di SEMUA perangkat lain lewat mekanisme resmi Supabase
  // (scope 'others'), lalu bersihkan catatan sesi perangkat lain.
  const signOutOthers = async () => {
    const currentSessionId = await activityService.getCurrentSessionId()
    const result = await supabase.auth.signOut({ scope: 'others' })
    if (!result.error) {
      await activityService.pruneOtherSessionRecords(currentSessionId)
      await activityService.logEvent('sesi_lain_dikeluarkan')
    }
    return result
  }

  const resetPassword = async (email) => {
    return await supabase.auth.resetPasswordForEmail(email, {
      // Tautan di email reset mengembalikan pengguna ke aplikasi ini
      redirectTo: window.location.origin,
    })
  }

  const updatePassword = async (newPassword) => {
    const result = await supabase.auth.updateUser({ password: newPassword })
    if (!result.error) await activityService.logEvent('kata_sandi_diubah')
    return result
  }

  const clearPasswordRecovery = () => setPasswordRecovery(false)

  const value = {
    user,
    signUp,
    signIn,
    signOut,
    signOutOthers,
    resetPassword,
    updatePassword,
    passwordRecovery,
    clearPasswordRecovery,
  }

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  )
}
