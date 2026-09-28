/*
 * ABDUZIU — reels "coleção" (15 s, 9:16, 60 fps), em português.
 *
 * Capturado a 540×960 com densidade 2x (1080×1920 final), para a interface do jogo
 * aparecer no tamanho real de um celular. Mostra que cada objeto abduzido entra na
 * coleção, abre o catálogo de verdade do jogo (ABDUCTION DEX) e termina pedindo para a
 * galera comentar o objeto ou meme que quer ver no jogo.
 */
(() => {
  const FPS = 60;
  const g = window.__game;

  const SHOTS = [
    { id: 'coleta', t0: 0, t1: 4 },
    { id: 'catalogo', t0: 4, t1: 9 },
    { id: 'pergunta', t0: 9, t1: 15 },
  ];
  const CUTS = [4, 9];

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

  const D = { now: 0, move: { x: 0, y: 0 }, shot: null, lt: 0, t: 0, renderOn: true, state: {}, events: [], dt: 1 / FPS, defs: {}, thumbs: {} };

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
  const origAbsorbed = g.run.onAbsorbed.bind(g.run);
  g.run.onAbsorbed = (o) => {
    const d = o.def;
    if (!D.defs[d.id]) D.defs[d.id] = { name: d.name, dex: d.dex, rarity: d.rarity ?? 'normal', rarityLabel: { raro: 'raro', epico: 'épico', lendario: 'lendário', alien: 'alien', secreto: 'secreto' }[d.rarity] ?? 'comum' };
    if (D.recording) D.events.push({ t: +D.t.toFixed(4), k: 'pop', tier: d.tier, combo: g.run.combo.count + 1, id: d.id, special: !!D.state.special?.has(d.id) });
    origAbsorbed(o);
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
    if (m > cur) g.run.progression.addMatter(m - cur);
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
  function placeUfo(x, z) {
    g.ufo.spawnAt(x, z, g.stats.altitude);
    g.cameraCtl.snapTo(g.ufo.position, g.stats.scale);
  }
  function clearArea(cx, cz, hw, hd) {
    for (const o of g.world.objects) {
      if (!o.alive || o.slot !== 'static' || o.structural) continue;
      if (Math.abs(o.home.x - cx) < hw && Math.abs(o.home.z - cz) < hd) g.world.kill(o);
    }
  }
  function spawn(id, x, z, rot = 0) {
    try {
      return g.world.spawn(id, x, -1, z, rot);
    } catch {
      return null;
    }
  }
  function phoneCam(zoom = 1, tilt = 0.55) {
    D.state.cf = null;
    g.cameraCtl.override = (cam, dt) => {
      const u = g.ufo.position;
      const cf = (D.state.cf ??= { x: u.x, z: u.z });
      const k = 1 - Math.exp(-5 * (dt || 1 / 60));
      cf.x += (u.x - cf.x) * k;
      cf.z += (u.z - cf.z) * k;
      const d = (18 + g.stats.radius * 10) * zoom;
      cam.position.set(cf.x, u.y * 0.3 + d * 0.95, cf.z + d * tilt);
      cam.lookAt(cf.x, 0, cf.z - d * 0.22);
      cam.fov = 58;
      cam.updateProjectionMatrix();
    };
  }

  // ─────────────────────────────────────────────── overlay (540×960 CSS px)
  const css = document.createElement('style');
  css.textContent = `
    #ui > *:not(.hud):not(.trl-keep) { display: none !important; }
    .hud > * { display: none !important; }
    .fps-meter { display: none !important; }
    .trl-keep { display: flex !important; opacity: 1 !important; transition: none !important; }
    .trl-keep * { transition: none !important; animation: none !important; }
    #rl { position: fixed; inset: 0; z-index: 99999; pointer-events: none; overflow: hidden; font-family: 'Barlow Condensed', 'Arial Narrow', sans-serif; color: #fff; }
    #rl .layer { position: absolute; inset: 0; }
    #rl .flash { background: #fff; }
    #rl .dim { background: linear-gradient(180deg, rgba(8,6,26,0.7), rgba(8,6,26,0.9)); }
    #rl .topfade { background: linear-gradient(180deg, rgba(0,0,0,0.45) 0%, transparent 24%, transparent 78%, rgba(0,0,0,0.4) 100%); }
    #rl .cap { position: absolute; left: 22px; right: 22px; text-align: center; font-weight: 900; font-style: italic; line-height: 0.95; text-transform: uppercase;
      -webkit-text-stroke: 5px #000; paint-order: stroke fill; text-shadow: 0 4px 0 rgba(0,0,0,0.35); }
    #rl .y { color: #ffd23f; }
    #rl .gr { color: #5dffa0; }
    #rl .pk { color: #ff7ad9; }
    #rl .card { position: absolute; left: 16px; width: 280px; height: 74px; display: flex; align-items: center; gap: 10px; padding: 8px 12px 8px 8px; border-radius: 16px;
      background: rgba(10,14,30,0.86); border: 2px solid var(--c); box-shadow: 0 6px 18px rgba(0,0,0,0.4), 0 0 20px color-mix(in srgb, var(--c) 40%, transparent); }
    #rl .card img { width: 58px; height: 58px; object-fit: contain; border-radius: 10px; background: radial-gradient(circle, color-mix(in srgb, var(--c) 30%, transparent), transparent 70%); }
    #rl .card .tx { display: flex; flex-direction: column; min-width: 0; }
    #rl .card .nw { font-family: 'Chakra Petch', monospace; font-size: 11px; font-weight: 700; letter-spacing: 0.18em; color: var(--c); }
    #rl .card .nm { font-weight: 900; font-style: italic; font-size: 24px; line-height: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    #rl .card .no { font-family: 'Chakra Petch', monospace; font-size: 11px; color: #b9c3de; letter-spacing: 0.08em; margin-top: 2px; }
    #rl .count { position: absolute; right: 16px; top: 40px; padding: 6px 14px 5px; border-radius: 999px; background: rgba(0,0,0,0.6); font-family: 'Chakra Petch', monospace; font-weight: 700; font-size: 16px; }
    #rl .count b { color: #ffd23f; }
    #rl .slots { position: absolute; left: 0; right: 0; top: 300px; display: flex; justify-content: center; gap: 14px; }
    #rl .slot { width: 138px; height: 176px; border-radius: 18px; background: linear-gradient(160deg, #1d2447, #0e1228); border: 3px dashed rgba(255,210,63,0.8);
      display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px; }
    #rl .slot .q { font-weight: 900; font-size: 84px; line-height: 0.9; color: #ffd23f; -webkit-text-stroke: 4px #000; paint-order: stroke fill; }
    #rl .slot .n { font-family: 'Chakra Petch', monospace; font-weight: 700; font-size: 14px; letter-spacing: 0.12em; color: #b9c3de; }
    #rl .chips { position: absolute; left: 24px; right: 24px; top: 520px; display: flex; flex-wrap: wrap; justify-content: center; gap: 10px; }
    #rl .chip { padding: 9px 16px 8px; border-radius: 999px; background: #fff; color: #10142b; font-weight: 800; font-size: 22px; font-style: italic; box-shadow: 0 5px 0 rgba(0,0,0,0.3); white-space: nowrap; }
    #rl .chip small { font-family: 'Chakra Petch', monospace; font-style: normal; font-weight: 700; font-size: 12px; letter-spacing: 0.14em; color: #6b7394; margin-right: 6px; }
    #rl .cmt { position: absolute; left: 50%; top: 748px; display: flex; align-items: center; gap: 12px; padding: 14px 24px 12px; border-radius: 22px; background: #ffd23f; color: #1b1300;
      font-weight: 900; font-style: italic; font-size: 30px; line-height: 1; white-space: nowrap; box-shadow: 0 7px 0 #a37a00; }
    #rl .cmt svg { width: 32px; height: 32px; }
    #rl .arrow { position: absolute; left: 50%; top: 836px; width: 60px; height: 70px; margin-left: -30px; }
    #rl .foot { position: absolute; left: 0; right: 0; top: 905px; display: flex; justify-content: center; align-items: baseline; gap: 12px; }
    #rl .foot .lg { font-weight: 900; font-style: italic; font-size: 40px; background: linear-gradient(180deg, #fff3b0, #ffcf3f 45%, #ff9f1c); -webkit-background-clip: text; background-clip: text; color: transparent; filter: drop-shadow(0 3px 0 #9c5800); }
    #rl .foot .u { font-family: 'Chakra Petch', monospace; font-weight: 700; font-size: 20px; color: #5dffa0; }
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
  const dim = el('layer dim');

  // captions: [t0, t1, top, size, html]
  const CAPS = [
    [0.1, 1.95, 150, 50, 'CADA COISA QUE<br>VOCÊ <span class="y">ABDUZ...</span>'],
    [2.0, 3.95, 150, 50, '...ENTRA PRA SUA<br><span class="gr">COLEÇÃO</span>'],
    [4.15, 6.4, 770, 50, '<span class="y">142 OBJETOS</span><br>BEM BRASILEIROS'],
    [6.5, 8.95, 770, 50, 'E TEM OS <span class="pk">SECRETOS...</span>'],
    [9.1, 14.9, 110, 58, 'O QUE FALTA<br>NA <span class="y">COLEÇÃO?</span>'],
  ];
  const capEls = CAPS.map(([, , top, size, html]) => {
    const e = el('cap', html);
    e.style.top = `${top}px`;
    e.style.fontSize = `${size}px`;
    return e;
  });

  // "NOVO!" cards, fed by the real abductions of the special objects
  const CARDS = [];
  for (let i = 0; i < 4; i++) CARDS.push(el('card', '<img><div class="tx"><div class="nw">NOVO NA COLEÇÃO!</div><div class="nm"></div><div class="no"></div></div>'));
  const count = el('count', 'COLEÇÃO: <b>0</b> / 142');
  const RARITY = { normal: '#5dffa0', raro: '#4dc9ff', epico: '#c28bff', lendario: '#ffd23f', alien: '#ff7ad9', secreto: '#ff7ad9' };

  // CTA
  const slots = el('slots', `<div class="slot"><div class="q">?</div><div class="n">#143</div></div><div class="slot"><div class="q">?</div><div class="n">#144</div></div><div class="slot"><div class="q">?</div><div class="n">#145</div></div>`);
  const slotEls = [...slots.children];
  const IDEAS = ['carrinho de pamonha', 'panela de pressão da vó', 'caixão dançante', 'bebedouro da escola', 'tobogã do clube'];
  const chips = el('chips', IDEAS.map((t, i) => `<div class="chip">${i === 0 ? '<small>TIPO...</small>' : ''}${t}?</div>`).join(''));
  const chipEls = [...chips.children];
  const BUBBLE = `<svg viewBox="0 0 24 24"><path fill="#1b1300" d="M4 3h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H9l-5 4v-4H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"/></svg>`;
  const cmt = el('cmt', `${BUBBLE}<span>COMENTA O OBJETO OU MEME<br>QUE VOCÊ QUER ABDUZIR</span>`);
  cmt.querySelector('span').style.cssText = 'font-size:26px;line-height:1.02';
  const arrow = el('arrow', `<svg viewBox="0 0 60 70"><path d="M30 4v46M10 34l20 22 20-22" stroke="#fff" stroke-width="9" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>`);
  const foot = el('foot', `<span class="lg">ABDUZIU</span><span class="u">abduziu.fun</span>`);
  const podem = el('cap', 'OS MELHORES PODEM<br><span class="gr">VIRAR OBJETO NO JOGO</span>');
  podem.style.top = '668px';
  podem.style.fontSize = '30px';
  const flash = el('layer flash');

  function paint(t) {
    CAPS.forEach(([t0, t1], i) => {
      const e = capEls[i];
      if (t < t0 || t > t1) return show(e, 0);
      const a = (t - t0) / 0.18;
      const out = clamp((t1 - t) / 0.1, 0, 1);
      const s = (a < 1 ? lerp(1.8, 1, ease.back(a)) : 1 + Math.sin((t - t0) * 6) * 0.015) * (0.6 + 0.4 * out);
      const r = a < 1 ? (1 - a) * -6 : Math.sin((t - t0) * 3) * 0.8;
      show(e, Math.min(1, a * 2, out * 1.5), `scale(${s.toFixed(4)}) rotate(${r.toFixed(2)}deg)`);
    });

    // NOVO cards: the latest 4 special abductions, newest at the bottom
    const inGame = t < 4;
    const specials = D.events.filter((e) => e.special && e.t <= t);
    const shown = specials.slice(-4);
    CARDS.forEach((c, i) => {
      const e = shown[i];
      if (!e || !inGame) return show(c, 0);
      const age = t - e.t;
      const slot = shown.length - 1 - i; // 0 = newest
      const a = ease.back(age / 0.28);
      const y = 800 - slot * 84 - (1 - Math.min(1, age / 0.28)) * 10;
      const x = lerp(-280, 0, a);
      const fade = age > 1.6 ? clamp(1 - (age - 1.6) / 0.3, 0, 1) : 1;
      const def = D.defs[e.id];
      if (c.dataset.id !== e.id) {
        c.dataset.id = e.id;
        c.querySelector('img').src = D.thumbs[e.id] ?? '';
        c.querySelector('.nm').textContent = def?.name ?? e.id;
        c.querySelector('.no').textContent = `#${String(def?.dex ?? 0).padStart(3, '0')} · ${(def?.rarityLabel ?? 'COMUM').toUpperCase()}`;
        c.style.setProperty('--c', RARITY[def?.rarity ?? 'normal'] ?? '#5dffa0');
      }
      show(c, Math.min(fade, slot > 2 ? 0.6 : 1), `translate(${x.toFixed(1)}px, ${(y - 800).toFixed(1)}px) scale(${slot === 0 ? (1 + Math.max(0, 0.2 - age) * 0.8).toFixed(3) : 1})`);
      c.style.top = '800px';
    });
    const found = D.baseFound + specials.length;
    count.querySelector('b').textContent = String(found);
    show(count, inGame ? 1 : 0, `scale(${(1 + (specials.length && t - specials[specials.length - 1].t < 0.2 ? 0.12 : 0)).toFixed(3)})`);

    // CTA
    const c0 = 9;
    show(dim, t >= c0 ? ease.inOut((t - c0) / 0.4) * 0.9 : 0);
    slotEls.forEach((s, i) => {
      const k = (t - (9.4 + i * 0.18)) / 0.35;
      const wob = Math.sin((t + i) * 5) * 3;
      show(s, t >= 9.4 + i * 0.18 ? ease.out(k) : 0, `translateY(${((1 - ease.back(k)) * 60).toFixed(1)}px) rotate(${(k < 1 ? (1 - k) * 20 : wob * 0.4).toFixed(2)}deg)`);
    });
    chipEls.forEach((c, i) => {
      const t0 = 10.4 + i * 0.28;
      const k = (t - t0) / 0.25;
      show(c, t >= t0 ? ease.out(k) : 0, `scale(${lerp(0.4, 1, ease.back(k)).toFixed(3)})`);
    });
    const pk = (t - 12.2) / 0.3;
    show(podem, t >= 12.2 ? ease.out(pk) : 0, `scale(${lerp(0.6, 1, ease.back(pk)).toFixed(3)})`);
    const ck = (t - 12.7) / 0.3;
    const beat = t > 13 ? 1 + Math.sin((t - 13) * Math.PI * 4) * 0.035 : 1;
    show(cmt, t >= 12.7 ? ease.out(ck) : 0, `translateX(-50%) scale(${(lerp(0.3, 1, ease.back(ck)) * beat).toFixed(4)})`);
    show(arrow, t >= 13.1 ? ease.out((t - 13.1) / 0.2) : 0, `translateY(${(Math.abs(Math.sin((t - 13.1) * Math.PI * 2)) * 16).toFixed(1)}px)`);
    show(foot, t >= 13.4 ? ease.out((t - 13.4) / 0.3) : 0);

    let f = 0;
    for (const c of CUTS) if (t >= c && t < c + 0.14) f = Math.max(f, (1 - (t - c) / 0.14) * 0.7);
    show(flash, f);
  }

  // ─────────────────────────────────────────────── cenas
  const LINE = ['chinelo', 'galinha', 'cachorro', 'arara', 'biscoito', 'capivara', 'baiana_acaraje', 'orelhao', 'galinha_cosmica', 'preguica', 'carrinho_pipoca', 'vaca_dourada', 'jacare', 'sombrinha_frevo', 'banca_pastel'];
  D.baseFound = 81;

  async function openDex() {
    g.ensureLateScreens?.();
    const dex = g.dexScreen;
    dex.open({});
    const defs = dex.queue.map((q) => q.def);
    // a well-played save: most of the city found, the exotic ones still hidden
    const entries = {};
    const now = Date.now();
    for (const d of defs) {
      const keep = d.dex === 3 || (!d.secret && d.dex % 7 !== 0 && d.dex % 11 !== 3 && d.dex < 128);
      if (keep) entries[d.id] = { count: 1 + (d.dex * 37) % 90, firstCaptureAt: now - d.dex * 3600e3, bestCombo: 3 + (d.dex * 13) % 60 };
    }
    dex.open(entries);
    // let the thumbnail pump finish
    for (let i = 0; i < 400 && dex.queue.length; i++) await new Promise((r) => requestAnimationFrame(r));
    dex.root.classList.add('trl-keep');
    D.state.dex = dex;
    D.state.defs = defs;
  }

  const SETUP = {
    async coleta() {
      await startRun('casual', 'salvador');
      g.upgrades.levels.set('processamento', 5);
      g.upgrades.levels.set('trator_multiplo', 3);
      g.upgrades.version++;
      setMatter(180);
      const zs = g.world.roadLines.zs;
      const z = zs[2];
      const x0 = -g.world.halfSize.w * 0.3;
      clearArea(x0 + 20, z, 40, 7);
      placeUfo(x0 - 3, z);
      D.state.special = new Set(LINE);
      LINE.forEach((id, i) => spawn(id, x0 + 2 + i * 1.9, z + (i % 2 ? 1.0 : -1.0), i * 0.7));
      // fill-in snacks between them
      for (let i = 0; i < 24; i++) spawn(['lata', 'garrafa', 'coco', 'bola'][i % 4], x0 + 1 + i * 1.2, z + (i % 3) - 1);
      for (const id of LINE) D.thumbs[id] = g.thumbs.render(id);
      preroll(0.15);
      phoneCam(0.62);
      D.dt = 1 / 40; // 1.5x: ad pacing
      D.update = () => flyTo(x0 + 2 + LINE.length * 1.9 + 6, z, 1);
    },

    async catalogo() {
      await startRun('casual', 'nova_aurora');
      preroll(0.2);
      await openDex();
      const dex = D.state.dex;
      const scroll = dex.root.querySelector('.content');
      D.state.scroll = scroll;
      const max = scroll.scrollHeight - scroll.clientHeight;
      const chinelo = D.state.defs.find((d) => d.id === 'chinelo');
      D.update = (lt) => {
        // glide down the whole catalogue, pause on the funny one, keep going to the secrets
        let y;
        if (lt < 1.2) y = 0;
        else if (lt < 2.2) y = 0;
        else y = ease.inOut((lt - 2.2) / 2.6) * max;
        scroll.scrollTop = y;
        if (lt >= 0.9 && lt < 2.2) {
          if (!D.state.detail) {
            D.state.detail = true;
            dex.showDetail(chinelo);
          }
        } else if (D.state.detail) {
          D.state.detail = false;
          dex.detail.style.display = 'none';
        }
      };
    },

    async pergunta() {
      await startRun('casual', 'rio');
      setMatter(2600);
      const s = g.world.start;
      placeUfo(s.x, s.z);
      preroll(0.6);
      D.update = () => flyTo(s.x + 30, s.z, 0.15);
      g.cameraCtl.override = (cam) => {
        const u = g.ufo.position;
        const a = 2.0 + D.lt * 0.12;
        const r = 45 + g.stats.radius * 2.5;
        cam.position.set(u.x + Math.cos(a) * r, u.y - 4, u.z + Math.sin(a) * r);
        cam.lookAt(u.x, u.y + g.stats.radius * 2, u.z);
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
      D.recording = false;
      D.dt = 1 / FPS;
      g.cameraCtl.override = null;
      await SETUP[id]();
      D.state.special = new Set(id === 'coleta' ? LINE : []);
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
