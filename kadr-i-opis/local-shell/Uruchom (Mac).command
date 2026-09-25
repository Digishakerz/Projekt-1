#!/bin/sh
# Kadr i Opis: otwiera aplikację w osobnym oknie Chrome albo Edge; bez nich w domyślnej przeglądarce.
DIR="$(cd "$(dirname "$0")" && pwd)"
FILE="$DIR/kadr-i-opis.html"
if [ -d "/Applications/Google Chrome.app" ]; then
  open -na "Google Chrome" --args --app="file://$FILE"
elif [ -d "/Applications/Microsoft Edge.app" ]; then
  open -na "Microsoft Edge" --args --app="file://$FILE"
else
  open "$FILE"
fi
