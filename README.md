# Kualitatif Coffee

Situs statis (HTML, CSS, JavaScript biasa) untuk melihat menu, menyusun pesanan, dan mengirimnya lewat WhatsApp. Tidak perlu server atau proses build.

## Sebelum dipublikasikan

1. **Isi nomor WhatsApp** di `js/config.js` (`whatsappNumber`, format `62812xxxxxxx`). Selama kosong, WhatsApp tetap terbuka, tetapi pengunjung harus memilih tujuan pesan sendiri.
2. **Cek menu dan harga** di `js/products.js`. Harga di sana contoh. Tambah, ubah, atau hapus menu langsung di file itu.
3. **Ganti foto** di folder `img/` dengan foto kedai sendiri (`hero.jpg` 1920×1074, `hero-1000.jpg` 1000 px, `about.jpg` 640×427, `about-1280.jpg` 1280 px). Foto bawaan hanya pengganti sementara dan belum dipastikan lisensinya.
4. Setelah domain diketahui, tambahkan `og:url` dan `og:image` (alamat lengkap, misalnya `https://domainmu.com/img/og.jpg`) di `index.html`.

## Menjalankan

Buka `index.html` di browser, atau jalankan server lokal: `python -m http.server` lalu buka `http://localhost:8000`.

## Publikasi

Unggah seluruh folder ke hosting statis seperti Netlify, Vercel, Cloudflare Pages, atau GitHub Pages.

## Struktur

```
index.html        halaman
css/style.css     tampilan
js/config.js      nomor WhatsApp dan pengaturan
js/products.js    daftar menu dan harga
js/script.js      menu, pencarian, keranjang, pesanan, formulir
img/ fonts/       foto dan font (Fraunces, Figtree; lisensi OFL)
```

## Cara kerja pesanan

Keranjang tersimpan di browser pengunjung (localStorage). Tombol "Pesan lewat WhatsApp" membuka WhatsApp dengan pesan yang sudah terisi. Pesanan baru terkirim setelah pengunjung menekan kirim di WhatsApp.
