// KWFoto · Black Week: cały film rysowany na <canvas>.
// draw(t) jest czystą funkcją czasu, więc ta sama sekunda daje zawsze tę samą klatkę
// (podgląd i render klatka po klatce wyglądają identycznie).
(function () {
  'use strict';
  const C = window.KW_CONFIG;
  const T = C.timeline;
  const TAU = Math.PI * 2;

  // ---------------------------------------------------------------- matematyka
  const clamp = (v, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
  const seg = (t, a, b) => clamp((t - a) / (b - a));
  const lerp = (a, b, k) => a + (b - a) * k;
  const E = {
    outCubic: (k) => 1 - (1 - k) ** 3,
    inCubic: (k) => k * k * k,
    inOutCubic: (k) => (k < 0.5 ? 4 * k * k * k : 1 - (-2 * k + 2) ** 3 / 2),
    outExpo: (k) => (k >= 1 ? 1 : 1 - 2 ** (-10 * k)),
    inExpo: (k) => (k <= 0 ? 0 : 2 ** (10 * k - 10)),
    outQuint: (k) => 1 - (1 - k) ** 5,
    outBack: (k, s = 1.9) => 1 + (s + 1) * (k - 1) ** 3 + s * (k - 1) ** 2,
  };
  const pulse = (t, t0, k) => (t >= t0 ? Math.exp(-(t - t0) * k) : 0);
  function hash(a, b = 0, c = 0) {
    let h = Math.imul((a | 0) ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul((b | 0) + 0x632be5ab, 0xc2b2ae35) ^ Math.imul((c | 0) + 0x27d4eb2f, 0x165667b1);
    h ^= h >>> 15; h = Math.imul(h, 0x2c1b3c6d); h ^= h >>> 12; h = Math.imul(h, 0x297a2d39); h ^= h >>> 15;
    return (h >>> 0) / 4294967296;
  }
  // Interpolacja między kluczami [czas, wartość] z łagodnym wejściem i wyjściem.
  function keys(arr, t) {
    if (t <= arr[0][0]) return arr[0][1];
    for (let i = 1; i < arr.length; i++) {
      if (t <= arr[i][0]) return lerp(arr[i - 1][1], arr[i][1], E.inOutCubic(seg(t, arr[i - 1][0], arr[i][0])));
    }
    return arr[arr.length - 1][1];
  }
  const fmt = (n) => Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  const disc = (p) => Math.round((p * (100 - C.discount)) / 100);
  const ITEMS = C.items.slice(0, 5);
  const SUM = ITEMS.reduce((s, it) => s + it.price, 0);
  const SUM_NEW = ITEMS.reduce((s, it) => s + disc(it.price), 0);

  function hex(c) { const n = parseInt(c.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
  function mix(a, b, k) {
    const A = hex(a), B = hex(b);
    return `rgb(${A.map((v, i) => Math.round(lerp(v, B[i], clamp(k)))).join(',')})`;
  }

  // ---------------------------------------------------------------- kolory i fonty
  const LIGHT = { bg: '#F5F3EF', surf: '#FFFFFF', surf2: '#ECE8E2', ink: '#14171B', muted: '#6B7179', line: '#DDD8D0', accent: '#C4302B', chrome: '#E6E2DB', chromeInk: '#4A4F55', pill: '#FFFFFF', card: '#14171B', cardInk: '#F5F3EF', cardMuted: '#8C939B' };
  const DARK = { bg: '#0B0C0E', surf: '#141619', surf2: '#1C1F23', ink: '#EEF0F2', muted: '#848C96', line: '#262A30', accent: '#FF3B2F', chrome: '#151719', chromeInk: '#9AA2AB', pill: '#202328', card: '#16181C', cardInk: '#EEF0F2', cardMuted: '#7D858F' };
  const RED = '#FF3B2F';
  const RED_DEEP = '#C4302B';
  const FAM = { sans: 'Archivo', serif: '"Source Serif 4"', mono: '"JetBrains Mono"' };

  function font(c, size, o = {}) {
    c.font = `${o.it ? 'italic ' : ''}${o.w || 400} ${size}px ${FAM[o.fam || 'sans']}`;
    c.fontStretch = o.st || 'normal';
    c.letterSpacing = (o.ls || 0) + 'px';
  }
  function text(c, s, x, y, size, o = {}) {
    font(c, size, o);
    c.fillStyle = o.color || '#000';
    c.textAlign = o.align || 'left';
    c.textBaseline = o.base || 'alphabetic';
    c.fillText(s, x, y);
  }
  function measure(c, s, size, o = {}) { font(c, size, o); return c.measureText(s).width; }
  const fitCache = new Map();
  function fit(c, s, maxW, o = {}) {
    const key = s + JSON.stringify(o) + maxW;
    if (!fitCache.has(key)) fitCache.set(key, (100 * maxW) / measure(c, s, 100, o));
    return fitCache.get(key);
  }
  function rr(c, x, y, w, h, r) { c.beginPath(); c.roundRect(x, y, w, h, r); }
  function arrow(c, x, y, s, col, lw) {
    c.save(); c.strokeStyle = col; c.lineWidth = lw || s * 0.16; c.lineCap = 'round'; c.lineJoin = 'round';
    c.beginPath(); c.moveTo(x - s * 0.5, y); c.lineTo(x + s * 0.5, y); c.moveTo(x + s * 0.12, y - s * 0.38); c.lineTo(x + s * 0.5, y); c.lineTo(x + s * 0.12, y + s * 0.38); c.stroke(); c.restore();
  }

  // ---------------------------------------------------------------- stan
  let W, H, V, cv, ctx, S, sx, P, px, Q, qx, grainPat, scanPat, vignette, L;
  const photo = {};
  let logoImg = null;

  function mk(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }

  // ---------------------------------------------------------------- zdjęcia zastępcze
  // Gdy w assets/ nie ma prawdziwych zdjęć, film rysuje własne kadry (para o zachodzie,
  // nocne światła, jezioro o świcie).
  function couple(c, x, y, s, col, rim) {
    c.save(); c.translate(x, y); c.scale(s, s);
    if (rim) { c.shadowColor = rim; c.shadowBlur = 26; }
    c.fillStyle = col; c.strokeStyle = col;
    c.beginPath(); c.arc(0.08, -0.905, 0.062, 0, TAU); c.fill();
    c.beginPath();
    c.moveTo(0.03, -0.82); c.quadraticCurveTo(0.11, -0.86, 0.19, -0.8);
    c.lineTo(0.205, -0.56); c.lineTo(0.185, -0.47); c.lineTo(0.195, 0); c.lineTo(0.13, 0); c.lineTo(0.118, -0.36);
    c.lineTo(0.098, 0); c.lineTo(0.036, 0); c.lineTo(0.05, -0.47); c.lineTo(0.02, -0.6); c.closePath(); c.fill();
    c.lineWidth = 0.05; c.lineCap = 'round';
    c.beginPath(); c.moveTo(0.05, -0.76); c.quadraticCurveTo(-0.02, -0.66, -0.07, -0.56); c.stroke();
    c.beginPath(); c.arc(-0.045, -0.835, 0.056, 0, TAU); c.fill();
    c.beginPath(); c.arc(-0.095, -0.855, 0.032, 0, TAU); c.fill();
    c.globalAlpha = 0.55;
    c.beginPath(); c.moveTo(-0.1, -0.87); c.bezierCurveTo(-0.3, -0.8, -0.38, -0.5, -0.52, -0.3); c.bezierCurveTo(-0.36, -0.42, -0.22, -0.6, -0.11, -0.72); c.closePath(); c.fill();
    c.globalAlpha = 1;
    c.beginPath(); c.moveTo(-0.115, -0.77); c.lineTo(0.005, -0.77); c.lineTo(-0.02, -0.52); c.lineTo(-0.085, -0.52); c.closePath(); c.fill();
    c.beginPath(); c.moveTo(-0.085, -0.53); c.lineTo(-0.02, -0.53); c.bezierCurveTo(0.03, -0.3, 0.09, -0.1, 0.1, 0);
    c.lineTo(-0.36, 0); c.bezierCurveTo(-0.25, -0.12, -0.14, -0.3, -0.085, -0.53); c.fill();
    c.restore();
  }
  function ridge(c, w, base, amp, seed, col, rough) {
    c.fillStyle = col; c.beginPath(); c.moveTo(0, c.canvas.height);
    for (let x = 0; x <= w; x += 8) {
      const k = x / w;
      let y = base - amp * (0.55 * Math.sin(k * 5.1 + seed) + 0.3 * Math.sin(k * 11.7 + seed * 2.1) + 0.15 * Math.sin(k * 23 + seed * 3.3));
      if (rough) y -= amp * 0.5 * Math.abs(Math.sin(k * 9 + seed)) ** 3;
      c.lineTo(x, y);
    }
    c.lineTo(w, c.canvas.height); c.closePath(); c.fill();
  }
  function photoGolden(w, h) {
    const cc = mk(w, h), c = cc.getContext('2d');
    let g = c.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#1d1a33'); g.addColorStop(0.32, '#5b2f52'); g.addColorStop(0.52, '#c8574a'); g.addColorStop(0.66, '#f2a35e'); g.addColorStop(0.74, '#ffd89c');
    c.fillStyle = g; c.fillRect(0, 0, w, h);
    const sx0 = w * 0.55, sy0 = h * 0.7;
    g = c.createRadialGradient(sx0, sy0, 0, sx0, sy0, h * 0.75);
    g.addColorStop(0, 'rgba(255,226,170,0.95)'); g.addColorStop(0.25, 'rgba(255,170,100,0.45)'); g.addColorStop(1, 'rgba(255,120,80,0)');
    c.fillStyle = g; c.fillRect(0, 0, w, h);
    c.fillStyle = '#fff4dc'; c.beginPath(); c.arc(sx0, sy0, h * 0.045, 0, TAU); c.fill();
    ridge(c, w, h * 0.72, h * 0.05, 1.3, 'rgba(122,58,74,0.85)');
    ridge(c, w, h * 0.79, h * 0.035, 4.2, '#3a1c28');
    c.fillStyle = '#1a0c12'; c.fillRect(0, h * 0.83, w, h);
    couple(c, w * 0.5, h * 0.86, h * 0.44, '#12080c', 'rgba(255,170,90,0.95)');
    for (let i = 0; i < 520; i++) {
      const x = hash(i, 1) * w, hh = h * (0.06 + 0.16 * hash(i, 2)), lean = (hash(i, 3) - 0.5) * hh * 0.5;
      c.strokeStyle = hash(i, 4) < 0.18 ? 'rgba(255,170,100,0.55)' : '#12080c'; c.lineWidth = 1 + hash(i, 5) * 2.4;
      c.beginPath(); c.moveTo(x, h); c.quadraticCurveTo(x + lean * 0.3, h - hh * 0.6, x + lean, h - hh); c.stroke();
    }
    c.globalCompositeOperation = 'screen';
    for (let i = 0; i < 5; i++) {
      const k = 0.25 + i * 0.22, fx = lerp(sx0, w * 0.15, k), fy = lerp(sy0, h * 0.25, k), r = h * (0.03 + 0.05 * hash(i, 9));
      g = c.createRadialGradient(fx, fy, 0, fx, fy, r); g.addColorStop(0, 'rgba(255,200,140,0.25)'); g.addColorStop(1, 'rgba(255,200,140,0)');
      c.fillStyle = g; c.fillRect(fx - r, fy - r, r * 2, r * 2);
    }
    g = c.createLinearGradient(0, 0, w, 0); g.addColorStop(0, 'rgba(255,90,60,0.25)'); g.addColorStop(0.3, 'rgba(255,90,60,0)');
    c.fillStyle = g; c.fillRect(0, 0, w, h);
    return cc;
  }
  function photoNight(w, h) {
    const cc = mk(w, h), c = cc.getContext('2d');
    let g = c.createRadialGradient(w * 0.5, h * 0.45, 0, w * 0.5, h * 0.45, w * 0.7);
    g.addColorStop(0, '#4a4a4a'); g.addColorStop(0.6, '#141414'); g.addColorStop(1, '#030303');
    c.fillStyle = g; c.fillRect(0, 0, w, h);
    for (let i = 0; i < 90; i++) {
      const x = hash(i, 11) * w, y = hash(i, 12) * h * 0.8, r = 8 + hash(i, 13) * 46, a = 0.05 + hash(i, 14) * 0.22;
      g = c.createRadialGradient(x, y, r * 0.6, x, y, r); g.addColorStop(0, `rgba(255,255,255,${a})`); g.addColorStop(1, 'rgba(255,255,255,0)');
      c.fillStyle = g; c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill();
    }
    for (let s = 0; s < 3; s++) {
      const y0 = h * (0.08 + s * 0.09);
      for (let i = 0; i <= 40; i++) {
        const k = i / 40, x = k * w, y = y0 + Math.sin(k * Math.PI) * h * 0.08;
        g = c.createRadialGradient(x, y, 0, x, y, 14); g.addColorStop(0, 'rgba(255,255,255,0.9)'); g.addColorStop(1, 'rgba(255,255,255,0)');
        c.fillStyle = g; c.fillRect(x - 14, y - 14, 28, 28);
      }
    }
    c.save(); c.translate(w * 0.5, h * 0.36); c.scale(h * 0.0024, h * 0.0024);
    c.strokeStyle = 'rgba(255,255,255,0.95)'; c.lineWidth = 3.2; c.shadowColor = '#fff'; c.shadowBlur = 24; c.lineCap = 'round';
    c.beginPath();
    for (let i = 0; i <= 200; i++) {
      const a = (i / 200) * TAU, x = 16 * Math.sin(a) ** 3, y = -(13 * Math.cos(a) - 5 * Math.cos(2 * a) - 2 * Math.cos(3 * a) - Math.cos(4 * a));
      const j = (hash(i, 77) - 0.5) * 0.9;
      if (i === 0) c.moveTo(x * 6 + j, y * 6 + j); else c.lineTo(x * 6 + j, y * 6 + j);
    }
    c.stroke(); c.restore();
    couple(c, w * 0.5, h * 0.98, h * 0.58, '#050505', 'rgba(255,255,255,0.55)');
    return cc;
  }
  function photoLake(w, h) {
    const cc = mk(w, h), c = cc.getContext('2d');
    let g = c.createLinearGradient(0, 0, 0, h * 0.6);
    g.addColorStop(0, '#0f1d2e'); g.addColorStop(0.55, '#3c566e'); g.addColorStop(1, '#e2bfa2');
    c.fillStyle = g; c.fillRect(0, 0, w, h);
    const hz = h * 0.6;
    ridge(c, w, hz - h * 0.12, h * 0.16, 2.0, '#4a5d73', true);
    ridge(c, w, hz - h * 0.05, h * 0.1, 5.5, '#2b3a4c', true);
    ridge(c, w, hz, h * 0.04, 8.1, '#18222e');
    c.save(); c.translate(0, hz * 2); c.scale(1, -1); c.globalAlpha = 0.45; c.drawImage(cc, 0, 0, w, hz, 0, 0, w, hz); c.restore();
    g = c.createLinearGradient(0, hz, 0, h); g.addColorStop(0, 'rgba(20,32,46,0.35)'); g.addColorStop(1, 'rgba(8,14,22,0.92)');
    c.fillStyle = g; c.fillRect(0, hz, w, h - hz);
    for (let i = 0; i < 140; i++) {
      const y = hz + hash(i, 21) * (h - hz), x = hash(i, 22) * w, ww = 30 + hash(i, 23) * 220;
      c.fillStyle = `rgba(230,200,170,${0.04 + 0.1 * hash(i, 24)})`; c.fillRect(x, y, ww, 1.5);
    }
    c.filter = 'blur(30px)'; c.fillStyle = 'rgba(235,225,215,0.22)';
    c.fillRect(-50, hz - h * 0.05, w + 100, h * 0.07); c.fillRect(-50, hz + h * 0.05, w + 100, h * 0.04);
    c.filter = 'none';
    c.fillStyle = '#0b1219'; c.beginPath(); c.moveTo(w * 0.46, h); c.lineTo(w * 0.495, hz + h * 0.1); c.lineTo(w * 0.505, hz + h * 0.1); c.lineTo(w * 0.54, h); c.fill();
    couple(c, w * 0.5, hz + h * 0.1, h * 0.12, '#0b1219', 'rgba(255,220,190,0.6)');
    return cc;
  }
  function loadImg(url) {
    return new Promise((res) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = url; });
  }
  // Kadrowanie „cover” z powolnym najazdem.
  function cover(c, img, x, y, w, h, zoom = 1, ox = 0, oy = 0) {
    const iw = img.width, ih = img.height, s = Math.max(w / iw, h / ih) * zoom;
    const dw = iw * s, dh = ih * s;
    c.drawImage(img, x + (w - dw) / 2 + ox * (dw - w) / 2, y + (h - dh) / 2 + oy * (dh - h) / 2, dw, dh);
  }

  // ---------------------------------------------------------------- układ
  function layout() {
    const l = V
      ? { bx: 64, by: 196, bw: 952, bh: 1430, chrome: 118, r: 48, nav: 124, pad: 46 }
      : { bx: 150, by: 84, bw: 1620, bh: 912, chrome: 62, r: 18, nav: 86, pad: 76 };
    l.cx = l.bx; l.cy = l.by + l.chrome; l.cw = l.bw; l.ch = l.bh - l.chrome;
    // Nawigacja (współrzędne strony).
    if (V) {
      const pw = measure(ctx, 'Kalkulator', 30, { w: 600 }) + 56;
      l.navPill = { x: l.cw - l.pad - 64 - pw, y: l.nav / 2 - 34, w: pw, h: 68 };
      l.navCalc = { x: l.navPill.x + pw / 2, y: l.nav / 2 };
    } else {
      let x = l.cw - l.pad;
      l.navItems = [];
      for (let i = C.nav.length - 1; i >= 0; i--) {
        const w = measure(ctx, C.nav[i], 19, { w: 500 });
        x -= w; l.navItems[i] = { x, w }; x -= 42;
      }
      const k = C.nav.indexOf('Kalkulator');
      l.navCalc = { x: l.navItems[k].x + l.navItems[k].w / 2, y: l.nav / 2 };
    }
    // Kalkulator: P0 to początek sekcji na stronie (jeden ekran niżej).
    l.P0 = l.ch;
    if (V) {
      l.rowX0 = l.pad; l.rowX1 = l.cw - l.pad; l.rowY = 318; l.rowH = 116;
      l.card = { x: l.pad, y: l.rowY + 5 * l.rowH + 30, w: l.cw - 2 * l.pad, h: 338 };
      l.btn = { x: l.card.x + 30, y: l.card.y + l.card.h - 30 - 92, w: l.card.w - 60, h: 92 };
      l.stampR = 118;
      l.stamp = { x: l.card.x + l.card.w - 92, y: l.card.y - 16 };
    } else {
      l.rowX0 = l.pad; l.rowX1 = l.cw * 0.585; l.rowY = 276; l.rowH = 96;
      l.card = { x: l.cw * 0.64, y: l.rowY, w: l.cw * 0.36 - l.pad, h: 5 * l.rowH };
      l.btn = { x: l.card.x + 30, y: l.card.y + l.card.h - 30 - 74, w: l.card.w - 60, h: 74 };
      l.stampR = 96;
      l.stamp = { x: l.card.x + l.card.w - 26, y: l.card.y + 6 };
    }
    l.toggle = (i) => ({ x: l.rowX0 + (V ? 38 : 32), y: l.rowY + i * l.rowH + l.rowH / 2 });
    // Punkty w świecie (ekran przed kamerą) dla kursora i kamery.
    l.w = (x, y, scroll) => ({ x: l.cx + x, y: l.cy + y - scroll });
    return l;
  }

  // ---------------------------------------------------------------- przebieg zdarzeń
  function scrollAt(t) { return E.inOutCubic(seg(t, T.scroll[0], T.scroll[1])) * L.ch; }
  const isDark = (t) => t >= T.meltdown[1];

  function cursorPath() {
    const nav = L.w(L.navCalc.x, L.navCalc.y, 0);
    const tg = T.toggles.map((tt, i) => { const p = L.toggle(i); return L.w(p.x, p.y, 0); });
    const b = L.w(L.btn.x + L.btn.w * 0.5, L.btn.y + L.btn.h * 0.55, 0);
    const pts = [[1.05, W * 0.82, H + 60], [1.86, nav.x, nav.y], [2.04, nav.x, nav.y], [2.3, nav.x - 40, nav.y + 260]];
    T.toggles.forEach((tt, i) => pts.push([tt - 0.06, tg[i].x, tg[i].y], [tt + 0.05, tg[i].x, tg[i].y]));
    pts.push([3.88, b.x, b.y], [6.0, b.x, b.y]);
    return pts;
  }
  let CP;
  function cursorAt(t) {
    const p = CP;
    if (t <= p[0][0]) return { x: p[0][1], y: p[0][2] };
    for (let i = 1; i < p.length; i++) {
      if (t <= p[i][0]) {
        const k = E.inOutCubic(seg(t, p[i - 1][0], p[i][0]));
        return { x: lerp(p[i - 1][1], p[i][1], k), y: lerp(p[i - 1][2], p[i][2], k) };
      }
    }
    return { x: p[p.length - 1][1], y: p[p.length - 1][2] };
  }
  const CLICKS = () => [T.navClick, ...T.toggles, T.calcClick];

  function glitchAt(t) {
    let g = 0.45 * pulse(t, T.firstGlitch, 18);
    if (t >= T.errors[0] && t < T.meltdown[0]) g += lerp(0.1, 0.5, seg(t, T.errors[0], T.meltdown[0]));
    for (const e of T.errors) g += 0.45 * pulse(t, e, 22);
    if (t >= T.meltdown[0] && t < T.meltdown[1]) g = 1;
    g += 0.6 * pulse(t, T.reboot, 14);
    for (const d of T.drops) g += 0.28 * pulse(t, d, 26);
    g += 0.5 * pulse(t, T.stamp, 20);
    for (const b of [T.black, T.week, T.marquee, T.flip, T.percent, ...T.cuts, T.fall]) g += 0.3 * pulse(t, b, 24);
    g += 0.55 * pulse(t, T.end, 16);
    g += 0.65 * pulse(t, T.outroGlitch, 14) + 0.4 * pulse(t, T.outroGlitch + 0.1, 20);
    return clamp(g);
  }

  // ---------------------------------------------------------------- tło za oknem
  function backdrop(c, t, dark) {
    const g = c.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, dark ? '#060607' : '#121418'); g.addColorStop(1, dark ? '#0d0606' : '#07080a');
    c.fillStyle = g; c.fillRect(0, 0, W, H);
    const rg = c.createRadialGradient(W * 0.5, H * 0.55, 0, W * 0.5, H * 0.55, Math.max(W, H) * 0.6);
    rg.addColorStop(0, dark ? 'rgba(255,40,30,0.22)' : 'rgba(196,48,43,0.14)'); rg.addColorStop(1, 'rgba(196,48,43,0)');
    c.fillStyle = rg; c.fillRect(0, 0, W, H);
    // Ogromny napis w tle, który przesuwa się wolniej niż kamera (paralaksa).
    c.save();
    const s = V ? 360 : 420;
    font(c, s, { w: 900, st: 'expanded' }); c.textBaseline = 'middle'; c.textAlign = 'left';
    c.strokeStyle = dark ? 'rgba(255,59,47,0.16)' : 'rgba(255,255,255,0.05)'; c.lineWidth = 2;
    const word = dark ? 'BLACK WEEK  ' : 'KWFOTO  ';
    const ww = c.measureText(word).width, off = -((t * (V ? 160 : 220)) % ww);
    for (let row = 0; row < (V ? 6 : 3); row++) {
      const y = (V ? 120 : 140) + row * s * 0.86, o = row % 2 ? -ww * 0.5 - off * 0.6 : off;
      for (let x = o - ww; x < W + ww; x += ww) c.strokeText(word, x, y);
    }
    c.restore();
  }

  // ---------------------------------------------------------------- strona KWFoto
  function logo(c, x, y, size, ink, accent, align = 'left') {
    font(c, size, { w: 900, st: 'expanded' });
    const a = c.measureText('KW').width;
    font(c, size * 1.06, { w: 400, fam: 'serif', it: true });
    const b = c.measureText('Foto').width;
    const total = a + size * 0.06 + b + size * 0.32;
    let x0 = align === 'center' ? x - total / 2 : x;
    if (logoImg) { const h = size * 1.1; c.drawImage(logoImg, x0, y - h * 0.8, (logoImg.width / logoImg.height) * h, h); return total; }
    text(c, 'KW', x0, y, size, { w: 900, st: 'expanded', color: ink });
    text(c, 'Foto', x0 + a + size * 0.06, y, size * 1.06, { w: 400, fam: 'serif', it: true, color: ink });
    c.fillStyle = accent; c.beginPath(); c.arc(x0 + a + size * 0.06 + b + size * 0.18, y - size * 0.08, size * 0.11, 0, TAU); c.fill();
    return total;
  }
  function toggle(c, x, y, k, pal) {
    const w = V ? 76 : 60, h = V ? 42 : 34;
    rr(c, x - w / 2, y - h / 2, w, h, h / 2); c.fillStyle = mix(pal.line, pal.accent, k); c.fill();
    const kx = lerp(x - w / 2 + h / 2, x + w / 2 - h / 2, E.outBack(k, 2.4));
    c.save(); c.shadowColor = 'rgba(0,0,0,0.25)'; c.shadowBlur = 6; c.shadowOffsetY = 2;
    c.fillStyle = '#fff'; c.beginPath(); c.arc(kx, y, h / 2 - 4, 0, TAU); c.fill(); c.restore();
  }
  // Licznik jak w liczydle: każda cyfra przewija się osobno.
  function odometer(c, value, xR, y, size, o) {
    font(c, size, o);
    const dw = c.measureText('0').width, gap = size * 0.24, lh = size * 1.05;
    const digits = Math.max(1, Math.floor(Math.log10(Math.max(1, o.max || value))) + 1);
    let x = xR;
    c.save();
    c.beginPath(); c.rect(xR - digits * dw - 3 * gap - 20, y - size * 0.98, digits * dw + 3 * gap + 40, size * 1.2); c.clip();
    c.textAlign = 'left'; c.textBaseline = 'alphabetic'; c.fillStyle = o.color;
    for (let k = 0; k < digits; k++) {
      if (k > 0 && k % 3 === 0) x -= gap;
      x -= dw;
      const p = 10 ** k;
      if (k > 0 && value < p - 1) continue;
      const d = Math.floor(value / p) % 10;
      const frac = k === 0 ? value - Math.floor(value) : Math.max(0, (value % p) - (p - 1));
      if (o.scramble && hash(o.scramble, k) < o.scrambleP) {
        c.fillText('0123456789#%$@'[Math.floor(hash(o.scramble, k, 3) * 14)], x, y + (hash(o.scramble, k, 5) - 0.5) * size * 0.3);
        continue;
      }
      c.fillText(String(d), x, y - frac * lh);
      if (frac > 0) c.fillText(String((d + 1) % 10), x, y + (1 - frac) * lh);
    }
    c.restore();
    return xR - x;
  }
  function scramble(s, seed, p) {
    const pool = '0123456789#%$@█▓▒░/\\<>';
    return [...s].map((ch, i) => (ch !== ' ' && hash(seed, i) < p ? pool[Math.floor(hash(seed, i, 9) * pool.length)] : ch)).join('');
  }

  function drawNav(c, t, pal, dark) {
    c.fillStyle = pal.bg; c.fillRect(0, 0, L.cw, L.nav);
    c.fillStyle = pal.line; c.fillRect(0, L.nav - 1, L.cw, 1);
    const k0 = T.pageLoad;
    const kl = E.outCubic(seg(t, k0, k0 + 0.3));
    c.save(); c.globalAlpha = kl; c.translate(0, (1 - kl) * -20);
    logo(c, L.pad, L.nav / 2 + (V ? 13 : 10), V ? 40 : 30, pal.ink, pal.accent);
    c.restore();
    const hover = t >= 1.7 && t < 2.3 && !dark;
    if (V) {
      const p = L.navPill, k = E.outBack(seg(t, k0 + 0.1, k0 + 0.35));
      c.save(); c.translate(p.x + p.w / 2, p.y + p.h / 2); c.scale(k, k);
      rr(c, -p.w / 2, -p.h / 2, p.w, p.h, p.h / 2); c.fillStyle = hover || dark ? pal.accent : pal.ink; c.fill();
      text(c, 'Kalkulator', 0, 11, 30, { w: 600, color: '#fff', align: 'center' });
      c.restore();
      c.fillStyle = pal.ink;
      for (let i = 0; i < 3; i++) c.fillRect(L.cw - L.pad - 40, L.nav / 2 - 14 + i * 13, 40, 4);
    } else {
      C.nav.forEach((n, i) => {
        const it = L.navItems[i], k = E.outCubic(seg(t, k0 + 0.05 + i * 0.035, k0 + 0.3 + i * 0.035));
        const isCalc = n === 'Kalkulator';
        c.save(); c.globalAlpha = k; c.translate(0, (1 - k) * -16);
        const col = (isCalc && (hover || dark || t > 2.3)) ? pal.accent : pal.ink;
        text(c, n, it.x, L.nav / 2 + 7, 19, { w: 500, color: col });
        if (isCalc) {
          const u = Math.max(E.outCubic(seg(t, 1.75, 1.95)), t > 2.3 ? 1 : 0);
          c.fillStyle = pal.accent; c.fillRect(it.x, L.nav / 2 + 18, it.w * u, 2.5);
        }
        c.restore();
      });
    }
  }

  function drawHero(c, t, pal) {
    const k0 = T.pageLoad;
    const reveal = (a, d = 0.32) => E.outCubic(seg(t, k0 + a, k0 + a + d));
    // Zdjęcie z odsłonięciem przez czerwony pasek.
    const ph = V ? { x: L.pad, y: L.nav + 26, w: L.cw - 2 * L.pad, h: 620 } : { x: L.cw * 0.53, y: L.nav + 30, w: L.cw * 0.47 - 48, h: L.ch - L.nav - 78 };
    const kr = E.inOutCubic(seg(t, k0 + 0.02, k0 + 0.42));
    c.save(); rr(c, ph.x, ph.y, ph.w * kr, ph.h, 10); c.clip();
    cover(c, photo.golden, ph.x, ph.y, ph.w, ph.h, 1.18 - 0.1 * seg(t, 1, 2.4), 0.2, 0);
    c.restore();
    if (kr > 0 && kr < 1) { c.fillStyle = pal.accent; c.fillRect(ph.x + ph.w * kr - 8, ph.y, 8, ph.h); }

    const base = V ? ph.y + ph.h + 92 : 222;
    const lab = 'FOTOGRAF I FILMOWIEC ŚLUBNY · ' + C.city.split(' ')[0].toUpperCase();
    const masked = (k, y, h, fn) => { c.save(); c.beginPath(); c.rect(0, y - h, L.cw, h * 1.32); c.clip(); c.translate(0, (1 - k) * h * 1.1); fn(); c.restore(); };
    masked(reveal(0.08), base, 24, () => text(c, lab, L.pad, base, V ? 22 : 15, { w: 700, fam: 'mono', color: pal.accent, ls: 2 }));
    const hs = V ? 80 : 86, lh = hs * 1.08;
    C.headline.forEach((line, i) => {
      const y = base + (V ? 98 : 104) + i * lh;
      masked(reveal(0.12 + i * 0.07, 0.4), y, hs, () => text(c, line, L.pad - 3, y, hs, { w: 500, fam: 'serif', color: pal.ink, it: i === 1 }));
    });
    const ly = base + (V ? 98 : 104) + C.headline.length * lh - (V ? 24 : 30);
    const kl = reveal(0.26);
    c.save(); c.globalAlpha = kl; text(c, C.lead, L.pad, ly + (1 - kl) * 20, V ? 30 : 22, { color: pal.muted }); c.restore();
    const kb = E.outBack(seg(t, k0 + 0.32, k0 + 0.62));
    const bw = V ? L.cw - 2 * L.pad : 400, bh = V ? 96 : 66, by = ly + (V ? 44 : 34);
    c.save(); c.translate(L.pad + bw / 2, by + bh / 2); c.scale(kb, kb);
    rr(c, -bw / 2, -bh / 2, bw, bh, bh / 2); c.fillStyle = pal.ink; c.fill();
    text(c, 'Sprawdź cenę w kalkulatorze', -bw / 2 + (V ? 44 : 32), V ? 11 : 7, V ? 32 : 20, { w: 600, color: pal.bg });
    arrow(c, bw / 2 - (V ? 52 : 40), 0, V ? 30 : 22, pal.bg, V ? 4 : 3);
    c.restore();
  }

  function drawCalc(c, t, pal, dark) {
    const P0 = L.P0;
    const k0 = T.scroll[1] - 0.12;
    const reveal = (a) => E.outCubic(seg(t, k0 + a, k0 + a + 0.3));
    const g = glitchAt(t), gs = Math.floor(t * 30);
    const chaos = t >= T.errors[0] - 0.25 && t < T.meltdown[1];
    let ty = P0 + (V ? 196 : 158);
    if (dark) {
      // Pasek Black Week pod menu.
      const bh = V ? 64 : 44;
      c.fillStyle = pal.accent; c.fillRect(0, P0 + L.nav, L.cw, bh);
      c.save(); c.beginPath(); c.rect(0, P0 + L.nav, L.cw, bh); c.clip();
      const msg = `BLACK WEEK  ·  −${C.discount}% NA WSZYSTKO  ·  `;
      font(c, V ? 26 : 18, { w: 800, fam: 'mono', ls: 2 }); const mw = c.measureText(msg).width;
      for (let x = -((t * 260) % mw); x < L.cw; x += mw) text(c, msg, x, P0 + L.nav + bh / 2 + (V ? 9 : 6), V ? 26 : 18, { w: 800, fam: 'mono', ls: 2, color: '#0B0C0E' });
      c.restore();
    }
    const lab = dark ? 'TRYB BLACK WEEK · CENY −' + C.discount + '%' : 'KALKULATOR WYCENY · SEZON 2027';
    c.save(); c.globalAlpha = dark ? 1 : reveal(0);
    text(c, lab, L.pad, ty + (dark ? (V ? 34 : 22) : 0), V ? 22 : 15, { w: 700, fam: 'mono', color: pal.accent, ls: 2 });
    const title = dark ? 'Ceny w dół.' : 'Policz swój pakiet';
    text(c, chaos ? scramble(title, gs + 7, g * 0.5) : title, L.pad - 2, ty + (V ? 78 : 66) + (dark ? (V ? 26 : 16) : 0), V ? 68 : 58, { w: 500, fam: 'serif', color: pal.ink, it: dark });
    c.restore();

    // Wiersze z cenami.
    ITEMS.forEach((it, i) => {
      const y0 = P0 + L.rowY + i * L.rowH, ym = y0 + L.rowH / 2;
      const kr = dark ? 1 : reveal(0.04 + i * 0.04);
      c.save(); c.globalAlpha = kr; c.translate((1 - kr) * 40, 0);
      const on = dark ? 1 : E.outCubic(seg(t, T.toggles[i], T.toggles[i] + 0.16));
      const flash = dark ? pulse(t, T.drops[i], 9) * (t >= T.drops[i] ? 1 : 0) : pulse(t, T.toggles[i], 8);
      if (flash > 0.01) { c.fillStyle = dark ? `rgba(255,59,47,${0.28 * flash})` : `rgba(196,48,43,${0.08 * flash})`; c.fillRect(L.rowX0 - 18, y0 + 4, L.rowX1 - L.rowX0 + 36, L.rowH - 8); }
      c.fillStyle = pal.line; c.fillRect(L.rowX0, y0, L.rowX1 - L.rowX0, 1.5);
      toggle(c, L.rowX0 + (V ? 38 : 32), ym, on, pal);
      const nx = L.rowX0 + (V ? 104 : 88);
      const nm = chaos ? scramble(it.name, gs + i * 13, g * 0.35) : it.name;
      text(c, nm, nx, ym - (V ? 4 : 3), V ? 34 : 25, { w: 600, color: pal.ink });
      text(c, it.note, nx, ym + (V ? 34 : 26), V ? 24 : 17, { color: pal.muted });
      const ps = V ? 38 : 30;
      if (!dark) {
        let s = fmt(it.price) + ' zł';
        if (chaos) s = scramble(s, gs + i * 31, clamp(g * 1.2));
        const col = on > 0.5 ? pal.ink : pal.muted;
        text(c, s, L.rowX1, ym + ps * 0.35, ps, { w: 700, color: col, align: 'right' });
      } else {
        const d = T.drops[i];
        const k1 = E.outCubic(seg(t, d, d + 0.12));
        const k2 = E.inOutCubic(seg(t, d + 0.03, d + 0.16));
        const k3 = seg(t, d + 0.12, d + 0.34);
        // Stara cena: kreśli się i odjeżdża do góry.
        const os = lerp(ps, ps * 0.56, k2), oy = lerp(ym + ps * 0.35, ym - ps * 0.5, k2);
        const old = fmt(it.price) + ' zł';
        text(c, old, L.rowX1, oy, os, { w: 700, color: mix(pal.ink, pal.muted, k2), align: 'right' });
        if (k1 > 0) {
          const ow = measure(c, old, os, { w: 700 });
          c.fillStyle = RED; c.fillRect(L.rowX1 - ow - 4, oy - os * 0.33, (ow + 8) * k1, Math.max(2, os * 0.09));
        }
        // Odłamki starej ceny spadają w dół.
        if (t > d && t < d + 0.9) {
          const tt = t - d;
          for (let j = 0; j < 9; j++) {
            const vx = (hash(i, j, 1) - 0.5) * 260, vy = -120 - hash(i, j, 2) * 200, sz = 4 + hash(i, j, 3) * 8;
            const x = L.rowX1 - hash(i, j, 4) * 120 + vx * tt, y = ym + vy * tt + 0.5 * 2400 * tt * tt;
            c.fillStyle = hash(i, j, 5) < 0.5 ? RED : pal.ink; c.globalAlpha = kr * clamp(1 - tt * 1.2);
            c.fillRect(x, y, sz, sz);
          }
          c.globalAlpha = kr;
        }
        if (k3 > 0) {
          const kb = E.outBack(k3, 2.6), ns = ps * 1.12;
          const s = fmt(disc(it.price)) + ' zł';
          c.save(); c.translate(L.rowX1, ym + ns * 0.62); c.scale(lerp(1.7, 1, kb), lerp(1.7, 1, kb)); c.globalAlpha = kr * clamp(k3 * 3);
          text(c, s, 0, (1 - kb) * -40, ns, { w: 800, color: RED, align: 'right' });
          c.restore();
          const nw = measure(c, s, ns, { w: 800 });
          const kp = E.outBack(seg(t, d + 0.12, d + 0.3), 3);
          const bs = V ? 22 : 16, bw = measure(c, `−${C.discount}%`, bs, { w: 800, fam: 'mono' }) + bs * 1.1;
          c.save(); c.translate(L.rowX1 - nw - bw / 2 - 14, ym + ns * 0.3); c.scale(kp, kp); c.rotate(-0.08);
          rr(c, -bw / 2, -bs * 0.85, bw, bs * 1.7, 4); c.fillStyle = RED; c.fill();
          text(c, `−${C.discount}%`, 0, bs * 0.36, bs, { w: 800, fam: 'mono', color: '#0B0C0E', align: 'center' });
          c.restore();
        }
      }
      c.restore();
    });

    // Karta podsumowania.
    const cd = L.card, cy0 = P0 + cd.y;
    const kc = dark ? 1 : reveal(0.12);
    c.save(); c.globalAlpha = kc; c.translate(0, (1 - kc) * 50);
    c.save(); c.shadowColor = 'rgba(0,0,0,0.3)'; c.shadowBlur = 40; c.shadowOffsetY = 18;
    rr(c, cd.x, cy0, cd.w, cd.h, 16); c.fillStyle = pal.card; c.fill(); c.restore();
    if (dark) { rr(c, cd.x, cy0, cd.w, cd.h, 16); c.strokeStyle = 'rgba(255,59,47,0.5)'; c.lineWidth = 2; c.stroke(); }
    const ix = cd.x + (V ? 36 : 34);
    const nOn = dark ? 5 : T.toggles.filter((tt) => t >= tt).length;
    text(c, 'TWÓJ PAKIET', ix, cy0 + (V ? 56 : 54), V ? 20 : 14, { w: 700, fam: 'mono', color: pal.cardMuted, ls: 2 });
    text(c, `${nOn} z 5 usług`, cd.x + cd.w - (V ? 36 : 34), cy0 + (V ? 56 : 54), V ? 24 : 17, { w: 500, color: pal.cardMuted, align: 'right' });
    let total;
    if (!dark) total = ITEMS.reduce((s, it, i) => s + it.price * E.outCubic(seg(t, T.toggles[i], T.toggles[i] + 0.3)), 0);
    else total = lerp(SUM, SUM_NEW, E.inOutCubic(seg(t, T.totalDrop[0], T.totalDrop[1])));
    const ts = V ? 104 : 86;
    const tyy = cy0 + (V ? 170 : 176);
    const zl = measure(c, 'zł', ts * 0.42, { w: 600 });
    const dropping = dark && t > T.totalDrop[0] - 0.02;
    const tcol = dropping ? RED : pal.cardInk;
    const odw = odometer(c, total, cd.x + cd.w - (V ? 36 : 34) - zl - 14, tyy, ts, { w: 800, color: tcol, max: SUM, scramble: chaos ? gs : 0, scrambleP: g * 0.9 });
    text(c, 'zł', cd.x + cd.w - (V ? 36 : 34), tyy, ts * 0.42, { w: 600, color: tcol, align: 'right' });
    text(c, dark ? 'RAZEM PO RABACIE' : 'RAZEM', cd.x + cd.w - (V ? 36 : 34) - zl - 14 - odw, tyy - ts * 0.86, V ? 20 : 14, { w: 700, fam: 'mono', color: pal.cardMuted, ls: 2 });
    if (dark && t > T.totalDrop[1]) {
      const s = `było ${fmt(SUM)} zł`, k = E.outCubic(seg(t, T.totalDrop[1], T.totalDrop[1] + 0.2));
      c.globalAlpha = kc * k;
      text(c, s, ix, tyy + (V ? 52 : 44), V ? 26 : 19, { w: 500, color: pal.cardMuted });
      const sw = measure(c, s, V ? 26 : 19, { w: 500 });
      c.fillStyle = RED; c.fillRect(ix - 2, tyy + (V ? 43 : 37), (sw + 4) * k, 2.5);
      c.globalAlpha = kc;
    }
    // Przycisk.
    const b = L.btn, by = P0 + b.y;
    const press = 1 - 0.06 * pulse(t, T.calcClick, 14) * (t >= T.calcClick ? 1 : 0);
    c.save(); c.translate(b.x + b.w / 2, by + b.h / 2); c.scale(press, press);
    rr(c, -b.w / 2, -b.h / 2, b.w, b.h, 10); c.fillStyle = dark ? RED : pal.accent; c.fill();
    const prog = seg(t, T.progress[0], T.progress[1]);
    let label = dark ? `Zarezerwuj z rabatem −${C.discount}%` : 'Oblicz ofertę';
    if (!dark && t >= T.calcClick) {
      const p = Math.min(0.99, E.outExpo(prog));
      c.save(); rr(c, -b.w / 2, -b.h / 2, b.w, b.h, 10); c.clip();
      c.fillStyle = 'rgba(0,0,0,0.28)'; c.fillRect(-b.w / 2, -b.h / 2, b.w * p, b.h); c.restore();
      label = `Przeliczanie… ${Math.floor(p * 100)}%`;
      if (chaos) label = scramble(label, gs + 99, g);
    }
    text(c, label, 0, V ? 11 : 8, V ? 32 : 22, { w: 700, color: dark ? '#0B0C0E' : '#fff', align: 'center' });
    c.restore();
    c.restore();
  }

  function drawWindow(c, t, pal, dark) {
    const { bx, by, bw, bh, chrome, r } = L;
    // Otwieranie: czerwona linia rozciąga się w okno.
    const kL = E.outExpo(seg(t, T.boot, T.windowOpen));
    const kO = E.outBack(seg(t, T.windowOpen, T.windowOpen + 0.38), 1.2);
    if (t < T.windowOpen + 0.02) {
      const w = bw * kL, cyy = by + bh / 2;
      c.save(); c.shadowColor = RED; c.shadowBlur = 30; c.fillStyle = RED;
      c.fillRect(bx + bw / 2 - w / 2, cyy - 2, w, 4); c.restore();
      return;
    }
    const hh = Math.max(4, bh * kO), y0 = by + bh / 2 - hh / 2;
    c.save();
    c.shadowColor = dark ? 'rgba(255,40,30,0.35)' : 'rgba(0,0,0,0.55)'; c.shadowBlur = 80; c.shadowOffsetY = 30;
    rr(c, bx, y0, bw, hh, r); c.fillStyle = pal.bg; c.fill();
    c.restore();
    c.save(); rr(c, bx, y0, bw, hh, r); c.clip();
    c.translate(0, y0 - by + (hh - bh) / 2);
    // Pasek przeglądarki.
    c.fillStyle = pal.chrome; c.fillRect(bx, by, bw, chrome);
    let url = '';
    const typed = 'kwfoto.pl';
    const nt = Math.floor(seg(t, T.typing[0], T.typing[1]) * typed.length + 0.001);
    url = typed.slice(0, nt);
    if (t >= T.navClick) url = typed + '/kalkulator'.slice(0, Math.ceil(seg(t, T.navClick, T.navClick + 0.12) * 11));
    if (dark) url = 'kwfoto.pl/black-week';
    if (t >= T.errors[0] && !dark) url = scramble('kwfoto.pl/kalkulator', Math.floor(t * 30), glitchAt(t) * 0.6);
    if (V) {
      const ax = bx + 36, aw = bw - 72, ah = 70, ay = by + chrome - ah - 22;
      rr(c, ax, ay, aw, ah, ah / 2); c.fillStyle = pal.pill; c.fill();
      lock(c, ax + 42, ay + ah / 2, 1.3, pal.chromeInk);
      text(c, url, ax + 76, ay + ah / 2 + 11, 30, { w: 500, color: pal.ink });
      if (t < 1.2 && Math.floor(t * 4) % 2 === 0) { const uw = measure(c, url, 30, { w: 500 }); c.fillStyle = pal.accent; c.fillRect(ax + 80 + uw, ay + 18, 3, ah - 36); }
    } else {
      ['#FF5F57', '#FEBC2E', '#28C840'].forEach((col, i) => { c.fillStyle = dark ? (i === 0 ? RED : '#3a3d42') : col; c.beginPath(); c.arc(bx + 28 + i * 22, by + chrome / 2, 7, 0, TAU); c.fill(); });
      const aw = bw * 0.46, ax = bx + (bw - aw) / 2, ah = 38, ay = by + (chrome - ah) / 2;
      rr(c, ax, ay, aw, ah, ah / 2); c.fillStyle = pal.pill; c.fill();
      lock(c, ax + 24, ay + ah / 2, 1, pal.chromeInk);
      text(c, url, ax + 46, ay + ah / 2 + 7, 18, { w: 500, color: pal.ink });
      if (t < 1.2 && Math.floor(t * 4) % 2 === 0) { const uw = measure(c, url, 18, { w: 500 }); c.fillStyle = pal.accent; c.fillRect(ax + 49 + uw, ay + 9, 2, ah - 18); }
    }
    // Pasek ładowania.
    const kp = seg(t, T.typing[1], T.pageLoad + 0.2);
    if (kp > 0 && kp < 1) { c.fillStyle = pal.accent; c.fillRect(bx, by + chrome - 3, bw * E.outCubic(kp), 3); }
    // Treść strony.
    c.save(); c.beginPath(); c.rect(L.cx, L.cy, L.cw, L.ch); c.clip();
    c.fillStyle = pal.bg; c.fillRect(L.cx, L.cy, L.cw, L.ch);
    const sc = dark ? L.ch : scrollAt(t);
    const vel = !dark && t > T.scroll[0] && t < T.scroll[1];
    const passes = vel ? 5 : 1;
    for (let p = 0; p < passes; p++) {
      // Rozmycie ruchu przy szybkim przewijaniu: średnia z kilku chwil.
      const tt = t - p * 0.012, s2 = vel ? scrollAt(tt) : sc;
      c.save(); c.globalAlpha = 1 / (p + 1); c.translate(L.cx, L.cy - s2);
      if (s2 < L.ch) { c.fillStyle = pal.bg; c.fillRect(0, 0, L.cw, L.ch); drawHero(c, t, pal); }
      if (s2 > 0) { c.fillStyle = pal.bg; c.fillRect(0, L.P0, L.cw, L.ch); drawCalc(c, t, pal, dark); }
      c.restore();
    }
    c.save(); c.translate(L.cx, L.cy); drawNav(c, t, pal, dark); c.restore();
    // Restart po crashu: treść odsłania się linia po linii.
    if (dark) {
      const kr = seg(t, T.reboot, T.reboot + 0.22);
      if (kr < 1) {
        const yy = L.cy + L.ch * E.outCubic(kr);
        c.fillStyle = '#000'; c.fillRect(L.cx, yy, L.cw, L.ch);
        c.fillStyle = RED; c.fillRect(L.cx, yy - 3, L.cw, 3);
      }
    }
    c.restore();
    c.restore();
  }
  function lock(c, x, y, s, col) {
    c.save(); c.translate(x, y); c.scale(s, s); c.strokeStyle = col; c.fillStyle = col; c.lineWidth = 2;
    c.beginPath(); c.arc(0, -3, 5, Math.PI, 0); c.stroke(); rr(c, -7, -3, 14, 11, 2); c.fill(); c.restore();
  }

  // ---------------------------------------------------------------- okna błędów
  const MSG = [
    ['BŁĄD 0x00030%', 'Ceny przekroczyły limit', 'Black Week.'],
    ['kalkulator.exe', 'Program nie odpowiada.', 'Zakończyć drożyznę?'],
    ['PRICE_OVERFLOW', 'Za dużo cyfr w cenie.', 'Usuwanie… 30%'],
    ['UWAGA', 'Wykryto Black Week.', 'Rabat: −30%.'],
    ['STACK OVERFLOW', '−30% −30% −30% −30%', '−30% −30% −30%'],
    ['BŁĄD KRYTYCZNY', 'Nie można utrzymać', 'starych cen.'],
    ['SYSTEM', 'Ceny lecą w dół.', 'Trzymaj się.'],
    ['ceny.dll', 'Brak pamięci na', 'tak wysokie kwoty.'],
    ['ERROR 418', 'Za dużo miłości', 'w kalkulatorze.'],
    ['BLACK_WEEK.SYS', 'Nadpisywanie cennika…', '████████░░ 80%'],
    ['FATAL', 'kwfoto.pl/kalkulator', 'przestał działać.'],
  ];
  const DW = () => (V ? 760 : 540), DH = () => (V ? 270 : 196);
  function dialog(c, x, y, m, k, sc = 1) {
    const w = DW(), h = DH(), hb = V ? 62 : 44, fs = V ? 30 : 21;
    c.save(); c.translate(x + w / 2, y + h / 2); c.scale(k * sc, k * sc); c.translate(-w / 2, -h / 2);
    c.shadowColor = 'rgba(0,0,0,0.5)'; c.shadowBlur = 30; c.shadowOffsetY = 14;
    rr(c, 0, 0, w, h, 10); c.fillStyle = '#16181C'; c.fill(); c.shadowColor = 'transparent';
    c.save(); rr(c, 0, 0, w, h, 10); c.clip(); c.fillStyle = RED; c.fillRect(0, 0, w, hb); c.restore();
    c.strokeStyle = '#2E3238'; c.lineWidth = 2; rr(c, 0, 0, w, h, 10); c.stroke();
    // Trójkąt ostrzegawczy.
    const ts = hb * 0.5, tx = 22 + ts / 2, ty = hb / 2;
    c.fillStyle = '#0B0C0E'; c.beginPath(); c.moveTo(tx, ty - ts / 2); c.lineTo(tx + ts / 2, ty + ts / 2); c.lineTo(tx - ts / 2, ty + ts / 2); c.closePath(); c.fill();
    text(c, '!', tx, ty + ts * 0.42, ts * 0.8, { w: 800, color: RED, align: 'center' });
    text(c, m[0], tx + ts / 2 + 14, hb / 2 + fs * 0.36, fs * 0.95, { w: 700, fam: 'mono', color: '#0B0C0E' });
    text(c, '✕', w - 22, hb / 2 + fs * 0.36, fs, { w: 700, fam: 'mono', color: '#0B0C0E', align: 'right' });
    text(c, m[1], 24, hb + fs * 1.55, fs, { fam: 'mono', color: '#EEF0F2' });
    text(c, m[2], 24, hb + fs * 2.85, fs, { fam: 'mono', color: '#EEF0F2' });
    const bw = V ? 150 : 108, bh = V ? 54 : 38;
    rr(c, w - 24 - bw, h - 20 - bh, bw, bh, 6); c.fillStyle = '#EEF0F2'; c.fill();
    text(c, 'OK', w - 24 - bw / 2, h - 20 - bh / 2 + fs * 0.36, fs, { w: 700, fam: 'mono', color: '#0B0C0E', align: 'center' });
    c.restore();
  }
  function drawDialogs(c, t) {
    if (t < T.errors[0] || t >= T.meltdown[1]) return;
    const w = DW(), h = DH();
    T.errors.forEach((te, i) => {
      if (t < te) return;
      const x = L.bx + 30 + hash(i, 41) * (L.bw - w - 60), y = L.by + 90 + hash(i, 42) * (L.bh - h - 140);
      const k = E.outBack(seg(t, te, te + 0.12), 2.2);
      const jx = (hash(i, Math.floor(t * 30)) - 0.5) * 10 * glitchAt(t);
      dialog(c, x + jx, y, MSG[i % MSG.length], k);
    });
    // Klasyczny „ślad” okna ciągniętego po zawieszonym ekranie.
    if (t >= T.errorTrail[0]) {
      const pth = (tt) => {
        const u = tt - T.errorTrail[0];
        return { x: W / 2 - w / 2 + Math.sin(u * 11) * (V ? 120 : 520) * (0.3 + u), y: H / 2 - h / 2 + Math.sin(u * 15 + 0.6) * (V ? 520 : 240) * (0.3 + u) };
      };
      for (let tt = T.errorTrail[0]; tt <= t; tt += 1 / 60) { const p = pth(tt); dialog(c, p.x, p.y, ['ERROR', 'ceny.exe — błąd', 'krytyczny.'], 1, 0.9); }
    }
  }

  function drawCursor(c, t) {
    let vis = t >= 1.05 && t < T.meltdown[0];
    const end = t >= T.ctaIn + 0.2;
    let p;
    if (end) { p = endCursor(t); vis = true; } else p = cursorAt(t);
    if (!vis) return;
    const clicks = end ? [T.ctaClick] : CLICKS();
    let press = 0;
    for (const cl of clicks) press = Math.max(press, t >= cl ? Math.exp(-(t - cl) * 16) : 0);
    // Fala po kliknięciu.
    for (const cl of clicks) {
      const k = seg(t, cl, cl + 0.4);
      if (k > 0 && k < 1) {
        c.strokeStyle = `rgba(255,59,47,${1 - k})`; c.lineWidth = 3 * (1 - k) + 1;
        c.beginPath(); c.arc(p.x, p.y, (V ? 30 : 14) + k * (V ? 90 : 60), 0, TAU); c.stroke();
      }
    }
    const g = end ? 0 : glitchAt(t);
    const copies = g > 0.3 ? 1 + Math.floor(g * 5) : 1;
    for (let j = copies - 1; j >= 0; j--) {
      const ox = j ? (hash(j, Math.floor(t * 30)) - 0.5) * 260 * g : 0, oy = j ? (hash(j, Math.floor(t * 30), 2) - 0.5) * 200 * g : 0;
      c.save(); c.globalAlpha = j ? 0.5 : 1; c.translate(p.x + ox, p.y + oy);
      if (V) {
        // Na telefonie: ślad dotyku zamiast strzałki.
        let a = 0;
        for (const cl of clicks) a = Math.max(a, 1 - Math.abs(t - cl) / 0.22);
        if (end) a = Math.max(a, seg(t, T.ctaIn + 0.2, T.ctaIn + 0.4));
        else if (t > T.calcClick) a = Math.max(a, 0.9);
        a = clamp(a);
        const r = 40 * (1 - 0.18 * press);
        c.globalAlpha *= a; c.fillStyle = 'rgba(255,255,255,0.55)'; c.beginPath(); c.arc(0, 0, r, 0, TAU); c.fill();
        c.strokeStyle = 'rgba(20,23,27,0.6)'; c.lineWidth = 3; c.stroke();
      } else {
        const s = 1.25 * (1 - 0.15 * press);
        c.scale(s, s);
        c.beginPath(); c.moveTo(0, 0); c.lineTo(0, 26); c.lineTo(6.5, 20); c.lineTo(11, 30); c.lineTo(15, 28.4); c.lineTo(10.6, 18.6); c.lineTo(19, 18.6); c.closePath();
        c.fillStyle = '#fff'; c.fill(); c.strokeStyle = '#0B0C0E'; c.lineWidth = 1.6; c.lineJoin = 'round'; c.stroke();
      }
      c.restore();
    }
  }

  // ---------------------------------------------------------------- pieczątka −30%
  function drawStamp(c, t) {
    if (t < T.stamp) return;
    const p = L.w(L.stamp.x, L.stamp.y, 0), r = L.stampR;
    const k = seg(t, T.stamp, T.stamp + 0.1);
    const s = lerp(2.6, 1, E.outQuint(k));
    c.save(); c.translate(p.x, p.y); c.rotate(-0.21); c.scale(s, s); c.globalAlpha = clamp(k * 4);
    c.shadowColor = 'rgba(255,59,47,0.6)'; c.shadowBlur = 40;
    c.fillStyle = RED; c.beginPath(); c.arc(0, 0, r, 0, TAU); c.fill(); c.shadowColor = 'transparent';
    c.strokeStyle = '#0B0C0E'; c.lineWidth = 3; c.setLineDash([6, 6]); c.beginPath(); c.arc(0, 0, r * 0.86, 0, TAU); c.stroke(); c.setLineDash([]);
    text(c, 'BLACK WEEK', 0, -r * 0.34, r * 0.17, { w: 800, fam: 'mono', color: '#0B0C0E', align: 'center', ls: 1 });
    text(c, `−${C.discount}%`, 0, r * 0.22, r * 0.46, { w: 900, st: 'normal', color: '#0B0C0E', align: 'center' });
    c.restore();
  }
  function stampZoomPoint() {
    const p = L.w(L.stamp.x, L.stamp.y, 0), r = L.stampR, a = -0.21;
    const lx = 0, ly = r * 0.6;
    return { x: p.x + lx * Math.cos(a) - ly * Math.sin(a), y: p.y + lx * Math.sin(a) + ly * Math.cos(a) };
  }

  // ---------------------------------------------------------------- kamera
  function camera(t) {
    const s = keys([[0, 0.9], [0.35, 0.9], [1.3, 1.0], [2.0, 1.05], [2.25, 1.0], [2.55, 1.04], [4.0, 1.05], [6.0, 1.1], [6.25, 1.1], [6.3, 1.0], [7.0, 1.04], [7.4, 1.09], [7.5, 1.1]], t);
    const rot = keys([[0.35, -0.04], [1.3, 0]], t);
    let target, w;
    const center = { x: W / 2, y: H / 2 };
    if (t < 2.2) { target = L.w(L.navCalc.x, L.navCalc.y, 0); w = keys([[1.0, 0], [2.0, V ? 0.12 : 0.18], [2.2, 0]], t); }
    else if (t < T.meltdown[1]) { target = cursorAt(t - 0.1); w = keys([[2.2, 0], [2.6, V ? 0.06 : 0.14], [6.25, V ? 0.08 : 0.16]], t); }
    else {
      const rows = L.w(L.rowX1, L.rowY + 2.5 * L.rowH, 0), st = L.w(L.stamp.x, L.stamp.y, 0);
      const k = E.inOutCubic(seg(t, 6.9, 7.35));
      target = { x: lerp(rows.x, st.x, k), y: lerp(rows.y, st.y, k) };
      w = keys([[6.3, V ? 0.06 : 0.12], [7.0, V ? 0.08 : 0.15], [7.4, V ? 0.15 : 0.28]], t);
    }
    let scale = s;
    if (t >= T.dive[0]) {
      const k = seg(t, T.dive[0], T.dive[1]);
      const zp = stampZoomPoint();
      const kk = E.inOutCubic(Math.min(1, k * 1.6));
      target = { x: lerp(target.x, zp.x, kk), y: lerp(target.y, zp.y, kk) };
      w = lerp(w, 1, kk);
      scale = s * Math.exp(Math.log(70) * E.inExpo(k));
    }
    const f = { x: center.x + (target.x - center.x) * w, y: center.y + (target.y - center.y) * w };
    return { s: scale, rot, f };
  }

  function drawSite(c, t) {
    const dark = isDark(t);
    const pal = dark ? DARK : LIGHT;
    backdrop(c, t, dark);
    const cam = camera(t);
    c.save();
    c.translate(W / 2, H / 2); c.rotate(cam.rot); c.scale(cam.s, cam.s); c.translate(-cam.f.x, -cam.f.y);
    drawWindow(c, t, pal, dark);
    drawDialogs(c, t);
    drawCursor(c, t);
    if (dark) drawStamp(c, t);
    c.restore();
    if (t >= T.meltdown[0] && t < T.meltdown[1]) meltdown(c, t);
    if (t >= T.meltdown[1] && t < T.reboot) { c.fillStyle = '#000'; c.fillRect(0, 0, W, H); }
    if (dark && t >= T.reboot && t < T.reboot + 0.2) {
      // Konsola restartu nad stroną.
      const k = seg(t, T.reboot, T.reboot + 0.2);
      c.save(); c.globalAlpha = 1 - k;
      text(c, '> reboot --mode=black-week', V ? 80 : 200, H / 2, V ? 34 : 30, { w: 700, fam: 'mono', color: RED });
      c.restore();
    }
  }

  function meltdown(c, t) {
    const f = Math.floor(t * 30), k = seg(t, T.meltdown[0], T.meltdown[1]);
    if (f % 3 !== 1) {
      c.fillStyle = f % 2 ? RED : '#0B0C0E'; c.fillRect(0, 0, W, H);
      const ink = f % 2 ? '#0B0C0E' : RED;
      c.save(); font(c, 20, { fam: 'mono' }); c.fillStyle = f % 2 ? 'rgba(0,0,0,0.35)' : 'rgba(255,59,47,0.3)';
      for (let y = 0, i = 0; y < H; y += V ? 34 : 26, i++) {
        let line = '';
        for (let j = 0; j < 40; j++) line += Math.floor(hash(f, i, j) * 65535).toString(16).padStart(4, '0').toUpperCase() + ' ';
        c.font = `400 ${V ? 22 : 18}px ${FAM.mono}`; c.textAlign = 'left'; c.fillText(line, -((f * 37) % 200), y);
      }
      c.restore();
      const s1 = fit(c, 'FATAL ERROR', W * 0.86, { w: 900, st: 'expanded' });
      const jx = (hash(f, 1) - 0.5) * 40;
      text(c, 'FATAL ERROR', W / 2 + jx, H / 2 - s1 * 0.05, s1, { w: 900, st: 'expanded', color: ink, align: 'center' });
      text(c, 'ceny.exe przestał działać · 0x' + Math.floor(1e5 + k * 9e5).toString(16).toUpperCase(), W / 2, H / 2 + s1 * 0.42, V ? 30 : 32, { w: 700, fam: 'mono', color: ink, align: 'center' });
    }
  }

  // ---------------------------------------------------------------- typografia Black Week
  function sunburst(c, cx, cy, rot, col, n = 24) {
    const R = Math.hypot(W, H);
    c.save(); c.translate(cx, cy); c.rotate(rot); c.fillStyle = col;
    for (let i = 0; i < n; i++) { const a = (i / n) * TAU; c.beginPath(); c.moveTo(0, 0); c.arc(0, 0, R, a, a + TAU / n / 2); c.closePath(); c.fill(); }
    c.restore();
  }
  function marqueeRows(c, t, accentRow = true) {
    const rs = V ? 150 : 132, lh = rs * 0.9;
    font(c, rs, { w: 900, st: 'condensed' });
    const word = 'BLACK WEEK — ';
    const ww = c.measureText(word).width;
    c.textBaseline = 'middle'; c.textAlign = 'left';
    const rows = Math.ceil(H / lh) + 1;
    for (let r = 0; r < rows; r++) {
      const dir = r % 2 ? 1 : -1, sp = V ? 700 : 900;
      const off = ((dir * (t - T.marquee) * sp) % ww + ww) % ww - ww;
      const y = r * lh + lh * 0.3;
      for (let x = off - ww; x < W + ww; x += ww) {
        if (accentRow && r % 3 === 1) { c.fillStyle = 'rgba(255,59,47,0.22)'; c.fillText(word, x, y); }
        else { c.strokeStyle = 'rgba(255,255,255,0.13)'; c.lineWidth = 2; c.strokeText(word, x, y); }
      }
    }
  }
  function slamWord(c, s, x, y, size, t0, t, col, o) {
    const k = seg(t, t0, t0 + 0.16);
    if (t < t0) return;
    const sc = lerp(1.45, 1, E.outExpo(k));
    for (let g = 2; g >= 0; g--) {
      const gs = sc * (1 + g * 0.08 * (1 - k));
      c.save(); c.translate(x, y); c.scale(gs, gs); c.globalAlpha = g ? 0.18 * (1 - k) : clamp(k * 5);
      text(c, s, 0, 0, size, { ...o, color: col, align: 'center', base: 'middle' });
      c.restore();
    }
  }

  function drawKinetic(c, t) {
    c.fillStyle = '#050506'; c.fillRect(0, 0, W, H);
    const big = { w: 900, st: 'expanded' };
    if (t < T.percent) {
      if (t >= T.marquee) marqueeRows(c, t);
      const sB = fit(c, 'BLACK', W * (V ? 0.88 : 0.74), big);
      const sW = fit(c, 'WEEK', W * (V ? 0.88 : 0.74), big) * 0.98;
      const shrink = E.inOutCubic(seg(t, T.marquee, T.marquee + 0.18));
      const sc = lerp(1, V ? 0.86 : 0.78, shrink);
      const gap = sB * 0.9 * sc;
      const cy = H / 2;
      c.save(); c.translate(W / 2, cy); c.scale(sc, sc); c.translate(-W / 2, -cy);
      // Blok za napisem, który przy „flip” odwraca kolory.
      if (t >= T.marquee) {
        const kb = E.outExpo(seg(t, T.marquee, T.marquee + 0.2));
        const flip = seg(t, T.flip, T.flip + 0.14);
        const fy = Math.cos(flip * Math.PI);
        const inv = flip > 0.5;
        const bw = W * (V ? 0.94 : 0.82), bh = gap * 2.1;
        c.save(); c.translate(W / 2, cy); c.scale(1, Math.abs(fy) < 0.02 ? 0.02 : Math.abs(fy));
        c.fillStyle = inv ? '#F5F3EF' : RED; c.fillRect(-bw / 2, -bh / 2, bw * kb, bh);
        c.restore();
        const ink = inv ? '#050506' : '#050506';
        c.save(); c.translate(W / 2, cy); c.scale(1, Math.abs(fy) < 0.02 ? 0.02 : Math.abs(fy)); c.translate(-W / 2, -cy);
        text(c, 'BLACK', W / 2, cy - gap * 0.5, sB, { ...big, color: inv ? '#050506' : ink, align: 'center', base: 'middle' });
        text(c, 'WEEK', W / 2, cy + gap * 0.5, sW, { ...big, color: inv ? RED : '#F5F3EF', align: 'center', base: 'middle' });
        c.restore();
      } else {
        slamWord(c, 'BLACK', W / 2, cy - gap * 0.5, sB, T.black, t, '#F5F3EF', big);
        if (t >= T.week) {
          const k = E.outExpo(seg(t, T.week, T.week + 0.18));
          c.save(); c.beginPath(); c.rect(0, cy, W, gap * 1.2); c.clip();
          text(c, 'WEEK', W / 2, cy + gap * 0.5 + (1 - k) * gap, sW, { ...big, color: RED, align: 'center', base: 'middle' });
          c.restore();
        }
      }
      c.restore();
      // Napis z datą na dole.
      if (t >= T.marquee) {
        const k = E.outCubic(seg(t, T.marquee + 0.08, T.marquee + 0.3));
        c.save(); c.globalAlpha = k;
        const ds = V ? 40 : 34;
        text(c, C.dates + '  ·  ' + C.domain.toUpperCase(), W / 2, cy + gap * 1.45 + (1 - k) * 30, ds, { w: 700, fam: 'mono', color: '#F5F3EF', align: 'center', ls: 3 });
        c.restore();
      }
      return;
    }
    if (t < T.cuts[0]) {
      // −30% z wirującymi cyframi.
      sunburst(c, W / 2, H / 2, (t - T.percent) * 0.9, 'rgba(255,59,47,0.12)', 20);
      const rg = c.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, Math.max(W, H) * 0.6);
      rg.addColorStop(0, 'rgba(255,59,47,0.28)'); rg.addColorStop(1, 'rgba(5,5,6,0)');
      c.fillStyle = rg; c.fillRect(0, 0, W, H);
      const o = { w: 900, st: 'semi-expanded' };
      const str = `−${C.discount}%`;
      let size = fit(c, str, W * (V ? 0.9 : 0.66), o);
      if (!V) size = Math.min(size, H * 0.56);
      let pulseS = 1 + 0.07 * pulse(t, T.pulses[0], 12) * (t >= T.pulses[0] ? 1 : 0) + 0.1 * pulse(t, T.pulses[1], 12) * (t >= T.pulses[1] ? 1 : 0);
      const k = seg(t, T.percent, T.percent + 0.14);
      const sc = lerp(2.2, 1, E.outExpo(k)) * pulseS;
      const cy = H / 2 - (V ? 40 : 30);
      c.save(); c.translate(W / 2, cy); c.scale(sc, sc); c.rotate(lerp(-0.25, -0.04, E.outBack(k)));
      font(c, size, o);
      const total = c.measureText(str).width;
      const parts = [...str];
      const widths = parts.map((p) => c.measureText(p).width);
      // Głębia: kilkanaście warstw przesuniętych po skosie.
      const depth = V ? 16 : 18;
      for (let d = depth; d >= 0; d--) {
        let x = -total / 2;
        parts.forEach((ch, i) => {
          const isDigit = /\d/.test(ch);
          let draw = ch, off = 0;
          if (isDigit) {
            // Cyfry jak w automacie: kręcą się i stają po kolei.
            const stop = T.percent + 0.1 + i * 0.07;
            const kk = seg(t, T.percent, stop);
            const target = Number(ch), spins = 3;
            const pos = target + 10 * spins * (1 - E.outCubic(kk));
            const d0 = Math.floor(pos) % 10; off = pos - Math.floor(pos);
            draw = String(d0);
            if (off > 0.001 && d === 0) {
              c.save(); c.beginPath(); c.rect(x - 10, -size * 0.85, widths[i] + 20, size * 1.05); c.clip();
              c.fillStyle = RED; c.textBaseline = 'alphabetic'; c.textAlign = 'left';
              c.fillText(String(d0), x, size * 0.36 + off * size);
              c.fillText(String((d0 + 1) % 10), x, size * 0.36 - (1 - off) * size);
              c.restore(); x += widths[i]; return;
            }
          }
          c.fillStyle = d === 0 ? RED : d < 3 ? '#8C1A13' : `rgb(${60 - d * 2},${8},${8})`;
          c.textBaseline = 'alphabetic'; c.textAlign = 'left';
          c.fillText(draw, x + d * 2.2, size * 0.36 + d * 2.2 + (d === 0 ? off * size : 0));
          x += widths[i];
        });
      }
      c.restore();
      const ks = E.outCubic(seg(t, T.percent + 0.16, T.percent + 0.36));
      c.save(); c.globalAlpha = ks;
      const sub = V ? 'NA WSZYSTKIE\nPAKIETY' : 'NA WSZYSTKIE PAKIETY';
      const ss = V ? 64 : 50;
      sub.split('\n').forEach((ln, i) => text(c, ln, W / 2, cy + size * (V ? 0.62 : 0.6) + (1 - ks) * 40 + i * ss * 1.15, ss, { w: 800, st: 'expanded', color: '#F5F3EF', align: 'center', ls: V ? 4 : 8 }));
      c.restore();
      return;
    }
    if (t < T.fall) { drawCuts(c, t); return; }
    drawFall(c, t);
  }

  function drawCuts(c, t) {
    const idx = t < T.cuts[1] ? 0 : t < T.cuts[2] ? 1 : 2;
    const t0 = T.cuts[idx], dur = (T.cuts[idx + 1] || T.fall) - t0, k = seg(t, t0, t0 + dur);
    const kinds = ['golden', 'lake', 'night'];
    const items = [0, 1, 2];
    const it = ITEMS[items[idx]];
    // Szybkie wejście z boku z rozmyciem ruchu.
    const kin = E.outExpo(seg(t, t0, t0 + 0.09));
    const ox = (1 - kin) * W * 0.6 * (idx % 2 ? -1 : 1);
    const img = photo[kinds[idx]];
    const passes = kin < 0.98 ? 4 : 1;
    for (let p = 0; p < passes; p++) {
      c.save(); c.globalAlpha = 1 / (p + 1);
      cover(c, img, ox + p * 30 * (1 - kin) * (idx % 2 ? 1 : -1), 0, W, H, 1.12 + 0.12 * k, idx === 1 ? 0 : 0.3 - 0.6 * k, 0);
      c.restore();
    }
    let g = c.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, 'rgba(5,5,6,0.55)'); g.addColorStop(0.45, 'rgba(5,5,6,0.1)'); g.addColorStop(1, 'rgba(5,5,6,0.9)');
    c.fillStyle = g; c.fillRect(0, 0, W, H);
    if (idx === 1) {
      const lb = V ? 0 : H * 0.09;
      c.fillStyle = '#000'; c.fillRect(0, 0, W, lb); c.fillRect(0, H - lb, W, lb);
      if (Math.floor(t * 4) % 2 === 0) { c.fillStyle = RED; c.beginPath(); c.arc(V ? 90 : 80, (V ? 300 : lb + 50), 13, 0, TAU); c.fill(); }
      text(c, 'REC', (V ? 114 : 104), (V ? 300 : lb + 50) + 9, 26, { w: 700, fam: 'mono', color: '#fff' });
      const fr = Math.floor((t - t0) * 25);
      text(c, `00:00:10:${String(fr).padStart(2, '0')}`, W - (V ? 70 : 80), (V ? 300 : lb + 50) + 9, 26, { w: 700, fam: 'mono', color: '#fff', align: 'right' });
    }
    const pad = V ? 70 : 110;
    const lab = `0${idx + 1} / 03`;
    const ty = V ? 520 : H * 0.36;
    text(c, lab, pad, ty - (V ? 210 : 150), V ? 30 : 24, { w: 700, fam: 'mono', color: RED, ls: 3 });
    const words = it.name.toUpperCase().split(' ');
    const ts = V ? fit(c, words.reduce((a, b) => (a.length > b.length ? a : b)), W - 2 * pad, { w: 900, st: 'condensed' }) : Math.min(fit(c, it.name.toUpperCase(), W - 2 * pad, { w: 900, st: 'condensed' }), 230);
    const lines = V ? words : [it.name.toUpperCase()];
    lines.forEach((ln, i) => {
      const kk = E.outExpo(seg(t, t0 + 0.02 + i * 0.03, t0 + 0.16 + i * 0.03));
      c.save(); c.beginPath(); c.rect(0, ty - ts * 0.9 + i * ts * 0.88, W, ts * 0.98); c.clip();
      text(c, ln, pad - 4, ty + i * ts * 0.88 + (1 - kk) * ts, ts, { w: 900, st: 'condensed', color: '#F5F3EF' });
      c.restore();
    });
    const py = V ? 1290 : H - 130;
    const kp = E.outBack(seg(t, t0 + 0.06, t0 + 0.2), 2.2);
    const old = fmt(it.price) + ' zł', nw = fmt(disc(it.price)) + ' zł';
    const os = V ? 46 : 40, ns = V ? 120 : 110;
    text(c, old, pad, py - ns * 0.92, os, { w: 600, color: 'rgba(245,243,239,0.7)' });
    const ow = measure(c, old, os, { w: 600 });
    c.fillStyle = RED; c.fillRect(pad - 4, py - ns * 0.92 - os * 0.33, (ow + 8) * E.outCubic(seg(t, t0 + 0.05, t0 + 0.12)), 4);
    c.save(); c.translate(pad, py); c.scale(kp, kp);
    text(c, nw, 0, 0, ns, { w: 900, st: 'semi-expanded', color: RED });
    c.restore();
  }

  function drawFall(c, t) {
    const k = seg(t, T.fall, T.end);
    c.fillStyle = RED; c.fillRect(0, 0, W, H);
    // Deszcz starych cen.
    font(c, V ? 70 : 64, { w: 900, st: 'condensed' }); c.textAlign = 'center'; c.textBaseline = 'middle';
    for (let i = 0; i < 34; i++) {
      const x = hash(i, 61) * W, sp = 1800 + hash(i, 62) * 2400, y0 = -200 - hash(i, 63) * H;
      const y = y0 + (t - T.fall) * sp;
      const s = fmt(ITEMS[i % 5].price);
      c.fillStyle = '#0B0C0E';
      for (let m = 0; m < 6; m++) { c.globalAlpha = 0.24 * (1 - m / 6); c.fillText(s, x, y - m * 16); }
      c.globalAlpha = 1;
    }
    const fallOut = E.inCubic(seg(t, T.end - 0.12, T.end));
    const lines = V ? ['WSZYSTKIE', 'CENY', 'W DÓŁ ↓'] : ['WSZYSTKIE CENY', 'W DÓŁ ↓'];
    const o = { w: 900, st: V ? 'semi-expanded' : 'expanded' };
    const size = Math.min(...lines.map((ln) => fit(c, ln, W * (V ? 0.86 : 0.84), o)));
    const lh = size * 0.9, y0 = H / 2 - ((lines.length - 1) * lh) / 2;
    lines.forEach((ln, li) => {
      font(c, size, o);
      const total = c.measureText(ln).width;
      let x = W / 2 - total / 2;
      [...ln].forEach((ch, ci) => {
        const w = c.measureText(ch).width;
        const td = T.fall + 0.01 + (li * 8 + ci) * 0.006;
        const kk = seg(t, td, td + 0.14);
        const y = y0 + li * lh - (1 - E.outBack(kk, 2.2)) * H * 0.7 + fallOut * H * (1.2 + hash(li, ci) * 0.6);
        c.save(); c.globalAlpha = clamp(kk * 4);
        text(c, ch, x, y, size, { ...o, color: li === lines.length - 1 ? '#F5F3EF' : '#0B0C0E', base: 'middle' });
        c.restore();
        x += w;
      });
    });
    void k;
  }

  // ---------------------------------------------------------------- plansza końcowa
  function endLayout() {
    return V
      ? { logoY: 650, logoS: 116, l1: 790, l2: 930, l2s: 104, l3: 1020, l3s: 34, cta: 1150, ctaW: 760, ctaH: 120, ctaS: 40, url: 1350 }
      : { logoY: 290, logoS: 112, l1: 400, l2: 520, l2s: 104, l3: 600, l3s: 30, cta: 700, ctaW: 620, ctaH: 104, ctaS: 34, url: 880 };
  }
  function endCursor(t) {
    const e = endLayout();
    const to = { x: W / 2 + e.ctaW * 0.22, y: e.cta + e.ctaH * 0.2 };
    const k = E.inOutCubic(seg(t, T.ctaIn + 0.25, T.ctaClick - 0.08));
    return { x: lerp(W * 0.86, to.x, k), y: lerp(H + 40, to.y, k) };
  }
  function drawEnd(c, t) {
    const e = endLayout();
    const k0 = T.end;
    c.fillStyle = '#060607'; c.fillRect(0, 0, W, H);
    c.save(); c.globalAlpha = 0.5; cover(c, photo.golden, 0, 0, W, H, 1.25 - 0.08 * seg(t, k0, 13), 0.1, 0); c.restore();
    c.fillStyle = 'rgba(6,6,7,0.62)'; c.fillRect(0, 0, W, H);
    const rg = c.createRadialGradient(W / 2, H * 1.05, 0, W / 2, H * 1.05, H * 0.9);
    rg.addColorStop(0, 'rgba(255,59,47,0.55)'); rg.addColorStop(1, 'rgba(255,59,47,0)');
    c.fillStyle = rg; c.fillRect(0, 0, W, H);
    // Drobinki światła unoszące się do góry.
    for (let i = 0; i < 60; i++) {
      const x = hash(i, 91) * W + Math.sin(t * 2 + i) * 20, sp = 60 + hash(i, 92) * 160;
      const y = H + 40 - ((hash(i, 93) * H + (t - k0) * sp) % (H + 80));
      const r = 1.5 + hash(i, 94) * 4.5;
      c.fillStyle = hash(i, 95) < 0.5 ? `rgba(255,59,47,${0.25 + 0.5 * hash(i, 96)})` : `rgba(245,243,239,${0.15 + 0.35 * hash(i, 96)})`;
      c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill();
    }
    // Wejście z czerwonego kadru: kurtyna odjeżdża w górę.
    const cur = E.inOutCubic(seg(t, k0, k0 + 0.22));
    // Logo litera po literze.
    const kl = E.outExpo(seg(t, k0 + 0.05, k0 + 0.4));
    c.save(); c.beginPath(); c.rect(0, e.logoY - e.logoS * 1.1, W, e.logoS * 1.45); c.clip();
    c.translate(0, (1 - kl) * e.logoS * 1.3);
    logo(c, W / 2, e.logoY, e.logoS, '#F5F3EF', RED, 'center');
    c.restore();
    const k1 = E.outCubic(seg(t, T.endLines[0], T.endLines[0] + 0.3));
    const l1s = V ? 34 : 28;
    const lab = 'BLACK WEEK';
    const lw = measure(c, lab, l1s, { w: 800, fam: 'mono', ls: 8 });
    c.save(); c.globalAlpha = k1;
    text(c, lab, W / 2, e.l1, l1s, { w: 800, fam: 'mono', color: RED, align: 'center', ls: 8 });
    c.fillStyle = RED; const ln = (V ? 150 : 220) * k1;
    c.fillRect(W / 2 - lw / 2 - 30 - ln, e.l1 - l1s * 0.36, ln, 3); c.fillRect(W / 2 + lw / 2 + 30, e.l1 - l1s * 0.36, ln, 3);
    c.restore();
    const k2 = E.outExpo(seg(t, T.endLines[1], T.endLines[1] + 0.35));
    const l2 = V ? `−${C.discount}% na wszystko` : `−${C.discount}% na wszystkie pakiety`;
    const l2s = Math.min(e.l2s, fit(c, l2, W * 0.88, { w: 900, st: 'expanded' }));
    c.save(); c.beginPath(); c.rect(0, e.l2 - l2s, W, l2s * 1.3); c.clip();
    text(c, l2, W / 2, e.l2 + (1 - k2) * l2s * 1.2, l2s, { w: 900, st: 'expanded', color: '#F5F3EF', align: 'center' });
    c.restore();
    const k3 = E.outCubic(seg(t, T.endLines[2], T.endLines[2] + 0.3));
    c.save(); c.globalAlpha = k3;
    text(c, `fotografia · film · sesje  |  ${C.dates}`, W / 2, e.l3 + (1 - k3) * 20, e.l3s, { w: 500, color: 'rgba(245,243,239,0.75)', align: 'center' });
    c.restore();
    // Przycisk CTA.
    const kc = E.outBack(seg(t, T.ctaIn, T.ctaIn + 0.3), 2);
    const press = t >= T.ctaClick ? Math.exp(-(t - T.ctaClick) * 10) : 0;
    const lit = t >= T.ctaClick;
    c.save(); c.translate(W / 2, e.cta + e.ctaH / 2); c.scale(kc * (1 - 0.06 * press), kc * (1 - 0.06 * press));
    c.shadowColor = 'rgba(255,59,47,0.6)'; c.shadowBlur = 50 + 40 * Math.sin(t * 6) ** 2;
    rr(c, -e.ctaW / 2, -e.ctaH / 2, e.ctaW, e.ctaH, e.ctaH / 2); c.fillStyle = lit ? RED : '#F5F3EF'; c.fill();
    c.shadowColor = 'transparent';
    text(c, C.cta, -e.ctaS * 0.9, e.ctaS * 0.36, e.ctaS, { w: 800, color: '#0B0C0E', align: 'center' });
    arrow(c, e.ctaW / 2 - e.ctaH * 0.6, 0, e.ctaS * 1.1, '#0B0C0E', e.ctaS * 0.13);
    c.restore();
    const ku = E.outCubic(seg(t, T.ctaIn + 0.15, T.ctaIn + 0.45));
    c.save(); c.globalAlpha = ku;
    text(c, C.domain, W / 2, e.url, V ? 40 : 34, { w: 700, fam: 'mono', color: '#F5F3EF', align: 'center', ls: 4 });
    c.restore();
    if (t >= T.ctaIn + 0.2) drawCursor(c, t);
    if (cur < 1) { c.fillStyle = RED; c.fillRect(0, 0, W, H * (1 - cur)); }
  }

  // ---------------------------------------------------------------- przejście w głąb pieczątki
  function diveOverlay(c, t) {
    const k = seg(t, T.dive[0] + 0.24, T.dive[1]);
    if (k > 0) { c.fillStyle = `rgba(255,59,47,${E.inCubic(k)})`; c.fillRect(0, 0, W, H); }
  }

  // ---------------------------------------------------------------- postprodukcja
  function post(t) {
    const g = glitchAt(t);
    const f = Math.floor(t * 30);
    let shake = 16 * g;
    if (t >= T.drop && t < T.end) for (let b = T.drop; b < T.end; b += 0.5) shake += 12 * pulse(t, b, 16);
    shake += 26 * pulse(t, T.stamp, 18) + 10 * pulse(t, T.end, 12);
    const sx0 = (hash(f, 501) - 0.5) * shake, sy0 = (hash(f, 502) - 0.5) * shake;
    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1; ctx.filter = 'none';
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
    // Rozmycie promieniste przy zjeździe w pieczątkę.
    const zb = t >= T.dive[0] && t < T.dive[1] ? E.inCubic(seg(t, T.dive[0], T.dive[1])) : 0;
    let src = S;
    if (zb > 0.02) {
      px.globalAlpha = 1; px.drawImage(S, 0, 0);
      for (let i = 1; i <= 5; i++) {
        const s = 1 + i * 0.035 * zb;
        px.globalAlpha = 1 / (i + 1);
        px.drawImage(S, W / 2 - (W * s) / 2, H / 2 - (H * s) / 2, W * s, H * s);
      }
      px.globalAlpha = 1; src = P;
    }
    if (g > 0.03) {
      // Rozszczepienie kanałów RGB.
      const off = 30 * g;
      ctx.globalCompositeOperation = 'lighter';
      [['#ff0000', off, 0], ['#00ff00', 0, 0], ['#0000ff', -off, off * 0.3]].forEach(([col, dx, dy]) => {
        qx.globalCompositeOperation = 'source-over'; qx.drawImage(src, 0, 0);
        qx.globalCompositeOperation = 'multiply'; qx.fillStyle = col; qx.fillRect(0, 0, W, H);
        ctx.drawImage(Q, sx0 + dx, sy0 + dy);
      });
      ctx.globalCompositeOperation = 'source-over';
      // Przesunięte pasy obrazu.
      if (g > 0.1) {
        px.globalAlpha = 1; px.drawImage(cv, 0, 0);
        const n = 4 + Math.floor(g * 18);
        for (let i = 0; i < n; i++) {
          const y = hash(f, i, 1) * H, h = 4 + hash(f, i, 2) * (V ? 110 : 80) * g;
          const dx = (hash(f, i, 3) - 0.5) * 260 * g;
          ctx.drawImage(P, 0, y, W, h, dx, y, W, h);
        }
      }
      // Bloki „uszkodzonych danych”.
      if (g > 0.35) {
        const n = Math.floor(g * 12);
        for (let i = 0; i < n; i++) {
          const w = 40 + hash(f, i, 11) * 300, h = 10 + hash(f, i, 12) * 90;
          const x = hash(f, i, 13) * W, y = hash(f, i, 14) * H;
          ctx.drawImage(P, hash(f, i, 15) * W, hash(f, i, 16) * H, w, h, x, y, w, h);
          if (hash(f, i, 17) < 0.35) { ctx.fillStyle = hash(f, i, 18) < 0.5 ? 'rgba(255,59,47,0.85)' : 'rgba(245,243,239,0.85)'; ctx.fillRect(x, y, w * 0.4, h * 0.3); }
        }
      }
      ctx.globalAlpha = 0.12 + 0.25 * g; ctx.fillStyle = scanPat; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1;
      if (g > 0.8 && hash(f, 900) < 0.35) { ctx.globalCompositeOperation = 'difference'; ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, H); ctx.globalCompositeOperation = 'source-over'; }
    } else {
      ctx.drawImage(src, sx0, sy0);
    }
    // Błyski na mocnych uderzeniach.
    const fl = [[T.black, '255,255,255', 0.9, 14], [T.percent, '255,59,47', 0.55, 12], [T.end, '255,255,255', 0.4, 10], [T.stamp, '255,59,47', 0.3, 14], [T.ctaClick, '255,59,47', 0.18, 10]];
    for (const [t0, col, a, d] of fl) { const v = a * pulse(t, t0, d); if (v > 0.01) { ctx.fillStyle = `rgba(${col},${v})`; ctx.fillRect(0, 0, W, H); } }
    // Ziarno filmu i winieta.
    ctx.save(); ctx.globalCompositeOperation = 'overlay'; ctx.globalAlpha = 0.09;
    ctx.translate(-hash(f, 700) * 256, -hash(f, 701) * 256); ctx.fillStyle = grainPat; ctx.fillRect(0, 0, W + 256, H + 256); ctx.restore();
    ctx.drawImage(vignette, 0, 0);
  }

  // ---------------------------------------------------------------- jedna klatka
  function draw(t) {
    sx.save(); sx.globalAlpha = 1; sx.globalCompositeOperation = 'source-over';
    if (t < T.drop) {
      drawSite(sx, t);
      if (t >= T.dive[0]) diveOverlay(sx, t);
      if (t >= T.dive[1]) { sx.fillStyle = '#000'; sx.fillRect(0, 0, W, H); }
    } else if (t < T.end) drawKinetic(sx, t);
    else drawEnd(sx, t);
    sx.restore();
    post(t);
  }

  // ---------------------------------------------------------------- start
  async function init(opts) {
    cv = opts.canvas; W = cv.width = opts.width; H = cv.height = opts.height; V = H > W;
    ctx = cv.getContext('2d');
    S = mk(W, H); sx = S.getContext('2d');
    P = mk(W, H); px = P.getContext('2d');
    Q = mk(W, H); qx = Q.getContext('2d');
    const fonts = ['400 20px Archivo', '900 20px Archivo', 'italic 400 20px "Source Serif 4"', '500 20px "Source Serif 4"', '400 20px "JetBrains Mono"', '700 20px "JetBrains Mono"'];
    await Promise.all(fonts.flatMap((f) => [document.fonts.load(f, 'AaŁąść−'), document.fonts.load(f, 'Aa')]));
    await document.fonts.ready;
    const assets = opts.assets || {};
    const gen = { golden: photoGolden, night: photoNight, lake: photoLake };
    for (const k of Object.keys(gen)) photo[k] = (assets[k] && (await loadImg(assets[k]))) || gen[k](1800, 1150);
    if (assets.logo) logoImg = await loadImg(assets.logo);
    const gr = mk(256, 256), gx = gr.getContext('2d'), id = gx.createImageData(256, 256);
    for (let i = 0; i < id.data.length; i += 4) { const v = Math.floor(hash(i, 3) * 255); id.data[i] = id.data[i + 1] = id.data[i + 2] = v; id.data[i + 3] = 255; }
    gx.putImageData(id, 0, 0); grainPat = ctx.createPattern(gr, 'repeat');
    const sl = mk(4, 4), slx = sl.getContext('2d'); slx.fillStyle = 'rgba(0,0,0,0.9)'; slx.fillRect(0, 0, 4, 2); scanPat = ctx.createPattern(sl, 'repeat');
    vignette = mk(W, H); const vx = vignette.getContext('2d');
    const vg = vx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.hypot(W, H) * 0.6);
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.5)'); vx.fillStyle = vg; vx.fillRect(0, 0, W, H);
    L = layout(); CP = cursorPath();
    fitCache.clear();
  }

  window.KWFilm = { init, draw, get duration() { return C.duration; } };
})();
