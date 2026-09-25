
/* ---------- Teksty ---------- */
const PTABS = [
  { id: 'instagram', label: 'Instagram' }, { id: 'facebook', label: 'Facebook' },
  { id: 'stories', label: 'Stories' }, { id: 'google', label: 'Google i strona' },
];
const REFINE_CHIPS = [
  ['Krócej', 'Skróć wszystkie teksty o około jedną trzecią, zachowując najważniejsze informacje.'],
  ['Bardziej elegancko', 'Nadaj tekstom bardziej elegancki charakter premium: mniej słów, więcej klasy.'],
  ['Po angielsku', 'Przetłumacz wszystkie teksty na naturalny angielski dla par z zagranicy. Hashtagi zostaw w limicie 5.'],
];

function renderResults() {
  if (!S.result) return;
  $('#exampleBadge').hidden = !S.isExample;
  const save = $('#saveBtn'); save.hidden = S.isExample;
  save.textContent = S.savedPostId ? 'Zapisz zmiany' : 'Zapisz w planie';
  $('#undoBtn').hidden = !S.history.length;
  renderAnalysis(); renderPTabs(); renderPBody();
}
function renderAnalysis() {
  const r = S.result, a = r.analysis, box = $('#analysis'); box.replaceChildren();
  if (S.isExample) box.append(el('p', { class: 'ex', text: 'Tak wygląda wynik dla przykładowej sesji. Wgraj swoje zdjęcie i kliknij „Przygotuj post”.' }));
  if (a.summary) box.append(el('p', {}, el('strong', { text: 'Co widać: ' }), a.summary));
  if (a.bestUse) box.append(el('p', {}, el('strong', { text: 'Gdzie wykorzystać: ' }), a.bestUse));
  if (a.tips?.length) box.append(el('ul', {}, a.tips.map(t => el('li', { text: t }))));
  const n = S.photos.length;
  if (!S.isExample && n > 1 && a.order?.length === n && a.order.some((k, i) => k !== i + 1)) {
    box.append(el('p', {}, `Proponowana kolejność w karuzeli: ${a.order.join(', ')}. `,
      el('button', { type: 'button', class: 'btn sm', onclick: applyOrder }, 'Ustaw tę kolejność')));
  }
  if (r.checklist?.length) {
    box.append(el('details', {}, el('summary', { text: `Przed publikacją (${r.checklist.length})` }),
      el('ul', { class: 'checks' }, r.checklist.map(t => el('li', {}, el('label', {}, el('input', { type: 'checkbox' }), el('span', { text: t })))))));
  }
  if (IS_APP && r.meta?.provider) box.append(el('p', { class: 'note', text: `Teksty napisał: ${PROVIDER_NAME[r.meta.provider] || r.meta.provider}` }));
}
function renderPTabs() {
  const bar = $('#ptabs'); bar.replaceChildren();
  for (const t of PTABS) {
    bar.append(el('button', { type: 'button', role: 'tab', id: 'pt-' + t.id, 'aria-selected': String(S.pTab === t.id),
      onclick: () => { S.pTab = t.id; renderPTabs(); renderPBody(); } }, t.label));
  }
  $('#pbody').setAttribute('aria-labelledby', 'pt-' + S.pTab);
}
function renderPBody() {
  const body = $('#pbody'); body.replaceChildren();
  const make = { instagram: bodyInstagram, facebook: bodyFacebook, stories: bodyStories, google: bodyGoogle }[S.pTab] || bodyInstagram;
  body.append(...make(S.result).filter(Boolean));
  requestAnimationFrame(() => $$('textarea.copytext', body).forEach(autosize));
}

/* ---------- Pola z licznikami ---------- */
let fieldSeq = 0;
function autosize(ta) { ta.style.height = 'auto'; ta.style.height = Math.min(ta.scrollHeight + 2, 720) + 'px'; }
function copyBtn(getText) {
  const b = el('button', { type: 'button', class: 'btn sm', onclick: () => copyText(typeof getText === 'function' ? getText() : getText, b) }, 'Kopiuj');
  return b;
}
function fieldBlock({ label, get, set, limit, warnAt, rows = 3, short = false, copy, onInput, extra }) {
  const id = 'fld' + (++fieldSeq);
  const ta = el('textarea', { class: 'copytext' + (short ? ' short' : ''), id, rows: String(rows) });
  ta.value = get() || '';
  const counter = el('span', { class: 'counter' });
  const upd = () => {
    const n = len(ta.value);
    counter.textContent = limit ? `${n} / ${limit}` : `${n} zn.`;
    const over = limit && n > limit;
    counter.className = 'counter' + (over ? ' over' : limit && n > (warnAt || limit * 0.9) ? ' warn' : '');
    counter.title = over ? 'Za długie dla tej platformy' : '';
  };
  ta.addEventListener('input', () => { set(ta.value); upd(); autosize(ta); onInput?.(ta.value); });
  upd();
  const btn = copyBtn(() => (copy ? copy(ta.value) : ta.value));
  return el('div', { class: 'fblock' }, el('div', { class: 'fblock-h' }, el('label', { for: id, text: label }), counter, btn), ta, extra);
}
function infoList(pairs) {
  const rows = pairs.filter(([, v]) => str(v));
  if (!rows.length) return null;
  return el('dl', { class: 'info' }, rows.map(([k, v]) => [el('dt', { text: k }), el('dd', { text: v })]));
}
const cleanTagOne = s => { const t = str(s).replace(/^#+/, '').replace(/[\s#,]+/g, ''); return t ? '#' + t : ''; };
function hashtagBlock(ig) {
  const wrap = el('div', { class: 'fblock' });
  const draw = focus => {
    wrap.replaceChildren();
    const count = ig.hashtags.length;
    const input = el('input', { type: 'text', placeholder: '#dodaj', 'aria-label': 'Dodaj hashtag', disabled: count >= 5 });
    const add = () => {
      const t = cleanTagOne(input.value); input.value = '';
      if (t && ig.hashtags.length < 5 && !ig.hashtags.some(h => h.toLowerCase() === t.toLowerCase())) ig.hashtags.push(t);
      draw(true);
    };
    input.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ',' || e.key === ' ') { e.preventDefault(); add(); } });
    input.addEventListener('blur', () => { if (input.value.trim()) add(); });
    wrap.append(
      el('div', { class: 'fblock-h' }, el('span', { class: 'lbl', text: 'Hashtagi (Instagram pozwala na 5)' }),
        el('span', { class: 'counter' + (count > 5 ? ' over' : ''), text: `${count} / 5` }), copyBtn(() => ig.hashtags.join(' '))),
      el('div', { class: 'tags' }, ig.hashtags.map((h, k) => el('span', { class: 'tagchip' }, h,
        el('button', { type: 'button', 'aria-label': `Usuń ${h}`, onclick: () => { ig.hashtags.splice(k, 1); draw(); } }, '×'))), input));
    if (focus && count < 5) input.focus();
  };
  draw(); return wrap;
}
function altBlock(r) {
  return el('div', { class: 'alts' }, r.photos.map((p, i) => el('div', { class: 'altrow' },
    !S.isExample && S.photos[i] ? el('img', { src: S.photos[i].thumb, alt: '' }) : el('span', { class: 'ph' }),
    fieldBlock({ label: r.photos.length > 1 ? `Tekst alternatywny · zdjęcie ${i + 1}` : 'Tekst alternatywny',
      get: () => p.alt, set: t => { p.alt = t; }, limit: 125, warnAt: 110, rows: 2, short: true }))));
}

/* ---------- Zakładki ---------- */
function igCaption(r = S.result, variant = S.igVariant) {
  const ig = r.instagram; const v = ig.variants[clamp(variant, 0, ig.variants.length - 1)];
  return (v?.text || '').trim() + (ig.hashtags.length ? '\n\n' + ig.hashtags.join(' ') : '');
}
function bodyInstagram(r) {
  const ig = r.instagram; const i = clamp(S.igVariant, 0, ig.variants.length - 1); const v = ig.variants[i];
  const out = [];
  if (ig.variants.length > 1) {
    out.push(el('div', { class: 'variants', role: 'group', 'aria-label': 'Warianty opisu' },
      ig.variants.map((x, k) => el('button', { type: 'button', class: 'chip', 'aria-pressed': String(k === i),
        onclick: () => { S.igVariant = k; renderPBody(); } }, `${k + 1}. ${x.name}`))));
  }
  const hook = el('p', { class: 'note', style: 'margin-top:6px' });
  const setHook = t => {
    const n = len((t.split('\n').find(l => l.trim()) || '').trim());
    hook.textContent = n <= 125 ? `Pierwsza linia: ${n} znaków, zmieści się przed „więcej”.` : `Pierwsza linia ma ${n} znaków. Przed „więcej” widać około 125.`;
    hook.style.color = n <= 125 ? '' : 'var(--warn)';
  };
  setHook(v.text);
  out.push(fieldBlock({ label: 'Opis posta', get: () => v.text, set: t => { v.text = t; }, limit: 2200, warnAt: 1600, rows: 8, onInput: setHook, extra: hook }));
  out.push(hashtagBlock(ig));
  const all = el('button', { type: 'button', class: 'btn primary', onclick: () => copyText(igCaption(), all) }, 'Kopiuj opis z hashtagami');
  out.push(el('div', { class: 'actions' }, all));
  out.push(altBlock(r));
  out.push(infoList([['Lokalizacja', ig.location], ['Oznacz', ig.tag.join(', ')], ['Współpraca', ig.collab]]));
  return out;
}
function bodyFacebook(r) {
  return [fieldBlock({ label: 'Post na Facebooku', get: () => r.facebook.text, set: t => { r.facebook.text = t; }, rows: 7 }),
    el('p', { class: 'note', text: 'Na Facebooku link do strony w treści działa, a hashtagi są zbędne.' })];
}
function bodyStories(r) {
  const out = r.stories.map((s, i) => el('div', { class: 'story' },
    fieldBlock({ label: `Plansza ${i + 1}`, get: () => s.text, set: t => { s.text = t; }, rows: 2, short: true }),
    infoList([['Naklejka', s.sticker]])));
  out.push(el('div', { class: 'story' }, fieldBlock({ label: 'Pomysł na rolkę', get: () => r.reel, set: t => { r.reel = t; }, rows: 3, short: true })));
  out.push(el('p', { class: 'note', text: 'Tło do stories pobierzesz w formacie 9:16 w sekcji Kadry.' }));
  return out;
}
function bodyGoogle(r) {
  const g = r.google, s = r.seo; const site = str(S.settings.website).replace(/^https?:\/\//, '').replace(/\/+$/, '');
  const files = () => r.photos.map((p, i) => (S.isExample ? p.file : p.file || fileBase(i)) + '.jpg');
  const urlNote = el('p', { class: 'note mono', style: 'margin-top:6px', text: site ? `${site}/${slugify(s.slug) || '…'}` : '' });
  return [
    fieldBlock({ label: 'Post w Profilu Firmy w Google', get: () => g.text, set: t => { g.text = t; }, limit: 1500, warnAt: 1200, rows: 5 }),
    infoList([['Przycisk', g.button]]),
    el('h3', { class: 'sub-h', text: 'Wpis na stronę (SEO)' }),
    fieldBlock({ label: 'Tytuł wpisu', get: () => s.h1, set: t => { s.h1 = t; }, rows: 2, short: true }),
    fieldBlock({ label: 'Meta title', get: () => s.metaTitle, set: t => { s.metaTitle = t; }, limit: 60, warnAt: 55, rows: 2, short: true }),
    fieldBlock({ label: 'Meta description', get: () => s.metaDescription, set: t => { s.metaDescription = t; }, limit: 155, warnAt: 145, rows: 3, short: true }),
    fieldBlock({ label: 'Adres wpisu', get: () => s.slug, set: t => { s.slug = t; }, rows: 1, short: true,
      copy: t => slugify(t), onInput: t => { if (site) urlNote.textContent = `${site}/${slugify(t) || '…'}`; }, extra: site ? urlNote : null }),
    fieldBlock({ label: 'Wstęp do wpisu', get: () => s.intro, set: t => { s.intro = t; }, rows: 5 }),
    el('div', { class: 'fblock' }, el('div', { class: 'fblock-h' }, el('span', { class: 'lbl', text: 'Nazwy plików zdjęć' }), copyBtn(() => files().join('\n'))),
      el('p', { class: 'note mono', style: 'white-space:pre-line', text: files().join('\n') })),
    el('div', { class: 'fblock' }, el('div', { class: 'fblock-h' }, el('span', { class: 'lbl', text: 'Frazy kluczowe' }), copyBtn(() => s.keywords.join(', '))),
      el('div', { class: 'tags' }, s.keywords.map(k => el('span', { class: 'tagchip kw', text: k })))),
  ];
}
