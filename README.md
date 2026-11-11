# GreenPark – Platform Manajemen Aset Taman

Platform web manajemen aset dan pelaporan kerusakan fasilitas taman berbasis QR untuk kawasan perumahan, cluster, dan komplek swasta.

## Fitur Utama

- **Arsitektur Multi-Perusahaan:** Pemisahan data antar perusahaan pengelola (`Company` → `Complex` → `Cluster` → `Park` → `Asset`).
- **Autentikasi & Manajemen Sesi Fail-Closed:** Login kata sandi atau OTP email (hash SHA-256, maks 5 percobaan, anti-enumerasi, throttling) dengan sesi terverifikasi ke database pada setiap request.
- **Matriks Hak Akses 7 Role:** `PENGGUNA`, `PENGELOLA`, `MANAGER`, `PIC_VENDOR`, `TEKNISI`, `ADMIN`, dan `OWNER` hanya melihat menu dan data sesuai cakupannya.
- **Transaksi Atomik & Penomoran Aman:** Generator nomor tiket, SPK, dan PGV memakai `SequenceCounter` di dalam transaksi bersama status log, audit, notifikasi, dan antrean email.
- **Auditabilitas & Imutabilitas DB:** `AuditLog` dan `Report` diproteksi oleh trigger PostgreSQL ([`db/migrations/0002_hardening.sql`](db/migrations/0002_hardening.sql)) agar tidak dapat diubah/dihapus permanen, dijalankan langsung di atas driver `pg` (`node-postgres`).
- **Outbox Email Transaksional + SMTP:** `EmailLog` berfungsi sebagai outbox (`QUEUED` → `SENDING` → `SENT`/`FAILED`/`DEAD`) via `nodemailer`, dipicu otomatis via `after()` dan dicoba ulang oleh cron.

## Arsitektur Database (Tanpa ORM)

Akses database memakai **raw SQL PostgreSQL** lewat driver `pg` (`node-postgres`) — tidak ada ORM.

- [`src/lib/db.ts`](src/lib/db.ts) — singleton `pg.Pool` + helper terparameterisasi `query`, `queryOne`, `queryCount`, `execute`, dan `withTransaction` (`BEGIN`/`COMMIT`/`ROLLBACK`).
- [`src/lib/db-types.ts`](src/lib/db-types.ts) — enum & tipe baris (`*Row`) murni TypeScript tanpa dependensi DB, aman diimpor komponen client.
- [`db/migrations/`](db/migrations/) — migrasi SQL bernomor (`0001_init.sql`, `0002_hardening.sql`), dicatat di tabel `_migrations` oleh [`db/migrate.ts`](db/migrate.ts). Idempoten: file yang sudah tercatat dilewati.
- [`db/seed.ts`](db/seed.ts) — seed data demo idempoten (2 perusahaan, 7 role akun, aset, vendor, teknisi, laporan awal).

Konvensi SQL yang dipakai di seluruh kode: parameter `$1, $2, ...` (tanpa interpolasi string), `COUNT(*)::int AS count`, kolom waktu `TIMESTAMPTZ`, `JSONB` dikirim via `JSON.stringify` + `$n::jsonb`, array via `$n::text[]`, cast enum eksplisit (`'PENGGUNA'::"Role"`), dan filter `"archivedAt" IS NULL` eksplisit pada `"Report"`.

## Persiapan & Instalasi

1. Salin berkas `.env.example` menjadi `.env`:
   ```bash
   cp .env.example .env
   ```
   Isi `DATABASE_URL` (contoh: `postgresql://postgres:postgres@127.0.0.1:5432/greenpark`), `AUTH_SECRET`, `SEED_DEFAULT_PASSWORD`, `APP_BASE_URL`, `CRON_SECRET`, dan `SMTP_*`.
2. Siapkan `.env.test` untuk Vitest dengan **database terpisah** (contoh: `postgresql://postgres:postgres@127.0.0.1:5432/greenpark_test`). Suite test akan menolak berjalan bila port PostgreSQL di `.env.test` tidak dapat dijangkau.
3. Pastikan service PostgreSQL eksternal aktif, lalu buat kedua database:
   ```sql
   CREATE DATABASE greenpark;
   CREATE DATABASE greenpark_test;
   ```
4. Instal seluruh dependensi:
   ```bash
   npm install
   ```
5. Jalankan migrasi SQL dan seed data awal pada database development:
   ```bash
   npm run db:setup
   ```
   (Atau terpisah: `npm run db:migrate` lalu `npm run db:seed`. Keduanya aman dijalankan berulang.)
6. Jalankan server pengembangan:
   ```bash
   npm run dev
   ```
7. Jalankan pengujian otomatis (global setup Vitest otomatis menjalankan migrasi + seed ke database di `.env.test`):
   ```bash
   npm test
   ```

## Menambah Migrasi Baru

Buat file baru di `db/migrations/` dengan prefix nomor urut berikutnya (misal `0003_tambah_kolom.sql`), lalu jalankan `npm run db:migrate`. Runner mengeksekusi setiap file dalam satu transaksi dan mencatat namanya di `_migrations`; jangan mengubah file migrasi yang sudah diterapkan.

## Cron Terjadwal

Semua endpoint cron memerlukan header `Authorization: Bearer <CRON_SECRET>`:

- **`GET` / `POST /api/cron/outbox`** — Memproses antrean email (`QUEUED` dan `FAILED` yang sudah jatuh tempo dengan backoff 1/5/15/60 menit, berhenti sebagai `DEAD` setelah 5 kali gagal). Disarankan berjalan tiap **1–5 menit**.
- **`GET` / `POST /api/cron/maintenance`** — Menjalankan aturan onboarding Fase 2 untuk semua perusahaan aktif: menonaktifkan teknisi tanpa aktivitas/SPK selama 60 hari (`AUTO_60_DAYS`) dan mengirim pengingat konfirmasi 3 bulanan ke PIC Vendor. Disarankan berjalan **harian** (misal `01:00 WIB`).

Contoh pemanggilan manual:
```bash
curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/outbox
curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/maintenance
```
Di Vercel, daftarkan kedua path tersebut pada `crons` di konfigurasi deploy; di Windows/VPS, jadwalkan via Task Scheduler atau crontab.
