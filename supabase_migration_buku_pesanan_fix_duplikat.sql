-- ============================================================
-- Savora — Buku Pesanan: perbaikan duplikat Piutang jembatan
-- (2026-10-23)
-- Baterai uji menemukan baris debts jembatan bisa terbentuk ganda
-- untuk satu (sesi, pembayar) bila dua sinkronisasi bertabrakan.
-- Perbaikan: (1) hapus duplikat lama — pertahankan baris terbaru
-- per sumber_ref; (2) indeks unik parsial pada sumber_ref untuk
-- baris bersumber 'buku-pesanan' agar ganda mustahil terulang.
-- Aman dijalankan berulang (idempotent).
-- ============================================================

DELETE FROM public.debts d
USING public.debts d2
WHERE d.sumber = 'buku-pesanan'
  AND d.sumber_ref IS NOT NULL
  AND d2.sumber = 'buku-pesanan'
  AND d2.sumber_ref = d.sumber_ref
  AND d2.user_id = d.user_id
  AND (d2.created_at, d2.id) > (d.created_at, d.id);

CREATE UNIQUE INDEX IF NOT EXISTS debts_buku_pesanan_ref_uidx
  ON public.debts (sumber_ref)
  WHERE sumber = 'buku-pesanan' AND sumber_ref IS NOT NULL;
