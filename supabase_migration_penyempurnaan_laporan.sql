-- ============================================================
-- Savora — Program Penyempurnaan: Laporan Berkala (2026-10-22)
-- Bucket Storage PRIVAT 'laporan' untuk file CSV laporan yang
-- dibuat terjadwal/manual + policy per-folder pemilik (pola
-- yang sama dengan bucket 'struk'). Aman dijalankan berulang.
-- ============================================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('laporan', 'laporan', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "laporan_select_own" ON storage.objects;
CREATE POLICY "laporan_select_own" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'laporan'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "laporan_insert_own" ON storage.objects;
CREATE POLICY "laporan_insert_own" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'laporan'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "laporan_update_own" ON storage.objects;
CREATE POLICY "laporan_update_own" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'laporan'
    AND (storage.foldername(name))[1] = auth.uid()::text
  ) WITH CHECK (
    bucket_id = 'laporan'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "laporan_delete_own" ON storage.objects;
CREATE POLICY "laporan_delete_own" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'laporan'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Verifikasi ---------------------------------------------------
-- Harus memuat bucket laporan dengan public = false:
SELECT id, name, public FROM storage.buckets WHERE id = 'laporan';

-- Harus memuat 4 policy laporan_* (SELECT, INSERT, UPDATE, DELETE):
SELECT policyname, cmd FROM pg_policies
WHERE schemaname = 'storage' AND tablename = 'objects'
  AND policyname LIKE 'laporan_%'
ORDER BY policyname;
