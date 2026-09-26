'use strict';

/* ---------- Dźwięk: krótkie efekty syntezowane w WebAudio (bez plików) ---------- */
const AUDIO = (() => {
  let ac = null, master = null, noise = null, muted = false;
  const last = {};
  try { muted = localStorage.getItem('martwy-szlak-mute') === '1'; } catch (e) { /* brak dostępu do pamięci */ }
  function init() {
    if (ac) { if (ac.state === 'suspended') ac.resume(); return; }
    try {
      ac = new (window.AudioContext || window.webkitAudioContext)();
      master = ac.createGain(); master.gain.value = muted ? 0 : 0.45; master.connect(ac.destination);
      const len = Math.floor(ac.sampleRate * 0.6);
      noise = ac.createBuffer(1, len, ac.sampleRate);
      const d = noise.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    } catch (e) { ac = null; }
  }
  function env(g, t, a, peak, dec) { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + dec); }
  function nz(t, dur, type, freq, q, peak, dec) {
    const s = ac.createBufferSource(); s.buffer = noise; s.playbackRate.value = 0.85 + Math.random() * 0.3;
    const f = ac.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = ac.createGain(); env(g, t, 0.003, peak, dec);
    s.connect(f); f.connect(g); g.connect(master); s.start(t, Math.random() * 0.2, dur);
  }
  function tone(t, type, f0, f1, peak, dec, a = 0.005) {
    const o = ac.createOscillator(); o.type = type; o.frequency.setValueAtTime(f0, t);
    if (f1) o.frequency.exponentialRampToValueAtTime(f1, t + a + dec);
    const g = ac.createGain(); env(g, t, a, peak, dec);
    o.connect(g); g.connect(master); o.start(t); o.stop(t + a + dec + 0.05);
  }
  const SFX = {
    shot0: t => nz(t, 0.08, 'bandpass', 1800, 1.2, 0.16, 0.06),
    shot1: t => nz(t, 0.06, 'bandpass', 2400, 1.5, 0.11, 0.045),
    shot2: t => { nz(t, 0.09, 'bandpass', 1500, 1, 0.17, 0.07); tone(t, 'square', 180, 60, 0.04, 0.05); },
    shot3: t => nz(t, 0.05, 'bandpass', 2000, 1.4, 0.1, 0.04),
    flame: t => nz(t, 0.3, 'lowpass', 900, 0.7, 0.1, 0.25),
    hurt: t => { tone(t, 'sine', 160, 60, 0.22, 0.14); nz(t, 0.1, 'lowpass', 600, 1, 0.12, 0.08); },
    hurtBig: t => { tone(t, 'sine', 120, 40, 0.35, 0.3); nz(t, 0.25, 'lowpass', 500, 1, 0.25, 0.2); },
    gain: t => { tone(t, 'triangle', 520, 0, 0.16, 0.08); tone(t + 0.07, 'triangle', 780, 0, 0.16, 0.1); tone(t + 0.14, 'triangle', 1040, 0, 0.14, 0.14); },
    gate: t => { tone(t, 'sine', 1200, 1600, 0.1, 0.2); tone(t, 'sine', 1800, 0, 0.05, 0.3); },
    glass: t => { nz(t, 0.3, 'highpass', 3000, 0.8, 0.22, 0.25); tone(t, 'sine', 2600, 0, 0.04, 0.2); },
    ice: t => { nz(t, 0.35, 'bandpass', 2600, 0.9, 0.3, 0.3); nz(t, 0.2, 'lowpass', 400, 1, 0.22, 0.15); },
    safe: t => { tone(t, 'square', 320, 280, 0.08, 0.3); tone(t + 0.05, 'triangle', 1400, 0, 0.09, 0.2); tone(t + 0.15, 'triangle', 1900, 0, 0.09, 0.2); },
    thud: t => { tone(t, 'sine', 90, 40, 0.4, 0.25); nz(t, 0.15, 'lowpass', 300, 1, 0.25, 0.1); },
    weapon: t => { [0, 0.06, 0.12, 0.18].forEach((d, i) => tone(t + d, 'square', 440 * Math.pow(1.26, i), 0, 0.07, 0.12)); },
    charge: t => tone(t, 'sawtooth', 200, 1200, 0.07, 0.45, 0.02),
    roar: t => { tone(t, 'sawtooth', 110, 55, 0.18, 0.9, 0.05); nz(t, 0.9, 'lowpass', 500, 2, 0.16, 0.8); },
    slam: t => { tone(t, 'sine', 70, 30, 0.5, 0.5); nz(t, 0.4, 'lowpass', 400, 1, 0.4, 0.35); },
    warn: t => { tone(t, 'square', 880, 0, 0.07, 0.1); tone(t + 0.18, 'square', 880, 0, 0.07, 0.1); },
    throw: t => nz(t, 0.3, 'bandpass', 700, 2, 0.13, 0.25),
    splash: t => nz(t, 0.35, 'lowpass', 1200, 1, 0.22, 0.3),
    boom: t => { tone(t, 'sine', 100, 35, 0.3, 0.35); nz(t, 0.3, 'lowpass', 800, 1, 0.25, 0.25); },
    bossDown: t => { tone(t, 'sine', 80, 25, 0.6, 1.2); nz(t, 1, 'lowpass', 600, 1, 0.45, 0.9); [0, 0.15, 0.3].forEach((d, i) => tone(t + 0.4 + d, 'triangle', 523 * Math.pow(1.26, i), 0, 0.13, 0.3)); },
  };
  // Minimalne odstępy, żeby seria z minigunu nie zamieniła się w szum.
  const GAP = { shot0: 0.07, shot1: 0.06, shot2: 0.07, shot3: 0.05, flame: 0.22, hurt: 0.08, glass: 0.05, gate: 0.1, boom: 0.06, gain: 0.1 };
  return {
    init,
    play(name) {
      if (!ac || muted) return;
      const fn = SFX[name];
      if (!fn) return;
      const now = ac.currentTime, gap = GAP[name] ?? 0.03;
      if (last[name] && now - last[name] < gap) return;
      last[name] = now;
      try { fn(now + 0.005); } catch (e) { /* pomijamy pojedynczy dźwięk */ }
    },
    toggle() {
      muted = !muted;
      try { localStorage.setItem('martwy-szlak-mute', muted ? '1' : '0'); } catch (e) { /* brak dostępu do pamięci */ }
      if (master) master.gain.value = muted ? 0 : 0.45;
      return muted;
    },
    get muted() { return muted; },
  };
})();
