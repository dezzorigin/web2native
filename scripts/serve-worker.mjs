// Local dev server: serves out/ statically and routes /api/* through
// worker/_worker.js with the ASSETS binding backed by the filesystem.
// Usage: npm run build && WEBTONATIVE_EMAIL=you@example.com npm run serve
// (default port 8329 — check it's free first; repo #16 left 8327/8328 busy).
import http from "node:http";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import worker from "../worker/_worker.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, "..", "out");
const PORT = Number(process.env.PORT || 8329);

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".txt": "text/plain; charset=utf-8",
};

const ASSETS = {
  async fetch(req) {
    const url = new URL(req.url);
    let p = decodeURIComponent(url.pathname);
    if (p === "/") p = "/index.html";
    const file = path.join(OUT, p);
    if (!file.startsWith(OUT) || !existsSync(file)) {
      const notFound = path.join(OUT, "404.html");
      if (existsSync(notFound)) {
        return new Response(await readFile(notFound), {
          status: 404,
          headers: { "content-type": "text/html; charset=utf-8" },
        });
      }
      return new Response("Not found", { status: 404 });
    }
    const ext = path.extname(file);
    return new Response(await readFile(file), {
      headers: { "content-type": MIME[ext] || "application/octet-stream" },
    });
  },
};

const env = { ASSETS, WEBTONATIVE_EMAIL: process.env.WEBTONATIVE_EMAIL || "" };

const server = http.createServer(async (req, res) => {
  const url = `http://127.0.0.1:${PORT}${req.url}`;
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const request = new Request(url, {
    method: req.method,
    headers: req.headers,
    body: chunks.length ? Buffer.concat(chunks) : undefined,
  });
  try {
    const response = await worker.fetch(request, env);
    res.writeHead(response.status, Object.fromEntries(response.headers.entries()));
    res.end(Buffer.from(await response.arrayBuffer()));
  } catch (err) {
    res.writeHead(500, { "content-type": "application/json" });
    res.end(JSON.stringify({ success: false, error: String(err?.message ?? err) }));
  }
});

server.listen(PORT, () => {
  console.log(`web2native dev server: http://127.0.0.1:${PORT}/`);
  console.log(`WEBTONATIVE_EMAIL: ${env.WEBTONATIVE_EMAIL ? "set" : "BELUM DISET (build akan 503)"}`);
});
