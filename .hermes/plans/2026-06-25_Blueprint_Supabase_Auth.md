---
date: 2026-06-25
tags: [auth, supabase, next-steps, react, blueprint]
status: draft
---

# Blueprint Integrasi Supabase Auth — Lyra Chat

## Konteks

Deni Arya ingin menambahkan sistem autentikasi pengguna ([[User Auth]]) ke aplikasi [[Lyra Chat]] yang saat ini sudah live di [[Vercel]] (`lyra-chatai.vercel.app`). Tujuan utamanya adalah agar pengguna bisa mendaftar (Register), masuk (Login), dan menyimpan riwayat percakapan mereka secara aman di cloud berbasis akun masing-masing.

## Keputusan Kunci

1. **Penyedia Layanan Auth:** Menggunakan [[Supabase]] (Backend-as-a-Service berbasis PostgreSQL yang menyediakan Auth gratis hingga 50.000 Monthly Active Users).
2. **Metode Login:** 
   - **Email & Password** (Konvensional)
   - **Google OAuth** (Paling cepat dan disukai pengguna mobile)
3. **Penyimpanan Riwayat:** Riwayat percakapan saat ini tersimpan di `localStorage` browser. Setelah ada Supabase Auth, riwayat percakapan akan dipindahkan ke [[Supabase Database]] (Tabel `conversations` dan `messages`) dan diikat menggunakan `user_id`.

---

## Yang Perlu Disiapkan Deni Arya (Prasyarat)

Sebelum kita bisa mulai menulis kode, ada beberapa hal yang perlu Deni Arya siapkan dari panel Dasbor Supabase:

### 1. Akun & Proyek Supabase
- Masuk ke [supabase.com](https://supabase.com) dan buat proyek baru (Pilih region terdekat, misalnya **Singapore** agar latensi cepat).
- Dapatkan 2 kunci kredensial utama dari menu **Project Settings -> API**:
  - `Project URL` (contoh: `https://xyz...supabase.co`)
  - `anon / public API Key` (Kunci publik yang aman ditaruh di frontend)

### 2. Pengaturan Autentikasi di Dasbor
- Buka menu **Authentication -> Providers**:
  - Aktifkan **Email** provider.
  - (Opsional tapi direkomendasikan) Aktifkan **Google** provider dengan memasukkan Client ID & Secret dari Google Cloud Console.
- Buka menu **Authentication -> URL Configuration**:
  - Set **Site URL** ke `https://lyra-chatai.vercel.app`
  - Set **Redirect URLs** untuk memasukkan `http://localhost:5200/**` (untuk mode dev lokal).

### 3. Skema Database (Tabel Percakapan)
Kita perlu membuat 2 tabel utama di database PostgreSQL Supabase:
- **`conversations`**:
  - `id` (UUID, Primary Key)
  - `user_id` (UUID, Foreign Key ke `auth.users`)
  - `title` (Text)
  - `created_at` (Timestamp)
- **`messages`**:
  - `id` (UUID, Primary Key)
  - `conversation_id` (UUID, Foreign Key ke `conversations`)
  - `role` (Text: 'user' | 'assistant' | 'system')
  - `content` (Text)
  - `created_at` (Timestamp)
- Mengaktifkan [[Row Level Security]] (RLS) agar pengguna A tidak bisa mengintip riwayat obrolan milik pengguna B.

---

## Roadmap Implementasi (Langkah Kerja AI Selanjutnya)

Setelah prasyarat di atas siap, berikut adalah urutan tahapan yang akan dikerjakan oleh [[Caai]]:

- [ ] **Fase 1 — Instalasi Dependensi**
  - Menginstal `@supabase/supabase-js` di repo Lyra.
  - Membuat file `src/lib/supabase/client.ts` untuk menginisialisasi koneksi.
- [ ] **Fase 2 — Pembuatan Komponen Auth**
  - Membuat halaman/modal **Login** (`LoginForm.tsx`) & **Register** (`RegisterForm.tsx`) dengan desain minimalis ala Gemini (menggunakan Tailwind).
  - Membuat `AuthContext.tsx` untuk menyediakan status login (`user`, `session`, `logout`) ke seluruh aplikasi.
- [ ] **Fase 3 — Proteksi Halaman & UI Integrasi**
  - Mengubah tombol di `TopBar`/`Sidebar` mobile agar menampilkan Tombol Login (jika belum login) atau Avatar User + Tombol Keluar (jika sudah login).
- [ ] **Fase 4 — Migrasi Riwayat Obrolan ke Database**
  - Mengubah logika `useChat.ts` dan `AppShell.tsx`:
    - Saat user login, ambil daftar percakapan dari Supabase DB, bukan dari `localStorage`.
    - Saat mengirim pesan baru, simpan juga ke Supabase DB secara latar belakang (*asynchronous*).
- [ ] **Fase 5 — Uji Coba & Deploy Vercel**
  - Menambahkan *Environment Variables* (`VITE_SUPABASE_URL` dan `VITE_SUPABASE_ANON_KEY`) ke panel pengaturan Vercel.
  - Push kode baru ke GitHub & pengujian live di HP.

---

## Risiko & Trade-off

1. **Latensi Penyimpanan:** Menyimpan pesan ke cloud (DB) butuh waktu sekian milidetik dibanding `localStorage`. Kita harus menerapkan *Optimistic UI Updates* (menampilkan pesan di layar langsung sebelum balasan simpan DB sukses) agar chat terasa instan.
2. **Keterbatasan RLS:** Jika kebijakan keamanan RLS salah dikonfigurasi, obrolan bisa beresiko diakses publik. Kita harus sangat hati-hati saat menulis skema kebijakan `auth.uid() = user_id`.

## Langkah Selanjutnya

Deni Arya silakan mendaftar/membuat proyek di [supabase.com](https://supabase.com) terlebih dahulu, kemudian kirimkan **Project URL** dan **anon key**-nya ke sini (bisa lewat *environment variable* atau chat). Setelah itu, katakan **"Eksekusi Fase 1"**, dan saya akan langsung mulai mengimplementasikan kodenya!
