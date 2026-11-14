# GreenDesk – Platform Manajemen Aset & Pelaporan Fasilitas Taman Berbasis QR

Platform web manajemen aset dan pelaporan kerusakan fasilitas taman berbasis **QR Code** untuk kawasan perumahan, cluster, dan komplek komersial/swasta. Mengintegrasikan seluruh siklus pelaporan mulai dari pemindaian fisik di taman oleh warga hingga penyelesaian perbaikan oleh teknisi vendor dengan transparansi status via email.

---

## Daftar Isi
1. [Pengenalan Projek](#1-pengenalan-projek)
   - [Latar Belakang](#latar-belakang)
   - [Gambaran Solusi](#gambaran-solusi)
   - [Target Pengguna & Matriks Hak Akses](#target-pengguna--matriks-hak-akses)
2. [Technical Documentation](#2-technical-documentation)
   - [Arsitektur Sistem](#arsitektur-sistem)
   - [Diagram Alur Program](#diagram-alur-program)
   - [Struktur Hierarki Wilayah 5 Tingkat](#struktur-hierarki-wilayah-5-tingkat)
   - [Keamanan & Integritas Data](#keamanan--integritas-data)
3. [Frontend Documentation](#3-frontend-documentation)
   - [Framework & Library Utama](#framework--library-utama)
   - [Struktur Routing Halaman](#struktur-routing-halaman)
   - [Struktur Komponen UI](#struktur-komponen-ui)
   - [Manajemen Aset & Offline Draft](#manajemen-aset--offline-draft)
4. [Backend Documentation](#4-backend-documentation)
   - [Arsitektur Database (Raw SQL Tanpa ORM)](#arsitektur-database-raw-sql-tanpa-orm)
   - [Skema Database & Entitas Utama](#skema-database--entitas-utama)
   - [REST API Endpoints & Cron](#rest-api-endpoints--cron)
   - [Server Actions](#server-actions)
   - [Dokumentasi `.env.example`](#dokumentasi-envexample)
5. [Panduan Instalasi & Menjalankan Projek](#5-panduan-instalasi--menjalankan-projek)
   - [Prasyarat Sistem](#prasyarat-sistem)
   - [Langkah Pemasangan](#langkah-pemasangan)
   - [Akun Demo Hasil Seeding](#akun-demo-hasil-seeding)
   - [Pengujian Otomatis (Testing)](#pengujian-otomatis-testing)
6. [Alur Penggunaan Sistem (Step-by-Step per Role)](#6-alur-penggunaan-sistem-step-by-step-per-role)

---

## 1. Pengenalan Projek

### Latar Belakang
Pada kawasan hunian terpadu (real estate, cluster perumahan, maupun komplek swasta), fasilitas taman seperti lampu penerangan, bangku taman, ayunan, dan alat olahraga luar ruangan sering mengalami kerusakan tanpa penanganan yang jelas.
- **Masalah Warga:** Warga enggan melapor karena birokrasi berbelit, tidak tahu kontak penanggung jawab tiap fasilitas, atau keluhan hanya mengendap di grup chat WhatsApp tanpa tindak lanjut.
- **Masalah Pengelola & Manajemen:** Pengelola kesulitan mendata aset yang tersebar, laporan ganda sering terjadi, dan manajemen (Estate Manager / Direksi) tidak memiliki visibilitas atas kinerja vendor perbaikan, biaya, maupun masa garansi pekerjaan.

### Gambaran Solusi
GreenPark memangkas rantai birokrasi pelaporan menjadi alur ringkas dan transparan:
1. **Pemindaian Langsung di Aset:** Setiap aset memiliki stiker plat QR Code unik. Warga cukup memindai QR lewat kamera HP tanpa wajib login di awal.
2. **Formulir Otomatis & Cek Laporan Aktif:** Halaman pelaporan otomatis terisi identitas aset dan lokasinya. Warga dapat melihat apakah kerusakan pada aset tersebut sudah pernah dilaporkan orang lain untuk mencegah duplikasi.
3. **Penyimpanan Draft Lokal:** Foto dan catatan kerusakan disimpan di IndexedDB peramban, sehingga data tidak hilang ketika warga diarahkan untuk masuk/mendaftar.
4. **Siklus Kerja Terpadu:** Pengelola memverifikasi laporan → Manager menyetujui & menerbitkan Surat Perintah Kerja (SPK) resmi berdokumen PDF → PIC Vendor menugaskan teknisi → Teknisi mengunggah bukti foto sebelum dan sesudah perbaikan → Manager mengonfirmasi penyelesaian.
5. **Notifikasi Transaksional:** Pelapor otomatis menerima kabar perkembangan status tiket via email transaksional di setiap perubahan status.

### Target Pengguna & Matriks Hak Akses
Sistem mengadopsi prinsip **Role-Based Access Control (RBAC)** ketat dengan 7 peran pengguna:

| Role | Lingkup Kerja | Tugas Utama | Pembuatan Akun |
|---|---|---|---|
| **`PENGGUNA`** (Warga/Pengunjung) | Semua Aset Terbuka | Melapor via QR/Portal, memantau tiket, membatalkan tiket status `BARU`. | Registrasi mandiri (Email OTP / Google OAuth) |
| **`PENGELOLA`** (Staf Lapangan) | 1 Cluster Tertaut | Memverifikasi laporan baru, menentukan prioritas, menggabungkan laporan ganda, menandai tidak valid. | Dibuat oleh Admin |
| **`MANAGER`** (Estate Manager) | 1 atau beberapa Cluster | Menyetujui/menolak perbaikan, menerbitkan SPK resmi berlampiran file, konfirmasi hasil akhir teknisi. | Dibuat oleh Admin |
| **`PIC_VENDOR`** (Supervisor Vendor) | Vendor Terdaftar | Menerima SPK, menunjuk teknisi pelaksana, mengelola data teknisi perusahaannya. | Dibuat oleh Admin |
| **`TEKNISI`** (Petugas Lapangan) | SPK yang Ditugaskan | Mengerjakan perbaikan fisik, mengunggah foto sebelum (*before*) & sesudah (*after*), lapor selesai. | Didaftarkan PIC, disetujui Admin |
| **`ADMIN`** (Admin Perusahaan) | 1 Perusahaan Penuh | Mengelola data hierarki wilayah, aset, kategori, QR code, akun internal, persetujuan teknisi, blokir user. | Pemilik Platform |
| **`OWNER`** (Direksi / Pemilik) | 1 Perusahaan Penuh | Memantau KPI ringkasan seluruh cluster, laporan riwayat audit log (*immutable*), dan performa vendor. | Pemilik Platform |

#### Matriks Perizinan Fitur

| Fitur | Pengguna | Pengelola | Manager | PIC Vendor | Teknisi | Admin | Owner |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| Membuat Laporan (QR / Manual) | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Akses Menu `/beranda/*` | ✅ | ❌ (Redirect) | ❌ (Redirect) | ❌ (Redirect) | ❌ (Redirect) | ❌ (Redirect) | ❌ (Redirect) |
| Akses Dashboard `/dashboard/*` | ❌ (Redirect) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Verifikasi & Prioritas Laporan | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Persetujuan & Penerbitan SPK | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Penunjukan Teknisi Pelaksana | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ |
| Unggah Foto Bukti & Selesai SPK | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ |
| Konfirmasi Selesai / Revisi | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Kelola Wilayah, Aset & Cetak QR | ❌ | Lihat | Lihat | ❌ | ❌ | ✅ | Lihat |
| Kelola Akun Internal & Vendor | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ |
| Monitoring Audit Log & Rapor | ❌ | ❌ | ❌ | ❌ | ❌ | Lihat | ✅ |

---

## 2. Technical Documentation

### Arsitektur Sistem

```
                              ┌────────────────────────────────────────┐
                              │             Client Browser             │
                              │  (Mobile Responsive / Desktop PWA UI)  │
                              └───────────────────┬────────────────────┘
                                                  │ HTTPS / Next.js Actions
                                                  ▼
┌──────────────────────────────────────────────────────────────────────────────────────────────┐
│                                     Next.js 15 App Router                                    │
│                                                                                              │
│   ┌──────────────────────┐    ┌──────────────────────┐    ┌──────────────────────────────┐   │
│   │    Citizen Routes    │    │   Dashboard Routes   │    │      REST API Endpoints      │   │
│   │   `/beranda/*`       │    │   `/dashboard/*`     │    │   `/api/auth/google/*`       │   │
│   │   `/r/[code]` (QR)   │    │   (RBAC Scoped RSC)  │    │   `/api/spk/[id]/file`       │   │
│   │   `/status/[ticket]` │    │   (Kanban & Reports) │    │   `/api/cron/*` (Outbox/Mnt) │   │
│   └──────────┬───────────┘    └──────────┬───────────┘    └──────────────┬───────────────┘   │
│              │                           │                               │                   │
│              └───────────────────────────┼───────────────────────────────┘                   │
│                                          │                                                   │
│                                          ▼                                                   │
│                    ┌───────────────────────────────────────────┐                             │
│                    │     Domain Services & Auth Layer          │                             │
│                    │     - React cache() Session Validator     │                             │
│                    │     - Scoping Engine (Company/Cluster)    │                             │
│                    │     - Sequence Generator (Atomic Locks)   │                             │
│                    └─────────────────────┬─────────────────────┘                             │
└──────────────────────────────────────────┼───────────────────────────────────────────────────┘
                                           │
                     ┌─────────────────────┼─────────────────────┐
                     ▼                     ▼                     ▼
        ┌─────────────────────────┐  ┌───────────┐  ┌─────────────────────────┐
        │  PostgreSQL Database    │  │  Storage  │  │  Email Transport        │
        │  - Raw SQL (`pg` Pool)  │  │  S3 /     │  │  - NodeMailer Outbox    │
        │  - Triggers & Audit Log │  │  Local    │  │  - Retries with Backoff │
        │  - Row-Level Immutability│ └───────────┘  └─────────────────────────┘
        └─────────────────────────┘
```

### Diagram Alur Program

#### 1. Siklus Hidup Status Laporan (10 Status)
Setiap laporan kerusakan memiliki siklus status yang terlindungi transaksi atomik:

```
[ PENGGUNA ]
   │
   ▼
 (BARU) ───────────────────────► (DIBATALKAN) [Status Akhir]
   │
   ├─► [ PENGELOLA ] ──────────► (TIDAK_VALID) [Status Akhir]
   ├─► [ PENGELOLA ] ──────────► (DIGABUNG)    [Status Akhir - ikut induk]
   │
   ▼ (Validasi & Beri Prioritas)
 (MENUNGGU_KEPUTUSAN)
   │
   ├─► [ MANAGER ] ────────────► (DITOLAK)     [Status Akhir]
   │
   ▼ (Setuju + Terbitkan SPK & Upload Berkas)
 (DISETUJUI)
   │
   ▼ [ PIC VENDOR ] (Tunjuk Teknisi)
 (DIKERJAKAN) ◄────────────────────────┐
   │                                   │
   ▼ [ TEKNISI ] (Unggah Foto Before/  │ (Manager Minta Revisi /
 (MENUNGGU_KONFIRMASI)   After + Selesai)│  Pekerjaan Belum Sesuai)
   │                                   │
   ├───────────────────────────────────┘
   │
   ▼ [ MANAGER ] (Konfirmasi Sesuai)
 (SELESAI) [Status Akhir]
```

#### 2. Alur Pelaporan Berbasis QR & Draft Offline

```
Warga Scan QR ──► Buka /r/[code] ──► Tampil Info Aset & Riwayat Laporan Aktif
                         │
                         ▼
                  Isi Deskripsi Kerusakan & Ambil Foto Kamera
                         │
                         ▼
                  Simpan Draft di IndexedDB Browser
                         │
            ┌────────────┴────────────┐
            ▼                         ▼
      Sudah Login?              Belum Login?
            │                         │
            │                         ▼
            │               Arahkan ke /login (Google / Email OTP)
            │                         │
            │                         ▼
            │               Kembali ke /r/[code]
            │               Draft Dipulihkan Otomatis dari IndexedDB
            │                         │
            └────────────┬────────────┘
                         ▼
                  Klik "Kirim Laporan"
                         │
                         ▼
        Validasi Server Action (Maks 10 Laporan/Hari)
        Simpan ke DB, Generate Nomor Tiket: TKT-THN-202611-0001
        Kirim Email Konfirmasi Tiket ke Pelapor
```

### Struktur Hierarki Wilayah 5 Tingkat
Struktur data multi-perusahaan dibangun secara hierarkis dan ketat dengan integritas referensial:
```
Company (Perusahaan Pengelola, contoh: PT Taman Hijau Nusantara)
  └── Complex (Komplek / Perumahan, contoh: GreenPark Residence BSD)
        └── Cluster (Kawasan Hunian, contoh: Cluster Bougenville)
              └── Park (Taman Fasilitas, contoh: Taman Utama Bougenville)
                    └── Asset (Fasilitas Fisik Ber-QR, contoh: AST-BGV-001)
```
- Setiap aset berelasi dengan `Category` yang menentukan daftar jenis kerusakan standar.
- Kerusakan pada level induk (misal Cluster nonaktif) otomatis mematikan kemampuan pelaporan seluruh aset di bawahnya via fungsi validasi `assetUnreportableReason()`.

### Keamanan & Integritas Data
1. **Pencegahan Akses Tak Berhak (Fail-Closed Auth):** Token sesi JWT diverifikasi langsung ke tabel `User` pada setiap request (`getCurrentSession()`). Jika database tidak dapat dijangkau, sesi dianggap tidak sah (`SessionUnavailableError`) untuk mencegah pengguna yang sudah diblokir tetap aktif.
2. **Imutabilitas Audit Log & Proteksi Penghapusan:** 
   - Tabel `AuditLog` diproteksi trigger SQL `greenpark_block_auditlog_mutation()`: operasi `UPDATE` dan `DELETE` ditolak langsung pada level PostgreSQL.
   - Tabel `Report` diproteksi trigger `greenpark_block_report_delete()`: penghapusan permanen ditolak; data hanya dapat diarsipkan (`archivedAt`).
3. **Penomoran Bebas Benturan (Concurreny Safe):** Generator nomor Tiket (`TKT`), SPK (`SPK`), dan Pengajuan Ganti Vendor (`PGV`) menggunakan tabel `SequenceCounter` dengan penguncian baris (`SELECT ... FOR UPDATE`) di dalam transaksi atomik PostgreSQL (`withTransaction`).
4. **Proteksi Anti-Enumerasi & Throttling OTP:** Verifikasi OTP email menggunakan hash SHA-256 dengan batas maksimal 5 kali percobaan, masa berlaku 15 menit, dan proteksi anti-enumerasi (respon selalu seragam terlepas dari apakah email sudah terdaftar).

---

## 3. Frontend Documentation

### Framework & Library Utama
- **Core:** [Next.js 15.5](https://nextjs.org/) (App Router, Turbopack) & [React 19.1](https://react.dev/)
- **Styling:** [Tailwind CSS v4](https://tailwindcss.com/) dengan arsitektur utility modern
- **Iconography:** [Lucide React](https://lucide.dev/)
- **Scanner QR:** [jsQR](https://github.com/cozmo/jsQR) untuk decoding stream canvas video webcam/kamera HP
- **QR Generator:** `qrcode` untuk mencetak lembar stiker QR aset di dashboard admin
- **State & Draft Lokal:** Native IndexedDB API via `src/lib/draft-idb.ts`

### Struktur Routing Halaman

#### Portal Warga (`/beranda/*`)
Halaman khusus pengguna peran `PENGGUNA`. Pengguna internal akan dialihkan ke `/dashboard`.
- [`src/app/beranda/page.tsx`](src/app/beranda/page.tsx) — Halaman beranda warga: pencarian aset, tombol scan cepat, filter taman, statistik tiket, dan daftar laporan terbaru.
- [`src/app/beranda/lapor/page.tsx`](src/app/beranda/lapor/page.tsx) — Formulir pelaporan kerusakan mandiri (pilih aset manual dari daftar).
- [`src/app/beranda/laporan/page.tsx`](src/app/beranda/laporan/page.tsx) — Riwayat lengkap laporan warga dengan tab status (Semua, Menunggu, Diproses, Selesai, Dibatalkan/Ditolak).
- [`src/app/beranda/profil/page.tsx`](src/app/beranda/profil/page.tsx) — Profil warga, kelengkapan nomor rumah/blok, panduan pelaporan, dan tombol logout.

#### Alur Pemindaian QR & Pelacakan Publik
- [`src/app/scan/page.tsx`](src/app/scan/page.tsx) — Kamera pemindai QR berbasis web (dukungan torch/flashlight & upload gambar barcode).
- [`src/app/r/[code]/page.tsx`](src/app/r/[code]/page.tsx) — Landing page shortlink QR aset (misal `/r/AST-BGV-001`). Menampilkan detail lokasi, status aktif aset, riwayat perbaikan aktif, dan form input laporan.
- [`src/app/status/[ticketNo]/page.tsx`](src/app/status/[ticketNo]/page.tsx) — Pelacakan status laporan publik berbasis nomor tiket transparan untuk pelapor.

#### Dashboard Operasional Staf (`/dashboard/*`)
Halaman khusus peran internal (`PENGELOLA`, `MANAGER`, `PIC_VENDOR`, `TEKNISI`, `ADMIN`, `OWNER`).
- [`src/app/dashboard/page.tsx`](src/app/dashboard/page.tsx) — Tampilan beranda dashboard yang adaptif menampilkan komponen khusus per role.
- [`src/app/dashboard/laporan/page.tsx`](src/app/dashboard/laporan/page.tsx) — Kanban/Daftar verifikasi laporan pengelola dan keputusan persetujuan manager.
- [`src/app/dashboard/spk/page.tsx`](src/app/dashboard/spk/page.tsx) — Daftar penugasan SPK bagi Manager, PIC Vendor, dan Teknisi.
- [`src/app/dashboard/wilayah/page.tsx`](src/app/dashboard/wilayah/page.tsx) — Manajemen master data Komplek, Cluster, Taman, dan Aset.
- [`src/app/dashboard/wilayah/cetak-qr/page.tsx`](src/app/dashboard/wilayah/cetak-qr/page.tsx) — Cetak stiker QR code aset siap tempel (format grid A4).
- [`src/app/dashboard/vendor/page.tsx`](src/app/dashboard/vendor/page.tsx) — Pengelolaan data rekanan vendor, area layanan, dan masa garansi.
- [`src/app/dashboard/teknisi/page.tsx`](src/app/dashboard/teknisi/page.tsx) — Daftar teknisi, monitoring status aktif/cuti, dan persetujuan admin.
- [`src/app/dashboard/akun/page.tsx`](src/app/dashboard/akun/page.tsx) — Manajemen pengguna internal & pemblokiran akun penyalahguna.
- [`src/app/dashboard/audit/page.tsx`](src/app/dashboard/audit/page.tsx) — Log audit sistem yang tidak dapat diubah (*immutable*).
- [`src/app/dashboard/notifikasi/page.tsx`](src/app/dashboard/notifikasi/page.tsx) — Pusat pemberitahuan aktivitas web staf internal.

### Struktur Komponen UI
- [`src/components/BottomNav.tsx`](src/components/BottomNav.tsx): Navigasi bawah adaptif (Bottom Navigation Bar) untuk tampilan mobile (warga di `/beranda/*` dan petugas di `/dashboard/*`).
- [`src/components/MobileContainer.tsx`](src/components/MobileContainer.tsx): Pembungkus antarmuka berpusat mobile (maksimal lebar 440px di desktop) untuk kenyamanan penggunaan satu tangan di lapangan.
- [`src/components/dashboard/app-sidebar.tsx`](src/components/dashboard/app-sidebar.tsx): Navigasi sidebar desktop untuk staf operasional.
- [`src/components/dashboard/top-header.tsx`](src/components/dashboard/top-header.tsx): Header atas dashboard dengan indikator lonceng notifikasi belum dibaca.
- [`src/app/beranda/loading.tsx`](src/app/beranda/loading.tsx) & [`src/app/dashboard/loading.tsx`](src/app/dashboard/loading.tsx): Kerangka skeleton instan saat pergantian halaman dinamis.

### Manajemen Aset & Offline Draft
- **Draft Pelaporan (IndexedDB):** Menggunakan helper `src/lib/draft-idb.ts`. Saat pengunjung memindai QR dalam keadaan belum login, form otomatis menyimpan file gambar foto dan deskripsi ke IndexedDB browser dengan kunci kode aset. Setelah proses autentikasi (Google / OTP) selesai, draft dipulihkan ke form tanpa menghilangkan foto yang sudah diambil.
- **Sanitasi Media:** Seluruh tautan foto yang dirender ke antarmuka disaring melalui `sanitizeMediaHref()` untuk mencegah eksploitasi URL jahat (`javascript:`, data URI berbahaya, atau XSS).

---

## 4. Backend Documentation

### Arsitektur Database (Raw SQL Tanpa ORM)
Sistem menggunakan **PostgreSQL murni** melalui driver [`pg`](https://node-postgres.com/) tanpa ORM (Prisma/TypeORM ditiadakan untuk kecepatan, determinisme, dan kontrol penuh atas query transaksional).

- [`src/lib/db.ts`](src/lib/db.ts): Wrapper koneksi pool dengan fungsi pembantu:
  - `query<T>(sql, params)` — Menjalankan SELECT dan mengembalikan daftar baris bertipe `T[]`.
  - `queryOne<T>(sql, params)` — Mengambil 1 baris pertama atau `null`.
  - `queryCount(sql, params)` — Menghitung jumlah record (`COUNT(*)::int`).
  - `execute(sql, params)` — Menjalankan INSERT/UPDATE/DELETE dan mengembalikan jumlah baris terdampak.
  - `withTransaction<T>((tx) => Promise<T>)` — Menjalankan serangkaian query di dalam blok atomik `BEGIN` / `COMMIT` / `ROLLBACK`.
- [`src/lib/pg-config.ts`](src/lib/pg-config.ts): Konfigurasi cerdas connection pool. Mendeteksi otomatis koneksi remote (misal Supabase / Neon) untuk menerapkan SSL `rejectUnauthorized: false` serta menonaktifkan SSL saat di localhost. Pool dikonfigurasi dengan `idleTimeoutMillis: 300000` (5 menit) dan `keepAlive: true` agar koneksi tetap hangat dan menghindari latensi *handshake* berulang.

### Skema Database & Entitas Utama

Tabel-tabel relasional utama didefinisikan dalam [`db/migrations/0001_init.sql`](db/migrations/0001_init.sql):

1. **`Company`**: Profil perusahaan pengelola klien (multi-tenant root).
2. **`Complex`**, **`Cluster`**, **`Park`**, **`Asset`**: Struktur hierarki 5 tingkat lokasi fasilitas.
3. **`Category`**: Kategori fasilitas beserta array jenis kerusakan (`damageTypes text[]`).
4. **`User`**: Akun pengguna (warga dan staf internal) dengan atribut role, blokir, dan rekam jejak laporan valid/tidak valid.
5. **`ClusterManagerAssignment`**: Penugasan manager definitif maupun manajer pengganti sementara (`isTemporary`, `validUntil`).
6. **`Vendor`** & **`VendorServiceArea`**: Rekanan perbaikan, jenis (internal/eksternal), masa garansi, dan cakupan cluster layanan.
7. **`Technician`**: Data teknisi di bawah vendor, nomor kontak WhatsApp, status persetujuan admin (`approvalStatus`), dan riwayat keaktifan.
8. **`Report`**: Data inti laporan kerusakan, status tiket, prioritas, relasi aset, pelapor, dan penanda garansi.
9. **`ReportPhoto`**: Foto dokumentasi awal kerusakan dari pelapor.
10. **`ReportStatusLog`**: Jejak audit kronologis setiap kali status laporan berubah.
11. **`WorkOrder` (SPK)**: Surat Perintah Kerja perbaikan, nomor SPK unik, relasi teknisi pelaksana, dan tautan file PDF resmi SPK (`spkFileUrl`).
12. **`WorkPhoto`**: Foto dokumentasi teknisi berlabel `BEFORE` (sebelum perbaikan) dan `AFTER` (setelah perbaikan).
13. **`RevisionNote`**: Catatan perbaikan ulang saat manager menolak hasil pengerjaan teknisi.
14. **`AuditLog`**: Jejak audit perubahan data master yang dilindungi trigger *read-only*.
15. **`Notification`**: Notifikasi *in-app* web untuk pengguna staf internal.
16. **`EmailLog`**: Antrean outbox pengiriman email transaksional dengan mekanisme *exponential backoff*.
17. **`OtpCode`**: Kode verifikasi login/pendaftaran berbasis email (hash SHA-256).
18. **`SequenceCounter`**: Generator sekuensial nomor tiket/SPK anti-race condition.
19. **`VendorReplacementRequest`**: Pengajuan resmi pergantian rekanan vendor bermasalah.

### REST API Endpoints & Cron

| Method | Endpoint | Fungsi & Deskripsi | Otorisasi |
|---|---|---|---|
| `GET` | `/api/auth/google/start` | Menginisialisasi alur otentikasi Google OAuth 2.0 dengan proteksi PKCE (`code_challenge`) dan state cookie aman. | Publik |
| `GET` | `/api/auth/google/callback` | Menangani *callback* pertukaran kode Google, membuat/mencocokkan akun `User`, dan menerbitkan cookie sesi. | Publik |
| `GET` | `/api/spk/[id]/file` | Mengunduh berkas resmi PDF SPK. Memvalidasi kepemilikan SPK sesuai hak akses role sebelum mengalirkan berkas / mengalihkan ke *presigned URL*. | Sesi Staf Berwenang |
| `GET` / `POST` | `/api/cron/outbox` | Pekerja latar belakang (Cron Worker) untuk memproses antrean `EmailLog` (`QUEUED` / `FAILED` jatuh tempo). Mendukung retry backoff 1, 5, 15, 60 menit hingga status `DEAD` (maks 5 kali). | `Bearer <CRON_SECRET>` |
| `GET` / `POST` | `/api/cron/maintenance` | Cron harian (misal pukul 01:00 WIB) untuk otomatis menonaktifkan teknisi tanpa penugasan selama 60 hari (`AUTO_60_DAYS`) dan memicu notifikasi konfirmasi berkala PIC vendor. | `Bearer <CRON_SECRET>` |

### Server Actions
Seluruh mutasi antarmuka diproses melalui Next.js Server Actions yang aman di direktori [`src/app/actions/`](src/app/actions/):
- **`auth-actions.ts`**: `loginWithPasswordAction`, `requestOtpAction`, `verifyOtpAndLoginAction`, `logoutAction`, `updateUserProfileAction`.
- **`phase1-actions.ts`**: CRUD Komplek, Cluster, Taman, Kategori, dan Aset fisik.
- **`phase2-actions.ts`**: Pendaftaran vendor, mapping wilayah layanan, penambahan teknisi baru, dan persetujuan akun teknisi oleh Admin.
- **`phase3-actions.ts`**: `submitReportAction` (pembuatan laporan dengan batas kuota 10/hari), `cancelOwnReportAction` (pembatalan laporan status `BARU` oleh warga).
- **`phase4-actions.ts`**: `verifyReportAction` (validasi laporan & penentuan prioritas oleh pengelola), `markReportInvalidAction` (tolak laporan tidak valid), `mergeReportsAction` (penggabungan laporan duplikat).
- **`phase5-actions.ts`**: `managerDecisionAction` (persetujuan perbaikan & penerbitan SPK berlampiran berkas oleh Estate Manager).
- **`phase6-actions.ts`**: `assignTechnicianAction` (penunjukan teknisi oleh PIC vendor), `technicianSubmitWorkAction` (pengunggahan bukti *before* & *after* oleh teknisi), `managerConfirmWorkAction` (konfirmasi selesai atau instruksi perbaikan ulang).
- **`notification-actions.ts`**: `markNotificationAsReadAction`, `markAllNotificationsAsReadAction`.

### Dokumentasi `.env.example`

Berikut konfigurasi variabel lingkungan yang wajib disediakan:

```bash
# ==============================================================================
# 1. KONEKSI DATABASE POSTGRESQL (Wajib)
# ==============================================================================
# Format: postgresql://<user>:<password>@<host>:<port>/<dbname>
# - Local Docker/Native : postgresql://postgres:postgres@127.0.0.1:5432/greenpark
# - Supabase di Vercel   : Wajib gunakan Transaction Pooler (Port 6543), bukan Session Pooler (5432).
DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:5432/greenpark"

# ==============================================================================
# 2. KEAMANAN & AUTENTIKASI (Wajib)
# ==============================================================================
# Kunci enkripsi JWT sesi (minimal 32 karakter acak).
# Buat dengan: openssl rand -base64 32
AUTH_SECRET="ganti_dengan_kunci_rahasia_acak_minimal_32_karakter_12345"

# Password default yang akan di-hash untuk akun-akun seed demo lokal.
SEED_DEFAULT_PASSWORD="Password123!"

# URL dasar aplikasi (tanpa garis miring di akhir) untuk tautan cek tiket di email.
APP_BASE_URL="http://localhost:3000"

# Token otentikasi cron worker (/api/cron/outbox & /api/cron/maintenance).
CRON_SECRET="kunci_rahasia_cron_worker_bebas_tebak_98765"

# ==============================================================================
# 3. PENYIMPANAN BERKAS / OBJECT STORAGE (S3-Compatible / Supabase Storage)
# ==============================================================================
# Kosongkan saat development lokal untuk menyimpan file ke public/uploads/ dan .private-uploads/.
# Wajib diisi pada lingkungan produksi serverless (seperti Vercel) karena filesystem read-only.
S3_ENDPOINT=""
S3_REGION="ap-southeast-1"
S3_ACCESS_KEY_ID=""
S3_SECRET_ACCESS_KEY=""
S3_BUCKET=""               # Bucket publik untuk foto laporan dan foto teknisi
S3_PRIVATE_BUCKET=""       # Bucket privat untuk berkas PDF dokumen SPK
S3_PUBLIC_BASE_URL=""      # Opsional: Base CDN publik jika menggunakan domain kustom

# ==============================================================================
# 4. GOOGLE OAUTH 2.0 (Opsional)
# ==============================================================================
# Dapatkan dari Google Cloud Console > Credentials > OAuth 2.0 Client IDs.
GOOGLE_CLIENT_ID=""
GOOGLE_CLIENT_SECRET=""
GOOGLE_REDIRECT_URI=""      # Opsional, default: ${APP_BASE_URL}/api/auth/google/callback

# ==============================================================================
# 5. SMTP EMAIL OUTBOX (Opsional di Lokal, Wajib di Produksi)
# ==============================================================================
# Kosongkan SMTP_HOST saat dev lokal untuk mengalihkan log email ke console terminal.
SMTP_HOST=""
SMTP_PORT="587"
SMTP_USER=""
SMTP_PASS=""
SMTP_FROM="GreenPark Desk <no-reply@greenpark.id>"
```

---

## 5. Panduan Instalasi & Menjalankan Projek

### Prasyarat Sistem
- **Node.js**: Versi `20.x` LTS atau `22.x`
- **Package Manager**: `npm` (disertakan bersama Node.js)
- **Database**: PostgreSQL 14, 15, atau 16 aktif (lokal atau cloud seperti Supabase / Neon)

### Langkah Pemasangan

1. **Clone repositori dan masuk ke direktori projek:**
   ```bash
   git clone <url-repository>
   cd greendesk
   ```

2. **Instal seluruh dependensi:**
   ```bash
   npm install
   ```

3. **Siapkan berkas konfigurasi lingkungan:**
   ```bash
   cp .env.example .env
   ```
   *Buka berkas `.env` dan sesuaikan nilai `DATABASE_URL`, `AUTH_SECRET`, dan `SEED_DEFAULT_PASSWORD`.*

4. **Siapkan berkas konfigurasi pengujian otomatis:**
   ```bash
   cp .env.example .env.test
   ```
   *Penting: Arahkan `DATABASE_URL` pada `.env.test` ke database pengujian terpisah (misal `greenpark_test`) agar tidak menimpa data development.*

5. **Siapkan database di PostgreSQL:**
   ```sql
   CREATE DATABASE greenpark;
   CREATE DATABASE greenpark_test;
   ```

6. **Jalankan migrasi database dan penyemaian data awal (seeding):**
   ```bash
   npm run db:setup
   ```
   *Perintah ini mengeksekusi migrasi SQL terstruktur (`db/migrations/`) dan menyuntikkan data master, hierarki wilayah, aset ber-QR, serta 7 akun demo.*

7. **Jalankan server pengembangan:**
   ```bash
   npm run dev
   ```
   Buka peramban pada alamat [http://localhost:3000](http://localhost:3000).

---

### Akun Demo Hasil Seeding
Setelah menjalankan `npm run db:setup`, seluruh akun berikut dapat langsung digunakan untuk pengujian (kata sandi sesuai dengan `SEED_DEFAULT_PASSWORD` pada `.env`, contoh: `Password123!`):

| Role | Nama Pengguna | Alamat Email | Hak Akses & Cakupan |
|---|---|---|---|
| **`PENGGUNA`** | Rina Kartika | `warga@greenpark.id` | Warga Bougenville A2/15 (Akses `/beranda/*`) |
| **`PENGELOLA`** | Hendro Wibowo | `pengelola.bgv@greenpark.id` | Staf Pengelola Cluster Bougenville |
| **`MANAGER`** | Diana Kusuma | `manager@greenpark.id` | Estate Manager Cluster Bougenville & Edelweiss |
| **`PIC_VENDOR`** | Agus Pratama | `pic@vendorjaya.id` | Supervisor CV Taman Jaya Abadi |
| **`TEKNISI`** | Budi Santoso | `teknisi.budi@vendorjaya.id` | Teknisi Lapangan CV Taman Jaya Abadi |
| **`ADMIN`** | Arfin Mardiyanto | `admin@greenpark.id` | Administrator PT Taman Hijau Nusantara |
| **`OWNER`** | Ir. Surya Darmawan | `owner@greenpark.id` | Direksi PT Taman Hijau Nusantara |

*Catatan: Tersedia juga akun Admin perusahaan terpisah `admin@griyaasri.id` untuk menguji isolasi data multi-perusahaan.*

---

### Pengujian Otomatis (Testing)
Pengujian unit dan integrasi dijalankan menggunakan **Vitest**:
```bash
# Menjalankan seluruh test suite
npm test

# Menjalankan type-checking TypeScript tanpa emit
npx tsc --noEmit
```
Global setup Vitest otomatis mengisolasi database pengujian (`.env.test`), menjalankan migrasi, dan menyuntikkan data uji secara idempoten sebelum rangkaian tes dieksekusi.

---

## 6. Alur Penggunaan Sistem (Step-by-Step per Role)

Berikut panduan skenario pengujian menyeluruh (*end-to-end*) dari awal laporan dibuat hingga perbaikan selesai:

### Skenario 1: Warga Melaporkan Kerusakan lewat QR Code
1. Buka tautan salah satu aset demo di browser: [http://localhost:3000/r/AST-BGV-001](http://localhost:3000/r/AST-BGV-001) (atau gunakan fitur kamera di `/scan`).
2. Tampilan akan memuat informasi aset *Ayunan Ganda Anak #01* di *Taman Bunga Bougenville*.
3. Periksa bagian **Laporan Aktif**: jika belum ada, masukkan deskripsi kerusakan (misal: *"Rantai ayunan sebelah kiri putus dan membahayakan anak-anak"*) dan pilih foto sampel kerusakan.
4. Jika belum login, klik opsi **Masuk Akun** atau **Daftar**. Gunakan akun demo `warga@greenpark.id`.
5. Setelah masuk, sistem kembali ke halaman aset dan memulihkan draft secara utuh.
6. Klik **Kirim Laporan**. Nomor tiket akan diterbitkan (misal: `TKT-THN-202611-0001`) dengan status `BARU`.
7. Warga dapat memantau laporan di menu **Laporan Saya** (`/beranda/laporan`).

### Skenario 2: Pengelola Memverifikasi Laporan
1. Masuk ke aplikasi menggunakan akun `pengelola.bgv@greenpark.id`.
2. Sistem otomatis membuka `/dashboard/laporan`.
3. Buka tab laporan berstatus **Baru** pada Cluster Bougenville.
4. Buka detail laporan tiket yang baru dibuat:
   - Pilih tingkat prioritas: **Tinggi**, **Normal**, atau **Rendah**.
   - Berikan catatan verifikasi (opsional).
   - Klik tombol **Verifikasi & Teruskan ke Manager**.
5. Status laporan berubah menjadi `MENUNGGU_KEPUTUSAN`. Pelapor menerima email konfirmasi bahwa laporan valid dan diteruskan ke manajemen.

### Skenario 3: Estate Manager Menyetujui & Menerbitkan SPK
1. Masuk ke aplikasi menggunakan akun `manager@greenpark.id`.
2. Buka menu **Daftar Laporan** (`/dashboard/laporan`) pada tab **Menunggu Keputusan**.
3. Buka detail laporan, lalu pilih tindakan **Setujui Perbaikan**:
   - Pilih rekanan vendor pelaksana (misal: *CV Taman Jaya Abadi*).
   - Unggah dokumen resmi Surat Perintah Kerja (wajib lampirkan file dokumen/PDF).
   - Masukkan catatan persetujuan.
   - Klik **Terbitkan SPK**.
4. Sistem mencatat nomor SPK baru (misal: `SPK-THN-202611-0001`), status laporan berubah menjadi `DISETUJUI`, dan notifikasi otomatis dikirim ke PIC Vendor terkait.

### Skenario 4: PIC Vendor Menunjuk Teknisi
1. Masuk menggunakan akun `pic@vendorjaya.id`.
2. Buka menu **Manajemen SPK** (`/dashboard/spk`).
3. Pilih SPK yang baru diterbitkan. PIC dapat mengunduh dan membaca berkas dokumen SPK dari Manager.
4. Pada panel penunjukan teknisi, pilih teknisi pelaksana: **Budi Santoso**.
5. Klik **Tugaskan Teknisi**.
6. Status laporan otomatis beralih menjadi `DIKERJAKAN`. Notifikasi terkirim ke akun teknisi dan email pembaruan dikirimkan ke pelapor.

### Skenario 5: Teknisi Mengerjakan & Mengunggah Bukti
1. Masuk menggunakan akun `teknisi.budi@vendorjaya.id` (bisa melalui mekanisme OTP email).
2. Buka menu **Tugas SPK Saya** (`/dashboard/spk`).
3. Buka SPK yang ditugaskan:
   - Unggah **Foto Sebelum Perbaikan (*Before*)** yang memperlihatkan kerusakan fisik.
   - Lakukan perbaikan fisik di lapangan.
   - Unggah **Foto Sesudah Perbaikan (*After*)** yang memperlihatkan fasilitas yang telah diperbaiki rapi.
   - Tambahkan catatan penyelesaian pekerjaan.
4. Klik **Laporkan Pekerjaan Selesai**.
5. Status laporan berubah menjadi `MENUNGGU_KONFIRMASI`. Manager menerima notifikasi pekerjaan selesai untuk ditinjau.

### Skenario 6: Manager Mengonfirmasi Penyelesaian
1. Kembali masuk sebagai `manager@greenpark.id`.
2. Buka menu **Manajemen SPK** atau **Daftar Laporan**.
3. Buka tiket dengan status **Menunggu Konfirmasi**:
   - Tinjau perbandingan foto *Before* dan *After* yang diunggah teknisi.
   - Jika hasil belum memuaskan: Klik **Minta Perbaikan Ulang** dan sertakan catatan revisi (status kembali ke `DIKERJAKAN`).
   - Jika hasil telah sempurna: Klik **Konfirmasi Selesai**.
4. Laporan berpindah ke status akhir `SELESAI`.
5. Pelapor menerima email penutupan tiket berisi ucapan terima kasih dan lampiran foto hasil akhir fasilitas yang telah berfungsi kembali.

---

## Pemeliharaan & Kontribusi
- Seluruh migrasi database baru wajib ditambahkan di direktori `db/migrations/` dengan penomoran urut (misal `0003_fitur_baru.sql`).
- Jangan mengubah file migrasi yang sudah pernah dijalankan pada database produksi.
- Gunakan perintah `npm run lint` dan `npm test` sebelum melakukan *pull request* atau *commit*.
