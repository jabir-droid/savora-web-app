import { supabase } from '../supabaseClient'

// ============================================================
// Verifikasi Dua Langkah (2FA) berbasis TOTP (Supabase Auth MFA)
// + kode pemulihan sekali pakai yang disimpan sebagai hash
// di tabel public.user_mfa_recovery (lihat supabase_migration_fase2.sql).
// ============================================================

const RECOVERY_TABLE = 'user_mfa_recovery'
const RECOVERY_CODE_COUNT = 8
// Alfabet tanpa karakter ambigu (0/O, 1/I/L) agar kode mudah diketik ulang
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'

const normalizeCode = (code) => (code || '').toUpperCase().replace(/[^A-Z0-9]/g, '')

const randomCodePart = (len) => {
  const bytes = new Uint8Array(len)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join('')
}

const generateRecoveryCode = () => `${randomCodePart(4)}-${randomCodePart(4)}`

const hashCode = async (code) => {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(normalizeCode(code)))
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('')
}

export const mfaService = {
  // Tentukan apakah sesi saat ini wajib menyelesaikan tantangan TOTP.
  // Mengembalikan { required: boolean, factorId: string|null }.
  async getChallengeRequirement() {
    const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
    if (error) throw error
    if (!data || data.currentLevel !== 'aal1' || data.nextLevel !== 'aal2') {
      return { required: false, factorId: null }
    }
    const factors = await this.listVerifiedTotpFactors()
    return { required: factors.length > 0, factorId: factors[0]?.id ?? null }
  },

  async listVerifiedTotpFactors() {
    const { data, error } = await supabase.auth.mfa.listFactors()
    if (error) throw error
    return (data?.totp ?? []).filter((f) => f.status === 'verified')
  },

  async listAllTotpFactors() {
    const { data, error } = await supabase.auth.mfa.listFactors()
    if (error) throw error
    return data?.totp ?? []
  },

  // Mulai pendaftaran faktor TOTP baru. Mengembalikan { id, qrCode, secret, uri }.
  async enrollTotp() {
    // Bersihkan faktor TOTP lama yang belum terverifikasi agar tidak menumpuk
    const existing = await this.listAllTotpFactors()
    for (const factor of existing) {
      if (factor.status !== 'verified') {
        await supabase.auth.mfa.unenroll({ factorId: factor.id })
      }
    }
    const { data, error } = await supabase.auth.mfa.enroll({
      factorType: 'totp',
      friendlyName: 'Savora Authenticator',
    })
    if (error) throw error
    return {
      id: data.id,
      qrCode: data.totp?.qr_code ?? '',
      secret: data.totp?.secret ?? '',
      uri: data.totp?.uri ?? '',
    }
  },

  // Verifikasi kode 6 digit untuk faktor yang baru didaftarkan (aktivasi).
  async verifyNewFactor(factorId, code) {
    const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({ factorId })
    if (challengeError) throw challengeError
    const { error } = await supabase.auth.mfa.verify({
      factorId,
      challengeId: challenge.id,
      code: (code || '').trim(),
    })
    if (error) throw error
  },

  // Selesaikan tantangan login: sesi naik dari AAL1 ke AAL2.
  async completeLoginChallenge(factorId, code) {
    return this.verifyNewFactor(factorId, code)
  },

  async unenrollFactor(factorId) {
    const { error } = await supabase.auth.mfa.unenroll({ factorId })
    if (error) throw error
  },

  // Buat satu set kode pemulihan baru (menimpa set lama).
  // Mengembalikan daftar kode plaintext SEKALI — hanya hash-nya yang disimpan.
  async regenerateRecoveryCodes(userId) {
    const codes = Array.from({ length: RECOVERY_CODE_COUNT }, generateRecoveryCode)
    const rows = []
    for (const code of codes) {
      rows.push({ user_id: userId, code_hash: await hashCode(code) })
    }
    const { error: deleteError } = await supabase.from(RECOVERY_TABLE).delete().eq('user_id', userId)
    if (deleteError) throw deleteError
    const { error: insertError } = await supabase.from(RECOVERY_TABLE).insert(rows)
    if (insertError) throw insertError
    return codes
  },

  async countUnusedRecoveryCodes(userId) {
    const { count, error } = await supabase
      .from(RECOVERY_TABLE)
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .is('used_at', null)
    if (error) throw error
    return count ?? 0
  },

  // Pakai satu kode pemulihan untuk melewati gerbang 2FA pada sesi ini.
  // Mengembalikan true jika kode cocok dan berhasil ditandai terpakai.
  async redeemRecoveryCode(userId, inputCode) {
    const targetHash = await hashCode(inputCode)
    const { data, error } = await supabase
      .from(RECOVERY_TABLE)
      .select('id, code_hash')
      .eq('user_id', userId)
      .is('used_at', null)
    if (error) throw error
    const match = (data ?? []).find((row) => row.code_hash === targetHash)
    if (!match) return false
    const { error: updateError } = await supabase
      .from(RECOVERY_TABLE)
      .update({ used_at: new Date().toISOString() })
      .eq('id', match.id)
    if (updateError) throw updateError
    return true
  },
}
