'use strict';

/* ---------- Gdzie działa strona ---------- */
// "artifact": w Claude (teksty pisze Claude na koncie użytkownika); "app": aplikacja instalowana z przeglądarki.
const TARGET = window.KIO_TARGET || (window.claude ? 'artifact' : 'app');
const IS_APP = TARGET === 'app';
const MOBILE = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

/* ---------- Stałe ---------- */
const MAX_PHOTOS = 10;

const DEFAULTS = {
  brand: '', city: '', website: '', instagram: '',
  services: 'fotografia ślubna, film ślubny, sesje plenerowe i narzeczeńskie',
  voice: 'my', emoji: 'few',
  tone: 'ciepły, elegancki i konkretny; premium bez nadęcia',
  cta: 'Wolne terminy: napisz w wiadomości prywatnej datę i miejsce ślubu.',
  keywords: 'fotograf ślubny, kamerzysta ślubny, film ślubny, sesja narzeczeńska, sesja plenerowa',
  hashtags: '',
  days: [2, 5], publishTime: '19:00', weeklyGoal: 2,
  aiMain: 'gemini', aiFallback: true, claudeModel: 'opus',
};
// W aplikacji dane marki pochodzą z pliku config/brand.json (dołączanego przy budowaniu).
const BRAND = IS_APP && window.KIO_BRAND && typeof window.KIO_BRAND === 'object' ? window.KIO_BRAND : {};

const FORMATS = [
  { id: 'ig45', name: 'Post', w: 1080, h: 1350, ratio: '4:5', tag: 'post-4x5', note: 'Standard feedu i karuzeli.' },
  { id: 'ig34', name: 'Post wysoki', w: 1080, h: 1440, ratio: '3:4', tag: 'post-3x4', note: 'Najwyższy post; siatka profilu go nie przycina.' },
  { id: 'story', name: 'Stories i rolka', w: 1080, h: 1920, ratio: '9:16', tag: 'stories-9x16', note: 'Zostaw wolną górę i dół na napisy.' },
  { id: 'sq', name: 'Kwadrat', w: 1080, h: 1080, ratio: '1:1', tag: 'kwadrat-1x1', note: 'Facebook i miniatury.' },
];
const FMT = Object.fromEntries(FORMATS.map(f => [f.id, f]));

const TYPES = ['Ślub · reportaż', 'Przygotowania', 'Ceremonia', 'Przyjęcie weselne', 'Sesja narzeczeńska', 'Sesja plenerowa lub poślubna', 'Detale i dekoracje', 'Kulisy pracy', 'Teledysk lub film', 'Inne'];

const GOALS = [
  { id: 'inspiracja', label: 'Inspiracja', hint: 'Piękne zdjęcie, które pary zapiszą i wyślą sobie nawzajem.',
    when: 'najlepsze kadry z reportażu albo sesji', gives: 'zapisania i udostępnienia, czyli zasięg do nowych par',
    prompt: 'inspiracja i zasięg: tekst, który pary zapiszą i wyślą sobie nawzajem' },
  { id: 'rezerwacje', label: 'Rezerwacje', hint: 'Zaproszenie do kontaktu, gdy masz wolne terminy.',
    when: 'masz wolne daty, zwłaszcza od grudnia do marca, kiedy pary wybierają fotografa', gives: 'wiadomości z datą i miejscem ślubu',
    prompt: 'rezerwacje: zachęta do kontaktu i podania daty ślubu' },
  { id: 'porada', label: 'Porada dla par', hint: 'Praktyczna wskazówka, która wynika ze zdjęcia.',
    when: 'zdjęcie pokazuje coś przydatnego: światło, harmonogram dnia, deszcz, pierwszy taniec', gives: 'zapisania i opinię eksperta, któremu można zaufać',
    prompt: 'wartość dla par: praktyczna porada związana z tym, co widać na zdjęciu' },
  { id: 'zaufanie', label: 'Zaufanie', hint: 'Pokazanie, jak pracujesz i jak czują się z Tobą pary.',
    when: 'kulisy, przygotowania, opinia pary, Twoje podejście i sprzęt', gives: 'pewność pary, zanim zarezerwuje termin',
    prompt: 'zaufanie: pokazanie sposobu pracy, doświadczenia i podejścia do pary' },
];

const DAY_LABELS = [[1, 'Pn'], [2, 'Wt'], [3, 'Śr'], [4, 'Cz'], [5, 'Pt'], [6, 'Sb'], [0, 'Nd']];

/* ---------- Stan ---------- */
const S = {
  photos: [], active: 0,
  result: null, isExample: true, history: [],
  igVariant: 0, pTab: 'instagram', frameBg: 'white',
  settings: { ...DEFAULTS, ...BRAND }, keys: { gemini: '', claude: '' },
  posts: [], savedPostId: null,
  ctx: { type: TYPES[0], goal: 'inspiracja', place: '', notes: '' },
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
const blobToB64 = blob => new Promise((res, rej) => {
  const r = new FileReader(); r.onload = () => res(String(r.result).split(',')[1] || ''); r.onerror = () => rej(r.error); r.readAsDataURL(blob);
});

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
function plural(n, one, few, many) {
  if (n === 1) return one;
  const d = n % 10, t = n % 100;
  return d >= 2 && d <= 4 && (t < 12 || t > 14) ? few : many;
}

/* ---------- Możliwości strony w Claude (tylko artefakt) ---------- */
const CL = !IS_APP && window.claude && typeof window.claude.use === 'function' ? window.claude : null;
const cap = name => (CL ? CL.use(name).catch(() => null) : Promise.resolve(null));
const samplePromise = cap('sample');
const dlPromise = cap('downloads');
const dbPromise = cap('db');

/* ---------- Zapis danych ---------- */
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
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.hidden = true; }, 3800);
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

/* ---------- Zapisywanie plików ---------- */
function downloadBlob(filename, blob) {
  const url = URL.createObjectURL(blob);
  const a = el('a', { href: url, download: filename, style: 'display:none' });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
let modalUrls = [];
function closeModal() { $('#saveModal').hidden = true; modalUrls.forEach(u => URL.revokeObjectURL(u)); modalUrls = []; }
// Okno z gotowymi JPG: na telefonie „Zapisz do zdjęć” (menu udostępniania) albo przytrzymanie obrazu.
function showSaveModal(files, msg) {
  closeModal();
  const imgs = $('#saveImgs'); imgs.replaceChildren();
  for (const f of files) {
    const url = URL.createObjectURL(f.blob); modalUrls.push(url);
    imgs.append(el('figure', {}, el('img', { src: url, alt: f.name }), el('figcaption', { text: f.name })));
  }
  const acts = $('#saveActs'); acts.replaceChildren();
  const shareFiles = files.map(f => new File([f.blob], f.name, { type: 'image/jpeg' }));
  if (navigator.canShare && navigator.canShare({ files: shareFiles })) {
    const b = el('button', { type: 'button', class: 'btn primary' }, files.length > 1 ? `Zapisz ${files.length} zdjęcia` : 'Zapisz do zdjęć');
    b.addEventListener('click', async () => {
      try { await navigator.share({ files: shareFiles }); closeModal(); }
      catch (e) { if (e?.name !== 'AbortError') toast('Nie udało się otworzyć menu zapisu. Przytrzymaj obraz.'); }
    });
    acts.append(b);
  }
  $('#saveMsg').textContent = msg || 'Przytrzymaj obraz (telefon) albo kliknij go prawym przyciskiem i wybierz „Zapisz obraz jako…”.';
  $('#saveModal').hidden = false; $('#saveClose').focus();
}
// getFiles: async () => [{name, blob}] (pliki powstają dopiero po kliknięciu); count: ile ich będzie.
async function saveFiles(getFiles, count = 1) {
  if (!IS_APP) {
    const files = await getFiles(); const dl = await dlPromise;
    if (!dl) { showSaveModal(files); return; }
    for (const f of files) {
      try { await dl.save({ filename: f.name, data: f.blob }); }
      catch (e) {
        if (e?.code === 'declined') return;
        if (['unavailable', 'not_granted', 'capability_disabled', 'capability_removed'].includes(e?.code)) { showSaveModal(files); return; }
        toast('Nie udało się zapisać pliku. Spróbuj ponownie.'); return;
      }
    }
    toast(files.length > 1 ? `Zapisano ${files.length} pliki.` : 'Zapisano: ' + files[0].name);
    return;
  }
  if (MOBILE) { showSaveModal(await getFiles(), 'Gotowe. Zapisz zdjęcia w telefonie.'); return; }
  let dir = null;
  // Folder trzeba wybrać od razu po kliknięciu, zanim zaczną się obliczenia.
  if (window.showDirectoryPicker && count > 1) {
    try { dir = await window.showDirectoryPicker({ mode: 'readwrite' }); }
    catch (e) { if (e?.name === 'AbortError') return; dir = null; }
  }
  const files = await getFiles();
  if (dir) {
    try {
      for (const f of files) { const h = await dir.getFileHandle(f.name, { create: true }); const w = await h.createWritable(); await w.write(f.blob); await w.close(); }
      toast(`Zapisano ${files.length} pliki w folderze „${dir.name}”.`); return;
    } catch (e) { console.warn(e); }
  }
  files.forEach((f, i) => setTimeout(() => downloadBlob(f.name, f.blob), i * 350));
  toast(files.length > 1 ? `Pobieram ${files.length} pliki JPG.` : 'Pobrano: ' + files[0].name);
}
