/*
 * ABDUZIU — reels 15 s (9:16, 1080×1920, 60 fps), anúncio mobile em português.
 *
 * Injetado no jogo real (mesmo build de abduziu.fun). Para o loop do jogo e avança a
 * simulação com relógio fixo de 1/60 s, monta cada cena (fileiras de latinhas, boteco
 * organizado por cor, estacionamento arco-íris, a cidade inteira), roteiriza a nave e a
 * câmera e desenha a interface de anúncio por cima. Cada abdução real é registrada em
 * TRAILER.events para o som: um "pop" por objeto, no quadro exato.
 */
(() => {
  const FPS = 60;
  const g = window.__game;

  const SHOTS = [
    { id: 'lata', t0: 0, t1: 2 },
    { id: 'boteco', t0: 2, t1: 5.5 },
    { id: 'carros', t0: 5.5, t1: 9 },
    { id: 'cidade', t0: 9, t1: 12.5 },
    { id: 'fim', t0: 12.5, t1: 15 },
  ];
  const CUTS = SHOTS.map((s) => s.t0).filter((t) => t > 0);
  /** Objects already abducted before each shot (the counter keeps climbing across cuts). */
  const BASE_COUNT = { lata: 0, boteco: 14, carros: 190, cidade: 330, fim: 900 };

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, k) => a + (b - a) * k;
  const ease = {
    out: (x) => 1 - Math.pow(1 - clamp(x, 0, 1), 3),
    inOut: (x) => {
      x = clamp(x, 0, 1);
      return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
    },
    back: (x) => {
      x = clamp(x, 0, 1);
      return 1 + 2.9 * Math.pow(x - 1, 3) + 1.9 * Math.pow(x - 1, 2);
    },
  };

  const D = { now: 0, move: { x: 0, y: 0 }, shot: null, lt: 0, t: 0, renderOn: true, state: {}, events: [], dt: 1 / FPS };

  g.loop.stop();
  g.quality.setPreset('alta');
  g.quality.sample = () => {};
  g.audio.setVolumes(0, 0, 0);
  const origInputUpdate = g.input.update.bind(g.input);
  g.input.update = (now) => {
    origInputUpdate(now);
    g.input.move.set(D.move.x, D.move.y);
  };
  const origRender = g.post.render.bind(g.post);
  g.post.render = (...a) => {
    if (D.renderOn) origRender(...a);
  };
  const origRenderFrame = g.renderFrame.bind(g);
  g.renderFrame = (dt, rdt) => {
    D.beforeRender?.(dt);
    origRenderFrame(dt, rdt);
  };
  // every abduction and level-up is logged for the sound design
  const origAbsorbed = g.run.onAbsorbed.bind(g.run);
  g.run.onAbsorbed = (o) => {
    if (D.recording) D.events.push({ t: +D.t.toFixed(4), k: 'pop', tier: o.def.tier, combo: g.run.combo.count + 1 });
    origAbsorbed(o);
  };
  const origLevels = g.onLevelsGained.bind(g);
  g.onLevelsGained = (n) => {
    if (D.recording) D.events.push({ t: +D.t.toFixed(4), k: 'level' });
    origLevels(n);
  };

  function step(dt = 1 / FPS) {
    D.now += dt * 1000;
    g.frame(dt, D.now);
  }
  function preroll(seconds, dt = 1 / 30) {
    D.renderOn = false;
    for (let t = 0; t < seconds; t += dt) step(dt);
    D.renderOn = true;
  }
  async function startRun(mode, city) {
    D.renderOn = false;
    await g.startRun(mode, city);
    let n = 0;
    while (g.state !== 'playing' && n++ < 600) step(1 / 15);
    D.renderOn = true;
    g.godMode = true;
    g.damage.god = true;
  }
  function setMatter(m) {
    const cur = g.run.progression.matter;
    if (m > cur) {
      const lv = g.run.progression.addMatter(m - cur);
      if (lv > 0) origLevels(lv);
    }
  }
  function flyTo(x, z, speed = 1) {
    const dx = x - g.ufo.position.x;
    const dz = z - g.ufo.position.z;
    const d = Math.hypot(dx, dz);
    if (d < 0.8) {
      D.move.x = 0;
      D.move.y = 0;
      return d;
    }
    const s = speed * Math.min(1, d / 4);
    D.move.x = (dx / d) * s;
    D.move.y = (-dz / d) * s;
    return d;
  }
  /** Follows a polyline at a steady pace (fraction of max speed). */
  function followPath(path, speed) {
    let i = D.state.pi ?? 0;
    while (i < path.length - 1 && Math.hypot(path[i][0] - g.ufo.position.x, path[i][1] - g.ufo.position.z) < 1.6) i++;
    D.state.pi = i;
    flyTo(path[i][0], path[i][1], speed);
  }
  function placeUfo(x, z) {
    g.ufo.spawnAt(x, z, g.stats.altitude);
    g.cameraCtl.snapTo(g.ufo.position, g.stats.scale);
  }
  function block(district) {
    return g.world.blocks.find((b) => b.district === district);
  }
  function clearArea(cx, cz, hw, hd) {
    // remove the props that were already there so the arrangement reads clean
    for (const o of g.world.objects) {
      if (!o.alive || o.slot !== 'static' || o.structural) continue;
      if (Math.abs(o.home.x - cx) < hw && Math.abs(o.home.z - cz) < hd) g.world.kill(o);
    }
  }
  /** Wide, fast single beam (no satellite cones): clean rows vanishing in order. */
  function boost(big = false) {
    const L = g.upgrades.levels;
    L.set('trator_multiplo', 5);
    L.set('processamento', 5);
    L.set('campo_maior', big ? 5 : 3);
    L.set('ima_materia', 3);
    g.upgrades.version++;
  }
  function spawn(id, x, z, rot, paint) {
    try {
      return g.world.spawn(id, x, -1, z, rot, paint !== undefined ? { paint } : {});
    } catch {
      return null;
    }
  }
  const hsl = (h, s, l) => {
    const a = s * Math.min(l, 1 - l);
    const f = (n) => {
      const k = (n + h * 12) % 12;
      return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    };
    return (Math.round(f(0) * 255) << 16) | (Math.round(f(8) * 255) << 8) | Math.round(f(4) * 255);
  };
  /** Top-down-ish follow camera tuned for a vertical phone screen. */
  function phoneCam(zoom = 1, tilt = 0.55) {
    D.state.cf = null;
    g.cameraCtl.override = (cam, dt) => {
      const u = g.ufo.position;
      const cf = (D.state.cf ??= { x: u.x, z: u.z, r: g.stats.radius });
      const k = 1 - Math.exp(-5 * (dt || 1 / 60));
      cf.x += (u.x - cf.x) * k;
      cf.z += (u.z - cf.z) * k;
      cf.r += (g.stats.radius - cf.r) * (1 - Math.exp(-2.5 * (dt || 1 / 60)));
      const d = (18 + cf.r * 10) * zoom;
      cam.position.set(cf.x, u.y * 0.3 + d * 0.95, cf.z + d * tilt);
      cam.lookAt(cf.x, 0, cf.z - d * 0.22);
      cam.fov = 58;
      cam.updateProjectionMatrix();
    };
  }

  // ─────────────────────────────────────────────── ad overlay (PT-BR)
  const css = document.createElement('style');
  css.textContent = `
    #ui > *:not(.hud) { display: none !important; }
    .hud > * { display: none !important; }
    .fps-meter { display: none !important; }
    #rl { position: fixed; inset: 0; z-index: 99999; pointer-events: none; overflow: hidden; font-family: 'Barlow Condensed', 'Arial Narrow', sans-serif; color: #fff; }
    #rl .layer { position: absolute; inset: 0; }
    #rl .flash { background: #fff; }
    #rl .dim { background: linear-gradient(180deg, rgba(6,10,24,0.55), rgba(6,10,24,0.85)); }
    #rl .topfade { background: linear-gradient(180deg, rgba(0,0,0,0.45) 0%, transparent 22%, transparent 80%, rgba(0,0,0,0.35) 100%); }
    #rl .cap { position: absolute; left: 50px; right: 50px; text-align: center; font-weight: 900; font-style: italic; line-height: 0.95; text-transform: uppercase;
      -webkit-text-stroke: 10px #000; paint-order: stroke fill; text-shadow: 0 8px 0 rgba(0,0,0,0.35); }
    #rl .cap .y { color: #ffd23f; }
    #rl .cap .gr { color: #5dffa0; }
    #rl .hudbar { position: absolute; left: 50px; right: 50px; top: 90px; display: flex; flex-direction: column; gap: 14px; }
    #rl .lv { display: flex; align-items: center; gap: 16px; }
    #rl .lv .n { flex: none; min-width: 170px; padding: 10px 20px 8px; border-radius: 18px; background: #5dffa0; color: #06140d; font-weight: 900; font-style: italic; font-size: 46px; line-height: 1; text-align: center; box-shadow: 0 6px 0 #1f8a52; }
    #rl .lv .bar { flex: 1; height: 34px; border-radius: 17px; background: rgba(0,0,0,0.55); border: 4px solid #fff; overflow: hidden; position: relative; }
    #rl .lv .bar i { position: absolute; left: 0; top: 0; bottom: 0; background: linear-gradient(90deg, #5dffa0, #b8ffd6); border-radius: 12px; }
    #rl .cnt { align-self: center; padding: 10px 26px 8px; border-radius: 999px; background: rgba(0,0,0,0.55); font-family: 'Chakra Petch', monospace; font-weight: 700; font-size: 34px; letter-spacing: 0.04em; }
    #rl .cnt b { color: #ffd23f; }
    #rl .pop { position: absolute; left: 0; top: 0; font-weight: 900; font-style: italic; -webkit-text-stroke: 6px #000; paint-order: stroke fill; white-space: nowrap; }
    #rl .combo { position: absolute; right: 60px; top: 1180px; text-align: right; font-weight: 900; font-style: italic; font-size: 120px; line-height: 0.9; color: #ffd23f; -webkit-text-stroke: 10px #000; paint-order: stroke fill; }
    #rl .combo small { display: block; font-size: 42px; color: #fff; }
    #rl .hand { position: absolute; left: 0; top: 0; width: 150px; height: 150px; }
    #rl .hint { position: absolute; left: 0; right: 0; top: 1560px; text-align: center; font-family: 'Chakra Petch', monospace; font-weight: 700; font-size: 38px; letter-spacing: 0.12em; }
    #rl .logo { position: absolute; left: 0; right: 0; top: 360px; text-align: center; font-weight: 900; font-style: italic; font-size: 200px; line-height: 0.9;
      background: linear-gradient(180deg, #fff3b0 0%, #ffcf3f 45%, #ff9f1c 100%); -webkit-background-clip: text; background-clip: text; color: transparent;
      filter: drop-shadow(0 10px 0 #9c5800) drop-shadow(0 0 50px rgba(255,207,63,0.5)); padding-right: 0.05em; }
    #rl .q { position: absolute; left: 60px; right: 60px; top: 610px; text-align: center; font-weight: 900; font-style: italic; font-size: 92px; line-height: 0.95; -webkit-text-stroke: 8px #000; paint-order: stroke fill; }
    #rl .btn { position: absolute; left: 50%; top: 1010px; padding: 34px 90px 30px; border-radius: 40px; background: linear-gradient(180deg, #7dffb6, #3ddc84); color: #05210f;
      font-weight: 900; font-style: italic; font-size: 96px; line-height: 1; white-space: nowrap; box-shadow: 0 14px 0 #1b8f4d, 0 0 70px rgba(93,255,160,0.6); }
    #rl .url { position: absolute; left: 0; right: 0; top: 1250px; text-align: center; font-weight: 900; font-style: italic; font-size: 110px; color: #fff; -webkit-text-stroke: 8px #000; paint-order: stroke fill; }
    #rl .fine { position: absolute; left: 0; right: 0; top: 1400px; text-align: center; font-family: 'Chakra Petch', monospace; font-weight: 700; font-size: 34px; letter-spacing: 0.1em; color: #d9ffe9; }
    #rl .stars { position: absolute; left: 0; right: 0; top: 1480px; text-align: center; font-size: 54px; color: #ffd23f; letter-spacing: 0.12em; -webkit-text-stroke: 4px #000; paint-order: stroke fill; }
  `;
  document.head.appendChild(css);
  const root = document.createElement('div');
  root.id = 'rl';
  document.body.appendChild(root);
  const el = (cls, html = '', parent = root) => {
    const e = document.createElement('div');
    e.className = cls;
    e.innerHTML = html;
    parent.appendChild(e);
    return e;
  };
  function show(e, o, tf = '') {
    e.style.opacity = String(clamp(o, 0, 1));
    e.style.transform = tf;
    e.style.display = o <= 0.001 ? 'none' : '';
  }

  el('layer topfade');
  const hud = el('hudbar', '<div class="lv"><div class="n">NÍV. 1</div><div class="bar"><i></i></div></div><div class="cnt">ABDUZIDOS: <b>0</b></div>');
  const lvN = hud.querySelector('.n');
  const lvBar = hud.querySelector('.bar i');
  const cnt = hud.querySelector('.cnt b');

  const CAPS = [
    [0.1, 1.95, 330, 104, 'COMECEI COM<br>UMA <span class="y">LATINHA...</span>'],
    [2.05, 5.45, 330, 112, 'DEPOIS O<br><span class="y">BOTECO INTEIRO</span>'],
    [5.55, 8.95, 330, 112, 'AÍ VIERAM<br>OS <span class="gr">CARROS...</span>'],
    [9.05, 12.45, 330, 108, '...E NO FIM,<br><span class="y">A CIDADE TODA</span>'],
  ];
  const capEls = CAPS.map(([, , top, size, html]) => {
    const e = el('cap', html);
    e.style.top = `${top}px`;
    e.style.fontSize = `${size}px`;
    return e;
  });

  const combo = el('combo', '');
  const POPS = [];
  for (let i = 0; i < 26; i++) POPS.push(el('pop', ''));

  const HAND = `<svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="30" fill="rgba(255,255,255,0.35)" stroke="#fff" stroke-width="5"/><circle cx="50" cy="50" r="14" fill="#fff"/></svg>`;
  const hand = el('hand', HAND);
  const hint = el('hint', 'ARRASTE PARA ABDUZIR');

  const dim = el('layer dim');
  const logo = el('logo', 'ABDUZIU');
  const q = el('q', 'ATÉ ONDE <span style="color:#ffd23f">VOCÊ</span><br>CONSEGUE CHEGAR?');
  const btn = el('btn', 'JOGAR AGORA');
  const url = el('url', 'abduziu.fun');
  const fine = el('fine', 'GRÁTIS · SEM DOWNLOAD · CELULAR E PC');
  const stars = el('stars', '★★★★★');
  const tapHand = el('hand', HAND);
  const flash = el('layer flash');

  const _p = new window.__game.ufo.position.constructor();
  function ufoScreen() {
    _p.copy(g.ufo.position).project(g.cameraCtl.camera);
    return { x: (_p.x * 0.5 + 0.5) * innerWidth, y: (-_p.y * 0.5 + 0.5) * innerHeight };
  }

  function paint(t) {
    // captions: slam in, wiggle, pop out
    CAPS.forEach(([t0, t1], i) => {
      const e = capEls[i];
      if (t < t0 || t > t1) return show(e, 0);
      const a = (t - t0) / 0.18;
      const out = clamp((t1 - t) / 0.1, 0, 1);
      const s = (a < 1 ? lerp(1.8, 1, ease.back(a)) : 1 + Math.sin((t - t0) * 6) * 0.015) * (0.6 + 0.4 * out);
      const r = a < 1 ? (1 - a) * -6 : Math.sin((t - t0) * 3) * 0.8;
      show(e, Math.min(1, a * 2, out * 1.5), `scale(${s.toFixed(4)}) rotate(${r.toFixed(2)}deg)`);
    });

    // level + progress + counter (gameplay only)
    const playing = t < 12.5;
    show(hud, playing ? 1 : 0);
    if (playing) {
      const pr = g.run.progression;
      lvN.textContent = `NÍV. ${pr.level}`;
      lvBar.style.width = `${(clamp(pr.levelProgress, 0, 1) * 100).toFixed(1)}%`;
      const n = BASE_COUNT[D.shot.id] + D.events.filter((e) => e.k === 'pop' && e.t >= D.shot.t0 && e.t <= t).length;
      cnt.textContent = n.toLocaleString('pt-BR');
      const lastLv = [...D.events].reverse().find((e) => e.k === 'level' && e.t <= t);
      const bump = lastLv ? Math.max(0, 0.25 - (t - lastLv.t)) : 0;
      lvN.style.transform = `scale(${(1 + bump * 1.6).toFixed(3)})`;
    }

    // "+N" pops from the real abductions of the last 0.7 s
    const u = ufoScreen();
    const recent = D.events.filter((e) => e.k === 'pop' && e.t <= t && t - e.t < 0.7).slice(-POPS.length);
    POPS.forEach((pe, i) => {
      const e = recent[i];
      if (!e || !playing) return show(pe, 0);
      const age = (t - e.t) / 0.7;
      const seed = Math.sin(e.t * 9999) * 0.5 + 0.5;
      const x = u.x + (seed - 0.5) * 420;
      const y = u.y - 140 - age * 220 - seed * 60;
      const val = e.tier >= 6 ? '+100' : e.tier >= 3 ? '+10' : '+1';
      pe.textContent = val;
      pe.style.fontSize = `${e.tier >= 6 ? 88 : e.tier >= 3 ? 70 : 58}px`;
      pe.style.color = e.tier >= 6 ? '#ff7ad9' : e.tier >= 3 ? '#ffd23f' : '#5dffa0';
      const sc = age < 0.15 ? lerp(0.4, 1.25, age / 0.15) : lerp(1.25, 1, Math.min(1, (age - 0.15) * 3));
      show(pe, age > 0.7 ? (1 - age) / 0.3 : 1, `translate(-50%,-50%) translate(${x.toFixed(1)}px,${y.toFixed(1)}px) scale(${sc.toFixed(3)})`);
    });

    // combo
    const cc = playing ? g.run.combo.count : 0;
    if (cc >= 5) {
      if (cc !== D.state.lastCC) {
        D.state.lastCC = cc;
        D.state.ccT = t;
      }
      const pulse = 1 + Math.max(0, 0.15 - (t - (D.state.ccT ?? t))) * 2;
      combo.innerHTML = `x${cc}<small>${cc >= 25 ? 'FRENESI!' : 'COMBO'}</small>`;
      show(combo, 1, `scale(${pulse.toFixed(3)}) rotate(-4deg)`);
    } else show(combo, 0);

    // tutorial hand on the first shot
    if (t < 1.9) {
      const k = (t % 1.2) / 1.2;
      const hx = innerWidth * 0.5 + Math.sin(k * Math.PI * 2) * 170;
      const hy = 1330 + Math.cos(k * Math.PI * 2) * 60;
      show(hand, Math.min(1, t / 0.2, (1.9 - t) / 0.15), `translate(${(hx - 75).toFixed(1)}px,${(hy - 75).toFixed(1)}px)`);
      show(hint, Math.min(1, t / 0.2, (1.9 - t) / 0.15), `scale(${(1 + Math.sin(t * 8) * 0.03).toFixed(3)})`);
    } else {
      show(hand, 0);
      show(hint, 0);
    }

    // flash on cuts
    let f = 0;
    for (const c of CUTS) if (t >= c && t < c + 0.14) f = Math.max(f, (1 - (t - c) / 0.14) * 0.7);
    show(flash, f);

    // end card
    const e0 = 12.5;
    show(dim, t >= e0 ? ease.inOut((t - e0) / 0.4) * 0.92 : 0);
    const lk = (t - 12.6) / 0.3;
    show(logo, t >= 12.6 ? ease.out(lk) : 0, `scale(${lerp(1.6, 1, ease.back(lk)).toFixed(4)})`);
    const qk = (t - 12.95) / 0.3;
    show(q, t >= 12.95 ? ease.out(qk) : 0, `scale(${lerp(0.5, 1, ease.back(qk)).toFixed(4)})`);
    const bk = (t - 13.3) / 0.3;
    const press = t > 14.05 && t < 14.3 ? 0.93 : 1;
    const beat = t > 13.6 ? 1 + Math.sin((t - 13.6) * Math.PI * 4) * 0.03 : 1;
    show(btn, t >= 13.3 ? ease.out(bk) : 0, `translateX(-50%) scale(${(lerp(0.3, 1, ease.back(bk)) * beat * press).toFixed(4)})`);
    const uk = (t - 13.5) / 0.3;
    show(url, t >= 13.5 ? ease.out(uk) : 0, `translateY(${((1 - ease.out(uk)) * 40).toFixed(1)}px)`);
    show(fine, t >= 13.75 ? ease.out((t - 13.75) / 0.3) : 0);
    show(stars, t >= 13.9 ? ease.out((t - 13.9) / 0.3) : 0, `scale(${lerp(0.6, 1, ease.back((t - 13.9) / 0.3)).toFixed(3)})`);
    // hand taps the button
    if (t >= 13.7) {
      const k = clamp((t - 13.7) / 0.35, 0, 1);
      const tx = innerWidth * 0.5 + 180;
      const ty = lerp(1500, 1110, ease.out(k)) + (t > 14.05 && t < 14.3 ? 14 : 0);
      show(tapHand, 1, `translate(${(tx - 75).toFixed(1)}px,${ty.toFixed(1)}px) scale(${t > 14.05 && t < 14.3 ? 0.85 : 1})`);
    } else show(tapHand, 0);
  }

  // ─────────────────────────────────────────────── cenas
  const SETUP = {
    async lata() {
      await startRun('casual', 'nova_aurora');
      const s = g.world.start;
      clearArea(s.x, s.z, 40, 6);
      boost();
      placeUfo(s.x - 5, s.z);
      // a neat line of cans, then bottles
      const path = [];
      for (let i = 0; i < 26; i++) spawn(i < 16 ? 'lata' : 'garrafa', s.x - 3 + i * 0.95, s.z, 0, [0xd62828, 0xf77f00, 0x70e000, 0x3a0ca3][i % 4]);
      path.push([s.x - 3, s.z], [s.x + 26, s.z]);
      preroll(0.15);
      phoneCam(0.55);
      D.update = () => followPath(path, 0.62);
    },

    async boteco() {
      await startRun('casual', 'nova_aurora');
      boost(true);
      setMatter(230);
      const b = block('S') ?? block('P');
      clearArea(b.cx, b.cz, 28, 28);
      // rows of plastic chairs and bar tables, one colour per row
      const cols = 8;
      const rows = 10;
      const sx = 1.9;
      const sz = 2.0;
      const x0 = b.cx - ((cols - 1) * sx) / 2;
      const z0 = b.cz - ((rows - 1) * sz) / 2;
      const COL = [0xe63946, 0xf77f00, 0xfcbf49, 0x70e000, 0x2a9d8f, 0x3a86ff, 0x8338ec, 0xff4d9d];
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const id = r % 3 === 2 ? 'mesa_bar' : 'cadeira';
          spawn(id, x0 + c * sx, z0 + r * sz, 0, COL[r % COL.length]);
        }
      }
      // serpentine sweep, two rows per pass
      const path = [];
      for (let r = 0, k = 0; r < rows; r += 4, k++) {
        const z = z0 + (r + 1.5) * sz;
        const a = x0 - 2;
        const bb = x0 + (cols - 1) * sx + 2;
        if (k % 2 === 0) path.push([a, z], [bb, z]);
        else path.push([bb, z], [a, z]);
      }
      placeUfo(path[0][0] - 3, path[0][1]);
      preroll(0.1);
      phoneCam(0.8);
      D.dt = 1 / 40; // 1.5x: ad pacing
      D.update = () => followPath(path, 1);
    },

    async carros() {
      await startRun('casual', 'recife');
      boost(true);
      setMatter(620);
      const b = block('S') ?? block('P');
      clearArea(b.cx, b.cz, 28, 28);
      const cols = 6;
      const rows = 6;
      const sx = 3.0;
      const sz = 4.8;
      const x0 = b.cx - ((cols - 1) * sx) / 2;
      const z0 = b.cz - ((rows - 1) * sz) / 2;
      const MODELS = ['hatch', 'seda', 'hatch', 'besourinho'];
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          // rainbow gradient across the lot
          const hue = ((r * cols + c) / (rows * cols)) * 0.85;
          spawn(MODELS[(r + c) % MODELS.length], x0 + c * sx, z0 + r * sz, Math.PI / 2 * 0 + 0, hsl(hue, 0.85, 0.52));
        }
      }
      const path = [];
      for (let r = 0, k = 0; r < rows; r += 3, k++) {
        const z = z0 + (r + 1) * sz;
        const a = x0 - 3;
        const bb = x0 + (cols - 1) * sx + 3;
        if (k % 2 === 0) path.push([a, z], [bb, z]);
        else path.push([bb, z], [a, z]);
      }
      placeUfo(path[0][0] - 4, path[0][1]);
      preroll(0.1);
      phoneCam(0.75);
      D.dt = 1 / 40;
      D.update = () => followPath(path, 1);
    },

    async cidade() {
      await startRun('casual', 'sao_paulo');
      g.upgrades.maxAll();
      g.maxBeam = true;
      setMatter(6500);
      const f = g.world.blocks.filter((b) => b.district === 'F' || b.district === 'C');
      const b = f.sort((a, c) => Math.hypot(a.cx, a.cz) - Math.hypot(c.cx, c.cz))[0];
      placeUfo(b.cx - 60, b.cz + 10);
      preroll(0.3);
      g.run.combo.forceFrenzy();
      phoneCam(1.05, 0.5);
      D.update = () => flyTo(b.cx + 100, b.cz - 10, 0.45);
    },

    async fim() {
      await startRun('casual', 'rio');
      setMatter(2600);
      const s = g.world.start;
      placeUfo(s.x, s.z);
      preroll(0.6);
      D.update = () => flyTo(s.x + 30, s.z, 0.15);
      g.cameraCtl.override = (cam) => {
        const u = g.ufo.position;
        const a = 2.0 + D.lt * 0.15;
        const r = 45 + g.stats.radius * 2.5;
        cam.position.set(u.x + Math.cos(a) * r, u.y - 4, u.z + Math.sin(a) * r);
        cam.lookAt(u.x, u.y + g.stats.radius * 3, u.z);
        cam.fov = 62;
        cam.updateProjectionMatrix();
      };
    },
  };

  window.TRAILER = {
    FPS,
    SHOTS,
    get events() {
      return D.events;
    },
    async prepare(id) {
      const shot = SHOTS.find((s) => s.id === id);
      D.shot = shot;
      D.lt = 0;
      D.state = {};
      D.update = null;
      D.beforeRender = null;
      D.recording = false;
      D.dt = 1 / FPS;
      g.cameraCtl.override = null;
      await SETUP[id]();
      D.recording = true;
      return { f0: Math.round(shot.t0 * FPS), f1: Math.round(shot.t1 * FPS) };
    },
    frame(i, draw = true) {
      const t = i / FPS;
      D.t = t;
      D.lt = t - D.shot.t0;
      D.update?.(D.lt);
      D.renderOn = draw;
      step(D.dt);
      D.renderOn = true;
      if (draw) paint(t);
    },
    paint,
  };
})();
