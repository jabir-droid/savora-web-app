import { supabase } from '../supabaseClient'
import { transactionService } from './transactionService'

export const debtService = {
  /**
   * Mengambil semua hutang/piutang milik user yang sedang login
   */
  async getDebts() {
    let query = supabase
      .from('debts')
      .select('*')
      .order('created_at', { ascending: false })
      
    const { data, error } = await query
    
    if (error) throw error
    return data
  },

  /**
   * Mengambil riwayat transaksi pembayaran hutang/piutang
   */
  async getDebtTransactions() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return []

    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .in('kategori', ['Bayar Hutang', 'Terima Piutang'])
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      
    if (error) throw error
    return data
  },

  /**
   * Menyimpan hutang/piutang baru ke database
   */
  async addDebt(payload) {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error("Anda belum login")

    const { data, error } = await supabase
      .from('debts')
      .insert([{
        user_id: user.id,
        nama_pihak: payload.nama_pihak,
        tipe: payload.tipe, // 'Hutang' atau 'Piutang'
        jumlah: payload.jumlah,
        keterangan: payload.keterangan || null,
        tenggat_waktu: payload.tenggat_waktu || null,
        status: 'Belum Lunas',
        terbayar: 0
      }])
      .select()
    
    if (error) throw error
    return data
  },

  /**
   * Menghapus hutang/piutang berdasarkan ID
   */
  async deleteDebt(id) {
    const { error } = await supabase
      .from('debts')
      .delete()
      .eq('id', id)
      
    if (error) throw error
    return true
  },

  /**
   * Update status/pembayaran hutang
   */
  async payDebt(debt, payAmount, accountName) {
    const terbayar_baru = Number(debt.terbayar) + Number(payAmount)
    const status_baru = terbayar_baru >= Number(debt.jumlah) ? 'Lunas' : 'Belum Lunas'

    // 1. Update debt record
    const { data, error } = await supabase
      .from('debts')
      .update({ terbayar: terbayar_baru, status: status_baru })
      .eq('id', debt.id)
      .select()

    if (error) throw error

    // 2. Record transaction
    const txTipe = debt.tipe === 'Hutang' ? 'Pengeluaran' : 'Pemasukan'
    const txDeskripsi = `Pembayaran ${debt.tipe}: ${debt.nama_pihak}`
    const txKategori = debt.tipe === 'Hutang' ? 'Bayar Hutang' : 'Terima Piutang'

    await transactionService.addTransaction({
      tipe: txTipe,
      kategori: txKategori,
      jumlah: Number(payAmount),
      deskripsi: txDeskripsi,
      akun: accountName
    })

    return data
  }
}
