/*
 * ABDUZIU reels — trilha de 15 s (Web Audio / OfflineAudioContext).
 * Batida casual a 120 BPM + um "pop" afinado para cada abdução registrada pelo
 * director (TRAILER.events), subindo na escala conforme o combo cresce.
 *
 *   const wav = await renderColecaoAudio(events);   // ArrayBuffer (WAV 16-bit)
 */
async function renderColecaoAudio(events) {
  const SR = 48000;
  const LEN = 15;
  const ctx = new OfflineAudioContext(2, SR * LEN, SR);
  const BEAT = 0.5;
  const S16 = BEAT / 4;

  const master = ctx.createGain();
  master.gain.value = 0.5;
  master.gain.setValueAtTime(0.5, 14.3);
  master.gain.linearRampToValueAtTime(0, 14.98);
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -16;
  comp.ratio.value = 3.5;
  const trim = ctx.createGain();
  trim.gain.value = 0.55;
  const soft = ctx.createWaveShaper();
  const sc = new Float32Array(2048);
  for (let i = 0; i < 2048; i++) sc[i] = Math.tanh(((i / 2047) * 2 - 1) * 1.4) / Math.tanh(1.4);
  soft.curve = sc;
  master.connect(comp).connect(trim).connect(soft).connect(ctx.destination);

  const irLen = SR * 1.6;
  const ir = ctx.createBuffer(2, irLen, SR);
  for (let c = 0; c < 2; c++) {
    const d = ir.getChannelData(c);
    for (let i = 0; i < irLen; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / irLen, 3.5);
  }
  const verb = ctx.createConvolver();
  verb.buffer = ir;
  const verbIn = ctx.createGain();
  verbIn.gain.value = 0.35;
  verbIn.connect(verb).connect(master);

  const noiseBuf = ctx.createBuffer(1, SR, SR);
  {
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  const noise = (t, dur) => {
    const s = ctx.createBufferSource();
    s.buffer = noiseBuf;
    s.loop = true;
    s.start(t, Math.random() * 0.5);
    s.stop(t + dur + 0.05);
    return s;
  };
  const env = (g, t, a, peak, d) => {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
  };
  const out = (node, gain = 1, rev = 0, pan = 0) => {
    const g = ctx.createGain();
    g.gain.value = gain;
    const p = ctx.createStereoPanner();
    p.pan.value = pan;
    node.connect(g).connect(p).connect(master);
    if (rev) {
      const r = ctx.createGain();
      r.gain.value = rev;
      p.connect(r).connect(verbIn);
    }
  };
  const midi = (n) => 440 * Math.pow(2, (n - 69) / 12);

  function kick(t, v = 1) {
    const o = ctx.createOscillator();
    o.frequency.setValueAtTime(130, t);
    o.frequency.exponentialRampToValueAtTime(45, t + 0.1);
    const g = ctx.createGain();
    env(g, t, 0.002, 0.9 * v, 0.25);
    o.connect(g);
    out(g, 0.9);
    o.start(t);
    o.stop(t + 0.3);
  }
  function clap(t, v = 1) {
    const n = noise(t, 0.15);
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 1800;
    const g = ctx.createGain();
    env(g, t, 0.001, 0.45 * v, 0.12);
    n.connect(bp).connect(g);
    out(g, 0.6, 0.2);
  }
  function shaker(t, v = 1) {
    const n = noise(t, 0.05);
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 7000;
    const g = ctx.createGain();
    env(g, t, 0.004, 0.14 * v, 0.04);
    n.connect(hp).connect(g);
    out(g, 0.6, 0, 0.3);
  }
  function marimba(t, note, v = 1, pan = 0) {
    const f = midi(note);
    for (const [mul, amp, dec] of [[1, 1, 0.35], [4, 0.25, 0.08], [10, 0.08, 0.03]]) {
      const o = ctx.createOscillator();
      o.frequency.value = f * mul;
      const g = ctx.createGain();
      env(g, t, 0.002, 0.18 * v * amp, dec);
      o.connect(g);
      out(g, 1, 0.25, pan);
      o.start(t);
      o.stop(t + dec + 0.05);
    }
  }
  function bass(t, note, dur) {
    const o = ctx.createOscillator();
    o.type = 'triangle';
    o.frequency.value = midi(note);
    const g = ctx.createGain();
    env(g, t, 0.005, 0.5, dur);
    o.connect(g);
    out(g, 0.8);
    o.start(t);
    o.stop(t + dur + 0.05);
  }
  /** The abduction pop: a bubbly upward blip. */
  function pop(t, note, big, v = 1) {
    const f = midi(note);
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(f * 0.55, t);
    o.frequency.exponentialRampToValueAtTime(f, t + 0.035);
    const g = ctx.createGain();
    env(g, t, 0.003, 0.22 * v, big ? 0.22 : 0.11);
    o.connect(g);
    out(g, 1, 0.18, (Math.random() - 0.5) * 0.6);
    o.start(t);
    o.stop(t + 0.3);
    if (big) {
      // heavier things land with a soft thump
      const s = ctx.createOscillator();
      s.frequency.setValueAtTime(160, t);
      s.frequency.exponentialRampToValueAtTime(50, t + 0.18);
      const sg = ctx.createGain();
      env(sg, t, 0.003, 0.35 * v, 0.2);
      s.connect(sg);
      out(sg, 0.8);
      s.start(t);
      s.stop(t + 0.3);
    }
  }
  function chime(t) {
    [72, 76, 79, 84].forEach((n, i) => marimba(t + i * 0.05, n + 12, 1.1, i % 2 ? 0.3 : -0.3));
  }
  function whoosh(tEnd, dur = 0.3) {
    const t = tEnd - dur;
    const n = noise(t, dur);
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(500, t);
    bp.frequency.exponentialRampToValueAtTime(6000, tEnd);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.3, tEnd - 0.01);
    g.gain.linearRampToValueAtTime(0.0001, tEnd);
    n.connect(bp).connect(g);
    out(g, 0.8);
  }
  function boom(t, v = 1) {
    const o = ctx.createOscillator();
    o.frequency.setValueAtTime(80, t);
    o.frequency.exponentialRampToValueAtTime(30, t + 0.7);
    const g = ctx.createGain();
    env(g, t, 0.003, 0.9 * v, 0.8);
    o.connect(g);
    out(g, 0.8, 0.2);
    o.start(t);
    o.stop(t + 0.9);
  }

  function tick(t, v = 1) {
    const n = noise(t, 0.03);
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 3200;
    const g = ctx.createGain();
    env(g, t, 0.001, 0.25 * v, 0.025);
    n.connect(bp).connect(g);
    out(g, 0.7, 0.1, 0.2);
  }
  function boing(t) {
    const o = ctx.createOscillator();
    o.type = 'triangle';
    o.frequency.setValueAtTime(180, t);
    o.frequency.exponentialRampToValueAtTime(520, t + 0.12);
    o.frequency.exponentialRampToValueAtTime(260, t + 0.35);
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 18;
    const lg = ctx.createGain();
    lg.gain.value = 40;
    lfo.connect(lg).connect(o.frequency);
    const g = ctx.createGain();
    env(g, t, 0.005, 0.35, 0.45);
    o.connect(g);
    out(g, 0.9, 0.2);
    o.start(t);
    lfo.start(t);
    o.stop(t + 0.6);
    lfo.stop(t + 0.6);
  }
  function mystery(t0, dur) {
    for (const n of [61, 64, 68]) {
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = midi(n);
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 5;
      const lg = ctx.createGain();
      lg.gain.value = 3;
      lfo.connect(lg).connect(o.frequency);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.linearRampToValueAtTime(0.06, t0 + 0.3);
      g.gain.linearRampToValueAtTime(0.0001, t0 + dur);
      o.connect(g);
      out(g, 1, 0.5);
      o.start(t0);
      lfo.start(t0);
      o.stop(t0 + dur);
      lfo.stop(t0 + dur);
    }
  }

  // ─── groove (0–9 s): light casual beat
  const CHORDS = [
    [60, 64, 67],
    [57, 60, 64],
    [65, 69, 72],
    [67, 71, 74],
  ];
  for (let bar = 0; bar < 5; bar++) {
    const t = bar * 2;
    const ch = CHORDS[bar % 4];
    for (let b = 0; b < 4; b++) {
      const tb = t + b * BEAT;
      if (tb >= 9) break;
      kick(tb, tb < 4 ? 1 : 0.6);
      if (b % 2 === 1) clap(tb, tb < 4 ? 1 : 0.6);
      for (let s = 0; s < 4; s += 2) shaker(tb + s * S16, s ? 1 : 0.6);
      marimba(tb + 2 * S16, ch[b % 3] + 12, 0.7, 0.2);
    }
    if (t < 9) {
      bass(t, ch[0] - 24, 0.4);
      bass(t + 1, ch[1] - 24, 0.4);
    }
  }
  for (const c of [4, 9]) {
    whoosh(c);
    boom(c, 0.7);
  }

  // ─── 0–4 s: abductions; a sparkle for every new collection card
  const SCALE = [0, 2, 4, 7, 9];
  let last = -1;
  for (const e of events.filter((x) => x.k === 'pop').sort((a, b) => a.t - b.t)) {
    if (e.t >= 4 || e.t - last < 0.03) continue;
    last = e.t;
    const step = Math.min(e.combo ?? 1, 25);
    const note = 72 + SCALE[step % 5] + 12 * Math.floor(step / 5) - Math.min(12, (e.tier ?? 0) * 3);
    pop(e.t, Math.min(note, 98), (e.tier ?? 0) >= 2, 0.8);
    if (e.special) [84, 88, 91].forEach((n, i) => marimba(e.t + 0.04 + i * 0.045, n, 0.8, i % 2 ? 0.3 : -0.3));
  }

  // ─── 4–9 s: the catalogue
  for (let t = 4.2; t < 8.9; t += 0.18) if (t > 6.2) tick(t, 0.7);
  pop(4.9, 84, false, 1);
  boing(4.95);
  mystery(6.5, 2.4);

  // ─── 9–15 s: the question
  boom(9, 1);
  [0, 0.18, 0.36].forEach((d, i) => {
    pop(9.4 + d, 76 + i * 4, true, 1);
    marimba(9.4 + d, 72 + i * 4, 1);
  });
  for (let i = 0; i < 5; i++) pop(10.4 + i * 0.28, 79 + SCALE[i % 5], false, 1);
  for (let b = 0; b < 12; b++) {
    const tb = 9 + b * BEAT;
    kick(tb, b < 6 ? 0.5 : 0.9);
    if (b % 2) clap(tb, 0.6);
  }
  [72, 76, 79, 84].forEach((n, i) => marimba(12.2 + i * 0.06, n + 12, 1.1));
  pop(12.7, 88, true, 1.2);
  for (let i = 0; i < 4; i++) tick(13.1 + i * 0.5, 1);
  [60, 64, 67, 72].forEach((n) => marimba(13.4, n, 0.9));
  bass(13.4, 36, 1.2);

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
  const L = buf.getChannelData(0);
  const R = buf.getChannelData(1);
  for (let i = 0; i < n; i++) {
    data.setInt16(44 + i * 4, Math.max(-1, Math.min(1, L[i])) * 32767, true);
    data.setInt16(46 + i * 4, Math.max(-1, Math.min(1, R[i])) * 32767, true);
  }
  return data.buffer;
}
if (typeof window !== 'undefined') window.renderColecaoAudio = renderColecaoAudio;
