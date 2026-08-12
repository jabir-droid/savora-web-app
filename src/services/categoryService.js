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

    // Auto-migrate: ensure 'Transfer' category exists for existing users
    const hasTransferPengeluaran = data.some(c => c.namakategori === 'Transfer' && c.tipe === 'Pengeluaran')
    const hasTransferPemasukan = data.some(c => c.namakategori === 'Transfer' && c.tipe === 'Pemasukan')
    
    const missing = []
    if (!hasTransferPengeluaran) missing.push({ user_id: user.id, namakategori: 'Transfer', tipe: 'Pengeluaran' })
    if (!hasTransferPemasukan) missing.push({ user_id: user.id, namakategori: 'Transfer', tipe: 'Pemasukan' })

    if (missing.length > 0) {
      try {
        const { data: insertedMissing, error: insertMissingErr } = await supabase.from('categories').insert(missing).select()
        if (insertMissingErr) {
          console.error("Auto-migrate Transfer category failed:", insertMissingErr)
        } else if (insertedMissing && insertedMissing.length > 0) {
          data.push(...insertedMissing)
        }
      } catch (e) {
        console.error("Auto-migrate Transfer category exception:", e)
      }
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
