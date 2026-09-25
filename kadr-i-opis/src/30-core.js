'use strict';

/* ---------- Stałe ---------- */
const MAX_PHOTOS = 10;

// Ustawienia ogólne; dane marki są zapisane w bazie narzędzia (settings/brand).
const DEFAULTS = {
  brand: '',
  person: '',
  city: '',
  area: 'cała Polska',
  website: '',
  instagram: '',
  services: 'fotografia ślubna, film ślubny, sesje plenerowe i narzeczeńskie',
  voice: 'my',
  emoji: 'few',
  tone: 'ciepły, elegancki i konkretny; premium bez nadęcia',
  cta: 'Wolne terminy: napisz w wiadomości prywatnej datę i miejsce ślubu.',
  keywords: 'fotograf ślubny, kamerzysta ślubny, film ślubny, sesja narzeczeńska, sesja plenerowa',
  hashtags: '',
  weeklyGoal: 2,
  days: [2, 5],
};

const FORMATS = [
  { id: 'ig45', name: 'Instagram · post', w: 1080, h: 1350, ratio: '4:5', tag: 'instagram-4x5', note: 'Bezpieczny standard feedu i karuzeli.' },
  { id: 'ig34', name: 'Instagram · pełna wysokość', w: 1080, h: 1440, ratio: '3:4', tag: 'instagram-3x4', note: 'Najwyższy post z aplikacji; siatka profilu go nie przycina.' },
  { id: 'story', name: 'Stories i rolki', w: 1080, h: 1920, ratio: '9:16', tag: 'stories-9x16', note: 'Zostaw wolne ok. 250 px u góry i u dołu na napisy.' },
  { id: 'pin', name: 'Pinterest', w: 1000, h: 1500, ratio: '2:3', tag: 'pinterest-2x3', note: 'Standardowy pin.' },
  { id: 'sq', name: 'Kwadrat', w: 1080, h: 1080, ratio: '1:1', tag: 'kwadrat-1x1', note: 'Facebook, miniatury, reklamy.' },
  { id: 'wide', name: 'Strona, blog, Facebook', w: 1920, h: 1080, ratio: '16:9', tag: 'poziom-16x9', note: 'Wpis na blogu, okładka, YouTube.' },
  { id: 'gbp', name: 'Profil Firmy w Google', w: 1200, h: 900, ratio: '4:3', tag: 'google-4x3', note: 'Post i zdjęcia w Mapach Google.' },
];
const FMT = Object.fromEntries(FORMATS.map(f => [f.id, f]));

const TYPES = ['Ślub · reportaż', 'Przygotowania', 'Ceremonia', 'Przyjęcie weselne', 'Sesja narzeczeńska', 'Sesja plenerowa lub poślubna', 'Detale i dekoracje', 'Kulisy pracy', 'Teledysk lub film', 'Inne'];

const GOALS = [
  { id: 'inspiracja', label: 'Inspiracja', prompt: 'inspiracja i zasięg: tekst, który pary zapiszą i wyślą sobie nawzajem' },
  { id: 'rezerwacje', label: 'Rezerwacje', prompt: 'rezerwacje: zachęta do kontaktu i podania daty ślubu' },
  { id: 'porada', label: 'Porada dla par', prompt: 'wartość dla par: praktyczna porada związana z tym, co widać na zdjęciu' },
  { id: 'zaufanie', label: 'Zaufanie', prompt: 'zaufanie: pokazanie sposobu pracy, doświadczenia i podejścia do pary' },
];

const DAY_LABELS = [[1, 'Pn'], [2, 'Wt'], [3, 'Śr'], [4, 'Cz'], [5, 'Pt'], [6, 'Sb'], [0, 'Nd']];

/* ---------- Stan ---------- */
const S = {
  photos: [], active: 0,
  result: null, isExample: true, history: [],
  igVariant: 0, pTab: 'instagram', frameBg: 'white',
  settings: { ...DEFAULTS }, posts: [], savedPostId: null,
  ctx: { type: TYPES[0], goal: 'inspiracja', place: '', tags: '', notes: '' },
  busy: false, ctl: null, cards: {},
};

/* ---------- Narzędzia ---------- */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
function el(tag, attrs = {}, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') e.className = v;
    else if (k === 'text') e.textContent = v;
    else if (k.startsWith('on') && typeof v === 'function') e.addEventListener(k.slice(2), v);
    else e.setAttribute(k, v === true ? '' : String(v));
  }
  for (const kid of kids.flat(Infinity)) {
    if (kid == null || kid === false) continue;
    e.append(kid.nodeType ? kid : String(kid));
  }
  return e;
}
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const uid = () => Math.random().toString(36).slice(2, 10);
const str = v => (typeof v === 'string' ? v : v == null ? '' : String(v)).trim();
const arr = v => (Array.isArray(v) ? v : []);
const num01 = (v, d) => { const n = Number(v); return Number.isFinite(n) ? clamp(n, 0, 1) : d; };
const len = s => [...(s || '')].length;
const clone = v => JSON.parse(JSON.stringify(v));
const toBlob = (canvas, type = 'image/jpeg', q = 0.92) =>
  new Promise((res, rej) => canvas.toBlob(b => (b ? res(b) : rej(new Error('toBlob'))), type, q));

const PL_MAP = { ą: 'a', ć: 'c', ę: 'e', ł: 'l', ń: 'n', ó: 'o', ś: 's', ź: 'z', ż: 'z' };
function slugify(s, max = 60) {
  return str(s).toLowerCase().replace(/[ąćęłńóśźż]/g, c => PL_MAP[c])
    .normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, max).replace(/-+$/, '');
}

const WD = ['nd', 'pn', 'wt', 'śr', 'cz', 'pt', 'sb'];
const pad = n => String(n).padStart(2, '0');
const toISO = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const fromISO = s => { const [y, m, d] = String(s || '').split('-').map(Number); return y && m && d ? new Date(y, m - 1, d, 12) : null; };
const fmtDay = s => { const d = fromISO(s); return d ? `${WD[d.getDay()]} ${pad(d.getDate())}.${pad(d.getMonth() + 1)}` : 'bez daty'; };
function weekBounds(ref = new Date()) {
  const start = new Date(ref); start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  const end = new Date(start); end.setDate(start.getDate() + 7);
  return [start, end];
}

/* ---------- Możliwości strony w Claude ---------- */
const CL = window.claude && typeof window.claude.use === 'function' ? window.claude : null;
const cap = name => (CL ? CL.use(name).catch(() => null) : Promise.resolve(null));
const samplePromise = cap('sample');
const dlPromise = cap('downloads');
const dbPromise = cap('db');

/* ---------- Zapis: baza artefaktu albo przeglądarka ---------- */
const LS = {
  get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch { return false; } },
};
const Store = {
  db: null, mode: 'local', cb: null,
  async init() { this.db = await dbPromise; this.mode = this.db ? 'db' : 'local'; },
  async loadSettings() {
    if (this.db) {
      try { const s = await this.db.doc('settings/brand').get(); return s.exists ? s.data() : null; }
      catch (e) { console.warn('settings', e); return null; }
    }
    return LS.get('kio.settings', null);
  },
  async saveSettings(v) {
    if (this.db) return this.db.doc('settings/brand').set(v);
    if (!LS.set('kio.settings', v)) throw { code: 'storage' };
  },
  watchPosts(cb) {
    if (this.db) {
      return this.db.collection('posts').onSnapshot(
        snap => cb(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
        e => { console.warn('posts', e); toast('Nie mogę wczytać planu publikacji. Odśwież stronę.'); });
    }
    this.cb = cb; cb(LS.get('kio.posts', [])); return () => {};
  },
  async addPost(p) {
    if (this.db) { const ref = await this.db.collection('posts').add(p); return ref.id; }
    const list = LS.get('kio.posts', []); const id = uid();
    list.push({ id, ...p });
    if (!LS.set('kio.posts', list)) throw { code: 'storage' };
    this.cb?.(list); return id;
  },
  async updatePost(id, patch) {
    if (this.db) return this.db.doc('posts/' + id).update(patch);
    const list = LS.get('kio.posts', []); const i = list.findIndex(x => x.id === id);
    if (i < 0) return;
    list[i] = { ...list[i], ...patch };
    if (!LS.set('kio.posts', list)) throw { code: 'storage' };
    this.cb?.(list);
  },
  async deletePost(id) {
    if (this.db) return this.db.doc('posts/' + id).delete();
    const list = LS.get('kio.posts', []).filter(x => x.id !== id);
    LS.set('kio.posts', list); this.cb?.(list);
  },
};

/* ---------- Komunikaty ---------- */
let toastTimer;
function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.hidden = false;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.hidden = true; }, 3600);
}
function setStatus(msg, kind = '') {
  const s = $('#genStatus'); s.className = 'status' + (kind && kind !== 'busy' ? ' ' + kind : '');
  s.replaceChildren();
  if (kind === 'busy') s.append(el('span', { class: 'spin', 'aria-hidden': 'true' }));
  if (msg) s.append(el('span', { text: msg }));
  if (kind === 'busy') s.append(el('button', { type: 'button', class: 'btn ghost sm', onclick: () => S.ctl?.abort() }, 'Zatrzymaj'));
}

/* ---------- Kopiowanie ---------- */
function copyText(text, btn) {
  const done = ok => {
    if (!ok) { toast('Nie mogę skopiować automatycznie. Zaznacz tekst i skopiuj ręcznie.'); return; }
    if (!btn) { toast('Skopiowano'); return; }
    const old = btn.textContent; btn.textContent = 'Skopiowano'; btn.disabled = true;
    setTimeout(() => { btn.textContent = old; btn.disabled = false; }, 1300);
  };
  const fallback = () => {
    let ok = false;
    try {
      const ta = el('textarea', { style: 'position:fixed;left:-9999px;top:0', 'aria-hidden': 'true' });
      ta.value = text; document.body.append(ta); ta.select(); ok = document.execCommand('copy'); ta.remove();
    } catch { ok = false; }
    done(ok);
  };
  try { navigator.clipboard.writeText(text).then(() => done(true), fallback); }
  catch { fallback(); }
}

/* ---------- Pliki: zapis i ZIP ---------- */
async function saveFile(filename, blob) {
  const dl = await dlPromise;
  if (!dl) { showSaveModal(filename, blob); return false; }
  try { await dl.save({ filename, data: blob }); toast('Zapisano: ' + filename); return true; }
  catch (e) {
    const code = e?.code;
    if (code === 'declined') return false;
    if (code === 'rate_limited') { toast('Najpierw zamknij poprzednie okno zapisu.'); return false; }
    if (['unavailable', 'not_granted', 'capability_disabled', 'capability_removed'].includes(code)) { showSaveModal(filename, blob); return false; }
    toast('Nie udało się zapisać pliku. Spróbuj ponownie.'); return false;
  }
}
let modalUrl = null;
function showSaveModal(filename, blob) {
  const isImg = /^image\//.test(blob.type) || /\.(jpe?g|png)$/i.test(filename);
  if (modalUrl) URL.revokeObjectURL(modalUrl);
  modalUrl = URL.createObjectURL(blob);
  $('#saveName').textContent = filename;
  $('#saveImg').hidden = !isImg;
  if (isImg) $('#saveImg').src = modalUrl;
  $('#saveMsg').textContent = isImg
    ? 'Pobieranie nie działa w tym widoku. Przytrzymaj obraz (telefon) albo kliknij go prawym przyciskiem i wybierz „Zapisz obraz jako…”.'
    : 'Pobieranie nie działa w tym widoku. Otwórz narzędzie na claude.ai w przeglądarce albo pobierz kadry pojedynczo.';
  $('#saveModal').hidden = false; $('#saveClose').focus();
}

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
  return t;
})();
function crc32(u8) { let c = 0xFFFFFFFF; for (let i = 0; i < u8.length; i++) c = CRC_TABLE[(c ^ u8[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
// Prosty ZIP bez kompresji (JPG i tak się nie kompresuje).
async function makeZip(files) {
  const enc = new TextEncoder(); const parts = []; const central = []; let offset = 0;
  const d = new Date();
  const time = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1);
  const date = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
  for (const f of files) {
    const data = new Uint8Array(await f.blob.arrayBuffer()); const name = enc.encode(f.name); const crc = crc32(data);
    const lh = new DataView(new ArrayBuffer(30));
    lh.setUint32(0, 0x04034b50, true); lh.setUint16(4, 20, true); lh.setUint16(6, 0x0800, true); lh.setUint16(8, 0, true);
    lh.setUint16(10, time, true); lh.setUint16(12, date, true); lh.setUint32(14, crc, true);
    lh.setUint32(18, data.length, true); lh.setUint32(22, data.length, true); lh.setUint16(26, name.length, true); lh.setUint16(28, 0, true);
    parts.push(lh, name, data);
    const ch = new DataView(new ArrayBuffer(46));
    ch.setUint32(0, 0x02014b50, true); ch.setUint16(4, 20, true); ch.setUint16(6, 20, true); ch.setUint16(8, 0x0800, true);
    ch.setUint16(10, 0, true); ch.setUint16(12, time, true); ch.setUint16(14, date, true); ch.setUint32(16, crc, true);
    ch.setUint32(20, data.length, true); ch.setUint32(24, data.length, true); ch.setUint16(28, name.length, true);
    ch.setUint16(30, 0, true); ch.setUint16(32, 0, true); ch.setUint16(34, 0, true); ch.setUint16(36, 0, true);
    ch.setUint32(38, 0, true); ch.setUint32(42, offset, true);
    central.push(ch, name);
    offset += 30 + name.length + data.length;
  }
  const cdSize = central.reduce((s, p) => s + p.byteLength, 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true); end.setUint16(8, files.length, true); end.setUint16(10, files.length, true);
  end.setUint32(12, cdSize, true); end.setUint32(16, offset, true);
  return new Blob([...parts, ...central, end], { type: 'application/zip' });
}
