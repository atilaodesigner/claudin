/*
 * ABDUZIU × Tripo motion v2 — soundtrack (Web Audio / OfflineAudioContext), 60 s, 120 BPM (bar = 2 s).
 * No voice-over in this cut, so the music leads: a synth hook (detuned saws through a dotted-8th
 * delay) over the funk groove from the TRIPO drop on. Wipes get a whoosh + hit, features a swish,
 * every on-screen action its own sound (counter sweep, mesh scan, UV snaps, typing, GLB drop, memes).
 *
 *   const wav = await renderShowreelAudio('music');   // ArrayBuffer (WAV)
 */
async function renderShowreelAudio(mode = 'music') {
  const LEN = 60;
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

  // lead: two detuned saws + a square an octave down, filter envelope, dotted-8th delay
  const dly = ctx.createDelay(1);
  dly.delayTime.value = B * 0.75;
  const fb = ctx.createGain();
  fb.gain.value = 0.32;
  const dlyLp = ctx.createBiquadFilter();
  dlyLp.type = 'lowpass';
  dlyLp.frequency.value = 3200;
  dly.connect(dlyLp).connect(fb).connect(dly);
  const dlyOut = ctx.createGain();
  dlyOut.gain.value = 0.35;
  dlyLp.connect(dlyOut).connect(music);
  function lead(t, note, dur, v = 1) {
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.06 * v, t + 0.012);
    g.gain.setValueAtTime(0.05 * v, t + Math.max(0.02, dur - 0.05));
    g.gain.linearRampToValueAtTime(0.0001, t + dur + 0.04);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.Q.value = 3;
    lp.frequency.setValueAtTime(5200, t);
    lp.frequency.exponentialRampToValueAtTime(1300, t + Math.min(0.4, dur));
    for (const [type, mul, det, amp] of [['sawtooth', 1, -11, 1], ['sawtooth', 1, 11, 1], ['square', 0.5, 0, 0.45]]) {
      const o = osc(type, midi(note) * mul, t, dur + 0.05);
      o.detune.value = det;
      const vib = osc('sine', 5.2, t, dur + 0.05);
      const vg = ctx.createGain();
      vg.gain.value = dur > 0.4 ? 9 : 0;
      vib.connect(vg).connect(o.detune);
      const ag = ctx.createGain();
      ag.gain.value = amp;
      o.connect(ag).connect(lp);
    }
    lp.connect(g);
    g.connect(music);
    g.connect(dly);
    const r = ctx.createGain();
    r.gain.value = 0.18;
    g.connect(r).connect(verbIn);
  }
  // 16 eighths = 2 bars; null holds the previous note, 0 is a rest
  const HOOK_A = [69, null, 72, 69, 74, null, 72, 0, 76, null, 74, 72, 69, null, 67, 69];
  const HOOK_B = [72, null, 76, 72, 79, null, 76, 0, 74, null, 72, 74, 71, null, 67, 0];
  function phrase(t0, notes, shift = 0, v = 1) {
    const E8 = B / 2;
    for (let i = 0; i < notes.length; i++) {
      const n = notes[i];
      if (!n) continue;
      let len = 1;
      while (i + len < notes.length && notes[i + len] === null) len++;
      lead(t0 + i * E8, n + shift, len * E8 * 0.92, v);
    }
  }
  const hook = (t0, shift = 0, v = 1) => {
    phrase(t0, HOOK_A, shift, v);
    phrase(t0 + 4 * B * 2, HOOK_B, shift, v);
  };
  const WIPES = [4.5, 8, 11.5, 14, 44, 47.5, 51.5];
  for (const w of WIPES) {
    whoosh(w - 0.42, 0.42, 300, 9000, 0.3);
    hit(w, w === 11.5 ? 1.3 : 0.85);
  }

  // hook: lens opens on Brasília, arpeggio builds, the lens swallows the screen
  pad(0, [45, 52, 57, 60], 3.0, 1.1);
  hum(0.1, 4.5, 82, 96, 0.035);
  stab(0.4, [57, 60, 64], 0.8);
  boom(0.4, 0.7);
  for (let i = 0; i < 20; i++) pluck(0.45 + i * S, [57, 60, 64, 69, 72][i % 5] + (i > 11 ? 12 : 0), 0.55 + i * 0.02, i % 2 ? 0.35 : -0.35);
  whoosh(2.35, 0.6, 250, 10000, 0.4);
  boom(2.95, 1.1);
  crash(2.95, 0.8);
  bars(2.95, 4.5, 'half', 0);
  stab(3.35, [57, 60, 64, 69], 1.1);

  // prototype: lo-fi, grey
  bars(4.5, 8, 'lofi', 1, lofi);
  pluck(4.9, 81, 1, -0.3, 'fx');
  pluck(4.98, 88, 0.9, 0.3, 'fx');
  boom(6.1, 0.8);
  pad(6.1, [53, 57, 60], 1.9, 0.7);

  // assets: tiles flipping, categories ticking
  bars(8, 11.5, 'drive', 0);
  for (let i = 0; i < 22; i++) hat(8.25 + ((i * 0.618) % 1) * 1.5, 0.5);
  for (let i = 0; i < 9; i++) pluck(8.9 + i * 0.24, [69, 72, 74, 76, 79, 81, 84, 86, 88][i], 1.0, i % 2 ? 0.3 : -0.3, 'fx');
  whoosh(10.4, 1.05, 200, 10000, 0.35);
  for (let i = 0; i < 8; i++) clap(10.5 + i * S * 1, 0.25 + i * 0.07);

  // TRIPO drop → groove + hook through the ten features
  stab(11.5, [57, 60, 64, 69], 1.4);
  bars(11.5, 44, 'funk', 0);
  hook(11.5, 0, 1);
  hook(19.5, 0, 0.85);
  hook(27.5, 12, 0.6);
  hook(35.5, 0, 0.85);
  for (const t of [17, 20, 23, 26, 29, 32, 35, 38, 41]) whoosh(t - 0.3, 0.3, 900, 6000, 0.18);
  [14.3, 14.9].forEach((t, i) => pluck(t + 0.45, 84 + i * 3, 0.9, 0, 'fx'));
  [17.05, 17.2, 17.35, 17.5].forEach((t, i) => pluck(t, 76 + i * 3, 0.9, i % 2 ? 0.4 : -0.4, 'fx'));
  chime(18.7, 3);
  whoosh(20.05, 2.0, 400, 3000, 0.1);
  hum(26.0, 27.6, 150, 900, 0.03);
  pluck(27.6, 93, 1.1, 0, 'fx');
  whoosh(29.5, 1.2, 6000, 900, 0.13);
  chime(30.7, 6);
  for (let i = 0; i < 9; i++) pluck(32.3 + i * 0.08 + 0.7, 81 + (i % 5) * 2, 0.8, i % 2 ? 0.3 : -0.3, 'fx');
  [35.2, 35.4, 35.6].forEach((t, i) => pluck(t, 84 + i * 2, 0.9, 0, 'fx'));
  for (let i = 0; i < 18; i++) hat(37.8 + i * 0.042, 0.45 + 0.3 * (i % 3 === 0));
  pluck(38.6, 91, 1.2, 0, 'fx');
  chime(38.7, 2);
  whoosh(41.55, 0.45, 5000, 400, 0.25);
  gulp(42.0);
  chime(42.1, 7);

  // mechanic: heavier, the beam takes them
  bars(44, 47.5, 'funk', 2);
  hum(44, 47.5, 96, 118, 0.045);
  hook(43.5, -12, 0.55);
  [44.8, 45.1, 45.4, 45.7].forEach((t, i) => pluck(t, 79 + i * 3, 0.9, 0, 'fx'));
  [46.4, 47.0].forEach((t, i) => {
    gulp(t);
    pop(t, 81 + i * 4, true, 1);
  });

  // memes: tamborzão + a pop per meme
  bars(47.5, 51.5, 'funk', 0);
  for (let i = 0; i < 13; i++) pop(48.05 + i * 0.26, PENTA[i % PENTA.length], i % 4 === 0, 1);
  sparkle(51.2, 0.8);

  // CTA: groove keeps going, the code ticks in, the hook comes back for the ask
  sparkle(51.55, 1.1);
  bars(51.5, 60, 'half', 0);
  pad(51.5, [45, 52, 57, 60], 4, 0.8);
  pad(55.5, [41, 48, 53, 57], 4.5, 0.8);
  for (let i = 0; i < 6; i++) {
    for (let k = 0; k < 3; k++) hat(52.0 + i * 0.08 - k * 0.05, 0.35);
    pluck(52.15 + i * 0.08, PENTA[i + 4], 1.0, 0, 'fx');
  }
  sw(52.6, 0.25, 0.16);
  sw(52.9, 0.25, 0.16);
  chime(53.3, 0);
  whoosh(56.0, 0.45, 300, 7000, 0.28);
  phrase(55.5, HOOK_A, 0, 0.75);
  phrase(57.5, HOOK_B.slice(0, 12), 0, 0.75);
  stab(59.0, [57, 60, 64, 69], 1.1);
  crash(59.0, 0.6);

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
