# Kadr i Opis

Narzędzie dla fotografa ślubnego: wrzucasz zdjęcie (albo do 10 zdjęć na karuzelę) i dostajesz komplet do publikacji.

- **Teksty** (pisze je Claude na podstawie zdjęcia i kontekstu):
  - Instagram: 3 warianty opisu, do 5 hashtagów, tekst alternatywny, sugestie oznaczeń i współpracy,
  - Facebook, Pinterest (tytuł i opis pod wyszukiwanie), Profil Firmy w Google,
  - SEO strony: H1, meta title, meta description, slug, nazwy plików, frazy, wstęp do wpisu,
  - plansze do stories i pomysł na rolkę.
- **Kadry**: 4:5, 3:4, 9:16, 2:3, 1:1, 16:9 i 4:3. Kadr ustawia się na główny motyw; można go przesunąć, powiększyć albo wpasować całe zdjęcie w ramkę (białą, czarną lub rozmytą). Pobieranie pojedynczo lub w ZIP razem z `teksty.txt`.
- **Poprawki**: „Krócej”, „Bardziej elegancko”, „Wersja angielska” albo własne polecenie.
- **Plan publikacji**: zapisane posty trafiają na najbliższy wolny dzień publikacji; licznik pilnuje celu tygodniowego.
- **Ustawienia marki**: nazwa, miasto, ton, forma wypowiedzi, stałe wezwanie do działania i frazy SEO trafiają do każdego zapytania.

Działa jako artefakt w Claude: https://claude.ai/artifact/BZwiq8vFDwpVtFjxUcMgpW

## Budowanie

Źródła są w `src/`. Polecenie `sh build.sh` skleja je w jeden plik `index.html`, który publikuje się jako artefakt
(z uprawnieniami `sample` do pisania tekstów, `downloads` do zapisu plików i `db` do ustawień i planu).
