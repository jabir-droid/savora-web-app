import { supabase } from '../supabaseClient'

// Buku Pesanan (2026-10-23) — pencatatan pesanan titipan:
// katalog item (harga otomatis), daftar orang, sesi pesanan dengan
// baris per anak, pembayar pihak ketiga, dan penyelesaian pembayaran
// bertahap per anak. Status bayar SELALU diturunkan dari baris +
// penyelesaian (tidak disimpan ganda). Setiap perubahan uang memicu
// syncSessionDebts: satu baris Piutang per (sesi, pembayar) dengan
// total/terbayar yang mencerminkan modul ini.

const num = (v) => Number(v) || 0

async function currentUserId() {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Anda belum login')
  return user.id
}

// ---------- Agregasi murni (dipakai UI & sinkronisasi) ----------

// Kelompokkan baris sesi per anak: { childId, lines, total, payerId, semuaDiserahkan }
export function groupLinesByChild(lines) {
  const map = new Map()
  for (const line of lines) {
    if (!map.has(line.child_id)) {
      map.set(line.child_id, {
        childId: line.child_id,
        lines: [],
        total: 0,
        payerId: line.payer_id,
        semuaDiserahkan: true
      })
    }
    const g = map.get(line.child_id)
    g.lines.push(line)
    g.total += num(line.harga_snapshot) * (line.qty || 1)
    if (!line.diserahkan) g.semuaDiserahkan = false
  }
  return [...map.values()]
}

// Status bayar dari total vs jumlah penyelesaian.
export function paymentStatus(total, settled) {
  const t = num(total)
  const s = Math.min(num(settled), t)
  if (t <= 0 || s >= t) return 'Lunas'
  if (s > 0) return 'Sebagian'
  return 'Belum'
}

// Kelompokkan per pembayar: { payerId, children: [{childId, total, settled, status}], total, settled, sisa }
export function groupByPayer(lines, settlements) {
  const settledByChild = new Map((settlements || []).map(s => [s.child_id, num(s.jumlah_dibayar)]))
  const byChild = groupLinesByChild(lines)
  const map = new Map()
  for (const child of byChild) {
    const settledRaw = settledByChild.get(child.childId) || 0
    const settled = Math.min(settledRaw, child.total)
    if (!map.has(child.payerId)) {
      map.set(child.payerId, { payerId: child.payerId, children: [], total: 0, settled: 0, sisa: 0 })
    }
    const g = map.get(child.payerId)
    g.children.push({ childId: child.childId, total: child.total, settled, status: paymentStatus(child.total, settledRaw) })
    g.total += child.total
    g.settled += settled
  }
  for (const g of map.values()) g.sisa = g.total - g.settled
  return [...map.values()]
}

export const orderService = {
  // ---------- Orang ----------
  async getPeople() {
    const { data, error } = await supabase
      .from('order_people')
      .select('*')
      .order('nama', { ascending: true })
    if (error) throw error
    return data || []
  },

  async addPerson({ nama, catatan }) {
    const user_id = await currentUserId()
    const { data, error } = await supabase
      .from('order_people')
      .insert([{ user_id, nama: nama.trim(), catatan: catatan?.trim() || null }])
      .select()
    if (error) throw error
    return data[0]
  },

  async updatePerson(id, patch) {
    const { error } = await supabase
      .from('order_people')
      .update(patch)
      .eq('id', id)
    if (error) throw error
    return true
  },

  async deletePerson(id) {
    const { error } = await supabase
      .from('order_people')
      .delete()
      .eq('id', id)
    if (error) throw error
    return true
  },

  // ---------- Katalog item ----------
  async getItems() {
    const { data, error } = await supabase
      .from('order_items')
      .select('*')
      .order('nama', { ascending: true })
    if (error) throw error
    return data || []
  },

  async addItem({ nama, harga, jenis }) {
    const user_id = await currentUserId()
    const { data, error } = await supabase
      .from('order_items')
      .insert([{ user_id, nama: nama.trim(), harga: num(harga), jenis: jenis || 'Makanan' }])
      .select()
    if (error) throw error
    return data[0]
  },

  async updateItem(id, patch) {
    const clean = { ...patch }
    if (clean.harga !== undefined) clean.harga = num(clean.harga)
    const { error } = await supabase
      .from('order_items')
      .update(clean)
      .eq('id', id)
    if (error) throw error
    return true
  },

  async deleteItem(id) {
    const { error } = await supabase
      .from('order_items')
      .delete()
      .eq('id', id)
    if (error) throw error
    return true
  },

  // ---------- Sesi ----------
  async getSessions() {
    const { data, error } = await supabase
      .from('order_sessions')
      .select('*')
      .order('waktu', { ascending: false })
    if (error) throw error
    return data || []
  },

  // Statistik ringkas semua sesi untuk daftar sesi.
  async getSessionsStats() {
    const [{ data: lines }, { data: settlements }] = await Promise.all([
      supabase.from('order_lines').select('session_id, child_id, harga_snapshot, qty'),
      supabase.from('order_settlements').select('session_id, child_id, jumlah_dibayar')
    ])
    const stats = new Map()
    const ensure = (sid) => {
      if (!stats.has(sid)) stats.set(sid, { total: 0, settled: 0, children: new Set() })
      return stats.get(sid)
    }
    const totalBySessionChild = new Map()
    for (const l of lines || []) {
      const s = ensure(l.session_id)
      const amount = num(l.harga_snapshot) * (l.qty || 1)
      s.total += amount
      s.children.add(l.child_id)
      const key = `${l.session_id}:${l.child_id}`
      totalBySessionChild.set(key, (totalBySessionChild.get(key) || 0) + amount)
    }
    for (const st of settlements || []) {
      const key = `${st.session_id}:${st.child_id}`
      const childTotal = totalBySessionChild.get(key) || 0
      ensure(st.session_id).settled += Math.min(num(st.jumlah_dibayar), childTotal)
    }
    return stats
  },

  async createSession({ judul, waktu }) {
    const user_id = await currentUserId()
    const { data, error } = await supabase
      .from('order_sessions')
      .insert([{ user_id, judul: judul.trim(), waktu: waktu || new Date().toISOString() }])
      .select()
    if (error) throw error
    return data[0]
  },

  async updateSession(id, patch) {
    const { error } = await supabase
      .from('order_sessions')
      .update(patch)
      .eq('id', id)
    if (error) throw error
    return true
  },

  async deleteSession(id) {
    // Hapus dulu baris Piutang jembatan milik sesi ini.
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      await supabase
        .from('debts')
        .delete()
        .eq('user_id', user.id)
        .eq('sumber', 'buku-pesanan')
        .like('sumber_ref', `${id}:%`)
    }
    const { error } = await supabase
      .from('order_sessions')
      .delete()
      .eq('id', id)
    if (error) throw error
    return true
  },

  // ---------- Detail sesi ----------
  async getSessionDetail(sessionId) {
    const [sessionRes, linesRes, settlementsRes] = await Promise.all([
      supabase.from('order_sessions').select('*').eq('id', sessionId).single(),
      supabase.from('order_lines').select('*').eq('session_id', sessionId).order('created_at', { ascending: true }),
      supabase.from('order_settlements').select('*').eq('session_id', sessionId)
    ])
    if (sessionRes.error) throw sessionRes.error
    if (linesRes.error) throw linesRes.error
    if (settlementsRes.error) throw settlementsRes.error
    return {
      session: sessionRes.data,
      lines: linesRes.data || [],
      settlements: settlementsRes.data || []
    }
  },

  // ---------- Baris pesanan ----------
  // Tap item: bila anak sudah punya baris item yang sama (dan harga sama),
  // naikkan qty-nya — pencatatan cepat tanpa baris ganda.
  async addLine({ session_id, child_id, item, nama, harga, payer_id }) {
    const user_id = await currentUserId()
    const namaFinal = (item?.nama || nama || '').trim()
    const hargaFinal = item ? num(item.harga) : num(harga)

    const { data: existing } = await supabase
      .from('order_lines')
      .select('*')
      .eq('session_id', session_id)
      .eq('child_id', child_id)
      .eq('nama_snapshot', namaFinal)
      .eq('harga_snapshot', hargaFinal)
      .limit(1)
    if (existing && existing.length > 0) {
      const line = existing[0]
      const { error } = await supabase
        .from('order_lines')
        .update({ qty: (line.qty || 1) + 1 })
        .eq('id', line.id)
      if (error) throw error
      await this.syncSessionDebts(session_id)
      return line
    }

    const { data, error } = await supabase
      .from('order_lines')
      .insert([{
        user_id,
        session_id,
        child_id,
        item_id: item?.id || null,
        nama_snapshot: namaFinal,
        harga_snapshot: hargaFinal,
        qty: 1,
        payer_id: payer_id || child_id
      }])
      .select()
    if (error) throw error
    await this.syncSessionDebts(session_id)
    return data[0]
  },

  async updateLine(id, patch, sessionId) {
    const clean = { ...patch }
    if (clean.harga_snapshot !== undefined) clean.harga_snapshot = num(clean.harga_snapshot)
    const { error } = await supabase
      .from('order_lines')
      .update(clean)
      .eq('id', id)
    if (error) throw error
    if (sessionId) await this.syncSessionDebts(sessionId)
    return true
  },

  async deleteLine(id, sessionId) {
    const { error } = await supabase
      .from('order_lines')
      .delete()
      .eq('id', id)
    if (error) throw error
    if (sessionId) await this.syncSessionDebts(sessionId)
    return true
  },

  // Pembayar berlaku per anak dalam satu sesi (semua baris anak diganti).
  async setPayerForChild(sessionId, childId, payerId) {
    const { error } = await supabase
      .from('order_lines')
      .update({ payer_id: payerId })
      .eq('session_id', sessionId)
      .eq('child_id', childId)
    if (error) throw error
    await this.syncSessionDebts(sessionId)
    return true
  },

  // Checklist serah-terima untuk semua baris seorang anak.
  async setChildDelivered(sessionId, childId, delivered) {
    const { error } = await supabase
      .from('order_lines')
      .update({ diserahkan: delivered })
      .eq('session_id', sessionId)
      .eq('child_id', childId)
    if (error) throw error
    return true
  },

  // ---------- Penyelesaian pembayaran ----------
  async setSettlement(sessionId, childId, jumlahDibayar) {
    const user_id = await currentUserId()
    const { error } = await supabase
      .from('order_settlements')
      .upsert([{
        user_id,
        session_id: sessionId,
        child_id: childId,
        jumlah_dibayar: Math.max(0, num(jumlahDibayar)),
        updated_at: new Date().toISOString()
      }], { onConflict: 'session_id,child_id' })
    if (error) throw error
    await this.syncSessionDebts(sessionId)
    return true
  },

  // Catat pembayaran sejumlah uang dari seorang pembayar: isikan ke
  // anak-anak tanggungannya berurutan (yang sisa tagihannya terbesar
  // terakhir masuk di urutan baris paling awal), kembalikan alokasinya.
  async recordPayerPayment(sessionId, payerId, amount) {
    const { lines, settlements } = await this.getSessionDetail(sessionId)
    const payerGroups = groupByPayer(lines, settlements)
    const group = payerGroups.find(g => g.payerId === payerId)
    if (!group) return []
    let left = num(amount)
    const allocations = []
    for (const child of group.children) {
      if (left <= 0) break
      const remaining = child.total - child.settled
      if (remaining <= 0) continue
      const add = Math.min(remaining, left)
      allocations.push({ childId: child.childId, newSettled: child.settled + add })
      left -= add
    }
    for (const a of allocations) {
      await this.setSettlement(sessionId, a.childId, a.newSettled)
    }
    return allocations
  },

  // ---------- Jembatan Piutang ----------
  // Satu baris debts per (sesi, pembayar): jumlah = total tanggungan,
  // terbayar = total penyelesaian anak-anaknya. Baris dihapus bila
  // tanggungan nol; ditandai sumbernya agar tidak diedit dari Piutang.
  async syncSessionDebts(sessionId) {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { session, lines, settlements } = await this.getSessionDetail(sessionId)
      const people = await this.getPeople()
      const nameOf = (id) => people.find(p => p.id === id)?.nama || '-'
      const groups = groupByPayer(lines, settlements)

      const { data: existing } = await supabase
        .from('debts')
        .select('id, sumber_ref')
        .eq('user_id', user.id)
        .eq('sumber', 'buku-pesanan')
        .like('sumber_ref', `${sessionId}:%`)
      const existingByRef = new Map((existing || []).map(d => [d.sumber_ref, d.id]))
      const activeRefs = new Set()

      for (const g of groups) {
        if (g.total <= 0) continue
        const ref = `${sessionId}:${g.payerId}`
        activeRefs.add(ref)
        const childNames = g.children.map(c => nameOf(c.childId)).join(', ')
        const payload = {
          user_id: user.id,
          nama_pihak: nameOf(g.payerId),
          tipe: 'Piutang',
          jumlah: g.total,
          terbayar: g.settled,
          status: g.sisa <= 0 ? 'Lunas' : 'Belum Lunas',
          keterangan: `Buku Pesanan "${session.judul}" — untuk: ${childNames}`,
          sumber: 'buku-pesanan',
          sumber_ref: ref
        }
        if (existingByRef.has(ref)) {
          const { error } = await supabase
            .from('debts')
            .update(payload)
            .eq('id', existingByRef.get(ref))
          if (error) throw error
        } else {
          const { error } = await supabase
            .from('debts')
            .insert([payload])
          if (error) throw error
        }
      }

      // Pembayar yang tanggungannya hilang (baris dihapus semua) → cermin dibersihkan.
      for (const [ref, id] of existingByRef) {
        if (!activeRefs.has(ref)) {
          await supabase.from('debts').delete().eq('id', id)
        }
      }
    } catch (error) {
      // Jembatan tidak boleh menggagalkan pencatatan pesanan itu sendiri.
      console.error('syncSessionDebts gagal:', error)
    }
  }
}
