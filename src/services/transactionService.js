import { supabase } from '../supabaseClient'
import { accountService } from './accountService'
import { notificationService } from './notificationService'

export const transactionService = {
  /**
   * Mengambil semua transaksi milik user yang sedang login
   */
  async getTransactions(limit = null, accountName = null) {
    let query = supabase
      .from('transactions')
      .select('*')
      .order('created_at', { ascending: false })
      
    if (accountName) {
      query = query.or(`akun.eq."${accountName}",transferke.eq."${accountName}"`)
    }

    if (limit) {
      query = query.limit(limit)
    }

    const { data, error } = await query
    
    if (error) throw error
    return data
  },

  /**
   * Mengambil ringkasan pemasukan dan pengeluaran
   */
  async getTransactionSummary(accountName = null) {
    let query = supabase
      .from('transactions')
      .select('tipe, jumlah, akun, transferke')
    
    if (accountName) {
      // Use logical OR operator for Supabase
      query = query.or(`akun.eq."${accountName}",transferke.eq."${accountName}"`)
    }

    const { data, error } = await query
    
    if (error) throw error

    const summary = {
      pemasukan: 0,
      pengeluaran: 0
    }

    if (data) {
      data.forEach(tx => {
        if (tx.tipe === 'Pemasukan') summary.pemasukan += Number(tx.jumlah)
        if (tx.tipe === 'Pengeluaran') summary.pengeluaran += Number(tx.jumlah)
      })
    }
    
    return summary
  },

  /**
   * Menyimpan transaksi baru ke database
   */
  async addTransaction(payload) {
    // Pastikan user terautentikasi (ambil user id)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error("Anda belum login")

    const insertData = {
      user_id: user.id,
      tipe: payload.tipe,
      kategori: payload.kategori,
      jumlah: payload.jumlah,
      deskripsi: payload.deskripsi,
      akun: payload.akun,
      transferke: payload.transferke || null
    }

    if (payload.tanggal) {
      insertData.created_at = payload.tanggal
    }

    const { data, error } = await supabase
      .from('transactions')
      .insert([insertData])
      .select()
    
    if (error) throw error

    // Setelah menambah transaksi, update saldo akun
    await accountService.updateAccountBalance(payload.akun, payload.tipe, payload.jumlah)
    if (payload.tipe === 'Transfer' && payload.transferke) {
      await accountService.updateAccountBalance(payload.transferke, 'Pemasukan', payload.jumlah)
    }

    // Cek Notifikasi (Kritis & Overbudget)
    try {
      const settings = await notificationService.getSettings()
      
      // 1. Cek Saldo Kritis
      if (settings.notif_critical && payload.tipe === 'Pengeluaran') {
        const accounts = await accountService.getAccounts()
        const acc = accounts.find(a => a.namaakun === payload.akun)
        if (acc && Number(acc.saldo) < Number(settings.notif_critical_threshold)) {
          await notificationService.createNotification(
            `Saldo Kritis: Saldo rekening ${acc.namaakun} kamu sekarang di bawah batas aman (Rp ${Number(settings.notif_critical_threshold).toLocaleString('id-ID')}).`,
            'warning'
          )
        }
      }

      // 2. Cek Overbudget
      if (settings.notif_overbudget && payload.tipe === 'Pengeluaran' && payload.kategori) {
        // Ambil kategori untuk cek limit
        const { data: catData } = await supabase.from('categories').select('limit_anggaran').eq('namakategori', payload.kategori).single()
        
        if (catData && catData.limit_anggaran > 0) {
          // Hitung total pengeluaran kategori ini bulan ini
          const date = new Date()
          const firstDay = new Date(date.getFullYear(), date.getMonth(), 1).toISOString()
          
          const { data: txData } = await supabase
            .from('transactions')
            .select('jumlah')
            .eq('tipe', 'Pengeluaran')
            .eq('kategori', payload.kategori)
            .gte('created_at', firstDay)
          
          let totalSpent = 0
          if (txData) {
            txData.forEach(tx => totalSpent += Number(tx.jumlah))
          }

          if (totalSpent > catData.limit_anggaran) {
            await notificationService.createNotification(
              `Overbudget: Pengeluaran untuk kategori ${payload.kategori} bulan ini (Rp ${totalSpent.toLocaleString('id-ID')}) telah melebihi batas (Rp ${catData.limit_anggaran.toLocaleString('id-ID')}).`,
              'error'
            )
          }
        }
      }
    } catch (e) {
      console.error("Gagal memproses notifikasi:", e)
    }

    return data
  },

  /**
   * Menghapus transaksi berdasarkan ID
   */
  async deleteTransaction(id, tipe, jumlah, akun, transferke) {
    const { error } = await supabase
      .from('transactions')
      .delete()
      .eq('id', id)
      
    if (error) throw error

    // Kembalikan saldo akun seperti semula (reverse)
    await accountService.updateAccountBalance(akun, tipe === 'Pemasukan' ? 'Pengeluaran' : 'Pemasukan', jumlah)
    if (tipe === 'Transfer' && transferke) {
      await accountService.updateAccountBalance(transferke, 'Pengeluaran', jumlah)
    }
    
    return true
  }
}
