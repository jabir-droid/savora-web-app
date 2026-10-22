-- ============================================================
-- Savora — Sinkron Otomatis Pilot BSI (2026-10-22)
-- Tabel ingested_transactions: jejak setiap email transaksi yang
-- ditangkap otomatis (parser BYOND di Edge Function). Baris dibuat
-- oleh Edge Function (service role); pengguna hanya membaca dan
-- mengelola status tinjauan miliknya. Aman dijalankan berulang.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.ingested_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sumber text NOT NULL DEFAULT 'bsi-byond-email',
  external_ref text NOT NULL,
  gmail_message_id text,
  jenis text,
  arah text,
  jumlah numeric,
  deskripsi text,
  parsed jsonb,
  raw_subject text,
  raw_body text,
  transaction_ids uuid[] NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'posted',
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, external_ref)
);

ALTER TABLE public.ingested_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ingested_select_own" ON public.ingested_transactions;
CREATE POLICY "ingested_select_own" ON public.ingested_transactions
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "ingested_update_own" ON public.ingested_transactions;
CREATE POLICY "ingested_update_own" ON public.ingested_transactions
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "ingested_delete_own" ON public.ingested_transactions;
CREATE POLICY "ingested_delete_own" ON public.ingested_transactions
  FOR DELETE USING (auth.uid() = user_id);

-- Sengaja TIDAK ada policy INSERT untuk pengguna: baris tangkapan
-- hanya boleh dibuat Edge Function (service role).

-- Verifikasi ---------------------------------------------------
-- Harus memuat tabel dengan constraint unik (user_id, external_ref):
SELECT tablename FROM pg_tables
WHERE schemaname = 'public' AND tablename = 'ingested_transactions';

-- Harus memuat 3 policy ingested_* (SELECT, UPDATE, DELETE):
SELECT policyname, cmd FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'ingested_transactions'
ORDER BY policyname;
