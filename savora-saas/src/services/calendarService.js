import { supabase } from '../supabaseClient'

export const calendarService = {
  /**
   * Mendapatkan catatan kalender untuk bulan tertentu
   * @param {string} prefix - yyyy-mm
   */
  async getNotesForMonth(prefix) {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return []

    const { data, error } = await supabase
      .from('calendar_notes')
      .select('*')
      .like('date', `${prefix}%`)
    
    if (error) {
      console.error(error)
      return []
    }
    return data
  },

  /**
   * Menyimpan atau memperbarui catatan untuk suatu tanggal
   */
  async upsertNote(date, payload) {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null

    // Check if exists
    const { data: existing } = await supabase
      .from('calendar_notes')
      .select('id')
      .eq('date', date)
      .eq('user_id', user.id)
      .limit(1)

    if (existing && existing.length > 0) {
      const { data, error } = await supabase
        .from('calendar_notes')
        .update(payload)
        .eq('id', existing[0].id)
        .select()
      if (error) throw error
      return data[0]
    } else {
      const { data, error } = await supabase
        .from('calendar_notes')
        .insert([{
          user_id: user.id,
          date,
          ...payload
        }])
        .select()
      if (error) throw error
      return data[0]
    }
  }
}
