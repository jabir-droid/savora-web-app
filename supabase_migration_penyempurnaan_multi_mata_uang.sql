-- ============================================================
-- Savora — Program Penyempurnaan: Multi-Mata Uang (2026-10-22)
-- 1) Kolom mata_uang pada accounts (bawaan 'IDR').
-- 2) Tabel user_exchange_rates: kurs manual per pengguna
--    (nilai IDR untuk 1 unit mata uang asing), RLS pemilik.
-- Aman dijalankan berulang (idempotent).
-- ============================================================

-- 1) Mata uang per akun ----------------------------------------
ALTER TABLE public.accounts
  ADD COLUMN IF NOT EXISTS mata_uang text NOT NULL DEFAULT 'IDR';

-- 2) Kurs manual per pengguna ----------------------------------
CREATE TABLE IF NOT EXISTS public.user_exchange_rates (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kode text NOT NULL,
  kurs numeric NOT NULL CHECK (kurs > 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, kode)
);

ALTER TABLE public.user_exchange_rates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_exchange_rates_select_own" ON public.user_exchange_rates;
CREATE POLICY "user_exchange_rates_select_own" ON public.user_exchange_rates
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "user_exchange_rates_insert_own" ON public.user_exchange_rates;
CREATE POLICY "user_exchange_rates_insert_own" ON public.user_exchange_rates
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "user_exchange_rates_update_own" ON public.user_exchange_rates;
CREATE POLICY "user_exchange_rates_update_own" ON public.user_exchange_rates
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "user_exchange_rates_delete_own" ON public.user_exchange_rates;
CREATE POLICY "user_exchange_rates_delete_own" ON public.user_exchange_rates
  FOR DELETE USING (auth.uid() = user_id);

-- Verifikasi ---------------------------------------------------
-- Harus memuat kolom mata_uang dengan bawaan 'IDR':
SELECT column_name, data_type, column_default FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'accounts'
  AND column_name = 'mata_uang';

-- Harus memuat 4 policy user_exchange_rates_*:
SELECT policyname, cmd FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'user_exchange_rates'
ORDER BY policyname;
