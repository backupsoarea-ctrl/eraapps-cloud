# EraApps Cloud

EraApps menyimpan akun, karyawan, absensi, pengaturan, reset password, dan promo di Supabase sehingga perubahan tersedia untuk semua perangkat yang memiliki akses. Foto absensi disimpan privat; media promo hanya dapat dibaca setelah login. GitHub Pages digunakan untuk menyajikan antarmuka statis.

## Menyiapkan Supabase

1. Buat proyek Supabase dan jalankan versi terbaru `supabase/schema.sql` melalui SQL Editor. Schema aman dijalankan ulang jika tabel atau policy sudah dibuat sebagian.
2. Buat user admin di Authentication > Users dengan alamat email yang dapat menerima pesan, tandai email terkonfirmasi, dan tetapkan password admin.
3. Salin UUID user itu dan daftarkan profil admin di SQL Editor:

	```sql
	insert into public.profiles (id, username, full_name, role)
	values ('08185117-6f28-4305-96cc-6af44855947a', 'admin', 'Administrator', 'admin');
	```

	Username yang dipakai di form login harus sama dengan `username` di profil. User awal ini menjadi admin; akun pengguna dibuat admin dari menu **Akun & Pendaftaran**.
4. Schema memisahkan role aplikasi `admin/user` dari tipe organisasi `profiles.user_type` (LOB, TSH, Store Leader, ERO, Promotor). Tabel `staff` yang sudah ada menjadi relasi area/toko melalui `lob`, `tsh`, dan `store_code`; migrasi hanya menambahkan `staff.nik` dan indeks unik, serta tidak mengganti `staff.code` atau memindahkan data absensi historis. Isi NIK setiap karyawan pada **Data Karyawan** sebelum mencetak barcode baru. Scanner menerima NIK dan kode lama selama transisi. Verifikasi kelengkapan sebelum mengganti seluruh label barcode:

	```sql
	select count(*) as staff_without_nik
	from public.staff
	where nik = '';

	select nik, count(*) as duplicates
	from public.staff
	where nik <> ''
	group by nik
	having count(*) > 1;
	```

	`staff_without_nik` harus `0` dan query duplikat harus kosong. Indeks unik database juga menolak NIK ganda saat pemetaan.
5. Pendaftaran akun tersedia untuk Admin pada **Akun & Pendaftaran** dan untuk Store Leader melalui menu **Pendaftaran ERO/Promotor**. Store Leader hanya dapat mendaftarkan akun pada toko, TSH, LOB, dan BU dari profilnya; akun baru berstatus pending sampai disetujui Store Leader tersebut. Form ERO/Promotor meminta NIK karyawan bebas format, nama lengkap, email, kode/nama toko, Store Leader, TSH, LOB, BU, username, dan password; NIK serta nama otomatis menjadi record staf. Username bebas format. BU (Badan Usaha) disimpan pada `profiles.organization` dan berbeda dari LOB. Template Excel memiliki dua sheet, **Akun Login** dan **Pendaftaran Karyawan**, dipasangkan melalui username; sheet Akun Login memuat scope semua role, sedangkan Pendaftaran Karyawan hanya untuk ERO/Promotor. Baris contoh `CONTOH_JANGAN_UPLOAD` otomatis dilewati. Email pendaftaran hanya diperiksa formatnya, tidak diverifikasi apakah aktif/dapat menerima pesan. Akun yang dibuat Admin langsung aktif dan harus mengganti password awal saat login pertama; akun ERO/Promotor dari Store Leader menunggu approval. Akun lama tidak otomatis diubah. Trigger Auth tetap membatasi akun yang dibuat lewat Supabase Auth menjadi `user` berstatus `pending`; pengguna tersebut tidak dapat masuk sebelum disetujui sesuai hierarki.
6. RLS menggunakan lingkup `profiles.lob/tsh/store_code`, `staff` dan tabel `staff_access`. LOB dapat membaca staff dan profil dalam LOB untuk monitoring tetapi policy database menolak SELECT/INSERT absensi dan Storage bukti absensi. TSH/Store Leader dapat memantau lingkupnya; akses absensi TSH/Store Leader memakai staff yang berada dalam area/toko sesuai RLS, sedangkan ERO/Promotor terbatas ke `staff_access`.
7. Informasi dan promo lama tetap dianggap global. Konten baru yang diterbitkan LOB memakai scope `lob`; RLS membatasi pembacaan dan pengelolaan pada lingkup tersebut. Hanya admin yang dapat mengunduh Highlight; tombol unduh Promotor disembunyikan. Karena gambar yang ditampilkan di browser juga dapat disimpan dari browser, ini membatasi fitur unduh resmi, bukan screenshot/salinan teknis.
8. **Menu tambahan** dikelola Admin pada halaman **Menu tambahan**. Admin dapat membuat folder/submenu, tautan HTTPS/HTTP, gambar, video, PDF, Word, Excel, atau PowerPoint, lalu memilih role yang dapat melihatnya. Tabel `admin_content` dan bucket privat `admin-content` memakai RLS; batas unggahan bucket diberlakukan di server sebesar 5 MB. Isian draft dan file sementara disimpan lokal pada browser yang sedang digunakan dan dapat dilanjutkan setelah refresh di perangkat itu.
9. ERO/Promotor mendapatkan akses absensi melalui `staff_access`; pendaftaran baru otomatis menautkan record staf berdasarkan NIK. Untuk akun lama yang belum tertaut, gunakan contoh berikut:

	```sql
	insert into public.staff_access (user_id, staff_code)
	select p.id, s.code
	from public.profiles p
	join public.staff s on s.code = 'EA006'
	where p.username = 'username-terdaftar'
	on conflict do nothing;
	```

10. Di Supabase **Authentication > URL Configuration**, set **Site URL** ke `https://backupsoarea-ctrl.github.io/eraapps-cloud/` dan tambahkan URL itu ke **Redirect URLs** (misalnya `https://backupsoarea-ctrl.github.io/eraapps-cloud/**`). Ini memastikan tautan recovery kembali ke situs, bukan `localhost`. Pastikan layanan email Supabase aktif dan akun admin memakai alamat email yang dapat menerima email.
11. Pasang Supabase CLI, lalu hubungkan folder ini ke proyek dan deploy Edge Functions:

	```sh
	supabase login
	supabase link --project-ref PROJECT_REF
	supabase functions deploy admin-create-user
	supabase functions deploy username-login
	supabase functions deploy approve-account
	supabase functions deploy admin-delete-user
	supabase functions deploy password-reset-request
	supabase functions deploy password-reset-complete
	supabase functions deploy resolve-password-reset
	supabase functions deploy admin-recover-password
	```

	Jangan pernah memasukkan service-role key ke HTML, file konfigurasi browser, atau GitHub Pages.

	Setelah perubahan kode, deploy ulang function yang berubah. Jalankan versi terbaru `supabase/schema.sql` sebelum mengaktifkan fitur yang memerlukan perubahan skema.

12. Pemulihan password dilakukan melalui **Lupa password?** pada halaman login. Masukkan email, nama lengkap, dan NIK yang sesuai dengan profil; akun admin dapat memulai pemulihan dengan email. Setelah tautan satu kali diklik, pengguna menetapkan password baru di EraApps dan akun non-admin kembali menunggu persetujuan. Akun lama yang alamat Auth-nya masih `@eraapps.invalid` tidak dapat menerima pesan reset; perbarui alamat akun lama secara terpisah sebelum meminta reset. Pemulihan admin darurat tidak ditampilkan di halaman login.

## Deploy ke GitHub Pages

1. Push folder ini ke branch `main` pada GitHub.
2. URL dan publishable key sudah ada di `supabase-config.example.js`; workflow menyalinnya ke hasil deploy. Keduanya memang konfigurasi browser publik. Jangan pernah mengganti key itu dengan service-role key.
3. Di Settings > Pages, pilih **GitHub Actions** sebagai sumber deploy. Workflow akan menerbitkan aplikasi setiap kali ada push ke `main`.
4. Buka URL Pages dan login. Role admin/user dideteksi dari profil; tidak ada pilihan role manual saat login. Masukkan email atau username. Admin membuat akun dari menu **Akun & Pendaftaran**; menu tersebut hanya tersedia setelah admin login.

Untuk menjalankan secara lokal, sajikan folder lewat web server lokal. `supabase-config.js` lokal sudah tersedia dan dikecualikan dari Git; jika key dirotasi, perbarui `supabase-config.example.js` dan file lokal tersebut.

## Data yang sudah tersimpan lokal

Data lama di `localStorage` perangkat tidak dipindahkan otomatis. Sebelum beralih, ekspor backup dari aplikasi lama dan siapkan migrasi data secara terkontrol. Jangan mengimpor sandi user lama sebagai teks biasa; buat ulang akun melalui admin supaya Supabase Auth menyimpan kredensialnya dengan aman.

Folder dan promo lama yang hanya tersimpan di browser juga tidak muncul otomatis di cloud. Buat ulang melalui **Setting Admin > Promo / Informasi**, atau unggah folder lama dengan **Pilih Folder dari PC**. Untuk slideshow user, publikasikan gambar ke folder `Highlight`.
