
/* ---------- Kontekst posta ---------- */
function buildContextForm() {
  $('#ctxType').replaceChildren(...TYPES.map(t => el('option', { value: t, text: t })));
  $('#ctxType').value = S.ctx.type;
  renderGoalChips();
}
function renderGoalChips() {
  $('#ctxGoal').replaceChildren(...GOALS.map(g => el('button', { type: 'button', class: 'chip', 'aria-pressed': String(S.ctx.goal === g.id),
    onclick: () => { S.ctx.goal = g.id; renderGoalChips(); } }, g.label)));
}
function readContext() {
  S.ctx.type = $('#ctxType').value || TYPES[0];
  S.ctx.place = str($('#ctxPlace').value);
  S.ctx.tags = str($('#ctxTags').value);
  S.ctx.notes = str($('#ctxNotes').value).slice(0, 3000);
}
function writeContext(c) {
  S.ctx = { ...S.ctx, ...c };
  $('#ctxType').value = TYPES.includes(S.ctx.type) ? S.ctx.type : TYPES[0];
  $('#ctxPlace').value = S.ctx.place || ''; $('#ctxTags').value = S.ctx.tags || ''; $('#ctxNotes').value = S.ctx.notes || '';
  renderGoalChips();
}

/* ---------- Ustawienia marki ---------- */
const SET_FIELDS = ['brand', 'person', 'city', 'area', 'website', 'instagram', 'services', 'voice', 'emoji', 'tone', 'cta', 'keywords', 'hashtags'];
let formDays = [];
function fillSettingsForm() {
  for (const k of SET_FIELDS) { const f = $('#s-' + k); if (f) f.value = S.settings[k] ?? ''; }
  $('#s-goal').value = String(S.settings.weeklyGoal || 2);
  formDays = arr(S.settings.days).map(Number);
  renderDayChips();
}
function renderDayChips() {
  $('#s-days').replaceChildren(...DAY_LABELS.map(([d, l]) => el('button', { type: 'button', class: 'chip', 'aria-pressed': String(formDays.includes(d)),
    onclick: () => { formDays = formDays.includes(d) ? formDays.filter(x => x !== d) : [...formDays, d]; renderDayChips(); } }, l)));
}
async function saveSettings(e) {
  e.preventDefault();
  const s = { ...S.settings };
  for (const k of SET_FIELDS) { const f = $('#s-' + k); if (f) s[k] = str(f.value); }
  s.weeklyGoal = clamp(parseInt($('#s-goal').value, 10) || 2, 1, 14);
  s.days = formDays.length ? [...formDays] : [2, 5];
  S.settings = s; renderPlan();
  const btn = $('#setSave'); btn.disabled = true;
  try { await Store.saveSettings(s); toast('Zapisano ustawienia marki.'); }
  catch (err) { console.warn(err); toast('Nie udało się zapisać na stałe. Zmiany działają do odświeżenia strony.'); }
  finally { btn.disabled = false; }
}

/* ---------- Plan publikacji ---------- */
function plural(n, one, few, many) {
  if (n === 1) return one;
  const d = n % 10, t = n % 100;
  return d >= 2 && d <= 4 && (t < 12 || t > 14) ? few : many;
}
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
function postTitle() {
  return str(S.result?.seo?.h1) || [S.ctx.type, S.ctx.place].filter(Boolean).join(' · ') || 'Post';
}
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
      toast(`Zapisano w planie na ${fmtDay(when)}.`);
    }
    renderResults();
  } catch (e) {
    console.warn(e);
    toast(e?.code === 'quota_exceeded' ? 'Plan jest pełny. Usuń stare posty i spróbuj ponownie.' : 'Nie udało się zapisać. Spróbuj ponownie.');
  } finally { btn.disabled = false; }
}
function openPost(p) {
  if (!p.result) { toast('Ten wpis nie ma zapisanych tekstów.'); return; }
  S.photos.forEach(x => URL.revokeObjectURL(x.url)); S.photos = []; S.active = 0;
  S.result = normalize(clone(p.result), arr(p.result.photos).length || 1);
  S.isExample = false; S.savedPostId = p.id; S.history = [];
  S.igVariant = clamp(Number(p.variant) || 0, 0, S.result.instagram.variants.length - 1);
  if (p.ctx) writeContext(p.ctx);
  switchView('new');
  renderStrip(); renderResults(); renderFormats();
  setStatus('Otworzono zapisany post. Żeby pobrać kadry, wgraj to samo zdjęcie jeszcze raz.', 'ok');
  window.scrollTo({ top: 0, behavior: 'smooth' });
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
  return el('div', { class: 'prow' + (p.status === 'done' ? ' done' : '') },
    p.thumb ? el('img', { src: p.thumb, alt: '' }) : el('span', { class: 'ph' }),
    el('div', {}, el('div', { class: 't', text: p.title || 'Post' }),
      el('div', { class: 'm', text: [fmtDay(p.plannedFor), goal?.label, c.place].filter(Boolean).join(' · ') })),
    el('div', { class: 'acts' }, date, el('label', { class: 'donecb' }, cb, 'Opublikowane'),
      el('button', { type: 'button', class: 'btn sm', onclick: () => openPost(p) }, 'Otwórz teksty'), del));
}
function renderPlan() {
  const posts = S.posts;
  const todo = posts.filter(p => p.status !== 'done')
    .sort((a, b) => str(a.plannedFor || '9999').localeCompare(str(b.plannedFor || '9999')) || (a.createdAt || 0) - (b.createdAt || 0));
  const done = posts.filter(p => p.status === 'done').sort((a, b) => (b.doneAt || 0) - (a.doneAt || 0));
  $('#planCount').textContent = todo.length ? String(todo.length) : '';
  const [ws, we] = weekBounds();
  const weekDone = done.filter(p => p.doneAt >= ws.getTime() && p.doneAt < we.getTime()).length;
  const goal = S.settings.weeklyGoal || 2;
  const today = toISO(new Date());
  const horizon = new Date(); horizon.setDate(horizon.getDate() + 28);
  const planned = todo.filter(p => p.plannedFor && p.plannedFor >= today && p.plannedFor <= toISO(horizon)).length;
  const overdue = todo.filter(p => p.plannedFor && p.plannedFor < today).length;
  const missing = Math.max(0, goal - weekDone);
  $('#planStats').replaceChildren(
    el('div', { class: 'stat' }, el('div', { class: 'k', text: 'Ten tydzień' }), el('div', { class: 'v', text: `${weekDone} / ${goal}` }),
      el('div', { class: 'meter', 'aria-hidden': 'true' }, Array.from({ length: Math.max(goal, weekDone) }, (_, i) => el('i', { class: i < weekDone ? 'on' : '' }))),
      el('div', { class: 's', text: missing ? `Brakuje ${missing} ${plural(missing, 'posta', 'postów', 'postów')} do celu.` : 'Cel tygodnia zrobiony.' })),
    el('div', { class: 'stat' }, el('div', { class: 'k', text: 'Zaplanowane na 4 tygodnie' }), el('div', { class: 'v', text: String(planned) }),
      el('div', { class: 's', text: `Przy celu ${goal} tygodniowo to ${goal * 4} postów.` })),
    el('div', { class: 'stat' }, el('div', { class: 'k', text: 'Najbliższy wolny termin' }), el('div', { class: 'v', text: fmtDay(nextSlot()) }),
      el('div', { class: 's', text: overdue ? `${overdue} ${plural(overdue, 'post czeka', 'posty czekają', 'postów czeka')} po terminie.` : 'Dni publikacji zmienisz w ustawieniach marki.' })));
  const list = $('#planList'); list.replaceChildren();
  if (!posts.length) {
    list.append(el('div', { class: 'empty-plan', text: 'Plan jest pusty. Przygotuj post i kliknij „Zapisz w planie”. Trafi na najbliższy wolny dzień publikacji.' }));
    return;
  }
  if (todo.length) list.append(el('h3', { class: 'plan-h', text: 'Do publikacji' }), el('div', { class: 'plist' }, todo.map(planRow)));
  if (done.length) list.append(el('h3', { class: 'plan-h', text: 'Opublikowane' }), el('div', { class: 'plist' }, done.slice(0, 40).map(planRow)));
}

/* ---------- Widoki i start ---------- */
function switchView(name) {
  $$('.tabs [role="tab"]').forEach(b => b.setAttribute('aria-selected', String(b.dataset.view === name)));
  for (const v of ['new', 'plan', 'settings']) $('#view-' + v).hidden = v !== name;
  try { localStorage.setItem('kio.view', name); } catch { /* widok to tylko wygoda */ }
}
function closeModal() { $('#saveModal').hidden = true; }
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
  $('#zipBtn').addEventListener('click', downloadZip);
  $('#setForm').addEventListener('submit', saveSettings);
  $('#saveClose').addEventListener('click', closeModal);
  $('#saveModal').addEventListener('click', e => { if (e.target === e.currentTarget) closeModal(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !$('#saveModal').hidden) closeModal(); });
}
async function init() {
  buildContextForm();
  fillSettingsForm();
  S.result = clone(EXAMPLE); S.isExample = true;
  bindEvents();
  renderStrip(); renderResults(); renderFormats(); renderPlan();
  let view = 'new';
  try { view = localStorage.getItem('kio.view') || 'new'; } catch { view = 'new'; }
  switchView(['new', 'plan', 'settings'].includes(view) ? view : 'new');
  samplePromise.then(s => { if (!s && !S.busy) setStatus('Podgląd poza Claude: kadrowanie działa, a teksty pojawią się po otwarciu narzędzia w Claude.'); });
  await Store.init();
  $('#storeNote').textContent = Store.mode === 'db' ? 'Zapis w narzędziu, na każdym urządzeniu' : 'Zapis tylko w tej przeglądarce';
  const saved = await Store.loadSettings();
  if (saved && typeof saved === 'object') { S.settings = { ...DEFAULTS, ...saved }; fillSettingsForm(); }
  Store.watchPosts(list => { S.posts = Array.isArray(list) ? list : []; renderPlan(); });
}
init();
