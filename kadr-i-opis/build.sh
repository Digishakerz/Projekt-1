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

# Wersja lokalna: jeden plik HTML z wbudowaną biblioteką Claude, skróty do uruchamiania i paczka ZIP do pobrania.
LOCAL="lokalnie/Kadr i Opis"
rm -rf lokalnie && mkdir -p "$LOCAL"
cp "local-shell/Uruchom (Windows).bat" "local-shell/Uruchom (Mac).command" local-shell/CZYTAJ.txt "$LOCAL/"
chmod +x "$LOCAL/Uruchom (Mac).command"
FAVICON=$(base64 < app-shell/icons/favicon-32.png | tr -d '\n')
{
  printf '<!doctype html>\n<html lang="pl" class="app">\n<head>\n<meta charset="utf-8">\n'
  printf '<meta name="viewport" content="width=device-width, initial-scale=1">\n'
  printf '<link rel="icon" href="data:image/png;base64,%s">\n' "$FAVICON"
  cat src/10-head.html
  printf '</head>\n<body>\n'
  cat src/20-body.html
  printf '<script>\n'
  cat local-shell/anthropic-sdk.iife.js
  printf '\n</script>\n<script>\nwindow.KIO_TARGET = "app";\nwindow.KIO_BRAND = '
  cat config/brand.json
  printf ';\n'
  cat $JS
  printf '</script>\n</body>\n</html>\n'
} > "$LOCAL/kadr-i-opis.html"
# Stała data plików, żeby ZIP zmieniał się tylko wtedy, gdy zmienia się treść.
find lokalnie -exec touch -t 202601010000 {} +
(cd lokalnie && find "Kadr i Opis" -type f | LC_ALL=C sort | zip -X -q ../app/kadr-i-opis-lokalnie.zip -@)

echo "index.html: $(wc -c < index.html) B, app/index.html: $(wc -c < app/index.html) B, lokalnie: $(wc -c < app/kadr-i-opis-lokalnie.zip) B ZIP, wersja $BUILD"
