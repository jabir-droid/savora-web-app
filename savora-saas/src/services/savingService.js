import { supabase } from '../supabaseClient'
import { accountService } from './accountService'
import { transactionService } from './transactionService'

export const savingService = {
  /**
   * Mengambil semua rencana tabungan milik user
   */
  async getSavings() {
    const { data, error } = await supabase
      .from('savings')
      .select('*')
      .order('created_at', { ascending: false })
    
    if (error) throw error
    return data
  },

  /**
   * Membuat rencana/target tabungan baru
   */
  async addSavingGoal(payload) {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error("Anda belum login")

    const { data, error } = await supabase
      .from('savings')
      .insert([{
        user_id: user.id,
        namatarget: payload.namatarget,
        targetjumlah: payload.targetjumlah,
        terkumpul: payload.terkumpul || 0,
        tenggatwaktu: payload.tenggatwaktu,
        kategori: payload.kategori || 'Personal',
        jadwalrutin: payload.jadwalrutin || 'Bebas',
        harisetoran: payload.harisetoran || null,
        status: 'Aktif'
      }])
      .select()
    
    if (error) throw error
    return data
  },

  /**
   * Menambah setoran ke dalam tabungan
   * Memotong dari akun sumber, dan mencatat transaksi tipe "Tabungan"
   */
  async addContribution(savingId, nominal, akunSumber, targetNama) {
    // 1. Ambil data tabungan saat ini
    const { data: savings, error: findError } = await supabase
      .from('savings')
      .select('id, terkumpul')
      .eq('id', savingId)
      .limit(1)

    if (findError || !savings || savings.length === 0) throw new Error("Target tabungan tidak ditemukan")

    const saving = savings[0]
    const newTerkumpul = Number(saving.terkumpul) + Number(nominal)

    // 2. Update saldo terkumpul di tabungan
    const { error: updateError } = await supabase
      .from('savings')
      .update({ terkumpul: newTerkumpul })
      .eq('id', savingId)

    if (updateError) throw updateError

    // 3. Catat transaksi sebagai "Tabungan"
    // Ini otomatis akan memanggil accountService.updateAccountBalance di dalamnya
    // untuk memotong saldo dari akunSumber
    await transactionService.addTransaction({
      tipe: 'Pengeluaran', // Karena memotong saldo aktif
      kategori: 'Tabungan',
      jumlah: nominal,
      deskripsi: `Setoran: ${targetNama}`,
      akun: akunSumber
    })

    return true
  }
}
