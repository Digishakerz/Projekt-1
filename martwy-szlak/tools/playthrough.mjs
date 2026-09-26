// Pełne przejście poziomów w Chromium z przyspieszonym czasem: sprawdza błędy, przejścia ekranów i robi zrzuty kluczowych chwil.
// Użycie: node tools/playthrough.mjs [katalog_na_zrzuty]
import { createRequire } from 'module';
import path from 'path';
import url from 'url';
const require = createRequire(import.meta.url);
let pw;
try { pw = require('playwright'); } catch { pw = require('/opt/node22/lib/node_modules/playwright'); }
const here = path.dirname(url.fileURLToPath(import.meta.url));
const out = process.argv[2] || path.join(here, '..', 'shots');
const file = 'file://' + path.join(here, '..', 'app', 'martwy-szlak.html');
const browser = await pw.chromium.launch();
const page = await browser.newPage({ viewport: { width: 400, height: 860 }, deviceScaleFactor: 2 });
const errors = [];
page.on('pageerror', e => errors.push('pageerror: ' + e.message));
page.on('console', m => { if (m.type() === 'error' && !m.text().includes('ERR_CERT')) errors.push(m.text()); });
await page.goto(file);
await page.waitForFunction(() => window.__game && window.__game.mode === 'menu', null, { timeout: 20000 });

// Bot w przeglądarce (ta sama logika co w tools/sim.mjs, uproszczona).
await page.evaluate(() => {
  window.__bot = () => {
    const S = window.__game.S; if (!S || window.__game.mode !== 'play') return;
    const L = [83, 200, 317];
    let tx = 200, near = null, hp = 0;
    for (const z of S.zombies) if (!z.dead && z.state === 0) { hp += z.hp; if (!near || z.wy < near.wy) near = z; }
    for (const p of S.packs) hp += 60 * p.hpMul;
    const front = Math.min(near ? near.wy : 9999, ...S.packs.map(p => p.wy));
    const urgent = hp > 0 && front < 420;
    if (S.boss && S.boss.state !== 'dead') {
      const bad = new Set(); if (S.warn) bad.add(S.warn.lane);
      for (const h of S.hazards) if (h.wy - 75 < 30) bad.add(h.lane);
      for (const t of S.throws) if (t.t / t.dur > 0.3) bad.add(t.lane);
      const lane = [1, 0, 2].find(l => !bad.has(l)) ?? 1; tx = L[lane];
    } else if (urgent) tx = near && near.wy < 320 ? Math.max(60, Math.min(340, near.x)) : 200;
    else {
      const panel = S.panels.find(p => !p.done && p.wy < 760), ob = S.obst.find(o => !o.passed && o.wy < 760);
      if (S.drop && S.drop.state !== 'fall') tx = S.drop.x;
      else if (ob && ob.hp > 0 && ob.wy < 170) tx = 200;
      else if (panel && !(panel.v < 1 && panel.wy < 110)) tx = panel.wy < 260 ? panel.x : 83;
      else if (ob && ob.hp > 0) tx = 83;
      else if (S.ped && (S.ped.state === 'park' || S.ped.state === 'leave')) tx = 317;
    }
    S.tx = tx;
  };
  setInterval(window.__bot, 50);
});
const shot = name => page.screenshot({ path: path.join(out, name + '.png') });
async function playUntilEnd(label, marks) {
  const done = new Set();
  for (let i = 0; i < 2400; i++) {
    await page.waitForTimeout(100);
    const st = await page.evaluate(() => { const S = window.__game.S; return { mode: window.__game.mode, t: S.t, boss: !!S.boss, bossHp: S.boss ? S.boss.hp / S.boss.max : 1, n: S.n, drop: !!S.drop, ped: S.ped && S.ped.state, panels: S.panels.length, obst: S.obst.length, warn: !!S.warn, hazards: S.hazards.length }; });
    for (const [name, cond] of marks) if (!done.has(name) && cond(st)) { done.add(name); await shot(`${label}-${name}`); }
    if (st.mode !== 'play') { await shot(`${label}-end`); return st; }
  }
  return null;
}
await page.evaluate(() => { window.__game.start(0); window.__game.speed(4); });
const r1 = await playUntilEnd('L1', [['start', s => s.t > 1], ['ped', s => s.ped === 'park'], ['panel', s => s.panels > 0 && s.t > 9], ['ice', s => s.obst > 0 && s.t > 33], ['drop', s => s.drop], ['boss', s => s.boss && s.bossHp < 0.9], ['warn', s => s.warn], ['bossLow', s => s.boss && s.bossHp < 0.3]]);
console.log('L1:', JSON.stringify(r1), await page.evaluate(() => document.getElementById('endTitle').textContent));
const next = await page.evaluate(() => !document.getElementById('nextBtn').hidden);
if (next) await page.click('#nextBtn'); else await page.evaluate(() => window.__game.start(1));
await page.evaluate(() => window.__game.speed(4));
const r2 = await playUntilEnd('L2', [['start', s => s.t > 2], ['panel', s => s.panels > 0 && s.t > 8], ['container', s => s.obst > 0 && s.t > 22], ['boss', s => s.boss && s.bossHp < 0.9], ['acid', s => s.hazards > 0], ['phase2', s => s.boss && s.bossHp < 0.45]]);
console.log('L2:', JSON.stringify(r2), await page.evaluate(() => document.getElementById('endTitle').textContent));
console.log(errors.length ? 'BŁĘDY:\n' + [...new Set(errors)].join('\n') : 'Brak błędów konsoli.');
await browser.close();
