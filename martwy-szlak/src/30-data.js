'use strict';

/* ---------- Świat i kamera ---------- */
// Widok ma zawsze 400 jednostek logicznych szerokości (tabela pasów ze specyfikacji).
// Głębia (wy) to odległość przed linią oddziału; na ekranie jest ściśnięta współczynnikiem DEPTH.
const LW = 400;
const DEPTH = 0.62;                 // kompresja głębi: wysoka kamera 3/4
const PLAYER_Y = 0.80;              // linia oddziału na 80% wysokości ekranu
const SCALE_TOP = 0.85;             // skala sprite'ów u góry ekranu (1,0 na dole)
const ROADW_TOP = 0.89;             // szerokość drogi u góry względem dołu
const SPLIT_Y = 0.45;               // powyżej 45% wysokości ekranu horda jest rysowana grupami (LOD)
const ROAD_L = 28, ROAD_R = 372;
const LANES = [
  { x0: 28, x1: 138, cx: 83, name: 'bramki' },
  { x0: 138, x1: 262, cx: 200, name: 'horda' },
  { x0: 262, x1: 372, cx: 317, name: 'broń' },
];
const PX_MIN = 60, PX_MAX = 340;    // zakres ruchu oddziału
const laneOf = x => (x < LANES[0].x1 ? 0 : x < LANES[1].x1 ? 1 : 2);

/* ---------- Oddział ---------- */
const SQ_DX = 14, SQ_DY = 12;       // plaster heksagonalny: 14 px w poziomie, rzędy co 12 jednostek
const SQ_DRAW_MAX = 45;             // tylu żołnierzy rysujemy; licznik pokazuje resztę
const SHOOTERS_MAX = 8;             // tyle luf strzela w jednej salwie; reszta oddziału podnosi obrażenia
// Siła ognia rośnie wolniej niż liczebność, żeby oddział nie rozpędzał się wykładniczo.
const squadMul = n => (n <= SHOOTERS_MAX ? 1 : Math.pow(n / SHOOTERS_MAX, 0.65));

/* ---------- Bronie ---------- */
// rate: salwy na sekundę; dmg: obrażenia jednego pocisku przy pełnej salwie 8 luf.
const WEAPONS = [
  { id: 'pistol', name: 'Pistolet', rate: 2.2, dmg: 4.0, spr: 'w0', col: '255,236,160' },
  { id: 'smg', name: 'Pistolet maszynowy', rate: 5.5, dmg: 2.5, spr: 'w1', col: '255,214,90' },
  { id: 'rifle', name: 'Karabin szturmowy', rate: 6.5, dmg: 3.3, spr: 'w2', col: '255,186,70' },
  { id: 'minigun', name: 'Minigun', rate: 12, dmg: 2.8, spr: 'w3', col: '255,160,60' },
  { id: 'flame', name: 'Miotacz ognia', rate: 15, dmg: 3.5, spr: 'w4', col: '255,130,40', flame: true, pierce: 3, range: 720 },
];
const BULLET_SPEED = 1500;
const WEAPON_MAX = WEAPONS.length - 1;

/* ---------- Zombie ---------- */
// sp: własna prędkość marszu względem drogi; r: promień trafienia; h: wysokość na ekranie (px przy skali 1,0).
const ZT = {
  walker: { spr: ['z1', 'z2', 'z3'], hp: 10, sp: [20, 30], r: 7, h: 34, eat: 1, anim: 4.2 },
  runner: { spr: ['zr'], hp: 8, sp: [62, 74], r: 7, h: 33, eat: 1, anim: 8.5 },
  brute: { spr: ['zb'], hp: 110, sp: [13, 16], r: 15, h: 60, eat: 3, anim: 2.4 },
  exploder: { spr: ['zx'], hp: 14, sp: [30, 36], r: 8, h: 35, eat: 3, anim: 5.2, explode: true },
};
// Szablony grup LOD: 6 zombie w bloku 3 x 2 (przesunięcia w jednostkach świata).
const PACK_COLS = 3, PACK_ROWS = 2, PACK_DX = 17, PACK_DY = 12, PACK_VARIANTS = 8;

/* ---------- Obiekty na pasach ---------- */
const PANEL_W = 92, PANEL_H = 52, PANEL_AMP = 16;
const PED_PARK_PX = 230, PED_LEAVE_PX = 110;   // podest broni: parkuje 230 px nad oddziałem, odjeżdża przy 110 px
const PED_SLOW = 0.3;                          // podest w strefie parkowania jedzie z prędkością 0,3 świata
const PED_SOLDIERS = 25;                       // po ostatniej broni podest daje żołnierzy
const OBST = {
  ice: { w: 84, h: 88, name: 'Lód', perLoss: 60 },
  container: { w: 88, h: 92, name: 'Kontener', perLoss: 80 },
  safe: { w: 78, h: 70, name: 'Sejf', perLoss: 80 },
};

/* ---------- Bossowie ---------- */
const BOSSES = [
  { id: 'bulldozer', name: 'Buldożer', spr: 'boss0', sprCharge: 'boss0_charge', sprHit: 'boss0_hit', hp: 6500, r: 40, h: 170,
    sub: 'Czerwony pas? Zejdź z niego, zanim ruszy.', every: 5, summonAt: 0.5, summonN: 20 },
  { id: 'cauldron', name: 'Kocioł', spr: 'boss1', sprP2: 'boss1_p2', sprThrow: 'boss1_throw', hp: 19800, r: 44, h: 176,
    sub: 'Kwas zamyka pas na 3 sekundy. Uciekaj z plamy.', every: 2.6, every2: 1.6 },
];

/* ---------- Poziomy ---------- */
// Skrypt: [czas w s, rodzaj, parametry]. Horda: liczby zombie danego typu, hp = mnożnik zdrowia fali.
const LEVELS = [
  {
    id: 1, name: 'Autostrada Śmierci', theme: 'desert', speed: 100, startN: 10, startWeapon: 0, hpMul: 1,
    panelPeriod: 2.0, props: ['p_sedan', 'p_pickup', 'p_barrier', 'p_cactus', 'p_tires', 'p_barrel', 'p_bus', 'p_sign'],
    script: [
      [0.3, 'banner', { t: 'Poziom 1', s: 'Autostrada Śmierci' }],
      [1.5, 'horde', { walker: 40, hp: 0.7 }],
      [4, 'ped', { tier: 1, need: 30 }],
      [7, 'panel', { v: -3, cap: 5 }],
      [18, 'horde', { walker: 42 }],
      [22, 'panel', { v: -5, cap: 6 }],
      [28, 'obst', { kind: 'ice', hp: 500, reward: { soldiers: 5 } }],
      [31, 'horde', { walker: 48, runner: 4 }],
      [38, 'panel', { v: -10, cap: 8 }],
      [44, 'horde', { walker: 54, runner: 6 }],
      [50, 'panel', { v: -6, cap: 7 }],
      [56, 'horde', { walker: 36, brute: 3 }],
      [60, 'ped', { tier: 2, need: 80 }],
      [66, 'obst', { kind: 'safe', hp: 800, reward: { coins: 20, soldiers: 4 } }],
      [70, 'horde', { walker: 50, runner: 6 }],
      [72, 'panel', { v: -12, mul: 2, cap: 12 }],
      [79, 'horde', { walker: 40, brute: 2 }],
      [82, 'boss', { id: 0 }],
    ],
  },
  {
    id: 2, name: 'Strefa Skażenia', theme: 'toxic', speed: 110, startN: 35, startWeapon: 2, hpMul: 2.0,
    panelPeriod: 1.4, props: ['p_container', 'p_hazbarrel', 'p_pipes', 'p_tanker', 'p_forklift', 'p_fence', 'p_lamp', 'p_crates'],
    script: [
      [0.3, 'banner', { t: 'Poziom 2', s: 'Strefa Skażenia' }],
      [1.5, 'horde', { walker: 66, runner: 8 }],
      [4.5, 'panel', { v: -10, cap: 6 }],
      [8.5, 'ped', { tier: 3, need: 150 }],
      [12, 'horde', { walker: 72, exploder: 5 }],
      [16.5, 'obst', { kind: 'container', hp: 1500, reward: { soldiers: 5 } }],
      [21, 'panel', { v: -15, cap: 8 }],
      [25, 'horde', { walker: 78, runner: 14, exploder: 5 }],
      [31.5, 'panel', { v: -25, mul: 2, cap: 11 }],
      [36, 'obst', { kind: 'container', hp: 2500, reward: { soldiers: 5 } }],
      [39.5, 'horde', { walker: 84, brute: 3, exploder: 6 }],
      [46, 'panel', { v: -20, cap: 8 }],
      [50.5, 'obst', { kind: 'safe', hp: 1500, reward: { coins: 30, part: 0.4 } }],
      [54.5, 'horde', { walker: 90, runner: 18 }],
      [60.5, 'ped', { tier: 4, need: 250 }],
      [64.5, 'panel', { v: -25, cap: 10 }],
      [69, 'obst', { kind: 'container', hp: 3000, reward: { soldiers: 6 } }],
      [72.5, 'horde', { walker: 96, brute: 4, exploder: 8 }],
      [81, 'panel', { v: -30, mul: 2, cap: 11 }],
      [85.5, 'horde', { walker: 90, runner: 20, exploder: 6 }],
      [95.5, 'boss', { id: 1 }],
    ],
  },
];

/* ---------- Pomocnicze ---------- */
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
let rndSeed = 0;
// Deterministyczny generator dla symulacji; w grze ziarno bierze się z zegara.
function rnd01() { rndSeed = (rndSeed + 0x6D2B79F5) | 0; let t = rndSeed; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }
const rnd = (a, b) => a + rnd01() * (b - a);
const rndi = (a, b) => Math.floor(rnd(a, b + 1));
const pick = arr => arr[Math.floor(rnd01() * arr.length)];
