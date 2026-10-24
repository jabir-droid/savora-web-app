-- ============================================================
-- Savora — Buku Pesanan: peran orang (Santri / Pembayar / Keduanya)
-- (2026-10-24)
-- Memisahkan daftar santri dari daftar calon pembayar: sebelumnya
-- satu daftar "Orang" dipakai untuk keduanya, sehingga nama anak yang
-- ditambahkan dari tab Catat ikut muncul di dropdown "Dibayar oleh".
-- Migrasi ini:
--  1. Menambah kolom order_people.peran (nullable dulu agar inferensi
--     hanya menyentuh baris yang belum pernah diberi peran).
--  2. Menebak peran dari riwayat yang sudah ada:
--     - hanya pernah memesan sebagai anak        -> 'santri'
--     - hanya pernah membayar untuk anak lain     -> 'pembayar'
--     - keduanya / belum ada riwayat              -> 'keduanya'
--     (baris bayar-sendiri, payer_id = child_id, TIDAK dihitung
--     sebagai "membayar untuk orang lain")
--  3. Menetapkan default 'keduanya' untuk baris baru.
-- Aman dijalankan berulang: inferensi hanya menyentuh peran IS NULL,
-- sehingga peran yang sudah Bos ubah manual tidak akan tertimpa.
-- ============================================================

ALTER TABLE public.order_people
  ADD COLUMN IF NOT EXISTS peran TEXT
  CHECK (peran IN ('santri', 'pembayar', 'keduanya'));

UPDATE public.order_people p
SET peran = 'santri'
WHERE p.peran IS NULL
  AND EXISTS (SELECT 1 FROM public.order_lines l WHERE l.child_id = p.id)
  AND NOT EXISTS (
    SELECT 1 FROM public.order_lines l2
    WHERE l2.payer_id = p.id AND l2.child_id <> p.id
  );

UPDATE public.order_people p
SET peran = 'pembayar'
WHERE p.peran IS NULL
  AND NOT EXISTS (SELECT 1 FROM public.order_lines l WHERE l.child_id = p.id)
  AND EXISTS (
    SELECT 1 FROM public.order_lines l2
    WHERE l2.payer_id = p.id AND l2.child_id <> p.id
  );

UPDATE public.order_people
SET peran = 'keduanya'
WHERE peran IS NULL;

ALTER TABLE public.order_people
  ALTER COLUMN peran SET DEFAULT 'keduanya';
