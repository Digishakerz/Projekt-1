// Symulacja balansu bez renderu: te same pliki danych i logiki co w grze, bot zamiast gracza.
// Użycie: node tools/sim.mjs [liczba_przebiegów] [chciwość_bramek 0..1]
// Cel ze specyfikacji: gracz biorący ok. 70% bramek dochodzi do bossa z 25-40 żołnierzami (poziom 1) i 50-80 (poziom 2).
import fs from 'fs';
import path from 'path';
import url from 'url';
import vm from 'vm';

const here = path.dirname(url.fileURLToPath(import.meta.url));
const src = f => fs.readFileSync(path.join(here, '..', 'src', f), 'utf8');
const ctx = vm.createContext({ Math, console });
vm.runInContext(src('30-data.js') + '\n' + src('40-sim.js') + `
globalThis.API = { newGame, update, setGeometry, buildPackTemplates, getS: () => S, setSeed: s => { rndSeed = s; },
  WEAPONS, ZT, LANES, squadMul, laneOf, G, BOSSES };`, ctx);
const A = ctx.API;

const runs = +(process.argv[2] || 20);
const greed = +(process.argv[3] || 0.8); globalThis.greed = greed;

// Bot: najpierw przeżycie (horda), potem okazje (bramki, broń, przeszkody).
function makeBot(seed) {
  let t = 0, decided = -1, lane = 1, tx = 200;
  const wants = new Map();               // czy bot w ogóle idzie na daną bramkę (symuluje ~70% skuteczności)
  let r = seed >>> 0;
  const rand = () => { r = (r * 1664525 + 1013904223) >>> 0; return r / 4294967296; };
  return function (S, dt) {
    t += dt;
    if (t - decided < 0.2) { S.tx = tx; return; }
    decided = t;
    const L = A.LANES.map(l => l.cx);
    const w = A.WEAPONS[S.weapon];
    const dps = w.rate * Math.min(S.n, 8) * w.dmg * A.squadMul(S.n) * 0.7;
    let hp = 0, front = Infinity, laneHp = [0, 0, 0];
    for (const z of S.zombies) if (!z.dead && z.state === 0 && z.wy < 900) { hp += z.hp; front = Math.min(front, z.wy); laneHp[A.laneOf(z.x)] += z.hp; }
    for (const p of S.packs) if (p.wy < 900) { hp += 6 * A.ZT.walker.hp * p.hpMul; front = Math.min(front, p.wy); laneHp[1] += 6 * A.ZT.walker.hp * p.hpMul; }
    const tArrive = (front - 20) / (S.V + 26), tKill = hp / Math.max(1, dps);
    const urgent = hp > 0 && (tKill > tArrive - 1.2 || front < 200);
    lane = 1; tx = L[1];
    if (S.boss && S.boss.state !== 'dead') {
      const b = S.boss;
      const bad = new Set();
      if (S.warn) bad.add(S.warn.lane);
      for (const h of S.hazards) if (h.wy - 75 < 30) bad.add(h.lane);
      for (const th of S.throws) if (th.t / th.dur > 0.3) bad.add(th.lane);
      const pref = urgent ? laneHp.indexOf(Math.max(...laneHp)) : A.laneOf(b.x);
      const order = [pref, 1, 0, 2];
      lane = order.find(l => !bad.has(l)) ?? 1;
      tx = L[lane];
    } else if (urgent) {
      // Najpierw zombie, które dojdą najszybciej: ustaw wachlarz ognia na nich.
      let near = null;
      for (const z of S.zombies) if (!z.dead && z.state === 0 && (!near || z.wy < near.wy)) near = z;
      if (near && near.wy < 320 && Math.abs(near.x - S.sx) > 40) { tx = Math.max(60, Math.min(340, near.x)); lane = A.laneOf(tx); }
      else { lane = laneHp.indexOf(Math.max(...laneHp)); tx = L[lane]; }
    } else {
      const panel = S.panels.find(p => !p.done && p.wy < 760);
      if (panel && !wants.has(panel)) wants.set(panel, rand() < greed);
      const ob = S.obst.find(o => !o.passed && o.wy < 760);
      const pk = S.pickups.find(p => p.wy < 300 && p.wy > 0);
      if (S.drop && S.drop.state !== 'fall') { lane = 2; tx = S.drop.x; }
      else if (pk) { lane = A.laneOf(pk.x); tx = pk.x; }
      else if (ob && ob.hp > 0 && ob.wy < 170) { lane = 1; tx = L[1]; }     // nierozbita przeszkoda zaraz uderzy: zejdź z pasa
      else if (panel && wants.get(panel) && !(panel.v < 1 && panel.wy < 110)) { lane = 0; tx = panel.wy < 260 ? panel.x : L[0]; }
      else if (ob && ob.hp > 0) { lane = 0; tx = L[0]; }
      else if (S.ped && (S.ped.state === 'park' || S.ped.state === 'leave')) { lane = 2; tx = L[2]; }
    }
    S.tx = tx;
  };
}

function runLevel(level, opt, seed) {
  A.setGeometry(865);
  A.setSeed(seed);
  A.buildPackTemplates();
  A.newGame(level, opt);
  const S = A.getS();
  const bot = makeBot(seed * 7 + 3);
  const dt = 1 / 60;
  let atBoss = null, bossT0 = 0, minN = S.n;
  for (let i = 0; i < 60 * 400; i++) {
    bot(S, dt);
    A.update(dt);
    minN = Math.min(minN, S.n);
    if (S.boss && atBoss === null) { atBoss = { n: S.n, t: S.t, weapon: S.weapon }; bossT0 = S.t; }
    if (S.over === 'win!' || S.over === 'dead!') break;
  }
  return { win: S.over === 'win!', t: S.t, n: S.n, atBoss, bossTime: S.boss ? S.t - bossT0 : 0, weapon: S.weapon, kills: S.stats.kills, lost: S.stats.lost, gained: S.stats.gained,
    panels: S.stats.panelsTaken + '/' + S.stats.panels, coins: S.coins, lostBy: S.stats.lostBy, gainBy: S.stats.gainBy };
}

const avg = a => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN);
const q = (a, p) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.floor(p * (s.length - 1))] : NaN; };
function report(name, res) {
  const wins = res.filter(r => r.win).length;
  const ab = res.filter(r => r.atBoss).map(r => r.atBoss.n);
  const bt = res.filter(r => r.win).map(r => r.bossTime);
  console.log(`${name}: wygrane ${wins}/${res.length}, czas ${avg(res.map(r => r.t)).toFixed(0)} s, ` +
    `przy bossie ${ab.length ? `${q(ab, 0.1)}-${q(ab, 0.5)}-${q(ab, 0.9)} (p10-med-p90)` : 'nikt'}, walka z bossem ${avg(bt).toFixed(0)} s, ` +
    `na końcu ${avg(res.map(r => r.n)).toFixed(0)}, zebrani ${avg(res.map(r => r.gained)).toFixed(0)}, straceni ${avg(res.map(r => r.lost)).toFixed(0)}, ` +
    `broń przy bossie ${avg(res.filter(r => r.atBoss).map(r => r.atBoss.weapon)).toFixed(1)}, bramki ${res[0].panels}`);
  const sum = key => { const o = {}; for (const r of res) for (const [k, v] of Object.entries(r[key])) o[k] = (o[k] || 0) + v / res.length; return Object.entries(o).map(([k, v]) => k + ' ' + v.toFixed(1)).join(', '); };
  console.log('   straty: ' + sum('lostBy') + ' | zyski: ' + sum('gainBy'));
}
const r1 = [], r2 = [], r2c = [];
for (let s = 1; s <= runs; s++) {
  const a = runLevel(0, {}, s * 101);
  r1.push(a);
  r2.push(runLevel(1, {}, s * 131));
  if (a.win) r2c.push(runLevel(1, { n: Math.max(a.n, 20), weapon: Math.max(a.weapon, 2), coins: a.coins }, s * 151));
}
report('Poziom 1', r1);
report('Poziom 2 (start domyślny)', r2);
if (r2c.length) report('Poziom 2 (oddział z poziomu 1)', r2c);
