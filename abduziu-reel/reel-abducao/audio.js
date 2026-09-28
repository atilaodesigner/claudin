/*
 * ABDUZIU reels — trilha de 15 s (Web Audio / OfflineAudioContext).
 * Batida casual a 120 BPM + um "pop" afinado para cada abdução registrada pelo
 * director (TRAILER.events), subindo na escala conforme o combo cresce.
 *
 *   const wav = await renderReelAudio(events);   // ArrayBuffer (WAV 16-bit)
 */
async function renderReelAudio(events) {
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

  // ─── groove: happy C major, 4 chords per 2 s bar
  const CHORDS = [
    [60, 64, 67],
    [57, 60, 64],
    [65, 69, 72],
    [67, 71, 74],
  ];
  for (let bar = 0; bar < 6; bar++) {
    const t = bar * 2;
    if (t >= 12.5) break;
    const ch = CHORDS[bar % 4];
    for (let b = 0; b < 4; b++) {
      const tb = t + b * BEAT;
      if (tb >= 12.5) break;
      kick(tb, bar === 0 && b < 2 ? 0.5 : 1);
      if (b % 2 === 1) clap(tb);
      for (let s = 0; s < 4; s += 2) shaker(tb + s * S16, s ? 1 : 0.6);
      // marimba off-beat arps
      marimba(tb + 2 * S16, ch[b % 3] + 12, 0.7, 0.2);
    }
    bass(t, ch[0] - 24, 0.4);
    bass(t + 0.75, ch[0] - 24, 0.2);
    bass(t + 1, ch[1] - 24, 0.4);
    bass(t + 1.5, ch[2] - 24, 0.3);
  }
  for (const c of [2, 5.5, 9, 12.5]) {
    whoosh(c);
    boom(c, c === 12.5 ? 1.2 : 0.6);
  }

  // ─── abduction pops (merged if closer than 28 ms, capped per 100 ms)
  const SCALE = [0, 2, 4, 7, 9]; // pentatonic: every combo step sounds good
  let last = -1;
  let inWindow = 0;
  let windowStart = 0;
  for (const e of events.filter((x) => x.k === 'pop').sort((a, b) => a.t - b.t)) {
    if (e.t >= 12.5) continue;
    if (e.t - last < 0.028) continue;
    if (e.t - windowStart > 0.1) {
      windowStart = e.t;
      inWindow = 0;
    }
    if (++inWindow > 3) continue;
    last = e.t;
    const step = Math.min(e.combo ?? 1, 30);
    const note = 72 + SCALE[step % 5] + 12 * Math.floor(step / 5) - Math.min(18, (e.tier ?? 0) * 3);
    pop(e.t, Math.min(note, 100), (e.tier ?? 0) >= 3, e.tier >= 6 ? 1.1 : 0.9);
  }
  for (const e of events.filter((x) => x.k === 'level')) if (e.t < 12.5) chime(e.t);

  // ─── end card jingle + button tap
  [72, 76, 79, 84, 88].forEach((n, i) => marimba(12.6 + i * 0.09, n, 1.2, i % 2 ? 0.25 : -0.25));
  [60, 64, 67, 72].forEach((n) => marimba(13.3, n, 0.9));
  pop(13.3, 84, true, 1);
  pop(14.05, 96, false, 1.2);
  marimba(14.1, 96, 1.2);
  bass(12.5, 36, 1.2);

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
if (typeof window !== 'undefined') window.renderReelAudio = renderReelAudio;
