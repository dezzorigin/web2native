// Cloudflare Pages _worker.js — Web2Native.
//
// The Next.js app is a static export (`output: 'export'`), so it cannot ship
// API routes: `next build` refuses any dynamic route handler with static
// export. This worker is therefore the production server for the two API
// routes the frontend calls, and serves everything else from the static
// export via the ASSETS binding.
//
// What the app actually does (honest version): it does NOT compile apps
// itself. It proxies to webtonative.com's public build API
// (https://www.webtonative.com/api/v1), which wraps a website into demo
// Android APK + iOS builds. The email the upstream requires comes from the
// Pages env var WEBTONATIVE_EMAIL — the repo used to ship a stranger's
// hardcoded email; that is gone.
//
// Two real bugs fixed here (found by live probing 2026-11-18):
//  1. POST /api/build never existed in the repo — the frontend called it,
//     Next.js answered 404, so no build could ever start. It exists now.
//  2. The old /api/status read `android_status` / `ios_status` off the
//     upstream check-app-status response — but upstream NEVER returns those
//     fields, only server-availability flags. `isDone` could therefore never
//     become true and the UI polled forever even after the APK was ready
//     (verified: APK 9.8 MB on S3 while status still returned only flags).
//     Completion is now derived from the download endpoints: a 3xx there
//     means that platform's build is DONE.

const UPSTREAM = "https://www.webtonative.com/api/v1";

// Upstream sometimes never answers. Never hang the UI forever: fail fast
// so the worker can return a 502 the frontend can display.
const UPSTREAM_TIMEOUT_MS = 30_000;

function upstreamFetch(url, init) {
  return fetch(url, { ...init, signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS) });
}

const API_HEADERS = {
  "accept-language": "ms-MY",
  origin: "https://www.webtonative.com",
  referer: "https://www.webtonative.com/",
  "sec-ch-ua":
    '"Chromium";v="127", "Not)A;Brand";v="99", "Microsoft Edge Simulate";v="127", "Lemur";v="127"',
  "sec-ch-ua-mobile": "?1",
  "sec-ch-ua-platform": '"Android"',
  "sec-fetch-dest": "empty",
  "sec-fetch-mode": "cors",
  "sec-fetch-site": "same-origin",
  "user-agent":
    "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Mobile Safari/537.36",
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

// POST /api/build — { appName, websiteUrl } ->
// { success: true, data: { isSuccess, requestId, isServerAvailable } }.
async function handleBuild(request, env) {
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ success: false, error: "Body harus JSON." }, 400);
  }
  const { appName, websiteUrl } = body ?? {};

  if (!appName || typeof appName !== "string" || !appName.trim()) {
    return json({ success: false, error: "App Name wajib diisi." }, 400);
  }
  if (!websiteUrl || !/^https?:\/\//i.test(String(websiteUrl).trim())) {
    return json(
      { success: false, error: "Website URL wajib diawali http:// atau https://." },
      400,
    );
  }

  const email = env.WEBTONATIVE_EMAIL;
  if (!email) {
    return json(
      {
        success: false,
        error:
          "WEBTONATIVE_EMAIL belum diset di server — build tidak bisa didaftarkan ke webtonative.com.",
      },
      503,
    );
  }

  let upstream;
  try {
    upstream = await upstreamFetch(`${UPSTREAM}/build-app-request`, {
      method: "POST",
      headers: { ...API_HEADERS, "content-type": "application/json" },
      body: JSON.stringify({
        appName: appName.trim(),
        emailId: email,
        packageId: "WEBTONATIVE_STARTER",
        websiteUrl: String(websiteUrl).trim(),
        referralCode: "",
        utmInfo: {
          utm_source: "",
          utm_medium: "",
          utm_campaign: "",
          utm_term: "",
          utm_content: "",
        },
        device_type: "website",
        browser: "chrome",
      }),
    });
  } catch (err) {
    return json(
      { success: false, error: "Gagal menghubungi webtonative.com: " + (err?.message ?? err) },
      502,
    );
  }

  const data = await upstream.json().catch(() => ({}));
  if (!data?.isSuccess) {
    return json(
      {
        success: false,
        error: data?.errorCode
          ? `webtonative.com menolak build: ${data.errorCode}`
          : "webtonative.com menolak build.",
      },
      502,
    );
  }
  return json({ success: true, data });
}

// HEAD the demo download URL without following the redirect: a 3xx means
// that platform's build file exists on S3, i.e. the build is DONE.
async function downloadReady(url) {
  try {
    const res = await upstreamFetch(url, { method: "HEAD", redirect: "manual" });
    return res.status >= 300 && res.status < 400;
  } catch {
    return false;
  }
}

// GET /api/status?requestId=... ->
// { success: true, data: { ...upstreamFlags, android_status, ios_status,
//   android_url, ios_url, isDone } }.
// android_status / ios_status are "DONE" or "PROCESSING" — the exact
// strings the frontend already renders.
async function handleStatus(request) {
  const requestId = new URL(request.url).searchParams.get("requestId");
  if (!requestId) {
    return json({ success: false, error: "requestId wajib diisi." }, 400);
  }

  let upstream;
  try {
    upstream = await upstreamFetch(
      `${UPSTREAM}/check-app-status?requestId=${encodeURIComponent(requestId)}`,
      { method: "GET", headers: API_HEADERS },
    );
  } catch (err) {
    return json(
      { success: false, error: "Gagal menghubungi webtonative.com: " + (err?.message ?? err) },
      502,
    );
  }

  const flags = await upstream.json().catch(() => ({}));
  const androidUrl = `${UPSTREAM}/demo/download/${requestId}/ANDROID`;
  const iosUrl = `${UPSTREAM}/demo/download/${requestId}/IOS`;

  const [androidDone, iosDone] = await Promise.all([
    downloadReady(androidUrl),
    downloadReady(iosUrl),
  ]);

  const isDone = androidDone && iosDone;
  return json({
    success: true,
    data: {
      ...flags,
      android_status: androidDone ? "DONE" : "PROCESSING",
      ios_status: iosDone ? "DONE" : "PROCESSING",
      android_url: isDone ? androidUrl : null,
      ios_url: isDone ? iosUrl : null,
      isDone,
    },
  });
}

const worker = {
  async fetch(request, env) {
    const { pathname } = new URL(request.url);

    if (pathname === "/api/build" && request.method === "POST") {
      return handleBuild(request, env);
    }
    if (pathname === "/api/status" && request.method === "GET") {
      return handleStatus(request);
    }
    if (pathname.startsWith("/api/")) {
      return json({ success: false, error: "Rute API tidak dikenal." }, 404);
    }
    return env.ASSETS.fetch(request);
  },
};

export default worker;
