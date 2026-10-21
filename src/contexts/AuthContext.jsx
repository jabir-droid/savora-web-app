import React, { createContext, useState, useEffect, useContext } from 'react'
import { supabase } from '../supabaseClient'

const AuthContext = createContext({})

export const useAuth = () => useContext(AuthContext)

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [passwordRecovery, setPasswordRecovery] = useState(false)

  useEffect(() => {
    // Mengecek sesi saat ini saat aplikasi dimuat
    const getSession = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      setUser(session?.user ?? null)
      setLoading(false)
    }
    
    getSession()

    // Mendengarkan perubahan status autentikasi (login, logout)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      // Tautan reset password di email menghasilkan sesi pemulihan:
      // aplikasi wajib menampilkan form kata sandi baru, bukan dashboard.
      if (event === 'PASSWORD_RECOVERY') setPasswordRecovery(true)
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
    return await supabase.auth.signOut()
  }

  const resetPassword = async (email) => {
    return await supabase.auth.resetPasswordForEmail(email, {
      // Tautan di email reset mengembalikan pengguna ke aplikasi ini
      redirectTo: window.location.origin,
    })
  }

  const updatePassword = async (newPassword) => {
    return await supabase.auth.updateUser({ password: newPassword })
  }

  const clearPasswordRecovery = () => setPasswordRecovery(false)

  const value = {
    user,
    signUp,
    signIn,
    signOut,
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
