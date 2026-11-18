# API — Web2Native v1.1.0

Dokumen ini menjelaskan dua hal: (a) API yang diekspos aplikasi ini
(`/api/*`, dilayani Pages Worker), dan (b) API upstream webtonative.com
yang dipakai di baliknya. Semua perilaku di bawah diverifikasi live
18 Nov 2026 (bukan dari dokumentasi — webtonative.com tidak memublikasikan
dokumen API ini).

## A. API aplikasi (Pages Worker)

Base: `https://web2native.pages.dev` (lokal: `http://127.0.0.1:8329/`).

### POST /api/build

Mengajukan satu build baru.

Request (JSON):

```json
{ "appName": "My Premium App", "websiteUrl": "https://example.com" }
```

- `appName` — string tak kosong, wajib.
- `websiteUrl` — wajib diawali `http://` atau `https://` (frontend menambahkan `https://` bila pengguna mengetik tanpa skema).

Respons sukses (200):

```json
{
  "success": true,
  "data": {
    "isSuccess": true,
    "requestId": "6afd75354f554b72d8177ccd",
    "isServerAvailable": true
  }
}
```

Error:

| Status | Arti |
|---|---|
| 400 | Body bukan JSON / `appName` kosong / URL tanpa skema. |
| 502 | webtonative.com menolak build — `error` berisi `errorCode` upstream, mis. `WEBSITE_URL_INVALID` (URL tidak lolos validator upstream, mis. `example.com`). |
| 503 | `WEBTONATIVE_EMAIL` belum diset di server. |

### GET /api/status?requestId=…

Memeriksa progres satu build.

Respons sukses (200):

```json
{
  "success": true,
  "data": {
    "isAndroidServerAvailable": true,
    "isIosAppServerAvailable": true,
    "isMacAppServerAvailable": false,
    "android_status": "DONE",
    "ios_status": "PROCESSING",
    "android_url": null,
    "ios_url": null,
    "isDone": false
  }
}
```

- `android_status` / `ios_status`: `"DONE"` atau `"PROCESSING"`.
- `android_url` / `ios_url`: URL download webtonative (`…/demo/download/<id>/ANDROID|IOS`) — hanya terisi saat `isDone` true.
- `isDone`: true hanya bila **kedua** platform DONE.

Error: 400 (tanpa `requestId`), 502 (upstream tidak menjawab / timeout 30 dtk).

## B. API upstream webtonative.com

Base: `https://www.webtonative.com/api/v1`. Dipanggil worker dengan header
tiruan browser (origin/referer `https://www.webtonative.com/`,
`sec-ch-ua`, user-agent Chrome Android). Tanpa header ini upstream
menolak/mengabaikan.

### POST /build-app-request

Body (JSON):

```json
{
  "appName": "My Premium App",
  "emailId": "owner@example.com",
  "packageId": "WEBTONATIVE_STARTER",
  "websiteUrl": "https://example.com",
  "referralCode": "",
  "utmInfo": { "utm_source": "", "utm_medium": "", "utm_campaign": "", "utm_term": "", "utm_content": "" },
  "device_type": "website",
  "browser": "chrome"
}
```

Respons (HTTP 201 — sukses maupun gagal validasi):

```json
{ "isSuccess": true, "requestId": "6afd75354f554b72d8177ccd", "isServerAvailable": true }
```

atau:

```json
{ "isSuccess": false, "errorCode": "WEBSITE_URL_INVALID" }
```

### GET /check-app-status?requestId=…

Respons (HTTP 200, selalu bentuk ini — **tidak ada field status build**):

```json
{
  "isAndroidServerAvailable": true,
  "isIosAppServerAvailable": true,
  "isMacAppServerAvailable": false
}
```

Inilah alasan status lama tidak pernah DONE: kode lama menunggu field
`android_status`/`ios_status` yang tidak pernah ada. Worker v1.1.0
menurunkan DONE dari endpoint download (bagian C).

Untuk `requestId` yang tidak dikenal, endpoint ini mengembalikan HTTP 200
dengan body kosong.

### GET /demo/download/:requestId/:platform

`:platform` = `ANDROID` atau `IOS`.

- Build belum selesai → bukan 3xx (diperlakukan sebagai "belum siap").
- Build selesai → **HTTP 302** ke S3:
  - Android: `https://webtonative-demo-apps.s3.ap-south-1.amazonaws.com/android/<id>/<id>.apk`
  - iOS: `https://webtonative-demo-apps.s3.ap-south-1.amazonaws.com/ios/<id>/<id>.zip`

Terverifikasi 18 Nov 2026: APK hasil build `tebak-intro.pages.dev`
9.804.404 byte, dikenali `file` sebagai *Android package (APK)*.

## C. Catatan

- Tidak ada autentikasi di `/api/*` aplikasi ini — siapa pun bisa mengajukan build; rate limit hanya di sisi klien (localStorage, 1/24 jam).
- Upstream adalah layanan pihak ketiga tanpa SLA; kalau API-nya berubah, worker menjawab 502 dan frontend menampilkan pesannya.
