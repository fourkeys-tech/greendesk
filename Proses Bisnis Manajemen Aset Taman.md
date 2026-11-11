Proses Bisnis Manajemen Aset Taman 

# Proses Bisnis Manajemen Aset Taman 

Nov 1, 2026 · @Fourkeys

## 1. Latar belakang 

Platform web ini memangkas jalan laporan kerusakan fasilitas taman dari warga ke pengelola menjadi satu langkah: scan QR di aset, isi form, kirim. 

**Masalah.** Warga dan pengunjung yang memakai taman di cluster atau komplek sering melihat kerusakan, tetapi tidak tahu harus melapor ke siapa. Prosesnya terasa ribet, sehingga kerusakan dibiarkan atau hanya dikeluhkan di grup percakapan tanpa tindak lanjut. 

**Solusi.** Setiap aset taman diberi QR yang langsung membuka form laporan untuk aset tersebut. Laporan diverifikasi pengelola, diputuskan manager, dikerjakan vendor, dan pelapor mendapat kabar lewat email di setiap tahap sampai perbaikan selesai. 

#### **Target pasar: perumahan, cluster, dan komplek milik swasta.** 

- Pengambil keputusan jelas (developer atau estate management), sehingga adopsi lebih cepat. 

- Ada dana pengelolaan rutin dari iuran warga untuk perawatan fasilitas. 

- Kondisi fasilitas memengaruhi kepuasan warga dan citra developer; laporan yang ditanggapi membangun kepercayaan. 

- Pengadaan di instansi pemerintah cenderung panjang dan birokratis, sehingga kurang cocok sebagai pasar awal. 

## 2. Ruang lingkup 

Sistem hanya menangani pelaporan dan penanganan kerusakan aset taman; perawatan rutin, anggaran, dan biaya tetap dikelola di luar sistem. 

|Termasuk dalam sistem|Di luar sistem|
|---|---|
|Laporan kerusakan lewat QR dan input|Perawatan rutin dan jadwal piket pengelola|
|manual||
|Verifikasi laporan dan penentuan prioritas|Anggaran perawatan dan persetujuan biaya|



Page 1 of 13 

Proses Bisnis Manajemen Aset Taman 

|Termasuk dalam sistem|Di luar sistem|
|---|---|
|Keputusan perbaikan (setuju atau tolak)|Biaya, material, dan kendala teknis vendor|
|Penugasan vendor dan teknisi lewat SPK|Pemilihan vendor dan penandatanganan<br>kontrak|
|Bukti foto sebelum dan sesudah perbaikan|Penanganan darurat (pengelola langsung<br>menghubungi manager)|
|Notifikasi email ke pelapor dan notifikasi di<br>web untuk tim internal|Batas waktu (SLA) per tahap|
|Pengelolaan data wilayah, aset, akun, dan<br>vendor|Notifikasi WhatsApp atau push|



## 3. Struktur wilayah 

Data tersusun dalam lima tingkat, dan setiap role bekerja pada tingkat tertentu. 

|Tingkat|Contoh|Role yang bekerja di tingkat ini|
|---|---|---|
|Perusahaan<br>pengelola|PT A|Admin, Owner/Direksi, Manager<br>(ditautkan ke satu atau beberapa cluster)|
|Komplek /<br>Perumahan|Perumahan B|–|
|Cluster|Cluster Melati|Pengelola|
|Taman|Taman 1|–|
|Aset|Ayunan, bangku, lampu<br>taman|Pengguna melapor per aset|



Vendor bekerja lintas cluster sesuai area layanan yang tercatat di data vendor. 

## 4. Role dan hak akses 

Sistem memiliki tujuh role. Admin dan Manager sejajar di tingkat perusahaan: Admin memegang data dan akses, Manager memegang keputusan perbaikan, dan keduanya tidak saling membawahi. 

Page 2 of 13 

Proses Bisnis Manajemen Aset Taman 

|Role|Cakupan|Tugas utama|Akun dibuat oleh|
|---|---|---|---|
|Pengguna|Semua aset (siapa pun<br>boleh melapor)|Melaporkan kerusakan,<br>memantau status<br>laporannya, membatalkan<br>laporan sebelum<br>diverifikasi|Daftar sendiri<br>(Google atau<br>email)|
|Pengelola|Satu cluster (boleh<br>lebih dari satu orang<br>per cluster)|Memverifikasi laporan,<br>menentukan prioritas,<br>menggabungkan laporan<br>ganda, meneruskan ke<br>manager|Admin|
|Manager|Satu atau beberapa<br>cluster, ditautkan oleh<br>Admin|Menyetujui atau menolak<br>perbaikan, membuat SPK<br>ke vendor, mengonfirmasi<br>hasil perbaikan|Admin|
|PIC Vendor|Perusahaan vendornya|Menerima SPK, menunjuk<br>teknisi, mengelola data<br>teknisi|Admin|
|Teknisi|SPK yang ditugaskan<br>kepadanya|Mengerjakan perbaikan,<br>mengunggah foto sebelum<br>dan sesudah|PIC Vendor, aktif<br>setelah disetujui<br>Admin|
|Admin|Satu perusahaan,<br>semua cluster|Mengelola data wilayah,<br>aset, QR, kategori, akun<br>internal, vendor;<br>menyetujui teknisi|Pemilik platform|
|Owner/Direksi|Satu perusahaan,<br>semua cluster|Memantau ringkasan<br>semua cluster dan riwayat<br>perubahan data|Pemilik platform|



Tim Internal pengelola diperlakukan sebagai satu vendor, dengan supervisor teknisi sebagai PIC-nya. 

Page 3 of 13 

Proses Bisnis Manajemen Aset Taman 

### Matriks hak akses 

|Fitur|Pengguna|Pengelola|Manager|PIC Vendor|Teknisi|Admin|Owner/Direksi|
|---|---|---|---|---|---|---|---|
|Membuat<br>laporan|Ya|–|–|–|–|–|–|
|Melihat<br>laporan|Milik<br>sendiri|Cluster<br>sendiri|Cluster<br>yang<br>ditautkan|SPK<br>vendornya|SPK<br>sendiri|Semua (lihat<br>saja)|Semua (lihat<br>saja)|
|Verifikasi<br>dan prioritas|–|Ya|–|–|–|–|–|
|Setuju atau<br>tolak<br>perbaikan|–|–|Ya|–|–|–|–|
|Membuat<br>SPK|–|–|Ya|–|–|–|–|
|Menunjuk<br>teknisi|–|–|–|Ya|–|–|–|
|Mengisi hasil<br>kerja|–|–|–|–|Ya|–|–|
|Konfirmasi<br>selesai|–|–|Ya|–|–|–|–|
|Data wilayah,<br>aset, QR,<br>kategori|–|Lihat|Lihat|–|–|Kelola|Lihat|
|Data vendor|–|–|Lihat|Lihat<br>(miliknya)|–|Kelola|Lihat|
|Data teknisi|–|–|Lihat|Kelola<br>(miliknya)|Profil<br>sendiri|Setujui /<br>nonaktifkan|Lihat|
|Akun<br>internal|–|–|–|–|–|Kelola|–|
|Blokir akun<br>pengguna|–|–|–|–|–|Ya|–|
|Riwayat<br>perubahan<br>data|–|–|–|–|–|Lihat|Lihat|



Admin tidak dapat memverifikasi laporan, memutuskan perbaikan, menugaskan vendor, mengubah isi laporan, atau menghapus laporan secara permanen. 

Page 4 of 13 

Proses Bisnis Manajemen Aset Taman 

## 5. Alur proses utama 

Setiap laporan melewati tiga keputusan (verifikasi pengelola, keputusan manager, dan pengecekan hasil oleh manager), dan pelapor menerima email di setiap keputusan. 



<!-- Start of picture text -->
Setiap keputusan sampai ke pelapor lewat email<br>Pengguna Pengelola Manager PIC Vendor Teknisi<br>Lapor kerusakan<br>via QR / dashboard<br>tidak<br>Email: tidak valid Valid?<br>ya<br>Email: valid Tetapkan prioritas<br>lalu teruskan<br>tidak<br>Email: ditolak Setujui?<br>ya<br>Perbaiki aset,<br>Buat SPK ke vendor Tunjuk teknisi unggah foto<br>sebelum-sesudah<br>Hasil sesuai? tidak: perbaiki ulang<br>ya<br>Email: selesai oe 4<br>Konfirmasi selesai<br>+ foto hasil<br><!-- End of picture text -->

alur laporan · 5 role, 3 keputusan 

Kotak putus-putus adalah email ke pelapor. Email saat laporan diterima, disetujui, dan dikerjakan, serta pembatalan dan penggabungan laporan, dijelaskan pada langkah berikut. 

Page 5 of 13 

Proses Bisnis Manajemen Aset Taman 

### Langkah rinci 

1. **Pengguna melapor.** Pengguna memindai QR (aset otomatis terisi) atau membuka dashboard (memilih aset manual), lalu mengirim foto dan deskripsi. Sistem mengirim email laporan diterima beserta nomor tiket. Status: Baru. 

2. **Pengguna dapat membatalkan** selama status masih Baru. Status: Dibatalkan. 

3. **Pengelola cluster mereview laporan.** 

   - Tidak sesuai kenyataan: status Tidak Valid, email berisi alasan ke pelapor, alur berakhir. 

   - Sama dengan laporan lain untuk aset yang sama: status Digabung, pelapor mengikuti kabar laporan induk. 

Valid: pengelola menetapkan prioritas dan meneruskan ke manager. Status Menunggu Keputusan, email laporan terverifikasi ke pelapor. 

4. **Manager memutuskan.** 

Tolak: status Ditolak, email berisi alasan ke pelapor, alur berakhir. 

Setuju: manager membuat SPK ke vendor. Status Disetujui, email ke pelapor. 

5. **PIC Vendor menunjuk teknisi.** Status Dikerjakan, email ke pelapor bahwa perbaikan sedang ditangani. 

6. **Teknisi memperbaiki aset** , mengunggah foto sebelum dan sesudah, lalu melaporkan selesai. Status Menunggu Konfirmasi. 

7. **Manager mengecek hasil dari foto.** 

   - Belum sesuai: kembali ke teknisi dengan catatan. Status Dikerjakan. 

   - Sesuai: status Selesai, email ke pelapor beserta foto hasil perbaikan. 

## 6. Status laporan 

Setiap laporan berada di salah satu dari sepuluh status; lima di antaranya adalah status akhir (Dibatalkan, Digabung, Tidak Valid, Ditolak, Selesai). 

|Status|Arti|Diubah oleh|Status berikutnya|
|---|---|---|---|
|Baru|Laporan terkirim,|Pengguna|Dibatalkan, Digabung,|
||menunggu verifikasi|(saat submit)|Tidak Valid, Menunggu|
||||Keputusan|
|Dibatalkan|Pengguna menarik<br>laporannya|Pengguna|Akhir|



Page 6 of 13 

Proses Bisnis Manajemen Aset Taman 

|Status|Arti|Diubah oleh|Status berikutnya|
|---|---|---|---|
|Digabung|Laporan sama dengan<br>laporan lain untuk aset yang<br>sama|Pengelola|Akhir; pelapor ikut<br>menerima kabar dari<br>laporan induk|
|Tidak Valid|Laporan tidak sesuai<br>kenyataan, disertai alasan|Pengelola|Akhir|
|Menunggu<br>Keputusan|Laporan valid, prioritas<br>ditetapkan, diteruskan ke<br>manager|Pengelola|Ditolak, Disetujui|
|Ditolak|Manager tidak melanjutkan<br>perbaikan, disertai alasan|Manager|Akhir|
|Disetujui|SPK dibuat dan dikirim ke<br>vendor, menunggu<br>penunjukan teknisi|Manager|Dikerjakan|
|Dikerjakan|Teknisi ditunjuk dan<br>menangani perbaikan|PIC Vendor|Menunggu Konfirmasi|
|Menunggu<br>Konfirmasi|Teknisi melaporkan selesai<br>dengan foto sesudah|Teknisi|Selesai, Dikerjakan<br>(perbaikan ulang dengan<br>catatan manager)|
|Selesai|Manager mengonfirmasi<br>hasil perbaikan|Manager|Akhir|



## 7. Aturan bisnis 

Aturan berikut berlaku di seluruh alur dan menjadi acuan saat development. 

#### **Pelaporan** 

1. Siapa pun boleh melapor, baik warga maupun pengunjung. 

2. Setiap laporan wajib memiliki minimal satu foto kerusakan dan deskripsi singkat. 

3. Laporan lewat QR otomatis terisi aset dan lokasinya; laporan lewat dashboard mengharuskan pengguna memilih aset secara manual. 

4. Saat QR dipindai, sistem menampilkan laporan aktif untuk aset tersebut, sehingga pengguna tidak perlu melapor ulang. Pengguna tetap boleh melapor bila kerusakannya berbeda. 

Page 7 of 13 

Proses Bisnis Manajemen Aset Taman 

5. Usulan: saat QR dipindai, sistem juga menampilkan penolakan terakhir untuk aset tersebut beserta alasannya (misalnya dalam 30 hari terakhir). 

6. Pengguna hanya boleh membatalkan laporan selama statusnya masih Baru. 

7. Jumlah laporan per akun per hari dibatasi untuk mencegah spam. 

#### **Verifikasi dan keputusan** 

1. Hanya pengelola cluster terkait yang boleh memverifikasi laporan. 

2. Laporan Tidak Valid wajib disertai alasan, dan alasan itu dikirim ke email pelapor. 

3. Prioritas ditentukan pengelola saat meneruskan laporan ke manager; pengguna tidak memilih prioritas. 

4. Laporan untuk aset yang sama dapat digabung pengelola; semua pelapornya menerima kabar dari laporan induk. 

5. Keputusan manager hanya Setuju atau Tolak. Penolakan wajib disertai alasan (misalnya menunggu waktu atau anggaran) dan dikirim ke email pelapor. 

6. Tidak ada batas waktu per tahap. Dashboard hanya menampilkan sudah berapa hari laporan berada di tahap saat ini. 

#### **Pengerjaan** 

1. Manager menugaskan pekerjaan ke vendor lewat SPK; PIC vendor menunjuk teknisinya. 

2. Teknisi hanya dapat melihat SPK yang ditugaskan kepadanya, dan tidak melihat nama maupun email pelapor. 

3. Teknisi wajib mengunggah foto sebelum dan sesudah perbaikan. 

4. Hasil perbaikan dicek manager dari foto; pekerjaan yang bermasalah diaudit melalui data SPK dan rapor vendor. 

5. Setelah manager mengonfirmasi selesai, sistem mengirim email ke pelapor beserta foto hasil perbaikan. 

6. Bila aset yang sama rusak lagi dalam masa garansi vendor, sistem menandai laporan tersebut sebagai masih dalam garansi vendor terkait. 

#### **Data dan akun** 

1. Laporan tidak dapat dihapus permanen, hanya diarsipkan. 

2. Setiap perubahan data master tercatat dalam riwayat perubahan (siapa, apa, kapan). 

3. Akun pengguna yang terbukti menyalahgunakan sistem dapat diblokir Admin. Sistem mencatat jumlah laporan valid dan tidak valid per akun sebagai rekam jejak. 

4. Pengguna wajib menyetujui penggunaan data pribadi saat mendaftar. 

Page 8 of 13 

Proses Bisnis Manajemen Aset Taman 

## 8. Proses pendukung 

Tiga proses menyiapkan alur utama: autentikasi pengguna, pembuatan akun internal, dan onboarding vendor beserta teknisinya. 

### 8.1 Autentikasi pengguna 

#### **Lewat dashboard** 

1. Pengguna login dengan Google, atau daftar dan login dengan email. 

2. Pendaftaran email cukup nama dan email, lalu diverifikasi dengan kode OTP ke email. 

3. Setelah login, pengguna diarahkan ke dashboard: membuat laporan (pilih aset manual) dan melihat riwayat laporannya. 

#### **Lewat QR** 

1. Pengguna memindai QR; form laporan terbuka dengan aset sudah terisi, dan laporan aktif untuk aset itu ditampilkan. 

2. Pengguna mengisi form (foto dan deskripsi) tanpa harus login lebih dulu. 

3. Saat submit, bila sesi login masih aktif, laporan langsung terkirim. 

4. Bila belum login, sistem menyimpan isi form dan foto sebagai draft, lalu menampilkan tiga pilihan: Lanjut dengan Google, Masuk, atau Daftar. 

5. Setelah login atau daftar singkat berhasil, draft dipulihkan dan laporan terkirim otomatis. 

Catatan: sistem tidak menampilkan apakah sebuah email sudah terdaftar, agar daftar akun tidak bisa ditebak orang lain. Sesi login dibuat panjang (misalnya 30 hari) supaya laporan berikutnya tidak perlu login ulang. 

### 8.2 Pembuatan akun internal 

1. Pemilik platform membuat akun Admin dan Owner/Direksi atas permintaan resmi perusahaan klien. 

2. Admin membuat akun Manager dan menautkannya ke satu atau beberapa cluster. 

3. Admin membuat akun Pengelola dan menautkannya ke satu cluster. 

4. Saat manager berhalangan, Admin dapat menunjuk manager pengganti sementara; penunjukan ini tercatat di riwayat perubahan. 

Page 9 of 13 

Proses Bisnis Manajemen Aset Taman 

### 8.3 Onboarding vendor dan teknisi 

1. Manager atau bagian pengadaan memilih vendor dan menandatangani kontrak di luar sistem. 

2. Dokumen vendor diserahkan ke Admin: profil perusahaan, kontrak, dan surat penunjukan PIC. 

3. Admin menginput data vendor dan area layanannya, lalu membuat akun PIC vendor. 

4. PIC menerima email undangan dan mengaktifkan akunnya. 

5. PIC mendaftarkan teknisi: nama lengkap, nomor WA, email, foto wajah, dan keahlian. 

6. Admin menyetujui teknisi; akun teknisi baru aktif setelah disetujui. 

7. Akun teknisi yang tidak login atau tidak mendapat tugas selama 60 hari dinonaktifkan otomatis. 

8. Setiap 3 bulan, sistem meminta PIC mengonfirmasi bahwa daftar teknisinya masih benar. 

## 9. Data per entitas 

Data master diinput Admin dan PIC vendor; data laporan dan SPK terisi bertahap mengikuti alur; rapor vendor dihitung otomatis. 

|Entitas|Data|Diisi oleh|
|---|---|---|
|Perusahaan|Nama perusahaan, kontak|Pemilik platform|
|Komplek|Nama, alamat, perusahaan induk|Admin|
|Cluster|Nama, komplek induk|Admin|
|Taman|Nama, cluster induk, keterangan lokasi|Admin|
|Aset|Kode aset, nama, kategori, taman,<br>keterangan titik lokasi, foto, tanggal<br>pemasangan, status aktif/nonaktif|Admin|
|QR|Tautan pendek ke form laporan aset,<br>kode aset tercetak di bawah QR|Sistem (dari kode aset),<br>dicetak Admin|
|Kategori|Kategori aset, jenis kerusakan|Admin|



Page 10 of 13 

Proses Bisnis Manajemen Aset Taman 

|Entitas|Data|Diisi oleh|
|---|---|---|
|Pengguna|Nama, email, metode login<br>(Google/email), status pelapor opsional<br>(warga dengan blok/no. rumah, atau<br>pengunjung), persetujuan data, rekam<br>jejak laporan valid/tidak valid, status<br>blokir|Pengguna; rekam jejak oleh<br>sistem|
|Akun internal|Nama, email, role, cluster yang<br>ditautkan, status aktif|Admin|
|Vendor|Nama perusahaan, jenis<br>(internal/eksternal), bidang keahlian,<br>PIC (nama, WA, email), area layanan<br>(cluster), skema kerja sama, masa<br>kontrak, masa garansi pekerjaan, alamat,<br>NPWP|Admin|
|Teknisi|Nama lengkap, WA, email, foto wajah,<br>vendor asal, keahlian, status<br>(aktif/cuti/nonaktif), status persetujuan|PIC Vendor; persetujuan oleh<br>Admin|
|Laporan|Nomor tiket, aset, pelapor, saluran<br>(QR/dashboard), foto, deskripsi, status,<br>prioritas, alasan (tidak valid/ditolak),<br>laporan induk (bila digabung), tanggal<br>per perubahan status|Pengguna, Pengelola,<br>Manager|
|SPK|Nomor SPK, laporan terkait, vendor,<br>teknisi, tanggal tugas, foto sebelum, foto<br>sesudah, catatan perbaikan ulang,<br>tanggal selesai|Manager, PIC Vendor, Teknisi|
|Rapor vendor|Jumlah pekerjaan, rata-rata lama<br>pengerjaan, jumlah perbaikan ulang,<br>pekerjaan yang rusak lagi dalam masa<br>garansi|Sistem (otomatis dari SPK)|
|Riwayat<br>perubahan|Pengguna yang mengubah, data yang<br>diubah, nilai lama dan baru, waktu|Sistem|



Usulan: prioritas memakai tiga tingkat (Tinggi, Normal, Rendah) dan berfungsi sebagai urutan antrean di dashboard manager. 

Page 11 of 13 

Proses Bisnis Manajemen Aset Taman 

## 10. Notifikasi 

Pelapor menerima kabar lewat email; tim internal menerima notifikasi di dalam web. Setiap email ke pelapor memuat nomor tiket dan tautan cek status. 

### 10.1 Email ke pelapor 

|Pemicu|Isi email|
|---|---|
|Laporan terkirim|Laporan diterima, nomor tiket, tautan cek status|
|Laporan Tidak Valid|Laporan tidak dilanjutkan, beserta alasan dari<br>pengelola|
|Laporan digabung|Laporan digabung dengan laporan lain untuk aset<br>yang sama; kabar berikutnya mengikuti laporan<br>induk|
|Laporan valid (Menunggu Keputusan)|Laporan terverifikasi dan akan segera<br>ditindaklanjuti|
|Ditolak manager|Perbaikan belum dilanjutkan, beserta alasan dari<br>manager|
|Disetujui|Perbaikan disetujui dan sedang dijadwalkan|
|Dikerjakan|Teknisi sedang menangani perbaikan|
|Selesai|Aset sudah diperbaiki, dilampiri foto hasil<br>perbaikan|
|Laporan dibatalkan|Konfirmasi pembatalan oleh pengguna|



### 10.2 Notifikasi di web 

Menu setiap role menampilkan penanda jumlah tugas baru, dan halaman pertama setelah login langsung menampilkan tugas yang belum ditangani. 

|Penerima|Pemicu|
|---|---|
|Pengelola|Laporan baru masuk di clusternya|
|Manager|Laporan valid diteruskan pengelola; teknisi<br>melaporkan pekerjaan selesai|



Page 12 of 13 

Proses Bisnis Manajemen Aset Taman 

|Penerima|Pemicu|
|---|---|
|PIC Vendor|SPK baru diterima; permintaan konfirmasi daftar<br>teknisi tiap 3 bulan|
|Teknisi|Ditunjuk untuk SPK; diminta perbaikan ulang oleh<br>manager|
|Admin|Teknisi baru menunggu persetujuan|



## 11. Tahap berikutnya 

Tiga topik sengaja ditunda dan dibahas setelah proses bisnis ini disepakati. 

- Desain tampilan (wireframe halaman tiap role) 

- Model bisnis dan harga untuk perusahaan klien 

- Kebijakan privasi sesuai UU Pelindungan Data Pribadi 

Page 13 of 13 

