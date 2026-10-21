-- ============================================================
-- Savora — Paket Perlindungan (2026-10-21)
-- 1) Perbaiki constraint unik tabel categories:
--    (user_id, namakategori) -> (user_id, namakategori, tipe)
--    Sebab: daftar kategori bawaan aplikasi memuat 'Transfer'
--    untuk Pengeluaran DAN Pemasukan; constraint lama menolak
--    penyisipan bawaannya (duplicate key) sehingga tombol
--    "Muat Bawaan" dan penanaman otomatis selalu gagal.
-- 2) Tabel user_backups: cadangan otomatis (snapshot JSON data
--    pengguna) dengan RLS khusus pemilik. Snapshot tidak dapat
--    diubah (tanpa policy UPDATE) — hanya dibuat, dibaca,
--    dan dihapus oleh pemiliknya.
-- Aman dijalankan berulang (idempotent).
-- ============================================================

-- 1) Constraint kategori --------------------------------------
ALTER TABLE public.categories
  DROP CONSTRAINT IF EXISTS categories_user_id_namakategori_key;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'categories_user_id_namakategori_tipe_key'
  ) THEN
    ALTER TABLE public.categories
      ADD CONSTRAINT categories_user_id_namakategori_tipe_key
      UNIQUE (user_id, namakategori, tipe);
  END IF;
END $$;

-- 2) Tabel cadangan otomatis ---------------------------------
CREATE TABLE IF NOT EXISTS public.user_backups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind text NOT NULL DEFAULT 'otomatis'
    CHECK (kind IN ('otomatis', 'manual', 'pra-reset')),
  data jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_backups ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_backups_select_own" ON public.user_backups;
CREATE POLICY "user_backups_select_own" ON public.user_backups
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "user_backups_insert_own" ON public.user_backups;
CREATE POLICY "user_backups_insert_own" ON public.user_backups
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "user_backups_delete_own" ON public.user_backups;
CREATE POLICY "user_backups_delete_own" ON public.user_backups
  FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_user_backups_user_created
  ON public.user_backups (user_id, created_at DESC);

-- Verifikasi ---------------------------------------------------
-- Harus memuat constraint baru categories (user_id, namakategori, tipe):
SELECT conname, pg_get_constraintdef(oid) AS definisi
FROM pg_constraint
WHERE conrelid = 'public.categories'::regclass AND contype = 'u';

-- Harus memuat 3 policy user_backups (SELECT, INSERT, DELETE):
SELECT policyname, cmd FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'user_backups'
ORDER BY policyname;
