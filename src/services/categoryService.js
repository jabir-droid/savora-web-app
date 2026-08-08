import { supabase } from '../supabaseClient'
import { getDefaultCategories } from '../utils/categoryIcons'

export const categoryService = {
  /**
   * Mengambil semua kategori user
   */
  async getCategories() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return []

    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .order('created_at', { ascending: false })
    
    if (error) {
      console.error(error)
      return []
    }

    if (data.length === 0) {
      const defaults = getDefaultCategories(user.id)
      
      const { data: insertedData, error: insertError } = await supabase
        .from('categories')
        .insert(defaults)
        .select()
        
      if (insertError) {
        console.error("Failed to seed categories:", insertError)
        return []
      }
      return insertedData || []
    }

    return data
  },

  /**
   * Menambahkan kategori baru
   */
  async addCategory(payload) {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error("Anda belum login")

    const { data, error } = await supabase
      .from('categories')
      .insert([{
        user_id: user.id,
        ...payload
      }])
      .select()
    
    if (error) throw error
    return data[0]
  },

  /**
   * Menghapus kategori berdasarkan ID
   */
  async deleteCategory(id) {
    const { error } = await supabase
      .from('categories')
      .delete()
      .eq('id', id)
      
    if (error) throw error
    return true
  }
}
