// Render reklamy: soundtrack do WAV, klatki z przeglądarki (Playwright), sklejenie ffmpeg.
//   node render.mjs                 oba formaty, 60 kl./s
//   node render.mjs --fps 30        lżejsza wersja
//   node render.mjs --only 9x16     jeden format
//   node render.mjs --stills 1,4.6,8.3   pojedyncze klatki PNG do sprawdzenia
import { createServer } from 'node:http';
import { readFile, writeFile, mkdir, access } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const DIR = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(DIR, 'out');
const CONFIG = require('./config.js');
const audio = require('./audio.js');

const args = process.argv.slice(2);
const opt = (name, def) => { const i = args.indexOf('--' + name); return i >= 0 ? args[i + 1] : def; };
const fps = Number(opt('fps', CONFIG.fps));
const only = opt('only', null);
const stills = opt('stills', null);
const formats = [
  { id: '16x9', w: 1920, h: 1080 },
  { id: '9x16', w: 1080, h: 1920 },
].filter((f) => !only || f.id === only);

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.woff2': 'font/woff2', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp' };
const server = createServer(async (req, res) => {
  try {
    const p = path.join(DIR, decodeURIComponent(new URL(req.url, 'http://x').pathname));
    if (!p.startsWith(DIR)) throw new Error('poza katalogiem');
    res.writeHead(200, { 'content-type': TYPES[path.extname(p)] || 'application/octet-stream' });
    res.end(await readFile(p));
  } catch { res.writeHead(404); res.end(); }
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}`;

// Prawdziwe zdjęcia i logo (opcjonalnie): assets/golden.jpg, lake.jpg, night.jpg, logo.png.
const assets = {};
for (const [k, names] of Object.entries({ golden: ['golden.jpg', 'golden.png'], lake: ['lake.jpg', 'lake.png'], night: ['night.jpg', 'night.png'], logo: ['logo.png'] })) {
  for (const n of names) { try { await access(path.join(DIR, 'assets', n)); assets[k] = 'assets/' + n; break; } catch {} }
}

await mkdir(OUT, { recursive: true });
const browser = await chromium.launch();

async function openPage(f) {
  const page = await browser.newPage({ viewport: { width: f.w, height: f.h } });
  page.on('pageerror', (e) => console.error(`[${f.id}]`, e.message));
  await page.goto(`${base}/index.html?render=1&fmt=${f.id}&assets=${encodeURIComponent(JSON.stringify(assets))}`);
  await page.waitForFunction(() => window.FILM_READY === true, null, { timeout: 60000 });
  return page;
}
const grab = (page, t) => page.evaluate(async (t) => {
  KWFilm.draw(t);
  const blob = await new Promise((r) => document.getElementById('film').toBlob(r, 'image/png'));
  const b = new Uint8Array(await blob.arrayBuffer());
  let s = ''; for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000));
  return btoa(s);
}, t);

if (stills) {
  for (const f of formats) {
    const page = await openPage(f);
    for (const t of stills.split(',').map(Number)) {
      const file = path.join(OUT, `still-${f.id}-${t.toFixed(2)}.png`);
      await writeFile(file, Buffer.from(await grab(page, t), 'base64'));
      console.log(file);
    }
    await page.close();
  }
  await browser.close(); server.close();
  process.exit(0);
}

const wav = path.join(OUT, 'soundtrack.wav');
console.log('Soundtrack…');
await writeFile(wav, Buffer.from(audio.toWav(audio.render(48000))));

async function renderFormat(f) {
  const page = await openPage(f);
  const file = path.join(OUT, `kwfoto-black-week-${f.id}${fps !== 60 ? `-${fps}fps` : ''}.mp4`);
  const ff = spawn('ffmpeg', [
    '-y', '-loglevel', 'error',
    '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'png', '-i', '-',
    '-i', wav,
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '16', '-pix_fmt', 'yuv420p', '-profile:v', 'high',
    '-r', String(fps), '-g', String(fps), '-c:a', 'aac', '-b:a', '256k', '-ar', '48000',
    '-shortest', '-movflags', '+faststart', file,
  ], { stdio: ['pipe', 'inherit', 'inherit'] });
  const done = new Promise((r, j) => ff.on('close', (c) => (c ? j(new Error('ffmpeg ' + c)) : r())));
  const frames = Math.round(CONFIG.duration * fps);
  const t0 = Date.now();
  for (let i = 0; i < frames; i++) {
    const png = Buffer.from(await grab(page, i / fps), 'base64');
    if (!ff.stdin.write(png)) await new Promise((r) => ff.stdin.once('drain', r));
    if (i % fps === 0) console.log(`[${f.id}] ${i}/${frames} klatek, ${((Date.now() - t0) / 1000).toFixed(0)} s`);
  }
  ff.stdin.end();
  await done;
  await page.close();
  console.log('Gotowe:', file);
}
await Promise.all(formats.map(renderFormat));
await browser.close();
server.close();
