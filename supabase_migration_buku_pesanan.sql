-- ============================================================
-- Savora — Buku Pesanan (2026-10-23)
-- Modul pencatatan pesanan titipan (makanan/minuman/barang):
-- katalog item berharga baku, daftar orang, sesi pesanan dengan
-- baris per anak, kolom pembayar pihak ketiga, penyelesaian
-- pembayaran bertahap per anak, dan jembatan satu baris Piutang
-- per (sesi, pembayar) lewat kolom debts.sumber/sumber_ref.
-- Aman dijalankan berulang (idempotent).
-- ============================================================

-- ---------- order_people: daftar anak/orang ----------
CREATE TABLE IF NOT EXISTS public.order_people (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nama text NOT NULL,
  catatan text,
  aktif boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ---------- order_items: katalog item ----------
CREATE TABLE IF NOT EXISTS public.order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nama text NOT NULL,
  harga numeric NOT NULL DEFAULT 0,
  jenis text NOT NULL DEFAULT 'Makanan',
  aktif boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ---------- order_sessions: sesi pesanan ----------
CREATE TABLE IF NOT EXISTS public.order_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  judul text NOT NULL,
  waktu timestamptz NOT NULL DEFAULT now(),
  ditutup boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ---------- order_lines: baris pesanan per anak ----------
CREATE TABLE IF NOT EXISTS public.order_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id uuid NOT NULL REFERENCES public.order_sessions(id) ON DELETE CASCADE,
  child_id uuid NOT NULL REFERENCES public.order_people(id) ON DELETE RESTRICT,
  item_id uuid REFERENCES public.order_items(id) ON DELETE SET NULL,
  nama_snapshot text NOT NULL,
  harga_snapshot numeric NOT NULL DEFAULT 0,
  qty integer NOT NULL DEFAULT 1,
  payer_id uuid NOT NULL REFERENCES public.order_people(id) ON DELETE RESTRICT,
  diserahkan boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS order_lines_session_idx
  ON public.order_lines (user_id, session_id);

-- ---------- order_settlements: pembayaran per anak dalam sesi ----------
CREATE TABLE IF NOT EXISTS public.order_settlements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id uuid NOT NULL REFERENCES public.order_sessions(id) ON DELETE CASCADE,
  child_id uuid NOT NULL REFERENCES public.order_people(id) ON DELETE RESTRICT,
  jumlah_dibayar numeric NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (session_id, child_id)
);

-- ---------- Jembatan Piutang: penanda asal di tabel debts ----------
ALTER TABLE public.debts ADD COLUMN IF NOT EXISTS sumber text;
ALTER TABLE public.debts ADD COLUMN IF NOT EXISTS sumber_ref text;

CREATE INDEX IF NOT EXISTS debts_sumber_ref_idx
  ON public.debts (user_id, sumber_ref);

-- ---------- RLS: pemilik saja, pola sama seperti tabel lain ----------
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['order_people', 'order_items', 'order_sessions', 'order_lines', 'order_settlements']
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);

    EXECUTE format('DROP POLICY IF EXISTS "%s_select_own" ON public.%I', t, t);
    EXECUTE format('CREATE POLICY "%s_select_own" ON public.%I FOR SELECT USING (auth.uid() = user_id)', t, t);

    EXECUTE format('DROP POLICY IF EXISTS "%s_insert_own" ON public.%I', t, t);
    EXECUTE format('CREATE POLICY "%s_insert_own" ON public.%I FOR INSERT WITH CHECK (auth.uid() = user_id)', t, t);

    EXECUTE format('DROP POLICY IF EXISTS "%s_update_own" ON public.%I', t, t);
    EXECUTE format('CREATE POLICY "%s_update_own" ON public.%I FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id)', t, t);

    EXECUTE format('DROP POLICY IF EXISTS "%s_delete_own" ON public.%I', t, t);
    EXECUTE format('CREATE POLICY "%s_delete_own" ON public.%I FOR DELETE USING (auth.uid() = user_id)', t, t);
  END LOOP;
END $$;
