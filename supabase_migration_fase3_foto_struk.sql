-- ============================================================
-- Savora — Fase 3 Paket Foto Struk (2026-10-21)
-- 1) Kolom foto_path pada transactions (path berkas di Storage).
-- 2) Bucket Storage PRIVAT 'struk' + policy per-folder pemilik:
--    setiap pengguna hanya dapat mengakses folder {user_id}/...
-- Aman dijalankan berulang (idempotent).
-- ============================================================

-- 1) Kolom lampiran foto --------------------------------------
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS foto_path text;

-- 2) Bucket privat --------------------------------------------
INSERT INTO storage.buckets (id, name, public)
VALUES ('struk', 'struk', false)
ON CONFLICT (id) DO NOTHING;

-- 3) Policy Storage: folder pertama pada path = user_id pemilik
DROP POLICY IF EXISTS "struk_select_own" ON storage.objects;
CREATE POLICY "struk_select_own" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'struk'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "struk_insert_own" ON storage.objects;
CREATE POLICY "struk_insert_own" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'struk'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "struk_update_own" ON storage.objects;
CREATE POLICY "struk_update_own" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'struk'
    AND (storage.foldername(name))[1] = auth.uid()::text
  ) WITH CHECK (
    bucket_id = 'struk'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "struk_delete_own" ON storage.objects;
CREATE POLICY "struk_delete_own" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'struk'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Verifikasi ---------------------------------------------------
-- Harus memuat kolom foto_path:
SELECT column_name, data_type FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'transactions'
  AND column_name = 'foto_path';

-- Harus memuat bucket struk dengan public = false:
SELECT id, name, public FROM storage.buckets WHERE id = 'struk';

-- Harus memuat 4 policy struk_* (SELECT, INSERT, UPDATE, DELETE):
SELECT policyname, cmd FROM pg_policies
WHERE schemaname = 'storage' AND tablename = 'objects'
  AND policyname LIKE 'struk_%'
ORDER BY policyname;
