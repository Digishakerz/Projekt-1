#!/usr/bin/env python3
"""Buduje grę Martwy Szlak ze źródeł w src/ i grafik w assets/.

Powstają dwa pliki z tą samą grą:
  index.html             – wersja do artefaktu w Claude (bez <html> i <head>, dopisuje je publikacja),
  app/martwy-szlak.html  – samodzielny plik: wystarczy otworzyć go w przeglądarce.
Wszystkie grafiki są wbudowane w plik jako data URI. Uruchom: python3 build.py
"""
import base64
import json
import pathlib

ROOT = pathlib.Path(__file__).resolve().parent
SRC = ROOT / 'src'
ASSETS = ROOT / 'assets'
JS = ['30-data.js', '35-assets.js', '40-sim.js', '50-render.js', '60-audio.js', '70-main.js']
MIME = {'.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg'}


def main():
    man = json.loads((ASSETS / 'manifest.json').read_text('utf-8'))
    assets = {}
    for key, rel in man['images'].items():
        path = ASSETS / rel
        data = base64.b64encode(path.read_bytes()).decode('ascii')
        assets[key] = f'data:{MIME[path.suffix.lower()]};base64,{data}'
    meta = {'sprites': man.get('sprites', {})}

    head = (SRC / '10-head.html').read_text('utf-8')
    body = (SRC / '20-body.html').read_text('utf-8')
    code = '\n'.join((SRC / name).read_text('utf-8') for name in JS)
    script = (
        '<script>\n(() => {\n'
        f'const ASSETS = {json.dumps(assets, separators=(",", ":"))};\n'
        f'const ASSET_META = {json.dumps(meta, ensure_ascii=False, separators=(",", ":"))};\n'
        f'{code}\n}})();\n</script>\n'
    )

    artifact = ROOT / 'index.html'
    artifact.write_text(head + body + script, 'utf-8')

    app = ROOT / 'app'
    app.mkdir(exist_ok=True)
    standalone = app / 'martwy-szlak.html'
    standalone.write_text(
        '<!doctype html>\n<html lang="pl">\n<head>\n<meta charset="utf-8">\n'
        '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n'
        '<meta name="theme-color" content="#15110d">\n'
        '<style>:root{padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}</style>\n'
        f'{head}</head>\n<body>\n{body}{script}</body>\n</html>\n',
        'utf-8',
    )
    kb = lambda p: round(p.stat().st_size / 1024)
    print(f'index.html: {kb(artifact)} KB, app/martwy-szlak.html: {kb(standalone)} KB, grafik: {len(assets)}')


if __name__ == '__main__':
    main()
