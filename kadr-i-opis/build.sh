#!/usr/bin/env sh
# Skleja źródła w jeden plik index.html (artefakt Claude przyjmuje jedną stronę HTML).
set -eu
cd "$(dirname "$0")"
{
  cat src/10-head.html src/20-body.html
  printf '<script>\n'
  cat src/30-core.js src/40-photos.js src/50-ai.js src/60-results.js src/70-app.js
  printf '</script>\n'
} > index.html
echo "index.html: $(wc -c < index.html) bajtów"
