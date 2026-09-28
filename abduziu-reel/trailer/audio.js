/*
 * ABDUZIU trailer score — 30 s, 120 BPM, synthesized with the Web Audio API
 * (OfflineAudioContext), cut-synced to director.js. Baile-funk flavoured groove,
 * 808 bass, a theremin-ish UFO lead, hits on every cut and a big end pad.
 *
 *   const wav = await renderTrailerAudio();   // ArrayBuffer (16-bit PCM WAV)
 */
async function renderTrailerAudio() {
  const SR = 48000;
  const LEN = 30;
  const ctx = new OfflineAudioContext(2, SR * LEN, SR);
  const BEAT = 0.5;
  const S16 = BEAT / 4;

  // ─── master chain
  const master = ctx.createGain();
  master.gain.value = 0.55;
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -14;
  comp.ratio.value = 4;
  comp.attack.value = 0.004;
  comp.release.value = 0.18;
  // the compressor adds make-up gain: trim after it, then a soft clipper as a safety limiter
  const trim = ctx.createGain();
  trim.gain.value = 0.5;
  const soft = ctx.createWaveShaper();
  const sc = new Float32Array(2048);
  for (let i = 0; i < 2048; i++) sc[i] = Math.tanh(((i / 2047) * 2 - 1) * 1.4) / Math.tanh(1.4);
  soft.curve = sc;
  master.connect(comp).connect(trim).connect(soft).connect(ctx.destination);
  // fade out at the very end
  master.gain.setValueAtTime(0.55, 28.6);
  master.gain.linearRampToValueAtTime(0, 29.95);

  // reverb bus
  const irLen = SR * 2.8;
  const ir = ctx.createBuffer(2, irLen, SR);
  for (let c = 0; c < 2; c++) {
    const d = ir.getChannelData(c);
    for (let i = 0; i < irLen; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / irLen, 3.2);
  }
  const verb = ctx.createConvolver();
  verb.buffer = ir;
  const verbIn = ctx.createGain();
  verbIn.gain.value = 0.5;
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
  const env = (g, t, a, peak, d, sustain = 0) => {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0001, sustain), t + a + d);
  };
  const out = (node, gain = 1, rev = 0, pan = 0) => {
    const g = ctx.createGain();
    g.gain.value = gain;
    const p = ctx.createStereoPanner();
    p.pan.value = pan;
    node.connect(g).connect(p).connect(master);
    if (rev > 0) {
      const r = ctx.createGain();
      r.gain.value = rev;
      p.connect(r).connect(verbIn);
    }
    return g;
  };
  const midi = (n) => 440 * Math.pow(2, (n - 69) / 12);

  // ─── instruments
  function kick(t, v = 1) {
    const o = ctx.createOscillator();
    o.frequency.setValueAtTime(150, t);
    o.frequency.exponentialRampToValueAtTime(42, t + 0.12);
    const g = ctx.createGain();
    env(g, t, 0.002, 1.1 * v, 0.32);
    o.connect(g);
    out(g, 0.9);
    o.start(t);
    o.stop(t + 0.4);
    // click
    const n = noise(t, 0.02);
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 3000;
    const ng = ctx.createGain();
    env(ng, t, 0.001, 0.25 * v, 0.02);
    n.connect(hp).connect(ng);
    out(ng, 0.6);
  }
  function clap(t, v = 1) {
    for (let k = 0; k < 3; k++) {
      const tt = t + k * 0.011;
      const n = noise(tt, 0.2);
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 1500;
      bp.Q.value = 0.9;
      const g = ctx.createGain();
      env(g, tt, 0.001, (k === 2 ? 0.7 : 0.4) * v, k === 2 ? 0.16 : 0.03);
      n.connect(bp).connect(g);
      out(g, 0.55, 0.18);
    }
  }
  function hat(t, v = 1, open = false) {
    const n = noise(t, open ? 0.25 : 0.06);
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 8000;
    const g = ctx.createGain();
    env(g, t, 0.001, 0.22 * v, open ? 0.2 : 0.04);
    n.connect(hp).connect(g);
    out(g, 0.5, 0, 0.25);
  }
  function tom(t, f = 180, v = 1) {
    // the "tamborzão" drum: pitched body + skin
    const o = ctx.createOscillator();
    o.type = 'triangle';
    o.frequency.setValueAtTime(f * 1.6, t);
    o.frequency.exponentialRampToValueAtTime(f, t + 0.05);
    const g = ctx.createGain();
    env(g, t, 0.002, 0.55 * v, 0.16);
    o.connect(g);
    out(g, 0.7, 0.08, -0.2);
    o.start(t);
    o.stop(t + 0.25);
  }
  function bass(t, note, dur, v = 1) {
    const f = midi(note);
    const o = ctx.createOscillator();
    o.frequency.setValueAtTime(f * 2.2, t);
    o.frequency.exponentialRampToValueAtTime(f, t + 0.04);
    const sh = ctx.createWaveShaper();
    const curve = new Float32Array(1024);
    for (let i = 0; i < 1024; i++) {
      const x = (i / 1023) * 2 - 1;
      curve[i] = Math.tanh(x * 2.2);
    }
    sh.curve = curve;
    const g = ctx.createGain();
    env(g, t, 0.004, 0.75 * v, dur, 0.001);
    o.connect(sh).connect(g);
    out(g, 0.7);
    o.start(t);
    o.stop(t + dur + 0.1);
  }
  function saw(t, notes, dur, v = 1, cutoff = 2600, rev = 0.25) {
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(cutoff, t);
    lp.frequency.exponentialRampToValueAtTime(Math.max(200, cutoff * 0.25), t + dur);
    const g = ctx.createGain();
    env(g, t, 0.006, 0.16 * v, dur, 0.001);
    lp.connect(g);
    out(g, 1, rev);
    for (const n of notes) {
      for (const det of [-9, 0, 9]) {
        const o = ctx.createOscillator();
        o.type = 'sawtooth';
        o.frequency.value = midi(n);
        o.detune.value = det;
        o.connect(lp);
        o.start(t);
        o.stop(t + dur + 0.1);
      }
    }
  }
  function lead(t, note, dur, v = 1, glideFrom = null) {
    // theremin-ish: sine + vibrato + a little glide
    const o = ctx.createOscillator();
    const f = midi(note);
    if (glideFrom !== null) {
      o.frequency.setValueAtTime(midi(glideFrom), t);
      o.frequency.exponentialRampToValueAtTime(f, t + 0.08);
    } else o.frequency.setValueAtTime(f, t);
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 6.2;
    const lg = ctx.createGain();
    lg.gain.value = f * 0.012;
    lfo.connect(lg).connect(o.frequency);
    const g = ctx.createGain();
    env(g, t, 0.03, 0.2 * v, dur, 0.001);
    o.connect(g);
    out(g, 1, 0.35, 0.1);
    o.start(t);
    lfo.start(t);
    o.stop(t + dur + 0.1);
    lfo.stop(t + dur + 0.1);
  }
  function bloop(t, from = 300, to = 1400, dur = 0.18, v = 1) {
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(from, t);
    o.frequency.exponentialRampToValueAtTime(to, t + dur);
    const g = ctx.createGain();
    env(g, t, 0.005, 0.28 * v, dur);
    o.connect(g);
    out(g, 1, 0.3);
    o.start(t);
    o.stop(t + dur + 0.05);
  }
  function impact(t, v = 1) {
    // sub boom + noise burst
    const o = ctx.createOscillator();
    o.frequency.setValueAtTime(90, t);
    o.frequency.exponentialRampToValueAtTime(28, t + 0.9);
    const g = ctx.createGain();
    env(g, t, 0.003, 1.2 * v, 1.1);
    o.connect(g);
    out(g, 0.85, 0.2);
    o.start(t);
    o.stop(t + 1.3);
    const n = noise(t, 0.6);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(6000, t);
    lp.frequency.exponentialRampToValueAtTime(300, t + 0.5);
    const ng = ctx.createGain();
    env(ng, t, 0.002, 0.5 * v, 0.55);
    n.connect(lp).connect(ng);
    out(ng, 0.7, 0.4);
  }
  function whoosh(tEnd, dur = 0.35, v = 1) {
    const t = tEnd - dur;
    const n = noise(t, dur);
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.value = 1.2;
    bp.frequency.setValueAtTime(400, t);
    bp.frequency.exponentialRampToValueAtTime(7000, tEnd);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.4 * v, tEnd - 0.01);
    g.gain.linearRampToValueAtTime(0.0001, tEnd);
    n.connect(bp).connect(g);
    out(g, 0.8, 0.1);
  }
  function riser(t0, t1, v = 1) {
    const n = noise(t0, t1 - t0);
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.value = 3;
    bp.frequency.setValueAtTime(200, t0);
    bp.frequency.exponentialRampToValueAtTime(5000, t1);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(0.35 * v, t1);
    g.gain.linearRampToValueAtTime(0.0001, t1 + 0.02);
    n.connect(bp).connect(g);
    out(g, 0.9, 0.2);
    const o = ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(110, t0);
    o.frequency.exponentialRampToValueAtTime(880, t1);
    const lp = ctx.createBiquadFilter();
    lp.frequency.value = 1800;
    const og = ctx.createGain();
    og.gain.setValueAtTime(0.0001, t0);
    og.gain.exponentialRampToValueAtTime(0.08 * v, t1);
    og.gain.linearRampToValueAtTime(0.0001, t1 + 0.02);
    o.connect(lp).connect(og);
    out(og, 1, 0.2);
    o.start(t0);
    o.stop(t1 + 0.05);
  }
  function braam(t, dur = 1.8, v = 1) {
    saw(t, [33, 45, 52], dur, 2.4 * v, 900, 0.4);
  }
  function siren(t0, t1) {
    const o = ctx.createOscillator();
    o.type = 'sawtooth';
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 1.6;
    const lg = ctx.createGain();
    lg.gain.value = 180;
    lfo.connect(lg).connect(o.frequency);
    o.frequency.value = 760;
    const lp = ctx.createBiquadFilter();
    lp.frequency.value = 2200;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(0.05, t0 + 0.2);
    g.gain.setValueAtTime(0.05, t1 - 0.2);
    g.gain.linearRampToValueAtTime(0.0001, t1);
    o.connect(lp).connect(g);
    out(g, 1, 0.3, -0.3);
    o.start(t0);
    lfo.start(t0);
    o.stop(t1);
    lfo.stop(t1);
  }
  function zap(t) {
    const o = ctx.createOscillator();
    o.type = 'square';
    o.frequency.setValueAtTime(2400, t);
    o.frequency.exponentialRampToValueAtTime(60, t + 0.5);
    const g = ctx.createGain();
    env(g, t, 0.002, 0.3, 0.5);
    const lp = ctx.createBiquadFilter();
    lp.frequency.value = 3500;
    o.connect(lp).connect(g);
    out(g, 0.8, 0.4);
    o.start(t);
    o.stop(t + 0.6);
    impact(t, 0.6);
  }

  // ─── the groove (baile funk-ish 3-3-2 kick pattern per bar of 16 steps)
  const KICK = [0, 3, 6, 10];
  const TOM = [7, 8, 14];
  const BASS_ROOT = [45, 45, 48, 43]; // A, A, C, G per bar
  function bar(t, opts = {}) {
    const { hats = 2, toms = true, bassOn = true, clapV = 1, kickV = 1, stab = false, root = 45 } = opts;
    for (const s of KICK) kick(t + s * S16, kickV);
    clap(t + 4 * S16, clapV);
    clap(t + 12 * S16, clapV);
    if (toms) for (const s of TOM) tom(t + s * S16, s === 14 ? 150 : 190, 0.8);
    for (let s = 0; s < 16; s += hats === 4 ? 1 : 2) hat(t + s * S16, s % 4 === 2 ? 1 : 0.6, s === 14 && hats === 2);
    if (bassOn) {
      bass(t, root - 12, 0.3);
      bass(t + 3 * S16, root - 12, 0.25);
      bass(t + 6 * S16, root - 12 + 3, 0.3);
      bass(t + 10 * S16, root - 12 + 7, 0.35);
    }
    if (stab) {
      const chord = root === 48 ? [60, 64, 67] : root === 43 ? [55, 59, 62] : [57, 60, 64];
      saw(t + 2 * S16, chord, 0.18, 0.9, 3200, 0.2);
      saw(t + 6 * S16, chord, 0.18, 0.7, 3200, 0.2);
      saw(t + 10 * S16, chord, 0.18, 0.9, 3200, 0.2);
    }
  }
  const barLen = 16 * S16; // 2 s

  // 0–2: hook — braam, rumble, riser into the cut
  impact(0.02, 1);
  braam(0.05, 1.9, 1);
  riser(0.9, 2.0, 1);
  // 2–3.5: it starts small — bloops and a soft pluck
  impact(2.0, 0.8);
  bloop(2.15, 200, 900, 0.3);
  bloop(2.75, 900, 300, 0.25, 0.7);
  bloop(3.1, 300, 1600, 0.2, 0.8);
  for (let s = 0; s < 12; s++) {
    const n = [69, 72, 76, 79][s % 4];
    lead(2.0 + s * S16, n + 12, 0.1, 0.35);
  }
  whoosh(3.5, 0.4);
  // 3.5–13.5: groove (5 bars)
  for (let b = 0; b < 5; b++) {
    const t = 3.5 + b * barLen;
    bar(t, { root: BASS_ROOT[b % 4], stab: b >= 2, hats: b >= 3 ? 4 : 2 });
  }
  // lead motif over the groove
  const motif = [
    [0, 69, 0.4], [0.5, 72, 0.25], [0.75, 76, 0.5], [1.5, 74, 0.25], [1.75, 72, 0.25],
  ];
  for (const base of [3.5, 7.5]) for (const [dt, n, d] of motif) lead(base + dt, n, d, 0.9, n - 5);
  for (const [dt, n, d] of motif) lead(9.5 + dt, n + 12, d, 0.7, n + 7);
  impact(7.0, 0.6);
  whoosh(7.0, 0.3, 0.7);
  impact(10.5, 1);
  braam(10.5, 1.4, 0.7);
  whoosh(10.5, 0.4);
  // 13.5–16: army — keep the drums, add siren and an EMP zap
  for (let b = 0; b < 2; b++) bar(13.5 + b * barLen, { root: b ? 43 : 45, stab: false, hats: 4, toms: true });
  siren(13.5, 16.0);
  impact(13.5, 0.7);
  zap(15.05);
  riser(15.0, 16.0, 0.9);
  // 16–22: arena drop — full groove + stabs, a breath before "or get eaten"
  impact(16.0, 1.1);
  braam(16.0, 1.2, 0.6);
  for (let b = 0; b < 3; b++) {
    const t = 16 + b * barLen;
    bar(t, { root: BASS_ROOT[b % 4], stab: true, hats: 4, kickV: 1.05 });
  }
  for (const [dt, n, d] of motif) lead(16 + dt, n + 12, d, 0.8, n + 7);
  // drop-out right before 19.5, then slam back
  impact(19.5, 1);
  bloop(19.3, 1400, 120, 0.2, 0.9);
  whoosh(22.0, 0.35);
  // 22–24: city stutter — a hit + chord every half second
  const cityChords = [[57, 60, 64], [60, 64, 67], [55, 59, 62], [57, 61, 64]];
  for (let i = 0; i < 4; i++) {
    const t = 22 + i * 0.5;
    impact(t, 0.6);
    kick(t);
    saw(t, cityChords[i], 0.4, 1.1, 4000, 0.3);
    hat(t + 0.25, 1, true);
    bass(t, 33 + [0, 3, -2, 0][i], 0.4);
  }
  riser(23.2, 24.0, 1);
  // 24–30: end card — big hit, pad, logo sparkle, url pop, sign-off bloop
  impact(24.0, 1.3);
  braam(24.0, 2.4, 0.8);
  saw(24.2, [57, 64, 69, 71, 76], 5.4, 0.9, 1800, 0.6);
  for (let s = 0; s < 10; s++) lead(24.3 + s * 0.12, [81, 84, 88, 91][s % 4], 0.12, 0.25);
  bloop(25.4, 400, 1800, 0.14, 0.9);
  kick(25.4, 0.7);
  bloop(26.4, 600, 1200, 0.12, 0.5);
  bloop(28.6, 1600, 200, 0.5, 0.7);

  const buf = await ctx.startRendering();
  // ─── WAV (16-bit PCM)
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
  const L = buf.getChannelData(0);
  const R = buf.getChannelData(1);
  for (let i = 0; i < n; i++) {
    data.setInt16(44 + i * 4, Math.max(-1, Math.min(1, L[i])) * 32767, true);
    data.setInt16(46 + i * 4, Math.max(-1, Math.min(1, R[i])) * 32767, true);
  }
  return data.buffer;
}
if (typeof window !== 'undefined') window.renderTrailerAudio = renderTrailerAudio;
