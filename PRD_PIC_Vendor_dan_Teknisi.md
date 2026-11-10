# PRD – Platform Manajemen Aset Taman: Role PIC Vendor dan Teknisi

Disusun dari PRD v0.1, Proses Bisnis (1 Nov 2026), dan diskusi lanjutan · Versi 0.2 (draft untuk disepakati) · Cakupan: dua role di sisi pengerjaan perbaikan

---

## 1. Tentang dokumen ini

Dokumen ini memerinci kebutuhan produk untuk dua role di sisi pengerjaan: **PIC Vendor** (penerima SPK dan pengelola teknisi vendornya) dan **Teknisi** (pelaksana perbaikan di lapangan). Role Pengguna, Pengelola, dan Manager ada di dokumen terpisah; Admin dan Owner/Direksi menyusul. Titik serah terima dengan role-role itu dicantumkan di sini.

**Catatan Tim Internal.** Tim Internal pengelola diperlakukan sebagai satu vendor, dengan supervisor teknisi sebagai PIC-nya. Seluruh isi dokumen ini berlaku sama untuk Tim Internal.

### 1.1 Keputusan yang sudah ditetapkan

Semua usulan dari diskusi sebelumnya disetujui dan sudah menjadi aturan dalam dokumen ini.

| No. | Keputusan |
| --- | --- |
| 1 | Alur "vendor menolak SPK" **tidak** dibuat di sistem; bila vendor tidak sanggup, ditangani di luar sistem. PIC hanya punya satu langkah wajib: menunjuk teknisi. |
| 2 | Teknisi login dengan **email dan OTP**, tanpa Google. |
| 3 | Satu orang boleh berperan **PIC dan Teknisi** sekaligus, dengan dua peran di akun yang sama. |
| 4 | PIC boleh **mengganti teknisi** saat SPK berjalan; foto sebelum yang sudah diunggah tetap melekat pada SPK. |
| 5 | Perbaikan ulang **kembali ke teknisi yang sama**; PIC dapat menggantinya. |
| 6 | Foto sebelum wajib ada **sebelum tombol Lapor selesai aktif**, tidak harus diunggah sebelum mulai. |
| 7 | Penonaktifan teknisi karena tidak aktif 60 hari berjalan **otomatis**, kecuali teknisi masih memegang SPK aktif. |
| 8 | Status **cuti** tidak dihitung dalam batas 60 hari. |
| 9 | Aktif kembali dibedakan menurut penyebab nonaktif (lihat bagian 5.3). |
| 10 | Konfirmasi daftar teknisi tiap 3 bulan yang tidak dilakukan hanya berujung **pengingat berulang**, tanpa pembatasan akses. |
| 11 | Teknisi boleh melihat **foto dan deskripsi kerusakan**; identitas pelapor tidak pernah tampil. |
| 12 | PIC dan Teknisi melihat **penanda garansi** sebagai informasi di detail SPK. |
| 13 | Kendala teknis yang membuat pekerjaan tidak selesai dikomunikasikan lewat jalur di luar sistem; SPK tetap berjalan. |
| 14 | Saat Manager menyetujui laporan dan menerbitkan SPK, Manager **wajib mengunggah file surat perintah kerja**. SPK tidak dapat terbit tanpa file tersebut. |

---

## 2. Gambaran alur

```
Manager ──setuju + SPK──► PIC Vendor ──tunjuk teknisi──► Teknisi ──foto sebelum/sesudah──► Manager cek
                                                              ▲                                │
                                                              └──── belum sesuai + catatan ────┘
```

### 2.1 Status laporan di sisi pengerjaan

| Status | Diubah oleh | Status berikutnya |
| --- | --- | --- |
| Disetujui | Manager (saat SPK terbit) | Dikerjakan |
| Dikerjakan | PIC Vendor (saat menunjuk teknisi) | Menunggu Konfirmasi |
| Menunggu Konfirmasi | Teknisi (saat lapor selesai) | Selesai, atau Dikerjakan (perbaikan ulang) |

### 2.2 Titik serah terima

| Pemicu | Yang terjadi |
| --- | --- |
| Manager setuju dan membuat SPK (Disetujui), **dengan melampirkan file surat perintah kerja** | SPK beserta file surat perintah kerja masuk ke PIC Vendor; notifikasi web "SPK baru diterima" |
| PIC menunjuk teknisi (Dikerjakan) | SPK masuk ke teknisi; notifikasi web "Ditunjuk untuk SPK"; email ke pelapor bahwa perbaikan sedang ditangani |
| Teknisi lapor selesai (Menunggu Konfirmasi) | Notifikasi web ke Manager "pekerjaan selesai" |
| Manager menyatakan belum sesuai (kembali Dikerjakan) | Notifikasi web ke teknisi "diminta perbaikan ulang" beserta catatan |

---

## 3. Role PIC Vendor

### 3.1 Tujuan

PIC Vendor (cakupan: perusahaan vendornya) menerima SPK dari Manager, menunjuk teknisi, dan mengelola data teknisi vendornya. Akun dibuat Admin; PIC menerima email undangan lalu mengaktifkan akunnya.

### 3.2 Menu

| Kode | Menu | Isi utama | Aksi |
| --- | --- | --- | --- |
| PIC-M1 | Beranda | Penanda tugas baru; SPK menunggu penunjukan teknisi; SPK berjalan; permintaan konfirmasi daftar teknisi bila jatuh tempo | Buka SPK |
| PIC-M2 | SPK Masuk | SPK baru yang belum ada teknisinya: nomor SPK, aset, taman, cluster, prioritas, tanggal tugas, hari sejak terbit | Buka detail |
| PIC-M2a | Detail SPK | Aset, kode, titik lokasi, foto aset; foto dan deskripsi kerusakan; prioritas; tanggal tugas; catatan Manager; **file surat perintah kerja (lihat dan unduh)**; penanda garansi bila ada; **tanpa nama dan email pelapor** | **Tunjuk teknisi** |
| PIC-M3 | Semua SPK | Seluruh SPK vendornya di semua status; filter status, cluster, teknisi, tanggal | Buka detail, ganti teknisi |
| PIC-M4 | Teknisi Saya | Daftar teknisi: nama, keahlian, status (aktif / cuti / nonaktif), status persetujuan, login terakhir, jumlah SPK berjalan | Tambah, ubah, set cuti, nonaktifkan, ajukan aktif kembali |
| PIC-M4a | Daftarkan Teknisi | Nama lengkap, nomor WA, email, foto wajah, keahlian | Kirim untuk disetujui Admin |
| PIC-M4b | Konfirmasi Daftar Teknisi | Muncul tiap 3 bulan: daftar teknisi untuk dikonfirmasi masih benar | Konfirmasi, atau ubah lalu konfirmasi |
| PIC-M5 | Profil Vendor | Nama perusahaan, jenis, bidang keahlian, PIC, area layanan, masa kontrak, masa garansi, alamat, NPWP | Lihat saja (dikelola Admin) |
| PIC-M6 | Notifikasi | Daftar notifikasi web | Tandai dibaca, buka SPK |
| PIC-M7 | Profil | Nama, email, WA PIC | Keluar |

Jika akun yang sama juga berperan Teknisi, menu Teknisi (bagian 4.2) muncul sebagai bagian terpisah dalam akun tersebut.

### 3.3 Aksi Tunjuk Teknisi

- Pilihan hanya memuat teknisi yang **aktif dan sudah disetujui Admin**. Teknisi berstatus cuti, nonaktif, atau belum disetujui tidak muncul.
- Hasil: SPK berisi teknisi; status laporan menjadi Dikerjakan; email ke pelapor; notifikasi web ke teknisi.
- Ganti teknisi saat SPK berjalan: PIC menunjuk teknisi lain; teknisi lama kehilangan akses; foto sebelum yang sudah diunggah tetap melekat pada SPK; teknisi baru dapat melanjutkan; perubahan tercatat di riwayat.

### 3.4 User story

| ID | Sebagai PIC Vendor, saya ingin… | Agar… |
| --- | --- | --- |
| PIC-01 | melihat SPK baru dari Manager beserta detail aset dan kerusakan | bisa menentukan teknisi yang tepat |
| PIC-02 | menunjuk teknisi aktif untuk sebuah SPK | pekerjaan segera dimulai |
| PIC-03 | mengganti teknisi saat SPK berjalan | pekerjaan tidak macet bila teknisi berhalangan |
| PIC-04 | mendaftarkan teknisi baru dengan data lengkap | teknisi bisa disetujui Admin dan aktif |
| PIC-05 | mengubah data, menandai cuti, atau menonaktifkan teknisi | daftar teknisi selalu sesuai kenyataan |
| PIC-06 | mengajukan aktif kembali teknisi yang nonaktif otomatis | teknisi bisa bekerja lagi tanpa membuat akun baru |
| PIC-07 | mengonfirmasi daftar teknisi tiap 3 bulan | data vendor tetap benar |
| PIC-08 | melihat semua SPK vendor saya dan statusnya | bisa memantau beban kerja |
| PIC-09 | melihat penanda garansi di detail SPK | tahu apakah pekerjaan terkait garansi |

### 3.5 Aturan bisnis

1. PIC hanya melihat SPK dan teknisi vendornya sendiri.
2. PIC tidak melihat nama atau email pelapor.
3. Penunjukan teknisi hanya dari teknisi aktif dan sudah disetujui.
4. PIC tidak dapat mengubah isi laporan atau SPK selain penunjukan teknisi.
5. Data vendor dikelola Admin; PIC hanya melihat.
6. Teknisi baru tidak aktif sebelum disetujui Admin.
7. Setiap penunjukan, penggantian, dan perubahan data teknisi tercatat di riwayat.

### 3.6 Kriteria penerimaan

- PIC hanya melihat SPK yang vendornya cocok dengan vendor akunnya.
- Setiap SPK yang diterima PIC memiliki file surat perintah kerja yang dapat dibuka dan diunduh.
- Pilihan teknisi pada Tunjuk Teknisi tidak memuat teknisi cuti, nonaktif, atau belum disetujui.
- Menunjuk teknisi mengubah status ke Dikerjakan, menulis riwayat, mengirim email ke pelapor, dan membuat notifikasi ke teknisi dalam satu transaksi.
- Mengganti teknisi tidak menghapus foto sebelum yang sudah ada.
- Mendaftarkan teknisi membuat status "Menunggu persetujuan" dan notifikasi ke Admin.
- Konfirmasi daftar teknisi muncul tiap 3 bulan; bila belum dilakukan, pengingat muncul berulang tanpa membatasi akses.

---

## 4. Role Teknisi

### 4.1 Tujuan

Teknisi (cakupan: SPK yang ditugaskan kepadanya) mengerjakan perbaikan di lapangan dan mengunggah foto sebelum dan sesudah. Akun dibuat PIC Vendor, aktif setelah disetujui Admin. Login dengan email dan OTP.

### 4.2 Menu

| Kode | Menu | Isi utama | Aksi |
| --- | --- | --- | --- |
| TKN-M1 | Beranda | SPK yang perlu dikerjakan; SPK dengan catatan perbaikan ulang di bagian atas | Buka SPK |
| TKN-M2 | SPK Saya | Daftar SPK yang ditugaskan: nomor, aset, taman, tanggal tugas, status; filter Aktif / Selesai | Buka detail |
| TKN-M2a | Detail SPK | Aset, kode, titik lokasi, foto aset; foto dan deskripsi kerusakan; prioritas; tanggal tugas; catatan perbaikan ulang dari Manager bila ada; **file surat perintah kerja (lihat dan unduh)**; penanda garansi bila ada; **tanpa nama dan email pelapor** | Unggah foto, lapor selesai |
| TKN-M3 | Notifikasi | Daftar notifikasi web | Tandai dibaca |
| TKN-M4 | Profil | Data diri, vendor asal, keahlian, status | Lihat, keluar |

### 4.3 Mengisi hasil kerja

1. Teknisi membuka Detail SPK dan membaca informasi kerusakan.
2. Teknisi mengunggah **foto sebelum** dan **foto sesudah**, dapat dilakukan bersamaan setelah pekerjaan selesai (keputusan 6).
3. Teknisi dapat menambahkan catatan.
4. Tombol **Lapor selesai** aktif hanya bila kedua foto ada. Hasilnya: status Menunggu Konfirmasi dan notifikasi ke Manager.

**Perbaikan ulang.** Bila Manager menyatakan belum sesuai, SPK kembali ke teknisi yang sama dengan catatan, status Dikerjakan. Teknisi mengunggah foto sesudah yang baru lalu melapor selesai lagi. Foto sebelum tetap dipakai, kecuali teknisi menggantinya.

### 4.4 User story

| ID | Sebagai Teknisi, saya ingin… | Agar… |
| --- | --- | --- |
| TKN-01 | login dengan email dan OTP | tidak perlu akun Google |
| TKN-02 | melihat SPK yang ditugaskan kepada saya beserta foto dan deskripsi kerusakan | tahu apa yang harus diperbaiki dan di mana |
| TKN-03 | mengunggah foto sebelum dan sesudah dari ponsel | hasil kerja terdokumentasi |
| TKN-04 | melapor selesai setelah kedua foto ada | Manager bisa mengecek hasil |
| TKN-05 | melihat catatan perbaikan ulang dari Manager | tahu apa yang belum sesuai |
| TKN-06 | menerima notifikasi saat ditunjuk atau diminta perbaikan ulang | tidak ketinggalan tugas |
| TKN-07 | tidak perlu melihat data pelapor | privasi warga terjaga |

### 4.5 Aturan bisnis

1. Teknisi hanya melihat SPK yang ditugaskan kepadanya.
2. Teknisi tidak melihat nama atau email pelapor; teknisi boleh melihat foto dan deskripsi kerusakan.
3. Foto sebelum dan sesudah wajib sebelum Lapor selesai.
4. Teknisi hanya dapat mengubah status lewat aksi Lapor selesai.
5. Teknisi tidak bisa mengakses menu, data, atau laporan di luar SPK-nya.
6. Akun teknisi baru tidak bisa login sebelum disetujui Admin.
7. Seluruh unggahan dan perubahan tercatat di riwayat.

### 4.6 Kriteria penerimaan

- Teknisi tidak dapat membuka SPK yang bukan miliknya, termasuk lewat tautan langsung.
- Teknisi hanya dapat membuka dan mengunduh file surat perintah kerja dari SPK yang ditugaskan kepadanya.
- Respons tidak memuat nama, email, atau data akun pelapor.
- Lapor selesai tanpa salah satu foto ditolak oleh sistem.
- Setelah Lapor selesai: status Menunggu Konfirmasi, riwayat tertulis, notifikasi ke Manager.
- Pada perbaikan ulang, catatan Manager tampil di bagian atas Detail SPK.

---

## 5. Siklus akun teknisi

### 5.1 Status akun

| Status | Arti | Bisa login | Muncul di pilihan Tunjuk Teknisi |
| --- | --- | --- | --- |
| Menunggu persetujuan | Didaftarkan PIC, belum disetujui Admin | Tidak | Tidak |
| Aktif | Disetujui dan bekerja | Ya | Ya |
| Cuti | Ditandai PIC, sementara | Ya | Tidak |
| Nonaktif | Dinonaktifkan sistem, PIC, atau Admin | Tidak | Tidak |

### 5.2 Penonaktifan

| Jalur | Siapa | Kapan |
| --- | --- | --- |
| Otomatis | Sistem | Tidak login atau tidak mendapat tugas 60 hari |
| Manual | PIC Vendor | Teknisi resign, pindah, atau tidak lagi dipakai |
| Manual | Admin | Pelanggaran atau permintaan vendor |

Aturan penonaktifan otomatis:

- Status **cuti tidak dihitung** dalam 60 hari.
- Sistem **tidak menonaktifkan** teknisi yang masih memegang SPK aktif. Penonaktifan dijalankan setelah SPK itu selesai, bila kondisi 60 hari masih terpenuhi.
- Sebelum nonaktif otomatis, PIC menerima pemberitahuan di web agar sempat menindaklanjuti.

### 5.3 Mengaktifkan kembali

| Penyebab nonaktif | Siapa yang mengaktifkan |
| --- | --- |
| Otomatis (60 hari) | PIC mengajukan, **Admin menyetujui ulang** |
| Manual oleh PIC | PIC mengaktifkan sendiri tanpa persetujuan ulang |
| Oleh Admin | Hanya Admin |

### 5.4 Konfirmasi tiga bulanan

Tiap 3 bulan, sistem meminta PIC mengonfirmasi bahwa daftar teknisinya masih benar. Bila belum dikonfirmasi, pengingat muncul berulang di Beranda tanpa membatasi akses.

---

## 6. Hak akses

| Fitur | PIC Vendor | Teknisi |
| --- | --- | --- |
| Melihat laporan | SPK vendornya | SPK sendiri |
| Menunjuk teknisi | Ya | – |
| Mengganti teknisi saat SPK berjalan | Ya | – |
| Mengisi hasil kerja | – | Ya |
| Data vendor | Lihat (miliknya) | – |
| Data teknisi | Kelola (miliknya) | Profil sendiri |
| Menyetujui teknisi | – | – |
| Nama dan email pelapor | Tidak | Tidak |
| Foto dan deskripsi kerusakan | Ya | Ya |
| Penanda garansi | Ya (informasi) | Ya (informasi) |
| Mengunggah file surat perintah kerja | – (hanya Manager) | – (hanya Manager) |
| Melihat dan mengunduh file surat perintah kerja | Ya (SPK vendornya) | Ya (SPK sendiri) |

---

## 7. Notifikasi

### 7.1 Notifikasi web

| Penerima | Pemicu |
| --- | --- |
| PIC Vendor | SPK baru diterima; permintaan konfirmasi daftar teknisi tiap 3 bulan; peringatan teknisi akan dinonaktifkan otomatis; teknisi disetujui atau ditolak Admin |
| Teknisi | Ditunjuk untuk SPK; diminta perbaikan ulang oleh Manager; akun disetujui Admin |
| Manager | Teknisi melapor selesai |
| Admin | Teknisi baru menunggu persetujuan; pengajuan aktif kembali teknisi |

### 7.2 Email

- Pelapor menerima email "sedang ditangani" saat PIC menunjuk teknisi (status Dikerjakan).
- PIC menerima email undangan aktivasi akun dari Admin.
- Teknisi menerima kode OTP lewat email saat login.

Tidak ada email ke pelapor saat Manager menyatakan belum sesuai atau saat teknisi diganti.

---

## 8. Data

| Entitas | Diisi oleh | Catatan |
| --- | --- | --- |
| Vendor | Admin | Nama, jenis (internal/eksternal), bidang keahlian, PIC, area layanan, skema kerja sama, masa kontrak, masa garansi, alamat, NPWP |
| Teknisi | PIC Vendor; persetujuan Admin | Nama lengkap, WA, email, foto wajah, vendor asal, keahlian, status (menunggu persetujuan / aktif / cuti / nonaktif), penyebab nonaktif, login terakhir, tanggal tugas terakhir, tanggal konfirmasi terakhir |
| SPK | Manager, PIC Vendor, Teknisi | Nomor SPK, laporan terkait, vendor, teknisi, tanggal tugas, **file surat perintah kerja (nama file, jenis, ukuran, waktu unggah, pengunggah)**, foto sebelum, foto sesudah, catatan perbaikan ulang, tanggal selesai |
| Rapor vendor | Sistem | Dihitung otomatis dari SPK: jumlah pekerjaan, rata-rata lama pengerjaan, jumlah perbaikan ulang, pekerjaan rusak lagi dalam garansi |
| Riwayat perubahan | Sistem | Penunjukan, penggantian teknisi, perubahan data teknisi, unggahan foto |

---

## 9. Kebutuhan non-fungsional

- **Mobile-first untuk Teknisi:** unggah foto dari kamera ponsel harus ringan dan tahan koneksi lemah.
- **Kompresi foto** di sisi klien sebelum unggah, dan percobaan ulang bila gagal.
- **Otorisasi di lapisan servis:** pembatasan SPK per teknisi dan per vendor diperiksa di server, bukan hanya disembunyikan di UI.
- **Privasi:** respons untuk Teknisi dan PIC tidak mengandung identitas pelapor.
- **File surat perintah kerja:** validasi jenis dan ukuran file di server, penyimpanan privat dengan tautan unduh bertanda waktu, dan pemindaian virus bila tersedia.
- **Penjadwal:** job harian untuk penonaktifan 60 hari, pengingat sebelum nonaktif, dan permintaan konfirmasi tiap 3 bulan.
- **Auditabilitas:** semua penunjukan dan perubahan tercatat; riwayat tidak bisa diubah atau dihapus.
- **Konkurensi:** penunjukan teknisi memeriksa status SPK terbaru agar tidak terjadi dua penunjukan bersamaan.

---

## 10. Pemetaan ke fase pengembangan

| Fase | Cakupan | Hasil yang bisa diuji |
| --- | --- | --- |
| Onboarding vendor | Akun PIC (undangan dan aktivasi), PIC-M4, M4a, M5; persetujuan Admin; login Teknisi (email + OTP) | PIC mendaftarkan teknisi, Admin menyetujui, teknisi bisa login |
| Pengerjaan | PIC-M1, M2, M2a, M3; TKN-M1, M2, M2a | SPK sampai ke PIC, teknisi ditunjuk, teknisi mengunggah foto dan lapor selesai |
| Perbaikan ulang | Catatan dari Manager, SPK kembali ke teknisi | Alur Belum sesuai sampai Selesai |
| Siklus akun | Nonaktif otomatis, aktif kembali, konfirmasi 3 bulanan, cuti | Penjadwal berjalan dan notifikasi terkirim |
| Notifikasi | PIC-M6, TKN-M3, penanda tugas baru | Penanda jumlah tugas dan halaman awal berisi tugas belum ditangani |

---

## 11. Pertanyaan terbuka

1. **Rapor vendor untuk PIC:** apakah PIC boleh melihat rapor vendornya sendiri? Di PRD hanya Manager, Admin, dan Owner yang menyebut rapor.
2. **Teknisi cuti saat memegang SPK aktif:** apakah PIC wajib mengganti teknisi dulu sebelum menandai cuti, atau SPK tetap berjalan menunggu teknisi kembali?
3. **Masa berlaku undangan PIC:** berapa lama tautan undangan aktif, dan bagaimana kirim ulang?
4. **Bentuk pemberitahuan sebelum nonaktif otomatis:** berapa hari sebelum batas 60 hari pengingat muncul?
5. **Pengajuan aktif kembali yang ditolak Admin:** apakah PIC boleh mengajukan ulang, dan apakah ada alasan penolakan yang dikirim?
6. **Batas ukuran dan jumlah foto** per SPK (sebelum dan sesudah) untuk menjaga kecepatan unggah dan biaya penyimpanan.
7. **File surat perintah kerja:** apa format yang diterima dan batas ukurannya? **[Usulan]** satu file PDF, maksimal 10 MB, boleh diganti Manager selama teknisi belum ditunjuk, dan setiap penggantian tercatat di riwayat.
8. **Teknisi dengan beberapa vendor:** satu orang bekerja untuk lebih dari satu vendor dengan satu email; didukung atau tidak?
