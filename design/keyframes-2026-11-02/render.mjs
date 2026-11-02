// Renders the keyframes: Chrome for Testing (CHROME_PATH, never Ben's own Chrome) over the DevTools protocol, each
// frame a real viewport of index.html (desktop 1440 × 900 at 2×, phone 390 × 844 at 3×) scrolled to its section.
//   node design/keyframes-2026-11-02/render.mjs [frame ids…]
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
// at: the section; lift: how far above its heading the frame starts (the page's own gap is 150 px).
const FRAMES = [
  { id: "kf1-hero", w: 1440, h: 900, dpr: 2, at: "#top", lift: null },
  { id: "kf2-hero-phone", w: 390, h: 844, dpr: 3, at: "#top", lift: null, mobile: true },
  { id: "kf3-how", w: 1440, h: 900, dpr: 2, at: "#how", lift: 70 },
  { id: "kf4-graded", w: 1440, h: 900, dpr: 2, at: "#graded", lift: 70 },
  { id: "kf5-desk", w: 1440, h: 900, dpr: 2, at: "#desk", lift: 70 },
  { id: "kf6-pricing", w: 1440, h: 900, dpr: 2, at: "#pricing", lift: 220 },
  { id: "kf7-close", w: 1440, h: 900, dpr: 2, at: "#close", lift: 64 },
  { id: "kf8-graded-phone", w: 390, h: 844, dpr: 3, at: "#graded", lift: 40, mobile: true },
  // The overview: every frame on one sheet (render it last).
  { id: "sheet", page: "sheet.html", w: 3326, h: 1400, dpr: 1, at: null, lift: null },
];
const want = process.argv.slice(2);
const frames = want.length ? FRAMES.filter((f) => want.includes(f.id)) : FRAMES;
const chrome = process.env.CHROME_PATH;
if (!chrome) throw new Error("CHROME_PATH isn't set (.claude/settings.local.json points it at Playwright's Chrome for Testing).");

const profile = mkdtempSync(join(tmpdir(), "hs-kf-"));
const proc = spawn(chrome, ["--headless=new", "--remote-debugging-port=0", `--user-data-dir=${profile}`, "--allow-file-access-from-files", "--hide-scrollbars", "--no-first-run", "--no-default-browser-check", "--force-color-profile=srgb", "about:blank"], { stdio: ["ignore", "ignore", "pipe"] });
const wsUrl = await new Promise((resolve, reject) => {
  let buf = "";
  const t = setTimeout(() => reject(new Error("Chrome didn't start")), 20000);
  proc.stderr.on("data", (d) => {
    buf += d;
    const m = buf.match(/DevTools listening on (ws:\/\/\S+)/);
    if (m) { clearTimeout(t); resolve(m[1]); }
  });
});

const ws = new WebSocket(wsUrl);
await new Promise((r) => ws.addEventListener("open", r, { once: true }));
let seq = 0;
const pending = new Map(), waiters = [];
ws.addEventListener("message", (e) => {
  const msg = JSON.parse(e.data);
  if (msg.id && pending.has(msg.id)) {
    const { resolve, reject } = pending.get(msg.id);
    pending.delete(msg.id);
    msg.error ? reject(new Error(msg.error.message)) : resolve(msg.result);
  } else if (msg.method) {
    for (const w of [...waiters]) if (w.method === msg.method && w.sessionId === msg.sessionId) { waiters.splice(waiters.indexOf(w), 1); w.resolve(msg.params); }
  }
});
const send = (method, params = {}, sessionId) => new Promise((resolve, reject) => {
  const id = ++seq;
  pending.set(id, { resolve, reject });
  ws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
});
const once = (method, sessionId) => new Promise((resolve) => waiters.push({ method, sessionId, resolve }));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

for (const f of frames) {
  const page = pathToFileURL(join(here, f.page ?? "index.html")).href;
  const { targetId } = await send("Target.createTarget", { url: "about:blank" });
  const { sessionId } = await send("Target.attachToTarget", { targetId, flatten: true });
  await send("Page.enable", {}, sessionId);
  await send("Emulation.setDeviceMetricsOverride", { width: f.w, height: f.h, deviceScaleFactor: f.dpr, mobile: !!f.mobile }, sessionId);
  const loaded = once("Page.loadEventFired", sessionId);
  await send("Page.navigate", { url: page }, sessionId);
  await loaded;
  for (let i = 0; i < 100; i++) {
    const { result } = await send("Runtime.evaluate", { expression: f.page ? "document.readyState === 'complete' && [...document.images].every((i) => i.complete)" : "document.body.dataset.ready === '1'", returnByValue: true }, sessionId);
    if (result.value) break;
    await sleep(100);
  }
  const expr = f.lift == null ? "0" : `(() => { const s = document.querySelector(${JSON.stringify(f.at)}); const h = s.querySelector('h2, .map, .wrap'); return Math.max(0, h.getBoundingClientRect().top + scrollY - ${f.lift}); })()`;
  const { result } = await send("Runtime.evaluate", { expression: expr, returnByValue: true }, sessionId);
  await send("Runtime.evaluate", { expression: `window.scrollTo(0, ${result.value})` }, sessionId);
  await sleep(350);
  const shot = await send("Page.captureScreenshot", { format: "jpeg", quality: 90 }, sessionId);
  writeFileSync(join(here, `${f.id}.jpg`), Buffer.from(shot.data, "base64"));
  console.log(`${f.id}.jpg  ${f.w}×${f.h} @${f.dpr}x  y=${Math.round(result.value)}`);
  await send("Target.closeTarget", { targetId });
}
ws.close();
proc.kill();
await sleep(300);
rmSync(profile, { recursive: true, force: true });
