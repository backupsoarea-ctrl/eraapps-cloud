# EraApps Cloud

EraApps menyimpan akun, karyawan, absensi, pengaturan, reset password, dan promo di Supabase sehingga perubahan tersedia untuk semua perangkat yang memiliki akses. Foto absensi disimpan privat; media promo hanya dapat dibaca setelah login. GitHub Pages digunakan untuk menyajikan antarmuka statis.

## Menyiapkan Supabase

1. Buat proyek Supabase dan jalankan versi terbaru `supabase/schema.sql` melalui SQL Editor. Schema aman dijalankan ulang jika tabel atau policy sudah dibuat sebagian.
2. Buat user admin di Authentication > Users. Gunakan email berbentuk `username@eraapps.invalid`, tandai email terkonfirmasi, dan tetapkan password admin.
3. Salin UUID user itu dan daftarkan profil admin di SQL Editor:

	```sql
	insert into public.profiles (id, username, full_name, role)
	values ('08185117-6f28-4305-96cc-6af44855947a', 'admin', 'Administrator', 'admin');
	```

	Username yang dipakai di form login harus sama dengan `username` di profil. User awal ini menjadi admin; akun karyawan dibuat dari menu Setting Admin.
4. Schema memisahkan role aplikasi `admin/user` dari tipe organisasi `profiles.user_type` (LOB, TSH, Store Leader, ERO, Promotor). Tabel `staff` yang sudah ada menjadi relasi area/toko melalui `lob`, `tsh`, dan `store_code`; migrasi tidak menghapus atau memindahkan data historis.
5. Form pendaftaran publik memakai Supabase Auth dan trigger `create_profile_after_auth_signup` untuk membuat profil `user` berstatus `pending`. LOB dapat menyetujui TSH dalam LOB-nya; TSH dapat menyetujui Store Leader dalam LOB+TSH-nya; Store Leader dapat menyetujui ERO/Promotor di toko yang sama. Admin dapat menyetujui semua. Tipe akun tidak memberi hak akses sampai status dan scope tervalidasi.
6. RLS menggunakan lingkup `profiles.lob/tsh/store_code`, `staff` dan tabel `staff_access`. LOB dapat membaca staff dan profil dalam LOB untuk monitoring tetapi policy database menolak SELECT/INSERT absensi dan Storage bukti absensi. TSH/Store Leader dapat memantau lingkupnya; akses absensi TSH/Store Leader memakai staff yang berada dalam area/toko sesuai RLS, sedangkan ERO/Promotor terbatas ke `staff_access`.
7. Informasi dan promo lama tetap dianggap global. Konten baru oleh LOB, TSH, atau Store Leader ditandai dengan scope `lob`, `tsh`, atau `store`; RLS membatasi pembacaan dan pengelolaan konten/media pada scope tersebut. Konten global hanya dapat dibuat admin. Tombol unduh Promotor disembunyikan; karena file gambar yang ditampilkan di browser juga dapat disimpan dari browser, ini membatasi fitur unduh resmi, bukan screenshot/salinan teknis.
8. ERO/Promotor mendapatkan akses absensi hanya melalui `staff_access`. Persetujuan Store Leader mengaitkan akun ERO/Promotor ke staff yang cocok di toko jika data staff sudah tersedia. Untuk tautan manual, gunakan contoh berikut:

	```sql
	insert into public.staff_access (user_id, staff_code)
	select p.id, s.code
	from public.profiles p
	join public.staff s on s.code = 'EA006'
	where p.username = 'username-terdaftar'
	on conflict do nothing;
	```

9. Di Supabase **Authentication > URL Configuration**, set **Site URL** ke `https://backupsoarea-ctrl.github.io/eraapps-cloud/` dan tambahkan URL itu ke **Redirect URLs** (misalnya `https://backupsoarea-ctrl.github.io/eraapps-cloud/**`). Ini memastikan tautan recovery kembali ke situs, bukan `localhost`.
10. Pasang Supabase CLI, lalu hubungkan folder ini ke proyek dan deploy Edge Functions:

	```sh
	supabase login
	supabase link --project-ref PROJECT_REF
	supabase functions deploy admin-create-user
	supabase functions deploy approve-account
	supabase functions deploy admin-delete-user
	supabase functions deploy password-reset-request
	supabase functions deploy resolve-password-reset
	supabase functions deploy admin-recover-password
	```

	Jangan pernah memasukkan service-role key ke HTML, file konfigurasi browser, atau GitHub Pages.

	Setelah perubahan kode, deploy ulang `admin-create-user` dan deploy `approve-account`. Jalankan kembali versi terbaru `supabase/schema.sql` sebelum mengaktifkan pendaftaran agar profile, hierarki, approval, RLS, dan Auth trigger tersedia.

11. Siapkan kode pemulihan darurat admin tanpa email. Kode ini acak, hanya berlaku sekali, dan jangan commit atau kirimkan ke siapa pun:

	```sh
	umask 077
	openssl rand -hex 32 > ~/eraapps-admin-recovery-code.txt
	supabase secrets set ADMIN_RECOVERY_TOKEN="$(cat ~/eraapps-admin-recovery-code.txt)" ADMIN_RECOVERY_USER_ID="08185117-6f28-4305-96cc-6af44855947a" --project-ref PROJECT_REF
	```

	Ganti UUID dengan UUID user admin yang benar jika berbeda. Saat terkunci, pilih **Pemulihan Admin tanpa Email**, masukkan isi file kode dan password baru minimal 12 karakter. Setelah berhasil, kode langsung tidak berlaku. Untuk recovery berikutnya, buat kode acak baru dan jalankan `supabase secrets set ADMIN_RECOVERY_TOKEN="$(cat ~/eraapps-admin-recovery-code.txt)" --project-ref PROJECT_REF` lagi.

## Deploy ke GitHub Pages

1. Push folder ini ke branch `main` pada GitHub.
2. URL dan publishable key sudah ada di `supabase-config.example.js`; workflow menyalinnya ke hasil deploy. Keduanya memang konfigurasi browser publik. Jangan pernah mengganti key itu dengan service-role key.
3. Di Settings > Pages, pilih **GitHub Actions** sebagai sumber deploy. Workflow akan menerbitkan aplikasi setiap kali ada push ke `main`.
4. Buka URL Pages dan login. Role admin/user dideteksi dari profil; tidak ada pilihan role manual saat login. Masukkan email atau username. Pendaftar baru dapat memakai tombol **Daftar akun baru** dan mengonfirmasi email jika proyek mewajibkannya.

Untuk menjalankan secara lokal, sajikan folder lewat web server lokal. `supabase-config.js` lokal sudah tersedia dan dikecualikan dari Git; jika key dirotasi, perbarui `supabase-config.example.js` dan file lokal tersebut.

## Data yang sudah tersimpan lokal

Data lama di `localStorage` perangkat tidak dipindahkan otomatis. Sebelum beralih, ekspor backup dari aplikasi lama dan siapkan migrasi data secara terkontrol. Jangan mengimpor sandi user lama sebagai teks biasa; buat ulang akun melalui admin supaya Supabase Auth menyimpan kredensialnya dengan aman.

Folder dan promo lama yang hanya tersimpan di browser juga tidak muncul otomatis di cloud. Buat ulang melalui **Setting Admin > Promo / Informasi**, atau unggah folder lama dengan **Pilih Folder dari PC**. Untuk slideshow user, publikasikan gambar ke folder `Highlight`.
