import { supabase } from '../supabaseClient'
import { accountService } from './accountService'
import { notificationService } from './notificationService'
import { receiptService } from './receiptService'
import { currencyService } from './currencyService'
import { convertToBase } from '../utils/currency'

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

    // Multi-mata uang: arus dari akun asing dikonversi ke IDR
    // memakai kurs efektif, agar ringkasan gabungan konsisten.
    const [{ data: accRows }, rates] = await Promise.all([
      supabase.from('accounts').select('namaakun, mata_uang'),
      currencyService.getRates()
    ])
    const currencyByAccount = {}
    ;(accRows || []).forEach(a => { currencyByAccount[a.namaakun] = a.mata_uang || 'IDR' })

    const summary = {
      pemasukan: 0,
      pengeluaran: 0
    }

    if (data) {
      data.forEach(tx => {
        const base = convertToBase(tx.jumlah, currencyByAccount[tx.akun] || 'IDR', rates)
        if (tx.tipe === 'Pemasukan') summary.pemasukan += base
        if (tx.tipe === 'Pengeluaran') summary.pengeluaran += base
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
      // Invariant model data: transaksi Transfer selalu berkategori 'Transfer'
      kategori: payload.tipe === 'Transfer' ? 'Transfer' : payload.kategori,
      jumlah: payload.jumlah,
      deskripsi: payload.deskripsi,
      akun: payload.akun,
      transferke: payload.transferke || null,
      foto_path: payload.foto_path || null
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
          const existingNotifs = await notificationService.getNotifications()
          const isAlreadyNotified = existingNotifs.some(n => 
            n.text.includes(`Saldo Kritis: Saldo rekening ${acc.namaakun}`) && !n.read
          )
          
          if (!isAlreadyNotified) {
            await notificationService.createNotification(
              `Saldo Kritis: Saldo rekening ${acc.namaakun} kamu sekarang di bawah batas aman (Rp ${Number(settings.notif_critical_threshold).toLocaleString('id-ID')}).`,
              'warning'
            )
          }
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
            const existingNotifs = await notificationService.getNotifications()
            const isAlreadyNotified = existingNotifs.some(n => 
              n.text.includes(`Overbudget: Pengeluaran untuk kategori ${payload.kategori}`) && !n.read
            )
            
            if (!isAlreadyNotified) {
              await notificationService.createNotification(
                `Overbudget: Pengeluaran untuk kategori ${payload.kategori} bulan ini (Rp ${totalSpent.toLocaleString('id-ID')}) telah melebihi batas (Rp ${catData.limit_anggaran.toLocaleString('id-ID')}).`,
                'error'
              )
            }
          }
        }
      }
    } catch (e) {
      console.error("Gagal memproses notifikasi:", e)
    }

    return data
  },

  /**
   * Memperbarui transaksi berdasarkan ID
   */
  async updateTransaction(id, oldTx, newTx) {
    // 1. Revert old transaction balances
    await accountService.updateAccountBalance(oldTx.akun, oldTx.tipe === 'Pemasukan' ? 'Pengeluaran' : 'Pemasukan', oldTx.jumlah)
    if (oldTx.tipe === 'Transfer' && oldTx.transferke) {
      await accountService.updateAccountBalance(oldTx.transferke, 'Pengeluaran', oldTx.jumlah)
    }

    // 2. Update transaction row
    const updateData = {
      tipe: newTx.tipe,
      // Invariant model data: transaksi Transfer selalu berkategori 'Transfer'
      kategori: newTx.tipe === 'Transfer' ? 'Transfer' : newTx.kategori,
      jumlah: newTx.jumlah,
      deskripsi: newTx.deskripsi,
      akun: newTx.akun,
      transferke: newTx.transferke || null
    }
    if ('foto_path' in newTx) {
      updateData.foto_path = newTx.foto_path || null
    }
    if (newTx.tanggal) {
      updateData.created_at = newTx.tanggal
    }
    
    const { data, error } = await supabase
      .from('transactions')
      .update(updateData)
      .eq('id', id)
      .select()
      
    if (error) throw error

    // 3. Apply new transaction balances
    await accountService.updateAccountBalance(newTx.akun, newTx.tipe, newTx.jumlah)
    if (newTx.tipe === 'Transfer' && newTx.transferke) {
      await accountService.updateAccountBalance(newTx.transferke, 'Pemasukan', newTx.jumlah)
    }
    
    return data
  },

  /**
   * Menghapus transaksi berdasarkan ID
   */
  async deleteTransaction(id, tipe, jumlah, akun, transferke) {
    // Ambil path foto struk dulu agar berkasnya bisa ikut dihapus
    const { data: existing } = await supabase
      .from('transactions')
      .select('foto_path')
      .eq('id', id)
      .single()

    const { error } = await supabase
      .from('transactions')
      .delete()
      .eq('id', id)

    if (error) throw error

    if (existing && existing.foto_path) {
      receiptService.deleteReceipt(existing.foto_path)
    }

    // Kembalikan saldo akun seperti semula (reverse)
    await accountService.updateAccountBalance(akun, tipe === 'Pemasukan' ? 'Pengeluaran' : 'Pemasukan', jumlah)
    if (tipe === 'Transfer' && transferke) {
      await accountService.updateAccountBalance(transferke, 'Pengeluaran', jumlah)
    }
    
    return true
  }
}
