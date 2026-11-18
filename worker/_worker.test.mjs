// Unit tests for worker/_worker.js — run with `npm test` (node --test).
// Upstream (webtonative.com) and the ASSETS binding are both mocked;
// no network is touched.
import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import worker from "./_worker.js";

const ORIG_FETCH = globalThis.fetch;

const mockAssets = {
  async fetch(req) {
    return new Response("static:" + new URL(req.url).pathname, {
      headers: { "content-type": "text/plain" },
    });
  },
};
const env = { ASSETS: mockAssets, WEBTONATIVE_EMAIL: "owner@example.com" };

function req(path, init) {
  return new Request("https://web2native.pages.dev" + path, init);
}

beforeEach(() => {
  globalThis.fetch = async () => {
    throw new Error("unexpected upstream call");
  };
});
afterEach(() => {
  globalThis.fetch = ORIG_FETCH;
});

test("build: menolak body bukan JSON (400)", async () => {
  const res = await worker.fetch(
    req("/api/build", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{bukan json",
    }),
    env,
  );
  assert.equal(res.status, 400);
  const data = await res.json();
  assert.equal(data.success, false);
});

test("build: menolak appName kosong (400)", async () => {
  const res = await worker.fetch(
    req("/api/build", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ appName: " ", websiteUrl: "https://example.com" }),
    }),
    env,
  );
  assert.equal(res.status, 400);
});

test("build: menolak URL tanpa skema (400)", async () => {
  const res = await worker.fetch(
    req("/api/build", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ appName: "Tes", websiteUrl: "example.com" }),
    }),
    env,
  );
  assert.equal(res.status, 400);
});

test("build: 503 kalau WEBTONATIVE_EMAIL belum diset", async () => {
  const res = await worker.fetch(
    req("/api/build", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ appName: "Tes", websiteUrl: "https://example.com" }),
    }),
    { ASSETS: mockAssets },
  );
  assert.equal(res.status, 503);
  const data = await res.json();
  assert.match(data.error, /WEBTONATIVE_EMAIL/);
});

test("build: meneruskan payload ke upstream dan mengembalikan requestId", async () => {
  let seenUrl, seenBody, seenEmail;
  globalThis.fetch = async (url, init) => {
    seenUrl = url;
    seenBody = JSON.parse(init.body);
    seenEmail = seenBody.emailId;
    return new Response(
      JSON.stringify({ isSuccess: true, requestId: "req-123", isServerAvailable: true }),
      { status: 201, headers: { "content-type": "application/json" } },
    );
  };
  const res = await worker.fetch(
    req("/api/build", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ appName: "Tes", websiteUrl: "https://example.com" }),
    }),
    env,
  );
  assert.equal(res.status, 200);
  assert.equal(seenUrl, "https://www.webtonative.com/api/v1/build-app-request");
  assert.equal(seenEmail, "owner@example.com");
  assert.equal(seenBody.packageId, "WEBTONATIVE_STARTER");
  const data = await res.json();
  assert.equal(data.success, true);
  assert.equal(data.data.requestId, "req-123");
});

test("build: upstream menolak URL -> 502 dengan errorCode", async () => {
  globalThis.fetch = async () => {
    return new Response(JSON.stringify({ isSuccess: false, errorCode: "WEBSITE_URL_INVALID" }), {
      status: 201,
      headers: { "content-type": "application/json" },
    });
  };
  const res = await worker.fetch(
    req("/api/build", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ appName: "Tes", websiteUrl: "https://example.com" }),
    }),
    env,
  );
  assert.equal(res.status, 502);
  const data = await res.json();
  assert.match(data.error, /WEBSITE_URL_INVALID/);
});

test("status: menolak tanpa requestId (400)", async () => {
  const res = await worker.fetch(req("/api/status"), env);
  assert.equal(res.status, 400);
});

test("status: PROCESSING saat download belum 302, DONE saat keduanya 302", async () => {
  const calls = [];
  globalThis.fetch = async (url, init) => {
    calls.push(String(url));
    if (String(url).includes("/check-app-status")) {
      return new Response(
        JSON.stringify({ isAndroidServerAvailable: true, isIosAppServerAvailable: true }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    }
    // HEAD download: android 302 (siap), ios 404 (belum)
    if (String(url).includes("/ANDROID")) {
      return new Response(null, { status: 302, headers: { location: "https://s3/x.apk" } });
    }
    return new Response("not found", { status: 404 });
  };
  const res = await worker.fetch(req("/api/status?requestId=req-123"), env);
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.success, true);
  assert.equal(data.data.android_status, "DONE");
  assert.equal(data.data.ios_status, "PROCESSING");
  assert.equal(data.data.isDone, false);
  assert.equal(data.data.android_url, null);
  assert.equal(data.data.ios_url, null);

  // Kedua platform 302 -> DONE + URL terisi.
  globalThis.fetch = async (url, init) => {
    if (String(url).includes("/check-app-status")) {
      return new Response(JSON.stringify({ isAndroidServerAvailable: true }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }
    return new Response(null, { status: 302, headers: { location: "https://s3/x" } });
  };
  const res2 = await worker.fetch(req("/api/status?requestId=req-123"), env);
  const data2 = await res2.json();
  assert.equal(data2.data.isDone, true);
  assert.equal(data2.data.android_status, "DONE");
  assert.equal(data2.data.ios_status, "DONE");
  assert.match(data2.data.android_url, /\/ANDROID$/);
  assert.match(data2.data.ios_url, /\/IOS$/);
});

test("rute api tak dikenal -> 404, sisanya ke ASSETS", async () => {
  const res = await worker.fetch(req("/api/apa-ini"), env);
  assert.equal(res.status, 404);
  const res2 = await worker.fetch(req("/index.html"), env);
  assert.equal(res2.status, 200);
  assert.equal(await res2.text(), "static:/index.html");
});
