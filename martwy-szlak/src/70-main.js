'use strict';

/* ---------- Stan aplikacji ---------- */
const $ = id => document.getElementById(id);
const REDUCED = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
let mode = 'loading';                 // loading | menu | play | pause | end
let lastStart = { level: 0, opt: {} };
let carry = null;                     // oddział przechodzący z poziomu 1 na poziom 2
const stage = $('stage');

/* ---------- HUD ---------- */
function showBanner(t, s, danger) {
  const el = $('banner');
  el.querySelector('b').textContent = t;
  el.querySelector('span').textContent = s || '';
  el.className = ''; void el.offsetWidth; el.className = 'show' + (danger ? ' danger' : '');
}
function hudCoins() { if (S) $('coins').textContent = S.coins; }
const ICONS = {};
function weaponIcon(key) {
  if (ICONS[key] != null) return ICONS[key];
  const s = SPR[key]; let url = '';
  if (s) { const im = s.frames[0].img; if (im.src) url = im.src; else try { url = im.toDataURL(); } catch (e) { url = ''; } }
  return (ICONS[key] = url);
}
let hc = {};
function hud() {
  if (hc.w !== S.weapon) { hc.w = S.weapon; const w = WEAPONS[S.weapon]; $('wName').textContent = w.name; $('wImg').src = weaponIcon(w.spr); }
  if (hc.c !== S.coins) { hc.c = S.coins; $('coins').textContent = S.coins; }
  const p = Math.round(progress() * 100);
  if (hc.p !== p) { hc.p = p; $('prog').firstElementChild.style.width = p + '%'; }
  const b = S.boss && S.boss.state !== 'enter' && S.boss.state !== 'dead' ? S.boss : null;
  if (!!b !== hc.b) { hc.b = !!b; $('bossbar').hidden = !b; if (b) $('bossName').textContent = b.B.name; }
  if (b) { const f = Math.max(0, b.hp / b.max); if (Math.abs((hc.bf ?? -1) - f) > 0.003) { hc.bf = f; $('bossHp').style.width = (f * 100).toFixed(1) + '%'; } }
}

/* ---------- Przebieg gry ---------- */
function resetFx() {
  partN = 0; floatN = 0; FLASHES.length = 0; shakeT = 0; whiteT = 0;
  ring.ok = false; fog = null;
}
// Klatki hordy i oddziału budujemy przed startem, żeby pierwsza fala nie przycinała.
function prewarm() {
  for (const k of ['z1', 'z2', 'z3', 'zr', 'zb', 'zx', 'soldier']) {
    const s = SPR[k]; if (!s) continue;
    for (let f = 0; f < s.frames.length; f++) for (let v = 0; v < 3; v++) {
      frameCache(k, f, v, false, false); frameCache(k, f, v, false, true);
      if (k !== 'soldier') { frameCache(k, f, v, true, false); frameCache(k, f, v, true, true); }
    }
  }
  for (let t = 0; t < PACK_VARIANTS; t++) for (let f = 0; f < 4; f++) for (let v = 1; v < 3; v++) packCache(t, f, v);
}
function startLevel(level, opt = {}) {
  AUDIO.init();
  rndSeed = (Date.now() ^ Math.floor(Math.random() * 1e9)) | 0;
  buildPackTemplates();
  PACKC.clear();
  newGame(level, opt);
  lastStart = { level, opt };
  resetFx();
  hc = {};
  prewarm();
  $('menu').hidden = $('end').hidden = $('pause').hidden = true;
  $('hud').hidden = false;
  $('lvlName').textContent = opt.bossOnly ? 'Trening: ' + BOSSES[level].name : S.L.name;
  mode = 'play';
}
function endScreen(win) {
  mode = 'end';
  $('banner').className = '';
  const st = S.stats;
  let title = 'Oddział padł';
  if (win) title = S.bossOnly ? S.boss.B.name + ' pokonany' : S.level === 0 ? 'Autostrada zaliczona' : 'Strefa oczyszczona';
  $('endTitle').textContent = title;
  const lines = [
    `Zabite zombie: <b>${st.kills}</b>`,
    `Żołnierze: <b>+${st.gained}</b> zebranych, <b>−${st.lost}</b> straconych`,
    `Ocalali: <b>${S.n}</b>`,
    `Broń: <b>${WEAPONS[S.weapon].name}</b>`,
    `Monety: <b>${S.coins}</b>`,
  ];
  if (!S.bossOnly) lines.push(`Przejęte bramki: <b>${st.panelsTaken} z ${st.panels}</b>`);
  $('endStats').innerHTML = lines.join('<br>');
  const next = win && S.level === 0 && !S.bossOnly;
  if (next) carry = { n: Math.max(S.n, 20), weapon: Math.max(S.weapon, 2), coins: S.coins };
  $('nextBtn').hidden = !next;
  $('retryBtn').textContent = win ? 'Zagraj jeszcze raz' : 'Spróbuj ponownie';
  $('hud').hidden = true;
  $('end').hidden = false;
  (next ? $('nextBtn') : $('retryBtn')).focus({ preventScroll: true });
}
function toMenu() {
  mode = 'menu';
  $('hud').hidden = $('end').hidden = $('pause').hidden = true;
  $('menu').hidden = false;
  $('muteBtn').textContent = AUDIO.muted ? 'Dźwięk: wył.' : 'Dźwięk: wł.';
}
const fpsHist = [];
function pause() {
  if (mode !== 'play') return;
  mode = 'pause';
  const avg = fpsHist.length ? fpsHist.reduce((a, b) => a + b, 0) / fpsHist.length : 0;
  $('pauseStats').innerHTML = `Oddział: <b>${S.n}</b><br>Płynność: <b>${avg ? Math.round(1 / avg) : '–'} kl./s</b>`;
  $('pause').hidden = false;
  $('resumeBtn').focus({ preventScroll: true });
}
function resume() { if (mode !== 'pause') return; $('pause').hidden = true; mode = 'play'; last = performance.now(); }

/* ---------- Przyciski ---------- */
document.querySelectorAll('[data-start]').forEach(b => b.addEventListener('click', () => {
  const lv = +b.dataset.start;
  startLevel(lv, lv === 1 && carry ? carry : {});
}));
document.querySelectorAll('[data-boss]').forEach(b => b.addEventListener('click', () => {
  const id = +b.dataset.boss;
  startLevel(id, id === 0 ? { bossOnly: true, n: 40, weapon: 2 } : { bossOnly: true, n: 70, weapon: 4 });
}));
$('muteBtn').addEventListener('click', () => { AUDIO.init(); const m = AUDIO.toggle(); $('muteBtn').textContent = m ? 'Dźwięk: wył.' : 'Dźwięk: wł.'; });
$('nextBtn').addEventListener('click', () => startLevel(1, carry || {}));
$('retryBtn').addEventListener('click', () => startLevel(lastStart.level, lastStart.opt));
$('endMenuBtn').addEventListener('click', toMenu);
$('pauseBtn').addEventListener('click', pause);
$('resumeBtn').addEventListener('click', resume);
$('pauseMenuBtn').addEventListener('click', toMenu);

/* ---------- Sterowanie ---------- */
let drag = null;
stage.addEventListener('pointerdown', e => {
  if (mode !== 'play' || e.target.closest('button')) return;
  drag = { x: e.clientX, tx: S.tx };
});
window.addEventListener('pointermove', e => {
  if (!drag || mode !== 'play') return;
  const k = LW / stage.getBoundingClientRect().width;
  S.tx = clamp(drag.tx + (e.clientX - drag.x) * k * 1.25, PX_MIN, PX_MAX);
});
const endDrag = () => { drag = null; };
window.addEventListener('pointerup', endDrag);
window.addEventListener('pointercancel', endDrag);
const keys = { l: false, r: false };
window.addEventListener('keydown', e => {
  if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') keys.l = true;
  else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') keys.r = true;
  else if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') { if (mode === 'play') pause(); else if (mode === 'pause') resume(); }
});
window.addEventListener('keyup', e => {
  if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') keys.l = false;
  else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') keys.r = false;
});
document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });
window.addEventListener('resize', () => { resize(); if (mode === 'play' || mode === 'pause') { prewarm(); if (mode === 'pause') draw(); } });

/* ---------- Pętla ---------- */
let last = performance.now(), testSpeed = 1;
function frame(now) {
  requestAnimationFrame(frame);
  const raw = (now - last) / 1000;
  last = now;
  if (mode !== 'play') return;
  const dt = Math.min(0.033, raw);
  fpsHist.push(Math.min(raw, 0.25)); if (fpsHist.length > 300) fpsHist.shift();
  const dir = (keys.r ? 1 : 0) - (keys.l ? 1 : 0);
  if (dir) S.tx = clamp(S.tx + dir * 340 * dt, PX_MIN, PX_MAX);
  // testSpeed > 1 tylko w testach automatycznych: kilka kroków symulacji na klatkę.
  for (let i = 0; i < testSpeed; i++) {
    const frozen = S.hitStop > 0;
    update(dt);
    if (!frozen) updateFx(dt);
    if (S.over === 'dead!' || S.over === 'win!') break;
  }
  draw();
  hud();
  if (S.over === 'dead!' || S.over === 'win!') { const win = S.over === 'win!'; S.over = 'done'; endScreen(win); }
}

/* ---------- Start aplikacji ---------- */
async function boot(data) {
  if (data && data.carry) carry = data.carry;
  resize();
  await loadImages();
  buildRegistry();
  try { await Promise.race([document.fonts.load('20px Bungee'), new Promise(r => setTimeout(r, 2500))]); } catch (e) { /* zostaje krój zapasowy */ }
  resetCaches();
  if (IMG.key) $('menu').style.backgroundImage = `url(${IMG.key.src})`;
  $('loading').hidden = true;
  toMenu();
  requestAnimationFrame(frame);
}
// Po ponownej publikacji artefaktu zachowujemy oddział przechodzący na poziom 2.
const hot = window.claude && window.claude.hot;
try { if (hot && hot.snapshot) hot.snapshot(() => ({ carry })); } catch (e) { /* bez zachowania stanu */ }
let booted = false;
const bootOnce = data => { if (!booted) { booted = true; boot(data || {}); } };
try { if (hot && hot.ready) hot.ready(bootOnce); else bootOnce(hot && hot.data); } catch (e) { bootOnce({}); }
// Uchwyt do testów automatycznych.
window.__game = { get S() { return S; }, get mode() { return mode; }, start: startLevel, toMenu, pause, resume,
  fps: () => fpsHist.length / Math.max(0.001, fpsHist.reduce((a, b) => a + b, 0)), speed(k) { testSpeed = Math.max(1, Math.min(8, k | 0)); } };
