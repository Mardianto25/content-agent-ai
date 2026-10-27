# Content Agent Studio

Studio lokal untuk menyusun naskah dengan Gemini, membuat visual per adegan, merender video vertikal MP4, lalu mengirim video ke TikTok Inbox agar bisa ditinjau sebelum dipublikasikan.

## Menjalankan

1. Gunakan Node.js 20.12 atau lebih baru.
2. Jalankan `npm install`.
3. Salin `.env.example` menjadi `.env`, lalu isi `GEMINI_API_KEY` dari Google AI Studio.
4. Jalankan `npm start` dan buka `http://localhost:3000`.

Jika PowerShell memblokir `npm.ps1`, jalankan `npm.cmd install` dan `npm.cmd start`.

## TikTok

Buat aplikasi di TikTok for Developers, aktifkan Content Posting API, dan selesaikan proses persetujuan aplikasi. Dapatkan OAuth access token dengan scope `video.upload`, lalu isi `TIKTOK_ACCESS_TOKEN` di `.env`. Tombol **Kirim ke Draft TikTok** memakai endpoint upload Inbox; pengguna tetap perlu membuka TikTok untuk meninjau dan menerbitkan videonya. Token harus masih berlaku dan dapat dicabut kapan saja.

## Catatan pipeline

- Gemini membuat judul, caption, tiga adegan, dan tiga gambar.
- FFmpeg merakit gambar menjadi video MP4 vertikal 1080 x 1920 berdurasi 15 detik dengan teks overlay.
- Naskah narasi ditampilkan untuk ditinjau, tetapi audio/voice-over belum dibuat.
- Gambar AI dan video tersimpan lokal di folder `generated/`.