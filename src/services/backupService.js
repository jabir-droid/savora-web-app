import { supabase } from '../supabaseClient'
import { settingsService } from './settingsService'

// Paket Perlindungan: cadangan otomatis (snapshot) data pengguna di
// tabel user_backups. Format data identik dengan backup JSON manual
// (lihat DataManagementModal) agar dapat dipulihkan dengan rutin yang sama.
const MAX_SNAPSHOTS = 10
const AUTO_INTERVAL_MS = 24 * 3600 * 1000

async function gatherBackupData(userId) {
  const [tx, acc, cat, sav, cal, settingsData] = await Promise.all([
    supabase.from('transactions').select('*').eq('user_id', userId),
    supabase.from('accounts').select('*').eq('user_id', userId),
    supabase.from('categories').select('*').eq('user_id', userId),
    supabase.from('savings').select('*').eq('user_id', userId),
    supabase.from('calendar_notes').select('*').eq('user_id', userId),
    settingsService.getSettings()
  ])

  return {
    transactions: tx.data || [],
    accounts: acc.data || [],
    categories: cat.data || [],
    savings: sav.data || [],
    calendar_notes: cal.data || [],
    settings: settingsData
  }
}

export const backupService = {
  /**
   * Membuat snapshot baru. MELEMPAR error bila gagal — pemanggil
   * menentukan apakah kegagalan bersifat kritis (mis. pra-reset:
   * reset harus batal) atau boleh diabaikan.
   */
  async createSnapshot(kind = 'manual') {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('not-signed-in')

    const backup = await gatherBackupData(user.id)
    const { data, error } = await supabase
      .from('user_backups')
      .insert([{ user_id: user.id, kind, data: backup }])
      .select('id, kind, created_at')
      .single()
    if (error) throw error

    // Pangkas: simpan MAX_SNAPSHOTS terbaru saja (best-effort).
    try {
      const { data: extra } = await supabase
        .from('user_backups')
        .select('id')
        .order('created_at', { ascending: false })
        .range(MAX_SNAPSHOTS, MAX_SNAPSHOTS + 100)
      if (extra && extra.length > 0) {
        await supabase.from('user_backups').delete().in('id', extra.map(r => r.id))
      }
    } catch { /* abaikan */ }

    return data
  },

  /**
   * Snapshot otomatis harian (dipanggil saat login). Best-effort:
   * tidak pernah melempar dan tidak mengganggu alur masuk.
   *
   * Gerbang diperkuat (Program Penyempurnaan): sesi diambil lebih
   * dulu agar konteks auth pasti tersedia, query difilter per
   * pemilik, dan penanda lokal per akun mencegah snapshot beruntun
   * saat beberapa login terjadi berdekatan (balapan propagasi JWT
   * yang sempat membuat gerbang 24 jam terlewati).
   */
  async maybeAutoSnapshot() {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const userId = session && session.user ? session.user.id : null
      if (!userId) return

      const markerKey = `savora_last_auto_backup_${userId}`
      let marker = 0
      try { marker = Number(localStorage.getItem(markerKey)) || 0 } catch { /* abaikan */ }
      if (Date.now() - marker < AUTO_INTERVAL_MS) return

      const { data: latest } = await supabase
        .from('user_backups')
        .select('created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1)
      const last = latest && latest[0] ? new Date(latest[0].created_at).getTime() : 0
      if (Date.now() - Math.max(last, marker) > AUTO_INTERVAL_MS) {
        await this.createSnapshot('otomatis')
        try { localStorage.setItem(markerKey, String(Date.now())) } catch { /* abaikan */ }
      }
    } catch { /* abaikan */ }
  },

  /** Daftar snapshot (tanpa isi data), terbaru dulu. */
  async listSnapshots() {
    const { data, error } = await supabase
      .from('user_backups')
      .select('id, kind, created_at')
      .order('created_at', { ascending: false })
      .limit(MAX_SNAPSHOTS)
    if (error) throw error
    return data || []
  },

  /** Mengambil isi data satu snapshot untuk dipulihkan. */
  async getSnapshotData(id) {
    const { data, error } = await supabase
      .from('user_backups')
      .select('data')
      .eq('id', id)
      .single()
    if (error) throw error
    return data.data
  }
}
