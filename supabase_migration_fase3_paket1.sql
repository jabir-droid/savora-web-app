-- =====================================================================
-- Savora — Migrasi Fase 3 Paket 1: Sesi Perangkat & Log Aktivitas
-- Jalankan manual di SQL Editor project Savora (satu kali).
-- Idempoten: aman dijalankan ulang.
--
-- 1) public.user_sessions — catatan perangkat yang masuk ke akun,
--    ditulis aplikasi setiap ada sesi aktif (bukan daftar sesi internal
--    Supabase Auth; pencabutan sesi sungguhan memakai mekanisme resmi
--    Supabase signOut scope 'others'/'global').
-- 2) public.activity_log — jejak aktivitas penting pengguna
--    (login, logout, ganti kata sandi, ekspor, perubahan 2FA).
--   Dari sisi klien bersifat append-only: hanya SELECT + INSERT.
-- =====================================================================

-- ------------------------------------------
-- 1. Tabel catatan sesi perangkat
-- ------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_sessions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    session_id TEXT NOT NULL,
    device_label TEXT,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    last_seen_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_sessions_user_session
    ON public.user_sessions (user_id, session_id);

CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id
    ON public.user_sessions (user_id);

ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'user_sessions' AND policyname = 'Users can view their own session records') THEN
        CREATE POLICY "Users can view their own session records" ON public.user_sessions FOR SELECT USING (auth.uid() = user_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'user_sessions' AND policyname = 'Users can insert their own session records') THEN
        CREATE POLICY "Users can insert their own session records" ON public.user_sessions FOR INSERT WITH CHECK (auth.uid() = user_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'user_sessions' AND policyname = 'Users can update their own session records') THEN
        CREATE POLICY "Users can update their own session records" ON public.user_sessions FOR UPDATE USING (auth.uid() = user_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'user_sessions' AND policyname = 'Users can delete their own session records') THEN
        CREATE POLICY "Users can delete their own session records" ON public.user_sessions FOR DELETE USING (auth.uid() = user_id);
    END IF;
END
$$;

-- ------------------------------------------
-- 2. Tabel log aktivitas (append-only dari klien)
-- ------------------------------------------
CREATE TABLE IF NOT EXISTS public.activity_log (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    event TEXT NOT NULL,
    detail JSONB DEFAULT '{}'::jsonb NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_activity_log_user_created
    ON public.activity_log (user_id, created_at DESC);

ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'activity_log' AND policyname = 'Users can view their own activity log') THEN
        CREATE POLICY "Users can view their own activity log" ON public.activity_log FOR SELECT USING (auth.uid() = user_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'activity_log' AND policyname = 'Users can insert their own activity log') THEN
        CREATE POLICY "Users can insert their own activity log" ON public.activity_log FOR INSERT WITH CHECK (auth.uid() = user_id);
    END IF;
END
$$;

-- ------------------------------------------
-- 3. Verifikasi: status RLS + daftar policy sesudah migrasi
-- ------------------------------------------
SELECT c.relname AS tabel, c.relrowsecurity AS rls_aktif
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname IN ('user_sessions', 'activity_log')
ORDER BY c.relname;

SELECT tablename, policyname, cmd
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('user_sessions', 'activity_log')
ORDER BY tablename, cmd;
