#!/usr/bin/env sh
# Buduje dwie wersje z tych samych źródeł:
#   index.html  – artefakt w Claude (teksty pisze Claude na koncie użytkownika),
#   app/        – aplikacja do zainstalowania na komputerze i telefonie (Gemini lub Claude przez klucz API).
set -eu
cd "$(dirname "$0")"
JS="src/30-core.js src/40-photos.js src/50-ai.js src/55-providers.js src/60-results.js src/70-app.js"

{
  cat src/10-head.html src/20-body.html
  printf '<script>\nwindow.KIO_TARGET = "artifact";\n'
  cat $JS
  printf '</script>\n'
} > index.html

rm -rf app && mkdir -p app && cp -R app-shell/. app/
BUILD=$(cat src/* config/brand.json app-shell/sw.js | cksum | cut -d' ' -f1)
sed "s/__BUILD__/$BUILD/" app-shell/sw.js > app/sw.js
{
  printf '<!doctype html>\n<html lang="pl" class="app">\n<head>\n<meta charset="utf-8">\n'
  printf '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n'
  printf '<meta name="theme-color" content="#14171B">\n<link rel="manifest" href="manifest.webmanifest">\n'
  printf '<link rel="icon" href="icons/favicon-32.png">\n<link rel="apple-touch-icon" href="icons/apple-touch-icon.png">\n'
  printf '<meta name="apple-mobile-web-app-capable" content="yes">\n<meta name="mobile-web-app-capable" content="yes">\n'
  printf '<meta name="apple-mobile-web-app-title" content="Kadr i Opis">\n<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">\n'
  cat src/10-head.html
  printf '</head>\n<body>\n'
  cat src/20-body.html
  printf '<script>\nwindow.KIO_TARGET = "app";\nwindow.KIO_BRAND = '
  cat config/brand.json
  printf ';\n'
  cat $JS
  printf '</script>\n</body>\n</html>\n'
} > app/index.html

echo "index.html: $(wc -c < index.html) B, app/index.html: $(wc -c < app/index.html) B, wersja $BUILD"
