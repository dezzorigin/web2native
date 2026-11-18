# Arsitektur — Web2Native v1.1.0

## Gambaran

```
┌─────────────┐      ┌──────────────────────────────┐
│   Browser   │─────►│  Cloudflare Pages            │
│ (React 19)  │      │  web2native.pages.dev        │
└─────────────┘      │                              │
                     │  out/ (static export)        │
                     │   index.html, _next/*,       │
                     │   favicon.svg, 404.html      │
                     │                              │
                     │  out/_worker.js              │
                     │  (Pages Worker)              │
                     └──────┬───────────────────────┘
                            │ /api/build (POST)
                            │ /api/status (GET)
                            ▼
                     ┌──────────────────────┐
                     │ webtonative.com/api/v1│
                     │  build-app-request    │
                     │  check-app-status     │
                     │  demo/download/:id/:os│
                     └──────┬───────────────┘
                            ▼
                     ┌──────────────────────┐
                     │ S3 webtonative-demo-  │
                     │ apps (APK 9,8 MB,    │
                     │ iOS zip)              │
                     └──────────────────────┘
```

## Kenapa static export + Worker (bukan OpenNext)

Repo asli memakai `@opennextjs/cloudflare` — tapi:

1. `npm ci` repo asli **gagal ERESOLVE**: OpenNext 1.20.16 menuntut Next `>=15.5.29 <16 || >=16.4.5`, sementara `package.json` mematok Next `^15.4.9`.
2. Pola yang terbukti di repo P1 #17/#18 adalah: Next.js `output: 'export'` + logika API pindah ke Pages Worker (`_worker.js` → `_worker.bundle` via `cf_pages.py`). Deploy-nya deterministik dan bisa diuji lokal tanpa akun Cloudflare.

`output: 'export'` tidak bisa membawa route handler dinamis — `next build` menolaknya. Maka `app/api/` dihapus dan kedua rute tinggal di `worker/_worker.js`.

## Komponen

### Frontend — `app/page.tsx` (client component)

- `Landing` — SaaS landing (kunjungan pertama).
- `Home` — builder + history. State di localStorage:
  - `w2n-entered` — sudah pernah masuk builder.
  - `web2native_history` — daftar build (id, nama, URL, tanggal, status, URL unduh).
  - `web2native_last_build` — timestamp build terakhir (rate limit 24 jam).
- Polling status: `setInterval` 5 detik sampai `isDone`.

### Worker — `worker/_worker.js`

Satu file, tanpa dependensi (fetch native Workers):

| Rute | Perilaku |
|---|---|
| `POST /api/build` | Validasi (nama wajib, URL ber-skema) → 400. Tanpa `WEBTONATIVE_EMAIL` → 503. Teruskan ke upstream `build-app-request` dengan header tiruan browser (pola `lib/scraper.ts` lama). Upstream menolak (`isSuccess: false`) → 502 + `errorCode`. Sukses → `{ success: true, data: { requestId, … } }`. |
| `GET /api/status?requestId=` | Tanpa requestId → 400. Panggil `check-app-status` (flag ketersediaan saja) + HEAD ke kedua URL download. 3xx = platform DONE. Kembalikan `{ success: true, data: { …flag, android_status, ios_status, android_url, ios_url, isDone } }`. |
| Lainnya | `env.ASSETS.fetch(request)` — sajikan static export. `/api/*` tak dikenal → 404 JSON. |

Timeout upstream 30 detik (`AbortSignal.timeout`) — upstream kadang tidak menjawab; worker gagal cepat (502) daripada menggantung UI.

### Env var

| Nama | Wajib | Keterangan |
|---|---|---|
| `WEBTONATIVE_EMAIL` | Ya (untuk build) | Email identitas build di webtonative.com. Di-set sebagai env var Pages (production), tidak ada di repo. |

## Alur build (sequence)

1. Pengguna isi App Name + Website URL → submit.
2. Frontend `POST /api/build` → worker validasi → upstream `build-app-request` → `requestId`.
3. Frontend simpan history (PROCESSING) + `lastBuildTime`, lalu polling `GET /api/status?requestId=` tiap 5 detik.
4. Worker tiap poll: `check-app-status` + HEAD download Android & iOS.
5. Kedua download 3xx → `isDone: true`, `android_url`/`ios_url` terisi → frontend tampilkan tombol unduh.
6. Pengguna unduh APK/IPA langsung dari webtonative.com (redirect 302 ke S3).

## File & folder

```
app/                  layout.tsx, page.tsx (landing + builder), globals.css
worker/               _worker.js, _worker.test.mjs
scripts/              serve-worker.mjs (server lokal peniru Pages)
                      smoke.mjs (smoke test output statis)
public/               favicon.svg
docs/                 architecture.md, api.md, deployment.md, diagram.svg
.github/workflows/   ci.yml
```

## Keputusan yang sengaja diambil

- **Tidak memakai OpenNext** — alasan di atas; dependensi + config-nya dihapus.
- **Worker ditulis tangan, bukan generate OpenNext** — satu file 7 KB, mudah dibaca/diuji (`node --test`, upstream di-mock).
- **Rate limit tetap client-side** — sesuai desain asli; didokumentasikan sebagai bukan kontrol keamanan.
- **Tidak ada database** — riwayat sepenuhnya di localStorage perangkat pengguna.
