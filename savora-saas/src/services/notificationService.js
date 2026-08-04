import { supabase } from '../supabaseClient'

export const notificationService = {
  // --- SETTINGS ---
  async getSettings() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error("Anda belum login")
    
    const { data, error } = await supabase
      .from('user_settings')
      .select('*')
      .eq('user_id', user.id)
      .single()
      
    if (error && error.code !== 'PGRST116') throw error
    
    // If no settings exist yet, return defaults
    if (!data) {
      return {
        notif_overbudget: true,
        notif_critical: true,
        notif_critical_threshold: 1000000,
        notif_checklist: true,
        connected_banks: []
      }
    }
    
    return data
  },

  async updateSettings(updates) {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error("Anda belum login")
      
    // Check if exists
    const { data: existing, error: checkError } = await supabase
      .from('user_settings')
      .select('user_id')
      .eq('user_id', user.id)
      .limit(1)

    if (checkError) {
      console.error("Error checking user_settings:", checkError)
      throw checkError
    }

    if (existing && existing.length > 0) {
      const { error } = await supabase
        .from('user_settings')
        .update(updates)
        .eq('user_id', user.id)
      if (error) throw error
    } else {
      const { error } = await supabase
        .from('user_settings')
        .insert([{ user_id: user.id, ...updates }])
      if (error) throw error
    }
  },

  // --- NOTIFICATIONS ---
  async getNotifications() {
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .order('created_at', { ascending: false })
    
    if (error) throw error
    return data
  },

  async createNotification(text, type = 'info') {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null

    const { error } = await supabase
      .from('notifications')
      .insert([{
        user_id: user.id,
        text,
        type,
        read: false
      }])
    
    if (error) {
      console.error("Failed to create notification", error)
    }
  },

  async markAsRead() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    
    await supabase
      .from('notifications')
      .update({ read: true })
      .eq('read', false)
      .eq('user_id', user.id)
  },

  async clearHistory() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    
    await supabase
      .from('notifications')
      .delete()
      .eq('user_id', user.id)
  }
}
