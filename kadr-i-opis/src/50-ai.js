
/* ---------- Przykładowy wynik (pierwszy widok) ---------- */
const EXAMPLE = {
  analysis: {
    summary: 'Para idzie przez łąkę pod światło zachodzącego słońca. Najmocniejsze są kontra, ruch welonu i niepozowane gesty.',
    bestUse: 'Okładka karuzeli z sesji i pin na Pinterest, bo ciepłe światło dobrze działa jako inspiracja.',
    cover: 1, order: [1],
    tips: ['Daj to zdjęcie jako pierwsze w karuzeli, detale dalej.', 'Po publikacji wrzuć post do stories z ankietą o złotej godzinie.'],
  },
  photos: [{ point: { x: 0.5, y: 0.4 }, box: { x0: 0.3, y0: 0.15, x1: 0.7, y1: 0.95 },
    alt: 'Para młoda idzie przez łąkę pod światło zachodzącego słońca, welon unosi się na wietrze',
    file: 'sesja-plenerowa-zachod-slonca-krakow' }],
  crops: { ig45: 'kadr', ig34: 'kadr', story: 'ramka', pin: 'kadr', sq: 'kadr', wide: 'kadr', gbp: 'kadr',
    note: 'Poziome zdjęcie: w 4:5 kadr zostawia parę w centrum, w stories lepsza ramka z rozmytym tłem.' },
  instagram: {
    variants: [
      { name: 'Historia', text: 'Dwadzieścia minut. Tyle trwała złota godzina tego wieczoru pod Krakowem.\n\nNie ustawiałem ich do zdjęcia. Poprosiłem tylko, żeby przeszli się przez łąkę i porozmawiali o dniu, który ich czeka. Resztę zrobiło światło.\n\nPlanujecie plener? Napiszcie w wiadomości datę ślubu, a podpowiem, o której wyjść, żeby trafić na takie światło.' },
      { name: 'Krótko', text: 'Złota godzina pod Krakowem. Bez pozowania i bez pośpiechu.\n\nWolne terminy na 2027: napisz w wiadomości prywatnej datę i miejsce ślubu.' },
      { name: 'Dla par', text: 'Jak trafić na takie światło podczas sesji?\n\n1. Sprawdźcie godzinę zachodu słońca w dniu pleneru.\n2. Zacznijcie 60–90 minut wcześniej.\n3. Zostańcie jeszcze kwadrans po zachodzie, bo wtedy niebo bywa najładniejsze.\n\nZapiszcie ten post na później. Szukacie fotografa na 2027? Napiszcie datę i miejsce w wiadomości.' },
    ],
    hashtags: ['#fotografslubnykrakow', '#sesjaplenerowa', '#zlotagodzina', '#slub2027', '#inspiracjeslubne'],
    location: 'Kraków',
    tag: ['konto pary (za jej zgodą)', 'konto wizażu i fryzury'],
    collab: 'Zaproponuj parze post we współpracy. Zobaczą go też ich znajomi, często pary przed ślubem.',
  },
  facebook: { text: 'Złota godzina pod Krakowem: dwadzieścia minut światła, które robi całą sesję.\n\nPlener najlepiej zacząć 60–90 minut przed zachodem słońca. Światło jest wtedy miękkie i ciepłe, a zdjęcia wychodzą naturalnie, bez sztywnego pozowania.\n\nWięcej sesji plenerowych: www.kwfoto.pl\nWolne terminy na 2027: napiszcie datę i miejsce ślubu.' },
  pinterest: {
    title: 'Sesja plenerowa o zachodzie słońca pod Krakowem – inspiracje ślubne',
    description: 'Sesja plenerowa w złotej godzinie: para młoda na łące pod światło zachodzącego słońca. Inspiracja na plener ślubny w okolicach Krakowa i podpowiedź, jak zaplanować sesję, żeby trafić na najpiękniejsze światło. Fotograf ślubny Kraków – KWFoto.pl.',
    board: 'Sesje plenerowe o zachodzie słońca',
  },
  google: {
    text: 'Sesje plenerowe w złotej godzinie w Krakowie i okolicach. Plener planuję pod godzinę zachodu słońca, żeby światło było miękkie i ciepłe, a zdjęcia naturalne, bez sztywnego pozowania. Wolne terminy na 2027: napisz lub zadzwoń i podaj datę oraz miejsce ślubu.',
    button: 'Więcej informacji',
  },
  seo: {
    h1: 'Sesja plenerowa o zachodzie słońca pod Krakowem',
    metaTitle: 'Sesja plenerowa o zachodzie słońca | Fotograf ślubny Kraków',
    metaDescription: 'Sesja plenerowa w złotej godzinie pod Krakowem: naturalne zdjęcia pary w ciepłym świetle. Zobacz reportaż i sprawdź wolne terminy na 2027.',
    slug: 'sesja-plenerowa-zachod-slonca-krakow',
    keywords: ['sesja plenerowa Kraków', 'fotograf ślubny Kraków', 'sesja w złotej godzinie', 'plener ślubny o zachodzie słońca', 'zdjęcia ślubne Kraków'],
    intro: 'Złota godzina to najkrótsza i najpiękniejsza część dnia na plener. Ta sesja powstała pod Krakowem, na łące tuż przed zachodem słońca. Zamiast pozowania był spacer i rozmowa, a światło zrobiło resztę. Jeśli planujecie sesję plenerową, zacznijcie 60–90 minut przed zachodem i zostawcie sobie kilkanaście minut po nim, bo wtedy niebo często ma najpiękniejsze kolory.',
  },
  stories: [
    { text: 'Złota godzina czy zachód po weselu?', sticker: 'Ankieta: „Złota godzina” / „Po weselu”' },
    { text: 'Nowa sesja w portfolio. Całość w poście 👇', sticker: 'Udostępniony post i naklejka z linkiem do strony' },
  ],
  reel: 'Nagraj 10 sekund POV telefonem na stopce aparatu: idziesz za parą przez łąkę, a na końcu pojawia się to zdjęcie.',
  checklist: ['Oznacz parę (za jej zgodą) i dodaj lokalizację', 'Wklej tekst alternatywny w ustawieniach zaawansowanych', 'Zaproś parę do współpracy (Collab)', 'Po publikacji udostępnij post w stories z ankietą'],
};

/* ---------- Normalizacja odpowiedzi ---------- */
function brandHashtags() {
  return str(S.settings.hashtags).split(/[\s,]+/).map(h => h.replace(/^#+/, '')).filter(Boolean).map(h => '#' + h);
}
function cleanTags(list) {
  const seen = new Set(); const out = [];
  for (const raw of [...brandHashtags(), ...arr(list)]) {
    const t = '#' + str(raw).replace(/^#+/, '').replace(/[\s#]+/g, '');
    if (t.length < 2 || seen.has(t.toLowerCase())) continue;
    seen.add(t.toLowerCase()); out.push(t);
  }
  return out.slice(0, 5);
}
const CROP_IDS = FORMATS.map(f => f.id);
function normTexts(r, prev = {}) {
  const ig = r.instagram || {}; const pig = prev.instagram || {};
  const variants = arr(ig.variants).map((v, i) => ({ name: str(v?.name) || `Wariant ${i + 1}`, text: str(v?.text) })).filter(v => v.text).slice(0, 4);
  const pin = r.pinterest || {}; const g = r.google || {}; const seo = r.seo || {};
  const stories = arr(r.stories).map(s => ({ text: str(s?.text), sticker: str(s?.sticker) })).filter(s => s.text).slice(0, 4);
  return {
    instagram: {
      variants: variants.length ? variants : clone(pig.variants || [{ name: 'Opis', text: '' }]),
      hashtags: ig.hashtags ? cleanTags(ig.hashtags) : clone(pig.hashtags || []),
      location: str(ig.location) || pig.location || '',
      tag: arr(ig.tag).map(str).filter(Boolean).slice(0, 6).length ? arr(ig.tag).map(str).filter(Boolean).slice(0, 6) : clone(pig.tag || []),
      collab: str(ig.collab) || pig.collab || '',
    },
    facebook: { text: str(r.facebook?.text) || prev.facebook?.text || '' },
    pinterest: { title: str(pin.title) || prev.pinterest?.title || '', description: str(pin.description) || prev.pinterest?.description || '', board: str(pin.board) || prev.pinterest?.board || '' },
    google: { text: str(g.text) || prev.google?.text || '', button: str(g.button) || prev.google?.button || '' },
    seo: {
      h1: str(seo.h1) || prev.seo?.h1 || '', metaTitle: str(seo.metaTitle) || prev.seo?.metaTitle || '',
      metaDescription: str(seo.metaDescription) || prev.seo?.metaDescription || '',
      slug: slugify(seo.slug) || prev.seo?.slug || '',
      keywords: arr(seo.keywords).map(str).filter(Boolean).slice(0, 10).length ? arr(seo.keywords).map(str).filter(Boolean).slice(0, 10) : clone(prev.seo?.keywords || []),
      intro: str(seo.intro) || prev.seo?.intro || '',
    },
    stories: stories.length ? stories : clone(prev.stories || []),
    reel: str(r.reel) || prev.reel || '',
  };
}
function normalize(r, n) {
  r = r && typeof r === 'object' ? r : {};
  const a = r.analysis || {};
  const byN = new Map(arr(r.photos).map((p, i) => [Number(p?.n) || i + 1, p]));
  const photos = Array.from({ length: n }, (_, i) => {
    const p = byN.get(i + 1) || {}; const b = p.box || {};
    let box = { x0: num01(b.x0, 0.2), y0: num01(b.y0, 0.1), x1: num01(b.x1, 0.8), y1: num01(b.y1, 0.95) };
    if (box.x1 - box.x0 < 0.05 || box.y1 - box.y0 < 0.05) box = { x0: 0.2, y0: 0.1, x1: 0.8, y1: 0.95 };
    return { point: { x: num01(p.point?.x, 0.5), y: num01(p.point?.y, 0.42) }, box, alt: str(p.alt), file: slugify(p.file) };
  });
  const crops = { note: str(r.crops?.note) };
  for (const id of CROP_IDS) { const v = str(r.crops?.[id]).toLowerCase(); if (v === 'kadr' || v === 'ramka') crops[id] = v; }
  const order = arr(a.order).map(Number).filter(k => Number.isInteger(k) && k >= 1 && k <= n);
  return {
    analysis: {
      summary: str(a.summary), bestUse: str(a.bestUse),
      cover: clamp(Number(a.cover) || 1, 1, Math.max(1, n)),
      order: new Set(order).size === n ? order : [],
      tips: arr(a.tips).map(str).filter(Boolean).slice(0, 4),
    },
    photos, crops, ...normTexts(r),
    checklist: arr(r.checklist).map(str).filter(Boolean).slice(0, 7),
  };
}

/* ---------- Polecenie dla Claude ---------- */
const VOICE = {
  'ja-m': 'pierwsza osoba liczby pojedynczej, rodzaj męski (np. „fotografowałem”, „byłem”)',
  'ja-f': 'pierwsza osoba liczby pojedynczej, rodzaj żeński (np. „fotografowałam”, „byłam”)',
  my: 'pierwsza osoba liczby mnogiej, jako zespół (np. „fotografowaliśmy”)',
};
const EMOJI = { none: 'bez emoji', few: 'najwyżej 1–2 emoji w tekście i tylko gdy pasują', some: 'emoji dozwolone, z umiarem' };
function brandBlock() {
  const s = S.settings; const tags = brandHashtags();
  return [
    `- Marka: ${s.brand || 'nie podano'}${s.person ? ` (autor: ${s.person})` : ''}`,
    `- Miasto i obszar działania: ${[s.city, s.area].filter(Boolean).join('; ') || 'nie podano'}`,
    `- Strona: ${s.website || 'nie podano'}; Instagram: ${s.instagram || 'nie podano'}`,
    `- Usługi: ${s.services || 'fotografia ślubna'}`,
    `- Forma wypowiedzi: ${VOICE[s.voice] || VOICE['ja-m']}`,
    `- Ton: ${s.tone || 'ciepły i konkretny'}; emoji: ${EMOJI[s.emoji] || EMOJI.few}`,
    `- Stałe wezwanie do działania: ${s.cta || 'brak'}`,
    `- Frazy SEO marki: ${s.keywords || 'brak'}`,
    `- Stałe hashtagi marki (wliczają się do limitu 5): ${tags.join(' ') || 'brak'}`,
  ].join('\n');
}
function rulesBlock() {
  return `ZASADY
- Pisz po polsku, naturalnie, jak doświadczony fotograf. Unikaj sztampy: „magiczny dzień”, „wyjątkowe chwile”, „zatrzymać czas”, „bajkowy”.
- Nie wymyślaj faktów: imion, nazw miejsc, dat, pogody ani historii, których nie ma w kontekście i nie widać na zdjęciu. Tekst ma być prawdziwy bez nich.
- Instagram: 3 wyraźnie różne warianty (1. historia i emocje, 2. krótki i elegancki, 3. wartość dla par: porada lub kulisy). Pierwsze zdanie to haczyk do 125 znaków, bo tyle widać przed „więcej”. Każdy wariant do 1200 znaków, akapity oddzielone pustą linią, na końcu wezwanie do działania dopasowane do celu.
- Hashtagi na Instagram: najwyżej 5 łącznie (limit Instagrama), w tym stałe hashtagi marki. Mieszanka lokalnych i tematycznych, bez ogólników w rodzaju #love.
- Tekst alternatywny: rzeczowy opis tego, co widać, do 125 znaków, bez „zdjęcie przedstawia”.
- Pinterest: tytuł do 100 znaków, opis do 500 znaków, najważniejsze frazy w pierwszych 50 znakach.
- Profil Firmy w Google: 300–700 znaków, lokalnie (miasto, region), z wezwaniem do działania.
- SEO strony: meta title do 60 znaków, meta description do 155 znaków; slug i nazwy plików małymi literami, bez polskich znaków, słowa łączone myślnikami.`;
}
function contextBlock() {
  const c = S.ctx; const goal = GOALS.find(g => g.id === c.goal) || GOALS[0];
  return `KONTEKST POSTA
- Rodzaj materiału: ${c.type}
- Cel: ${goal.prompt}
- Miejsce: ${c.place || 'nie podano'}
- Do oznaczenia: ${c.tags || 'nie podano'}
- Notatki autora: ${c.notes || 'brak'}`;
}
function buildPrompt(n, seesImages) {
  const photosLine = seesImages
    ? `W załączniku ${n === 1 ? 'jest 1 zdjęcie' : `są zdjęcia do jednego posta (${n}), ponumerowane od 1 w kolejności załączenia`}.`
    : `Nie widzisz zdjęć (${n}); opieraj się na kontekście, punkt kluczowy ustaw na środku kadru.`;
  return `Jesteś ekspertem od social mediów i SEO. Od lat prowadzisz profile fotografów i filmowców ślubnych z segmentu premium w Polsce. Przygotuj komplet materiałów do publikacji. ${photosLine}

MARKA
${brandBlock()}

${contextBlock()}

${rulesBlock()}
- Kadrowanie: dla każdego zdjęcia podaj punkt kluczowy (najważniejsze miejsce kadru, np. twarze pary) i prostokąt obejmujący główny motyw, we współrzędnych 0–1 (x od lewej, y od góry). Dla każdego formatu oceń, czy lepiej przyciąć („kadr”), czy wpasować całe zdjęcie z tłem („ramka”). Formaty: ig45 = 4:5, ig34 = 3:4, story = 9:16, pin = 2:3, sq = 1:1, wide = 16:9, gbp = 4:3.
- Jeśli zdjęć jest kilka, wskaż najlepszą okładkę karuzeli i proponowaną kolejność.

ODPOWIEDŹ
Zwróć wyłącznie JSON w tym kształcie:
{"analysis":{"summary":"1–2 zdania: co jest na zdjęciach i co w nich najmocniejsze","bestUse":"gdzie to zadziała najlepiej i dlaczego, 1 zdanie","cover":1,"order":[1],"tips":["do 3 krótkich wskazówek publikacji"]},
"photos":[{"n":1,"point":{"x":0.5,"y":0.4},"box":{"x0":0.2,"y0":0.1,"x1":0.8,"y1":0.95},"alt":"…","file":"nazwa-pliku-bez-rozszerzenia"}],
"crops":{"ig45":"kadr","ig34":"kadr","story":"ramka","pin":"kadr","sq":"kadr","wide":"kadr","gbp":"kadr","note":"1 zdanie o kadrowaniu"},
"instagram":{"variants":[{"name":"Historia","text":"…"},{"name":"Krótko","text":"…"},{"name":"Dla par","text":"…"}],"hashtags":["#…"],"location":"sugerowana lokalizacja","tag":["kogo oznaczyć"],"collab":"komu zaproponować post we współpracy i dlaczego"},
"facebook":{"text":"…"},
"pinterest":{"title":"…","description":"…","board":"nazwa tablicy"},
"google":{"text":"…","button":"np. Więcej informacji"},
"seo":{"h1":"…","metaTitle":"…","metaDescription":"…","slug":"…","keywords":["5–8 fraz"],"intro":"wstęp do wpisu na blogu, 80–120 słów"},
"stories":[{"text":"tekst na planszę","sticker":"naklejka, np. ankieta z odpowiedziami"}],
"reel":"pomysł na rolkę z tym materiałem, 1–2 zdania",
"checklist":["3–6 punktów do odhaczenia przed publikacją"]}
Tablica "photos" ma mieć dokładnie ${n} ${n === 1 ? 'element' : 'elementów'}.`;
}
function pickTexts(r) {
  const { instagram, facebook, pinterest, google, seo, stories, reel } = r;
  return { instagram, facebook, pinterest, google, seo, stories, reel };
}
function buildRefinePrompt(instruction) {
  return `Jesteś ekspertem od social mediów i SEO dla fotografów ślubnych premium w Polsce. Poniżej są gotowe teksty posta (JSON). Popraw je zgodnie z poleceniem autora: „${instruction}”.

MARKA
${brandBlock()}

${contextBlock()}

${rulesBlock()}

Zmieniaj tylko to, czego dotyczy polecenie; resztę zostaw. Zwróć wyłącznie JSON z tymi samymi kluczami: instagram, facebook, pinterest, google, seo, stories, reel.

${JSON.stringify(pickTexts(S.result))}`;
}

/* ---------- Wywołania ---------- */
function sampleErrorText(e) {
  switch (e?.code) {
    case 'not_granted': return 'Brak zgody na użycie Claude. Odśwież stronę i zezwól, gdy pojawi się pytanie.';
    case 'sampling_disabled': case 'not_declared': case 'capability_disabled': case 'capability_removed':
      return 'Generowanie tekstów nie jest dostępne w tym widoku.';
    case 'images_unavailable': return 'Ten widok nie może wysłać zdjęcia do Claude. Otwórz narzędzie na claude.ai w przeglądarce.';
    case 'rate_limited': return 'Za dużo zapytań naraz albo wyczerpany limit użycia Claude. Spróbuj za kilka minut.';
    case 'session_expired': return 'Sesja wygasła. Zaloguj się ponownie do Claude i odśwież stronę.';
    case 'image_rejected': return 'Zdjęcie nie zostało przyjęte. Zapisz je jako JPG i spróbuj ponownie.';
    case 'refused': return 'Claude nie przygotował tekstów dla tego materiału. Zmień kontekst albo zdjęcie i spróbuj ponownie.';
    case 'invalid_json': case 'empty_completion': return 'Odpowiedź przyszła w złym formacie. Kliknij jeszcze raz.';
    case 'prompt_too_large': return 'Za dużo tekstu w kontekście. Skróć notatkę i spróbuj ponownie.';
    default: return 'Połączenie zostało przerwane. Spróbuj ponownie.';
  }
}
function setBusy(on) {
  S.busy = on;
  $('#genBtn').disabled = on; $('#refineBtn').disabled = on;
  $$('#refineChips .chip').forEach(b => { b.disabled = on; });
  $('#results').classList.toggle('busy', on);
}
async function runSample(prompt, opts, label) {
  const sample = await samplePromise;
  if (!sample) { setStatus('Teksty generuje Claude, więc otwórz to narzędzie w Claude (claude.ai lub aplikacja). Kadrowanie działa także tutaj.', 'err'); return null; }
  S.ctl = new AbortController(); setBusy(true);
  const t0 = Date.now(); let chars = 0;
  const tick = () => {
    const s = Math.round((Date.now() - t0) / 1000);
    setStatus(chars ? `Piszę teksty… ${chars} znaków · ${s} s` : `${label}… ${s} s`, 'busy');
  };
  tick(); const timer = setInterval(tick, 1000);
  try {
    return await sample.json(prompt, { ...opts, signal: S.ctl.signal, cache: false, onText: ({ text }) => { chars = text.length; } });
  } catch (e) {
    if (e?.code === 'cancelled') setStatus('Zatrzymano.');
    else { console.warn('sample', e); setStatus(sampleErrorText(e), 'err'); }
    return null;
  } finally { clearInterval(timer); setBusy(false); S.ctl = null; }
}

async function generate() {
  if (S.busy) return;
  readContext();
  if (!S.photos.length) { setStatus('Najpierw wgraj co najmniej jedno zdjęcie.', 'err'); return; }
  const sample = await samplePromise;
  let maxImg = 0;
  if (sample) { try { const lim = await sample.limits(); maxImg = lim?.images ? Math.max(1, lim.images.maxCount || 1) : 0; } catch { maxImg = 0; } }
  const photos = maxImg ? S.photos.slice(0, maxImg) : S.photos;
  let images;
  try { images = maxImg ? await Promise.all(photos.map(p => toBlob(p.preview, 'image/jpeg', 0.85))) : undefined; }
  catch { setStatus('Nie mogę przygotować zdjęcia do wysłania. Spróbuj innego pliku.', 'err'); return; }
  const n = S.photos.length;
  const raw = await runSample(buildPrompt(maxImg ? photos.length : n, !!maxImg), images ? { images } : {}, 'Oglądam zdjęcie i piszę');
  if (!raw) return;
  const r = normalize(raw, n);
  S.result = r; S.isExample = false; S.history = []; S.savedPostId = null; S.igVariant = 0;
  applyAiToPhotos();
  renderStrip(); renderResults(); renderFormats();
  const partial = maxImg && n > maxImg ? ` Claude obejrzał ${maxImg} pierwszych zdjęć (limit tego widoku).` : '';
  setStatus('Gotowe. Wybierz wariant, skopiuj tekst i pobierz kadry.' + partial, 'ok');
}

async function refine(instruction) {
  instruction = str(instruction);
  if (!instruction || S.busy) return;
  if (S.isExample || !S.result) { toast('Najpierw przygotuj post ze swoim zdjęciem.'); return; }
  const raw = await runSample(buildRefinePrompt(instruction), {}, 'Poprawiam teksty');
  if (!raw) return;
  S.history.push(clone(S.result));
  Object.assign(S.result, normTexts(raw, S.result));
  S.igVariant = Math.min(S.igVariant, S.result.instagram.variants.length - 1);
  renderResults();
  $('#refineInput').value = '';
  setStatus('Poprawione. Poprzednią wersję przywrócisz przyciskiem „Cofnij poprawkę”.', 'ok');
}
