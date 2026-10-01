/*
 * ABDUZIU × Tripo showreel — soundtrack (Web Audio / OfflineAudioContext), 63.5 s, 120 BPM (bar = 2 s).
 * Instruments come from the feature reel (reel-features/audio.js); the arrangement follows the cuts:
 *   intro pad + UFO hum → lo-fi blockout beat → asset drive → TRIPO drop and funk groove
 *   → meme tamborzão → laid-back CTA. Every cut gets a whoosh/impact, every asset a pop.
 * mode 'music' = music + sfx, 'sfx' = only the sound design (for a voice-over-first edit).
 *
 *   const wav = await renderShowreelAudio('music');   // ArrayBuffer (WAV)
 */
async function renderShowreelAudio(mode = 'music') {
  const LEN = 63.5;
  const SR = 48000;
  const BPM = 120;
  const B = 60 / BPM; // beat
  const S = B / 4; // 16th
  const ctx = new OfflineAudioContext(2, Math.ceil(SR * LEN), SR);

  const master = ctx.createGain();
  master.gain.value = 0.5;
  master.gain.setValueAtTime(0.5, LEN - 0.35);
  master.gain.linearRampToValueAtTime(0, LEN - 0.01);
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -16;
  comp.ratio.value = 3.5;
  comp.attack.value = 0.004;
  comp.release.value = 0.12;
  const trim = ctx.createGain();
  trim.gain.value = 0.6;
  const soft = ctx.createWaveShaper();
  const sc = new Float32Array(2048);
  for (let i = 0; i < 2048; i++) sc[i] = Math.tanh(((i / 2047) * 2 - 1) * 1.4) / Math.tanh(1.4);
  soft.curve = sc;
  master.connect(comp).connect(trim).connect(soft).connect(ctx.destination);

  // music bus with sidechain-style ducking on impacts
  const music = ctx.createGain();
  music.connect(master);
  const duck = (t, depth = 0.45, rel = 0.35) => {
    music.gain.setValueAtTime(1, Math.max(0, t - 0.005));
    music.gain.linearRampToValueAtTime(depth, t + 0.01);
    music.gain.linearRampToValueAtTime(1, t + rel);
  };

  const irLen = SR * 2.2;
  const ir = ctx.createBuffer(2, irLen, SR);
  for (let c = 0; c < 2; c++) {
    const d = ir.getChannelData(c);
    for (let i = 0; i < irLen; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / irLen, 3.4);
  }
  const verb = ctx.createConvolver();
  verb.buffer = ir;
  const verbIn = ctx.createGain();
  verbIn.gain.value = 0.35;
  verbIn.connect(verb).connect(master);

  const noiseBuf = ctx.createBuffer(1, SR * 2, SR);
  {
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  const noise = (t, dur) => {
    const s = ctx.createBufferSource();
    s.buffer = noiseBuf;
    s.loop = true;
    s.start(t, Math.random());
    s.stop(t + dur + 0.05);
    return s;
  };
  const env = (g, t, a, peak, d) => {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
  };
  const out = (node, gain = 1, rev = 0, pan = 0, bus = master) => {
    const g = ctx.createGain();
    g.gain.value = gain;
    const p = ctx.createStereoPanner();
    p.pan.value = pan;
    node.connect(g).connect(p).connect(bus);
    if (rev) {
      const r = ctx.createGain();
      r.gain.value = rev;
      p.connect(r).connect(verbIn);
    }
    return g;
  };
  let mus = (node, gain = 1, rev = 0, pan = 0) => out(node, gain, rev, pan, music);
  const midi = (n) => 440 * Math.pow(2, (n - 69) / 12);
  const osc = (type, f, t, dur) => {
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.value = f;
    o.start(t);
    o.stop(t + dur + 0.05);
    return o;
  };

  // ─── drums
  function kick(t, v = 1) {
    const o = ctx.createOscillator();
    o.frequency.setValueAtTime(150, t);
    o.frequency.exponentialRampToValueAtTime(45, t + 0.1);
    const g = ctx.createGain();
    env(g, t, 0.002, 0.95 * v, 0.26);
    o.connect(g);
    mus(g, 0.95);
    o.start(t);
    o.stop(t + 0.32);
    // click
    const n = noise(t, 0.02);
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 3000;
    const ng = ctx.createGain();
    env(ng, t, 0.001, 0.2 * v, 0.015);
    n.connect(hp).connect(ng);
    mus(ng, 0.6);
  }
  /** Tamborzão tom: pitched drum body with a slap. */
  function tom(t, f, v = 1) {
    const o = ctx.createOscillator();
    o.frequency.setValueAtTime(f * 1.6, t);
    o.frequency.exponentialRampToValueAtTime(f, t + 0.04);
    const g = ctx.createGain();
    env(g, t, 0.002, 0.5 * v, 0.16);
    o.connect(g);
    mus(g, 0.8, 0.08, (f % 7) / 10 - 0.3);
    o.start(t);
    o.stop(t + 0.22);
    const n = noise(t, 0.05);
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = f * 6;
    bp.Q.value = 2;
    const ng = ctx.createGain();
    env(ng, t, 0.001, 0.22 * v, 0.04);
    n.connect(bp).connect(ng);
    mus(ng, 0.7);
  }
  function clap(t, v = 1) {
    for (const d of [0, 0.011, 0.022]) {
      const n = noise(t + d, 0.16);
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 1500;
      bp.Q.value = 0.9;
      const g = ctx.createGain();
      env(g, t + d, 0.001, 0.36 * v, d === 0.022 ? 0.14 : 0.02);
      n.connect(bp).connect(g);
      mus(g, 0.7, 0.2);
    }
  }
  function hat(t, v = 1, open = false) {
    const n = noise(t, open ? 0.2 : 0.05);
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 8000;
    const g = ctx.createGain();
    env(g, t, 0.002, 0.11 * v, open ? 0.16 : 0.03);
    n.connect(hp).connect(g);
    mus(g, 0.6, 0, 0.3);
  }
  function bass808(t, note, dur, v = 1) {
    const o = ctx.createOscillator();
    o.frequency.setValueAtTime(midi(note) * 1.5, t);
    o.frequency.exponentialRampToValueAtTime(midi(note), t + 0.03);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.55 * v, t + 0.005);
    g.gain.setValueAtTime(0.5 * v, t + dur * 0.7);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    const sh = ctx.createWaveShaper();
    const c = new Float32Array(1024);
    for (let i = 0; i < 1024; i++) c[i] = Math.tanh(((i / 1023) * 2 - 1) * 2.2);
    sh.curve = c;
    o.connect(sh).connect(g);
    mus(g, 0.75);
    o.start(t);
    o.stop(t + dur + 0.05);
  }
  /** Short brassy stab chord (the funk "hey!"). */
  function stab(t, notes, v = 1, dur = 0.16) {
    for (const n of notes) {
      for (const det of [-9, 9]) {
        const o = osc('sawtooth', midi(n), t, dur);
        o.detune.value = det;
        const lp = ctx.createBiquadFilter();
        lp.type = 'lowpass';
        lp.frequency.setValueAtTime(4200, t);
        lp.frequency.exponentialRampToValueAtTime(700, t + dur);
        const g = ctx.createGain();
        env(g, t, 0.004, 0.05 * v, dur);
        o.connect(lp).connect(g);
        mus(g, 1, 0.22, det > 0 ? 0.35 : -0.35);
      }
    }
  }
  function pluck(t, note, v = 1, pan = 0, bus = 'mus') {
    const f = midi(note);
    for (const [mul, amp, dec] of [[1, 1, 0.3], [2, 0.35, 0.12], [4, 0.12, 0.05]]) {
      const o = osc('sine', f * mul, t, dec);
      const g = ctx.createGain();
      env(g, t, 0.002, 0.16 * v * amp, dec);
      o.connect(g);
      (bus === 'mus' ? mus : out)(g, 1, 0.3, pan);
    }
  }
  function pad(t, notes, dur, v = 1) {
    for (const n of notes) {
      for (const det of [-7, 7]) {
        const o = osc('sawtooth', midi(n), t, dur);
        o.detune.value = det;
        const lp = ctx.createBiquadFilter();
        lp.type = 'lowpass';
        lp.frequency.setValueAtTime(700, t);
        lp.frequency.linearRampToValueAtTime(2600, t + dur);
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.linearRampToValueAtTime(0.035 * v, t + Math.min(0.5, dur * 0.3));
        g.gain.setValueAtTime(0.035 * v, t + dur * 0.8);
        g.gain.linearRampToValueAtTime(0.0001, t + dur);
        o.connect(lp).connect(g);
        mus(g, 1, 0.5, det > 0 ? 0.35 : -0.35);
      }
    }
  }

  // ─── fx
  function whoosh(t, dur, f0 = 400, f1 = 5000, v = 0.3) {
    const n = noise(t, dur);
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.value = 1.2;
    bp.frequency.setValueAtTime(f0, t);
    bp.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(v, t + dur * 0.9);
    g.gain.linearRampToValueAtTime(0.0001, t + dur);
    n.connect(bp).connect(g);
    out(g, 0.9, 0.2);
  }
  function crash(t, v = 1) {
    const n = noise(t, 1.4);
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 5000;
    const g = ctx.createGain();
    env(g, t, 0.002, 0.16 * v, 1.2);
    n.connect(hp).connect(g);
    out(g, 0.8, 0.35, 0.2);
  }
  function impact(t, v = 1) {
    // sub drop + body + crash: the cut hit
    const o = ctx.createOscillator();
    o.frequency.setValueAtTime(110, t);
    o.frequency.exponentialRampToValueAtTime(32, t + 0.5);
    const g = ctx.createGain();
    env(g, t, 0.002, 0.9 * v, 0.55);
    o.connect(g);
    out(g, 0.8, 0.2);
    o.start(t);
    o.stop(t + 0.6);
    const n = noise(t, 0.3);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(5000, t);
    lp.frequency.exponentialRampToValueAtTime(300, t + 0.3);
    const ng = ctx.createGain();
    env(ng, t, 0.001, 0.35 * v, 0.25);
    n.connect(lp).connect(ng);
    out(ng, 0.7, 0.3);
    crash(t, v);
    duck(t);
  }
  function boom(t, v = 1) {
    const o = ctx.createOscillator();
    o.frequency.setValueAtTime(90, t);
    o.frequency.exponentialRampToValueAtTime(28, t + 0.8);
    const g = ctx.createGain();
    env(g, t, 0.003, 0.8 * v, 0.8);
    o.connect(g);
    out(g, 0.8, 0.25);
    o.start(t);
    o.stop(t + 1);
    const n = noise(t, 0.6);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(3000, t);
    lp.frequency.exponentialRampToValueAtTime(200, t + 0.6);
    const ng = ctx.createGain();
    env(ng, t, 0.002, 0.45 * v, 0.55);
    n.connect(lp).connect(ng);
    out(ng, 0.7, 0.3, (Math.random() - 0.5) * 0.8);
  }
  function emp(t) {
    const o = ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(120, t - 0.35);
    o.frequency.exponentialRampToValueAtTime(1800, t);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t - 0.35);
    g.gain.exponentialRampToValueAtTime(0.16, t - 0.02);
    g.gain.linearRampToValueAtTime(0.0001, t);
    o.connect(g);
    out(g, 0.8, 0.3);
    o.start(t - 0.35);
    o.stop(t + 0.05);
    const z = ctx.createOscillator();
    z.type = 'square';
    z.frequency.setValueAtTime(2400, t);
    z.frequency.exponentialRampToValueAtTime(60, t + 0.5);
    const zg = ctx.createGain();
    env(zg, t, 0.002, 0.26, 0.5);
    z.connect(zg);
    out(zg, 0.6, 0.4);
    z.start(t);
    z.stop(t + 0.6);
    boom(t, 1.3);
    duck(t, 0.4, 0.5);
  }
  function pop(t, note, big, v = 1) {
    const f = midi(note);
    const o = ctx.createOscillator();
    o.frequency.setValueAtTime(f * 0.55, t);
    o.frequency.exponentialRampToValueAtTime(f, t + 0.035);
    const g = ctx.createGain();
    env(g, t, 0.003, 0.18 * v, big ? 0.2 : 0.09);
    o.connect(g);
    out(g, 1, 0.18, (Math.random() - 0.5) * 0.6);
    o.start(t);
    o.stop(t + 0.3);
    if (big) {
      const s = ctx.createOscillator();
      s.frequency.setValueAtTime(170, t);
      s.frequency.exponentialRampToValueAtTime(45, t + 0.2);
      const sg = ctx.createGain();
      env(sg, t, 0.003, 0.3 * v, 0.2);
      s.connect(sg);
      out(sg, 0.8);
      s.start(t);
      s.stop(t + 0.3);
    }
  }
  function chime(t, up = 0) {
    [69, 72, 76, 81].forEach((n, i) => pluck(t + i * 0.045, n + 12 + up, 1.1, i % 2 ? 0.3 : -0.3, 'fx'));
  }
  function sparkle(t, v = 1) {
    // secret found: glittery run up
    [81, 84, 88, 91, 93, 96].forEach((n, i) => pluck(t + i * 0.03, n, 0.9 * v, i % 2 ? 0.4 : -0.4, 'fx'));
  }
  function gulp(t) {
    const o = ctx.createOscillator();
    o.frequency.setValueAtTime(240, t);
    o.frequency.exponentialRampToValueAtTime(50, t + 0.35);
    const g = ctx.createGain();
    env(g, t, 0.004, 0.85, 0.4);
    o.connect(g);
    out(g, 0.9, 0.2);
    o.start(t);
    o.stop(t + 0.5);
    [81, 84, 88, 93].forEach((n, i) => pluck(t + 0.08 + i * 0.045, n, 1.1, i % 2 ? 0.35 : -0.35, 'fx'));
    duck(t, 0.55, 0.3);
  }
  function shing(t, k) {
    // skin swap: bright metallic ring + air
    const f = midi(84 + k * 2);
    for (const [m, a] of [[1, 1], [2.76, 0.45], [5.4, 0.25]]) {
      const o = osc('sine', f * m, t, 0.5);
      const g = ctx.createGain();
      env(g, t, 0.002, 0.09 * a, 0.45);
      o.connect(g);
      out(g, 1, 0.4, k % 2 ? 0.3 : -0.3);
    }
    whoosh(t - 0.12, 0.16, 2000, 9000, 0.12);
  }
  function hum(t0, t1, f0 = 110, f1 = 110, v = 0.04) {
    const o = osc('sawtooth', f0, t0, t1 - t0);
    o.frequency.setValueAtTime(f0, t0);
    o.frequency.linearRampToValueAtTime(f1, t1);
    const lfo = osc('sine', 5.5, t0, t1 - t0);
    const lg = ctx.createGain();
    lg.gain.value = 4;
    lfo.connect(lg).connect(o.detune);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 700;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(v, t0 + 0.3);
    g.gain.setValueAtTime(v, t1 - 0.2);
    g.gain.linearRampToValueAtTime(0.0001, t1);
    o.connect(lp).connect(g);
    out(g, 1, 0.2);
  }
  function siren(t0, t1, v = 0.04) {
    const o = osc('triangle', 700, t0, t1 - t0);
    for (let t = t0; t < t1; t += 0.8) {
      o.frequency.setValueAtTime(620, t);
      o.frequency.linearRampToValueAtTime(980, t + 0.4);
      o.frequency.linearRampToValueAtTime(620, t + 0.8);
    }
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(v, t0 + 0.2);
    g.gain.setValueAtTime(v, t1 - 0.2);
    g.gain.linearRampToValueAtTime(0.0001, t1);
    o.connect(g);
    out(g, 1, 0.4, 0.4);
  }

  if (mode === 'sfx') music.disconnect();
  // the lo-fi blockout section runs its drums through a closed low-pass
  const lofi = ctx.createBiquadFilter();
  lofi.type = 'lowpass';
  lofi.frequency.value = 900;
  lofi.Q.value = 0.8;
  lofi.connect(music);
  let BUS = music;

  const CH = [
    [57, 60, 64], // Am
    [53, 57, 60], // F
    [60, 64, 67], // C
    [55, 59, 62], // G
  ];
  const ROOT = [45, 41, 48, 43];
  const PENTA = [69, 72, 74, 76, 79, 81, 84, 86, 88, 91, 93, 96, 98, 100, 103];

  function bar(t0, style, k) {
    const ch = CH[k % 4];
    const root = ROOT[k % 4];
    for (let s = 0; s < 16; s++) {
      const t = t0 + s * S;
      if (t >= LEN - 0.05) break;
      if (style === 'funk') {
        // tamborzão: kick / tom conversation, clap on 2 and 4
        if ([0, 3, 8, 11].includes(s)) kick(t, s === 0 ? 1 : 0.85);
        if ([6, 7, 14].includes(s)) tom(t, s === 7 ? 196 : 147, 0.9);
        if ([10, 13].includes(s)) tom(t, 110, 0.75);
        if (s === 4 || s === 12) clap(t, 0.9);
        if (s % 2 === 0) hat(t, s % 4 === 2 ? 1 : 0.6, s === 14);
        if ([0, 3, 8, 11].includes(s)) bass808(t, root, S * 2.6, 0.8);
        if (s === 6 || s === 14) stab(t, ch, 0.8);
      } else if (style === 'drive') {
        if (s % 4 === 0) kick(t);
        if (s === 4 || s === 12) clap(t, 0.8);
        hat(t, s % 2 ? 0.45 : 0.8, s % 4 === 2);
        if (s % 2 === 0) bass808(t, root + (s % 4 === 2 ? 12 : 0), S * 1.6, 0.65);
      } else if (style === 'lofi') {
        if (s === 0 || s === 10) kick(t, 0.9);
        if (s === 4 || s === 12) clap(t, 0.7);
        if (s % 2 === 0) hat(t, 0.5);
        if (s === 0 || s === 10) bass808(t, root, S * 3, 0.6);
      } else if (style === 'half') {
        if (s === 0 || s === 11) kick(t, 0.85);
        if (s === 8) clap(t, 0.75);
        if (s % 2 === 0) hat(t, 0.4, s === 14);
        if (s === 0 || s === 11) bass808(t, root, S * 4, 0.6);
      } else if (style === 'hats') {
        if (s % 2 === 0) hat(t, 0.45);
        if (s === 0) kick(t, 0.7);
      }
    }
  }
  const bars = (from, to, style, k0 = 0, bus = music) => {
    BUS = bus;
    let k = k0;
    for (let t = from; t < to - 0.01; t += 2 * B * 2) bar(t, style, k++);
    BUS = music;
  };

  // instruments call mus(); route it through BUS while scheduling
  mus = (node, gain = 1, rev = 0, pan = 0) => out(node, gain, rev, pan, BUS);

  const hit = (t, v = 1) => impact(t, v);
  const sw = (t, d = 0.35, v = 0.25) => whoosh(t - d, d, 500, 7000, v);

  // 01 idea: dark pad, UFO hum, the slam on ABDUZIR, zoom-through, logo
  pad(0, [45, 52, 57], 3.2, 1.2);
  pad(3.0, [41, 48, 57], 3.5, 0.9);
  hum(0.2, 6.6, 82, 98, 0.035);
  whoosh(0.05, 0.5, 200, 3000, 0.18);
  hit(0.55, 0.8);
  stab(1.25, [57, 60, 64], 0.7);
  whoosh(2.25, 0.62, 300, 9000, 0.35);
  boom(2.88, 1);
  crash(2.88, 0.7);
  bars(3.0, 5.5, 'hats');
  sw(5.65, 0.3, 0.3);
  hit(5.65, 1);
  stab(5.65, [57, 60, 64, 69], 1.2);

  // 02 prototype: lo-fi, filtered
  sw(6.5, 0.4, 0.2);
  bars(6.5, 11.5, 'lofi', 0, lofi);
  pluck(7.45, 81, 1.2, -0.3, 'fx');
  pluck(7.52, 88, 1.0, 0.3, 'fx');
  pad(8.85, [53, 57, 60, 64], 2.6, 1.0);
  whoosh(10.6, 0.9, 200, 8000, 0.32);

  // 03 assets: drive, then one pluck per asset
  hit(11.5, 0.9);
  bars(11.5, 13.5, 'drive', 0);
  for (let i = 0; i < 8; i++) {
    const t = 13.6 + i * 0.25;
    kick(t, 0.9);
    pluck(t, PENTA[i + 2], 1.3, i % 2 ? 0.3 : -0.3, 'fx');
    pop(t, PENTA[i + 2] - 12, false, 0.8);
  }
  hat(14.6, 0.7, true);
  whoosh(15.3, 0.7, 300, 10000, 0.4);

  // 04 TRIPO: the drop, then the funk groove under the whole Tripo flow
  hit(16, 1.3);
  stab(16, [57, 60, 64, 69], 1.4);
  bars(16, 44.5, 'funk', 0);
  for (const c of [19, 23, 26.5, 31, 36, 39, 41.5]) {
    sw(c, 0.3, 0.2);
    crash(c, 0.45);
  }
  // multiview cards flipping in, merge into one model
  [23.1, 23.32, 23.54, 23.76].forEach((t, i) => pluck(t, 76 + i * 3, 1, i % 2 ? 0.4 : -0.4, 'fx'));
  whoosh(25.0, 0.5, 400, 6000, 0.25);
  chime(25.5, 4);
  // texture wipe
  whoosh(26.6, 1.2, 300, 2500, 0.12);
  whoosh(28.1, 1.0, 2500, 400, 0.12);
  // smart mesh: faces counter sweep, quad chip, mesh edit scan + done
  pluck(31.45, 88, 1.0, 0, 'fx');
  hum(31.9, 33.2, 140, 880, 0.03);
  pluck(33.2, 93, 1.1, 0, 'fx');
  whoosh(34.45, 0.9, 6000, 900, 0.14);
  chime(35.35, 7);
  // rig: chips + run
  [36.6, 36.85, 37.1].forEach((t, i) => pluck(t, 84 + i * 2, 0.9, i % 2 ? 0.3 : -0.3, 'fx'));
  // smart uv flip
  whoosh(28.5, 0.3, 1500, 7000, 0.14);
  pluck(28.95, 86, 1.0, 0, 'fx');
  // text to motion: typing, then GERAR
  for (let i = 0; i < 14; i++) hat(39.15 + i * 0.047, 0.5 + 0.3 * ((i * 7) % 3 === 0));
  pluck(39.82, 91, 1.2, 0, 'fx');
  chime(39.9, 2);
  // pipeline nodes
  for (let i = 0; i < 6; i++) pluck(41.8 + i * 0.28, PENTA[i + 3], 1.2, i % 2 ? 0.3 : -0.3, 'fx');
  whoosh(43.9, 0.6, 300, 9000, 0.35);

  // 05 payoff: beam hum, flow steps, abductions
  hit(44.5, 1.1);
  hum(44.5, 49.5, 98, 120, 0.04);
  [44.75, 45.1, 45.45, 45.8].forEach((t, i) => pluck(t, 79 + i * 3, 0.9, 0, 'fx'));
  [47.9, 48.65, 49.4].forEach((t, i) => {
    gulp(t);
    pop(t, 81 + i * 3, true, 1);
  });
  bars(44.5, 49.5, 'funk', 2);

  // 06 memes: tamborzão + a pop per meme, climbing
  hit(49.5, 1);
  bars(49.5, 55.5, 'funk', 0);
  for (let i = 0; i < 15; i++) pop(51.25 + i * 0.22, PENTA[i % PENTA.length], i % 4 === 0, 1);
  sparkle(54.55, 1);
  gulp(55.15);
  whoosh(55.0, 0.5, 300, 10000, 0.35);

  // 07 CTA: laid back, the code ticks in
  hit(55.5, 1);
  sparkle(55.6, 1.1);
  pad(55.5, [45, 52, 57, 60], 4, 0.8);
  pad(59.5, [41, 48, 53, 57], 4, 0.8);
  bars(55.5, 63.5, 'half', 0);
  for (let i = 0; i < 6; i++) {
    for (let k = 0; k < 4; k++) hat(55.95 + i * 0.09 - k * 0.06, 0.35);
    pluck(56.25 + i * 0.09, PENTA[i + 4], 1.0, 0, 'fx');
  }
  sw(56.7, 0.25, 0.18);
  sw(57.05, 0.25, 0.18);
  chime(57.45, 0);
  whoosh(60.3, 0.5, 300, 7000, 0.25);
  chime(61.8, 5);
  stab(61.8, [57, 60, 64, 69], 0.9);

  const buf = await ctx.startRendering();
  const n = buf.length;
  const data = new DataView(new ArrayBuffer(44 + n * 4));
  const w = (o, s) => [...s].forEach((c, i) => data.setUint8(o + i, c.charCodeAt(0)));
  w(0, 'RIFF');
  data.setUint32(4, 36 + n * 4, true);
  w(8, 'WAVE');
  w(12, 'fmt ');
  data.setUint32(16, 16, true);
  data.setUint16(20, 1, true);
  data.setUint16(22, 2, true);
  data.setUint32(24, SR, true);
  data.setUint32(28, SR * 4, true);
  data.setUint16(32, 4, true);
  data.setUint16(34, 16, true);
  w(36, 'data');
  data.setUint32(40, n * 4, true);
  const Lc = buf.getChannelData(0);
  const Rc = buf.getChannelData(1);
  for (let i = 0; i < n; i++) {
    data.setInt16(44 + i * 4, Math.max(-1, Math.min(1, Lc[i])) * 32767, true);
    data.setInt16(46 + i * 4, Math.max(-1, Math.min(1, Rc[i])) * 32767, true);
  }
  return data.buffer;
}
if (typeof window !== 'undefined') window.renderShowreelAudio = renderShowreelAudio;
