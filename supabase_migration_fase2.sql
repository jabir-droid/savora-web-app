-- ==========================================
-- SAVORA FASE 2 MIGRATION (Keamanan & Fondasi)
-- Jalankan di Supabase SQL Editor (Dashboard > SQL) pada project SAVORA
-- Idempoten: aman dijalankan berulang kali.
--
-- Isi:
-- 1. Audit RLS: pastikan Row Level Security aktif + policy
--    "user hanya bisa akses baris miliknya sendiri" (auth.uid() = user_id)
--    untuk 8 tabel aplikasi: accounts, calendar_notes, categories,
--    debts, notifications, savings, transactions, user_settings.
--    Policy yang sudah ada TIDAK diubah/ditimpa — blok ini hanya
--    melengkapi yang belum ada.
-- 2. Tabel user_mfa_recovery untuk kode pemulihan 2FA (kode disimpan
--    sebagai hash SHA-256, bukan plaintext).
-- 3. Query verifikasi di bagian akhir: hasil menjalankan skrip ini
--    menampilkan daftar policy + status RLS tiap tabel.
-- ==========================================

-- ------------------------------------------
-- 1. RLS untuk semua tabel aplikasi
-- ------------------------------------------

-- accounts
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'accounts') THEN
        ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'accounts' AND policyname = 'Users can view their own accounts') THEN
            CREATE POLICY "Users can view their own accounts" ON public.accounts FOR SELECT USING (auth.uid() = user_id);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'accounts' AND policyname = 'Users can insert their own accounts') THEN
            CREATE POLICY "Users can insert their own accounts" ON public.accounts FOR INSERT WITH CHECK (auth.uid() = user_id);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'accounts' AND policyname = 'Users can update their own accounts') THEN
            CREATE POLICY "Users can update their own accounts" ON public.accounts FOR UPDATE USING (auth.uid() = user_id);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'accounts' AND policyname = 'Users can delete their own accounts') THEN
            CREATE POLICY "Users can delete their own accounts" ON public.accounts FOR DELETE USING (auth.uid() = user_id);
        END IF;
    END IF;
END
$$;

-- calendar_notes
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'calendar_notes') THEN
        ALTER TABLE public.calendar_notes ENABLE ROW LEVEL SECURITY;
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'calendar_notes' AND policyname = 'Users can view their own calendar notes') THEN
            CREATE POLICY "Users can view their own calendar notes" ON public.calendar_notes FOR SELECT USING (auth.uid() = user_id);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'calendar_notes' AND policyname = 'Users can insert their own calendar notes') THEN
            CREATE POLICY "Users can insert their own calendar notes" ON public.calendar_notes FOR INSERT WITH CHECK (auth.uid() = user_id);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'calendar_notes' AND policyname = 'Users can update their own calendar notes') THEN
            CREATE POLICY "Users can update their own calendar notes" ON public.calendar_notes FOR UPDATE USING (auth.uid() = user_id);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'calendar_notes' AND policyname = 'Users can delete their own calendar notes') THEN
            CREATE POLICY "Users can delete their own calendar notes" ON public.calendar_notes FOR DELETE USING (auth.uid() = user_id);
        END IF;
    END IF;
END
$$;

-- categories (sudah dicakup migrasi Fase 1; diulang di sini agar audit lengkap)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'categories') THEN
        ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'categories' AND policyname = 'Users can view their own categories') THEN
            CREATE POLICY "Users can view their own categories" ON public.categories FOR SELECT USING (auth.uid() = user_id);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'categories' AND policyname = 'Users can insert their own categories') THEN
            CREATE POLICY "Users can insert their own categories" ON public.categories FOR INSERT WITH CHECK (auth.uid() = user_id);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'categories' AND policyname = 'Users can update their own categories') THEN
            CREATE POLICY "Users can update their own categories" ON public.categories FOR UPDATE USING (auth.uid() = user_id);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'categories' AND policyname = 'Users can delete their own categories') THEN
            CREATE POLICY "Users can delete their own categories" ON public.categories FOR DELETE USING (auth.uid() = user_id);
        END IF;
    END IF;
END
$$;

-- debts (policy dasar sudah ada di supabase_schema.sql; blok ini melengkapi bila belum)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'debts') THEN
        ALTER TABLE public.debts ENABLE ROW LEVEL SECURITY;
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'debts' AND policyname = 'Users can view their own debts') THEN
            CREATE POLICY "Users can view their own debts" ON public.debts FOR SELECT USING (auth.uid() = user_id);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'debts' AND policyname = 'Users can insert their own debts') THEN
            CREATE POLICY "Users can insert their own debts" ON public.debts FOR INSERT WITH CHECK (auth.uid() = user_id);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'debts' AND policyname = 'Users can update their own debts') THEN
            CREATE POLICY "Users can update their own debts" ON public.debts FOR UPDATE USING (auth.uid() = user_id);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'debts' AND policyname = 'Users can delete their own debts') THEN
            CREATE POLICY "Users can delete their own debts" ON public.debts FOR DELETE USING (auth.uid() = user_id);
        END IF;
    END IF;
END
$$;

-- notifications (policy dasar sudah ada di supabase_schema.sql; blok ini melengkapi bila belum)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'notifications') THEN
        ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'notifications' AND policyname = 'Users can view their own notifications') THEN
            CREATE POLICY "Users can view their own notifications" ON public.notifications FOR SELECT USING (auth.uid() = user_id);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'notifications' AND policyname = 'Users can insert their own notifications') THEN
            CREATE POLICY "Users can insert their own notifications" ON public.notifications FOR INSERT WITH CHECK (auth.uid() = user_id);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'notifications' AND policyname = 'Users can update their own notifications') THEN
            CREATE POLICY "Users can update their own notifications" ON public.notifications FOR UPDATE USING (auth.uid() = user_id);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'notifications' AND policyname = 'Users can delete their own notifications') THEN
            CREATE POLICY "Users can delete their own notifications" ON public.notifications FOR DELETE USING (auth.uid() = user_id);
        END IF;
    END IF;
END
$$;

-- savings
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'savings') THEN
        ALTER TABLE public.savings ENABLE ROW LEVEL SECURITY;
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'savings' AND policyname = 'Users can view their own savings') THEN
            CREATE POLICY "Users can view their own savings" ON public.savings FOR SELECT USING (auth.uid() = user_id);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'savings' AND policyname = 'Users can insert their own savings') THEN
            CREATE POLICY "Users can insert their own savings" ON public.savings FOR INSERT WITH CHECK (auth.uid() = user_id);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'savings' AND policyname = 'Users can update their own savings') THEN
            CREATE POLICY "Users can update their own savings" ON public.savings FOR UPDATE USING (auth.uid() = user_id);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'savings' AND policyname = 'Users can delete their own savings') THEN
            CREATE POLICY "Users can delete their own savings" ON public.savings FOR DELETE USING (auth.uid() = user_id);
        END IF;
    END IF;
END
$$;

-- transactions
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'transactions') THEN
        ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'transactions' AND policyname = 'Users can view their own transactions') THEN
            CREATE POLICY "Users can view their own transactions" ON public.transactions FOR SELECT USING (auth.uid() = user_id);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'transactions' AND policyname = 'Users can insert their own transactions') THEN
            CREATE POLICY "Users can insert their own transactions" ON public.transactions FOR INSERT WITH CHECK (auth.uid() = user_id);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'transactions' AND policyname = 'Users can update their own transactions') THEN
            CREATE POLICY "Users can update their own transactions" ON public.transactions FOR UPDATE USING (auth.uid() = user_id);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'transactions' AND policyname = 'Users can delete their own transactions') THEN
            CREATE POLICY "Users can delete their own transactions" ON public.transactions FOR DELETE USING (auth.uid() = user_id);
        END IF;
    END IF;
END
$$;

-- user_settings (view/insert/update sudah ada di supabase_schema.sql; delete dilengkapi di sini)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'user_settings') THEN
        ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'user_settings' AND policyname = 'Users can view their own settings') THEN
            CREATE POLICY "Users can view their own settings" ON public.user_settings FOR SELECT USING (auth.uid() = user_id);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'user_settings' AND policyname = 'Users can insert their own settings') THEN
            CREATE POLICY "Users can insert their own settings" ON public.user_settings FOR INSERT WITH CHECK (auth.uid() = user_id);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'user_settings' AND policyname = 'Users can update their own settings') THEN
            CREATE POLICY "Users can update their own settings" ON public.user_settings FOR UPDATE USING (auth.uid() = user_id);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'user_settings' AND policyname = 'Users can delete their own settings') THEN
            CREATE POLICY "Users can delete their own settings" ON public.user_settings FOR DELETE USING (auth.uid() = user_id);
        END IF;
    END IF;
END
$$;

-- ------------------------------------------
-- 2. Tabel kode pemulihan 2FA
-- ------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_mfa_recovery (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    code_hash TEXT NOT NULL,
    used_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_user_mfa_recovery_user_id ON public.user_mfa_recovery (user_id);

ALTER TABLE public.user_mfa_recovery ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'user_mfa_recovery' AND policyname = 'Users can view their own recovery codes') THEN
        CREATE POLICY "Users can view their own recovery codes" ON public.user_mfa_recovery FOR SELECT USING (auth.uid() = user_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'user_mfa_recovery' AND policyname = 'Users can insert their own recovery codes') THEN
        CREATE POLICY "Users can insert their own recovery codes" ON public.user_mfa_recovery FOR INSERT WITH CHECK (auth.uid() = user_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'user_mfa_recovery' AND policyname = 'Users can update their own recovery codes') THEN
        CREATE POLICY "Users can update their own recovery codes" ON public.user_mfa_recovery FOR UPDATE USING (auth.uid() = user_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'user_mfa_recovery' AND policyname = 'Users can delete their own recovery codes') THEN
        CREATE POLICY "Users can delete their own recovery codes" ON public.user_mfa_recovery FOR DELETE USING (auth.uid() = user_id);
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
  AND c.relname IN ('accounts', 'calendar_notes', 'categories', 'debts', 'notifications', 'savings', 'transactions', 'user_settings', 'user_mfa_recovery')
ORDER BY c.relname;

SELECT tablename, policyname, cmd
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, cmd;
