import { spawn } from "node:child_process";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { legendLines } from "../js/math.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const port = 47321;
const banned = [
  "豌豆",
  "向日葵",
  "坚果",
  "路障",
  "Peashooter",
  "Sunflower",
  "Wall-nut",
  "Wallnut",
  "Conehead",
  "AudioContext",
  "webkitAudioContext",
  "<audio",
  "new Audio",
];

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (name === ".git" || name === "node_modules") continue;
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

const files = walk(root).filter((file) => {
  if (file.endsWith(`${path.sep}scripts${path.sep}smoke.mjs`)) return false;
  return /\.(html|css|js|mjs|md|svg|json)$/.test(file);
});
const blob = files.map((file) => readFileSync(file, "utf8")).join("\n");
for (const word of banned) {
  if (blob.includes(word)) {
    console.error(`forbidden token: ${word}`);
    process.exit(1);
  }
}

const legend = legendLines().map((line) => line.text).join("");
for (const piece of ["20 秒", "炸弹", "空投支援", "大获全胜", "不是币安官方指标"]) {
  if (!legend.includes(piece)) {
    console.error(`legend missing ${piece}`);
    process.exit(1);
  }
}

const server = spawn("python3", ["-m", "http.server", String(port), "--bind", "127.0.0.1"], {
  cwd: root,
  stdio: "ignore",
});

function stop() {
  if (!server.killed) server.kill("SIGTERM");
}

const paths = [
  "/",
  "/index.html",
  "/css/site.css",
  "/js/app.js",
  "/js/math.js",
  "/js/binance.js",
  "/js/field.js",
  "/favicon.svg",
  "/README.md",
];

try {
  await waitForServer();
  for (const item of paths) {
    const response = await fetch(`http://127.0.0.1:${port}${item}`);
    if (!response.ok) throw new Error(`${item} -> ${response.status}`);
  }
  const html = await (await fetch(`http://127.0.0.1:${port}/`)).text();
  for (const piece of ["藤骨战线", "选择永续", "DOGEUSDT", "大获全胜", 'type="module"', "js/app.js"]) {
    if (!html.includes(piece)) throw new Error(`index missing ${piece}`);
  }
  if (html.includes("fonts.google")) throw new Error("external font host");
  console.log(`smoke ok on ${paths.length} paths`);
} catch (error) {
  console.error(error);
  stop();
  process.exit(1);
} finally {
  stop();
}

async function waitForServer() {
  const deadline = Date.now() + 8000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/`);
      if (response.ok) return;
    } catch {
      /* not up yet */
    }
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  throw new Error("static server did not start");
}
