
/* ---------- O poście ---------- */
function buildContextForm() {
  $('#ctxType').replaceChildren(...TYPES.map(t => el('option', { value: t, text: t })));
  $('#ctxType').value = S.ctx.type;
  renderGoalChips();
}
function renderGoalChips() {
  $('#ctxGoal').replaceChildren(...GOALS.map(g => el('button', { type: 'button', class: 'chip', 'aria-pressed': String(S.ctx.goal === g.id),
    onclick: () => { S.ctx.goal = g.id; renderGoalChips(); } }, g.label)));
  $('#goalHint').textContent = (GOALS.find(g => g.id === S.ctx.goal) || GOALS[0]).hint;
}
function buildGoalPop() {
  $('#goalPop').replaceChildren(
    el('dl', {}, GOALS.map(g => el('div', {}, el('dt', { text: g.label }),
      el('dd', {}, el('b', { text: 'Kiedy: ' }), g.when + '. ', el('b', { text: 'Co daje: ' }), g.gives + '.')))),
    el('p', { class: 'mix', style: 'margin:0', text: 'Mieszaj cele. Dobry miesiąc to np. 3 posty z inspiracją, 2 porady, 2 posty budujące zaufanie i 1 zaproszenie do rezerwacji.' }));
}
function toggleGoalPop(force) {
  const pop = $('#goalPop'); const open = force ?? pop.hidden;
  pop.hidden = !open; $('#goalInfo').setAttribute('aria-expanded', String(open));
}
function readContext() {
  S.ctx.type = $('#ctxType').value || TYPES[0];
  S.ctx.place = str($('#ctxPlace').value);
  S.ctx.notes = str($('#ctxNotes').value).slice(0, 3000);
}
function writeContext(c) {
  S.ctx = { ...S.ctx, ...c };
  $('#ctxType').value = TYPES.includes(S.ctx.type) ? S.ctx.type : TYPES[0];
  $('#ctxPlace').value = S.ctx.place || '';
  $('#ctxNotes').value = [S.ctx.notes, S.ctx.tags].filter(Boolean).join('\n');
  renderGoalChips();
}

/* ---------- Ustawienia ---------- */
const SET_FIELDS = ['brand', 'city', 'website', 'instagram', 'services', 'voice', 'emoji', 'tone', 'cta', 'keywords', 'hashtags'];
let formDays = [], formMain = 'gemini';
function renderDayChips() {
  $('#s-days').replaceChildren(...DAY_LABELS.map(([d, l]) => el('button', { type: 'button', class: 'chip', 'aria-pressed': String(formDays.includes(d)),
    onclick: () => { formDays = formDays.includes(d) ? formDays.filter(x => x !== d) : [...formDays, d]; renderDayChips(); } }, l)));
}
function renderMainSeg() { $$('#s-main button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.v === formMain))); }
function fillSettingsForm() {
  for (const k of SET_FIELDS) { const f = $('#s-' + k); if (f) f.value = S.settings[k] ?? ''; }
  $('#s-goal').value = String(S.settings.weeklyGoal || 2);
  $('#s-time').value = S.settings.publishTime || '19:00';
  formDays = arr(S.settings.days).map(Number); renderDayChips();
  if (IS_APP) {
    formMain = S.settings.aiMain === 'claude' ? 'claude' : 'gemini'; renderMainSeg();
    $('#s-claudeModel').value = S.settings.claudeModel === 'sonnet' ? 'sonnet' : 'opus';
    $('#s-fallback').checked = S.settings.aiFallback !== false;
    $('#k-gemini').value = S.keys.gemini || ''; $('#k-claude').value = S.keys.claude || '';
  }
}
function readKeysFromForm() { S.keys = { gemini: str($('#k-gemini').value), claude: str($('#k-claude').value) }; }
function saveKeys() { if (!LS.set('kio.keys', S.keys)) toast('Nie mogę zapisać kluczy w tej przeglądarce.'); }
async function saveSettings(e) {
  e.preventDefault();
  const s = { ...S.settings };
  for (const k of SET_FIELDS) { const f = $('#s-' + k); if (f) s[k] = str(f.value); }
  s.weeklyGoal = clamp(parseInt($('#s-goal').value, 10) || 2, 1, 14);
  s.publishTime = /^\d{2}:\d{2}$/.test($('#s-time').value) ? $('#s-time').value : '19:00';
  s.days = formDays.length ? [...formDays] : [2, 5];
  if (IS_APP) {
    s.aiMain = formMain; s.claudeModel = $('#s-claudeModel').value === 'sonnet' ? 'sonnet' : 'opus'; s.aiFallback = $('#s-fallback').checked;
    readKeysFromForm(); saveKeys();
  }
  S.settings = s; renderPlan();
  if (IS_APP && providerOrder().length && /klucz/i.test($('#genStatus').textContent)) setStatus('');
  const btn = $('#setSave'); btn.disabled = true;
  try { await Store.saveSettings(s); toast('Zapisano ustawienia.'); }
  catch (err) { console.warn(err); toast('Nie udało się zapisać na stałe. Zmiany działają do odświeżenia strony.'); }
  finally { btn.disabled = false; }
}
function showSetupHint() {
  const s = $('#genStatus'); s.className = 'status';
  s.replaceChildren(el('span', { text: 'Żeby pisać teksty, dodaj darmowy klucz Gemini.' }),
    el('button', { type: 'button', class: 'btn sm', onclick: () => { switchView('settings'); $('#k-gemini').focus(); } }, 'Otwórz ustawienia'));
}

/* ---------- Plan i przypomnienia ---------- */
function nextSlot() {
  const days = arr(S.settings.days).length ? S.settings.days.map(Number) : [2, 5];
  const taken = new Set(S.posts.filter(p => p.status !== 'done').map(p => p.plannedFor));
  const d = new Date(); d.setHours(12, 0, 0, 0);
  for (let i = 0; i < 366; i++) {
    if (days.includes(d.getDay()) && !taken.has(toISO(d))) return toISO(d);
    d.setDate(d.getDate() + 1);
  }
  return toISO(new Date());
}
function postTitle() { return str(S.result?.seo?.h1) || [S.ctx.type, S.ctx.place].filter(Boolean).join(' · ') || 'Post'; }
async function saveToPlan() {
  if (S.isExample || !S.result) return;
  const btn = $('#saveBtn'); btn.disabled = true;
  try {
    if (S.savedPostId) {
      await Store.updatePost(S.savedPostId, { result: clone(S.result), variant: S.igVariant, updatedAt: Date.now() });
      toast('Zapisano zmiany w planie.');
    } else {
      readContext();
      const when = nextSlot();
      const cover = S.photos[(S.result.analysis.cover || 1) - 1] || S.photos[0];
      S.savedPostId = await Store.addPost({
        title: postTitle(), ctx: { ...S.ctx }, createdAt: Date.now(), plannedFor: when, status: 'plan',
        thumb: cover?.thumb || '', result: clone(S.result), variant: S.igVariant,
      });
      toast(`Zapisano w planie na ${fmtDay(when)}. Dodaj go do kalendarza w zakładce Plan.`);
    }
    renderResults();
  } catch (e) {
    console.warn(e);
    toast(e?.code === 'quota_exceeded' || e?.code === 'storage' ? 'Brak miejsca na zapis. Usuń stare posty z planu.' : 'Nie udało się zapisać. Spróbuj ponownie.');
  } finally { btn.disabled = false; }
}
function openPost(p) {
  if (!p.result) { toast('Ten wpis nie ma zapisanych tekstów.'); return; }
  S.photos.forEach(x => URL.revokeObjectURL(x.url)); S.photos = []; S.active = 0;
  S.result = normalize(clone(p.result), arr(p.result.photos).length || 1);
  S.result.meta = p.result.meta;
  S.isExample = false; S.savedPostId = p.id; S.history = [];
  S.igVariant = clamp(Number(p.variant) || 0, 0, S.result.instagram.variants.length - 1);
  if (p.ctx) writeContext(p.ctx);
  switchView('new');
  renderStrip(); renderResults(); renderFormats();
  setStatus('Otworzono zapisany post. Żeby pobrać kadry, wgraj to samo zdjęcie jeszcze raz.', 'ok');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
function publishDate(p) {
  const d = fromISO(p.plannedFor) || new Date();
  const [hh, mm] = String(S.settings.publishTime || '19:00').split(':').map(Number);
  d.setHours(Number.isFinite(hh) ? hh : 19, Number.isFinite(mm) ? mm : 0, 0, 0);
  return d;
}
function postCaption(p) { try { return p.result?.instagram ? igCaption(p.result, p.variant || 0) : ''; } catch { return ''; } }
function gcalUrl(p) {
  const s = publishDate(p), e = new Date(s.getTime() + 30 * 60000);
  const f = d => `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}00`;
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Warsaw';
  return 'https://calendar.google.com/calendar/render?action=TEMPLATE'
    + '&text=' + encodeURIComponent('Publikacja: ' + (p.title || 'post'))
    + '&dates=' + f(s) + '/' + f(e) + '&ctz=' + encodeURIComponent(tz)
    + '&details=' + encodeURIComponent(postCaption(p).slice(0, 1200));
}
const icsDate = d => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
const icsEsc = s => String(s || '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
function icsFold(line) {
  const enc = new TextEncoder(); const out = []; let cur = ''; let bytes = 0;
  for (const ch of line) {
    const b = enc.encode(ch).length;
    if (bytes + b > 73) { out.push(cur); cur = ' ' + ch; bytes = 1 + b; } else { cur += ch; bytes += b; }
  }
  out.push(cur); return out.join('\r\n');
}
function buildIcs(posts) {
  const now = icsDate(new Date());
  const L = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Kadr i Opis//PL', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH'];
  for (const p of posts) {
    const s = publishDate(p), e = new Date(s.getTime() + 30 * 60000);
    L.push('BEGIN:VEVENT', `UID:${p.id}@kadr-i-opis`, `DTSTAMP:${now}`, `DTSTART:${icsDate(s)}`, `DTEND:${icsDate(e)}`,
      `SUMMARY:${icsEsc('Publikacja: ' + (p.title || 'post'))}`, `DESCRIPTION:${icsEsc(postCaption(p))}`,
      'BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${icsEsc('Czas na post: ' + (p.title || ''))}`, 'TRIGGER:-PT15M', 'END:VALARM', 'END:VEVENT');
  }
  L.push('END:VCALENDAR');
  return L.map(icsFold).join('\r\n') + '\r\n';
}
function saveIcs(posts, name) {
  if (!posts.length) { toast('Brak zaplanowanych postów.'); return; }
  downloadBlob(name, new Blob([buildIcs(posts)], { type: 'text/calendar' }));
  toast('Pobrano plik kalendarza. Otwórz go, żeby dodać przypomnienia.');
}
function planRow(p) {
  const c = p.ctx || {}; const goal = GOALS.find(g => g.id === c.goal);
  const date = el('input', { type: 'date', value: p.plannedFor || '', 'aria-label': 'Data publikacji' });
  date.addEventListener('change', () => Store.updatePost(p.id, { plannedFor: date.value }).catch(() => toast('Nie udało się zmienić daty.')));
  const cb = el('input', { type: 'checkbox', checked: p.status === 'done' });
  cb.addEventListener('change', () => Store.updatePost(p.id, cb.checked ? { status: 'done', doneAt: Date.now() } : { status: 'plan', doneAt: null })
    .catch(() => toast('Nie udało się zapisać zmiany.')));
  const del = el('button', { type: 'button', class: 'btn ghost sm' }, 'Usuń');
  let armed = false, timer = 0;
  del.addEventListener('click', async () => {
    if (!armed) {
      armed = true; del.textContent = 'Na pewno usunąć?'; del.style.color = 'var(--accent)';
      timer = setTimeout(() => { armed = false; del.textContent = 'Usuń'; del.style.color = ''; }, 3500);
      return;
    }
    clearTimeout(timer); del.disabled = true;
    try {
      await Store.deletePost(p.id);
      if (S.savedPostId === p.id) { S.savedPostId = null; renderResults(); }
      toast('Usunięto z planu.');
    } catch { del.disabled = false; toast('Nie udało się usunąć. Spróbuj ponownie.'); }
  });
  const cal = p.status === 'done' ? null : [
    el('a', { class: 'btn sm', href: gcalUrl(p), target: '_blank', rel: 'noopener' }, 'Kalendarz Google'),
    IS_APP ? el('button', { type: 'button', class: 'btn sm', onclick: () => saveIcs([p], `post-${p.plannedFor || 'plan'}.ics`) }, 'iPhone / Outlook') : null,
  ];
  return el('div', { class: 'prow' + (p.status === 'done' ? ' done' : '') },
    p.thumb ? el('img', { src: p.thumb, alt: '' }) : el('span', { class: 'ph' }),
    el('div', {}, el('div', { class: 't', text: p.title || 'Post' }),
      el('div', { class: 'm', text: [`${fmtDay(p.plannedFor)}, ${S.settings.publishTime || '19:00'}`, goal?.label, c.place].filter(Boolean).join(' · ') })),
    el('div', { class: 'acts' }, date, el('label', { class: 'donecb' }, cb, 'Opublikowane'),
      el('button', { type: 'button', class: 'btn sm', onclick: () => openPost(p) }, 'Otwórz'), cal, del));
}
function notifyState() { return IS_APP && 'Notification' in window ? Notification.permission : 'unsupported'; }
function renderPlan() {
  const posts = S.posts;
  const todo = posts.filter(p => p.status !== 'done')
    .sort((a, b) => str(a.plannedFor || '9999').localeCompare(str(b.plannedFor || '9999')) || (a.createdAt || 0) - (b.createdAt || 0));
  const done = posts.filter(p => p.status === 'done').sort((a, b) => (b.doneAt || 0) - (a.doneAt || 0));
  $('#planCount').textContent = todo.length ? String(todo.length) : '';
  const [ws, we] = weekBounds();
  const weekDone = done.filter(p => p.doneAt >= ws.getTime() && p.doneAt < we.getTime()).length;
  const goal = S.settings.weeklyGoal || 2;
  const ns = notifyState();
  $('#planSum').replaceChildren(
    el('div', {}, el('span', { class: 'k', text: 'Ten tydzień' }), el('span', { class: 'v', text: `${weekDone} / ${goal}` }),
      el('div', { class: 'meter', 'aria-hidden': 'true' }, Array.from({ length: Math.max(goal, weekDone) }, (_, i) => el('i', { class: i < weekDone ? 'on' : '' })))),
    el('div', {}, el('span', { class: 'k', text: 'Najbliższy wolny termin' }), el('span', { class: 'v', text: fmtDay(nextSlot()) })),
    el('div', { class: 'grow' },
      IS_APP && todo.length ? el('button', { type: 'button', class: 'btn sm', onclick: () => saveIcs(todo, 'plan-publikacji.ics') }, 'Cały plan do kalendarza') : null,
      ns === 'default' ? el('button', { type: 'button', class: 'btn sm primary', onclick: () => Notification.requestPermission().then(() => { renderPlan(); notifyCheck(); }) }, 'Włącz powiadomienia') : null));
  $('#planNote').textContent = 'Przypomnienie w telefonie ustawisz przyciskiem przy poście: wydarzenie w kalendarzu przypomni o publikacji, a w jego opisie jest gotowy tekst do wklejenia.'
    + (ns === 'granted' ? ' Na tym urządzeniu aplikacja też pokaże powiadomienie, gdy będzie otwarta.' : '');
  const list = $('#planList'); list.replaceChildren();
  renderToday();
  if (!posts.length) {
    list.append(el('div', { class: 'empty-plan', text: 'Plan jest pusty. Przygotuj post i kliknij „Zapisz w planie”. Trafi na najbliższy wolny dzień publikacji.' }));
    return;
  }
  if (todo.length) list.append(el('h3', { class: 'plan-h', text: 'Do publikacji' }), el('div', { class: 'plist' }, todo.map(planRow)));
  if (done.length) list.append(el('h3', { class: 'plan-h', text: 'Opublikowane' }), el('div', { class: 'plist' }, done.slice(0, 40).map(planRow)));
}
function renderToday() {
  const today = toISO(new Date());
  const list = S.posts.filter(p => p.status !== 'done' && p.plannedFor === today);
  const box = $('#today');
  if (!list.length) { box.hidden = true; return; }
  const p = list[0];
  box.replaceChildren(
    el('span', {}, el('strong', { text: 'Dziś publikujesz: ' }), `${p.title || 'post'}, ${S.settings.publishTime || '19:00'}` + (list.length > 1 ? ` i ${list.length - 1} więcej` : '')),
    el('button', { type: 'button', class: 'btn sm', onclick: () => openPost(p) }, 'Otwórz teksty'));
  box.hidden = false;
}
async function showNotification(title, body) {
  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    if (reg) { await reg.showNotification(title, { body, icon: 'icons/icon-192.png', badge: 'icons/icon-192.png', tag: 'kio-' + body }); return; }
  } catch { /* spróbuj zwykłego powiadomienia */ }
  try { new Notification(title, { body, icon: 'icons/icon-192.png' }); } catch { /* brak powiadomień */ }
}
function notifyCheck() {
  if (notifyState() !== 'granted') return;
  const today = toISO(new Date()); const now = Date.now();
  const sent = LS.get('kio.notified', {});
  for (const p of S.posts) {
    if (p.status === 'done' || p.plannedFor !== today) continue;
    if (now < publishDate(p).getTime() - 15 * 60000) continue;
    const key = p.id + ':' + today; if (sent[key]) continue;
    showNotification('Czas na post', `${p.title || 'Post'} · ${S.settings.publishTime || '19:00'}`);
    sent[key] = 1;
  }
  LS.set('kio.notified', sent);
}

/* ---------- Instalacja aplikacji ---------- */
let installEvt = null;
function setupApp() {
  if (!IS_APP) return;
  window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); installEvt = e; $('#installBtn').hidden = false; });
  window.addEventListener('appinstalled', () => { installEvt = null; $('#installBtn').hidden = true; toast('Zainstalowano. Kadr i Opis masz teraz jak zwykły program.'); });
  $('#installBtn').addEventListener('click', async () => {
    if (!installEvt) return;
    installEvt.prompt();
    try { await installEvt.userChoice; } catch { /* użytkownik zamknął okno */ }
    installEvt = null; $('#installBtn').hidden = true;
  });
  const secure = location.protocol === 'https:' || ['localhost', '127.0.0.1'].includes(location.hostname);
  if ('serviceWorker' in navigator && secure) navigator.serviceWorker.register('sw.js').catch(e => console.warn('sw', e));
}

/* ---------- Widoki i start ---------- */
function switchView(name) {
  $$('.tabs [role="tab"]').forEach(b => b.setAttribute('aria-selected', String(b.dataset.view === name)));
  for (const v of ['new', 'plan', 'settings']) $('#view-' + v).hidden = v !== name;
  LS.set('kio.view', name);
}
function bindEvents() {
  $$('.tabs [role="tab"]').forEach(b => b.addEventListener('click', () => switchView(b.dataset.view)));
  $('#file').addEventListener('change', e => { const f = [...e.target.files]; e.target.value = ''; if (f.length) addFiles(f); });
  const drop = $('#drop');
  ['dragenter', 'dragover'].forEach(t => drop.addEventListener(t, e => { e.preventDefault(); drop.classList.add('over'); }));
  ['dragleave', 'dragend'].forEach(t => drop.addEventListener(t, () => drop.classList.remove('over')));
  drop.addEventListener('drop', e => { e.preventDefault(); drop.classList.remove('over'); if (e.dataTransfer?.files?.length) addFiles(e.dataTransfer.files); });
  document.addEventListener('paste', e => {
    const files = [...(e.clipboardData?.files || [])].filter(f => /^image\//.test(f.type));
    if (files.length) { e.preventDefault(); addFiles(files); }
  });
  $('#goalInfo').addEventListener('click', e => { e.stopPropagation(); toggleGoalPop(); });
  document.addEventListener('click', e => { if (!$('#goalPop').hidden && !$('#goalPop').contains(e.target)) toggleGoalPop(false); });
  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    if (!$('#goalPop').hidden) { toggleGoalPop(false); $('#goalInfo').focus(); }
    if (!$('#saveModal').hidden) closeModal();
  });
  $('#clearBtn').addEventListener('click', clearAll);
  $('#ctxForm').addEventListener('submit', e => { e.preventDefault(); generate(); });
  $('#saveBtn').addEventListener('click', saveToPlan);
  $('#undoBtn').addEventListener('click', () => {
    if (!S.history.length) return;
    S.result = S.history.pop();
    S.igVariant = Math.min(S.igVariant, S.result.instagram.variants.length - 1);
    renderResults(); setStatus('Przywrócono poprzednią wersję tekstów.', 'ok');
  });
  $('#refineChips').replaceChildren(...REFINE_CHIPS.map(([label, ins]) => el('button', { type: 'button', class: 'chip', onclick: () => refine(ins) }, label)));
  $('#refineForm').addEventListener('submit', e => { e.preventDefault(); refine($('#refineInput').value); });
  $$('#bgSeg button').forEach(b => b.addEventListener('click', () => {
    S.frameBg = b.dataset.bg;
    $$('#bgSeg button').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
    renderAllPreviews();
  }));
  $('#allBtn').addEventListener('click', downloadAll);
  $('#setForm').addEventListener('submit', saveSettings);
  $$('#s-main button').forEach(b => b.addEventListener('click', () => { formMain = b.dataset.v; renderMainSeg(); }));
  $$('[data-test]').forEach(b => b.addEventListener('click', () => testKey(b.dataset.test)));
  $('#saveClose').addEventListener('click', closeModal);
  $('#saveModal').addEventListener('click', e => { if (e.target === e.currentTarget) closeModal(); });
}
async function init() {
  if (IS_APP) S.keys = { gemini: '', claude: '', ...LS.get('kio.keys', {}) };
  buildContextForm(); buildGoalPop();
  $('#aiSec').hidden = !IS_APP; $('#aiNote').hidden = IS_APP;
  fillSettingsForm();
  S.result = clone(EXAMPLE); S.isExample = true;
  bindEvents(); setupApp();
  renderStrip(); renderResults(); renderFormats(); renderPlan();
  const view = LS.get('kio.view', 'new');
  switchView(['new', 'plan', 'settings'].includes(view) ? view : 'new');
  if (!IS_APP) samplePromise.then(s => { if (!s && !S.busy) setStatus('Podgląd poza Claude: kadrowanie działa, a teksty pojawią się po otwarciu narzędzia w Claude.'); });
  await Store.init();
  $('#storeNote').textContent = IS_APP ? 'Zapis na tym urządzeniu' : Store.mode === 'db' ? 'Zapis w narzędziu, na każdym urządzeniu' : 'Zapis tylko w tej przeglądarce';
  const saved = await Store.loadSettings();
  if (saved && typeof saved === 'object') { S.settings = { ...DEFAULTS, ...BRAND, ...saved }; fillSettingsForm(); }
  if (IS_APP && !providerOrder().length) showSetupHint();
  Store.watchPosts(list => { S.posts = Array.isArray(list) ? list : []; renderPlan(); notifyCheck(); });
  if (IS_APP) setInterval(notifyCheck, 60000);
}
init();
