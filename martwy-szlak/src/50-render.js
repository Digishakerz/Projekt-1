'use strict';

/* ---------- Płótno i skala ---------- */
const cv = document.getElementById('c');
const ctx = cv.getContext('2d', { alpha: false });
let DPR = 1, LH = 865;
function resize() {
  const r = cv.getBoundingClientRect();
  DPR = Math.min(2, window.devicePixelRatio || 1);
  cv.width = Math.max(200, Math.round(r.width * DPR));
  cv.height = Math.max(300, Math.round(r.height * DPR));
  U = cv.width / LW;
  LH = cv.height / U;
  setGeometry(LH);
  resetCaches();
  PACKC.clear();
  ring.ok = false; strip = null; vig = null; fog = null;
}
const mod = (a, n) => ((a % n) + n) % n;

// Rzut do pikseli urządzenia (bez tworzenia obiektów): wynik w PX, PY, PK.
let PX = 0, PY = 0, PK = 1;
function P(x, wy) { const y = G.Yp - wy * DEPTH; PK = kS(y); PX = (LW / 2 + (x - LW / 2) * kX(y)) * U; PY = y * U; }

/* ---------- Droga: pas tekstury i bufor pierścieniowy ---------- */
// Ziemia jest malowana raz, gdy nowy wiersz wjeżdża na ekran; plamy krwi wypalamy w bufor.
const STRIP_P = 344;                 // okres wzoru w jednostkach świata
const RING_X0 = -30, RING_W = 460;   // bufor obejmuje x od -30 do 430
const ring = { cv: null, g: null, H: 0, painted: 0, ok: false, theme: '' };
let strip = null;
const TEX = {};
function tex(key, fallback) { return IMG[key] || TEX[key] || (TEX[key] = fallback()); }
function buildStrip(theme) {
  const toxic = theme === 'toxic';
  const road = tex(toxic ? 'road2' : 'road1', () => procAsphalt(theme));
  const side = tex(toxic ? 'side2' : 'side1', () => procSide(theme));
  const W = Math.round(RING_W * U), H = Math.round(STRIP_P * DEPTH * U);
  const c = mkCanvas(W, H), g = c.getContext('2d');
  const X = x => (x - RING_X0) * U;
  g.imageSmoothingQuality = 'high';
  // Pobocza: tekstura rozciągnięta na 200 x 344 jednostek, prawa strona w lustrze.
  g.drawImage(side, X(ROAD_L - 200), 0, 200 * U, H);
  g.save(); g.translate(X(ROAD_R + 200), 0); g.scale(-1, 1); g.drawImage(side, 0, 0, 200 * U, H); g.restore();
  // Jezdnia: kwadratowa tekstura na pełną szerokość, ściśnięta w głąb.
  g.drawImage(road, X(ROAD_L), 0, (ROAD_R - ROAD_L) * U, H);
  // Krawędzie asfaltu przyciemnione, żeby jezdnia odcinała się od pobocza.
  for (const [x0, dir] of [[ROAD_L, 1], [ROAD_R, -1]]) {
    const gr = g.createLinearGradient(X(x0), 0, X(x0 + dir * 16), 0);
    gr.addColorStop(0, 'rgba(0,0,0,0.35)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.fillRect(Math.min(X(x0), X(x0 + dir * 16)), 0, 16 * U, H);
  }
  // Oznakowanie: linie krawędziowe i przerywane linie pasów (okres 86 = 344 / 4).
  const dash = STRIP_P / 4, dy = dash * DEPTH * U;
  if (toxic) {
    // Pasy ostrzegawcze żółto-czarne wzdłuż krawędzi.
    for (const x0 of [ROAD_L + 2, ROAD_R - 12]) {
      g.save(); g.beginPath(); g.rect(X(x0), 0, 10 * U, H); g.clip();
      for (let y = -H; y < H * 2; y += 14 * U) { g.fillStyle = '#e8b81c'; g.beginPath(); g.moveTo(X(x0), y); g.lineTo(X(x0 + 10), y - 7 * U); g.lineTo(X(x0 + 10), y); g.lineTo(X(x0), y + 7 * U); g.fill(); }
      g.restore();
    }
  } else {
    g.fillStyle = 'rgba(236,196,70,0.85)';
    g.fillRect(X(ROAD_L + 4), 0, 3 * U, H); g.fillRect(X(ROAD_R - 7), 0, 3 * U, H);
  }
  g.fillStyle = toxic ? 'rgba(232,190,40,0.8)' : 'rgba(240,236,224,0.82)';
  for (const lx of [LANES[0].x1, LANES[1].x1]) for (let i = 0; i < 4; i++) g.fillRect(X(lx - 1.5), i * dy + dy * 0.25, 3 * U, dy * 0.5);
  return { cv: c, theme, U };
}
const absRow = A => -A * DEPTH * U;
function paintRows(a0, a1) {
  let r0 = Math.floor(absRow(a1)), r1 = Math.ceil(absRow(a0)) + 1;
  if (r1 - r0 > ring.H) r0 = r1 - ring.H;
  const RH = ring.H, SH = strip.cv.height, W = strip.cv.width;
  while (r0 < r1) {
    const rr = mod(r0, RH), sr = mod(r0, SH), len = Math.min(r1 - r0, RH - rr, SH - sr);
    ring.g.drawImage(strip.cv, 0, sr, W, len, 0, rr, W, len);
    r0 += len;
  }
}
function ensureRing() {
  if (ring.ok && ring.theme === S.L.theme) {
    const target = S.scroll + G.topWy + 80;
    if (target > ring.painted) { paintRows(ring.painted, target); ring.painted = target; }
    return;
  }
  if (!strip || strip.theme !== S.L.theme || strip.U !== U) strip = buildStrip(S.L.theme);
  ring.H = Math.round((LH + 160) * U);
  ring.cv = mkCanvas(strip.cv.width, ring.H); ring.g = ring.cv.getContext('2d');
  ring.theme = S.L.theme; ring.ok = true;
  const a1 = S.scroll + G.topWy + 80;
  paintRows(S.scroll + G.botWy - 40, a1); ring.painted = a1;
}
// Wypala obraz (plamę) w buforze drogi w punkcie świata; płaski na ziemi, więc ściśnięty w głąb.
function burn(img, x, wy, wL, hL, alpha = 1) {
  if (!ring.ok || !img) return;
  const r = mod(absRow(S.scroll + wy), ring.H), X = (x - RING_X0) * U, w = wL * U, h = hL * DEPTH * U;
  const g = ring.g;
  g.globalAlpha = alpha;
  for (const off of [0, -ring.H, ring.H]) { const y = r + off; if (y + h < 0 || y - h > ring.H) continue; g.drawImage(img, X - w / 2, y - h / 2, w, h); }
  g.globalAlpha = 1;
}
function drawGround() {
  const off = Math.round(-(G.Yp + S.scroll * DEPTH) * U);
  const RH = ring.H, W = ring.cv.width, SL = Math.max(8, Math.round(16 * U));
  for (let y = 0; y < cv.height; y += SL) {
    const h = Math.min(SL, cv.height - y), kx = kX((y + h / 2) / U);
    const dw = W * kx, dx = (LW / 2 - (LW / 2 - RING_X0) * kx) * U;
    let sr = mod(y + off, RH), rem = h, dy = y;
    while (rem > 0) { const len = Math.min(rem, RH - sr); ctx.drawImage(ring.cv, 0, sr, W, len, dx, dy, dw, len); rem -= len; dy += len; sr = 0; }
  }
}

/* ---------- Grafiki efektów (AI albo rysowane) ---------- */
const VFXC = {};
function vfx(key) {
  if (VFXC[key]) return VFXC[key];
  if (SPR[key]) return (VFXC[key] = SPR[key].frames[0].img);
  const c = key.startsWith('blood') ? paint(128, 128, (g) => {
    g.fillStyle = 'rgba(96,14,10,0.9)';
    for (let i = 0; i < 9; i++) { g.beginPath(); g.arc(64 + (Math.random() - 0.5) * 60, 64 + (Math.random() - 0.5) * 60, 8 + Math.random() * 18, 0, 7); g.fill(); }
    for (let i = 0; i < 14; i++) { g.beginPath(); g.arc(64 + (Math.random() - 0.5) * 110, 64 + (Math.random() - 0.5) * 110, 2 + Math.random() * 4, 0, 7); g.fill(); }
  }) : key === 'acid' ? paint(128, 128, (g) => {
    const gr = g.createRadialGradient(64, 64, 4, 64, 64, 62); gr.addColorStop(0, 'rgba(200,255,90,0.95)'); gr.addColorStop(0.7, 'rgba(120,200,40,0.8)'); gr.addColorStop(1, 'rgba(80,140,20,0)');
    g.fillStyle = gr; g.beginPath(); g.arc(64, 64, 62, 0, 7); g.fill();
  }) : key === 'glow' ? paint(128, 128, (g) => {
    const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.35, 'rgba(255,255,255,0.35)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  }) : key.startsWith('flash') ? paint(96, 96, (g) => {
    g.translate(48, 48);
    const gr = g.createRadialGradient(0, 0, 0, 0, 0, 44); gr.addColorStop(0, 'rgba(255,255,230,1)'); gr.addColorStop(0.3, 'rgba(255,210,90,0.9)'); gr.addColorStop(1, 'rgba(255,120,20,0)');
    g.fillStyle = gr;
    for (let i = 0; i < 5; i++) { g.rotate(Math.PI * 2 / 5 + Math.random() * 0.3); g.beginPath(); g.moveTo(0, -6); g.lineTo(34 + Math.random() * 10, 0); g.lineTo(0, 6); g.fill(); }
    g.beginPath(); g.arc(0, 0, 16, 0, 7); g.fill();
  }) : key === 'fire' ? paint(96, 96, (g) => {
    const gr = g.createRadialGradient(48, 48, 0, 48, 48, 46); gr.addColorStop(0, 'rgba(255,250,210,1)'); gr.addColorStop(0.3, 'rgba(255,190,60,0.9)'); gr.addColorStop(0.7, 'rgba(230,80,10,0.5)'); gr.addColorStop(1, 'rgba(120,20,0,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 96, 96);
  }) : key === 'toxic' ? paint(128, 128, (g) => {
    const gr = g.createRadialGradient(64, 64, 0, 64, 64, 62); gr.addColorStop(0, 'rgba(230,255,140,0.95)'); gr.addColorStop(0.5, 'rgba(150,230,50,0.6)'); gr.addColorStop(1, 'rgba(60,120,10,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  }) : paint(8, 8, () => {});
  return (VFXC[key] = c);
}

/* ---------- Cząsteczki, liczby, błyski (pule) ---------- */
const PARTS = [];
for (let i = 0; i < 700; i++) PARTS.push({ k: 0, x: 0, wy: 0, h: 0, vx: 0, vwy: 0, vh: 0, life: 0, max: 1, sz: 1, col: '', rot: 0, vr: 0, img: null, fi: 0, flip: false });
let partN = 0;
const PK_DROP = 1, PK_CHUNK = 2, PK_SHARD = 3, PK_SPARK = 4, PK_PUFF = 5, PK_COIN = 6, PK_BODY = 7, PK_RING = 8, PK_GLOW = 9;
function part(k, x, wy, h, vx, vwy, vh, life, sz, col) {
  if (partN >= PARTS.length) return null;
  const p = PARTS[partN++];
  p.k = k; p.x = x; p.wy = wy; p.h = h; p.vx = vx; p.vwy = vwy; p.vh = vh; p.life = p.max = life; p.sz = sz; p.col = col; p.rot = rnd(0, 6.28); p.vr = rnd(-9, 9); p.img = null; p.fi = 0; p.flip = false;
  return p;
}
const FLOATS = [];
for (let i = 0; i < 70; i++) FLOATS.push({ txt: '', st: 'w', x: 0, wy: 0, h: 0, sz: 18, life: 0, max: 1, num: true });
let floatN = 0;
function addFloat(txt, st, x, wy, h, sz, life) {
  if (floatN >= FLOATS.length) { FLOATS.push(FLOATS.shift()); floatN--; }
  const f = FLOATS[floatN++];
  f.txt = txt; f.st = st; f.x = x; f.wy = wy; f.h = h; f.sz = sz; f.life = f.max = life; f.num = /^[0-9+−×%/-]+$/.test(txt);
}
const FLASHES = [];
let shakeA = 0, shakeT = 0, shakeD = 1, whiteT = 0;

/* ---------- Podpięcie efektów pod symulację ---------- */
function bloodDecal(x, wy, size) { burn(vfx('blood' + rndi(0, 2)), x + rnd(-2, 2), wy, size * rnd(0.9, 1.3), size * rnd(0.8, 1.2), rnd(0.55, 0.85)); }
Object.assign(FX, {
  blood(x, wy, h, n) { for (let i = 0; i < n; i++) part(PK_DROP, x + rnd(-3, 3), wy + rnd(-2, 2), h, rnd(-45, 45), rnd(-25, 50), rnd(30, 150), rnd(0.35, 0.6), rnd(1, 2.2), rnd01() < 0.5 ? '#7a0f0a' : '#a3170f'); },
  decal(kind, x, wy, size) { bloodDecal(x, wy, size); },
  hitSpark(x, wy, h, kind) {
    if (rnd01() < 0.5) return;
    const col = kind === 'glass' ? '#bfe9ff' : kind === 'ice' ? '#e9fbff' : kind === 'metal' ? '#ffe39a' : '#ff9a70';
    part(PK_SPARK, x, wy, h, rnd(-80, 80), rnd(-30, 20), rnd(40, 160), 0.18, 1.2, col);
  },
  dmg(v, x, wy, h, st) { addFloat(String(v), st, x + rnd(-6, 6), wy, h, st === 'y' ? 18 : 15, 0.5); },
  float(txt, st, x, wy, h, sz) { addFloat(txt, st, x, wy, h, sz, 1.1); },
  shake(a, d) { if (a >= shakeA * (shakeT / shakeD)) { shakeA = a; shakeT = shakeD = d; } },
  sound(name) { AUDIO.play(name); },
  banner(t, s, danger) { showBanner(t, s, danger); },
  muzzle(x, dwy) { if (FLASHES.length < 40) FLASHES.push({ x, wy: dwy, life: 0.04, f: rndi(0, 2) }); },
  glass(x, wy, blue) {
    const c1 = blue ? '#9fdcff' : '#ff9a8a', c2 = blue ? '#4aa8ff' : '#ff4a38';
    for (let i = 0; i < 22; i++) part(PK_SHARD, x + rnd(-40, 40), wy + rnd(-4, 4), rnd(8, 40), rnd(-120, 120), rnd(-60, 120), rnd(60, 240), rnd(0.5, 0.9), rnd(2, 4.5), i % 2 ? c1 : c2);
    AUDIO.play('glass');
  },
  shards(x, wy, kind) {
    const cols = kind === 'safe' ? ['#ffd84a', '#b8860b', '#fff1a8'] : kind === 'container' ? ['#9fb3c4', '#e8f8ff', '#6d8497'] : ['#e9fbff', '#9fdcff', '#ffffff'];
    for (let i = 0; i < 30; i++) part(PK_SHARD, x + rnd(-30, 30), wy + rnd(-10, 10), rnd(10, 60), rnd(-160, 160), rnd(-80, 140), rnd(80, 300), rnd(0.6, 1.1), rnd(2.5, 6), pick(cols));
    for (let i = 0; i < 6; i++) part(PK_PUFF, x + rnd(-20, 20), wy + rnd(-8, 8), rnd(10, 40), rnd(-30, 30), rnd(-10, 30), rnd(10, 40), rnd(0.5, 0.8), rnd(18, 30), kind === 'safe' ? 'rgba(255,230,150,' : 'rgba(230,248,255,');
    burn(vfx('glow'), x, wy, 90, 70, 0.12);
  },
  coins(x, wy, n) { for (let i = 0; i < Math.min(12, n); i++) { const p = part(PK_COIN, x + rnd(-20, 20), wy, rnd(20, 50), rnd(-120, 120), rnd(-40, 80), rnd(160, 300), rnd(0.8, 1.2), 1, ''); if (p) p.fi = 0; } setTimeout(hudCoins, 700); },
  soldierDown(x, dwy) {
    const p = part(PK_BODY, x, dwy, 0, rnd(-20, 20), rnd(-10, 10), 0, 0.5, 1, '');
    if (p) { p.img = 'soldier'; p.flip = rnd01() < 0.5; const an = SPR.soldier.anims; p.fi = an && an.death ? an.death[0] : 0; }
    FX.blood(x, dwy, 16, 6);
    bloodDecal(x, dwy, 14);
  },
  zombieDown(z) {
    const big = z.T === ZT.brute;
    bloodDecal(z.x, z.wy, big ? 30 : 16);
    FX.blood(z.x, z.wy, z.h * 0.5, big ? 14 : 5);
    for (let i = 0; i < (big ? 4 : rndi(1, 2)); i++) part(PK_CHUNK, z.x, z.wy, z.h * 0.5, rnd(-70, 70), rnd(-30, 60), rnd(60, 180), rnd(0.5, 0.8), rnd(2, 3.5), '#5a0c08');
    const p = part(PK_BODY, z.x, z.wy, 0, 0, 0, 0, 0.28, 1, '');
    if (p) { p.img = z.spr; p.flip = z.flip; p.fi = Math.floor(S.t * z.T.anim * z.as + z.ph); }
  },
  explosion(x, wy, kind) {
    for (let i = 0; i < 10; i++) part(PK_GLOW, x + rnd(-14, 14), wy + rnd(-8, 8), rnd(6, 30), rnd(-60, 60), rnd(-30, 60), rnd(20, 90), rnd(0.5, 0.9), rnd(16, 30), 'rgba(170,240,60,');
    part(PK_RING, x, wy, 2, 0, 0, 0, 0.35, 44, 'rgba(200,255,100,');
    burn(vfx('acid'), x, wy, 46, 40, 0.5);
    FX.shake(2, 0.12); AUDIO.play('boom');
  },
  pickup(x, wy, kind) {
    for (let i = 0; i < 16; i++) part(PK_SPARK, x + rnd(-10, 10), wy, rnd(10, 40), rnd(-120, 120), rnd(-60, 120), rnd(60, 220), rnd(0.3, 0.6), 1.6, kind === 'weapon' ? '#fff1a8' : '#9fe8ff');
    if (kind === 'weapon') whiteT = 0.12;
  },
  weaponBeam(x, wy) { whiteT = Math.max(whiteT, 0.06); for (let i = 0; i < 24; i++) part(PK_SPARK, x + rnd(-20, 20), wy, rnd(10, 60), rnd(-90, 90), rnd(-40, 40), rnd(120, 320), rnd(0.4, 0.8), 1.6, '#aef6ff'); },
  bossDown(b) {
    whiteT = 0.16;
    for (let i = 0; i < 40; i++) part(PK_CHUNK, b.x + rnd(-30, 30), b.wy, rnd(20, 90), rnd(-200, 200), rnd(-100, 160), rnd(100, 360), rnd(0.7, 1.3), rnd(3, 6), i % 3 ? '#5a0c08' : '#8a1a10');
    for (let i = 0; i < 14; i++) part(b.id === 1 ? PK_GLOW : PK_PUFF, b.x + rnd(-40, 40), b.wy + rnd(-20, 20), rnd(10, 80), rnd(-50, 50), rnd(-20, 50), rnd(20, 60), rnd(0.7, 1.2), rnd(24, 44), b.id === 1 ? 'rgba(170,240,60,' : 'rgba(120,30,20,');
    for (let i = 0; i < 6; i++) bloodDecal(b.x + rnd(-40, 40), b.wy + rnd(-30, 30), rnd(30, 50));
    const p = part(PK_BODY, b.x, b.wy, 0, 0, 0, 0, 0.6, 1, ''); if (p) { p.img = b.B.spr; p.fi = -1; }
  },
  acid(x, wy) { for (let i = 0; i < 14; i++) part(PK_GLOW, x + rnd(-40, 40), wy + rnd(-30, 30), rnd(2, 20), rnd(-40, 40), rnd(-20, 20), rnd(20, 80), rnd(0.4, 0.8), rnd(10, 20), 'rgba(180,250,70,'); },
  flame() { AUDIO.play('flame'); },
  bossPhase(b) { for (let i = 0; i < 24; i++) part(PK_SHARD, b.x + rnd(-40, 40), b.wy, rnd(40, 140), rnd(-200, 200), rnd(-60, 160), rnd(80, 260), rnd(0.8, 1.2), rnd(3, 6), pick(['#6d7780', '#9aa5ad', '#3d454c'])); whiteT = 0.08; },
});
function updateFx(dt) {
  for (let i = partN - 1; i >= 0; i--) {
    const p = PARTS[i];
    p.life -= dt;
    if (p.k === PK_COIN) {
      // Monety lecą do licznika w rogu ekranu (w pikselach logicznych ekranu).
      p.h += p.vh * dt; p.vh -= 700 * dt; p.x += p.vx * dt; p.wy += p.vwy * dt;
    } else if (p.k !== PK_BODY && p.k !== PK_RING) {
      p.x += p.vx * dt; p.wy += p.vwy * dt - S.V * dt; p.rot += p.vr * dt;
      if (p.k === PK_PUFF || p.k === PK_GLOW) { p.h += p.vh * dt; p.vh *= 0.96; p.sz *= 1 + dt * 0.8; }
      else {
        p.vh -= 620 * dt; p.h += p.vh * dt;
        if (p.h <= 0) {
          p.h = 0;
          if (p.k === PK_DROP || p.k === PK_CHUNK) { burn(vfx('blood' + rndi(0, 2)), p.x, p.wy, p.sz * 3.2, p.sz * 3, 0.7); p.life = 0; }
          else { p.vx *= 0.6; p.vwy *= 0.6; p.vh = -p.vh * 0.3; p.vr *= 0.6; }
        }
      }
    } else p.wy -= S.V * dt;
    if (p.life <= 0) { PARTS[i] = PARTS[--partN]; PARTS[partN] = p; }
  }
  for (let i = floatN - 1; i >= 0; i--) {
    const f = FLOATS[i];
    f.life -= dt; f.h += (f.max < 0.6 ? 60 : 34) * dt; f.wy -= S.V * dt;
    if (f.life <= 0) { FLOATS[i] = FLOATS[--floatN]; FLOATS[floatN] = f; }
  }
  for (let i = FLASHES.length - 1; i >= 0; i--) { FLASHES[i].life -= dt; if (FLASHES[i].life <= 0) FLASHES.splice(i, 1); }
  if (shakeT > 0) shakeT -= dt;
  if (whiteT > 0) whiteT -= dt;
}

/* ---------- Grupy LOD: wstępnie złożone klastry 6 zombie ---------- */
const PACKC = new Map();
function packCache(tpl, fi, v) {
  const id = tpl + '|' + fi + '|' + v;
  let c = PACKC.get(id);
  if (c) return c;
  const mem = PACK_TPL[tpl], sc = VARS[v];
  const parts = mem.map(m => {
    const s = SPR[m.spr], nf = s.frames.length;
    const fc = frameCache(m.spr, nf > 1 ? (fi + Math.floor(m.ph)) % nf : 0, v, m.flip, false);
    return { fc, ox: m.dx * sc * U, oy: -m.dwy * DEPTH * U };
  });
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  for (const p of parts) { x0 = Math.min(x0, p.ox - p.fc.ax); y0 = Math.min(y0, p.oy - p.fc.ay); x1 = Math.max(x1, p.ox - p.fc.ax + p.fc.c.width); y1 = Math.max(y1, p.oy - p.fc.ay + p.fc.c.height); }
  const cvp = mkCanvas(x1 - x0 + 2, y1 - y0 + 2), g = cvp.getContext('2d');
  for (const p of parts) g.drawImage(p.fc.c, Math.round(p.ox - p.fc.ax - x0), Math.round(p.oy - p.fc.ay - y0));
  c = { c: cvp, ax: -x0, ay: -y0 };
  PACKC.set(id, c);
  return c;
}

/* ---------- Rysowanie obiektów ---------- */
function blit(key, fi, x, wy, lift = 0, flip = false, white = false, alpha = 1) {
  P(x, wy);
  const c = frameCache(key, fi, varOf(PK), flip, white);
  if (!c) return;
  if (alpha < 1) ctx.globalAlpha = alpha;
  ctx.drawImage(c.c, Math.round(PX - c.ax), Math.round(PY - lift * PK * U - c.ay));
  if (alpha < 1) ctx.globalAlpha = 1;
}
// Obiekt rysowany z transformacją (bossowie, broń na podeście): mało sztuk, więc skalowanie nie boli.
function drawScaled(key, fi, x, wy, lift, opt = {}) {
  const s = SPR[key]; if (!s) return;
  const f = s.frames[fi % s.frames.length], im = f.img;
  P(x, wy);
  // opt.len: docelowa długość obiektu na ekranie (broń 80-96 px według specyfikacji).
  const sc = opt.len ? opt.len * PK * U / im.width : PK * U / s.ppu * (opt.scale || 1);
  const w = im.width * sc * (opt.sx || 1), h = im.height * sc * (opt.sy || 1);
  ctx.save();
  ctx.translate(PX, PY - lift * PK * U);
  if (opt.rot) ctx.rotate(opt.rot);
  if (opt.flip) ctx.scale(-1, 1);
  if (opt.alpha != null) ctx.globalAlpha = opt.alpha;
  ctx.drawImage(im, -f.ax * w, -f.ay * h, w, h);
  if (opt.flash) {
    const wc = frameCache(key, fi, 0, false, true);
    if (wc) { ctx.globalAlpha = opt.flash; ctx.drawImage(wc.c, -f.ax * w, -f.ay * h, w, h); }
  }
  ctx.restore();
}
function zFrame(z) {
  const nf = SPR[z.spr].frames.length, at = S.t * z.T.anim * z.as + z.ph;
  return [nf > 1 ? Math.floor(at) % nf : 0, nf > 1 ? Math.sin(at * Math.PI) : -Math.abs(Math.sin(at * Math.PI)) * 1.6];
}
function drawZombie(z) {
  const [fi, bob] = zFrame(z);
  P(z.x, z.wy);
  const v = varOf(PK), c = frameCache(z.spr, fi, v, z.flip, false);
  const y = PY + bob * U;
  ctx.drawImage(c.c, Math.round(PX - c.ax), Math.round(y - c.ay));
  if (z.hitT > 0) { const w = frameCache(z.spr, fi, v, z.flip, true); ctx.globalAlpha = 0.8; ctx.drawImage(w.c, Math.round(PX - w.ax), Math.round(y - w.ay)); ctx.globalAlpha = 1; }
  if (z.T === ZT.brute && z.hp < z.max) {
    const bw = 30 * PK * U, bh = 4 * U, bx = PX - bw / 2, by = y - (z.h + 8) * PK * U;
    ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(bx, by, bw, bh);
    ctx.fillStyle = '#ff5a48'; ctx.fillRect(bx, by, bw * Math.max(0, z.hp / z.max), bh);
  }
}
function drawPack(pk) {
  P(pk.x, pk.wy);
  const v = varOf(PK), c = packCache(pk.tpl, Math.floor(S.t * ZT.walker.anim) % 4, v);
  ctx.drawImage(c.c, Math.round(PX - c.ax), Math.round(PY - c.ay));
}
function drawSoldier(i) {
  const f = FORM[i], s = SPR.soldier, run = (s.anims && s.anims.run) || [0];
  const fi = run[Math.floor(S.t * 11 + i * 1.7) % run.length];
  blit('soldier', fi, S.sx + f.dx, f.dwy, run.length > 1 ? 0 : Math.abs(Math.sin(S.t * 11 + i)) * 1.2);
}
function glowAt(x, wy, lift, rw, rh, col, a) {
  P(x, wy);
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = a;
  const g = tintedGlow(col);
  ctx.drawImage(g, PX - rw * PK * U, PY - lift * PK * U - rh * PK * U, rw * 2 * PK * U, rh * 2 * PK * U);
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
}
const GLOWS = {};
function tintedGlow(col) {
  if (GLOWS[col]) return GLOWS[col];
  return (GLOWS[col] = paint(128, 128, (g) => { const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64); gr.addColorStop(0, `rgba(${col},0.9)`); gr.addColorStop(0.45, `rgba(${col},0.35)`); gr.addColorStop(1, `rgba(${col},0)`); g.fillStyle = gr; g.fillRect(0, 0, 128, 128); }));
}
function drawPanel(p) {
  if (p.taken) return;
  const blue = Math.floor(p.v) > 0;
  const pulse = 0.55 + 0.25 * Math.sin(S.t * 6 + p.ph);
  glowAt(p.x, p.wy, PANEL_H * 0.5, PANEL_W * 0.75, PANEL_H * 0.9, blue ? '60,160,255' : '255,60,40', blue ? pulse : pulse * 0.6);
  blit(blue ? 'panel_blue' : 'panel_red', 0, p.x, p.wy, 0, false, false, 0.94);
  if (p.hitT > 0) blit(blue ? 'panel_blue' : 'panel_red', 0, p.x, p.wy, 0, false, true, 0.35);
}
function drawObst(o) {
  const f = o.hp / o.max, jit = o.hitT > 0 ? rnd(-1, 1) : 0;
  const k = o.kind, dmgKey = f < 0.35 && SPR[k + '_2'] !== SPR[k] ? k + '_2' : f < 0.7 && SPR[k + '_1'] !== SPR[k] ? k + '_1' : k;
  if (k === 'container') glowAt(o.x, o.wy, 20, 60, 34, '120,220,255', 0.35);
  blit(dmgKey, 0, o.x + jit, o.wy);
  if (o.hitT > 0) blit(dmgKey, 0, o.x + jit, o.wy, 0, false, true, 0.45);
  // Pęknięcia dorysowane, gdy nie ma osobnych klatek uszkodzeń.
  if (dmgKey === k && f < 0.8) {
    P(o.x, o.wy);
    const s = PK * U, n = f < 0.35 ? 7 : f < 0.6 ? 4 : 2;
    ctx.strokeStyle = k === 'safe' ? 'rgba(70,40,0,0.8)' : 'rgba(30,70,110,0.75)'; ctx.lineWidth = 1.6 * U;
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      let x = PX + (((i * 37) % 60) - 30) * s, y = PY - (20 + ((i * 53) % 50)) * s;
      ctx.moveTo(x, y);
      for (let j = 0; j < 3; j++) { x += (((i + j) * 29 % 21) - 10) * s; y += (8 + ((i * j * 7) % 9)) * s; ctx.lineTo(x, y); }
    }
    ctx.stroke();
  }
}
function drawPed(p) {
  const w = WEAPONS[Math.min(p.tier, WEAPON_MAX)];
  const pulse = 0.5 + 0.3 * Math.sin(S.t * 5);
  if (p.state === 'appear') {
    // Wejście podestu: rozbłysk i słup światła, podest wyrasta z ziemi.
    const f = Math.min(1, p.t / 0.45);
    glowAt(p.x, p.wy, 20, 70 * f, 60 * f, '170,245,255', 1 - f * 0.5);
    drawScaled('pedestal', 0, p.x, p.wy, 0, { sy: f, alpha: f });
    return;
  }
  glowAt(p.x, p.wy, 4, 58, 28, p.tier > WEAPON_MAX ? '120,255,160' : '110,240,255', pulse);
  blit('pedestal', 0, p.x, p.wy);
  if (p.state === 'empty') return;
  const lift = 18 + (p.state === 'launch' ? p.h : Math.sin(S.t * 2.4) * 2);
  if (p.state === 'launch') {
    P(p.x, p.wy);
    const bw = 34 * PK * U, top = PY - 260 * PK * U;
    const gr = ctx.createLinearGradient(0, top, 0, PY);
    gr.addColorStop(0, 'rgba(200,250,255,0)'); gr.addColorStop(1, 'rgba(200,250,255,0.7)');
    ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = gr; ctx.fillRect(PX - bw / 2, top, bw, PY - top); ctx.globalCompositeOperation = 'source-over';
  }
  if (p.tier > WEAPON_MAX) blit('crate', 0, p.x, p.wy, lift);
  else drawScaled(w.spr, 0, p.x, p.wy, lift + 10, { rot: -0.55, len: 88, flash: p.hitT > 0 ? 0.5 : p.state === 'launch' ? 0.7 : 0 });
}
function drawDrop(d) {
  const w = WEAPONS[Math.min(d.tier, WEAPON_MAX)];
  glowAt(d.x, d.wy, 2, 40, 18, '255,215,80', 0.55 + 0.25 * Math.sin(S.t * 8));
  P(d.x, d.wy);
  if (d.state === 'wait' || d.state === 'slide') {
    const bw = 26 * PK * U, top = PY - 170 * PK * U, gr = ctx.createLinearGradient(0, top, 0, PY);
    gr.addColorStop(0, 'rgba(255,220,90,0)'); gr.addColorStop(1, 'rgba(255,220,90,0.5)');
    ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = gr; ctx.fillRect(PX - bw / 2, top, bw, PY - top); ctx.globalCompositeOperation = 'source-over';
  }
  const lift = d.h + 10 + (d.state === 'wait' ? Math.sin(S.t * 5) * 3 : 0);
  if (d.tier > WEAPON_MAX) blit('crate', 0, d.x, d.wy, lift);
  else drawScaled(w.spr, 0, d.x, d.wy, lift, { rot: -0.3 + Math.sin(S.t * 3) * 0.08, len: 76 });
}
function drawPickup(p) {
  const bob = Math.sin(S.t * 5 + p.x) * 3;
  glowAt(p.x, p.wy, 4, 30, 14, p.kind === 'crate' ? '140,230,255' : '255,220,90', 0.6);
  blit(p.kind === 'crate' ? 'crate' : 'part', 0, p.x, p.wy, 6 + bob);
}
function drawBoss(b) {
  const B = b.B;
  let key = B.spr;
  if (b.id === 0) { if (b.pose === 'charge') key = B.sprCharge; else if (b.pose === 'hit') key = B.sprHit; }
  else { if (b.phase === 2) key = B.sprP2; if (b.pose === 'throw') key = B.sprThrow; }
  if (!SPR[key]) key = B.spr;
  const breathe = Math.sin(S.t * 3) * 0.02;
  P(b.x, b.wy);
  const sh = tintedGlow('0,0,0');
  ctx.globalAlpha = 0.5; ctx.drawImage(sh, PX - 60 * PK * U, PY - 18 * PK * U, 120 * PK * U, 36 * PK * U); ctx.globalAlpha = 1;
  const warn = b.id === 0 && b.state === 'warn';
  drawScaled(key, 0, b.x + (warn ? rnd(-1.5, 1.5) : 0), b.wy, 0, { sx: 1 - breathe * 0.5, sy: 1 + breathe, rot: b.state === 'charge' ? Math.sin(S.t * 30) * 0.04 : Math.sin(S.t * 1.4) * 0.015,
    flash: b.hitT > 0 ? 0.45 : warn ? 0.2 + 0.2 * Math.sin(S.t * 30) : 0 });
}
function drawProp(p) {
  const s = SPR[p.spr]; if (!s) return;
  blit(p.spr, 0, p.x, p.wy, 0, !!p.flip);
}

/* ---------- Efekty naziemne ---------- */
function laneQuad(l, wy0, wy1, pad) {
  const L = LANES[l];
  P(L.x0 + pad, wy0); const ax = PX, ay = PY; P(L.x1 - pad, wy0); const bx = PX;
  P(L.x1 - pad, wy1); const cx = PX, cy = PY; P(L.x0 + pad, wy1); const dx = PX;
  ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, ay); ctx.lineTo(cx, cy); ctx.lineTo(dx, cy); ctx.closePath();
}
function drawGroundFx() {
  if (S.warn) {
    const a = 0.22 + 0.2 * Math.abs(Math.sin(S.t * 12));
    laneQuad(S.warn.lane, -40, S.boss ? S.boss.wy : G.topWy, 4);
    ctx.fillStyle = `rgba(255,40,24,${a})`; ctx.fill();
    ctx.lineWidth = 3 * U; ctx.strokeStyle = `rgba(255,90,60,${a + 0.3})`; ctx.stroke();
    // Strzałki w dół pasa.
    const L = LANES[S.warn.lane];
    for (let wy = 60; wy < (S.boss ? S.boss.wy - 40 : 800); wy += 110) {
      const ph = (S.t * 300) % 110;
      P(L.cx, wy - ph + 110); const x = PX, y = PY, s = 18 * PK * U;
      ctx.fillStyle = `rgba(255,220,200,${a + 0.2})`;
      ctx.beginPath(); ctx.moveTo(x - s, y - s * 0.6); ctx.lineTo(x, y + s * 0.2); ctx.lineTo(x + s, y - s * 0.6); ctx.lineTo(x + s, y - s * 0.2); ctx.lineTo(x, y + s * 0.6); ctx.lineTo(x - s, y - s * 0.2); ctx.fill();
    }
  }
  for (const h of S.hazards) {
    const a = Math.min(1, h.life) * 0.85;
    const L = LANES[h.lane];
    P(L.cx, h.wy);
    const w = (L.x1 - L.x0 - 8) * kX(PY / U) * U, hh = 150 * DEPTH * U;
    ctx.globalAlpha = a;
    ctx.drawImage(vfx('acid'), PX - w / 2, PY - hh / 2, w, hh);
    ctx.globalAlpha = 1;
    ctx.fillStyle = `rgba(230,255,160,${a * 0.8})`;
    for (let i = 0; i < 5; i++) { const bx = PX + Math.sin(S.t * 3 + i * 2.1) * w * 0.35, by = PY + Math.cos(S.t * 2.3 + i) * hh * 0.3; ctx.beginPath(); ctx.arc(bx, by, (2 + (i % 3)) * U, 0, 7); ctx.fill(); }
  }
  for (const t of S.throws) {
    // Cel rzutu: pulsujący okrąg na ziemi.
    const f = t.t / t.dur;
    P(t.x1, t.wy1);
    ctx.strokeStyle = `rgba(200,255,90,${0.5 + 0.4 * f})`; ctx.lineWidth = 2.5 * U;
    ctx.beginPath(); ctx.ellipse(PX, PY, 40 * PK * U, 40 * DEPTH * PK * U, 0, 0, 7); ctx.stroke();
    ctx.fillStyle = `rgba(160,230,60,${0.25 * f})`; ctx.fill();
  }
}

/* ---------- Kolejka rysowania posortowana po głębi ---------- */
const RL = [];
for (let i = 0; i < 1200; i++) RL.push({ wy: 0, t: 0, o: null, i: 0 });
let rlN = 0;
function rl(wy, t, o, i = 0) { if (rlN >= RL.length) return; const e = RL[rlN++]; e.wy = wy; e.t = t; e.o = o; e.i = i; }
function drawEntities() {
  rlN = 0;
  for (const p of S.props) rl(p.wy, 0, p);
  for (const p of S.panels) rl(p.wy, 1, p);
  for (const o of S.obst) rl(o.wy, 2, o);
  if (S.ped) rl(S.ped.wy, 3, S.ped);
  if (S.drop) rl(S.drop.wy, 4, S.drop);
  for (const p of S.pickups) rl(p.wy, 5, p);
  for (const pk of S.packs) rl(pk.wy + 12, 6, pk);
  for (const z of S.zombies) rl(z.wy, 7, z);
  if (S.boss && S.boss.state !== 'dead') rl(S.boss.wy, 8, S.boss);
  const n = drawnN(S.n);
  for (let i = 0; i < n; i++) rl(FORM[i].dwy, 9, null, i);
  // Sortowanie przez wstawianie: kolejka jest prawie posortowana z poprzedniej klatki.
  for (let i = 1; i < rlN; i++) { const e = RL[i]; let j = i - 1; while (j >= 0 && RL[j].wy < e.wy) { RL[j + 1] = RL[j]; j--; } RL[j + 1] = e; }
  for (let i = 0; i < rlN; i++) {
    const e = RL[i];
    switch (e.t) {
      case 0: drawProp(e.o); break;
      case 1: drawPanel(e.o); break;
      case 2: drawObst(e.o); break;
      case 3: drawPed(e.o); break;
      case 4: drawDrop(e.o); break;
      case 5: drawPickup(e.o); break;
      case 6: drawPack(e.o); break;
      case 7: drawZombie(e.o); break;
      case 8: drawBoss(e.o); break;
      case 9: drawSoldier(e.i); break;
    }
  }
}

/* ---------- Pociski, błyski, cząsteczki ---------- */
function drawShots() {
  const w = WEAPONS[S.weapon];
  ctx.globalCompositeOperation = 'lighter';
  if (bulN) {
    ctx.lineCap = 'round';
    const flames = [];
    ctx.beginPath();
    for (let i = 0; i < bulN; i++) {
      const b = BUL[i];
      if (b.flame) { flames.push(b); continue; }
      // Smuga idzie wzdłuż toru pocisku (po łuku wachlarza też).
      const dw = Math.max(1, b.wy - b.pw), tail = Math.min(34, b.trav);
      P(b.x, b.wy); const x1 = PX, y1 = PY - 22 * PK * U;
      P(b.x - (b.x - (b.lx ?? b.x)) * tail / dw, b.wy - tail); ctx.moveTo(x1, y1); ctx.lineTo(PX, PY - 22 * PK * U);
    }
    ctx.strokeStyle = `rgba(${w.col},0.5)`; ctx.lineWidth = 4 * U; ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,235,0.95)'; ctx.lineWidth = 1.4 * U; ctx.stroke();
    const fire = vfx('fire');
    for (const b of flames) {
      const f = b.trav / b.range, r = (6 + f * 22) * U;
      P(b.x, b.wy); ctx.globalAlpha = Math.max(0, 0.85 - f * 0.7);
      ctx.drawImage(fire, PX - r, PY - 20 * PK * U - r, r * 2, r * 2);
    }
    ctx.globalAlpha = 1;
  }
  for (const f of FLASHES) {
    P(f.x, f.wy + 8);
    const s = (12 + f.f * 3) * PK * U, img = vfx('flash' + f.f);
    ctx.drawImage(img, PX - s, PY - 26 * PK * U - s, s * 2, s * 2);
  }
  ctx.globalCompositeOperation = 'source-over';
}
function drawParts() {
  // Najpierw zwykłe (krew, odłamki), potem świecące (iskry, kwas).
  for (let pass = 0; pass < 2; pass++) {
    if (pass) ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < partN; i++) {
      const p = PARTS[i];
      const glow = p.k === PK_SPARK || p.k === PK_RING || p.k === PK_GLOW;
      if (glow !== !!pass) continue;
      const a = Math.min(1, p.life / p.max * 2);
      if (p.k === PK_COIN) {
        P(p.x, p.wy); const s = 8 * PK * U;
        ctx.globalAlpha = a; ctx.drawImage(frameCache('coin', 0, 0, false, false).c, PX - s, PY - p.h * PK * U - s, s * 2, s * 2); ctx.globalAlpha = 1;
        continue;
      }
      if (p.k === PK_BODY) {
        const f = 1 - p.life / p.max;
        if (p.fi < 0) { drawScaled(p.img, 0, p.x, p.wy, 0, { alpha: 1 - f, sy: 1 - f * 0.5, flash: 0.3 }); continue; }
        const s = SPR[p.img]; if (!s) continue;
        P(p.x, p.wy);
        const c = frameCache(p.img, p.fi, varOf(PK), p.flip, f < 0.3);
        ctx.globalAlpha = 1 - f;
        ctx.drawImage(c.c, Math.round(PX - c.ax), Math.round(PY - c.ay + f * 6 * U));
        ctx.globalAlpha = 1;
        continue;
      }
      P(p.x, p.wy);
      const y = PY - p.h * PK * U;
      if (p.k === PK_PUFF || p.k === PK_GLOW) {
        ctx.fillStyle = p.col + (a * 0.5).toFixed(3) + ')';
        ctx.beginPath(); ctx.arc(PX, y, p.sz * PK * U, 0, 7); ctx.fill();
      } else if (p.k === PK_RING) {
        const f = 1 - p.life / p.max;
        ctx.strokeStyle = p.col + (1 - f).toFixed(3) + ')'; ctx.lineWidth = 3 * U;
        ctx.beginPath(); ctx.ellipse(PX, PY, p.sz * f * PK * U, p.sz * f * DEPTH * PK * U, 0, 0, 7); ctx.stroke();
      } else if (p.k === PK_SPARK) {
        ctx.strokeStyle = p.col; ctx.globalAlpha = a; ctx.lineWidth = p.sz * U;
        ctx.beginPath(); ctx.moveTo(PX, y); ctx.lineTo(PX - p.vx * 0.02 * U, y + p.vh * 0.02 * U); ctx.stroke(); ctx.globalAlpha = 1;
      } else {
        ctx.fillStyle = p.col; ctx.globalAlpha = a;
        const s = p.sz * PK * U;
        if (p.k === PK_SHARD) { ctx.save(); ctx.translate(PX, y); ctx.rotate(p.rot); ctx.fillRect(-s, -s * 0.5, s * 2, s); ctx.restore(); }
        else ctx.fillRect(PX - s / 2, y - s / 2, s, s);
        ctx.globalAlpha = 1;
      }
    }
  }
  ctx.globalCompositeOperation = 'source-over';
  // Pociski kwasu Kotła lecą łukiem.
  for (const t of S.throws) {
    const f = t.t / t.dur, x = lerp(t.x0, t.x1, f), wy = lerp(t.wy0, t.wy1, f), h = 70 + 260 * f * (1 - f) - 70 * f;
    P(x, wy); const r = 9 * PK * U;
    ctx.drawImage(vfx('acid'), PX - r * 1.6, PY - h * PK * U - r * 1.6, r * 3.2, r * 3.2);
  }
}

/* ---------- Noc, mgła, winieta ---------- */
let vig = null, fog = null;
function drawAtmosphere() {
  const toxic = S.L.theme === 'toxic';
  if (toxic) {
    // Noc w strefie przemysłowej: przyciemnienie i plamy światła sodowego z latarni.
    ctx.globalCompositeOperation = 'multiply';
    ctx.fillStyle = 'rgb(92,104,150)'; ctx.fillRect(0, 0, cv.width, cv.height);
    ctx.globalCompositeOperation = 'lighter';
    const g = tintedGlow('255,150,60');
    for (const p of S.props) if (p.lamp) { P(p.x < 200 ? p.x + 40 : p.x - 40, p.wy); const r = 120 * PK * U; ctx.globalAlpha = 0.55; ctx.drawImage(g, PX - r, PY - r * 0.55, r * 2, r * 1.1); }
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  }
  if (!fog) {
    fog = mkCanvas(4, Math.round(G.LH * 0.12 * U));
    const g = fog.getContext('2d'), gr = g.createLinearGradient(0, 0, 0, fog.height);
    const c = toxic ? '150,170,150' : '236,196,140';
    gr.addColorStop(0, `rgba(${c},0.35)`); gr.addColorStop(1, `rgba(${c},0)`);
    g.fillStyle = gr; g.fillRect(0, 0, 4, fog.height); fog.theme = S.L.theme;
  }
  if (fog.theme !== S.L.theme) { fog = null; return drawAtmosphere(); }
  ctx.drawImage(fog, 0, 0, cv.width, fog.height);
  if (!vig) {
    vig = mkCanvas(cv.width / 2, cv.height / 2);
    const g = vig.getContext('2d'), gr = g.createRadialGradient(vig.width / 2, vig.height * 0.6, vig.height * 0.3, vig.width / 2, vig.height * 0.55, vig.height * 0.85);
    gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(30,12,0,0.45)');
    g.fillStyle = gr; g.fillRect(0, 0, vig.width, vig.height);
  }
  ctx.drawImage(vig, 0, 0, cv.width, cv.height);
}

/* ---------- Liczby i plakietki ---------- */
function plaque(x, y, str, bg, size) {
  const a = glyphSet('w', nearSize(size));
  let tw = 0; for (const ch of str) { const m = a.map[ch]; if (m) tw += m.adv; }
  const w = tw + 16 * U, h = size * 1.25 * U;
  ctx.fillStyle = bg; rrect(ctx, x - w / 2, y - h / 2, w, h, h * 0.35); ctx.fill();
  ctx.beginPath(); ctx.moveTo(x - 5 * U, y + h / 2 - 1); ctx.lineTo(x + 5 * U, y + h / 2 - 1); ctx.lineTo(x, y + h / 2 + 6 * U); ctx.fill();
  drawNum(ctx, str, 'w', size, x, y + U);
}
function drawNumbers() {
  const numTop = G.topWy - 150;   // liczby pojawiają się, gdy obiekt wyjedzie spod HUD
  for (const p of S.panels) {
    if (p.taken || p.wy > numTop) continue;
    P(p.x, p.wy);
    const v = Math.floor(p.v), txt = p.mul && v > 0 ? '×' + p.mul : (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v);
    drawNum(ctx, txt, 'w', 30 * PK, PX, PY - PANEL_H * 0.55 * PK * U);
  }
  for (const o of S.obst) { if (o.wy > numTop) continue; P(o.x, o.wy); drawNum(ctx, String(Math.max(0, Math.ceil(o.hp))), 'w', 18 * PK, PX, PY - (o.h + 10) * PK * U); }
  const ped = S.ped;
  if (ped && ped.state !== 'empty' && ped.state !== 'appear') {
    P(ped.x, ped.wy);
    const y = PY - 104 * PK * U, bw = 64 * PK * U, bh = 9 * PK * U, f = ped.pts / ped.need;
    ctx.fillStyle = 'rgba(16,10,6,0.82)'; rrect(ctx, PX - bw / 2 - 3 * U, y - bh / 2 - 3 * U, bw + 6 * U, bh + 6 * U, 6 * U); ctx.fill();
    ctx.fillStyle = ped.tier > WEAPON_MAX ? '#7dffa8' : '#6ff3ff'; rrect(ctx, PX - bw / 2, y - bh / 2, Math.max(bh, bw * f), bh, bh / 2); ctx.fill();
    drawNum(ctx, ped.pts + '/' + ped.need, 'w', 16 * PK, PX, y - 16 * PK * U);
  }
  for (const p of S.pickups) if (p.kind === 'crate') { P(p.x, p.wy); drawNum(ctx, '+' + p.val, 'b', 20 * PK, PX, PY - 48 * PK * U); }
  const d = S.drop;
  if (d && d.state === 'wait') { P(d.x, d.wy); drawWord(ctx, 'ZŁAP!', 'y', 16, PX, PY - (d.h + 56) * PK * U - Math.abs(Math.sin(S.t * 5)) * 4 * U); }
  // Czerwona plakietka nad czołem każdej fali.
  for (const wv of S.waves) {
    if (wv.front > G.topWy - 30 || wv.front < 40 || wv.alive <= 0) continue;
    P(wv.fx ?? LW / 2, wv.front);
    plaque(PX, PY - 50 * PK * U, String(wv.alive), 'rgba(196,30,20,0.92)', 18);
  }
  if (S.n > 0) { P(S.sx, 0); plaque(PX, PY - 56 * U, String(S.n), 'rgba(24,110,190,0.95)', 24); }
  for (let i = 0; i < floatN; i++) {
    const f = FLOATS[i];
    P(f.x, f.wy);
    const a = Math.min(1, f.life / f.max * 2.2), y = PY - f.h * PK * U;
    if (f.num) drawNum(ctx, f.txt, f.st, f.sz, PX, y, a); else drawWord(ctx, f.txt, f.st, f.sz, PX, y, a);
  }
}

/* ---------- Klatka ---------- */
function draw() {
  ensureRing();
  let ox = 0, oy = 0;
  if (shakeT > 0 && !REDUCED) { const a = shakeA * (shakeT / shakeD) * U; ox = Math.round(rnd(-a, a)); oy = Math.round(rnd(-a, a)); }
  ctx.setTransform(1, 0, 0, 1, ox, oy);
  drawGround();
  drawGroundFx();
  drawEntities();
  if (S.L.theme === 'toxic') drawAtmosphere();
  drawShots();
  drawParts();
  if (S.L.theme !== 'toxic') drawAtmosphere();
  drawNumbers();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  if (whiteT > 0) { ctx.fillStyle = `rgba(255,255,255,${Math.min(0.6, whiteT * 4)})`; ctx.fillRect(0, 0, cv.width, cv.height); }
}
