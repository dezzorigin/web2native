# Deployment — Web2Native v1.1.0

## Target

Cloudflare Pages, project **`web2native`**, URL produksi:

**https://web2native.pages.dev**

## Cara deploy

Build lokal menghasilkan `out/` (static export) + `out/_worker.js`:

```bash
npm run build   # next build && cp worker/_worker.js out/_worker.js
```

Deploy memakai `cf_pages.py` (token Cloudflare dari Secure Vault):

```bash
python3 ~/workspace/github-actions/cf_pages.py deploy web2native out
```

`cf_pages.py` otomatis mendeteksi `out/_worker.js` dan mengirimkannya
sebagai `_worker.bundle` (multipart) — tanpa field itu deploy hanya statis
dan `/api/*` akan 404. Tidak perlu `wrangler pages deploy`; tidak ada
`wrangler.jsonc` di repo ini lagi.

## Env var (wajib)

| Nama | Nilai | Cara set |
|---|---|---|
| `WEBTONATIVE_EMAIL` | email pemilik produk (mis. `nblauliadka@gmail.com`) | env var Pages production (dashboard Cloudflare atau API `PATCH /accounts/{id}/pages/projects/web2native` → `deployment_configs.production.env_vars`). BUKAN di repo, BUKAN di `.env`. |

Tanpa var ini, `POST /api/build` menjawab 503. Redeploy **tidak**
diperlukan setelah mengubah env var — Pages menerapkannya di deployment
berikutnya; untuk langsung berlaku, redeploy sekali setelah set.

## CI

`.github/workflows/ci.yml` — 5 job:

| Job | Isi |
|---|---|
| `build` | `npm ci` → typecheck → lint → `npm run build` (static export + worker). Output `out/` di-upload sebagai artifact. |
| `worker-test` | `node --test worker/_worker.test.mjs` (9 tes, upstream di-mock, tanpa network). |
| `audit` | `npm audit --omit=dev --audit-level=high` (hanya dependensi produksi). |
| `lighthouse` | LHCI atas artifact `out/` (config `lighthouserc.json`). |
| `live-smoke` | Non-gating (`continue-on-error`): cek HTTP 200 landing live + validasi `POST /api/build` (400) + `GET /api/status` tanpa requestId (400). Tidak membuat build beneran (tidak menghabiskan kuota demo). |

## Deploy lokal (pengembangan)

```bash
WEBTONATIVE_EMAIL=kamu@example.com npm run serve
# -> http://127.0.0.1:8329/ (static out/ + worker, ASSETS dari filesystem)
```

## Verifikasi pasca-deploy

1. `curl -s -o /dev/null -w "%{http_code}" https://web2native.pages.dev/` → 200.
2. Landing ter-render (hero "Ubah website jadi aplikasi", logo GitHub → repo).
3. `POST /api/build` dengan body kosong → 400; `GET /api/status` → 400.
4. Play-test headless penuh (skrip `~/workspace/absensirapat-audit/diag/play-w2n.mjs`): landing → builder → build beneran → DONE → link unduh 302 → history → mobile.

## Riwayat

- v1.1.0 (18 Nov 2026): migrasi dari OpenNext ke static export + Pages Worker; deploy pertama ke `web2native.pages.dev`.
- Sebelumnya: README mengklaim live di `web2native.nblauliadka.workers.dev` (Workers dev) — tidak terverifikasi dan tidak dipakai lagi.
