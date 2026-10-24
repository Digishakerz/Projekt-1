// Soundtrack syntezowany w kodzie, próbka po próbce. Każdy dźwięk stoi na tym samym
// momencie osi czasu (config.js) co zdarzenie w obrazie.
(function (root) {
  const C = typeof module !== 'undefined' && module.exports ? require('./config.js') : root.KW_CONFIG;
  const TAU = Math.PI * 2;
  const mtof = (m) => 440 * 2 ** ((m - 69) / 12);
  const clamp = (v, a = 0, b = 1) => (v < a ? a : v > b ? b : v);

  function render(sr = 48000) {
    const T = C.timeline;
    const N = Math.ceil(C.duration * sr);
    const beat = 60 / C.bpm;
    const bus = () => ({ L: new Float32Array(N), R: new Float32Array(N) });
    const drums = bus(), bass = bus(), music = bus(), sfx = bus(), send = bus();

    let seed = 12345;
    const rnd = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296) * 2 - 1;
    const det = (a, b = 0) => { let h = Math.imul(a ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(b + 0x632be5ab, 0xc2b2ae35); h ^= h >>> 15; h = Math.imul(h, 0x2c1b3c6d); h ^= h >>> 13; return (h >>> 0) / 4294967296; };

    class BQ {
      constructor() { this.x1 = this.x2 = this.y1 = this.y2 = 0; this.b0 = 1; this.b1 = this.b2 = this.a1 = this.a2 = 0; }
      set(type, f, q = 0.707) {
        const w = (TAU * Math.min(Math.max(f, 10), sr * 0.45)) / sr, cs = Math.cos(w), al = Math.sin(w) / (2 * q);
        let b0, b1, b2; const a0 = 1 + al;
        if (type === 'lp') { b0 = (1 - cs) / 2; b1 = 1 - cs; b2 = b0; } else if (type === 'hp') { b0 = (1 + cs) / 2; b1 = -(1 + cs); b2 = b0; } else { b0 = al; b1 = 0; b2 = -al; }
        this.b0 = b0 / a0; this.b1 = b1 / a0; this.b2 = b2 / a0; this.a1 = (-2 * cs) / a0; this.a2 = (1 - al) / a0;
        return this;
      }
      p(x) {
        const y = this.b0 * x + this.b1 * this.x1 + this.b2 * this.x2 - this.a1 * this.y1 - this.a2 * this.y2;
        this.x2 = this.x1; this.x1 = x; this.y2 = this.y1; this.y1 = y; return y;
      }
    }
    const blep = (p, dt) => { if (p < dt) { p /= dt; return p + p - p * p - 1; } if (p > 1 - dt) { p = (p - 1) / dt; return p * p + p + p + 1; } return 0; };
    const panG = (p) => [Math.cos(((p + 1) * Math.PI) / 4) * Math.SQRT2, Math.sin(((p + 1) * Math.PI) / 4) * Math.SQRT2];

    // Jeden głos: fn(t) zwraca próbkę, reszta to rozmieszczenie w stereo i wysyłka na pogłos.
    function voice(b, t0, dur, fn, gain = 1, pan = 0, sendAmt = 0) {
      const i0 = Math.round(t0 * sr), n = Math.round(dur * sr), [gl, gr] = panG(pan);
      for (let i = 0; i < n; i++) {
        const idx = i0 + i; if (idx < 0 || idx >= N) continue;
        const v = fn(i / sr) * gain;
        b.L[idx] += v * gl; b.R[idx] += v * gr;
        if (sendAmt) { send.L[idx] += v * gl * sendAmt; send.R[idx] += v * gr * sendAmt; }
      }
    }

    // ------------------------------------------------------------ instrumenty
    function kick(t0, amp = 1, long = false) {
      let ph = 0;
      voice(drums, t0, long ? 1.1 : 0.42, (t) => {
        const f = 44 + 130 * Math.exp(-t * 30); ph += (TAU * f) / sr;
        const env = Math.exp(-t * (long ? 2.6 : 8)) * Math.min(1, t * 900);
        const click = t < 0.004 ? rnd() * 0.5 * (1 - t / 0.004) : 0;
        return Math.tanh(Math.sin(ph) * 1.9) * env + click;
      }, amp);
    }
    function clap(t0, amp = 1, pan = 0) {
      const f = new BQ().set('bp', 1500, 1.1);
      voice(drums, t0, 0.32, (t) => {
        let e = 0;
        for (const o of [0, 0.011, 0.023]) if (t >= o) e = Math.max(e, Math.exp(-(t - o) * (o < 0.02 ? 140 : 17)));
        return f.p(rnd()) * e * 2.6;
      }, amp, pan, 0.4);
    }
    function hat(t0, amp = 0.3, open = false, pan = 0) {
      const f = new BQ().set('hp', 7800, 0.8);
      voice(drums, t0, open ? 0.24 : 0.05, (t) => f.p(rnd()) * Math.exp(-t * (open ? 15 : 70)), amp, pan);
    }
    function pluck(t0, m, amp = 0.3, pan = 0, sendAmt = 0.45) {
      let pc = 0, pm = 0; const f = mtof(m);
      voice(music, t0, 1.0, (t) => {
        pm += (TAU * f * 2) / sr; pc += (TAU * f) / sr;
        const idx = 2.6 * Math.exp(-t * 14);
        return Math.sin(pc + idx * Math.sin(pm)) * Math.exp(-t * 5.5) * Math.min(1, t * 900);
      }, amp, pan, sendAmt);
    }
    function stab(t0, notes, dur, amp = 0.3, cut0 = 7000, cut1 = 900, sendAmt = 0.3) {
      const oscs = [];
      notes.forEach((m) => { for (let v = 0; v < 5; v++) oscs.push({ f: mtof(m + (v - 2) * 0.1), p: det(m, v), pan: (v - 2) / 2 }); });
      const fl = new BQ(), fr = new BQ();
      const i0 = Math.round(t0 * sr), n = Math.round(dur * sr);
      for (let i = 0; i < n; i++) {
        const idx = i0 + i; if (idx >= N) break;
        const t = i / sr;
        if (i % 16 === 0) { const cut = cut1 + (cut0 - cut1) * Math.exp(-t * 10); fl.set('lp', cut, 0.9); fr.set('lp', cut, 0.9); }
        let l = 0, r = 0;
        for (const o of oscs) {
          const dt = o.f / sr; o.p += dt; if (o.p >= 1) o.p -= 1;
          const s = 2 * o.p - 1 - blep(o.p, dt);
          l += s * (1 - o.pan) * 0.5; r += s * (1 + o.pan) * 0.5;
        }
        const env = Math.min(1, t * 400) * Math.exp(-t * (2.5 / dur)) * Math.min(1, (dur - t) * 60);
        const vl = (fl.p(l) / oscs.length) * 3 * env * amp, vr = (fr.p(r) / oscs.length) * 3 * env * amp;
        music.L[idx] += vl; music.R[idx] += vr;
        send.L[idx] += vl * sendAmt; send.R[idx] += vr * sendAmt;
      }
    }
    function bassNote(t0, m, dur, amp = 0.5, cut = 900) {
      let p1 = det(m, 1), p2 = det(m, 2), ps = 0; const f = mtof(m), lp = new BQ().set('lp', cut, 1.2);
      voice(bass, t0, dur, (t) => {
        const d1 = (f * 1.008) / sr, d2 = (f * 0.992) / sr;
        p1 += d1; if (p1 >= 1) p1 -= 1; p2 += d2; if (p2 >= 1) p2 -= 1; ps += (TAU * f) / sr;
        const saw = 2 * p1 - 1 - blep(p1, d1) + 2 * p2 - 1 - blep(p2, d2);
        const env = Math.min(1, t * 500) * Math.min(1, (dur - t) * 150);
        return (Math.tanh(lp.p(saw) * 0.9) * 0.6 + Math.sin(ps) * 0.75) * env;
      }, amp);
    }
    function pad(t0, dur, notes, amp = 0.1, cut = 900, att = 0.4, rel = 0.6) {
      notes.forEach((m, ni) => {
        for (let v = 0; v < 3; v++) {
          let p = det(m, v + 10); const f = mtof(m + (v - 1) * 0.08), lp = new BQ().set('lp', cut, 0.7);
          voice(music, t0, dur, (t) => {
            const dt = f / sr; p += dt; if (p >= 1) p -= 1;
            const env = Math.min(1, t / att) * Math.min(1, (dur - t) / rel);
            return lp.p(2 * p - 1 - blep(p, dt)) * env;
          }, amp / notes.length, (v - 1) * 0.6 * (ni % 2 ? 1 : -1), 0.5);
        }
      });
    }
    function whoosh(t0, dur, amp = 0.4, up = true, pan0 = -0.6, pan1 = 0.6) {
      const f = new BQ();
      const i0 = Math.round(t0 * sr), n = Math.round(dur * sr);
      for (let i = 0; i < n; i++) {
        const idx = i0 + i; if (idx < 0 || idx >= N) continue;
        const k = i / n;
        if (i % 16 === 0) f.set('bp', up ? 300 * 18 ** k : 5000 / 16 ** k, 1.4);
        const v = f.p(rnd()) * Math.sin(Math.PI * k) ** 1.6 * amp * 2.2;
        const [gl, gr] = panG(pan0 + (pan1 - pan0) * k);
        sfx.L[idx] += v * gl; sfx.R[idx] += v * gr;
        send.L[idx] += v * gl * 0.3; send.R[idx] += v * gr * 0.3;
      }
    }
    function riser(t0, t1, amp = 0.35) {
      const f = new BQ(); let p = 0;
      const i0 = Math.round(t0 * sr), n = Math.round((t1 - t0) * sr);
      for (let i = 0; i < n; i++) {
        const idx = i0 + i; if (idx >= N) break;
        const k = i / n;
        if (i % 16 === 0) f.set('hp', 300 * 20 ** k, 0.9);
        const fr = 180 * 8 ** k, dt = fr / sr; p += dt; if (p >= 1) p -= 1;
        const v = (f.p(rnd()) * 0.8 + (2 * p - 1 - blep(p, dt)) * 0.18) * k * k * amp;
        sfx.L[idx] += v; sfx.R[idx] += v * (0.9 + 0.1 * Math.sin(k * 40));
      }
    }
    function boom(t0, amp = 0.9) {
      let ph = 0;
      voice(sfx, t0, 1.6, (t) => {
        ph += (TAU * (32 + 60 * Math.exp(-t * 7))) / sr;
        return Math.tanh(Math.sin(ph) * 2.2) * Math.exp(-t * 2.4) * Math.min(1, t * 1000);
      }, amp);
    }
    function crash(t0, amp = 0.35, dur = 1.6) {
      const fl = new BQ().set('hp', 4500, 0.7), fr = new BQ().set('hp', 4500, 0.7);
      const i0 = Math.round(t0 * sr), n = Math.round(dur * sr);
      for (let i = 0; i < n; i++) {
        const idx = i0 + i; if (idx >= N) break;
        const t = i / sr, e = Math.exp(-t * 2.8) * amp;
        const l = fl.p(rnd()) * e, r = fr.p(rnd()) * e;
        sfx.L[idx] += l; sfx.R[idx] += r; send.L[idx] += l * 0.4; send.R[idx] += r * 0.4;
      }
    }
    function zap(t0, f0, f1, dur = 0.2, amp = 0.25, pan = 0) {
      let ph = 0;
      voice(sfx, t0, dur, (t) => {
        const k = t / dur; ph += (TAU * f0 * (f1 / f0) ** k) / sr;
        const s = Math.sin(ph) + 0.35 * Math.sign(Math.sin(ph));
        return Math.round(s * 6) / 6 * (1 - k) ** 1.5 * Math.min(1, t * 2000);
      }, amp, pan, 0.25);
    }
    function beep(t0, f, dur, amp = 0.18, pan = 0) {
      let ph = 0;
      voice(sfx, t0, dur, (t) => {
        ph += (TAU * f) / sr;
        const env = Math.min(1, t * 1500) * Math.min(1, (dur - t) * 300);
        return (0.55 * Math.sign(Math.sin(ph)) + 0.45 * Math.sin(ph)) * env;
      }, amp, pan, 0.2);
    }
    function tick(t0, amp = 0.25, f = 4000, pan = 0) {
      const b = new BQ().set('bp', f, 2.2);
      voice(sfx, t0, 0.03, (t) => b.p(rnd()) * Math.exp(-t * 320) * 3, amp, pan);
    }
    function mouse(t0, amp = 0.5) { tick(t0, amp, 3200); tick(t0 + 0.065, amp * 0.6, 4200); }
    function noiseBurst(t0, dur, amp = 0.3, pan = 0) {
      let hold = 0, v = 0, cnt = 0;
      voice(sfx, t0, dur, (t) => {
        if (cnt-- <= 0) { v = rnd(); cnt = 2 + Math.floor(det(Math.floor(t * 300), 7) * 40); hold++; }
        const gate = det(Math.floor(t * 90), hold & 3) > 0.3 ? 1 : 0.2;
        return v * gate * Math.min(1, (dur - t) * 200);
      }, amp, pan);
    }

    // ------------------------------------------------------------ aranżacja
    const D = 62, F = 65, A = 69; // D4 F4 A4
    const Dm = [50, D, F, A], Bb = [46, 58, D, F, 70], Gm = [43, 55, 58, D, 67], Amaj = [45, 57, 61, 64, A];

    // Start: linia, otwarcie okna, pisanie adresu.
    voice(sfx, T.boot, 0.38, (t) => Math.sin(TAU * (200 * t + 900 * t * t * 1.3)) * Math.exp(-((t - 0.3) ** 2) * 60), 0.16, 0, 0.5);
    whoosh(T.windowOpen - 0.06, 0.45, 0.32, true, -0.2, 0.2);
    tick(T.windowOpen + 0.02, 0.4, 1800);
    const typed = 9;
    for (let j = 1; j <= typed; j++) tick(T.typing[0] + ((T.typing[1] - T.typing[0]) * j) / typed - 0.01, 0.3, 2800 + det(j, 3) * 2400, (det(j, 4) - 0.5) * 0.6);
    tick(T.typing[1] + 0.04, 0.5, 1600);
    pad(0.15, 4.4, [38, 50, 53, 57], 0.16, 650, 0.8, 0.3);
    pluck(T.pageLoad, 86, 0.12, 0.3); pluck(T.pageLoad + 0.06, 81, 0.1, -0.3);

    // Spokojny groove na stronie (od 1.0 s).
    for (let t = T.pageLoad; t < 6.0; t += beat) kick(t, 0.5);
    for (let t = T.pageLoad + beat; t < 6.0; t += beat * 2) clap(t, 0.3);
    for (let t = T.pageLoad; t < 6.0; t += beat / 4) {
      const pos = Math.round((t - T.pageLoad) / (beat / 4)) % 4;
      if (pos === 2) hat(t, 0.22, false, 0.25); else if (t >= T.toggles[0] - 0.01) hat(t, 0.09, false, -0.25);
    }
    const bassRoots = [38, 38, 34, 36];
    for (let t = T.pageLoad; t < 6.0; t += beat / 2) {
      const r = bassRoots[Math.floor(((t - T.pageLoad) % (beat * 4)) / beat)];
      bassNote(t, r, beat / 2 - 0.03, 0.2, 520);
    }
    whoosh(T.scroll[0] - 0.05, 0.45, 0.42, false, 0.5, -0.5);
    [T.navClick, ...T.toggles, T.calcClick].forEach((t) => mouse(t, 0.45));
    [74, 77, 81, 84, 86].forEach((m, i) => { pluck(T.toggles[i], m, 0.26, -0.4 + i * 0.2); tick(T.toggles[i] + 0.02, 0.12, 6000); });
    stab(T.calcClick, Dm, 0.18, 0.12, 4000, 900);
    voice(sfx, T.progress[0], T.progress[1] - T.progress[0] + 0.05, (t) => Math.sin(TAU * (300 * t + 1200 * t * t)) * (0.6 + 0.4 * Math.sin(TAU * 28 * t)), 0.07);
    noiseBurst(T.firstGlitch, 0.06, 0.25);

    // Awaria: błędy, szumy, przyspieszenie stopy, zatrzymanie taśmy.
    T.errors.forEach((t, i) => {
      const f = [880, 990, 784, 1046, 932, 1175, 830, 1318, 1244, 1397, 1480][i % 11];
      beep(t, f, 0.06, 0.13, (det(i, 1) - 0.5) * 1.2); beep(t + 0.065, f * 0.75, 0.08, 0.12, (det(i, 2) - 0.5) * 1.2);
      noiseBurst(t, 0.05 + det(i, 3) * 0.06, 0.22, (det(i, 4) - 0.5));
    });
    riser(4.6, 6.0, 0.28);
    for (let t = 5.5; t < 6.25; t += t < 5.75 ? beat / 4 : beat / 8) kick(t, 0.5 + (t - 5.5) * 0.6);
    for (let t = 5.75; t < 6.25; t += beat / 8) clap(t, 0.25 + (t - 5.75) * 0.6, (det(Math.round(t * 100)) - 0.5));
    // Kakofonia przy „FATAL ERROR”: brzęczenie w rytm migania obrazu.
    voice(sfx, T.meltdown[0], T.meltdown[1] - T.meltdown[0], (t) => {
      const fr = Math.floor((T.meltdown[0] + t) * 30) % 3;
      const s = Math.sign(Math.sin(TAU * 55 * t)) * 0.6 + rnd() * 0.5;
      return fr === 1 ? s * 0.25 : s;
    }, 0.24);

    // Restart w trybie Black Week.
    [86, 81, 77, 74, 69].forEach((m, i) => pluck(T.reboot + i * 0.04, m, 0.17, (i - 2) * 0.3, 0.6));
    {
      let p = 0, ps = 0; const lp = new BQ();
      voice(bass, T.reboot, T.dive[1] - T.reboot, (t) => {
        const k = t / (T.dive[1] - T.reboot); const f = mtof(26) * (1 + k * 0.5);
        lp.set('lp', 150 + 900 * k * k, 1.5);
        const dt = f / sr; p += dt; if (p >= 1) p -= 1; ps += (TAU * f) / sr;
        return (lp.p(2 * p - 1) * 0.5 + Math.sin(ps)) * Math.min(1, t * 8) * (0.4 + 0.6 * k);
      }, 0.38);
    }
    for (let t = T.reboot + 0.1; t < T.stamp; t += beat / 4) hat(t, 0.1 + 0.08 * ((Math.round(t / (beat / 4)) % 2)), false, 0.3);
    T.drops.forEach((t, i) => {
      zap(t, 1900 - i * 160, 140, 0.24, 0.22, -0.5 + i * 0.25);
      kick(t, 0.45);
      tick(t + 0.05, 0.25, 2200);
    });
    // Licznik sumy: tyknięcie przy każdej zmianie cyfry setek.
    {
      const steps = Math.round((C.items.reduce((s, it) => s + it.price, 0) * C.discount) / 100 / 100);
      const ease = (k) => (k < 0.5 ? 4 * k * k * k : 1 - (-2 * k + 2) ** 3 / 2);
      let last = -1;
      for (let i = 0; i <= 400; i++) {
        const k = i / 400, v = Math.floor(ease(k) * steps);
        if (v !== last) { last = v; const tt = T.totalDrop[0] + k * (T.totalDrop[1] - T.totalDrop[0]); tick(tt, 0.13, 3600 - 2400 * k, (det(v) - 0.5) * 0.8); }
      }
    }
    kick(T.stamp, 1.0, true); clap(T.stamp, 0.6); crash(T.stamp, 0.18, 0.8); noiseBurst(T.stamp, 0.07, 0.2);
    riser(T.stamp, T.dive[1], 0.5);
    voice(sfx, T.dive[0], T.dive[1] - T.dive[0], (t) => {
      const k = t / (T.dive[1] - T.dive[0]);
      return Math.sin(TAU * (60 * t + 900 * k * k * t)) * k * k;
    }, 0.18);

    // DROP: Black Week.
    const drop = T.drop;
    boom(drop, 0.85); crash(drop, 0.4); kick(drop, 1.1, true);
    for (let t = drop + beat; t < T.end; t += beat) kick(t, 1.0);
    for (let t = drop + beat; t < T.end; t += beat * 2) clap(t, 0.7);
    for (let t = drop; t < T.end; t += beat / 4) {
      const pos = Math.round((t - drop) / (beat / 4)) % 4;
      hat(t, pos === 2 ? 0.34 : 0.15, pos === 2 && det(Math.round(t * 8)) > 0.6, pos % 2 ? 0.35 : -0.35);
    }
    const prog = (t) => (t < T.percent ? 38 : t < T.cuts[0] ? 34 : t < T.cuts[2] ? 31 : 33);
    for (let t = drop; t < T.end - 0.001; t += beat / 4) {
      const pos = Math.round((t - drop) / (beat / 4)) % 8;
      const r = prog(t) + ([0, 0, 12, 0, 0, 12, 0, 10][pos] || 0);
      bassNote(t, r, beat / 4 - 0.015, 0.42, 700 + 600 * (pos % 2));
    }
    stab(T.black, Dm, 0.22, 0.26); stab(T.week, Dm.map((m) => m + 12), 0.2, 0.2);
    stab(T.marquee, Dm, 0.14, 0.18); stab(T.flip, [50, 62, 65, 69, 74], 0.16, 0.2);
    boom(T.percent, 0.7); crash(T.percent, 0.3); stab(T.percent, Bb, 0.42, 0.3, 9000, 1200);
    T.pulses.forEach((t) => stab(t, Bb, 0.14, 0.18));
    // Wirujące cyfry: tyknięcie przy każdej zmianie cyfry (ta sama krzywa co w obrazie).
    [1, 2].forEach((i) => {
      const stop = T.percent + 0.1 + i * 0.07;
      let last = -1;
      for (let s = 0; s <= 300; s++) {
        const k = s / 300, pos = Math.floor(30 * (1 - k) ** 3);
        if (pos !== last) { last = pos; tick(T.percent + k * (stop - T.percent), 0.12, 3800 + i * 1200, i === 1 ? -0.4 : 0.4); }
      }
    });
    T.cuts.forEach((t, i) => { whoosh(t - 0.04, 0.16, 0.38, i % 2 === 0, i % 2 ? 0.7 : -0.7, i % 2 ? -0.7 : 0.7); stab(t, i < 2 ? Gm : Amaj, 0.18, 0.24); });
    stab(T.fall, Amaj, 0.3, 0.24, 6000, 600);
    {
      let ph = 0;
      voice(sfx, T.fall, T.end - T.fall, (t) => { const k = t / (T.end - T.fall); ph += (TAU * 1400 * (60 / 1400) ** k) / sr; return (2 * ((ph / TAU) % 1) - 1) * (1 - k * 0.5); }, 0.1, 0, 0.2);
    }
    for (let t = T.fall + beat / 2; t < T.end; t += beat / 8) clap(t, 0.2 + (t - T.fall) * 0.9);

    // Plansza końcowa.
    boom(T.end, 0.8); crash(T.end, 0.38, 2); kick(T.end, 1.1, true);
    stab(T.end, Dm.concat([74]), 1.3, 0.24, 6000, 1400, 0.6);
    pad(T.end, C.duration - T.end, [38, 50, 57, 62, 65], 0.2, 1500, 0.05, 0.6);
    [86, 89, 93].forEach((m, i) => pluck(T.end + 0.05 + i * 0.05, m, 0.1, (i - 1) * 0.5));
    T.endLines.forEach((t, i) => pluck(t, [81, 86, 89][i], 0.13, (i - 1) * 0.4));
    for (let t = T.end + beat; t < T.outroGlitch; t += beat) kick(t, 0.55);
    for (let t = T.end; t < T.outroGlitch; t += beat / 2) hat(t + beat / 4, 0.16, false, 0.3);
    voice(sfx, T.ctaIn, 0.12, (t) => Math.sin(TAU * (600 * t + 1500 * t * t)) * Math.exp(-t * 30), 0.2, 0, 0.3);
    mouse(T.ctaClick, 0.5); pluck(T.ctaClick + 0.02, 86, 0.2, -0.2); pluck(T.ctaClick + 0.08, 93, 0.16, 0.2);
    noiseBurst(T.outroGlitch, 0.08, 0.25, -0.3); noiseBurst(T.outroGlitch + 0.1, 0.05, 0.18, 0.3);
    zap(T.outroGlitch, 2400, 300, 0.15, 0.12);

    // ------------------------------------------------------------ obróbka
    // Glitch: w trakcie awarii muzyka zacina się, kruszy i urywa w kawałkach 1/32 nuty.
    const chunk = beat / 8;
    function glitchBus(b) {
      const src = { L: b.L.slice(), R: b.R.slice() };
      const forced = [T.firstGlitch, ...T.errors];
      for (let t = T.firstGlitch; t < T.meltdown[0]; t += chunk) {
        const ci = Math.round(t / chunk);
        const intensity = t < T.errors[0] ? 0 : 0.25 + 0.6 * ((t - T.errors[0]) / (T.meltdown[0] - T.errors[0]));
        const hit = forced.some((f) => t >= f - 0.001 && t < f + chunk * 1.5);
        const r = det(ci, 77);
        if (!hit && r > intensity) continue;
        const mode = hit ? 0 : Math.floor(det(ci, 78) * 4);
        const i0 = Math.round(t * sr), n = Math.round(chunk * sr), rep = Math.max(64, Math.round(n / (2 + Math.floor(det(ci, 79) * 6))));
        for (let i = 0; i < n && i0 + i < N; i++) {
          const idx = i0 + i;
          for (const ch of ['L', 'R']) {
            let v;
            if (mode === 0) v = src[ch][i0 + (i % rep)];
            else if (mode === 1) { const hold = 12; v = Math.round(src[ch][idx - (i % hold)] * 5) / 5; }
            else if (mode === 2) v = src[ch][i0 + n - 1 - i] * 0.9;
            else v = src[ch][idx] * (Math.floor(i / 300) % 2 ? 0 : 1);
            b[ch][idx] = v;
          }
        }
      }
      // Zatrzymanie taśmy: odczyt zwalnia do zera.
      const a = Math.round(T.meltdown[0] * sr), n = Math.round((T.meltdown[1] - T.meltdown[0]) * sr);
      const src2 = { L: b.L.slice(), R: b.R.slice() };
      let pos = a;
      for (let i = 0; i < n && a + i < N; i++) {
        const k = i / n, rate = (1 - k) ** 1.5;
        pos += rate;
        const p0 = Math.floor(pos), fr = pos - p0;
        for (const ch of ['L', 'R']) b[ch][a + i] = (src2[ch][p0] * (1 - fr) + src2[ch][p0 + 1] * fr) * (1 - k * 0.3);
      }
      for (let i = a + n; i < Math.round(T.reboot * sr); i++) { b.L[i] = 0; b.R[i] = 0; }
    }
    [drums, bass, music].forEach(glitchBus);

    // Pogłos (Freeverb w uproszczeniu).
    function reverb(inp) {
      const sc = sr / 44100;
      const combs = [1116, 1188, 1277, 1356, 1422, 1491, 1557, 1617], aps = [556, 441, 341, 225];
      const out = { L: new Float32Array(N), R: new Float32Array(N) };
      ['L', 'R'].forEach((ch, ci) => {
        const x = inp[ch], y = out[ch];
        const cs = combs.map((d) => ({ buf: new Float32Array(Math.round((d + ci * 23) * sc)), i: 0, f: 0 }));
        const as = aps.map((d) => ({ buf: new Float32Array(Math.round((d + ci * 23) * sc)), i: 0 }));
        for (let n = 0; n < N; n++) {
          let s = 0;
          for (const c of cs) { const o = c.buf[c.i]; c.f = o * 0.72 + c.f * 0.28; c.buf[c.i] = x[n] * 0.015 + c.f * 0.82; c.i = (c.i + 1) % c.buf.length; s += o; }
          for (const a of as) { const o = a.buf[a.i]; a.buf[a.i] = s + o * 0.5; a.i = (a.i + 1) % a.buf.length; s = o - s; }
          y[n] = s;
        }
      });
      return out;
    }
    const wet = reverb(send);

    // Uciszanie basu i syntezatorów przy każdej stopie (sidechain).
    const kicks = [];
    for (let t = T.pageLoad; t < 6.0; t += beat) kicks.push(t);
    for (let t = T.drop; t < T.end; t += beat) kicks.push(t);
    kicks.push(T.end, T.stamp, ...T.drops);
    kicks.sort((a, b) => a - b);

    const left = new Float32Array(N), right = new Float32Array(N);
    let ki = 0;
    for (let i = 0; i < N; i++) {
      const t = i / sr;
      while (ki + 1 < kicks.length && kicks[ki + 1] <= t) ki++;
      const dk = t - kicks[ki];
      const duck = dk >= 0 && dk < 0.3 ? 1 - 0.65 * Math.exp(-dk * 14) : 1;
      let l = drums.L[i] + (bass.L[i] + music.L[i]) * duck + sfx.L[i] + wet.L[i] * 1.6 * duck;
      let r = drums.R[i] + (bass.R[i] + music.R[i]) * duck + sfx.R[i] + wet.R[i] * 1.6 * duck;
      // Cisza tuż przed dropem.
      const gate = t >= T.dive[1] - 0.01 && t < T.drop ? clamp((T.dive[1] + 0.01 - t) / 0.02) : 1;
      left[i] = l * gate; right[i] = r * gate;
    }
    // Mastering: normalizacja, miękkie ograniczenie szczytów, wyciszenie końca.
    let peak = 0;
    for (let i = 0; i < N; i++) peak = Math.max(peak, Math.abs(left[i]), Math.abs(right[i]));
    const pre = 1.25 / peak, drive = Math.tanh(1.25);
    peak = 0;
    for (let i = 0; i < N; i++) {
      left[i] = Math.tanh(left[i] * pre) / drive; right[i] = Math.tanh(right[i] * pre) / drive;
      peak = Math.max(peak, Math.abs(left[i]), Math.abs(right[i]));
    }
    const g = 0.891 / peak, fadeIn = Math.round(0.004 * sr), fadeOut = Math.round(0.35 * sr);
    for (let i = 0; i < N; i++) {
      let e = g;
      if (i < fadeIn) e *= i / fadeIn;
      if (i > N - fadeOut) e *= (N - i) / fadeOut;
      left[i] *= e; right[i] *= e;
    }
    return { left, right, sampleRate: sr };
  }

  function toWav(a) {
    const n = a.left.length, buf = new ArrayBuffer(44 + n * 4), v = new DataView(buf);
    const str = (o, s) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
    str(0, 'RIFF'); v.setUint32(4, 36 + n * 4, true); str(8, 'WAVE'); str(12, 'fmt ');
    v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 2, true); v.setUint32(24, a.sampleRate, true);
    v.setUint32(28, a.sampleRate * 4, true); v.setUint16(32, 4, true); v.setUint16(34, 16, true); str(36, 'data'); v.setUint32(40, n * 4, true);
    for (let i = 0; i < n; i++) {
      v.setInt16(44 + i * 4, Math.round(clamp(a.left[i], -1, 1) * 32767), true);
      v.setInt16(46 + i * 4, Math.round(clamp(a.right[i], -1, 1) * 32767), true);
    }
    return buf;
  }

  const API = { render, toWav };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  else root.KWAudio = API;
})(this);
