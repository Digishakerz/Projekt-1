
/* ---------- Silniki AI ---------- */
// Artefakt: Claude na koncie użytkownika Claude. Aplikacja: Gemini lub Claude przez klucz API, z automatycznym zastępstwem.
const PROVIDER_NAME = { gemini: 'Gemini', claude: 'Claude', 'claude-app': 'Claude' };

async function claudeAppJson(prompt, images, signal, onChars) {
  const sample = await samplePromise;
  if (!sample) throw { code: 'unavailable', provider: 'claude-app' };
  try {
    return await sample.json(prompt, { ...(images ? { images } : {}), signal, cache: false, onText: ({ text }) => onChars?.(text.length) });
  } catch (e) { throw { code: e?.code || 'upstream_error', provider: 'claude-app' }; }
}

// Gemini: najnowszy Flash, a przy wyczerpanym limicie Flash-Lite (ma większy darmowy limit).
const GEMINI_MODELS = ['gemini-flash-latest', 'gemini-flash-lite-latest'];
async function geminiCall(model, body, signal) {
  let res;
  try {
    res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: 'POST', signal,
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': S.keys.gemini },
      body: JSON.stringify(body),
    });
  } catch (e) { throw e?.name === 'AbortError' ? { code: 'cancelled' } : { code: 'network', provider: 'gemini' }; }
  if (res.ok) return res.json();
  const detail = await res.text().catch(() => '');
  const code = res.status === 429 ? 'rate_limited'
    : (res.status === 400 && /API[_ ]?key/i.test(detail)) || res.status === 401 || res.status === 403 ? 'bad_key'
    : res.status === 404 ? 'no_model'
    : res.status >= 500 ? 'overloaded' : 'bad_request';
  throw { code, provider: 'gemini', status: res.status, detail: detail.slice(0, 400) };
}
function geminiText(data) {
  const cand = data?.candidates?.[0];
  const text = arr(cand?.content?.parts).filter(p => p.text && !p.thought).map(p => p.text).join('');
  if (!text) throw { code: data?.promptFeedback?.blockReason || cand?.finishReason === 'SAFETY' ? 'refused' : 'empty', provider: 'gemini' };
  return text;
}
async function geminiJson(prompt, images, signal) {
  const parts = [];
  for (const b of images || []) parts.push({ inline_data: { mime_type: 'image/jpeg', data: await blobToB64(b) } });
  parts.push({ text: prompt });
  const body = { contents: [{ role: 'user', parts }], generationConfig: { responseMimeType: 'application/json' } };
  let last;
  for (const m of GEMINI_MODELS) {
    try { return parseJsonLoose(geminiText(await geminiCall(m, body, signal))); }
    catch (e) { last = e; if (!['rate_limited', 'overloaded', 'no_model'].includes(e?.code)) throw e; }
  }
  throw last;
}

// Claude przez API: oficjalna biblioteka @anthropic-ai/sdk. Wersja lokalna ma ją wbudowaną (window.AnthropicSDK),
// aplikacja online wczytuje ją z vendor/ dopiero wtedy, gdy jest potrzebna.
const CLAUDE_MODELS = { opus: 'claude-opus-5', sonnet: 'claude-sonnet-5' };
let sdkPromise = null;
function loadSdk() {
  if (window.AnthropicSDK?.default) return Promise.resolve(window.AnthropicSDK.default);
  sdkPromise ||= import('./vendor/anthropic-sdk.mjs').then(m => m.default)
    .catch(e => { sdkPromise = null; throw { code: 'network', provider: 'claude', detail: String(e) }; });
  return sdkPromise;
}
function claudeError(Anthropic, e) {
  if (e instanceof Anthropic.APIUserAbortError) return { code: 'cancelled' };
  if (e instanceof Anthropic.AuthenticationError || e instanceof Anthropic.PermissionDeniedError) return { code: 'bad_key', provider: 'claude' };
  if (e instanceof Anthropic.RateLimitError) return { code: 'rate_limited', provider: 'claude' };
  if (e instanceof Anthropic.InternalServerError) return { code: 'overloaded', provider: 'claude' };
  if (e instanceof Anthropic.APIConnectionError) return { code: 'network', provider: 'claude' };
  if (e instanceof Anthropic.BadRequestError) return { code: /credit balance/i.test(e.message) ? 'no_credit' : 'bad_request', provider: 'claude', detail: e.message };
  return { code: 'bad_request', provider: 'claude', detail: String(e?.message || e) };
}
async function claudeRequest(content, signal, maxTokens = 16000) {
  const Anthropic = await loadSdk();
  const client = new Anthropic({ apiKey: S.keys.claude, dangerouslyAllowBrowser: true, maxRetries: 1 });
  const model = CLAUDE_MODELS[S.settings.claudeModel] || CLAUDE_MODELS.opus;
  const params = { model, max_tokens: maxTokens, output_config: { effort: 'medium' }, messages: [{ role: 'user', content }] };
  let msg;
  try {
    // Opus 5: gdy filtr bezpieczeństwa odrzuci zapytanie, serwer sam spróbuje innego modelu.
    msg = model === CLAUDE_MODELS.opus
      ? await client.beta.messages.create({ ...params, betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' }, { signal })
      : await client.messages.create(params, { signal });
  } catch (e) { throw claudeError(Anthropic, e); }
  if (msg.stop_reason === 'refusal') throw { code: 'refused', provider: 'claude' };
  return msg.content.filter(b => b.type === 'text').map(b => b.text).join('');
}
async function claudeApiJson(prompt, images, signal) {
  const content = [];
  for (const b of images || []) content.push({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: await blobToB64(b) } });
  content.push({ type: 'text', text: prompt });
  const text = await claudeRequest(content, signal);
  if (!text) throw { code: 'empty', provider: 'claude' };
  return parseJsonLoose(text);
}

const PROVIDERS = { 'claude-app': claudeAppJson, gemini: geminiJson, claude: claudeApiJson };
function providerOrder() {
  if (!IS_APP) return ['claude-app'];
  const has = { gemini: !!S.keys.gemini, claude: !!S.keys.claude };
  const main = S.settings.aiMain === 'claude' ? 'claude' : 'gemini';
  const other = main === 'gemini' ? 'claude' : 'gemini';
  const order = [];
  if (has[main]) order.push(main);
  if (has[other] && (!has[main] || S.settings.aiFallback !== false)) order.push(other);
  return order;
}

function aiErrorText(e) {
  const who = PROVIDER_NAME[e?.provider] || 'AI';
  switch (e?.code) {
    case 'no_provider': return 'Dodaj klucz Gemini albo Claude w Ustawieniach (sekcja Silnik AI).';
    case 'bad_key': return `${who}: klucz nie działa. Sprawdź go w Ustawieniach.`;
    case 'no_credit': return 'Claude: brak środków na koncie API. Doładuj konto albo użyj Gemini.';
    case 'rate_limited': return `${who}: wyczerpany limit zapytań. Spróbuj później.`;
    case 'overloaded': return `${who} jest teraz przeciążony. Spróbuj za chwilę.`;
    case 'network': case 'upstream_error': return `${who}: brak połączenia. Sprawdź internet i spróbuj ponownie.`;
    case 'refused': return `${who} nie przygotował tekstów dla tego materiału. Zmień opis albo zdjęcie.`;
    case 'invalid_json': case 'empty': case 'empty_completion': return `${who} odpowiedział w złym formacie. Kliknij jeszcze raz.`;
    case 'no_model': case 'bad_request': case 'invalid_request': return `${who} odrzucił zapytanie. Spróbuj ponownie albo użyj drugiego silnika.`;
    case 'unavailable': return 'Teksty pisze Claude, więc otwórz to narzędzie w Claude albo w wersji aplikacji.';
    case 'not_granted': return 'Brak zgody na użycie Claude. Odśwież stronę i zezwól, gdy pojawi się pytanie.';
    case 'sampling_disabled': case 'not_declared': case 'capability_disabled': case 'capability_removed': return 'Pisanie tekstów nie jest dostępne w tym widoku.';
    case 'images_unavailable': return 'Ten widok nie może wysłać zdjęcia. Otwórz narzędzie na claude.ai w przeglądarce.';
    case 'session_expired': return 'Sesja wygasła. Zaloguj się ponownie do Claude i odśwież stronę.';
    case 'image_rejected': return 'Zdjęcie nie zostało przyjęte. Zapisz je jako JPG i spróbuj ponownie.';
    case 'prompt_too_large': return 'Za dużo tekstu w notatce. Skróć ją i spróbuj ponownie.';
    default: return `${who}: coś poszło nie tak. Spróbuj ponownie.`;
  }
}

function setBusy(on) {
  S.busy = on;
  $('#genBtn').disabled = on; $('#refineBtn').disabled = on;
  $$('#refineChips .chip').forEach(b => { b.disabled = on; });
  $('#results').classList.toggle('busy', on);
}
async function runAi(prompt, images, label) {
  const order = providerOrder();
  if (!order.length) { setStatus(aiErrorText({ code: 'no_provider' }), 'err'); return null; }
  S.ctl = new AbortController(); setBusy(true);
  const t0 = Date.now(); let who = order[0]; let chars = 0; let prefix = '';
  const tick = () => {
    const s = Math.round((Date.now() - t0) / 1000);
    setStatus(`${prefix}${PROVIDER_NAME[who]}: ${chars ? `piszę… ${chars} znaków` : label + '…'} ${s} s`, 'busy');
  };
  const timer = setInterval(tick, 1000);
  try {
    for (let i = 0; i < order.length; i++) {
      who = order[i]; chars = 0; tick();
      try { const data = await PROVIDERS[who](prompt, images, S.ctl.signal, n => { chars = n; }); return { data, provider: who }; }
      catch (e) {
        if (e?.code === 'cancelled' || S.ctl?.signal.aborted) { setStatus('Zatrzymano.'); return null; }
        console.warn(who, e);
        const err = { ...e, provider: e?.provider || who };
        if (i === order.length - 1) { setStatus(aiErrorText(err), 'err'); return null; }
        prefix = `${aiErrorText(err)} Próbuję: `;
      }
    }
    return null;
  } finally { clearInterval(timer); setBusy(false); S.ctl = null; }
}

async function generate() {
  if (S.busy) return;
  readContext();
  if (!S.photos.length) { setStatus('Najpierw wgraj co najmniej jedno zdjęcie.', 'err'); return; }
  const order = providerOrder();
  if (!order.length) { setStatus(aiErrorText({ code: 'no_provider' }), 'err'); return; }
  let maxImg = MAX_PHOTOS;
  if (order[0] === 'claude-app') {
    const sample = await samplePromise;
    if (!sample) { setStatus(aiErrorText({ code: 'unavailable' }), 'err'); return; }
    try { const lim = await sample.limits(); maxImg = lim?.images ? Math.max(1, lim.images.maxCount || 1) : 0; } catch { maxImg = 0; }
  }
  const photos = maxImg ? S.photos.slice(0, maxImg) : [];
  let images;
  try { images = photos.length ? await Promise.all(photos.map(aiImage)) : undefined; }
  catch { setStatus('Nie mogę przygotować zdjęcia do wysłania. Spróbuj innego pliku.', 'err'); return; }
  const n = S.photos.length;
  const out = await runAi(buildPrompt(photos.length || n, !!photos.length), images, 'oglądam zdjęcie i piszę');
  if (!out) return;
  S.result = normalize(out.data, n); S.result.meta = { provider: out.provider };
  S.isExample = false; S.history = []; S.savedPostId = null; S.igVariant = 0;
  applyAiToPhotos();
  renderStrip(); renderResults(); renderFormats();
  const partial = photos.length && n > photos.length ? ` AI obejrzało ${photos.length} pierwszych zdjęć.` : '';
  setStatus(`Gotowe. Wybierz wariant, skopiuj tekst i pobierz kadry.${partial}`, 'ok');
}
async function refine(instruction) {
  instruction = str(instruction);
  if (!instruction || S.busy) return;
  if (S.isExample || !S.result) { toast('Najpierw przygotuj post ze swoim zdjęciem.'); return; }
  const out = await runAi(buildRefinePrompt(instruction), undefined, 'poprawiam teksty');
  if (!out) return;
  S.history.push(clone(S.result));
  Object.assign(S.result, normTexts(out.data, S.result));
  S.result.meta = { provider: out.provider };
  S.igVariant = Math.min(S.igVariant, S.result.instagram.variants.length - 1);
  renderResults();
  $('#refineInput').value = '';
  setStatus('Poprawione. Poprzednią wersję przywrócisz przyciskiem „Cofnij poprawkę”.', 'ok');
}

// Przycisk „Sprawdź” przy kluczu: krótkie zapytanie testowe.
async function testKey(which) {
  const out = $('#t-' + which); out.style.color = ''; out.textContent = 'Sprawdzam…';
  readKeysFromForm();
  try {
    if (!S.keys[which]) throw { code: 'no_key' };
    if (which === 'gemini') geminiText(await geminiCall(GEMINI_MODELS[0], { contents: [{ role: 'user', parts: [{ text: 'Odpowiedz jednym słowem: OK' }] }] }));
    else await claudeRequest([{ type: 'text', text: 'Odpowiedz jednym słowem: OK' }], undefined, 512);
    out.textContent = 'Działa.'; out.style.color = 'var(--ok)';
    saveKeys();
  } catch (e) {
    out.textContent = e?.code === 'no_key' ? 'Najpierw wklej klucz.' : aiErrorText({ ...e, provider: e?.provider || which });
    out.style.color = 'var(--accent)';
  }
}
