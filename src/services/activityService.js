import { supabase } from '../supabaseClient'

// ============================================================
// Fase 3 Paket 1 — Catatan sesi perangkat & log aktivitas.
// Tabel: public.user_sessions + public.activity_log
// (lihat supabase_migration_fase3_paket1.sql).
//
// Catatan kejujuran desain:
// - Daftar sesi adalah catatan yang ditulis aplikasi setiap login,
//   BUKAN daftar sesi internal Supabase Auth (tidak dibuka ke klien).
// - Log ditulis dari klien: jejak audit pribadi, bukan bukti
//   anti-rusak. Semua fungsi di sini menelan error (best effort)
//   agar pencatatan tidak pernah mengganggu alur utama aplikasi.
// ============================================================

const SESSIONS_TABLE = 'user_sessions'
const ACTIVITY_TABLE = 'activity_log'

// Label perangkat ringkas dari user-agent, mis. "Chrome di Windows".
export const describeDevice = (ua) => {
  const s = ua || (typeof navigator !== 'undefined' ? navigator.userAgent : '') || ''
  let os = 'Perangkat'
  if (/iPhone/i.test(s)) os = 'iPhone'
  else if (/iPad/i.test(s)) os = 'iPad'
  else if (/Android/i.test(s)) os = 'Android'
  else if (/Windows/i.test(s)) os = 'Windows'
  else if (/Macintosh|Mac OS/i.test(s)) os = 'macOS'
  else if (/Linux/i.test(s)) os = 'Linux'
  let browser = 'Browser'
  if (/Edg\//i.test(s)) browser = 'Edge'
  else if (/OPR\/|Opera/i.test(s)) browser = 'Opera'
  else if (/Firefox\//i.test(s)) browser = 'Firefox'
  else if (/Chrome\//i.test(s)) browser = 'Chrome'
  else if (/Safari\//i.test(s)) browser = 'Safari'
  return `${browser} di ${os}`
}

// Ambil session_id dari payload JWT access token sesi Supabase.
export const getSessionIdFromToken = (accessToken) => {
  try {
    const payload = (accessToken || '').split('.')[1]
    if (!payload) return null
    const json = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')))
    return json.session_id || null
  } catch {
    return null
  }
}

const currentUserId = async () => {
  const { data } = await supabase.auth.getUser()
  return data?.user?.id ?? null
}

export const activityService = {
  // Catat satu peristiwa aktivitas untuk pengguna yang sedang masuk.
  // Best effort: kegagalan ditelan, tidak pernah melempar error.
  async logEvent(event, detail = {}) {
    try {
      const userId = await currentUserId()
      if (!userId) return
      await supabase.from(ACTIVITY_TABLE).insert({ user_id: userId, event, detail })
    } catch {
      // Abaikan: log aktivitas tidak boleh mengganggu alur aplikasi
    }
  },

  // Daftarkan/perbarui catatan sesi perangkat untuk sesi yang diberikan.
  // Dipakai saat login dan saat aplikasi dimuat dengan sesi aktif
  // (last_seen_at ikut diperbarui).
  async registerCurrentSession(session) {
    try {
      if (!session?.access_token || !session?.user?.id) return
      const sessionId = getSessionIdFromToken(session.access_token)
      if (!sessionId) return
      const ua = typeof navigator !== 'undefined' ? navigator.userAgent : ''
      await supabase.from(SESSIONS_TABLE).upsert(
        {
          user_id: session.user.id,
          session_id: sessionId,
          device_label: describeDevice(ua),
          user_agent: ua,
          last_seen_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,session_id' }
      )
    } catch {
      // Best effort, abaikan
    }
  },

  // session_id sesi yang sedang aktif di perangkat ini (atau null).
  async getCurrentSessionId() {
    try {
      const { data } = await supabase.auth.getSession()
      return getSessionIdFromToken(data?.session?.access_token)
    } catch {
      return null
    }
  },

  async listSessions() {
    const { data, error } = await supabase
      .from(SESSIONS_TABLE)
      .select('id, session_id, device_label, created_at, last_seen_at')
      .order('last_seen_at', { ascending: false })
    if (error) throw error
    return data ?? []
  },

  async listActivity(limit = 20) {
    const { data, error } = await supabase
      .from(ACTIVITY_TABLE)
      .select('id, event, detail, created_at')
      .order('created_at', { ascending: false })
      .limit(limit)
    if (error) throw error
    return data ?? []
  },

  // Hapus satu catatan sesi (hanya catatan; tidak mengakhiri sesi).
  async deleteSessionRecord(id) {
    const { error } = await supabase.from(SESSIONS_TABLE).delete().eq('id', id)
    if (error) throw error
  },

  // Hapus catatan semua sesi selain sesi perangkat ini.
  async pruneOtherSessionRecords(currentSessionId) {
    try {
      const userId = await currentUserId()
      if (!userId) return
      let query = supabase.from(SESSIONS_TABLE).delete().eq('user_id', userId)
      if (currentSessionId) query = query.neq('session_id', currentSessionId)
      await query
    } catch {
      // Best effort, abaikan
    }
  },
}
