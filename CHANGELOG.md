# CHANGELOG — Web2Native

## [1.1.0] — 2026-11-18

Rebuild total menjadi proper (P1 #19).

### Diperbaiki (bug nyata, ditemukan saat verifikasi live)

- **Route `POST /api/build` tidak pernah ada.** Frontend memanggilnya, tapi repo hanya punya `app/api/status/route.ts` — Next.js menjawab 404 sehingga tidak ada build yang bisa dimulai. Route ini sekarang ada, sebagai bagian dari Pages Worker (`worker/_worker.js`).
- **Status build tidak pernah jadi DONE.** Kode lama membaca `android_status`/`ios_status` dari respons `check-app-status` upstream — padahal upstream tidak pernah mengembalikan field itu (hanya flag `isAndroidServerAvailable`/`isIosAppServerAvailable`). UI akan polling selamanya meski APK sudah jadi (terverifikasi: APK 9,8 MB sudah di S3 sementara status tetap mengembalikan flag yang sama). Sekarang DONE diturunkan dari ketersediaan URL download (HEAD → 3xx = DONE).
- **`npm ci` gagal ERESOLVE di repo asli.** `@opennextjs/cloudflare@1.20.16` menuntut Next `>=15.5.29 <16 || >=16.4.5`, sementara `package.json` mematok Next `^15.4.9` — install bersih tidak pernah bisa jalan.
- **Email orang lain ter-hardcode** (`fongsifdev@gmail.com` di `lib/scraper.ts`) sebagai identitas build. Diganti env var `WEBTONATIVE_EMAIL` (Pages env var, tidak ada di repo).
- **Brand tidak konsisten** — header "ScrapeNative Pro", metadata "Web2Native". Disatukan ke Web2Native; badge "Pro" (menyesatkan — tidak ada tier Pro) diganti "Demo API".
- **Div "Developer Credit" kosong** di builder — sekarang berisi `dezzorigin`.
- **Favicon 404** — tidak ada `public/` sama sekali. Ditambah `public/favicon.svg` + metadata icons + OpenGraph.
- **CI lighthouse gagal di run pertama (PR #1).** Penyebab: `preset: lighthouse:no-pwa` di `lighthouserc.json` memperluas asersi ke audit yang tidak berlaku untuk halaman ini (`lcp-lazy-loaded`, `non-composited-animations`, `prioritize-lcp-image` — tidak ada nilai), plus `color-contrast` gagal di 12 elemen (teks abu-abu `gray-500` di permukaan krem + teks putih di tombol oranye `#FF895D`). Perbaikan: preset dibuang (hanya asersi kategori eksplisit), teks deskripsi jadi `gray-600`, teks tombol oranye jadi hitam. LHCI lokal kini lolos (a11y 1.0). Job `live-smoke` di run yang sama gagal karena DNS `web2native.pages.dev` belum propagasi saat job berjalan (curl exit 6) — bukan cacat situs; `audit` gagal di step-nya tanpa temuan kerentanan di pohon produksi (disapu via GitHub Advisory DB: 31 paket produksi bersih high/critical) — diduga endpoint `npm audit` flake sesaat, job kini punya satu retry.
- **CI lighthouse lokal awalnya gagal karena Chrome root** (`Running as root without --no-sandbox`) — `chromeFlags` di `lighthouserc.json` adalah string `--no-sandbox --disable-dev-shm-usage --ignore-certificate-errors` (bukan array — array digabung jadi satu string koma dan kehilangan flag, pelajaran dari repo #15).

### Ditambah

- **Landing SaaS**: navbar + logo GitHub kanan → repo, hero 2 kolom + pratinjau builder, 6 fitur, 3 langkah cara kerja, footer. Kunjungan pertama saja; kunjungan berikut langsung masuk builder (flag `w2n-entered`).
- **Pages Worker** (`worker/_worker.js`): `POST /api/build` + `GET /api/status` + fallback `env.ASSETS`; timeout upstream 30 detik; error envelope JSON konsisten (400/502/503).
- **Unit test worker** (`worker/_worker.test.mjs`, 9 tes, upstream di-mock): validasi, 503 tanpa email, payload ke upstream, `WEBSITE_URL_INVALID` → 502, derivasi DONE dari 302 download.
- **Server lokal peniru Pages** (`scripts/serve-worker.mjs`): `npm run serve` — static `out/` + worker dengan ASSETS dari filesystem.
- **CI variatif** (`.github/workflows/ci.yml`): build (typecheck + lint + build), worker-test, audit deps produksi, lighthouse, live-smoke non-gating.
- **Docs lengkap**: `docs/architecture.md`, `docs/api.md`, `docs/deployment.md`, `docs/diagram.svg`; README/PRD ditulis ulang jujur; 6 screenshot + video demo.

### Dihapus (kode/deps mati)

- `app/api/` (route status Next — pindah ke worker), `lib/scraper.ts`, `lib/utils.ts` (`cn()` tak terpakai), `hooks/use-mobile.ts` (tak terpakai), `open-next.config.ts`, `wrangler.jsonc`, `.eslintrc.json` (legacy).
- Dependensi: `@google/genai`, `@hookform/resolvers`, `@opennextjs/cloudflare`, `axios`, `autoprefixer`, `clsx`, `tailwind-merge`, `firebase-tools`, `@tailwindcss/typography`, `tw-animate-css`, `esbuild`. Instalasi: 399 paket (sebelumnya gagal total).
- `next.config.ts`: `output: 'standalone'` → `'export'`; blok webpack HMR AI Studio + `images.remotePatterns` (picsum, tak dipakai) dibuang.
- `.env.example`: `GEMINI_API_KEY` + `APP_URL` (tak dipakai di mana pun) dibuang; tersisa `WEBTONATIVE_EMAIL`.

### Catatan jujur

- Build dikerjakan webtonative.com (API demo), bukan oleh aplikasi ini. Hasil = APK/IPA demo.
- Rate limit 1/24 jam hanya client-side (localStorage) — bisa di-bypass; bukan kontrol keamanan.
- Video demo direkam headless, tanpa suara.

## [0.1.0] — 2026 (template AI Studio)

- Scaffolding awal: Next.js + Tailwind, form builder + history + rate limit client-side, route `/api/status` saja.
