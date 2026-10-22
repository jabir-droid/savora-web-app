import { supabase } from '../supabaseClient'
import { DEFAULT_RATES } from '../utils/currency'

// Kurs mata uang per pengguna (tabel user_exchange_rates).
// getRates menggabungkan kurs kustom pengguna di atas nilai
// perkiraan bawaan, sehingga konversi selalu dapat berjalan.
export const currencyService = {
  /** Peta kurs efektif {USD: n, SGD: n, ...} untuk pengguna aktif. */
  async getRates() {
    const rates = { ...DEFAULT_RATES }
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return rates
    const { data } = await supabase
      .from('user_exchange_rates')
      .select('kode, kurs')
      .eq('user_id', user.id)
    ;(data || []).forEach(r => { rates[r.kode] = Number(r.kurs) })
    return rates
  },

  /** Kode mata uang yang kursnya diatur sendiri oleh pengguna. */
  async getCustomCodes() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return []
    const { data } = await supabase
      .from('user_exchange_rates')
      .select('kode')
      .eq('user_id', user.id)
    return (data || []).map(r => r.kode)
  },

  /** Menyimpan/memperbarui kurs satu mata uang. */
  async saveRate(kode, kurs) {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('not-signed-in')
    const { error } = await supabase
      .from('user_exchange_rates')
      .upsert(
        [{ user_id: user.id, kode, kurs, updated_at: new Date().toISOString() }],
        { onConflict: 'user_id,kode' }
      )
    if (error) throw error
  }
}
