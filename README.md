# EraApps Cloud

EraApps menyimpan akun, karyawan, absensi, pengaturan, reset password, dan promo di Supabase sehingga perubahan tersedia untuk semua perangkat yang memiliki akses. Foto absensi disimpan privat; media promo hanya dapat dibaca setelah login. GitHub Pages digunakan untuk menyajikan antarmuka statis.

## Menyiapkan Supabase

1. Buat proyek Supabase dan jalankan `supabase/schema.sql` satu kali melalui SQL Editor.
2. Buat user admin di Authentication > Users. Gunakan email berbentuk `username@eraapps.invalid`, tandai email terkonfirmasi, dan tetapkan password admin.
3. Salin UUID user itu dan daftarkan profil admin di SQL Editor:

	```sql
	insert into public.profiles (id, username, full_name, role)
	values ('08185117-6f28-4305-96cc-6af44855947a', 'admin', 'Administrator', 'admin');
	```

	Username yang dipakai di form login harus sama dengan `username` di profil. User awal ini menjadi admin; akun karyawan dibuat dari menu Setting Admin.
4. Di Supabase **Authentication > URL Configuration**, set **Site URL** ke `https://backupsoarea-ctrl.github.io/eraapps-cloud/` dan tambahkan URL itu ke **Redirect URLs** (misalnya `https://backupsoarea-ctrl.github.io/eraapps-cloud/**`). Ini memastikan tautan recovery kembali ke situs, bukan `localhost`.
5. Pasang Supabase CLI, lalu hubungkan folder ini ke proyek dan deploy empat Edge Functions:

	```sh
	supabase login
	supabase link --project-ref PROJECT_REF
	supabase functions deploy admin-create-user
	supabase functions deploy admin-delete-user
	supabase functions deploy password-reset-request
	supabase functions deploy resolve-password-reset
	```

	Jangan pernah memasukkan service-role key ke HTML, file konfigurasi browser, atau GitHub Pages.

## Deploy ke GitHub Pages

1. Push folder ini ke branch `main` pada GitHub.
2. URL dan publishable key sudah ada di `supabase-config.example.js`; workflow menyalinnya ke hasil deploy. Keduanya memang konfigurasi browser publik. Jangan pernah mengganti key itu dengan service-role key.
3. Di Settings > Pages, pilih **GitHub Actions** sebagai sumber deploy. Workflow akan menerbitkan aplikasi setiap kali ada push ke `main`.
4. Buka URL Pages, login sebagai admin, lalu buat akun karyawan. User dapat login dari perangkat mana pun menggunakan username dan password masing-masing.

Untuk menjalankan secara lokal, sajikan folder lewat web server lokal. `supabase-config.js` lokal sudah tersedia dan dikecualikan dari Git; jika key dirotasi, perbarui `supabase-config.example.js` dan file lokal tersebut.

## Data yang sudah tersimpan lokal

Data lama di `localStorage` perangkat tidak dipindahkan otomatis. Sebelum beralih, ekspor backup dari aplikasi lama dan siapkan migrasi data secara terkontrol. Jangan mengimpor sandi user lama sebagai teks biasa; buat ulang akun melalui admin supaya Supabase Auth menyimpan kredensialnya dengan aman.
