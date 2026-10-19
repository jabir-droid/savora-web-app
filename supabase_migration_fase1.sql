-- ==========================================
-- SAVORA FASE 1 MIGRATION (Quick Wins)
-- Jalankan di Supabase SQL Editor (Dashboard > SQL)
-- Idempoten: aman dijalankan berulang kali
-- ==========================================

-- 1. RLS untuk tabel categories
--    Tabel ini dibuat via dashboard (tidak ada di supabase_schema.sql),
--    sehingga policy DELETE-nya belum terverifikasi. Blok ini memastikan
--    tiap user hanya bisa mengelola kategorinya sendiri.
ALTER TABLE IF EXISTS public.categories ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'categories' AND policyname = 'Users can view their own categories') THEN
        CREATE POLICY "Users can view their own categories" ON public.categories FOR SELECT USING (auth.uid() = user_id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'categories' AND policyname = 'Users can insert their own categories') THEN
        CREATE POLICY "Users can insert their own categories" ON public.categories FOR INSERT WITH CHECK (auth.uid() = user_id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'categories' AND policyname = 'Users can update their own categories') THEN
        CREATE POLICY "Users can update their own categories" ON public.categories FOR UPDATE USING (auth.uid() = user_id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'categories' AND policyname = 'Users can delete their own categories') THEN
        CREATE POLICY "Users can delete their own categories" ON public.categories FOR DELETE USING (auth.uid() = user_id);
    END IF;
END
$$;

-- 2. Batas maksimum nominal transaksi di backend (Rp999 miliar)
--    Melengkapi validasi frontend di TransactionModal.jsx (MAX_NOMINAL).
--    Catatan: hanya dibatasi atas; batas bawah (> 0) dijaga di frontend
--    agar tidak merusak data historis yang mungkin bernilai 0.
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'transactions') THEN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'transactions_jumlah_max_check') THEN
            ALTER TABLE public.transactions
            ADD CONSTRAINT transactions_jumlah_max_check CHECK (jumlah <= 999000000000);
        END IF;
    END IF;
END
$$;
