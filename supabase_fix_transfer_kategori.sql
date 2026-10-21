-- =====================================================================
-- Savora — Perbaikan data lama: kategori transaksi Transfer Kas
-- OPSIONAL. Jalankan manual di SQL Editor project Savora.
--
-- Latar: sebelum perbaikan aplikasi, transaksi bertipe 'Transfer' bisa
-- tersimpan dengan kategori pengeluaran/pemasukan acak (mis. 'Belanja'),
-- sehingga mengacaukan laporan per kategori. Aplikasi sekarang selalu
-- menyimpan transfer dengan kategori 'Transfer'; skrip ini merapikan
-- baris lama yang sudah terlanjur tersimpan.
--
-- Aman: kolom kategori hanya dipakai untuk tampilan & laporan.
-- Saldo akun dihitung dari kolom tipe/jumlah, TIDAK terpengaruh.
-- =====================================================================

-- LANGKAH 1 — Pratinjau: lihat dulu baris yang akan berubah.
SELECT id, created_at, user_id, kategori, jumlah, akun, transferke, deskripsi
FROM public.transactions
WHERE tipe = 'Transfer' AND kategori <> 'Transfer'
ORDER BY created_at;

-- LANGKAH 2 — Perbaikan: jalankan blok ini hanya setelah memeriksa
-- hasil pratinjau di atas.
UPDATE public.transactions
SET kategori = 'Transfer'
WHERE tipe = 'Transfer' AND kategori <> 'Transfer';

-- LANGKAH 3 — Verifikasi: query ini harus mengembalikan 0 baris.
SELECT COUNT(*) AS sisa_transfer_non_kategori_transfer
FROM public.transactions
WHERE tipe = 'Transfer' AND kategori <> 'Transfer';
