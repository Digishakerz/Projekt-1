
/* ---------- Przykładowy wynik (pierwszy widok) ---------- */
const EXAMPLE = {
  analysis: {
    summary: 'Para idzie przez łąkę pod światło zachodzącego słońca. Najmocniejsze są kontra, ruch welonu i niepozowane gesty.',
    bestUse: 'Okładka karuzeli z sesji, bo ciepłe światło od razu przyciąga uwagę.',
    cover: 1, order: [1],
    tips: ['Po publikacji wrzuć post do stories z ankietą o złotej godzinie.'],
  },
  photos: [{ point: { x: 0.5, y: 0.4 }, box: { x0: 0.3, y0: 0.15, x1: 0.7, y1: 0.95 },
    alt: 'Para młoda idzie przez łąkę pod światło zachodzącego słońca, welon unosi się na wietrze',
    file: 'sesja-plenerowa-zachod-slonca-krakow' }],
  crops: { ig45: 'kadr', ig34: 'kadr', story: 'ramka', sq: 'kadr', note: 'Poziome zdjęcie: w 4:5 kadr zostawia parę w centrum, w stories lepsza ramka z rozmytym tłem.' },
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
  facebook: { text: 'Złota godzina pod Krakowem: dwadzieścia minut światła, które robi całą sesję.\n\nPlener najlepiej zacząć 60–90 minut przed zachodem słońca. Światło jest wtedy miękkie i ciepłe, a zdjęcia wychodzą naturalnie, bez sztywnego pozowania.\n\nWolne terminy na 2027: napiszcie datę i miejsce ślubu.' },
  google: {
    text: 'Sesje plenerowe w złotej godzinie w Krakowie i okolicach. Plener planuję pod godzinę zachodu słońca, żeby światło było miękkie i ciepłe, a zdjęcia naturalne, bez sztywnego pozowania. Wolne terminy na 2027: napisz lub zadzwoń i podaj datę oraz miejsce ślubu.',
    button: 'Więcej informacji',
  },
  seo: {
    h1: 'Sesja plenerowa o zachodzie słońca pod Krakowem',
    metaTitle: 'Sesja plenerowa o zachodzie słońca | Fotograf ślubny Kraków',
    metaDescription: 'Sesja plenerowa w złotej godzinie pod Krakowem: naturalne zdjęcia pary w ciepłym świetle. Zobacz reportaż i sprawdź wolne terminy na 2027.',
    slug: 'sesja-plenerowa-zachod-slonca-krakow',
    keywords: ['sesja plenerowa Kraków', 'fotograf ślubny Kraków', 'sesja w złotej godzinie', 'plener ślubny o zachodzie słońca'],
    intro: 'Złota godzina to najkrótsza i najpiękniejsza część dnia na plener. Ta sesja powstała pod Krakowem, na łące tuż przed zachodem słońca. Zamiast pozowania był spacer i rozmowa, a światło zrobiło resztę. Jeśli planujecie sesję plenerową, zacznijcie 60–90 minut przed zachodem i zostawcie sobie kilkanaście minut po nim.',
  },
  stories: [
    { text: 'Złota godzina czy zachód po weselu?', sticker: 'Ankieta: „Złota godzina” / „Po weselu”' },
    { text: 'Nowa sesja w portfolio. Całość w poście 👇', sticker: 'Udostępniony post' },
  ],
  reel: 'Nagraj 10 sekund POV telefonem na stopce aparatu: idziesz za parą przez łąkę, a na końcu pojawia się to zdjęcie.',
  checklist: ['Oznacz parę (za jej zgodą) i dodaj lokalizację', 'Wklej tekst alternatywny w ustawieniach zaawansowanych', 'Zaproś parę do współpracy (Collab)', 'Po publikacji udostępnij post w stories'],
};

/* ---------- Porządkowanie odpowiedzi ---------- */
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
const strList = (v, max) => arr(v).map(str).filter(Boolean).slice(0, max);
function normTexts(r, prev = {}) {
  const ig = r.instagram || {}; const pig = prev.instagram || {};
  const variants = arr(ig.variants).map((v, i) => ({ name: str(v?.name) || `Wariant ${i + 1}`, text: str(v?.text) })).filter(v => v.text).slice(0, 4);
  const g = r.google || {}; const seo = r.seo || {};
  const stories = arr(r.stories).map(s => ({ text: str(s?.text), sticker: str(s?.sticker) })).filter(s => s.text).slice(0, 4);
  const tags = strList(ig.tag, 6); const kws = strList(seo.keywords, 10);
  return {
    instagram: {
      variants: variants.length ? variants : clone(pig.variants || [{ name: 'Opis', text: '' }]),
      hashtags: ig.hashtags ? cleanTags(ig.hashtags) : clone(pig.hashtags || []),
      location: str(ig.location) || pig.location || '',
      tag: tags.length ? tags : clone(pig.tag || []),
      collab: str(ig.collab) || pig.collab || '',
    },
    facebook: { text: str(r.facebook?.text) || prev.facebook?.text || '' },
    google: { text: str(g.text) || prev.google?.text || '', button: str(g.button) || prev.google?.button || '' },
    seo: {
      h1: str(seo.h1) || prev.seo?.h1 || '', metaTitle: str(seo.metaTitle) || prev.seo?.metaTitle || '',
      metaDescription: str(seo.metaDescription) || prev.seo?.metaDescription || '',
      slug: slugify(seo.slug) || prev.seo?.slug || '',
      keywords: kws.length ? kws : clone(prev.seo?.keywords || []),
      intro: str(seo.intro) || prev.seo?.intro || '',
    },
    stories: stories.length ? stories : clone(prev.stories || []),
    reel: str(r.reel) || prev.reel || '',
  };
}
const CROP_IDS = FORMATS.map(f => f.id);
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
      tips: strList(a.tips, 3),
    },
    photos, crops, ...normTexts(r),
    checklist: strList(r.checklist, 6),
  };
}
// Odczyt JSON z odpowiedzi: cała odpowiedź, blok ```json albo tekst od pierwszej { do ostatniej }.
function parseJsonLoose(text) {
  const t = String(text || '').trim();
  const tries = [t, (t.match(/```(?:json)?\s*([\s\S]*?)```/) || [])[1], t.slice(t.indexOf('{'), t.lastIndexOf('}') + 1)];
  for (const c of tries) { if (!c) continue; try { const v = JSON.parse(c); if (v && typeof v === 'object') return v; } catch { /* następna próba */ } }
  throw { code: 'invalid_json' };
}

/* ---------- Polecenie dla AI ---------- */
const VOICE = {
  'ja-m': 'pierwsza osoba liczby pojedynczej, rodzaj męski (np. „fotografowałem”, „byłem”)',
  'ja-f': 'pierwsza osoba liczby pojedynczej, rodzaj żeński (np. „fotografowałam”, „byłam”)',
  my: 'pierwsza osoba liczby mnogiej, jako zespół (np. „fotografowaliśmy”)',
};
const EMOJI = { none: 'bez emoji', few: 'najwyżej 1–2 emoji w tekście i tylko gdy pasują', some: 'emoji dozwolone, z umiarem' };
function brandBlock() {
  const s = S.settings; const tags = brandHashtags();
  return [
    `- Marka: ${s.brand || 'nie podano'}; miasto lub region: ${s.city || 'nie podano'}`,
    `- Strona: ${s.website || 'nie podano'}; Instagram: ${s.instagram || 'nie podano'}`,
    `- Czym się zajmuje: ${s.services || 'fotografia ślubna'}`,
    `- Forma wypowiedzi: ${VOICE[s.voice] || VOICE.my}`,
    `- Ton: ${s.tone || 'ciepły i konkretny'}; emoji: ${EMOJI[s.emoji] || EMOJI.few}`,
    `- Stałe zaproszenie do kontaktu: ${s.cta || 'brak'}`,
    `- Frazy, po których marka chce być znajdowana: ${s.keywords || 'brak'}`,
    `- Hashtag marki (wlicza się do limitu 5): ${tags.join(' ') || 'brak'}`,
  ].join('\n');
}
function rulesBlock() {
  return `ZASADY
- Pisz po polsku, naturalnie, jak doświadczony fotograf. Unikaj sztampy: „magiczny dzień”, „wyjątkowe chwile”, „zatrzymać czas”, „bajkowy”.
- Nie wymyślaj faktów: imion, nazw miejsc, dat, pogody ani historii, których nie ma w kontekście i nie widać na zdjęciu. Tekst ma być prawdziwy bez nich.
- Instagram: 3 wyraźnie różne warianty (1. historia i emocje, 2. krótki i elegancki, 3. wartość dla par: porada lub kulisy). Pierwsze zdanie to haczyk do 125 znaków, bo tyle widać przed „więcej”. Każdy wariant do 1200 znaków, akapity oddzielone pustą linią, na końcu wezwanie do działania dopasowane do celu.
- Hashtagi na Instagram: najwyżej 5 łącznie (limit Instagrama), w tym hashtag marki. Mieszanka lokalnych i tematycznych, bez ogólników w rodzaju #love.
- Tekst alternatywny: rzeczowy opis tego, co widać, do 125 znaków, bez „zdjęcie przedstawia”.
- Profil Firmy w Google: 300–700 znaków, lokalnie (miasto, region), z wezwaniem do działania.
- SEO strony: meta title do 60 znaków, meta description do 155 znaków; slug i nazwy plików małymi literami, bez polskich znaków, słowa łączone myślnikami.`;
}
function contextBlock() {
  const c = S.ctx; const goal = GOALS.find(g => g.id === c.goal) || GOALS[0];
  return `KONTEKST POSTA
- Co jest na zdjęciu: ${c.type}
- Cel: ${goal.prompt}
- Miejsce: ${c.place || 'nie podano'}
- Notatki autora (mogą zawierać konta do oznaczenia): ${c.notes || 'brak'}`;
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
- Kadrowanie: dla każdego zdjęcia podaj punkt kluczowy (najważniejsze miejsce kadru, np. twarze pary) i prostokąt obejmujący główny motyw, we współrzędnych 0–1 (x od lewej, y od góry). Dla każdego formatu oceń, czy lepiej przyciąć („kadr”), czy wpasować całe zdjęcie z tłem („ramka”). Formaty: ig45 = 4:5, ig34 = 3:4, story = 9:16, sq = 1:1.
- Jeśli zdjęć jest kilka, wskaż najlepszą okładkę karuzeli i proponowaną kolejność.

ODPOWIEDŹ
Zwróć wyłącznie JSON w tym kształcie:
{"analysis":{"summary":"1–2 zdania: co jest na zdjęciach i co w nich najmocniejsze","bestUse":"gdzie to zadziała najlepiej i dlaczego, 1 zdanie","cover":1,"order":[1],"tips":["do 2 krótkich wskazówek publikacji"]},
"photos":[{"n":1,"point":{"x":0.5,"y":0.4},"box":{"x0":0.2,"y0":0.1,"x1":0.8,"y1":0.95},"alt":"…","file":"nazwa-pliku-bez-rozszerzenia"}],
"crops":{"ig45":"kadr","ig34":"kadr","story":"ramka","sq":"kadr","note":"1 zdanie o kadrowaniu"},
"instagram":{"variants":[{"name":"Historia","text":"…"},{"name":"Krótko","text":"…"},{"name":"Dla par","text":"…"}],"hashtags":["#…"],"location":"sugerowana lokalizacja","tag":["kogo oznaczyć"],"collab":"komu zaproponować post we współpracy i dlaczego"},
"facebook":{"text":"…"},
"google":{"text":"…","button":"np. Więcej informacji"},
"seo":{"h1":"…","metaTitle":"…","metaDescription":"…","slug":"…","keywords":["4–6 fraz"],"intro":"wstęp do wpisu na blogu, 60–100 słów"},
"stories":[{"text":"tekst na planszę","sticker":"naklejka, np. ankieta z odpowiedziami"}],
"reel":"pomysł na rolkę z tym materiałem, 1–2 zdania",
"checklist":["3–5 punktów do odhaczenia przed publikacją"]}
Tablica "photos" ma mieć dokładnie ${n} ${n === 1 ? 'element' : 'elementów'}.`;
}
function pickTexts(r) {
  const { instagram, facebook, google, seo, stories, reel } = r;
  return { instagram, facebook, google, seo, stories, reel };
}
function buildRefinePrompt(instruction) {
  return `Jesteś ekspertem od social mediów i SEO dla fotografów ślubnych premium w Polsce. Poniżej są gotowe teksty posta (JSON). Popraw je zgodnie z poleceniem autora: „${instruction}”.

MARKA
${brandBlock()}

${contextBlock()}

${rulesBlock()}

Zmieniaj tylko to, czego dotyczy polecenie; resztę zostaw. Zwróć wyłącznie JSON z tymi samymi kluczami: instagram, facebook, google, seo, stories, reel.

${JSON.stringify(pickTexts(S.result))}`;
}
