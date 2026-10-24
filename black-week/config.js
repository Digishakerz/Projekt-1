// Dane reklamy Black Week KWFoto. Zmieniasz tutaj, potem `node render.mjs`.
// Plik czyta i przeglądarka (film), i Node (soundtrack), dlatego ten nagłówek.
(function (root) {
  const CONFIG = {
    brand: 'KWFoto',
    domain: 'kwfoto.pl',
    city: 'Kraków · cała Polska',
    discount: 30,
    dates: '23–30.11.2026',
    headline: ['Prawdziwe emocje.', 'Bez pozowania.'],
    lead: 'Fotografia i film ślubny z Krakowa.',
    nav: ['Portfolio', 'Film', 'Oferta', 'Kalkulator', 'Kontakt'],
    // Dokładnie 5 pozycji: tyle kliknięć jest w scenie kalkulatora.
    items: [
      { name: 'Fotografia ślubna', note: 'reportaż całego dnia', price: 6900 },
      { name: 'Film ślubny 4K', note: 'film + teledysk', price: 7400 },
      { name: 'Sesja narzeczeńska', note: 'plener do 2 godzin', price: 1200 },
      { name: 'Sesja plenerowa', note: 'po ślubie, złota godzina', price: 1500 },
      { name: 'Ujęcia z drona', note: 'foto i film z powietrza', price: 900 },
    ],
    cta: 'Zarezerwuj termin',

    fps: 60,
    duration: 13,
    bpm: 120,

    // Oś czasu w sekundach. Obraz i dźwięk biorą momenty z tego samego miejsca,
    // więc każdy klik, błąd i spadek ceny ma swój dźwięk w tej samej klatce.
    timeline: {
      boot: 0.0,
      windowOpen: 0.35,
      typing: [0.42, 0.92],
      pageLoad: 1.0,
      navClick: 2.0,
      scroll: [2.0, 2.38],
      toggles: [2.5, 2.75, 3.0, 3.25, 3.5],
      calcClick: 4.0,
      progress: [4.05, 4.5],
      firstGlitch: 4.25,
      errors: [4.5, 4.75, 5.0, 5.25, 5.375, 5.5, 5.625, 5.75, 5.8125, 5.875, 5.9375],
      errorTrail: [5.5, 6.0],
      meltdown: [6.0, 6.25],
      reboot: 6.3,
      drops: [6.5, 6.625, 6.75, 6.875, 7.0],
      totalDrop: [7.0, 7.4],
      stamp: 7.4,
      dive: [7.5, 7.92],
      drop: 8.0,
      black: 8.0,
      week: 8.25,
      marquee: 8.5,
      flip: 8.75,
      percent: 9.0,
      pulses: [9.25, 9.5],
      cuts: [9.75, 10.0, 10.25],
      fall: 10.5,
      end: 11.0,
      endLines: [11.15, 11.3, 11.45],
      ctaIn: 11.6,
      ctaClick: 12.25,
      outroGlitch: 12.5,
    },
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = CONFIG;
  else root.KW_CONFIG = CONFIG;
})(this);
