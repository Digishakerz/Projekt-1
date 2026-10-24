# KWFoto · Black Week −30%

13-sekundowa reklama motion graphics w dwóch formatach. Obraz i dźwięk są w całości wygenerowane w kodzie.

- `out/kwfoto-black-week-16x9.mp4`: 1920×1080, 60 kl./s (Facebook, YouTube, reklamy w feedzie poziomym)
- `out/kwfoto-black-week-9x16.mp4`: 1080×1920, 60 kl./s (Reels, Stories, TikTok)

## Scenariusz

| Czas | Obraz | Dźwięk |
|---|---|---|
| 0–1 s | Czerwona linia rozwija się w okno przeglądarki, wpisuje się adres kwfoto.pl | sweep, stuk klawiszy |
| 1–2 s | Strona się ładuje, kursor klika „Kalkulator” | beat startuje, klik |
| 2–4 s | Przewinięcie do kalkulatora, 5 usług włącza się po kolei, suma rośnie jak licznik | arpeggio: jedna nuta na każdy przełącznik |
| 4–6 s | „Oblicz ofertę” → zawieszenie, okna błędów, rozjechany obraz, FATAL ERROR | muzyka się zacina i kruszy, sygnały błędów, zatrzymanie taśmy |
| 6.3–7.5 s | Restart w trybie Black Week: każda cena spada o 30%, suma zjeżdża do 12 530 zł, pieczątka −30% | zapy przy każdej cenie, tykanie licznika, uderzenie pieczątki |
| 7.5–8 s | Kamera wjeżdża w pieczątkę | riser, chwila ciszy |
| 8–11 s | BLACK WEEK, −30%, trzy usługi z nowymi cenami, „Wszystkie ceny w dół” | drop: stopa, bas, akordy na każdym cięciu |
| 11–13 s | Logo, −30% na wszystkie pakiety, daty, przycisk „Zarezerwuj termin” | ostatnie uderzenie, klik w przycisk |

## Zmiany

Ceny, nazwy usług, daty, hasło i adres są w `config.js`. Po zmianie:

```sh
node render.mjs                # oba formaty, ok. 5 minut
node render.mjs --only 9x16    # tylko pion
node render.mjs --fps 30       # wersja 30 kl./s
node render.mjs --stills 3.5,8.2   # pojedyncze klatki PNG do sprawdzenia
```

Potrzebne: Node 18+, Playwright z Chromium i ffmpeg.

**Prawdziwe zdjęcia i logo**: wrzuć do `assets/` pliki `golden.jpg` (para w złotej godzinie: strona główna, karta „Fotografia ślubna”, tło planszy końcowej), `lake.jpg` (karta „Film ślubny”), `night.jpg` (karta „Sesja narzeczeńska”) i opcjonalnie `logo.png`. Bez nich film rysuje własne ilustracje zastępcze.

**Podgląd na żywo**: z katalogu `black-week` uruchom `npx serve` (albo dowolny serwer plików), otwórz `index.html` i kliknij „Odtwórz”. Soundtrack liczy się w przeglądarce tym samym kodem.

## Pliki

- `config.js`: dane i oś czasu (te same momenty czyta obraz i dźwięk)
- `film.js`: cały obraz na canvasie
- `audio.js`: syntezator (stopa, clap, hi-haty, bas, akordy, efekty, pogłos, glitch, mastering)
- `render.mjs`: render klatek, WAV i MP4
- `fonts/`: Archivo, Source Serif 4, JetBrains Mono (licencja SIL OFL)
