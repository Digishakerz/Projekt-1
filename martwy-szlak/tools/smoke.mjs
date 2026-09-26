// Test dymny: otwiera zbudowaną grę w Chromium, gra chwilę botem, zapisuje zrzuty i błędy konsoli.
// Użycie: node tools/smoke.mjs [katalog_na_zrzuty] [sekundy_gry]
import { createRequire } from 'module';
import path from 'path';
import url from 'url';
const require = createRequire(import.meta.url);
let pw;
try { pw = require('playwright'); } catch { pw = require('/opt/node22/lib/node_modules/playwright'); }
const here = path.dirname(url.fileURLToPath(import.meta.url));
const out = process.argv[2] || path.join(here, '..', 'shots');
const secs = +(process.argv[3] || 12);
const file = 'file://' + path.join(here, '..', 'app', 'martwy-szlak.html');

const browser = await pw.chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: 400, height: 860 }, deviceScaleFactor: 2 });
const errors = [];
page.on('pageerror', e => errors.push('pageerror: ' + e.message));
page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errors.push(m.type() + ': ' + m.text()); });
await page.goto(file);
await page.waitForFunction(() => window.__game && window.__game.mode === 'menu', null, { timeout: 20000 });
await page.screenshot({ path: path.join(out, 'menu.png') });

// Prosty bot: co 150 ms wybiera pas jak rozsądny gracz.
const bot = () => page.evaluate(() => {
  const S = window.__game.S; if (!S) return;
  const L = [83, 200, 317];
  let lane = 1;
  const threat = Math.min(...S.zombies.filter(z => z.state === 0).map(z => z.wy), ...S.packs.map(p => p.wy), 9999);
  const panel = S.panels.find(p => !p.done && p.wy < 900);
  const ob = S.obst.find(o => o.wy < 800 && !o.passed);
  if (S.boss) { lane = 1; if (S.warn && S.warn.lane === 1) lane = 0; }
  else if (S.drop) lane = 2;
  else if (threat < 330) lane = 1;
  else if (panel && (panel.v <= 0 || panel.wy < 300)) lane = 0;
  else if (ob && !(ob.wy < 90 && ob.hp > 0)) lane = 0;
  else if (S.ped && S.ped.state !== 'empty') lane = 2;
  S.tx = lane === 0 && panel && panel.wy < 200 ? panel.x : L[lane];
});

async function play(label, start, seconds) {
  await page.evaluate(start);
  const shots = (globalThis.SHOTS || [2, Math.round(seconds / 2), seconds]);
  for (let t = 0; t <= seconds * 1000; t += 150) {
    await bot();
    await page.waitForTimeout(150);
    const s = t / 1000;
    if (shots.some(x => Math.abs(x - s) < 0.075)) await page.screenshot({ path: path.join(out, `${label}-${Math.round(s)}s.png`) });
    const mode = await page.evaluate(() => window.__game.mode);
    if (mode !== 'play') break;
  }
  const info = await page.evaluate(() => { const S = window.__game.S; return { mode: window.__game.mode, t: +S.t.toFixed(1), n: S.n, weapon: S.weapon, kills: S.stats.kills, zombies: S.zombies.length, packs: S.packs.length, fps: Math.round(window.__game.fps()) }; });
  console.log(label, JSON.stringify(info));
}
await play('l1', () => window.__game.start(0), secs);
await play('boss0', () => window.__game.start(0, { bossOnly: true, n: 40, weapon: 2 }), Math.min(secs, 10));
await play('l2', () => window.__game.start(1), Math.min(secs, 10));
await play('boss1', () => window.__game.start(1, { bossOnly: true, n: 70, weapon: 4 }), Math.min(secs, 10));
console.log(errors.length ? 'BŁĘDY:\n' + [...new Set(errors)].join('\n') : 'Brak błędów konsoli.');
await browser.close();
