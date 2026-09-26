'use strict';

/* ---------- Geometria ekranu (liczona przy zmianie rozmiaru) ---------- */
const G = { LH: 865, Yp: 692, topWy: 1175, botWy: -390, splitWy: 488, parkWy: 371, leaveWy: 177, homeWy: 700 };
function setGeometry(LH) {
  G.LH = LH;
  G.Yp = LH * PLAYER_Y;
  G.topWy = (G.Yp + 36) / DEPTH;              // tuż nad górną krawędzią ekranu
  G.botWy = -(LH - G.Yp + 70) / DEPTH;        // pod dolną krawędzią
  G.splitWy = (G.Yp - LH * SPLIT_Y) / DEPTH;  // granica LOD hordy
  G.parkWy = PED_PARK_PX / DEPTH;
  G.leaveWy = PED_LEAVE_PX / DEPTH;
  G.homeWy = (G.Yp - LH * 0.30) / DEPTH;      // boss stoi na 30% wysokości ekranu
}
// Rzut pseudo-ortograficzny: wy -> y (logiczne px), skala sprite'ów i zwężenie drogi zależą od y.
const scrY = wy => G.Yp - wy * DEPTH;
const kS = y => SCALE_TOP + (1 - SCALE_TOP) * clamp(y / G.LH, 0, 1);
const kX = y => ROADW_TOP + (1 - ROADW_TOP) * clamp(y / G.LH, 0, 1);
const scrX = (x, y) => LW / 2 + (x - LW / 2) * kX(y);

/* ---------- Efekty: sim tylko zgłasza, render rysuje ---------- */
const NOOP = () => {};
const FX = {
  blood: NOOP, decal: NOOP, hitSpark: NOOP, dmg: NOOP, float: NOOP, shake: NOOP, sound: NOOP, banner: NOOP,
  muzzle: NOOP, glass: NOOP, shards: NOOP, coins: NOOP, soldierDown: NOOP, explosion: NOOP, pickup: NOOP,
  weaponBeam: NOOP, bossDown: NOOP, zombieDown: NOOP, acid: NOOP, flame: NOOP, bossPhase: NOOP,
};

/* ---------- Formacja oddziału: plaster heksagonalny za liderem ---------- */
const FORM = [];
(function () {
  for (let r = 0; FORM.length < SQ_DRAW_MAX; r++) {
    const c = r < 7 ? r + 1 : r % 2 ? 6 : 7;
    for (let j = 0; j < c && FORM.length < SQ_DRAW_MAX; j++) FORM.push({ dx: (j - (c - 1) / 2) * SQ_DX, dwy: -r * SQ_DY, row: r });
  }
})();
// Strzelcy: najbardziej wysunięty żołnierz w każdej kolumnie, najwyżej 8 rozłożonych na szerokość.
const SHOOT = [[]];
for (let n = 1; n <= SQ_DRAW_MAX; n++) {
  const cols = new Map();
  for (let i = 0; i < n; i++) { const f = FORM[i]; const k = Math.round(f.dx); if (!cols.has(k) || FORM[cols.get(k)].row > f.row) cols.set(k, i); }
  const list = [...cols.entries()].sort((a, b) => a[0] - b[0]).map(e => e[1]);
  const out = [];
  if (list.length <= SHOOTERS_MAX) out.push(...list);
  else for (let i = 0; i < SHOOTERS_MAX; i++) out.push(list[Math.round(i * (list.length - 1) / (SHOOTERS_MAX - 1))]);
  SHOOT.push(out);
}
const HALFW = [0];
for (let n = 1; n <= SQ_DRAW_MAX; n++) { let m = 0; for (let i = 0; i < n; i++) m = Math.max(m, Math.abs(FORM[i].dx)); HALFW.push(m + 7); }
const drawnN = n => Math.min(n, SQ_DRAW_MAX);
const squadHalfW = () => HALFW[Math.max(1, drawnN(S.n))];

/* ---------- Szablony grup LOD ---------- */
const PACK_TPL = [];
function buildPackTemplates() {
  PACK_TPL.length = 0;
  for (let v = 0; v < PACK_VARIANTS; v++) {
    const m = [];
    for (let r = 0; r < PACK_ROWS; r++) for (let c = 0; c < PACK_COLS; c++) {
      m.push({ dx: (c - (PACK_COLS - 1) / 2) * PACK_DX + rnd(-3, 3) + (r % 2 ? 4 : -2), dwy: r * PACK_DY + rnd(-2.5, 2.5),
        spr: pick(ZT.walker.spr), ph: rnd(0, 4), flip: rnd01() < 0.5, as: rnd(0.85, 1.15) });
    }
    m.sort((a, b) => b.dwy - a.dwy);   // dalsi najpierw: kolejność rysowania
    PACK_TPL.push(m);
  }
}

/* ---------- Pula pocisków ---------- */
const BUL = [];
for (let i = 0; i < 520; i++) BUL.push({ x: 0, wy: 0, pw: 0, vx: 0, v: 0, dmg: 0, vol: 0, pierce: 1, range: 0, trav: 0, flame: false, last: null, age: 0, x0: 0, tx: 0 });
const FAN_W = 92, FAN_D = 110;   // strumienie rozchodzą się na szerokość pasa w pierwszych 110 jednostkach
let bulN = 0;

/* ---------- Stan gry ---------- */
let S = null;
function newGame(level, opt = {}) {
  const L = LEVELS[level];
  S = {
    level, L, t: 0, scroll: 0, V: L.speed, Vt: L.speed,
    n: opt.n ?? L.startN, weapon: opt.weapon ?? L.startWeapon, coins: opt.coins ?? 0,
    sx: 200, tx: 200, fireT: 0.2, vol: 0, shot: 0,
    zombies: [], packs: [], waves: [], waveSeq: 0,
    panels: [], obst: [], pickups: [], props: [], hazards: [], throws: [], warn: null,
    ped: null, drop: null, pedQueue: [], boss: null, bossSeen: false,
    ev: 0, evWait: 0, propT: 0, lampT: 0,
    stats: { kills: 0, gained: 0, lost: 0, panels: 0, panelsTaken: 0, dmg: 0, start: opt.n ?? L.startN, lostBy: {}, gainBy: {} },
    hitStop: 0, over: null, overT: -1, dmgNumT: 0,
    bossOnly: !!opt.bossOnly,
  };
  bulN = 0;
  if (opt.bossOnly) { S.ev = L.script.length; S.bossT = 1.2; }
  // Propsy od razu na całej długości widoku, żeby pobocze nie było puste na starcie.
  for (let wy = G.botWy; wy < G.topWy; wy += rnd(120, 200)) spawnProp(wy);
  return S;
}

/* ---------- Skrypt poziomu ---------- */
function runScript(dt) {
  const sc = S.L.script;
  if (S.bossT != null) { S.bossT -= dt; if (S.bossT <= 0) { S.bossT = null; startBoss(S.level === 0 ? 0 : 1); } }
  while (S.ev < sc.length && sc[S.ev][0] <= S.t) {
    const [, k, o] = sc[S.ev];
    if (k === 'boss') {
      // Boss czeka, aż pole się oczyści (najwyżej 8 s).
      S.evWait += dt;
      if (S.zombies.length + S.packs.length > 0 && S.evWait < 8) return;
      startBoss(o.id);
    } else if (k === 'banner') FX.banner(o.t, o.s, false);
    else if (k === 'horde') spawnHorde(o);
    else if (k === 'panel') spawnPanel(o);
    else if (k === 'obst') spawnObst(o);
    else if (k === 'ped') queuePed(o.tier, o.need);
    S.ev++; S.evWait = 0;
  }
}

/* ---------- Horda ---------- */
function addZombie(type, spr, x, wy, hpMul, wave, o = {}) {
  const T = ZT[type];
  const z = {
    type, T, spr, x, wy, hp: T.hp * hpMul, max: T.hp * hpMul, sp: o.sp ?? rnd(T.sp[0], T.sp[1]), r: T.r, h: T.h * rnd(0.95, 1.05),
    eat: T.eat, ph: o.ph ?? rnd(0, 4), as: o.as ?? rnd(0.85, 1.15), flip: o.flip ?? rnd01() < 0.5, hitT: 0, drift: NaN,
    state: 0, slot: 0, wave, dead: false, dmgAcc: 0,
  };
  // Co 6.-8. zombie skręca na boczny pas i wymusza reakcję.
  if (type !== 'brute' && rnd01() < 1 / 7) z.drift = rnd01() < 0.5 ? rnd(LANES[0].x0 + 14, LANES[0].x1 - 10) : rnd(LANES[2].x0 + 10, LANES[2].x1 - 14);
  S.zombies.push(z);
  if (wave) wave.alive++;
  return z;
}
function spawnHorde(o) {
  const hpMul = S.L.hpMul * (o.hp || 1);
  const wave = { id: ++S.waveSeq, alive: 0, total: 0, front: Infinity };
  S.waves.push(wave);
  const nW = o.walker || 0, nPacks = Math.floor(nW / 6);
  const specials = [];
  for (const k of ['runner', 'brute', 'exploder']) for (let i = 0; i < (o[k] || 0); i++) specials.push(k);
  const y0 = G.topWy + 24, colW = PACK_COLS * PACK_DX, rowD = PACK_ROWS * PACK_DY + 3;
  let row = 0, col = 0;
  for (let i = 0; i < nPacks; i++) {
    const x = LANES[1].cx + (col - 0.5) * (colW + 5) + rnd(-3, 3);
    S.packs.push({ x, wy: y0 + row * rowD + rnd(-2, 2), tpl: rndi(0, PACK_VARIANTS - 1), sp: rnd(22, 27), wave, hpMul });
    wave.alive += PACK_COLS * PACK_ROWS;
    if (++col >= 2) { col = 0; row++; }
  }
  const depth = Math.max(1, row + (col ? 1 : 0)) * rowD;
  for (let i = 0; i < nW - nPacks * 6; i++) addZombie('walker', pick(ZT.walker.spr), rnd(LANES[1].x0 + 12, LANES[1].x1 - 12), y0 + depth + rnd(0, 14), hpMul, wave);
  for (const k of specials) {
    const wy = k === 'brute' ? y0 + rnd(0, depth * 0.5) : y0 + rnd(-10, depth + 20);
    addZombie(k, pick(ZT[k].spr), rnd(LANES[1].x0 + 16, LANES[1].x1 - 16), wy, hpMul, wave);
  }
  wave.total = wave.alive;
}
function splitPack(pk) {
  const tpl = PACK_TPL[pk.tpl];
  for (const m of tpl) addZombie('walker', m.spr, pk.x + m.dx, pk.wy + m.dwy, pk.hpMul, null, { sp: pk.sp + rnd(-2, 2), ph: m.ph, flip: m.flip, as: m.as }).wave = pk.wave;
  pk.dead = true;
}
function killZombie(z, how) {
  if (z.dead) return;
  z.dead = true;
  if (z.wave) z.wave.alive--;
  if (how === 'shot') {
    S.stats.kills++;
    FX.zombieDown(z);
    if (z.T.explode) explode(z.x, z.wy, 44, 30 * S.L.hpMul);
  }
}
function explode(x, wy, r, dmg) {
  FX.explosion(x, wy, 'toxic');
  for (const o of S.zombies) if (!o.dead && Math.abs(o.x - x) < r && Math.abs(o.wy - wy) < r * 0.8) { o.hp -= dmg; o.hitT = 0.06; if (o.hp <= 0) killZombie(o, 'shot'); }
  // Wybuch tuż przy oddziale też boli.
  if (wy < 40 && Math.abs(x - S.sx) < squadHalfW() + 10) loseSoldiers(2, x, 'boom');
}

/* ---------- Oddział ---------- */
function loseSoldiers(k, x, why) {
  if (k <= 0 || S.n <= 0) return;
  const before = S.n;
  S.n = Math.max(0, S.n - k);
  const lost = before - S.n;
  S.stats.lost += lost;
  S.stats.lostBy[why] = (S.stats.lostBy[why] || 0) + lost;
  for (let i = 0; i < Math.min(lost, 6); i++) {
    const slot = Math.min(drawnN(before) - 1 - i, SQ_DRAW_MAX - 1);
    if (slot >= 0) FX.soldierDown(S.sx + FORM[slot].dx, FORM[slot].dwy);
  }
  FX.float('−' + lost, 'r', (x ?? S.sx) + (why === 'bite' ? 0 : 38), 30, 62, lost >= 5 ? 30 : 22);
  FX.shake(lost >= 5 ? 4 : 2, 0.15);
  FX.sound(lost >= 5 ? 'hurtBig' : 'hurt');
  if (S.n <= 0 && S.overT < 0) { S.over = 'dead'; S.overT = 1.1; }
}
function gainSoldiers(k, x, why = 'other') {
  if (k <= 0) return;
  S.n += k; S.stats.gained += k;
  S.stats.gainBy[why] = (S.stats.gainBy[why] || 0) + k;
  FX.float('+' + k, 'b', (x ?? S.sx) + 38, 30, 70, 30);
  FX.sound('gain');
}

/* ---------- Ogień ---------- */
// Żołnierze strzelają po kolei (a nie wszyscy naraz), więc pociski tworzą ciągłe strumienie.
// Salwa (S.vol) to pełny obieg wszystkich strzelców: tyle bramka liczy jako jedno trafienie.
function fire(dt) {
  if (S.n <= 0) return;
  const w = WEAPONS[S.weapon];
  const shooters = SHOOT[drawnN(S.n)], ns = shooters.length;
  S.fireT -= dt;
  let shots = 0;
  while (S.fireT <= 0) {
    S.fireT += 1 / (w.rate * ns);
    if (S.shot >= ns) { S.shot = 0; }
    if (S.shot === 0) S.vol++;
    const i = S.shot++;
    if (bulN >= BUL.length) continue;
    const fw = Math.max(FAN_W, squadHalfW() * 2 - 14);
    const f = FORM[shooters[i]], b = BUL[bulN++];
    b.x = b.x0 = S.sx + f.dx + 3; b.wy = b.pw = f.dwy + 8; b.dmg = w.dmg * squadMul(S.n); b.vol = S.vol; b.last = null; b.trav = 0; b.age = 0;
    // Strumień i celuje w swój pas ognia: rozchodzą się wachlarzem na szerokość pasa, potem lecą prosto w górę.
    b.tx = S.sx + (ns > 1 ? (i / (ns - 1) - 0.5) * fw : 0) + rnd(-2, 2);
    if (w.flame) { b.flame = true; b.v = 760; b.vx = rnd(-40, 40); b.pierce = w.pierce; b.range = w.range; }
    else { b.flame = false; b.v = BULLET_SPEED; b.vx = rnd(-6, 6); b.pierce = 1; b.range = 99999; FX.muzzle(b.x, f.dwy); }
    shots++;
  }
  if (shots) { if (w.flame) FX.flame(); else FX.sound('shot' + S.weapon); }
}

/* ---------- Pociski i trafienia ---------- */
const BUCKET = 20, NB = Math.ceil((LW + 80) / BUCKET) + 2;
const buckets = Array.from({ length: NB }, () => []);
const bIdx = x => clamp(Math.floor((x + 40) / BUCKET), 0, NB - 1);
function rebuildBuckets() {
  for (const b of buckets) b.length = 0;
  for (const z of S.zombies) if (!z.dead && z.state === 0) buckets[bIdx(z.x)].push(z);
}
function hitZombie(z, b) {
  z.hp -= b.dmg; z.hitT = 0.06; z.wy += b.flame ? 0.6 : 2.2;   // lekki odrzut
  S.stats.dmg += b.dmg;
  if (z.T !== ZT.walker || rnd01() < 0.18) z.dmgAcc += b.dmg;
  FX.blood(z.x, z.wy, z.h * 0.55, 2);
  if (z.hp <= 0) killZombie(z, 'shot');
}
function updateBullets(dt) {
  rebuildBuckets();
  const ped = S.ped, boss = S.boss;
  for (let i = bulN - 1; i >= 0; i--) {
    const b = BUL[i];
    b.pw = b.wy; b.lx = b.x; b.age += dt;
    const step = b.v * dt;
    b.wy += step; b.trav += step;
    if (b.trav < FAN_D) b.x = lerp(b.x0, b.tx, b.trav / FAN_D) + b.vx * b.age;
    else b.x = b.tx + b.vx * b.age;
    let dead = b.wy > G.topWy + 40 || b.trav > b.range || b.x < -40 || b.x > LW + 40;
    // Szukamy pierwszego celu na drodze pocisku (najmniejsze wy wejścia).
    for (let guard = 0; !dead && guard < 4; guard++) {
      let best = null, bw = Infinity, kind = 0;
      const lo = bIdx(b.x - 18), hi = bIdx(b.x + 18);
      for (let k = lo; k <= hi; k++) for (const z of buckets[k]) {
        if (z.dead || z === b.last || Math.abs(b.x - z.x) > z.r + 1.5) continue;
        if (b.pw <= z.wy + 10 && b.wy >= z.wy - 6) { const e = Math.max(b.pw, z.wy - 6); if (e < bw) { bw = e; best = z; kind = 1; } }
      }
      for (const pk of S.packs) {
        if (pk.dead || Math.abs(b.x - pk.x) > 30) continue;
        if (b.pw <= pk.wy + 26 && b.wy >= pk.wy - 6) { const e = Math.max(b.pw, pk.wy - 6); if (e < bw) { bw = e; best = pk; kind = 2; } }
      }
      for (const p of S.panels) {
        if (p.done || p === b.last || Math.abs(b.x - p.x) > PANEL_W / 2) continue;
        if (b.pw <= p.wy + 4 && b.wy >= p.wy - 4) { const e = Math.max(b.pw, p.wy - 4); if (e < bw) { bw = e; best = p; kind = 3; } }
      }
      for (const o of S.obst) {
        if (o.dead || o === b.last || Math.abs(b.x - o.x) > o.w / 2) continue;
        if (b.pw <= o.wy + 14 && b.wy >= o.wy - 14) { const e = Math.max(b.pw, o.wy - 14); if (e < bw) { bw = e; best = o; kind = 4; } }
      }
      if (ped && (ped.state === 'park' || ped.state === 'leave') && ped !== b.last && Math.abs(b.x - ped.x) < 40 && b.pw <= ped.wy + 16 && b.wy >= ped.wy - 16) {
        const e = Math.max(b.pw, ped.wy - 16); if (e < bw) { bw = e; best = ped; kind = 5; }
      }
      if (boss && boss.state !== 'enter' && boss.state !== 'dead' && boss !== b.last && Math.abs(b.x - boss.x) < boss.B.r && b.pw <= boss.wy + 36 && b.wy >= boss.wy - 12) {
        const e = Math.max(b.pw, boss.wy - 12); if (e < bw) { bw = e; best = boss; kind = 6; }
      }
      if (!best) break;
      b.wy = bw;
      if (kind === 2) { splitPack(best); rebuildBuckets(); continue; }
      b.last = best;
      if (kind === 1) hitZombie(best, b);
      else if (kind === 3) {
        if (best.lastVol !== b.vol) { best.lastVol = b.vol; best.v = Math.min(best.mul ? 1 : best.cap, best.v + 1); best.hitT = 0.07; }
        FX.hitSpark(b.x, best.wy, 30, 'glass');
      } else if (kind === 4) {
        best.hp -= b.dmg; best.hitT = 0.06; best.dmgAcc += b.dmg; S.stats.dmg += b.dmg;
        FX.hitSpark(b.x, best.wy, 30, best.kind === 'safe' ? 'metal' : 'ice');
      } else if (kind === 5) {
        best.pts = Math.min(best.need, best.pts + 1); best.hitT = 0.06;
        FX.hitSpark(b.x, best.wy, 26, 'metal');
      } else if (kind === 6) {
        const d = b.dmg * (best.shield ? 0.3 : 1);
        best.hp -= d; best.hitT = 0.05; best.dmgAcc += d; S.stats.dmg += d;
        FX.hitSpark(b.x, best.wy, 60, best.shield ? 'metal' : 'flesh');
      }
      if (--b.pierce <= 0) { dead = true; break; }
    }
    if (dead) { BUL[i] = BUL[--bulN]; BUL[bulN] = b; }
  }
}

/* ---------- Zombie ---------- */
function updateZombies(dt) {
  const zs = S.zombies;
  for (const pk of S.packs) {
    if (pk.dead) continue;
    pk.wy -= (S.V + pk.sp) * dt;
    if (pk.wy < G.splitWy) splitPack(pk);
  }
  for (let i = 0; i < zs.length; i++) {
    const z = zs[i];
    if (z.dead) continue;
    z.hitT -= dt;
    if (z.state === 0) {
      z.wy -= (S.V + z.sp) * dt;
      // Blisko oddziału zombie skręcają w jego stronę; wcześniej część odbija na boczne pasy.
      if (z.wy < 260) z.x += clamp(S.sx - z.x, -38 * dt, 38 * dt);
      else if (z.drift === z.drift) z.x += clamp(z.drift - z.x, -24 * dt, 24 * dt);
      z.x = clamp(z.x, ROAD_L + 6, ROAD_R - 6);
      if (z.wy < 34) {
        if (Math.abs(z.x - S.sx) > squadHalfW() + 26) z.state = 2;   // za daleko: mija oddział
        else {
          // Zombie dopadł oddziału: rzuca się na najbliższego żołnierza.
          z.state = 1;
          const n = drawnN(S.n);
          let best = 0, bd = Infinity;
          for (let s = 0; s < n; s++) { const d = Math.abs(S.sx + FORM[s].dx - z.x) + Math.abs(FORM[s].dwy - z.wy) * 0.5; if (d < bd) { bd = d; best = s; } }
          z.slot = best;
        }
      }
    } else if (z.state === 2) {
      z.wy -= (S.V + z.sp) * dt;
    } else {
      const f = FORM[Math.min(z.slot, Math.max(0, drawnN(S.n) - 1))];
      const tx = S.sx + f.dx, ty = f.dwy, dx = tx - z.x, dy = ty - z.wy, d = Math.hypot(dx, dy);
      const sp = 170 * dt;
      if (d <= sp + 6 || S.n <= 0) {
        killZombie(z, 'bite');
        if (S.n > 0) {
          if (z.T.explode) FX.explosion(z.x, z.wy, 'toxic');
          loseSoldiers(z.eat, z.x, 'bite');
          FX.blood(tx, ty, 14, 8);
          FX.decal('blood', tx, ty, 16);
        }
      } else { z.x += dx / d * sp; z.wy += dy / d * sp; }
    }
    if (z.wy < G.botWy) z.dead = true;
  }
  // Usuwamy martwe (kolejność nie ma znaczenia, i tak sortujemy).
  let w = 0;
  for (let i = 0; i < zs.length; i++) if (!zs[i].dead) zs[w++] = zs[i];
  zs.length = w;
  if (S.packs.some(p => p.dead)) S.packs = S.packs.filter(p => !p.dead);
  // Sortowanie przez wstawianie (lista jest prawie posortowana): dalsi najpierw.
  for (let i = 1; i < zs.length; i++) { const z = zs[i]; let j = i - 1; while (j >= 0 && zs[j].wy < z.wy) { zs[j + 1] = zs[j]; j--; } zs[j + 1] = z; }
  // Miękkie rozpychanie, żeby tłum był gęsty, ale się nie nakładał.
  for (let i = 0; i < zs.length; i++) {
    const a = zs[i]; if (a.state) continue;
    for (let j = i + 1; j < zs.length && a.wy - zs[j].wy < 9; j++) {
      const b = zs[j]; if (b.state) continue;
      const dx = b.x - a.x, m = (a.r + b.r) * 0.9, ad = Math.abs(dx);
      if (ad < m) { const p = (m - ad) * 0.25 * (dx >= 0 ? 1 : -1); a.x -= p; b.x += p; }
    }
  }
  // Pokazujemy obrażenia zbiorczo, żeby liczby nie zasłaniały tłumu.
  S.dmgNumT -= dt;
  if (S.dmgNumT <= 0) {
    S.dmgNumT = 0.12;
    for (const z of zs) if (z.dmgAcc > 0) { FX.dmg(Math.round(z.dmgAcc), z.x, z.wy, z.h + 6, z.T === ZT.brute ? 'y' : 'w'); z.dmgAcc = 0; }
    for (const o of S.obst) if (o.dmgAcc > 0) { FX.dmg(Math.round(o.dmgAcc), o.x + rnd(-14, 14), o.wy, o.h * 0.9, 'y'); o.dmgAcc = 0; }
    const bs = S.boss;
    if (bs && bs.dmgAcc > 0) { FX.dmg(Math.round(bs.dmgAcc), bs.x + rnd(-30, 30), bs.wy, bs.B.h * 0.7, 'y'); bs.dmgAcc = 0; }
  }
  // Fale: licznik i pozycja czoła do czerwonej plakietki.
  for (const wv of S.waves) wv.front = Infinity;
  for (const z of zs) if (z.wave && z.state === 0 && z.wy < z.wave.front) { z.wave.front = z.wy; z.wave.fx = z.x; }
  for (const pk of S.packs) if (pk.wy < pk.wave.front) { pk.wave.front = pk.wy; pk.wave.fx = pk.x; }
  S.waves = S.waves.filter(wv => wv.alive > 0);
}

/* ---------- Bramki (lewy pas) ---------- */
function spawnPanel(o) {
  // cap: najwyższa wartość bramki (dla bramki mnożącej: najwięcej żołnierzy, jakich może dodać).
  S.panels.push({ x: LANES[0].cx, wy: G.topWy + 30, v: o.v, mul: o.mul || 0, cap: o.cap || 99, lastVol: -1, hitT: 0, done: false, taken: false, ph: rnd(0, Math.PI * 2) });
  S.stats.panels++;
}
function updatePanels(dt) {
  const per = S.L.panelPeriod;
  for (const p of S.panels) {
    p.wy -= S.V * dt; p.hitT -= dt;
    p.x = LANES[0].cx + PANEL_AMP * Math.sin(S.t * Math.PI * 2 / per + p.ph);
    if (!p.done && p.wy <= 6) {
      p.done = true;
      if (Math.abs(S.sx - p.x) < PANEL_W / 2 + squadHalfW() * 0.5) {
        p.taken = true;
        const v = Math.floor(p.v);
        FX.glass(p.x, p.wy, v > 0);
        if (v > 0) {
          S.stats.panelsTaken++;
          if (p.mul) gainSoldiers(Math.min(S.n * (p.mul - 1), p.cap), p.x, 'mul');
          else gainSoldiers(v, p.x, 'gate');
          FX.sound('gate');
        } else if (v < 0) loseSoldiers(-v, p.x, 'gate');
        else FX.sound('gate');
      }
    }
  }
  S.panels = S.panels.filter(p => p.wy > G.botWy && !(p.taken && p.wy < -40));
}

/* ---------- Lód, kontenery, sejfy (lewy pas) ---------- */
function spawnObst(o) {
  const D = OBST[o.kind];
  S.obst.push({ kind: o.kind, x: LANES[0].cx, wy: G.topWy + 40, hp: o.hp, max: o.hp, reward: o.reward || {}, hitT: 0, dmgAcc: 0, w: D.w, h: D.h, dead: false });
}
function updateObst(dt) {
  for (const o of S.obst) {
    if (o.dead) continue;
    o.wy -= S.V * dt; o.hitT -= dt;
    if (o.hp <= 0) {
      o.dead = true;
      FX.shards(o.x, o.wy, o.kind);
      FX.shake(3, 0.15);
      FX.sound(o.kind === 'safe' ? 'safe' : 'ice');
      const r = o.reward;
      if (r.coins) { S.coins += r.coins; FX.coins(o.x, o.wy, r.coins); }
      if (r.soldiers) S.pickups.push({ kind: 'crate', x: o.x, wy: o.wy - 30, val: r.soldiers, t: 0 });
      if (r.part) S.pickups.push({ kind: 'part', x: o.x + 20, wy: o.wy - 50, val: r.part, t: 0 });
    } else if (!o.passed && o.wy <= 10) {
      // Nierozbita przeszkoda na linii oddziału: kto w nią wbiegnie, ginie.
      if (Math.abs(S.sx - o.x) < o.w / 2 + squadHalfW() * 0.5) {
        o.dead = true;
        loseSoldiers(Math.max(3, Math.ceil(o.hp / OBST[o.kind].perLoss)), o.x, 'wall');
        FX.shards(o.x, o.wy, o.kind);
        FX.sound(o.kind === 'safe' ? 'thud' : 'ice');
        FX.shake(4, 0.15);
      } else o.passed = true;
    }
  }
  S.obst = S.obst.filter(o => !o.dead && o.wy > G.botWy);
}

/* ---------- Znajdźki: skrzynki z żołnierzami, części broni ---------- */
function updatePickups(dt) {
  for (const p of S.pickups) {
    p.t += dt; p.wy -= S.V * dt;
    if (!p.got && p.wy < 16 && p.wy > -30 && Math.abs(S.sx - p.x) < 26 + squadHalfW() * 0.5) {
      p.got = true;
      if (p.kind === 'crate') gainSoldiers(p.val, p.x, 'crate');
      else if (p.kind === 'part') {
        const ped = S.ped;
        if (ped && ped.state !== 'empty') { ped.pts = Math.min(ped.need, ped.pts + Math.ceil(ped.need * p.val)); FX.float('+' + Math.round(p.val * 100) + '%', 'y', p.x, 20, 50, 24); }
        else { S.coins += 15; FX.coins(p.x, 20, 15); }
      }
      FX.pickup(p.x, p.wy, p.kind);
    }
  }
  S.pickups = S.pickups.filter(p => !p.got && p.wy > G.botWy);
}

/* ---------- Broń na podeście (prawy pas) ---------- */
function queuePed(tier, need) {
  if (tier <= S.weapon && tier <= WEAPON_MAX) tier = WEAPON_MAX + 1;     // tę broń już mamy: podest da żołnierzy
  S.pedQueue.push({ tier, need, at: S.t });
}
function updatePed(dt) {
  if (!S.ped && !S.drop && S.pedQueue.length && S.pedQueue[0].at <= S.t && !S.boss) {
    const q = S.pedQueue.shift();
    // Podest pojawia się od razu 230 px nad oddziałem (spec: nie przy górnej krawędzi).
    S.ped = { state: 'appear', x: LANES[2].cx, wy: G.parkWy, tier: q.tier, need: q.need, pts: 0, hitT: 0, t: 0, h: 0 };
    FX.weaponBeam(S.ped.x, S.ped.wy); FX.sound('charge');
  }
  const p = S.ped;
  if (p) {
    p.t += dt; p.hitT -= dt;
    if (p.state === 'appear') { p.wy -= S.V * PED_SLOW * dt; if (p.t > 0.45) p.state = 'park'; }
    else if (p.state === 'park') { p.wy -= S.V * PED_SLOW * dt; if (p.wy <= G.leaveWy) p.state = 'leave'; }
    else if (p.state === 'leave' || p.state === 'empty') p.wy -= S.V * dt;
    if ((p.state === 'park' || p.state === 'leave') && p.pts >= p.need) {
      p.state = 'launch'; p.t = 0;
      FX.weaponBeam(p.x, p.wy);
      FX.sound('charge');
    }
    if (p.state === 'launch') {
      p.wy -= S.V * PED_SLOW * dt;
      p.h = Math.sin(Math.min(1, p.t / 0.55) * Math.PI * 0.5) * 70;
      if (p.t >= 0.6) {
        S.drop = { x: p.x, wy: p.wy - 26, h: p.h, vh: 60, state: 'fall', tier: p.tier, t: 0 };
        p.state = 'empty'; p.h = 0;
      }
    }
    if (p.wy < G.botWy) {
      if (p.state === 'leave') { S.pedQueue.unshift({ tier: p.tier, need: p.need, at: S.t + 7 }); FX.float('Broń uciekła', 'r', p.x, 30, 30, 16); }
      S.ped = null;
    }
  }
  const d = S.drop;
  if (d) {
    d.t += dt;
    if (d.state === 'fall') {
      d.wy -= S.V * PED_SLOW * dt;
      d.vh -= 520 * dt; d.h += d.vh * dt;
      if (d.h <= 0) { d.h = 0; if (Math.abs(d.vh) > 90) d.vh = -d.vh * 0.35; else { d.state = 'slide'; d.vh = 0; } }
    } else if (d.state === 'slide') { d.wy -= Math.max(S.V * 1.4, 150) * dt; if (d.wy <= 46) { d.wy = 46; d.state = 'wait'; d.t = 0; } }
    else if (d.state === 'wait') { if (d.t > 6) d.state = 'lost'; }
    else if (d.state === 'lost') d.wy -= S.V * dt;
    if (d.state !== 'fall' && d.wy < 70 && d.wy > -20 && Math.abs(S.sx - d.x) < 34 + squadHalfW() * 0.45) {
      if (d.tier > WEAPON_MAX) gainSoldiers(PED_SOLDIERS, d.x, 'ped');
      else {
        S.weapon = d.tier;
        FX.banner(WEAPONS[d.tier].name, 'Nowa broń w rękach oddziału', false);
        FX.float(WEAPONS[d.tier].name + '!', 'y', d.x, 40, 60, 20);
      }
      FX.pickup(d.x, d.wy, 'weapon');
      FX.sound('weapon');
      S.hitStop = 0.07;
      S.drop = null;
    } else if (d.wy < G.botWy) {
      S.pedQueue.unshift({ tier: d.tier, need: Math.round(d.tier > WEAPON_MAX ? 300 : WEAPON_NEED(d.tier) * 0.6), at: S.t + 6 });
      S.drop = null;
    }
  }
}
const WEAPON_NEED = t => [0, 30, 80, 150, 250][t] || 300;

/* ---------- Bossowie ---------- */
function startBoss(id) {
  const B = BOSSES[id];
  S.boss = { id, B, hp: B.hp, max: B.hp, x: LW / 2, wy: G.topWy + 90, state: 'enter', t: 0, atkT: B.every + 1, lane: 1, shield: false,
    summoned: false, phase: 1, hitT: 0, dmgAcc: 0, biteT: 0, tx: LW / 2, twy: 0, sumT: 6, pose: 'walk' };
  S.bossSeen = true;
  FX.banner('Boss: ' + B.name, B.sub, true);
  FX.sound('roar');
}
function chooseLane() { const sl = laneOf(S.sx); return rnd01() < 0.7 ? sl : rndi(0, 2); }
function updateBoss(dt) {
  const b = S.boss;
  if (!b) return;
  b.t += dt; b.hitT -= dt;
  if (b.state === 'dead') { if (b.t > 2.4 && !S.over) { S.over = 'win'; S.overT = 0; } return; }
  if (b.state !== 'enter' && b.hp <= 0) {
    b.state = 'dead'; b.t = 0; S.hitStop = 0.08;
    S.coins += 50; S.warn = null; S.hazards.length = 0; S.throws.length = 0;
    FX.bossDown(b); FX.coins(b.x, b.wy, 50); FX.shake(4, 0.3); FX.sound('bossDown');
    FX.banner(b.B.name + ' pokonany', '+50 monet', false);
    for (const z of S.zombies) killZombie(z, 'shot');
    return;
  }
  if (b.state === 'enter') { b.wy -= 150 * dt; if (b.wy <= G.homeWy) { b.wy = G.homeWy; b.state = 'idle'; b.t = 0; } return; }
  // Przy połowie zdrowia: Buldożer wzywa hordę, Kocioł zrzuca pancerz.
  if (!b.summoned && b.hp <= b.max * 0.5) {
    b.summoned = true;
    if (b.id === 0) { spawnHorde({ walker: 18, runner: 2 }); FX.banner('Buldożer wzywa hordę', '20 zombie w drodze', true); FX.sound('roar'); }
    else { b.phase = 2; FX.bossPhase(b); FX.banner('Kocioł zrzuca pancerz', 'Szybszy i wściekły', true); FX.sound('roar'); FX.shake(3, 0.2); }
  }
  if (b.id === 0) updateBulldozer(b, dt); else updateCauldron(b, dt);
}
function updateBulldozer(b, dt) {
  if (b.state === 'idle') {
    b.pose = 'walk'; b.shield = false;
    b.wy -= 7 * dt;
    b.x += clamp(LW / 2 + (S.sx - LW / 2) * 0.3 - b.x, -30 * dt, 30 * dt);
    if (b.wy < 60) { b.wy = 60; b.biteT -= dt; if (b.biteT <= 0) { b.biteT = 0.6; loseSoldiers(2, b.x, 'boss'); } }
    b.atkT -= dt;
    if (b.atkT <= 0) { b.state = 'warn'; b.t = 0; b.lane = chooseLane(); S.warn = { lane: b.lane, t: 0 }; b.pose = 'charge'; b.shield = true; FX.sound('warn'); }
  } else if (b.state === 'warn') {
    b.x += clamp(lerp(LW / 2, LANES[b.lane].cx, 0.35) - b.x, -80 * dt, 80 * dt);
    if (b.t > 1.2) { b.state = 'charge'; b.t = 0; b.hitDone = false; b.cx0 = b.x; b.cw0 = b.wy; }
  } else if (b.state === 'charge') {
    // Szarża po skosie w dół zaznaczonego pasa.
    const tx = LANES[b.lane].cx, dx = tx - b.x, dy = 10 - b.wy, d = Math.hypot(dx, dy), sp = 720 * dt;
    if (d > sp) { b.x += dx / d * sp; b.wy += dy / d * sp; } else { b.x = tx; b.wy = 10; }
    if (!b.hitDone && b.wy < 60) {
      b.hitDone = true;
      FX.shake(4, 0.2); FX.sound('slam');
      if (laneOf(S.sx) === b.lane || Math.abs(S.sx - tx) < 40 + squadHalfW() * 0.3) loseSoldiers(Math.floor(S.n * 0.25) + 4, S.sx, 'boss');
      else FX.float('Unik!', 'b', S.sx, 30, 50, 22);
    }
    if (d <= sp) { b.state = 'back'; b.t = 0; S.warn = null; }
  } else if (b.state === 'back') {
    b.shield = false; b.pose = 'walk';
    const dx = LW / 2 - b.x, dy = G.homeWy - b.wy, d = Math.hypot(dx, dy), sp = 330 * dt;
    if (d > sp) { b.x += dx / d * sp; b.wy += dy / d * sp; } else { b.x = LW / 2; b.wy = G.homeWy; b.state = 'idle'; b.atkT = b.B.every; }
  }
  if (b.hitT > 0 && b.state === 'idle') b.pose = 'hit';
}
function updateCauldron(b, dt) {
  const p2 = b.phase === 2;
  b.x = LW / 2 + Math.sin(S.t * (p2 ? 0.9 : 0.6)) * (p2 ? 60 : 40);
  // Kocioł powoli podchodzi, żeby miotacz ognia go dosięgnął.
  if (b.wy > G.homeWy * 0.72) b.wy -= 6 * dt;
  b.atkT -= dt;
  if (b.state === 'idle') {
    b.pose = b.hitT > 0 ? 'hit' : 'walk';
    if (b.atkT <= 0) { b.state = 'throw'; b.t = 0; b.pose = 'throw'; }
  } else if (b.state === 'throw') {
    if (b.t > 0.35) {
      const lanes = [chooseLane()];
      if (p2 && rnd01() < 0.45) { let l2 = rndi(0, 2); if (l2 === lanes[0]) l2 = (l2 + 1) % 3; lanes.push(l2); }
      for (const l of lanes) S.throws.push({ x0: b.x, wy0: b.wy + 40, x1: LANES[l].cx, wy1: rnd(30, 120), lane: l, t: 0, dur: 1.0 });
      FX.sound('throw');
      b.state = 'idle'; b.atkT = p2 ? b.B.every2 : b.B.every;
    }
  }
  b.sumT -= dt;
  if (b.sumT <= 0) { b.sumT = p2 ? 6 : 8; for (let i = 0; i < (p2 ? 4 : 3); i++) addZombie('exploder', 'zx', b.x + rnd(-40, 40), b.wy - rnd(10, 40), S.L.hpMul, null); }
}
function updateHazards(dt) {
  for (const th of S.throws) {
    th.t += dt;
    if (th.t >= th.dur) {
      th.done = true;
      S.hazards.push({ lane: th.lane, x: LANES[th.lane].cx, wy: th.wy1, life: 3.0, tick: 0 });
      FX.acid(LANES[th.lane].cx, th.wy1);
      FX.sound('splash');
    }
  }
  S.throws = S.throws.filter(t => !t.done);
  for (const h of S.hazards) {
    h.life -= dt; h.wy -= S.V * dt;
    const L = LANES[h.lane];
    if (S.sx > L.x0 - 8 && S.sx < L.x1 + 8 && h.wy - 75 < 10 && h.wy + 75 > -20) {
      h.tick -= dt;
      if (h.tick <= 0) { h.tick = 0.35; loseSoldiers(1, S.sx, 'acid'); }
    } else h.tick = 0;
  }
  S.hazards = S.hazards.filter(h => h.life > 0);
  if (S.warn) S.warn.t += dt;
}

/* ---------- Dekoracje na poboczach ---------- */
function spawnProp(wy) {
  const list = S.L.props;
  const side = rnd01() < 0.5 ? -1 : 1;
  const spr = pick(list);
  const big = spr === 'p_bus' || spr === 'p_tanker' || spr === 'p_container';
  const x = side < 0 ? rnd(big ? -40 : -24, big ? -6 : 8) : rnd(big ? 406 : 392, big ? 440 : 424);
  S.props.push({ spr, x, wy, flip: side > 0 ? rnd01() < 0.8 : rnd01() < 0.2 });
}
function updateProps(dt) {
  S.propT -= S.V * dt;
  if (S.propT <= 0) { S.propT = rnd(130, 240); spawnProp(G.topWy + 90); }
  if (S.L.theme === 'toxic') {
    S.lampT -= S.V * dt;
    if (S.lampT <= 0) { S.lampT = 380; S.props.push({ spr: 'p_lamp', x: -8, wy: G.topWy + 120, lamp: true }); S.props.push({ spr: 'p_lamp', x: 408, wy: G.topWy + 310, lamp: true, flip: true }); }
  }
  for (const p of S.props) p.wy -= S.V * dt;
  S.props = S.props.filter(p => p.wy > G.botWy - 60);
}

/* ---------- Główna aktualizacja ---------- */
function update(dt) {
  if (!S || S.over === 'done') return;
  if (S.hitStop > 0) { S.hitStop -= dt; return; }
  S.t += dt;
  // Podczas walki z bossem droga zwalnia do 35%.
  S.Vt = S.boss ? S.L.speed * 0.35 : S.L.speed;
  S.V += clamp(S.Vt - S.V, -60 * dt, 60 * dt);
  S.scroll += S.V * dt;
  runScript(dt);
  S.sx += clamp(S.tx - S.sx, -460 * dt, 460 * dt);
  S.sx = clamp(S.sx, PX_MIN, PX_MAX);
  fire(dt);
  updateBullets(dt);
  updateZombies(dt);
  updatePanels(dt);
  updateObst(dt);
  updatePickups(dt);
  updatePed(dt);
  updateBoss(dt);
  updateHazards(dt);
  updateProps(dt);
  if (S.overT >= 0) { S.overT -= dt; if (S.overT < 0) S.over = S.over === 'win' ? 'win!' : 'dead!'; }
}
// Postęp poziomu 0..1 do paska u góry.
function progress() {
  const sc = S.L.script, bt = sc[sc.length - 1][0];
  if (S.boss) return 0.9 + 0.1 * (1 - Math.max(0, S.boss.hp) / S.boss.max);
  return Math.min(0.9, (S.t / bt) * 0.9);
}
