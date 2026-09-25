# Kadr i Opis

Wrzucasz zdjęcie (albo do 10 na karuzelę), a narzędzie przygotowuje:

- **teksty**: 3 warianty opisu na Instagram z hashtagami (maksymalnie 5), tekst alternatywny, post na Facebooka, plansze do stories, pomysł na rolkę, post do Profilu Firmy w Google i SEO wpisu na stronę;
- **kadry JPG**: post 4:5, post 3:4, stories 9:16 i kwadrat 1:1. Kadr sam ustawia się na parę, można go przesunąć, powiększyć albo wpasować całe zdjęcie w ramkę (białą, czarną lub rozmytą);
- **plan publikacji**: posty trafiają na Twoje dni publikacji. Przycisk „Kalendarz Google” (albo plik dla iPhone'a i Outlooka) dodaje przypomnienie do kalendarza w telefonie, a w opisie wydarzenia jest gotowy tekst do wklejenia.

## Dwie wersje

| | Gdzie działa | Kto pisze teksty |
|---|---|---|
| **Artefakt w Claude** (`index.html`) | claude.ai, aplikacja Claude na komputer i telefon: https://claude.ai/artifact/BZwiq8vFDwpVtFjxUcMgpW | Claude na Twoim koncie Claude, bez kluczy API |
| **Aplikacja** (`app/`) | instalujesz ją z przeglądarki na komputerze i telefonie | Gemini (darmowy klucz) albo Claude (płatny klucz API); gdy jeden nie działa, zastępuje go drugi |

## Jak uruchomić aplikację

Aplikacja to zwykła strona, którą trzeba raz opublikować pod adresem https:

1. **GitHub Pages** (repozytorium musi być publiczne albo konto GitHub Pro): *Settings → Pages → Build and deployment → Source: GitHub Actions*, potem *Actions → „Kadr i Opis – aplikacja” → Run workflow*. Adres będzie wyglądał tak: `https://digishakerz.github.io/Projekt-1/`.
2. **Netlify albo Cloudflare Pages** (działa z prywatnym repozytorium, za darmo): nowy projekt z tego repozytorium, katalog publikacji `kadr-i-opis/app`, bez polecenia budowania.

Potem:

- **Komputer**: otwórz adres w Chrome albo Edge i kliknij „Zainstaluj aplikację” (albo ikonę instalacji w pasku adresu). Aplikacja pojawi się w menu Start albo w Docku.
- **iPhone**: otwórz adres w Safari → Udostępnij → „Do ekranu początkowego”.
- **Android**: otwórz adres w Chrome → menu → „Zainstaluj aplikację”.

## Wersja lokalna (na komputer, bez GitHuba)

Paczka `kadr-i-opis-lokalnie.zip` (do pobrania też z https://digishakerz.github.io/Projekt-1/kadr-i-opis-lokalnie.zip):

- **Windows**: rozpakuj i kliknij dwukrotnie `Uruchom (Windows).bat`. Aplikacja otworzy się w osobnym oknie Edge.
- **Mac**: rozpakuj, za pierwszym razem prawy przycisk na `Uruchom (Mac).command` → Otwórz → Otwórz. Otworzy się okno Chrome (albo Edge), a bez nich domyślna przeglądarka.

Wszystko jest w jednym pliku `kadr-i-opis.html`, razem z biblioteką Claude. Internet jest potrzebny tylko do pisania tekstów.

## Klucze AI (tylko w aplikacji)

- **Gemini** (darmowy): https://aistudio.google.com/apikey → „Create API key”. Wklej w *Ustawienia → Silnik AI* i kliknij „Sprawdź”. Darmowy limit jest dzienny; gdy się skończy, aplikacja przełącza się na lżejszy model Gemini, a potem na Claude, jeśli dodasz jego klucz.
- **Claude** (płatny, osobne konto API, nie abonament Claude): https://platform.claude.com → API keys. Domyślny model to Claude Opus 5; tańszy Claude Sonnet 5 wybierzesz w ustawieniach.

Klucze zapisują się tylko w przeglądarce na danym urządzeniu. Nie trafiają do repozytorium.

## Budowanie

Źródła są w `src/`, pliki aplikacji w `app-shell/`, dane marki w `config/brand.json`.
Polecenie `sh build.sh` tworzy `index.html` (artefakt) i katalog `app/` (aplikacja).
Biblioteka `app-shell/vendor/anthropic-sdk.mjs` to spakowany `@anthropic-ai/sdk` 0.128.0 (licencja MIT).
