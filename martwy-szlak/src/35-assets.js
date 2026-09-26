'use strict';

/* ---------- Grafiki: ładowanie ---------- */
// ASSETS (klucz -> data URI) i ASSET_META (opis sprite'ów) wstawia skrypt budujący.
const IMG = {};
function loadImages() {
  const keys = Object.keys(typeof ASSETS === 'object' ? ASSETS : {});
  return Promise.all(keys.map(k => new Promise(res => {
    const im = new Image();
    im.onload = () => { IMG[k] = im; res(); };
    im.onerror = () => res();
    im.src = ASSETS[k];
  })));
}

/* ---------- Rejestr sprite'ów ---------- */
// Sprite: klatki (obraz + kotwica w ułamkach), ppu = piksele obrazu na jednostkę logiczną przy skali 1,0.
const SPR = {};
function mkCanvas(w, h) { const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h)); return c; }
function regSprite(key, frames, h, ax = 0.5, ay = 0.97, ref = 0) {
  const fr = frames.filter(Boolean);
  if (!fr.length) return;
  const im = fr[Math.min(ref, fr.length - 1)];
  SPR[key] = { key, frames: fr.map(img => ({ img, ax, ay })), ppu: im.height / h, h };
}
function buildRegistry() {
  const meta = (typeof ASSET_META === 'object' && ASSET_META.sprites) || {};
  for (const [key, m] of Object.entries(meta)) {
    const frames = m.frames.map(f => IMG[f]).filter(Boolean);
    if (!frames.length) continue;
    const ref = frames[Math.min(m.ref || 0, frames.length - 1)];
    SPR[key] = { key, h: m.h, ppu: ref.height / m.h, anims: m.anims || null, frames: frames.map((img, i) => ({ img, ax: (m.anchors && m.anchors[i] ? m.anchors[i][0] : m.ax ?? 0.5), ay: (m.anchors && m.anchors[i] ? m.anchors[i][1] : m.ay ?? 0.97) })) };
  }
  // Brakujące sprite'y: najpierw zastępstwo z istniejącej grafiki, dopiero potem rysunek w kodzie.
  for (const [key, fn] of Object.entries(PROC)) {
    if (SPR[key]) continue;
    const al = ALIAS[key];
    if (al && SPR[al]) SPR[key] = SPR[al]; else fn(key);
  }
  for (const [key, src] of Object.entries(ALIAS)) if (!SPR[key] && SPR[src]) SPR[key] = SPR[src];
}
// Zastępstwa: gdy nie ma dedykowanej grafiki, bierzemy najbliższą istniejącą.
const ALIAS = {
  z2: 'z1', z3: 'z1', zr: 'z1', zx: 'z1', zb: 'z1',
  boss0_charge: 'boss0', boss0_hit: 'boss0', boss1_p2: 'boss1', boss1_throw: 'boss1',
  p_pickup: 'p_sedan', p_tires: 'p_barrel', p_barrier: 'p_barrel', p_bus: 'p_sedan', p_sign: 'p_cactus',
  p_hazbarrel: 'p_barrel2', p_pipes: 'p_crates', p_tanker: 'p_container', p_forklift: 'p_crates', p_fence: 'p_crates',
  container_1: 'container', container_2: 'container', ice_1: 'ice', ice_2: 'ice', safe_1: 'safe', safe_2: 'safe',
};

/* ---------- Zastępcze grafiki rysowane w kodzie ---------- */
function paint(w, h, fn) { const c = mkCanvas(w, h); fn(c.getContext('2d'), w, h); return c; }
function rrect(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
function noiseFill(g, w, h, base, spread, n, sz) {
  g.fillStyle = base; g.fillRect(0, 0, w, h);
  for (let i = 0; i < n; i++) {
    const v = (Math.random() - 0.5) * spread;
    g.fillStyle = v > 0 ? `rgba(255,255,255,${v})` : `rgba(0,0,0,${-v})`;
    const s = sz * (0.4 + Math.random());
    g.fillRect(Math.random() * w, Math.random() * h, s, s);
  }
}
const PROC = {
  panel_red: k => regSprite(k, [procPanel('255,70,55', '120,14,8')], PANEL_H + 10, 0.5, 0.98),
  panel_blue: k => regSprite(k, [procPanel('70,170,255', '10,50,130')], PANEL_H + 10, 0.5, 0.98),
  ice: k => regSprite(k, [procIce(0)], 88, 0.5, 0.97),
  container: k => regSprite(k, [procContainer()], 92, 0.5, 0.97),
  safe: k => regSprite(k, [procSafe(false)], 70, 0.5, 0.97),
  safe_open: k => regSprite(k, [procSafe(true)], 70, 0.5, 0.97),
  coin: k => regSprite(k, [procCoin()], 14, 0.5, 0.5),
  crate: k => regSprite(k, [procCrate()], 34, 0.5, 0.95),
  part: k => regSprite(k, [procPart()], 26, 0.5, 0.8),
  pedestal: k => regSprite(k, [procPedestal()], 60, 0.5, 0.78),
  p_barrel: k => regSprite(k, [procBarrel('#9b2d1c', '#5a1a10')], 40, 0.5, 0.96),
  p_barrel2: k => regSprite(k, [procBarrel('#e0b21a', '#2a2a2a')], 40, 0.5, 0.96),
  p_container: k => regSprite(k, [procBox('#3f6f8f', 150, 120)], 92, 0.5, 0.96),
  p_crates: k => regSprite(k, [procBox('#8a6b3c', 90, 90)], 58, 0.5, 0.96),
  p_lamp: k => regSprite(k, [procLamp()], 150, 0.5, 0.98),
  p_sedan: k => regSprite(k, [procBox('#7d6a58', 150, 90)], 56, 0.5, 0.96),
  p_cactus: k => regSprite(k, [procBarrel('#4d7a3a', '#2f4f25')], 60, 0.5, 0.96),
  soldier: k => regSprite(k, [procSoldier()], 32, 0.5, 0.97),
  z1: k => regSprite(k, [procZombie()], 34, 0.5, 0.97),
  boss0: k => regSprite(k, [procZombie(1.4)], 170, 0.5, 0.97),
  boss1: k => regSprite(k, [procZombie(1.6)], 176, 0.5, 0.97),
  w0: k => regSprite(k, [procGun(0.5)], 20, 0.5, 0.5), w1: k => regSprite(k, [procGun(0.7)], 22, 0.5, 0.5),
  w2: k => regSprite(k, [procGun(1)], 22, 0.5, 0.5), w3: k => regSprite(k, [procGun(1.1)], 26, 0.5, 0.5), w4: k => regSprite(k, [procGun(1.2)], 26, 0.5, 0.5),
};
function procPanel(c1, c2) {
  return paint(300, 200, (g, w, h) => {
    const fx = 14, top = 26, bot = h - 10;
    // szkło
    const gr = g.createLinearGradient(0, top, 0, bot);
    gr.addColorStop(0, `rgba(${c1},0.92)`); gr.addColorStop(1, `rgba(${c2},0.9)`);
    g.fillStyle = gr; g.fillRect(fx, top, w - fx * 2, bot - top);
    g.fillStyle = 'rgba(255,255,255,0.18)'; g.beginPath(); g.moveTo(fx, top); g.lineTo(fx + 90, top); g.lineTo(fx + 30, bot); g.lineTo(fx, bot); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.10)'; g.fillRect(fx + 110, top, 26, bot - top);
    // rama
    g.fillStyle = '#5b6068'; g.fillRect(0, top - 14, w, 14); g.fillStyle = '#8c929b'; g.fillRect(0, top - 14, w, 5);
    g.fillStyle = '#44484f'; g.fillRect(0, top - 14, fx, bot - top + 18); g.fillRect(w - fx, top - 14, fx, bot - top + 18);
    g.fillStyle = '#2c2f34'; g.fillRect(0, bot, w, 10);
    g.fillStyle = '#c9ccd2'; for (const x of [7, w - 7]) for (const y of [top - 7, bot + 4]) { g.beginPath(); g.arc(x, y, 3, 0, 7); g.fill(); }
  });
}
function procIce(dmg) {
  return paint(260, 270, (g, w, h) => {
    const top = 70;
    let gr = g.createLinearGradient(0, top, 0, h);
    gr.addColorStop(0, '#bfe9ff'); gr.addColorStop(1, '#5aa9d8');
    g.fillStyle = gr; rrect(g, 14, top, w - 28, h - top - 6, 14); g.fill();
    gr = g.createLinearGradient(0, 8, 0, top + 10); gr.addColorStop(0, '#f2fbff'); gr.addColorStop(1, '#a8dcf5');
    g.fillStyle = gr; rrect(g, 14, 10, w - 28, top + 8, 14); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.35)'; g.fillRect(34, top + 16, 16, h - top - 44); g.fillRect(60, top + 16, 6, h - top - 44);
    g.strokeStyle = 'rgba(255,255,255,0.9)'; g.lineWidth = 3; rrect(g, 14, 10, w - 28, h - 16, 14); g.stroke();
    g.strokeStyle = 'rgba(30,90,140,0.7)'; g.lineWidth = 3;
    const cracks = dmg === 0 ? 1 : dmg === 1 ? 4 : 8;
    for (let i = 0; i < cracks; i++) { let x = 60 + Math.random() * 140, y = top + Math.random() * 120; g.beginPath(); g.moveTo(x, y); for (let j = 0; j < 4; j++) { x += (Math.random() - 0.5) * 60; y += Math.random() * 40; g.lineTo(x, y); } g.stroke(); }
  });
}
function procContainer() {
  return paint(270, 280, (g, w, h) => {
    const top = 64;
    g.fillStyle = '#9fb3c4'; rrect(g, 10, 12, w - 20, top, 10); g.fill();
    g.fillStyle = '#6d8497'; rrect(g, 10, top, w - 20, h - top - 6, 10); g.fill();
    g.fillStyle = 'rgba(210,245,255,0.8)'; for (let i = 0; i < 18; i++) g.fillRect(20 + Math.random() * (w - 50), top + Math.random() * (h - top - 30), 14, 5);
    for (let i = 0; i < 6; i++) { g.fillStyle = i % 2 ? '#111' : '#f2c21b'; g.beginPath(); g.moveTo(10 + i * 44, h - 40); g.lineTo(54 + i * 44, h - 40); g.lineTo(34 + i * 44, h - 14); g.lineTo(-10 + i * 44, h - 14); g.fill(); }
    g.fillStyle = 'rgba(120,220,255,0.9)'; g.fillRect(w / 2 - 40, top + 40, 80, 10);
  });
}
function procSafe(open) {
  return paint(240, 220, (g, w, h) => {
    const top = 56;
    let gr = g.createLinearGradient(0, 0, w, 0); gr.addColorStop(0, '#b8860b'); gr.addColorStop(0.5, '#ffd95a'); gr.addColorStop(1, '#a8740a');
    g.fillStyle = '#ffe58a'; rrect(g, 12, 10, w - 24, top, 12); g.fill();
    g.fillStyle = gr; rrect(g, 12, top, w - 24, h - top - 6, 12); g.fill();
    g.strokeStyle = '#6b4a05'; g.lineWidth = 4; rrect(g, 30, top + 16, w - 60, h - top - 40, 8); g.stroke();
    if (open) { g.fillStyle = '#2a1a05'; rrect(g, 32, top + 18, w - 64, h - top - 44, 8); g.fill(); g.fillStyle = '#ffd84a'; for (let i = 0; i < 9; i++) { g.beginPath(); g.arc(60 + Math.random() * 120, h - 50 - Math.random() * 40, 9, 0, 7); g.fill(); } }
    else { g.fillStyle = '#5a3d04'; g.beginPath(); g.arc(w / 2, top + (h - top) / 2 - 6, 22, 0, 7); g.fill(); g.fillStyle = '#ffe58a'; g.beginPath(); g.arc(w / 2, top + (h - top) / 2 - 6, 12, 0, 7); g.fill(); }
  });
}
function procCoin() {
  return paint(48, 48, (g) => { const gr = g.createRadialGradient(18, 16, 2, 24, 24, 22); gr.addColorStop(0, '#fff6c2'); gr.addColorStop(0.5, '#ffd23a'); gr.addColorStop(1, '#b07a06'); g.fillStyle = gr; g.beginPath(); g.arc(24, 24, 21, 0, 7); g.fill(); g.strokeStyle = '#8a5c03'; g.lineWidth = 3; g.stroke(); });
}
function procCrate() {
  return paint(110, 104, (g, w, h) => {
    g.fillStyle = '#6f7d3a'; rrect(g, 6, 22, w - 12, h - 28, 8); g.fill();
    g.fillStyle = '#8d9c4c'; rrect(g, 6, 6, w - 12, 26, 8); g.fill();
    g.fillStyle = '#fff'; g.fillRect(w / 2 - 6, 44, 12, 36); g.fillRect(w / 2 - 18, 56, 36, 12);
    g.strokeStyle = '#3d451d'; g.lineWidth = 4; rrect(g, 6, 6, w - 12, h - 12, 8); g.stroke();
  });
}
function procPart() {
  return paint(90, 90, (g) => {
    g.translate(45, 45); g.fillStyle = '#c8cdd4';
    for (let i = 0; i < 8; i++) { g.rotate(Math.PI / 4); g.fillRect(-7, -38, 14, 14); }
    g.beginPath(); g.arc(0, 0, 28, 0, 7); g.fill(); g.fillStyle = '#5a6068'; g.beginPath(); g.arc(0, 0, 12, 0, 7); g.fill();
  });
}
function procPedestal() {
  return paint(280, 190, (g, w, h) => {
    g.fillStyle = '#3b4148'; g.beginPath(); g.ellipse(w / 2, 110, 130, 70, 0, 0, 7); g.fill();
    g.fillStyle = '#5d656e'; g.beginPath(); g.ellipse(w / 2, 90, 128, 64, 0, 0, 7); g.fill();
    g.strokeStyle = '#6ff3ff'; g.lineWidth = 8; g.beginPath(); g.ellipse(w / 2, 90, 106, 50, 0, 0, 7); g.stroke();
    g.fillStyle = '#7b848e'; g.beginPath(); g.ellipse(w / 2, 88, 92, 42, 0, 0, 7); g.fill();
  });
}
function procBarrel(c, c2) {
  return paint(90, 130, (g, w, h) => {
    g.fillStyle = c2; rrect(g, 8, 18, w - 16, h - 22, 12); g.fill();
    g.fillStyle = c; rrect(g, 12, 18, w - 24, h - 26, 10); g.fill();
    g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(8, 50, w - 16, 8); g.fillRect(8, 90, w - 16, 8);
    g.fillStyle = c2; g.beginPath(); g.ellipse(w / 2, 20, w / 2 - 8, 14, 0, 0, 7); g.fill();
  });
}
function procBox(c, w0, h0) {
  return paint(w0, h0, (g, w, h) => {
    g.fillStyle = c; g.fillRect(4, h * 0.3, w - 8, h * 0.68);
    g.fillStyle = 'rgba(255,255,255,0.25)'; g.fillRect(4, 4, w - 8, h * 0.3);
    g.fillStyle = 'rgba(0,0,0,0.25)'; for (let x = 12; x < w - 8; x += 16) g.fillRect(x, h * 0.34, 5, h * 0.6);
  });
}
function procLamp() {
  return paint(90, 300, (g, w, h) => { g.fillStyle = '#4a4f57'; g.fillRect(w / 2 - 5, 30, 10, h - 34); g.fillRect(w / 2 - 30, 26, 40, 8); g.fillStyle = '#ffcf7a'; g.fillRect(w / 2 - 36, 30, 20, 8); g.fillStyle = '#2b2f35'; g.fillRect(w / 2 - 14, h - 14, 28, 12); });
}
function procSoldier() {
  return paint(60, 100, (g) => { g.fillStyle = '#c8a878'; g.fillRect(20, 60, 8, 34); g.fillRect(32, 60, 8, 34); g.fillStyle = '#2f7fd0'; rrect(g, 14, 30, 32, 36, 8); g.fill(); g.fillStyle = '#1b1f24'; g.beginPath(); g.arc(30, 24, 12, 0, 7); g.fill(); g.fillStyle = '#333'; g.fillRect(38, 6, 5, 34); });
}
function procZombie(s = 1) {
  return paint(70 * s, 100 * s, (g, w, h) => { g.scale(s, s); g.fillStyle = '#3c3f4a'; g.fillRect(22, 62, 10, 34); g.fillRect(38, 62, 10, 34); g.fillStyle = '#d9d2c4'; rrect(g, 16, 30, 38, 38, 8); g.fill(); g.fillStyle = '#8a9a6a'; g.beginPath(); g.arc(35, 22, 13, 0, 7); g.fill(); g.fillRect(6, 36, 12, 8); g.fillRect(52, 36, 12, 8); g.fillStyle = '#c0281c'; g.fillRect(30, 20, 4, 4); g.fillRect(38, 20, 4, 4); });
}
function procGun(len) {
  return paint(200 * len, 70, (g, w, h) => { g.fillStyle = '#2a2d33'; g.fillRect(10, 22, w - 30, 16); g.fillRect(w * 0.3, 30, 18, 34); g.fillStyle = '#f0a020'; g.fillRect(w - 26, 24, 16, 12); });
}

/* ---------- Tekstury drogi ---------- */
function procAsphalt(theme) {
  return paint(512, 512, (g, w, h) => {
    noiseFill(g, w, h, theme === 'toxic' ? '#6d7074' : '#4a4a4e', 0.16, 9000, 3);
    g.strokeStyle = theme === 'toxic' ? 'rgba(20,24,28,0.5)' : 'rgba(18,18,20,0.55)'; g.lineWidth = 2;
    for (let i = 0; i < 14; i++) { let x = Math.random() * w, y = Math.random() * h; g.beginPath(); g.moveTo(x, y); for (let j = 0; j < 6; j++) { x += (Math.random() - 0.5) * 50; y += (Math.random() - 0.5) * 50; g.lineTo(x, y); } g.stroke(); }
    if (theme === 'toxic') for (let i = 0; i < 8; i++) { g.fillStyle = 'rgba(20,20,24,0.35)'; g.beginPath(); g.ellipse(Math.random() * w, Math.random() * h, 20 + Math.random() * 30, 10 + Math.random() * 16, 0, 0, 7); g.fill(); }
  });
}
function procSide(theme) {
  return paint(256, 512, (g, w, h) => {
    noiseFill(g, w, h, theme === 'toxic' ? '#56585a' : '#c9a46a', 0.2, 5000, 4);
    for (let i = 0; i < 40; i++) { g.fillStyle = theme === 'toxic' ? 'rgba(30,32,34,0.5)' : 'rgba(120,90,50,0.45)'; g.beginPath(); g.arc(Math.random() * w, Math.random() * h, 2 + Math.random() * 5, 0, 7); g.fill(); }
  });
}

/* ---------- Cache klatek: 3 skale, lustro, biała sylwetka ---------- */
// Klatka jest rysowana bez skalowania w drawImage: cache ma już rozmiar w pikselach urządzenia.
const VARS = [1.0, 0.93, 0.86];
let CACHE = new Map();
let U = 2;                 // piksele urządzenia na jednostkę logiczną
const varOf = k => (k >= 0.965 ? 0 : k >= 0.895 ? 1 : 2);
const SHADOW_KEYS = new Set(['z1', 'z2', 'z3', 'zr', 'zb', 'zx', 'soldier']);
function frameCache(key, fi, v, flip, white) {
  const id = key + '|' + fi + '|' + v + '|' + (flip ? 1 : 0) + (white ? 1 : 0);
  let c = CACHE.get(id);
  if (c) return c;
  const s = SPR[key];
  if (!s) return null;
  const f = s.frames[fi % s.frames.length], im = f.img;
  const sc = VARS[v] * U / s.ppu;
  const w = im.width * sc, h = im.height * sc;
  // Cień pod stopami wypalony w klatce: o połowę mniej wywołań drawImage przy hordzie.
  const shadow = !white && SHADOW_KEYS.has(key);
  const padB = shadow ? Math.ceil(h * 0.06) : 0, padX = shadow ? Math.ceil(w * 0.1) : 0;
  const cv = mkCanvas(w + padX * 2, h + padB);
  const g = cv.getContext('2d');
  if (shadow) {
    const cx = padX + (flip ? 1 - f.ax : f.ax) * w, cy = f.ay * h, rx = s.h * (key === 'zb' ? 0.3 : 0.34) * VARS[v] * U, ry = rx * 0.35;
    const gr = g.createRadialGradient(cx, cy, 0, cx, cy, rx);
    gr.addColorStop(0, 'rgba(20,12,6,0.42)'); gr.addColorStop(1, 'rgba(20,12,6,0)');
    g.fillStyle = gr; g.save(); g.translate(cx, cy); g.scale(1, ry / rx); g.beginPath(); g.arc(0, 0, rx, 0, 7); g.restore(); g.fill();
  }
  g.imageSmoothingQuality = 'high';
  if (flip) { g.save(); g.translate(padX * 2 + w, 0); g.scale(-1, 1); g.drawImage(im, padX, 0, w, h); g.restore(); }
  else g.drawImage(im, padX, 0, w, h);
  if (white) { g.globalCompositeOperation = 'source-in'; g.fillStyle = '#fff'; g.fillRect(0, 0, cv.width, cv.height); }
  c = { c: cv, ax: padX + (flip ? 1 - f.ax : f.ax) * w, ay: f.ay * h };
  CACHE.set(id, c);
  return c;
}
function resetCaches() { CACHE = new Map(); GLYPHS.clear(); WORDS.clear(); }

/* ---------- Atlas cyfr i słów ---------- */
const NUM_SIZES = [12, 15, 18, 22, 26, 30, 38];
const STYLES = { w: '#ffffff', y: '#ffd84a', r: '#ff5a48', b: '#8fe3ff', g: '#c8f55a', d: '#2a1605' };
const GLYPHS = new Map();
let FONT = 'Bungee, Impact, "Arial Black", sans-serif';
function glyphSet(style, size) {
  const id = style + size;
  let a = GLYPHS.get(id);
  if (a) return a;
  const chars = '0123456789+−×/%-x';
  const px = size * U, pad = Math.ceil(px * 0.18) + 2;
  const probe = mkCanvas(4, 4).getContext('2d');
  probe.font = `${px}px ${FONT}`;
  const ws = [...chars].map(ch => Math.ceil(probe.measureText(ch).width));
  const cv = mkCanvas(ws.reduce((s, w) => s + w + pad * 2, 0), px * 1.3 + pad * 2);
  const g = cv.getContext('2d');
  g.font = `${px}px ${FONT}`; g.textBaseline = 'middle'; g.lineJoin = 'round';
  a = { cv, map: {}, h: cv.height };
  let x = 0;
  [...chars].forEach((ch, i) => {
    const w = ws[i] + pad * 2, cx = x + pad, cy = cv.height / 2;
    if (style !== 'd') { g.lineWidth = Math.max(3, px * 0.2); g.strokeStyle = 'rgba(22,12,6,0.92)'; g.strokeText(ch, cx, cy); }
    g.fillStyle = STYLES[style]; g.fillText(ch, cx, cy);
    a.map[ch] = { x, w, adv: ws[i] };
    x += w;
  });
  GLYPHS.set(id, a);
  return a;
}
const nearSize = s => NUM_SIZES.reduce((b, v) => (Math.abs(v - s) < Math.abs(b - s) ? v : b), NUM_SIZES[0]);
// Rysuje liczbę z atlasu (współrzędne w pikselach urządzenia, środek tekstu w x,y).
function drawNum(ctx, str, style, size, x, y, alpha = 1) {
  const a = glyphSet(style, nearSize(size));
  let tw = 0;
  for (const ch of str) { const m = a.map[ch]; if (m) tw += m.adv; }
  const pad = (a.map['0'].w - a.map['0'].adv) / 2;
  let cx = Math.round(x - tw / 2 - pad);
  const cy = Math.round(y - a.h / 2);
  if (alpha < 1) ctx.globalAlpha = alpha;
  for (const ch of str) { const m = a.map[ch]; if (!m) continue; ctx.drawImage(a.cv, m.x, 0, m.w, a.h, cx, cy, m.w, a.h); cx += m.adv; }
  if (alpha < 1) ctx.globalAlpha = 1;
  return tw;
}
const WORDS = new Map();
function drawWord(ctx, str, style, size, x, y, alpha = 1) {
  const id = str + '|' + style + '|' + size;
  let w = WORDS.get(id);
  if (!w) {
    const px = size * U, pad = Math.ceil(px * 0.2) + 2;
    const probe = mkCanvas(4, 4).getContext('2d'); probe.font = `${px}px ${FONT}`;
    const tw = Math.ceil(probe.measureText(str).width);
    const cv = mkCanvas(tw + pad * 2, px * 1.3 + pad * 2), g = cv.getContext('2d');
    g.font = `${px}px ${FONT}`; g.textBaseline = 'middle'; g.lineJoin = 'round';
    g.lineWidth = Math.max(3, px * 0.2); g.strokeStyle = 'rgba(22,12,6,0.92)'; g.strokeText(str, pad, cv.height / 2);
    g.fillStyle = STYLES[style] || style; g.fillText(str, pad, cv.height / 2);
    w = cv;
    if (WORDS.size > 80) WORDS.clear();
    WORDS.set(id, w);
  }
  if (alpha < 1) ctx.globalAlpha = alpha;
  ctx.drawImage(w, Math.round(x - w.width / 2), Math.round(y - w.height / 2));
  if (alpha < 1) ctx.globalAlpha = 1;
}
