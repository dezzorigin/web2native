# PRD — Web2Native v2.0

## 1. Informasi Proyek

| Field | Nilai |
|---|---|
| Nama Proyek | Web2Native |
| Deskripsi | Ubah website jadi aplikasi Android & iOS (APK & IPA demo) lewat API webtonative.com |
| Tech Stack | Next.js 15 (static export), Tailwind CSS v4, Cloudflare Pages + Pages Worker |
| Status | Live — https://web2native.pages.dev |
| Penanggung Jawab | Nabil Aulia Dika (dezzorigin) |
| Live Demo | https://web2native.pages.dev |
| Versi Dokumen | 2.0 (18 Nov 2026) |

## 2. Latar Belakang

Membuat aplikasi native dari nol butuh Android Studio/Xcode, sertifikat, dan waktu build. Web2Native mempersingkat itu: pengguna cukup memberi nama aplikasi + URL website, sisanya dikerjakan layanan webtonative.com yang membungkus situs menjadi paket Android & iOS. Produk ini adalah antarmuka + orkestrasi di atas layanan tersebut — bukan compiler sendiri.

## 3. Tujuan

- Pengguna awam bisa mengubah situs responsifnya menjadi APK & IPA demo tanpa coding.
- Alur jelas: input → build → pantau status → unduh.
- Jujur soal batasan: hasil build adalah demo, bukan rilis toko aplikasi.

## 4. Ruang Lingkup

### In-scope (v1.1.0)

- Landing SaaS (kunjungan pertama) + builder (kunjungan berikut langsung masuk builder).
- Form App Name + Website URL, validasi, normalisasi URL (`example.com` → `https://example.com`).
- `POST /api/build` — mengajukan build ke webtonative.com.
- `GET /api/status?requestId=` — polling tiap 5 detik, status per platform.
- Tombol unduh APK (Android) & IPA (iOS) saat keduanya DONE.
- Riwayat build di localStorage + tampilan history (status, link unduh).
- Rate limit 1 build / 24 jam per perangkat (localStorage, client-side).
- Dokumentasi: README, PRD, CHANGELOG, docs/ (arsitektur, API, deployment, diagram).

### Out-of-scope

- Compile/signing sendiri (tidak ada Android SDK/Xcode di repo ini).
- Akun/pembayaran webtonative.com (paket `WEBTONATIVE_STARTER` demo).
- Upload ke Play Store / App Store.
- Notifikasi email ke pengguna (email build hanya dipakai sebagai identitas di webtonative.com).

## 5. Fitur & Persyaratan Fungsional

| ID | Fitur | Perilaku |
|---|---|---|
| F1 | Landing | Navbar (logo + link Fitur/Cara Kerja + logo GitHub kanan → repo), hero 2 kolom + pratinjau builder, 6 kartu fitur, 3 langkah cara kerja, footer. Kunjungan pertama saja. |
| F2 | Builder | Form App Name + Website URL; tombol Get Web2Native Bundle; status build; tombol unduh saat DONE; tombol Start New Wrap; tombol kembali ke landing; logo GitHub di header. |
| F3 | Build | `POST /api/build` validasi (nama wajib, URL wajib ber-skema); tanpa `WEBTONATIVE_EMAIL` → 503; upstream menolak → 502 + `errorCode` upstream (mis. `WEBSITE_URL_INVALID`). |
| F4 | Status | `GET /api/status` polling 5 detik; DONE diturunkan dari ketersediaan URL download (HEAD → 3xx), BUKAN dari field upstream (upstream tidak pernah mengembalikan `android_status`/`ios_status`). |
| F5 | Riwayat | Tersimpan di `web2native_history` (localStorage); item DONE menyimpan URL unduh; hapus semua pakai konfirmasi. |
| F6 | Rate limit | `web2native_last_build` (localStorage); di bawah 24 jam form terkunci + countdown HH:MM:SS. Client-side saja — bisa di-bypass dengan menghapus localStorage. |

## 6. Persyaratan Non-Fungsional

- **Performa:** static export (HTML + JS chunk), First Load ~152 kB; polling ringan.
- **Keamanan:** `.env` tidak boleh ter-commit (`.env.example` hanya berisi nama var); email build lewat env var Pages, bukan hardcoded di repo; tidak ada secret lain.
- **Ketersediaan:** bergantung pada webtonative.com — kalau upstream down, worker menjawab 502 dengan pesan jelas (bukan hang).
- **Maintainability:** satu sumber logika server (`worker/_worker.js`) + unit test (9 tes, upstream di-mock).

## 7. Arsitektur & Tech Stack

Lihat [docs/architecture.md](docs/architecture.md) dan [docs/diagram.svg](docs/diagram.svg).

- Next.js 15 App Router, `output: 'export'` → `out/`.
- Pages Worker (`worker/_worker.js` → `out/_worker.js`, deploy sebagai `_worker.bundle`) melayani `/api/*` + fallback `env.ASSETS`.
- Upstream: `https://www.webtonative.com/api/v1` (build-app-request, check-app-status, demo/download).
- CI: typecheck + lint + build + unit test worker + advisory-sweep (gate keamanan dependensi produksi, pengganti `npm audit`) + lighthouse (lihat `.github/workflows/ci.yml`).

## 8. Milestone

| Fase | Status |
|---|---|
| Inisialisasi & scaffolding | ✅ (template AI Studio, 2026) |
| Perbaikan bug inti (route /api/build hilang, status tak pernah DONE) | ✅ 18 Nov 2026 |
| Landing SaaS + penyatuan brand | ✅ 18 Nov 2026 |
| Pembersihan dep/file mati + install diperbaiki | ✅ 18 Nov 2026 |
| Deploy live Cloudflare Pages | ✅ 18 Nov 2026 |
| Dokumentasi lengkap + video demo | ✅ 18 Nov 2026 |

## 9. Risiko & Mitigasi

| Risiko | Mitigasi |
|---|---|
| webtonative.com mengubah/mematikan API demo | Worker mengembalikan 502 eksplisit; frontend menampilkan pesan error; tidak ada klaim build "milik sendiri" di UI. |
| Email build bocor / milik orang lain | Email hanya lewat env var `WEBTONATIVE_EMAIL`; repo tidak berisi email siapa pun. |
| Rate limit client-side di-bypass | Diterima sebagai batasan desain (didokumentasikan); bukan kontrol keamanan server. |
| Build demo tidak lolos instalasi di semua perangkat | Dinyatakan di landing + README: hasil adalah demo, bukan rilis toko. |

## 10. Kriteria Keberhasilan

- `npm ci`/`npm install` bersih (sebelumnya gagal ERESOLVE karena OpenNext vs Next).
- `npm run build` menghasilkan static export + worker; CI hijau.
- Play-test headless 20/20: landing → builder → build beneran → DONE → link unduh terverifikasi 302 → history → mobile tanpa overflow, 0 error.
- Live: HTTP 200 + play-test live lolos.

## 11. Lisensi

MIT (LICENSE)
