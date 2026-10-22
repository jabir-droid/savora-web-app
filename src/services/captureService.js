import { supabase } from '../supabaseClient'
import { transactionService } from './transactionService'

// Tangkapan Otomatis (Sinkron Otomatis Pilot BSI, 2026-10-22).
// Baris di ingested_transactions DIBUAT oleh Edge Function
// (service role); di sini pengguna hanya membaca, meninjau,
// memperbaiki kategori, dan menghapus tangkapan miliknya.
export const captureService = {
  async getCaptures(limit = 50) {
    const { data, error } = await supabase
      .from('ingested_transactions')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit)
    if (error) {
      console.error(error)
      return []
    }
    return data || []
  },

  async countPending() {
    const { data, error } = await supabase
      .from('ingested_transactions')
      .select('id, status, reviewed_at')
    if (error) return 0
    return (data || []).filter(
      c => !c.reviewed_at && ['posted', 'unparsed', 'error'].includes(c.status)
    ).length
  },

  async markReviewed(id) {
    const { error } = await supabase
      .from('ingested_transactions')
      .update({ status: 'reviewed', reviewed_at: new Date().toISOString() })
      .eq('id', id)
    if (error) throw error
    return true
  },

  // Ubah kategori transaksi Pengeluaran yang terhubung ke tangkapan ini
  // (mis. tebakan 'Belanja' untuk QRIS diganti kategori yang tepat).
  async updateCategory(capture, kategori) {
    const ids = capture.transaction_ids || []
    if (ids.length === 0) return true
    const { data: txs, error } = await supabase
      .from('transactions')
      .select('id, tipe')
      .in('id', ids)
    if (error) throw error
    const expenseIds = (txs || []).filter(tx => tx.tipe === 'Pengeluaran').map(tx => tx.id)
    if (expenseIds.length > 0) {
      const { error: updError } = await supabase
        .from('transactions')
        .update({ kategori })
        .in('id', expenseIds)
      if (updError) throw updError
    }
    return true
  },

  // Hapus tangkapan beserta transaksinya; saldo dikembalikan lewat
  // transactionService.deleteTransaction (aturan yang sama seperti
  // penghapusan manual di Riwayat).
  async deleteCapture(capture) {
    const ids = capture.transaction_ids || []
    if (ids.length > 0) {
      const { data: txs } = await supabase
        .from('transactions')
        .select('*')
        .in('id', ids)
      for (const tx of txs || []) {
        await transactionService.deleteTransaction(tx.id, tx.tipe, tx.jumlah, tx.akun, tx.transferke)
      }
    }
    const { error } = await supabase
      .from('ingested_transactions')
      .delete()
      .eq('id', capture.id)
    if (error) throw error
    return true
  },

  // Buang baris tangkapan yang tidak menghasilkan transaksi
  // (status unparsed/error tanpa transaction_ids).
  async discardCapture(id) {
    const { error } = await supabase
      .from('ingested_transactions')
      .delete()
      .eq('id', id)
    if (error) throw error
    return true
  }
}
