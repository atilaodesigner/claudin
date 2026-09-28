/*
 * ABDUZIU feature reel — soundtrack (Web Audio / OfflineAudioContext), 25.6 s.
 * Brazilian funk at 150 BPM (tamborzão kick/tom pattern, 808 bass, clap, stabs in A minor),
 * a breakdown in orbit, an impact + crash on every cut, and the game's own sounds placed on
 * the exact frames the director logged: abductions (pentatonic pops that climb with the
 * combo), level-ups, explosions, the EMP, arena swallows, skin swaps and the launch.
 *
 *   const wav = await renderReelAudio(events, 25.6);   // ArrayBuffer (WAV)
 */
async function renderReelAudio(events, LEN) {
  const SR = 48000;
  const BPM = 150;
  const B = 60 / BPM; // beat
  const S = B / 4; // 16th
  const CUTS = [2.4, 4.8, 7.2, 9.6, 12.0, 14.4, 16.8, 19.2, 21.6];
  const BREAK = [2.4, 4.8]; // orbit: drums out
  const LAUNCH = 22.4;
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
  const mus = (node, gain = 1, rev = 0, pan = 0) => out(node, gain, rev, pan, music);
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

  // ─── the groove: 16-step tamborzão bars in A minor
  const inBreak = (t) => t >= BREAK[0] - 0.001 && t < BREAK[1] - 0.001;
  const CH = [
    [57, 60, 64], // Am
    [53, 57, 60], // F
    [55, 59, 62], // G
    [52, 56, 59], // E
  ];
  const KICK = [0, 3, 6, 10, 13];
  const TOMS = { 2: 196, 7: 147, 9: 220, 14: 165, 15: 147 };
  const BASS = { 0: 45, 3: 45, 6: 48, 10: 43, 13: 40 };
  const bar = S * 16;
  const end = LEN - 0.3;
  for (let b = 0; b * bar < end; b++) {
    const tb = b * bar;
    const ch = CH[b % 4];
    const root = ch[0] - 12;
    for (let s = 0; s < 16; s++) {
      const t = tb + s * S;
      if (t >= end || inBreak(t)) continue;
      // outro: the end card keeps the groove, lighter
      const lite = t >= LAUNCH && t < LAUNCH + bar * 0.5;
      if (KICK.includes(s)) kick(t, s === 0 ? 1 : 0.85);
      if (s === 4 || s === 12) clap(t, 1);
      if (TOMS[s] && !lite) tom(t, TOMS[s] * (b % 2 && s === 14 ? 1.12 : 1), 0.8);
      hat(t, s % 4 === 2 ? 1 : 0.5, s === 14);
      if (BASS[s] != null) bass808(t, BASS[s] - 57 + root, s === 0 ? S * 2.6 : S * 1.8, 0.9);
      if (s === 0 || s === 6) stab(t, ch.map((n) => n + 12), s === 0 ? 1 : 0.75);
      if ((s === 11 || s === 14) && b % 2 === 1) stab(t, ch.map((n) => n + 12), 0.6, 0.1);
    }
  }

  // ─── arrangement
  impact(0.01, 1.1);
  hum(0, LEN, 90, 70, 0.03);
  // hook: the frenzy riser climbs into the breakdown
  {
    const o = osc('sawtooth', 220, 0, 2.4);
    o.frequency.setValueAtTime(220, 0);
    o.frequency.exponentialRampToValueAtTime(880, 2.4);
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 1400;
    const g = ctx.createGain();
    g.gain.value = 0.02;
    o.connect(bp).connect(g);
    out(g, 1, 0.4);
  }
  // orbit breakdown: space pad, twinkles, the dive and the re-entry rumble
  pad(BREAK[0], [45, 52, 57, 60, 64], BREAK[1] - BREAK[0] + 0.3, 2.4);
  pad(BREAK[0], [33, 40], BREAK[1] - BREAK[0] + 0.2, 2.2);
  for (let t = BREAK[0] + 0.1; t < BREAK[1] - 0.4; t += S * 2) pluck(t, [88, 91, 93, 96, 93, 91][Math.round((t - BREAK[0]) / (S * 2)) % 6], 0.7, Math.sin(t * 3) * 0.6);
  whoosh(BREAK[0], BREAK[1] - BREAK[0], 150, 3000, 0.5);
  {
    const t0 = BREAK[0] + 0.6;
    const n = noise(t0, BREAK[1] - t0);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 260;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(0.55, BREAK[1]);
    g.gain.linearRampToValueAtTime(0.0001, BREAK[1] + 0.05);
    n.connect(lp).connect(g);
    out(g, 1);
  }
  // cuts: a hit on every one, a short swell into it
  for (const c of CUTS) {
    impact(c, c === BREAK[1] ? 1.35 : c === BREAK[0] ? 1.1 : 0.8);
    if (c !== BREAK[1]) whoosh(c - 0.32, 0.32, 800, 7000, 0.14);
  }
  // army: sirens under the groove
  siren(12.0, 14.4, 0.035);
  // end: lift-off riser, the launch, the logo sting
  whoosh(21.6, LAUNCH - 21.6, 300, 6000, 0.3);
  impact(LAUNCH, 1.4);
  boom(LAUNCH, 1.1);
  whoosh(LAUNCH, 1.8, 5000, 200, 0.18);
  [57, 64, 69, 72, 76, 81].forEach((n, i) => pluck(LAUNCH + 0.05 + i * 0.05, n + 12, 1.2, i % 2 ? 0.4 : -0.4, 'fx'));
  pad(LAUNCH, [45, 57, 60, 64, 69], LEN - LAUNCH, 0.8);
  impact(25.2, 0.9);
  stab(25.2, [69, 72, 76, 81], 1.3, 0.4);

  // ─── game events
  const ev = (k) => events.filter((e) => e.k === k).sort((a, b) => a.t - b.t);
  const PENTA = [0, 3, 5, 7, 10];
  let last = -1;
  let inWindow = 0;
  let windowStart = 0;
  for (const e of ev('pop')) {
    if (e.secret) {
      sparkle(e.t, 1);
      continue;
    }
    if (e.t - last < 0.035) continue;
    if (e.t - windowStart > 0.1) {
      windowStart = e.t;
      inWindow = 0;
    }
    if (++inWindow > 2) continue;
    last = e.t;
    const step = Math.min(e.combo ?? 1, 30);
    const note = 69 + PENTA[step % 5] + 12 * Math.floor(step / 5) - Math.min(18, (e.tier ?? 0) * 3);
    pop(e.t, Math.min(note, 100), (e.tier ?? 0) >= 3, (e.tier ?? 0) >= 6 ? 1 : 0.8);
  }
  let lastChime = -9;
  let up = 0;
  for (const e of ev('level')) {
    if (e.t - lastChime < 0.3) continue;
    lastChime = e.t;
    chime(e.t, Math.min(12, up));
    up += 2;
  }
  let lastBoom = -9;
  for (const e of ev('boom')) {
    if (e.t - lastBoom < 0.15) continue;
    lastBoom = e.t;
    boom(e.t, Math.min(1, 0.45 + (e.size ?? 2) * 0.1));
  }
  for (const e of ev('emp')) emp(e.t);
  for (const e of ev('swallow')) gulp(e.t);
  ev('skin').forEach((e, i) => shing(e.t, i + 1));
  shing(19.2 + 0.02, 0);

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
if (typeof window !== 'undefined') window.renderReelAudio = renderReelAudio;
