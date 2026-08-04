import { supabase } from '../supabaseClient'

export const accountService = {
  /**
   * Mengambil semua akun milik user
   */
  async getAccounts() {
    const { data, error } = await supabase
      .from('accounts')
      .select('*')
      .order('created_at', { ascending: true })
    
    if (error) throw error
    return data
  },

  /**
   * Mendapatkan total saldo semua akun
   */
  async getTotalBalance() {
    const { data, error } = await supabase
      .from('accounts')
      .select('saldo')
    
    if (error) throw error

    let total = 0
    if (data) {
      data.forEach(acc => {
        total += Number(acc.saldo)
      })
    }
    
    return total
  },

  /**
   * Membuat akun/dompet baru (hanya untuk inisialisasi awal)
   */
  async createAccount(namaakun, tipe, saldo = 0) {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error("Anda belum login")

    const { data, error } = await supabase
      .from('accounts')
      .insert([{
        user_id: user.id,
        namaakun,
        tipe,
        saldo
      }])
      .select()

    if (error) throw error
    return data
  },

  /**
   * Mengubah data akun (nama, tipe)
   */
  async updateAccount(id, payload) {
    const { data, error } = await supabase
      .from('accounts')
      .update(payload)
      .eq('id', id)
      .select()
    
    if (error) throw error
    return data[0]
  },

  /**
   * Fungsi bantu untuk mengubah saldo rekening (Pemasukan bertambah, Pengeluaran/Transfer berkurang)
   */
  async updateAccountBalance(namaAkun, tipe, jumlah) {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    // Cari akun berdasarkan nama
    const { data: accounts, error: findError } = await supabase
      .from('accounts')
      .select('id, saldo')
      .eq('namaakun', namaAkun)
      .limit(1)

    if (findError || !accounts || accounts.length === 0) return

    const account = accounts[0]
    let newBalance = Number(account.saldo)
    
    if (tipe === 'Pemasukan') newBalance += Number(jumlah)
    if (tipe === 'Pengeluaran' || tipe === 'Transfer') newBalance -= Number(jumlah)

    await supabase
      .from('accounts')
      .update({ saldo: newBalance })
      .eq('id', account.id)
  },

  /**
   * Menghapus akun/dompet
   */
  async deleteAccount(id) {
    const { error } = await supabase
      .from('accounts')
      .delete()
      .eq('id', id)
    
    if (error) throw error
  }
}
