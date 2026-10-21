import { supabase } from '../supabaseClient'

// Fase 3 Paket Foto Struk: lampiran foto bukti transaksi.
// Berkas disimpan di bucket Storage PRIVAT 'struk' pada folder
// {user_id}/... dan hanya dapat dibaca lewat URL bertanda tangan.
const BUCKET = 'struk'
const MAX_DIM = 1600
const MAX_RAW_BYTES = 15 * 1024 * 1024

/**
 * Memperkecil foto ke maks. MAX_DIM px (JPEG kualitas 0.82) agar
 * unggahan ringan. Foto JPEG yang sudah kecil dibiarkan apa adanya.
 */
async function compressImage(file) {
  let source = null
  let revokeUrl = null
  try {
    if (typeof createImageBitmap === 'function') {
      source = await createImageBitmap(file)
    } else {
      const url = URL.createObjectURL(file)
      revokeUrl = url
      source = await new Promise((resolve, reject) => {
        const img = new Image()
        img.onload = () => resolve(img)
        img.onerror = reject
        img.src = url
      })
    }
  } catch (e) {
    if (revokeUrl) URL.revokeObjectURL(revokeUrl)
    throw e
  }

  const width = source.width
  const height = source.height
  const scale = Math.min(1, MAX_DIM / Math.max(width, height))
  try {
    if (scale >= 1 && file.type === 'image/jpeg') return file
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(width * scale)
    canvas.height = Math.round(height * scale)
    const ctx = canvas.getContext('2d')
    ctx.drawImage(source, 0, 0, canvas.width, canvas.height)
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.82))
    if (!blob) throw new Error('compress-failed')
    return blob
  } finally {
    if (source && typeof source.close === 'function') source.close()
    if (revokeUrl) URL.revokeObjectURL(revokeUrl)
  }
}

export const receiptService = {
  /**
   * Mengunggah foto struk (setelah kompresi) dan mengembalikan
   * path-nya di bucket. MELEMPAR error bila gagal.
   */
  async uploadReceipt(file) {
    if (!file || !file.type || !file.type.startsWith('image/')) throw new Error('not-image')
    if (file.size > MAX_RAW_BYTES) throw new Error('too-large')

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('not-signed-in')

    const blob = await compressImage(file)
    const path = `${user.id}/${crypto.randomUUID()}.jpg`
    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(path, blob, { contentType: 'image/jpeg', upsert: false })
    if (error) throw error
    return path
  },

  /** URL bertanda tangan (1 jam) untuk menampilkan foto, atau null. */
  async getReceiptUrl(path) {
    if (!path) return null
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 3600)
    if (error || !data) return null
    return data.signedUrl
  },

  /** Menghapus berkas foto (best-effort, tidak pernah melempar). */
  async deleteReceipt(path) {
    if (!path) return
    try {
      await supabase.storage.from(BUCKET).remove([path])
    } catch { /* abaikan */ }
  }
}
