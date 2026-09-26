#!/usr/bin/env python3
"""Przygotowuje grafiki z Magnific do gry Martwy Szlak.

Wejście: oryginały w katalogu raw/ (np. raw/z1.png), nazwane kluczami z listy SPEC poniżej.
Wyjście: assets/gen/*.webp|jpg oraz assets/manifest.json (czytany przez build.py).

Kroki (zgodnie ze specyfikacją):
  1. usunięcie tła chroma key magenta #FF00FF w przestrzeni barw (z miękką krawędzią i usuwaniem przebarwień),
  2. cięcie arkuszy z wykrywaniem zawartości (spójne obszary przypisane do komórek siatki), nie po stałej siatce,
  3. przycięcie, wspólna skala dla klatek jednego arkusza, kotwica w miejscu stóp,
  4. tekstury: zszycie w pionie (bez widocznego szwu przy powtarzaniu), efekty z czarnego tła zostają na czarnym.
Użycie: python3 tools/process_assets.py raw_dir
"""
import json
import pathlib
import sys

import numpy as np
from PIL import Image
from scipy import ndimage

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / 'assets' / 'gen'
DENSITY = 3          # piksele obrazu na jednostkę logiczną (zapas na ekrany o gęstości do 3x)

# Opis każdego oryginału: rodzaj, siatka, nazwy klatek i docelowa wysokość (h) lub szerokość (w) na ekranie w px logicznych.
SPEC = {
    'soldier': dict(kind='sheet', grid=(4, 2), sprite='soldier', h=32, frames=['run0', 'run1', 'run2', 'run3', 'idle', 'shoot', 'hit', 'death'],
                    anims={'run': [0, 1, 2, 3], 'idle': [4], 'shoot': [5], 'hit': [6], 'death': [7]}, ref=0),
    'z1': dict(kind='sheet', grid=(4, 1), sprite='z1', h=34),
    'z2': dict(kind='sheet', grid=(4, 1), sprite='z2', h=34),
    'z3': dict(kind='sheet', grid=(4, 1), sprite='z3', h=34),
    'zr': dict(kind='sheet', grid=(4, 1), sprite='zr', h=33),
    'zx': dict(kind='sheet', grid=(4, 1), sprite='zx', h=35),
    'zb': dict(kind='sheet', grid=(2, 1), sprite='zb', h=60),
    'boss0': dict(kind='single', sprite='boss0', h=170),
    'boss0_charge': dict(kind='single', sprite='boss0_charge', h=170),
    'boss0_hit': dict(kind='single', sprite='boss0_hit', h=170),
    'boss1': dict(kind='single', sprite='boss1', h=176),
    'boss1_p2': dict(kind='single', sprite='boss1_p2', h=176),
    'boss1_throw': dict(kind='single', sprite='boss1_throw', h=176),
    'pedestal': dict(kind='single', sprite='pedestal', w=92, ay='bottom'),
    'weapons': dict(kind='items', grid=(3, 2), items=[('w0', dict(w=88)), ('w1', dict(w=88)), ('w2', dict(w=88)), ('w3', dict(w=88)), ('w4', dict(w=88)), ('part', dict(h=26))], center=True),
    'panels': dict(kind='items', grid=(2, 1), items=[('panel_red', dict(w=96)), ('panel_blue', dict(w=96))]),
    'obst': dict(kind='items', grid=(3, 1), items=[('ice', dict(h=88)), ('container', dict(h=92)), ('safe', dict(h=70))]),
    'items': dict(kind='items', grid=(3, 1), items=[('coin', dict(h=14)), ('crate', dict(h=34)), ('safe_open', dict(h=70))]),
    'props1a': dict(kind='items', grid=(3, 2), items=[('p_sedan', dict(h=58)), ('p_pickup', dict(h=62)), ('p_barrier', dict(h=34)), ('p_cactus', dict(h=92)), ('p_tires', dict(h=40)), ('p_barrel', dict(h=40))]),
    'props1b': dict(kind='items', grid=(3, 2), items=[('p_bus', dict(h=96)), ('p_sign', dict(h=100)), ('p_tree', dict(h=100)), ('p_rocks', dict(h=44)), ('p_wreck', dict(h=52)), ('p_sandbags', dict(h=38))]),
    'props2a': dict(kind='items', grid=(3, 2), items=[('p_container', dict(h=92)), ('p_hazbarrel', dict(h=44)), ('p_pipes', dict(h=46)), ('p_tanker', dict(h=84)), ('p_forklift', dict(h=66)), ('p_fence', dict(h=66))]),
    'props2b': dict(kind='items', grid=(3, 2), items=[('p_lamp', dict(h=150)), ('p_crates', dict(h=56)), ('p_drums', dict(h=44)), ('p_hazsign', dict(h=70)), ('p_spool', dict(h=44)), ('p_cbarrier', dict(h=36))]),
    'decals': dict(kind='items', grid=(3, 2), items=[('blood0', dict(w=48)), ('blood1', dict(w=48)), ('blood2', dict(w=48)), ('acid', dict(w=64)), ('acid2', dict(w=64)), ('scorch', dict(w=64))], center=True),
    'vfx': dict(kind='vfx', grid=(4, 2), items=['flash0', 'flash1', 'flash2', 'shards', 'fire', 'fire2', 'toxic', 'sparkle'], px=160),
    'road1': dict(kind='texture', size=1024),
    'road2': dict(kind='texture', size=1024),
    'side1': dict(kind='texture', size=512),
    'side2': dict(kind='texture', size=512),
    'key': dict(kind='key', size=(720, 1280)),
}


def chroma_key(im):
    """Usuwa tło magenta: alfa z miary 'magentowości', potem zdjęcie różowego nalotu z krawędzi."""
    a = np.asarray(im.convert('RGB')).astype(np.float32) / 255.0
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    m = np.minimum(r, b) - g                           # 1 dla czystej magenty, ~0 dla szarości, czerwieni i błękitu
    alpha = np.clip((0.42 - m) / (0.42 - 0.14), 0.0, 1.0)
    # Usunięcie przebarwień: odejmujemy składnik magenty od R i B tam, gdzie go widać.
    spill = np.clip(m, 0.0, None)
    r2, b2 = r - spill, b - spill
    out = np.stack([r2, g, b2, alpha], axis=-1)
    out[alpha <= 0.02] = 0.0
    return out


def components(alpha, min_area):
    mask = alpha > 0.35
    lab, n = ndimage.label(mask, structure=np.ones((3, 3)))
    if n == 0:
        return []
    objs = ndimage.find_objects(lab)
    areas = ndimage.sum(mask, lab, index=np.arange(1, n + 1))
    res = []
    for i, sl in enumerate(objs):
        if areas[i] < min_area:
            continue
        ys, xs = sl
        res.append(dict(id=i + 1, y0=ys.start, y1=ys.stop, x0=xs.start, x1=xs.stop, area=float(areas[i]),
                        cy=(ys.start + ys.stop) / 2, cx=(xs.start + xs.stop) / 2))
    return res


def cells_from_components(rgba, cols, rows, min_frac=0.0015):
    """Grupuje spójne obszary w komórki siatki według ich środka; zwraca listę wycinków RGBA (kolejność wierszami)."""
    h, w = rgba.shape[:2]
    comps = components(rgba[..., 3], min_area=h * w * min_frac)
    groups = {}
    for c in comps:
        col = min(cols - 1, int(c['cx'] / w * cols))
        row = min(rows - 1, int(c['cy'] / h * rows))
        groups.setdefault((row, col), []).append(c)
    out = []
    for row in range(rows):
        for col in range(cols):
            g = groups.get((row, col))
            if not g:
                out.append(None)
                continue
            y0, y1 = min(c['y0'] for c in g), max(c['y1'] for c in g)
            x0, x1 = min(c['x0'] for c in g), max(c['x1'] for c in g)
            pad = 4
            y0, x0 = max(0, y0 - pad), max(0, x0 - pad)
            y1, x1 = min(h, y1 + pad), min(w, x1 + pad)
            out.append(rgba[y0:y1, x0:x1].copy())
    return out


def feet_anchor(crop):
    """Kotwica w miejscu stóp: środek ciężkości alfy w najniższych 22% wysokości postaci."""
    al = crop[..., 3]
    rows = np.where(al.max(axis=1) > 0.5)[0]
    if len(rows) == 0:
        return 0.5, 0.97
    top, bot = rows[0], rows[-1]
    band = al[max(top, bot - int((bot - top) * 0.22)):bot + 1]
    xs = np.arange(al.shape[1])
    wsum = band.sum()
    ax = float((band.sum(axis=0) * xs).sum() / wsum) / al.shape[1] if wsum > 0 else 0.5
    return round(ax, 4), round((bot + 1) / al.shape[0], 4)


def to_image(rgba):
    arr = np.clip(rgba * 255.0 + 0.5, 0, 255).astype(np.uint8)
    # Premultiplikacja krawędzi: kolor w pełni przezroczystych pikseli bez znaczenia, zerujemy dla lepszej kompresji.
    arr[arr[..., 3] == 0] = 0
    return Image.fromarray(arr, 'RGBA')


def save_sprite(name, rgba, scale):
    im = to_image(rgba)
    w, h = max(1, round(im.width * scale)), max(1, round(im.height * scale))
    im = im.resize((w, h), Image.LANCZOS)
    path = OUT / f'{name}.webp'
    im.save(path, 'WEBP', quality=88, method=6)
    return f'gen/{name}.webp', im


def seamless_vertical(im):
    """Zszywa teksturę w pionie: środek z oryginału, krawędzie z kopii przesuniętej o pół wysokości."""
    a = np.asarray(im.convert('RGB')).astype(np.float32)
    h = a.shape[0]
    rolled = np.roll(a, h // 2, axis=0)
    y = np.arange(h, dtype=np.float32) / (h - 1)
    wgt = np.clip(1 - np.abs(y - 0.5) * 2, 0, 1) ** 0.6       # 1 w środku, 0 na krawędziach
    wgt = np.clip((wgt - 0.1) / 0.5, 0, 1)[:, None, None]
    out = a * wgt + rolled * (1 - wgt)
    return Image.fromarray(np.clip(out, 0, 255).astype(np.uint8), 'RGB')


def main(raw_dir):
    raw = pathlib.Path(raw_dir)
    OUT.mkdir(parents=True, exist_ok=True)
    images, sprites, report = {}, {}, []
    for key, spec in SPEC.items():
        src = next((p for p in raw.glob(key + '.*')), None)
        if src is None:
            continue
        im = Image.open(src)
        kind = spec['kind']
        if kind in ('sheet', 'single'):
            rgba = chroma_key(im)
            cols, rows = spec.get('grid', (1, 1))
            crops = cells_from_components(rgba, cols, rows) if kind == 'sheet' else [c for c in cells_from_components(rgba, 1, 1)]
            crops = [c for c in crops if c is not None]
            if not crops:
                report.append(f'{key}: brak zawartości'); continue
            hs = [c.shape[0] for c in crops]
            ref = hs[spec.get('ref', 0)] if kind == 'single' else float(np.median(hs))
            if 'w' in spec:
                target = spec['w'] * DENSITY; ref = crops[0].shape[1]
                disp_h = spec['w'] * crops[0].shape[0] / crops[0].shape[1]
            else:
                target = spec['h'] * DENSITY; disp_h = spec['h']
            scale = target / ref
            names, anchors = [], []
            for i, c in enumerate(crops):
                nm = spec['sprite'] + (f'_{spec["frames"][i]}' if 'frames' in spec and i < len(spec['frames']) else f'_{i}' if len(crops) > 1 else '')
                rel, out = save_sprite(nm, c, scale)
                images[nm] = rel
                names.append(nm)
                anchors.append(feet_anchor(c) if spec.get('ay') != 'bottom' else (0.5, 0.97))
            # Wysokość h w manifeście odnosi się do klatki referencyjnej (mediana), więc skala jest wspólna.
            ref_i = int(np.argmin([abs(hh - (ref if 'w' not in spec else crops[0].shape[0])) for hh in hs]))
            sprites[spec['sprite']] = dict(h=round(disp_h * hs[ref_i] / (ref if 'w' not in spec else crops[0].shape[0]), 2), frames=names, ref=ref_i,
                                           anchors=anchors, **({'anims': spec['anims']} if 'anims' in spec else {}))
            report.append(f'{key}: {len(crops)} klatek, wysokości {hs}')
        elif kind == 'items':
            rgba = chroma_key(im)
            cols, rows = spec['grid']
            crops = cells_from_components(rgba, cols, rows)
            for (name, size), c in zip(spec['items'], crops):
                if c is None:
                    report.append(f'{key}/{name}: brak'); continue
                if 'w' in size:
                    scale = size['w'] * DENSITY / c.shape[1]; disp_h = size['w'] * c.shape[0] / c.shape[1]
                else:
                    scale = size['h'] * DENSITY / c.shape[0]; disp_h = size['h']
                rel, out = save_sprite(name, c, scale)
                images[name] = rel
                ax, ay = (0.5, 0.5) if spec.get('center') else feet_anchor(c)
                sprites[name] = dict(h=round(disp_h, 2), frames=[name], ax=ax, ay=ay)
            report.append(f'{key}: {sum(c is not None for c in crops)}/{len(spec["items"])} elementów')
        elif kind == 'vfx':
            a = np.asarray(im.convert('RGB')).astype(np.float32) / 255.0
            lum = a.max(axis=-1)
            rgba = np.dstack([a, np.clip((lum - 0.06) * 3, 0, 1)])
            cols, rows = spec['grid']
            crops = cells_from_components(rgba, cols, rows, min_frac=0.0006)
            for name, c in zip(spec['items'], crops):
                if c is None:
                    report.append(f'{key}/{name}: brak'); continue
                img = Image.fromarray(np.clip(c[..., :3] * 255, 0, 255).astype(np.uint8), 'RGB')
                side = max(img.size)
                sq = Image.new('RGB', (side, side), (0, 0, 0)); sq.paste(img, ((side - img.width) // 2, (side - img.height) // 2))
                sq = sq.resize((spec['px'], spec['px']), Image.LANCZOS)
                sq.save(OUT / f'{name}.webp', 'WEBP', quality=86)
                images[name] = f'gen/{name}.webp'
                sprites[name] = dict(h=16, frames=[name], ax=0.5, ay=0.5)
            report.append(f'{key}: {sum(c is not None for c in crops)} efektów')
        elif kind == 'texture':
            t = seamless_vertical(im).resize((spec['size'], spec['size']), Image.LANCZOS)
            t.save(OUT / f'{key}.jpg', 'JPEG', quality=84, optimize=True, progressive=True)
            images[key] = f'gen/{key}.jpg'
            report.append(f'{key}: tekstura {spec["size"]}')
        elif kind == 'key':
            t = im.convert('RGB').resize(spec['size'], Image.LANCZOS)
            t.save(OUT / 'key.jpg', 'JPEG', quality=82, optimize=True, progressive=True)
            images['key'] = 'gen/key.jpg'
            report.append('key: grafika menu')
    man_path = ROOT / 'assets' / 'manifest.json'
    man = json.loads(man_path.read_text('utf-8')) if man_path.exists() else {'images': {}, 'sprites': {}}
    # Nowe grafiki zastępują stare o tych samych kluczach; stare zostają tylko tam, gdzie nie ma nowych.
    man['images'].update(images)
    man['sprites'].update(sprites)
    used = set(images) | {f for s in man['sprites'].values() for f in s['frames']} | {'key', 'road1', 'road2', 'side1', 'side2'}
    man['images'] = {k: v for k, v in man['images'].items() if k in used}
    man_path.write_text(json.dumps(man, ensure_ascii=False, indent=1), 'utf-8')
    print('\n'.join(report))


if __name__ == '__main__':
    main(sys.argv[1] if len(sys.argv) > 1 else 'raw')
