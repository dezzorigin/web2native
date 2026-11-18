// Smoke test output statis (out/) — dijalankan lokal/CI tanpa network.
// Memeriksa marker penting ada di HTML hasil export / chunk JS.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, "..", "out");

let fail = 0;
const check = (name, ok) => {
  console.log(ok ? `PASS ${name}` : `FAIL ${name}`);
  if (!ok) fail++;
};

const readAll = (dir) => {
  let out = "";
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out += readAll(p);
    else if (/\.(html|js|txt)$/.test(e.name)) out += fs.readFileSync(p, "utf8");
  }
  return out;
};

check("out/ ada", fs.existsSync(OUT));
check("out/index.html ada", fs.existsSync(path.join(OUT, "index.html")));
check("out/_worker.js ada (API hidup di Pages)", fs.existsSync(path.join(OUT, "_worker.js")));
check("out/favicon.svg ada", fs.existsSync(path.join(OUT, "favicon.svg")));
check("out/404.html ada", fs.existsSync(path.join(OUT, "404.html")));

const html = fs.readFileSync(path.join(OUT, "index.html"), "utf8");
check("index.html berisi judul Web2Native", html.includes("Web2Native"));
check("index.html berisi link GitHub repo", html.includes("github.com/dezzorigin/web2native"));

const all = readAll(OUT);
check("landing hero ada di bundle", all.includes("Ubah website jadi aplikasi"));
check("builder ada di bundle", all.includes("Unlock native mobile"));
check("tombol download Android ada di bundle", all.includes("Download Android APK"));
check("worker berisi rute /api/build", fs.readFileSync(path.join(OUT, "_worker.js"), "utf8").includes("/api/build"));
check("worker berisi rute /api/status", fs.readFileSync(path.join(OUT, "_worker.js"), "utf8").includes("/api/status"));
check("tidak ada email hardcoded di bundle", !all.includes("fongsifdev@gmail.com"));

console.log(fail ? `\nSMOKE: ${fail} gagal` : "\nSMOKE: semua lolos");
process.exit(fail ? 1 : 0);
