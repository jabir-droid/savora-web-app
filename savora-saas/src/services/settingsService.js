import { supabase } from '../supabaseClient'

export const settingsService = {
  async getSettings() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null

    const { data, error } = await supabase
      .from('user_settings')
      .select('*')
      .eq('user_id', user.id)
      .limit(1)
    
    if (error) console.error(error)
    
    // Return default if not exists
    if (!data || data.length === 0) {
      localStorage.setItem('savora_currency', 'IDR')
      return {
        default_account: '',
        currency: 'IDR',
        is_pin_enabled: false,
        haptic_enabled: false
      }
    }
    
    if (data[0].currency) {
      localStorage.setItem('savora_currency', data[0].currency)
    }
    return data[0]
  },

  async updateSettings(payload) {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error("Anda belum login")

    if (payload.currency) {
      localStorage.setItem('savora_currency', payload.currency)
    }

    // Check if exists
    const { data: existing } = await supabase
      .from('user_settings')
      .select('user_id')
      .eq('user_id', user.id)
      .limit(1)

    if (existing && existing.length > 0) {
      const { data, error } = await supabase
        .from('user_settings')
        .update(payload)
        .eq('user_id', user.id)
        .select()
      if (error) throw error
      return data[0]
    } else {
      const { data, error } = await supabase
        .from('user_settings')
        .insert([{
          user_id: user.id,
          ...payload
        }])
        .select()
      if (error) throw error
      return data[0]
    }
  }
}
