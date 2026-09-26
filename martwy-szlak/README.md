# Martwy Szlak

Pionowa gra akcji w stylu reklam „gate runner” (na wzór Z Route: Redemption). Oddział biegnie autostradą i strzela sam, a gracz wybiera pas, czyli to, w co idzie ogień:

- **lewy pas, bramki:** czerwone szyby z liczbą ujemną. Każda salwa podnosi liczbę o 1, a po przejściu przez zero szyba robi się niebieska. Przebiegnięcie przez niebieską dodaje żołnierzy (albo ×2), przez czerwoną zabiera. Na tym pasie stoją też kostki lodu, kontenery i złote sejfy z HP: rozbite dają nagrodę, a nierozbite zabijają żołnierzy przy zderzeniu;
- **środkowy pas, horda:** gęsty tłum zombie. Każdy zombie, który dopadnie oddziału, zabiera jednego żołnierza (brute i wybuchowiec po trzech);
- **prawy pas, broń:** podest pojawia się ok. 230 px nad oddziałem. Licznik (np. 0/30) rośnie z każdym trafieniem, a po zapełnieniu broń spada na drogę i trzeba ją złapać.

Poziomy:

| Poziom | Otoczenie | Broń do zdobycia | Boss |
|---|---|---|---|
| 1. Autostrada Śmierci | pustynna autostrada, ok. 2 minut | pistolet maszynowy (30), karabin szturmowy (80) | **Buldożer**: co 5 s zaznacza pas na czerwono i szarżuje, przy połowie HP wzywa 20 zombie |
| 2. Strefa Skażenia | nocna strefa chemiczna, ok. 2,5 minuty | minigun (150), miotacz ognia (250) | **Kocioł**: rzuca kwas, który na 3 s zamyka pas, przy połowie HP zrzuca pancerz i przyspiesza |

Oddział z poziomu 1 przechodzi na poziom 2. W menu jest też trening z każdym bossem.

## Jak zagrać

- Otwórz `app/martwy-szlak.html` w przeglądarce (wszystko jest w jednym pliku, grafiki też). Do fontów potrzebny jest internet, bez niego gra użyje kroju zapasowego.
- Sterowanie: przeciąganie palcem albo myszą w lewo i w prawo, na klawiaturze strzałki ← → albo A/D. Klawisz P albo Esc to pauza, a w pauzie widać płynność w klatkach na sekundę.

## Budowanie

```
python3 build.py
```

Powstają `app/martwy-szlak.html` (samodzielny plik) i `index.html` (wersja do artefaktu w Claude, bez `<html>` i `<head>`). Źródła są w `src/`:

| Plik | Zawartość |
|---|---|
| `10-head.html`, `20-body.html` | tytuł, style, HUD, menu i ekrany |
| `30-data.js` | stałe kamery i pasów, bronie, typy zombie, bossowie, skrypty obu poziomów |
| `35-assets.js` | ładowanie grafik, cache klatek w 3 skalach (1,0 / 0,93 / 0,86) z lustrem i białą sylwetką, atlas cyfr, grafiki zastępcze rysowane w kodzie |
| `40-sim.js` | cała logika gry bez DOM: oddział, ogień, horda z grupami LOD, bramki, przeszkody, podest, bossowie |
| `50-render.js` | rzut pseudo-ortograficzny (głębia × 0,62, skala 0,85 u góry → 1,0 na dole), droga w buforze pierścieniowym z wypalanymi plamami krwi, sortowanie po głębi, efekty, liczby |
| `60-audio.js` | krótkie efekty dźwiękowe syntezowane w WebAudio |
| `70-main.js` | menu, pauza, HUD, sterowanie i pętla gry |

## Grafiki z Magnific

Grafiki generuje się w Magnific (Nano Banana Pro, 2K) promptami ze specyfikacji, na jednolitym tle magenta `#FF00FF`. Pobrane oryginały wrzuca się do `raw/` pod nazwami kluczy (`soldier.png`, `z1.png`, `boss0.png`, `panels.png`, `road1.png` itd., pełna lista w `SPEC` w skrypcie), a potem:

```
python3 tools/process_assets.py raw
python3 build.py
```

Skrypt wycina tło, tnie arkusze według wykrytej zawartości (nie po stałej siatce), wylicza kotwicę stóp, zszywa tekstury w pionie i dopisuje wszystko do `assets/manifest.json`. Czego brakuje, to gra bierze ze starych grafik z `assets/old/` albo rysuje w kodzie.

## Testy

- `node tools/sim.mjs 20 0.8`: symulacja balansu bez renderu (bot bierze ok. 80% bramek). Cel ze specyfikacji: 25–40 żołnierzy przy bossie na poziomie 1 i 50–80 na poziomie 2.
- `node tools/playthrough.mjs katalog`: przejście obu poziomów w Chromium (Playwright) z przyspieszonym czasem i zrzutami kluczowych chwil.
- `node tools/smoke.mjs katalog 12`: krótki test każdego trybu z listą błędów konsoli.
