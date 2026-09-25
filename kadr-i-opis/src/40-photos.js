
/* ---------- Rysowanie ---------- */
const srcDims = s => [s.naturalWidth || s.width, s.naturalHeight || s.height];

// Skaluje w kilku krokach, żeby zmniejszone zdjęcie nie było poszarpane.
function drawHQ(ctx, src, sx, sy, sw, sh, dx, dy, dw, dh) {
  const [W, H] = srcDims(src);
  sx = clamp(sx, 0, W - 1); sy = clamp(sy, 0, H - 1);
  sw = Math.min(sw, W - sx); sh = Math.min(sh, H - sy);
  let s = src, x = sx, y = sy, w = sw, h = sh;
  while (w > dw * 2.2 && h > dh * 2.2) {
    const nw = Math.round(w / 2), nh = Math.round(h / 2);
    const c = document.createElement('canvas'); c.width = nw; c.height = nh;
    const cx = c.getContext('2d'); cx.imageSmoothingEnabled = true; cx.imageSmoothingQuality = 'high';
    cx.drawImage(s, x, y, w, h, 0, 0, nw, nh);
    s = c; x = 0; y = 0; w = nw; h = nh;
  }
  ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(s, x, y, w, h, dx, dy, dw, dh);
}

function drawBlurBg(ctx, src, outW, outH) {
  const [W, H] = srcDims(src);
  const sc = Math.max(outW / W, outH / H);
  const cw = outW / sc, ch = outH / sc;
  const t = document.createElement('canvas');
  t.width = Math.max(4, Math.round(outW / 24)); t.height = Math.max(4, Math.round(outH / 24));
  drawHQ(t.getContext('2d'), src, (W - cw) / 2, (H - ch) / 2, cw, ch, 0, 0, t.width, t.height);
  const m = document.createElement('canvas'); m.width = t.width * 4; m.height = t.height * 4;
  const mc = m.getContext('2d'); mc.imageSmoothingEnabled = true; mc.imageSmoothingQuality = 'high';
  mc.drawImage(t, 0, 0, m.width, m.height);
  ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(m, 0, 0, outW, outH);
  ctx.fillStyle = 'rgba(0,0,0,.2)'; ctx.fillRect(0, 0, outW, outH);
}

/* ---------- Kadrowanie ---------- */
function baseSize(p, fmt) { const A = fmt.w / fmt.h; return p.w / p.h > A ? [p.h * A, p.h] : [p.w, p.w / A]; }
function cropRect(p, fmt, st) {
  const [bw, bh] = baseSize(p, fmt); const w = bw / st.z, h = bh / st.z;
  return { x: clamp(st.cx * p.w - w / 2, 0, p.w - w), y: clamp(st.cy * p.h - h / 2, 0, p.h - h), w, h };
}
function normalizeCenter(p, fmt, st) { const r = cropRect(p, fmt, st); st.cx = (r.x + r.w / 2) / p.w; st.cy = (r.y + r.h / 2) / p.h; }
function keepShare(p, fmt) { const [bw, bh] = baseSize(p, fmt); return (bw * bh) / (p.w * p.h); }

// Kadr ustawiony na punkt kluczowy; jeśli motyw się mieści, cały zostaje w kadrze.
function autoCrop(p, fmt) {
  const [w, h] = baseSize(p, fmt);
  const pt = p.ai?.point || { x: 0.5, y: 0.42 }; const b = p.ai?.box;
  const axis = (size, full, f, b0, b1) => {
    let start = f * full - size / 2;
    if (b && (b1 - b0) * full <= size) start = clamp(start, b1 * full - size, b0 * full);
    return clamp(start, 0, full - size);
  };
  const x = axis(w, p.w, pt.x, b?.x0, b?.x1), y = axis(h, p.h, pt.y, b?.y0, b?.y1);
  let mode = keepShare(p, fmt) < 0.5 ? 'frame' : 'crop';
  const advice = S.photos.length <= 1 && !S.isExample ? S.result?.crops?.[fmt.id] : null;
  if (advice === 'kadr') mode = 'crop'; else if (advice === 'ramka') mode = 'frame';
  return { cx: (x + w / 2) / p.w, cy: (y + h / 2) / p.h, z: 1, mode, touched: false };
}

function drawFormat(ctx, outW, outH, p, fmt, st, src) {
  const [SW, SH] = srcDims(src); const k = SW / p.w;
  if (st.mode === 'frame') {
    if (S.frameBg === 'blur') drawBlurBg(ctx, p.preview, outW, outH);
    else { ctx.fillStyle = S.frameBg === 'black' ? '#0B0B0C' : '#FFFFFF'; ctx.fillRect(0, 0, outW, outH); }
    const m = S.frameBg === 'blur' ? 0 : Math.round(Math.min(outW, outH) * 0.045);
    const sc = Math.min((outW - 2 * m) / SW, (outH - 2 * m) / SH);
    const dw = SW * sc, dh = SH * sc;
    drawHQ(ctx, src, 0, 0, SW, SH, (outW - dw) / 2, (outH - dh) / 2, dw, dh);
  } else {
    const r = cropRect(p, fmt, st);
    drawHQ(ctx, src, r.x * k, r.y * k, r.w * k, r.h * k, 0, 0, outW, outH);
  }
}

/* ---------- Zdjęcia ---------- */
function makeThumb(src, size) {
  const [W, H] = srcDims(src); const s = Math.min(W, H);
  const c = document.createElement('canvas'); c.width = size; c.height = size;
  drawHQ(c.getContext('2d'), src, (W - s) / 2, (H - s) / 2, s, s, 0, 0, size, size);
  return c.toDataURL('image/jpeg', 0.72);
}
async function decodeUrl(url) {
  const img = new Image(); img.decoding = 'async'; img.src = url; await img.decode(); return img;
}
async function loadPhoto(file) {
  const url = URL.createObjectURL(file);
  let img;
  try { img = await decodeUrl(url); } catch (e) { URL.revokeObjectURL(url); throw e; }
  const w = img.naturalWidth, h = img.naturalHeight;
  if (!w || !h) { URL.revokeObjectURL(url); throw new Error('empty'); }
  const k = Math.min(1, 1600 / Math.max(w, h));
  const preview = document.createElement('canvas');
  preview.width = Math.max(1, Math.round(w * k)); preview.height = Math.max(1, Math.round(h * k));
  drawHQ(preview.getContext('2d'), img, 0, 0, w, h, 0, 0, preview.width, preview.height);
  // Pełna rozdzielczość jest dekodowana ponownie dopiero przy eksporcie, żeby oszczędzać pamięć telefonu.
  return { id: uid(), name: file.name, url, w, h, preview, thumb: makeThumb(preview, 240), ai: null, crops: {} };
}
const aiOf = a => (a ? { point: a.point, box: a.box } : null);

async function addFiles(fileList) {
  const files = [...fileList].filter(f => /^image\//.test(f.type) || /\.(jpe?g|png|webp|heic|heif)$/i.test(f.name));
  if (!files.length) { toast('To nie wygląda na zdjęcie. Wybierz plik JPG, PNG lub WebP.'); return; }
  const room = MAX_PHOTOS - S.photos.length;
  if (room <= 0) { toast(`Maksymalnie ${MAX_PHOTOS} zdjęć w jednym poście.`); return; }
  if (files.length > room) toast(`Dodaję ${room} z ${files.length}. Limit to ${MAX_PHOTOS} zdjęć.`);
  const wasEmpty = !S.photos.length;
  $('#photoCount').textContent = 'wczytuję…';
  for (const f of files.slice(0, room)) {
    try {
      const p = await loadPhoto(f);
      if (!S.isExample) p.ai = aiOf(S.result?.photos?.[S.photos.length]);
      S.photos.push(p);
      for (const fmt of FORMATS) p.crops[fmt.id] = autoCrop(p, fmt);
    } catch { toast(`Nie mogę otworzyć „${f.name}”. Zapisz je jako JPG i spróbuj ponownie.`); }
  }
  if (wasEmpty) S.active = 0;
  renderStrip(); renderFormats();
}
function removePhoto(i) {
  const [p] = S.photos.splice(i, 1);
  if (p) URL.revokeObjectURL(p.url);
  if (!S.isExample && S.result) {
    if (S.result.photos.length > i) S.result.photos.splice(i, 1);
    S.result.analysis.order = [];
  }
  S.active = clamp(S.active > i ? S.active - 1 : S.active, 0, Math.max(0, S.photos.length - 1));
  renderStrip(); renderFormats(); renderResults();
}
function clearAll() {
  S.photos.forEach(p => URL.revokeObjectURL(p.url));
  S.photos = []; S.active = 0;
  S.result = clone(EXAMPLE); S.isExample = true; S.history = []; S.savedPostId = null; S.igVariant = 0;
  setStatus('');
  renderStrip(); renderFormats(); renderResults();
}
function applyAiToPhotos() {
  const rp = S.result?.photos || [];
  S.photos.forEach((p, i) => {
    if (!rp[i]) return;
    p.ai = aiOf(rp[i]);
    for (const f of FORMATS) if (!p.crops[f.id]?.touched) p.crops[f.id] = autoCrop(p, f);
  });
}
function applyOrder() {
  const order = S.result?.analysis?.order || []; const n = S.photos.length;
  if (order.length !== n || new Set(order).size !== n || order.some(k => k < 1 || k > n)) { toast('Nie mogę zastosować tej kolejności.'); return; }
  S.photos = order.map(k => S.photos[k - 1]);
  if (S.result.photos.length === n) S.result.photos = order.map(k => S.result.photos[k - 1]);
  const cov = S.result.analysis.cover;
  S.result.analysis.cover = cov ? order.indexOf(cov) + 1 : 1;
  S.result.analysis.order = order.map((_, i) => i + 1);
  S.active = 0; renderStrip(); renderFormats(); renderResults();
  toast('Ustawiono kolejność karuzeli.');
}

function renderStrip() {
  const strip = $('#strip'); strip.replaceChildren();
  strip.hidden = !S.photos.length;
  $('#photoCount').textContent = `${S.photos.length} / ${MAX_PHOTOS}`;
  $('#clearBtn').hidden = !S.photos.length && S.isExample;
  const cover = S.isExample ? null : S.result?.analysis?.cover;
  S.photos.forEach((p, i) => {
    strip.append(el('div', { class: 'thumb' + (i === S.active ? ' active' : '') },
      el('button', { type: 'button', class: 'sel', 'aria-label': `Zdjęcie ${i + 1}: pokaż kadry`, 'aria-pressed': String(i === S.active),
        onclick: () => { S.active = i; renderStrip(); renderFormats(); } }, el('img', { src: p.thumb, alt: '' })),
      el('span', { class: 'n', text: String(i + 1) }),
      S.photos.length > 1 && cover === i + 1 ? el('span', { class: 'cov', text: 'okładka' }) : null,
      el('button', { type: 'button', class: 'rm', 'aria-label': `Usuń zdjęcie ${i + 1}`, onclick: () => removePhoto(i) }, '×')));
  });
}

/* ---------- Karty formatów ---------- */
function renderFormats() {
  const wrap = $('#formats'); wrap.replaceChildren(); S.cards = {};
  const p = S.photos[S.active];
  $('#cropHint').textContent = !p ? 'Wgraj zdjęcie, a kadry przygotują się same.'
    : (S.photos.length > 1 ? `Zdjęcie ${S.active + 1} z ${S.photos.length}. ` : '') + 'Przeciągnij podgląd, żeby przesunąć kadr.';
  for (const f of FORMATS) {
    const card = {};
    const box = el('div', { class: 'box', style: `--ar:${f.w} / ${f.h}` });
    let controls = null;
    if (p) {
      const st = p.crops[f.id];
      card.canvas = el('canvas', { tabindex: '0', 'aria-label': `Kadr ${f.ratio}. Strzałki przesuwają kadr, plus i minus zmieniają powiększenie.` });
      card.canvas.width = 480; card.canvas.height = Math.round((480 * f.h) / f.w);
      box.append(card.canvas);
      card.seg = el('div', { class: 'seg', role: 'group', 'aria-label': 'Dopasowanie' },
        el('button', { type: 'button', 'data-mode': 'crop', 'aria-pressed': String(st.mode === 'crop'), onclick: () => setMode(f.id, 'crop') }, 'Kadr'),
        el('button', { type: 'button', 'data-mode': 'frame', 'aria-pressed': String(st.mode === 'frame'), onclick: () => setMode(f.id, 'frame') }, 'Ramka'));
      card.move = el('button', { type: 'button', class: 'btn sm ghost', onclick: () => toggleEdit(f.id) }, 'Przesuń');
      card.dl = el('button', { type: 'button', class: 'btn sm', onclick: () => downloadOne(f.id) }, 'Pobierz JPG');
      card.zoomIn = el('input', { type: 'range', min: '100', max: '250', step: '5', value: String(Math.round(st.z * 100)),
        'aria-label': 'Powiększenie kadru', oninput: e => setZoom(f.id, +e.target.value) });
      card.zoom = el('label', { class: 'zoom' }, 'Zoom', card.zoomIn);
      controls = [el('div', { class: 'fmt-ctl' }, card.seg, card.move, card.dl), card.zoom];
    } else {
      box.append(el('span', { class: 'empty', text: `${f.w} × ${f.h} px` }));
    }
    card.root = el('div', { class: 'fmt' },
      el('div', { class: 'fmt-h' }, el('strong', { text: f.name }), el('span', { class: 'mono', text: `${f.ratio} · ${f.w}×${f.h}` })),
      el('div', { class: 'frame' }, box),
      el('p', { class: 'fmt-note', text: f.note }),
      controls);
    S.cards[f.id] = card; wrap.append(card.root);
    if (p) { attachPan(card, f.id); renderPreview(f.id); }
  }
}
function renderPreview(id) {
  const card = S.cards[id], p = S.photos[S.active];
  if (!card?.canvas || !p) return;
  const st = p.crops[id]; const c = card.canvas; const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, c.width, c.height);
  drawFormat(ctx, c.width, c.height, p, FMT[id], st, p.preview);
  $$('button', card.seg).forEach(b => b.setAttribute('aria-pressed', String(b.dataset.mode === st.mode)));
  const crop = st.mode === 'crop';
  card.zoom.hidden = !crop; card.move.hidden = !crop;
  if (!crop) card.root.classList.remove('editing');
  card.move.textContent = card.root.classList.contains('editing') ? 'Gotowe' : 'Przesuń';
  card.zoomIn.value = String(Math.round(st.z * 100));
}
const pendingIds = new Set(); let rafId = 0;
function schedule(id) {
  pendingIds.add(id);
  if (!rafId) rafId = requestAnimationFrame(() => { rafId = 0; const ids = [...pendingIds]; pendingIds.clear(); ids.forEach(renderPreview); });
}
function renderAllPreviews() { FORMATS.forEach(f => renderPreview(f.id)); }
function setMode(id, mode) { const st = S.photos[S.active]?.crops[id]; if (!st) return; st.mode = mode; st.touched = true; renderPreview(id); }
function setZoom(id, v) {
  const p = S.photos[S.active]; const st = p?.crops[id]; if (!st) return;
  st.z = clamp(v / 100, 1, 2.5); normalizeCenter(p, FMT[id], st); st.touched = true; schedule(id);
}
function toggleEdit(id) {
  const card = S.cards[id]; card.root.classList.toggle('editing'); renderPreview(id);
  if (card.root.classList.contains('editing')) card.canvas.focus();
}
function attachPan(card, id) {
  const c = card.canvas; let drag = null;
  c.addEventListener('pointerdown', e => {
    const st = S.photos[S.active]?.crops[id];
    if (!st || st.mode !== 'crop') return;
    if (e.pointerType === 'touch' && !card.root.classList.contains('editing')) return;
    drag = { x: e.clientX, y: e.clientY, cx: st.cx, cy: st.cy, pid: e.pointerId };
    try { c.setPointerCapture(e.pointerId); } catch { /* bez przechwycenia też działa */ }
    c.style.cursor = 'grabbing'; e.preventDefault();
  });
  c.addEventListener('pointermove', e => {
    if (!drag || e.pointerId !== drag.pid) return;
    const p = S.photos[S.active]; const st = p.crops[id]; const f = FMT[id];
    const r = cropRect(p, f, st); const b = c.getBoundingClientRect();
    st.cx = drag.cx - ((e.clientX - drag.x) * (r.w / b.width)) / p.w;
    st.cy = drag.cy - ((e.clientY - drag.y) * (r.h / b.height)) / p.h;
    normalizeCenter(p, f, st); st.touched = true; schedule(id);
  });
  const end = e => { if (drag && e.pointerId === drag.pid) { drag = null; c.style.cursor = ''; } };
  c.addEventListener('pointerup', end); c.addEventListener('pointercancel', end);
  c.addEventListener('keydown', e => {
    const p = S.photos[S.active]; const st = p?.crops[id];
    if (!st || st.mode !== 'crop') return;
    const f = FMT[id]; const r = cropRect(p, f, st);
    const moves = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
    if (moves[e.key]) { const [dx, dy] = moves[e.key]; st.cx += (dx * 0.04 * r.w) / p.w; st.cy += (dy * 0.04 * r.h) / p.h; }
    else if (e.key === '+' || e.key === '=') st.z = clamp(st.z + 0.1, 1, 2.5);
    else if (e.key === '-') st.z = clamp(st.z - 0.1, 1, 2.5);
    else return;
    e.preventDefault(); normalizeCenter(p, f, st); st.touched = true; renderPreview(id);
  });
}

/* ---------- Eksport ---------- */
function fileBase(i) {
  const fromAi = S.isExample ? '' : S.result?.photos?.[i]?.file;
  const base = slugify(fromAi || (!S.isExample && S.result?.seo?.slug) || [S.ctx.type, S.ctx.place, S.settings.brand].filter(Boolean).join(' ')) || 'zdjecie';
  return S.photos.length > 1 ? `${base}-${i + 1}` : base;
}
const fileName = (i, id) => `${fileBase(i)}-${FMT[id].tag}.jpg`;
async function exportBlob(p, fmt, full) {
  const c = document.createElement('canvas'); c.width = fmt.w; c.height = fmt.h;
  drawFormat(c.getContext('2d'), fmt.w, fmt.h, p, fmt, p.crops[fmt.id], full);
  return toBlob(c, 'image/jpeg', 0.92);
}
async function downloadOne(id) {
  const p = S.photos[S.active]; if (!p) return;
  const btn = S.cards[id]?.dl; if (btn) { btn.disabled = true; btn.textContent = 'Przygotowuję…'; }
  try { const full = await decodeUrl(p.url); await saveFile(fileName(S.active, id), await exportBlob(p, FMT[id], full)); }
  catch (e) { console.warn(e); toast('Nie udało się przygotować pliku. Spróbuj ponownie.'); }
  finally { if (btn) { btn.disabled = false; btn.textContent = 'Pobierz JPG'; } }
}
async function downloadZip() {
  if (!S.photos.length) { toast('Najpierw wgraj zdjęcie.'); return; }
  const btn = $('#zipBtn'); const old = btn.textContent; btn.disabled = true;
  try {
    const files = [];
    for (let i = 0; i < S.photos.length; i++) {
      btn.textContent = `Przygotowuję ${i + 1}/${S.photos.length}…`;
      const p = S.photos[i]; const full = await decodeUrl(p.url);
      for (const f of FORMATS) files.push({ name: fileName(i, f.id), blob: await exportBlob(p, f, full) });
    }
    if (!S.isExample && S.result) files.push({ name: 'teksty.txt', blob: new Blob([textsExport()], { type: 'text/plain' }) });
    btn.textContent = 'Pakuję…';
    const zip = await makeZip(files);
    const base = slugify((!S.isExample && S.result?.seo?.slug) || [S.ctx.type, S.ctx.place].filter(Boolean).join(' ')) || 'post';
    await saveFile(`${base}-kadry.zip`, zip);
  } catch (e) { console.warn(e); toast('Nie udało się przygotować paczki. Pobierz kadry pojedynczo.'); }
  finally { btn.disabled = false; btn.textContent = old; }
}
