/*
 * ABDUZIU × Tripo — motion v2 (1080×1920, 30 fps, 60 s): Brasília modernista × sci-fi.
 * Every layer is DOM: game footage, Tripo screen recordings (cropped, no browser chrome) as cards
 * in 3D, studio renders of the game assets and the Tripo characters, kinetic type.
 * COMP.paint(t) is deterministic: comp.mjs calls it frame by frame and screenshots.
 */
(() => {
  const W = 1080;
  const H = 1920;
  // CREW: the end card gets a second offer (TRIPOCREW) before the comment CTA (+6 s)
  const CREW = !!window.CREW;
  const CREW_SHIFT = CREW ? 4.75 : 0;
  const DUR = CREW ? 66 : 60;

  // ─── math
  const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
  const lin = (t, a, b) => clamp((t - a) / (b - a));
  const mix = (a, b, k) => a + (b - a) * k;
  const E = {
    out3: (x) => 1 - Math.pow(1 - x, 3),
    out5: (x) => 1 - Math.pow(1 - x, 5),
    in3: (x) => x * x * x,
    inOut: (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2),
    back: (x) => 1 + 2.70158 * Math.pow(x - 1, 3) + 1.70158 * Math.pow(x - 1, 2),
    expo: (x) => (x >= 1 ? 1 : 1 - Math.pow(2, -10 * x)),
  };
  /** keyframes [[t, v], [t, v, ease]...] (ease of the segment that ends on that key) */
  const kf = (t, keys) => {
    if (t <= keys[0][0]) return keys[0][1];
    for (let i = 1; i < keys.length; i++) {
      if (t <= keys[i][0]) {
        const [t0, v0] = keys[i - 1];
        const [t1, v1, e] = keys[i];
        return mix(v0, v1, (e || E.inOut)((t - t0) / (t1 - t0)));
      }
    }
    return keys[keys.length - 1][1];
  };
  const hash = (n) => {
    const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
    return s - Math.floor(s);
  };
  /** pop-in scale: 0 → 1 with overshoot */
  const pop = (t, t0, d = 0.35) => E.back(lin(t, t0, t0 + d));
  /** visible window with fades */
  const win = (t, a, b, fi = 0.2, fo = 0.2) => Math.min(lin(t, a, a + fi), 1 - lin(t, b - fo, b));

  // ─── dom
  const $ = (tag, cls, parent, html) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    parent.appendChild(e);
    return e;
  };
  const stage = document.getElementById('stage');
  let pending = [];
  function setImg(img, src) {
    if (img._src === src) return;
    img._src = src;
    img.src = src;
    pending.push(img.decode().catch(() => {}));
  }
  function place(el, { x = 0, y = 0, s = 1, r = 0, o = 1, ax = 0.5, ay = 0.5, show = true, z = 0, sx = 1 }) {
    if (!show || o <= 0.002 || s <= 0.002) {
      el.style.display = 'none';
      return;
    }
    el.style.display = '';
    el.style.opacity = o;
    el.style.transform = `translate3d(${x}px,${y}px,${z}px) translate(${-ax * 100}%,${-ay * 100}%) rotate(${r}deg) scale(${s * sx},${s})`;
  }
  const SVG = {
    arrow: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12h15M13 6l6 6-6 6"/></svg>',
    bubble: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M4 3h16a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H10l-5 4v-4H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"/></svg>',
    check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12.5l5 5L20 6"/></svg>',
    warn: '<svg viewBox="0 0 24 24"><path d="M12 2 1 21h22L12 2z" fill="#14110a"/><path d="M12 9v5" stroke="#ffd23f" stroke-width="2.6" stroke-linecap="round"/><circle cx="12" cy="17.6" r="1.5" fill="#ffd23f"/></svg>',
  };

  // ─── sources
  let COUNTS = {};
  const pad = (n, l) => String(n).padStart(l, '0');
  const cnt = (k) => COUNTS[k] || 1;
  const S = {
    clip: (name, i) => `clips/${name}/${pad(clamp(Math.floor(i), 0, cnt('clips/' + name) - 1), 4)}.jpg`,
    game: (name, i) => `frames/${name}/${pad(clamp(Math.floor(i), 0, cnt('frames/' + name) - 1), 5)}.jpg`,
    st: (c, k, i) => {
      const n = cnt(`studio/${c}/${k}`);
      return `studio/${c}/${k}/${pad(((Math.floor(i) % n) + n) % n, 3)}.png`;
    },
    obj: (id) => `studio/obj/${id}.png`,
  };
  const SIZE = {
    home: [1000, 495], dash: [1786, 595], upload: [1786, 595], turn: [550, 510], rig: [1160, 587], uv: [1160, 587], retopo: [1160, 587],
    tex: [1160, 587], back: [550, 510], man: [630, 595], guid: [780, 595], gtex: [780, 595], topo: [400, 577], gen: [1260, 587],
  };

  // ─── components
  /** A rounded card in 3D showing an image (cover + zoom/focus). */
  class Card {
    constructor(parent, cls = '') {
      this.el = $('div', 'card ' + cls, parent);
      this.img = $('img', '', this.el);
    }
    set(o) {
      const { src, size, x = 540, y = 960, w, h, rx = 0, ry = 0, rz = 0, s = 1, z = 0, op = 1, zoom = 1, fx = 0.5, fy = 0.5, show = true, filter = '' } = o;
      const e = this.el;
      if (!show || op <= 0.002 || s <= 0.002) {
        e.style.display = 'none';
        return;
      }
      e.style.display = 'block';
      e.style.width = w + 'px';
      e.style.height = h + 'px';
      e.style.opacity = op;
      e.style.transform = `translate3d(${x - w / 2}px,${y - h / 2}px,${z}px) rotateX(${rx}deg) rotateY(${ry}deg) rotateZ(${rz}deg) scale(${s})`;
      if (src) {
        setImg(this.img, src);
        const [sw, sh] = size;
        const sc = Math.max(w / sw, h / sh) * zoom;
        const iw = sw * sc;
        const ih = sh * sc;
        const l = clamp(w / 2 - fx * iw, w - iw, 0);
        const t = clamp(h / 2 - fy * ih, h - ih, 0);
        const st = this.img.style;
        st.width = iw + 'px';
        st.height = ih + 'px';
        st.left = l + 'px';
        st.top = t + 'px';
        st.filter = filter;
      }
    }
  }
  /** Transparent PNG floating in space. */
  class Sprite {
    constructor(parent, cls = '') {
      this.el = $('div', 'sprite ' + cls, parent);
      this.img = $('img', '', this.el);
    }
    set({ src, x = 540, y = 960, w = 600, h = 600, r = 0, s = 1, op = 1, show = true, filter = '', ry = 0, z = 0 }) {
      const e = this.el;
      if (!show || op <= 0.002 || s <= 0.002) {
        e.style.display = 'none';
        return;
      }
      e.style.display = 'block';
      e.style.width = w + 'px';
      e.style.height = h + 'px';
      e.style.opacity = op;
      e.style.filter = filter;
      e.style.transform = `translate3d(${x - w / 2}px,${y - h / 2}px,${z}px) rotateY(${ry}deg) rotate(${r}deg) scale(${s})`;
      if (src) setImg(this.img, src);
    }
  }
  /**
   * Kinetic headline. lines: 'WORD WORD' or {t, size, cls}; a word may start with [cls] (hl, gr, yl, ol, vid...)
   * and use _ for a space that stays inside the same masked word.
   */
  class Title {
    constructor(parent, lines, { size = 120, y = 300, cls = '', lh = 1.12 } = {}) {
      this.el = $('div', 'h ' + cls, parent);
      Object.assign(this.el.style, { top: y + 'px', fontSize: size + 'px', lineHeight: lh });
      this.words = [];
      for (const line of lines) {
        const L = typeof line === 'string' ? { t: line } : line;
        const ln = $('div', 'ln' + (L.cls ? ' ' + L.cls : ''), this.el);
        if (L.size) ln.style.fontSize = L.size + 'px';
        L.t.split(' ').forEach((wd, i, arr) => {
          const m = wd.match(/^\[(\w+)\](.*)$/);
          const w = $('span', 'w' + (m ? ' ' + m[1] : ''), ln);
          this.words.push($('span', '', w, (m ? m[2] : wd).replace(/_/g, '&nbsp;')));
          if (i < arr.length - 1) ln.appendChild(document.createTextNode(' '));
        });
      }
    }
    paint(lt, tin, tout = 1e9, { st = 0.045, d = 0.4, od = 0.24, from = 1 } = {}) {
      const n = this.words.length;
      const vis = lt >= tin - 0.001 && lt < tout + od + n * 0.02;
      this.el.style.display = vis ? 'block' : 'none';
      if (!vis) return;
      this.words.forEach((w, i) => {
        const p = E.out5(lin(lt, tin + i * st, tin + i * st + d));
        const q = E.in3(lin(lt, tout + i * 0.02, tout + i * 0.02 + od));
        const ty = (1 - p) * 118 * from - q * 118;
        w.style.transform = `translateY(${ty}%)`;
      });
    }
  }
  const chip = (parent, html, cls = '') => $('div', 'chip ' + cls, parent, html);


  // ─── scenes
  const SCENES = [];
  const MEASURE = [];
  function scene(t0, t1, opt, init) {
    const root = $('div', 'scene', stage);
    if (opt.bg) root.style.background = opt.bg;
    if (opt.cls) root.classList.add(opt.cls);
    const s = { t0, t1, pre: opt.pre || 0, post: opt.post || 0, root };
    s.paint = init(root, s);
    SCENES.push(s);
    return s;
  }
  const CONCRETE = '#ece8df';
  const BULCAO = [
    'radial-gradient(circle at 0 0, #fffdf8 49.5%, #1d4ed8 50%)',
    'linear-gradient(135deg, #1d4ed8 50%, #fffdf8 50%)',
    'radial-gradient(circle, #fffdf8 29%, #1d4ed8 30%)',
    'linear-gradient(90deg, #fffdf8 34%, #1d4ed8 34% 66%, #fffdf8 66%)',
    'radial-gradient(circle at 100% 100%, #1d4ed8 49.5%, #fffdf8 50%)',
  ];
  const WALL = ['onibus', 'cadeira', 'poste', 'botijao', 'taxi', 'arvore', 'caixa_dagua', 'van', 'cone', 'semaforo', 'moto', 'opala', 'ipe', 'lixeira',
    'carrinho_mercado', 'orelhao', 'sofa', 'brasilia_amarela', 'geladeira', 'helicoptero', 'vaca', 'placa_rua', 'churrasqueira', 'uno_escada',
    'carrinho_pipoca', 'isopor', 'guarda_sol', 'caramelo_dourado', 'hatch', 'galinha', 'banca_pastel', 'mototaxi', 'carro_pamonha', 'caminhao_gas',
    'carrinho_churros', 'cachorro', 'quadradinho', 'moto_entrega', 'cadeira_praia', 'carrinho_rolima'];

  // HOOK ─ 0 → 4.5: Brasília seen through the saucer's lens
  scene(0, 4.5, { bg: CONCRETE }, (root) => {
    const ticks = $('div', 'ticks', root);
    ticks.style.background = 'repeating-conic-gradient(#0f1013 0 1deg, transparent 1deg 6deg)';
    ticks.style.webkitMask = ticks.style.mask = 'radial-gradient(circle, transparent 66%, #000 66.5% 70%, transparent 70.5%)';
    const ring = $('div', 'ring', root);
    const lens = $('div', 'lens', root);
    const img = $('img', '', lens);
    Object.assign(img.style, { position: 'absolute', width: '1080px', height: '1920px', maxWidth: 'none' });
    const lat = $('div', 'mono abs', root, '15°47′S');
    const lon = $('div', 'mono abs', root, '47°52′W');
    for (const e of [lat, lon]) Object.assign(e.style, { fontSize: '26px', color: '#0f1013' });
    const grad = $('div', 'fill', root);
    grad.style.background = 'linear-gradient(rgba(10,11,14,.6), rgba(10,11,14,0) 30%, rgba(10,11,14,0) 50%, rgba(10,11,14,.85) 85%)';
    const t1 = new Title(root, ['E SE DESSE PRA'], { size: 62, y: 270 });
    const t2 = new Title(root, ['ABDUZIR'], { size: 132, y: 1235 });
    const t3 = new Title(root, ['[hl]BRASÍLIA_INTEIRA?'], { size: 62, y: 1395 });
    const t4 = new Title(root, ['EU CRIEI UM GAME', 'PRA ABDUZIR', { t: '[hl]QUASE_TUDO.', size: 104 }], { size: 64, y: 1110, cls: 'wht' });
    const logo = $('div', 'logo', root, 'ABDUZIU<span>.FUN</span>');
    const CY = 830;
    return (lt) => {
      const src = S.game('ideia', 70 + lt * 30);
      setImg(img, src);
      const D = kf(lt, [[0, 0], [0.5, 700, E.out5], [2.35, 740], [2.95, 2400, E.inOut]]);
      lens.style.width = lens.style.height = D + 'px';
      lens.style.transform = `translate(${540 - D / 2}px, ${CY - D / 2}px)`;
      img.style.left = -(540 - D / 2) + 'px';
      img.style.top = -(CY - D / 2) + 'px';
      img.style.transform = `scale(${mix(1.15, 1.02, lin(lt, 0, 4.5))})`;
      img.style.transformOrigin = `540px ${CY}px`;
      const rD = D + 46;
      ring.style.width = ring.style.height = rD + 'px';
      place(ring, { x: 540, y: CY, o: 1 - lin(lt, 2.4, 2.7) });
      const tD = D + 150;
      ticks.style.width = ticks.style.height = tD + 'px';
      place(ticks, { x: 540, y: CY, r: lt * 25, o: lin(lt, 0.2, 0.6) * (1 - lin(lt, 2.4, 2.7)) });
      place(lat, { x: 540 - D / 2 - 92, y: CY, ax: 1, o: lin(lt, 0.5, 0.8) * (1 - lin(lt, 2.3, 2.5)) });
      place(lon, { x: 540 + D / 2 + 92, y: CY, ax: 0, o: lin(lt, 0.5, 0.8) * (1 - lin(lt, 2.3, 2.5)) });
      t1.paint(lt, 0.1, 2.25);
      t2.paint(lt, 0.4, 2.25, { d: 0.35 });
      t3.paint(lt, 0.9, 2.25);
      grad.style.opacity = lin(lt, 2.8, 3.2);
      t4.paint(lt, 2.95, 1e9, { st: 0.06 });
      const lp = lin(lt, 3.35, 3.6);
      place(logo, { x: 0, y: 300, ax: 0, ay: 0, o: lp, s: mix(1.3, 1, E.out5(lp)) });
      logo.style.transformOrigin = '540px 50px';
    };
  });

  // PROTÓTIPO ─ 4.5 → 8: the same city in grey boxes, cut into ministry blocks
  scene(4.5, 8, { bg: CONCRETE }, (root) => {
    const N = 7;
    const X0 = 64;
    const AW = 952;
    const GAP = 8;
    const SW = (AW - GAP * (N - 1)) / N;
    const Y0 = 470;
    const AH = 940;
    const sc = Math.max(AW / 1080, AH / 1920);
    const strips = Array.from({ length: N }, (_, i) => {
      const st = $('div', 'strip', root);
      const img = $('img', '', st);
      Object.assign(img.style, { width: 1080 * sc + 'px', height: 1920 * sc + 'px', left: -(i * (SW + GAP)) - (1080 * sc - AW) / 2 + 'px', top: (AH - 1920 * sc) / 2 + 'px' });
      Object.assign(st.style, { width: SW + 'px', height: AH + 'px', left: X0 + i * (SW + GAP) + 'px', top: Y0 + 'px' });
      return { st, img };
    });
    const tA = new Title(root, ['O PROTÓTIPO', '[hl]FUNCIONAVA.'], { size: 70, y: 220 });
    const tB = new Title(root, ['MAS ERA SÓ', '[hk]CAIXA_CINZA.'], { size: 70, y: 220 });
    const l1 = $('div', 'mono abs', root, 'BLOCKOUT_V0.1');
    const l2 = $('div', 'mono abs', root, 'SEM ASSETS');
    for (const e of [l1, l2]) Object.assign(e.style, { fontSize: '26px', color: '#0f1013' });
    return (lt) => {
      const src = S.game('proto', 10 + lt * 30);
      strips.forEach((s, i) => {
        setImg(s.img, src);
        const a = E.out5(lin(lt, 0.05 + i * 0.05, 0.6 + i * 0.05));
        const b = E.in3(lin(lt, 3.0 + i * 0.03, 3.35 + i * 0.03));
        const dir = i % 2 ? 1 : -1;
        s.st.style.transform = `translateY(${(1 - a) * dir * 1300 + b * -dir * 1300}px)`;
      });
      tA.paint(lt, 0.1, 1.45);
      tB.paint(lt, 1.6, 3.1);
      place(l1, { x: 64, y: 1440, ax: 0, ay: 0, o: lin(lt, 0.6, 0.8) * (1 - lin(lt, 3.0, 3.2)) });
      place(l2, { x: 1016, y: 1440, ax: 1, ay: 0, o: lin(lt, 0.7, 0.9) * (1 - lin(lt, 3.0, 3.2)) });
    };
  });

  // ASSETS ─ 8 → 11.5: Athos Bulcão tiles flip into game assets
  const CATS = ['CARROS', 'ÔNIBUS', 'PLACAS', 'POSTES', 'ÁRVORES', 'PRÉDIOS', 'OBJETOS URBANOS', 'MEMES', 'COLECIONÁVEIS'];
  scene(8, 11.5, { bg: CONCRETE }, (root) => {
    const grid = $('div', 'tilegrid', root);
    grid.style.perspective = '1600px';
    const tiles = [];
    for (let r = 0; r < 9; r++)
      for (let c = 0; c < 6; c++) {
        const i = r * 6 + c;
        const t = $('div', 'tile', grid);
        t.style.left = c * 180 + 'px';
        t.style.top = r * 180 + 'px';
        const f = $('div', 'f', t);
        f.style.background = BULCAO[(r * 3 + c * 2) % BULCAO.length];
        f.style.transform = `rotate(${((r + c) % 4) * 90}deg)`;
        const b = $('div', 'b', t);
        const img = $('img', '', b);
        img.src = S.obj(WALL[(i * 7) % WALL.length]);
        tiles.push({ t, at: 0.25 + ((i * 0.618) % 1) * 1.5 });
      }
    const band = $('div', 'abs', root);
    Object.assign(band.style, { width: '1080px', height: '470px', background: CONCRETE });
    const tA = new Title(root, ['EU PRECISAVA DE', '[hb]MUITOS_ASSETS_3D.'], { size: 66, y: 215 });
    const cat = chip(root, '', 'k');
    return (lt) => {
      grid.style.transform = `translateY(${470 - lt * 50}px)`;
      for (const x of tiles) {
        const p = E.inOut(lin(lt, x.at, x.at + 0.4));
        const out = E.in3(lin(lt, 3.0 + x.at * 0.1, 3.35 + x.at * 0.1));
        x.t.style.transform = `rotateY(${p * 180}deg) translateY(${out * -1600}px)`;
      }
      tA.paint(lt, 0.05, 3.1);
      const k = Math.floor((lt - 0.9) / 0.24);
      if (lt >= 0.9 && k < CATS.length) {
        cat.textContent = CATS[k];
        place(cat, { x: 540, y: 405, s: mix(1.25, 1, E.out5(((lt - 0.9) % 0.24) / 0.12)) });
      } else place(cat, { show: false });
    };
  });

  // TRIPO ─ 11.5 → 14
  scene(11.5, 14, { bg: '#ffd23f' }, (root) => {
    const rows = [
      [470, 1, 'solid'],
      [1130, -1, 'out'],
      [1370, 1, 'solid'],
    ].map(([y, dir, kind]) => {
      const r = $('div', 'h', root, 'TRIPO TRIPO TRIPO TRIPO TRIPO');
      Object.assign(r.style, { top: y + 'px', width: '6000px', textAlign: 'left', fontSize: '230px', letterSpacing: '-.04em' });
      if (kind === 'out') Object.assign(r.style, { color: 'transparent', webkitTextStroke: '4px #0f1013' });
      return { r, dir };
    });
    const tA = new Title(root, ['ENTÃO EU USEI A'], { size: 60, y: 230 });
    const home = new Card(root, 'lt');
    const c1 = chip(root, `IMAGEM ${SVG.arrow} 3D`, 'k');
    const c2 = chip(root, `TEXTO ${SVG.arrow} 3D`, 'v');
    return (lt) => {
      rows.forEach(({ r, dir }, i) => (r.style.transform = `translateX(${(dir > 0 ? -700 : -1500) + dir * lt * 420 + i * 60}px)`));
      tA.paint(lt, 0, 2.2);
      const a = E.out5(lin(lt, 0.05, 0.6));
      home.set({
        src: S.clip('home', lt * 30), size: SIZE.home, w: 952, h: 471, x: 540, y: mix(1500, 860, a), rz: mix(8, -2, a), rx: mix(30, 0, a),
        zoom: mix(1, 1.15, lin(lt, 0.5, 2.5)), op: 1,
      });
      place(c1, { x: 230, y: 640, r: -5, s: pop(lt, 0.9) });
      place(c2, { x: 860, y: 1085, r: 4, s: pop(lt, 1.1) });
    };
  });

  // RECURSOS ─ 14 → 44: ten numbered Tripo features, 3 s each, pushed sideways
  const FT0 = 14;
  const FD = 3;
  const FEATURES = [
    ['GERAÇÃO 3D', 'Imagem ou texto viram <b>modelo 3D</b>.'],
    ['MULTIVIEW', 'Várias vistas, <b>um só modelo</b>.'],
    ['TEXTURA · PBR', 'Textura, material e <b>identidade</b>.'],
    ['SMART MESH P2.0', 'Malha inteligente, <b>pronta pra jogo</b>.'],
    ['QUAD TOPOLOGY', 'De <b>500 a 25 mil faces</b>, em quads.'],
    ['MESH EDIT', 'Ajusta <b>só a região</b> que precisa.'],
    ['SMART UV', 'UV desdobrada <b>no automático</b>.'],
    ['RIGGING', 'Esqueleto <b>pronto pra animar</b>.'],
    ['TEXT TO MOTION', 'Escreve o movimento. <b>Ele anima.</b>'],
    ['EXPORT GLB', 'Exporta em GLB e <b>joga no jogo</b>.'],
  ];
  // each feature: (group) => (l: 0..3) => void
  const FPAINT = [
    // 01 geração 3D
    (g) => {
      const A = new Card(g, 'y');
      const B = new Card(g, 'g');
      const c = chip(g, `IMAGEM ${SVG.arrow} 3D`, 'w');
      return (l) => {
        const a = E.out5(lin(l, 0, 0.45));
        A.set({ src: S.clip('upload', 150 + l * 20), size: SIZE.upload, w: 440, h: 620, x: 290, y: mix(1100, 900, a), ry: 12, rz: -2, zoom: 2.6, fx: 0.0745, fy: 0.3, op: a });
        const b = E.out5(lin(l, 0.55, 1.0));
        B.set({ src: S.clip('man', 95 + l * 30), size: SIZE.man, w: 460, h: 660, x: mix(1300, 790, b), y: 950, ry: -12, rz: 2, zoom: 1.12, fy: 0.42 });
        place(c, { x: 540, y: 1300, s: pop(l, 1.0) });
      };
    },
    // 02 multiview
    (g) => {
      const V = [[255, 295, 730, 'FRENTE'], [238, 785, 730, '3/4'], [286, 295, 1150, 'LADO'], [300, 785, 1150, 'COSTAS']].map(([base, x, y, lb]) => ({
        base, x, y, card: new Card(g, 'g'), ch: chip(g, lb, 'k'),
      }));
      const hero = new Sprite(g);
      return (l) => {
        const m = E.inOut(lin(l, 1.7, 2.1));
        V.forEach((v, i) => {
          const f = E.back(lin(l, 0.05 + i * 0.15, 0.4 + i * 0.15));
          v.card.set({ src: S.clip('gtex', v.base + Math.round(Math.sin(l * 2 + i) * 3)), size: SIZE.gtex, w: 400, h: 400, x: mix(v.x, 540, m), y: mix(v.y, 930, m),
            ry: mix(90, 0, f), rz: m * (i - 1.5) * 8, s: mix(1, 0.5, m), zoom: 1.6, fy: 0.24, op: (f > 0.02 ? 1 : 0) * (1 - lin(l, 2.0, 2.15)) });
          place(v.ch, { x: v.x - 180, y: v.y + 180, ax: 0, ay: 1, s: pop(l, 0.3 + i * 0.15, 0.3), o: 1 - m });
        });
        hero.set({ src: S.st('cabeca_guidao', 'turn', l * 30), x: 540, y: 930, w: 840, h: 840, s: pop(l, 2.0, 0.4), filter: 'drop-shadow(0 0 40px rgba(43,255,136,.35))' });
      };
    },
    // 03 textura · PBR
    (g) => {
      const CW = 952;
      const CH = 860;
      const cmp = $('div', 'card', g);
      Object.assign(cmp.style, { width: CW + 'px', height: CH + 'px', transform: `translate(64px, ${930 - CH / 2}px)` });
      const clay = $('img', '', cmp);
      const txw = $('div', 'fill', cmp);
      const tex = $('img', '', txw);
      const line = $('div', 'abs', cmp);
      Object.assign(line.style, { width: '8px', height: '1200px', top: '-150px', background: '#fff', boxShadow: '0 0 30px 6px rgba(43,255,136,.8)' });
      const lc = chip(cmp, 'MALHA', 'k');
      const rc = chip(cmp, 'TEXTURA', 'y');
      const chips = [[chip(g, 'PBR', 'v'), 900, 520, 4, 0.9], [chip(g, 'TEXTURA 8K', 'y'), 230, 1350, -3, 1.3], [chip(g, 'REMOVER ILUMINAÇÃO', 'w'), 700, 1350, 2, 1.6]];
      const sc = Math.max(CW / 780, CH / 595) * 1.12;
      return (l) => {
        for (const [im, src] of [[clay, S.clip('guid', 120 + l * 30)], [tex, S.clip('gtex', l * 30)]]) {
          setImg(im, src);
          Object.assign(im.style, { width: 780 * sc + 'px', height: 595 * sc + 'px', left: CW / 2 - 0.5 * 780 * sc + 'px', top: CH / 2 - 0.45 * 595 * sc + 'px' });
        }
        const wx = kf(l, [[0, CW + 160], [0.35, CW + 160], [2.4, -160, E.inOut]]);
        txw.style.clipPath = `polygon(${wx + 150}px 0, ${CW}px 0, ${CW}px ${CH}px, ${wx - 150}px ${CH}px)`;
        line.style.left = wx + 'px';
        line.style.transform = `rotate(${Math.atan2(300, CH) * 57.3}deg)`;
        place(lc, { x: 28, y: 28, ax: 0, ay: 0 });
        place(rc, { x: CW - 28, y: 28, ax: 1, ay: 0 });
        for (const [c, x, y, r, t] of chips) place(c, { x, y, r, s: pop(l, t) });
      };
    },
    // 04 smart mesh P2.0
    (g) => {
      const A = new Card(g, 'g');
      const B = new Card(g);
      const c = chip(g, 'MALHA SMART · P2.0', 'y');
      return (l) => {
        A.set({ src: S.clip('retopo', l * 24), size: SIZE.retopo, w: 952, h: 482, x: 540, y: 735, zoom: kf(l, [[0, 1], [0.7, 1], [2.4, 2.1]]), fx: 0.753, fy: 0.46,
          rx: mix(25, 0, E.out5(lin(l, 0, 0.5))) });
        const b = E.out5(lin(l, 0.5, 1.0));
        B.set({ src: S.clip('gen', 150 + l * 30), size: SIZE.gen, w: 952, h: 300, x: 540, y: mix(1500, 1200, b), zoom: 2.3, fx: 0.69, fy: 0.47, op: b });
        place(c, { x: 1000, y: 500, ax: 1, r: 3, s: pop(l, 0.8) });
      };
    },
    // 05 quad topology 500 → 25K
    (g) => {
      const counter = $('div', 'counter', g);
      const slider = $('div', 'slider', g, '<div class="fb"></div><div class="kn"></div><div class="lo">500</div><div class="hi">25K</div>');
      const topo = new Card(g, 'y');
      const wire = new Card(g, 'g');
      const c = chip(g, 'QUAD', 'w');
      return (l) => {
        const k = E.inOut(lin(l, 0.3, 1.9));
        counter.innerHTML = (Math.round(mix(500, 25000, k) / 100) * 100).toLocaleString('pt-BR') + '<small>FACES</small>';
        place(counter, { x: 64, y: 500, ax: 0, ay: 0, o: lin(l, 0.05, 0.25) });
        place(slider, { x: 64, y: 700, ax: 0, ay: 0, o: lin(l, 0.1, 0.3) });
        slider.children[0].style.width = k * 100 + '%';
        slider.children[1].style.left = k * 100 + '%';
        const a = E.out5(lin(l, 0.4, 0.9));
        topo.set({ src: S.clip('topo', 60 + l * 30), size: SIZE.topo, w: 360, h: 520, x: 250, y: mix(1500, 1080, a), rz: -3, op: a });
        const b = E.out5(lin(l, 0.6, 1.1));
        wire.set({ src: S.clip('man', 240 + l * 10), size: SIZE.man, w: 520, h: 560, x: 745, y: mix(1500, 1090, b), rz: 2, zoom: 2.4, fx: 0.5, fy: 0.5, op: b, filter: 'contrast(1.2)' });
        place(c, { x: 930, y: 830, s: pop(l, 1.2), r: 4 });
      };
    },
    // 06 mesh edit
    (g) => {
      const big = new Card(g, 'g');
      const box = $('div', 'selbox', g, '<div class="fx"><div class="q"></div><div class="bar"></div></div>');
      const fx = box.firstChild;
      const q = fx.children[0];
      const bar = fx.children[1];
      const tag = chip(g, 'MESH EDIT', 'k');
      const st = chip(g, '', 'w');
      return (l) => {
        big.set({ src: S.clip('man', 240 + l * 10), size: SIZE.man, w: 952, h: 880, x: 540, y: 930, zoom: 1.85, fx: 0.495, fy: 0.27, filter: 'contrast(1.12)',
          s: mix(0.92, 1, E.out5(lin(l, 0, 0.4))) });
        const bx = E.out3(lin(l, 0.35, 0.65));
        const bw = mix(30, 470, bx);
        const bh = mix(30, 410, bx);
        box.style.width = bw + 'px';
        box.style.height = bh + 'px';
        place(box, { x: 540, y: 720, o: l > 0.35 ? 1 : 0 });
        const rg = lin(l, 0.8, 2.0);
        const sn = Math.sin(rg * Math.PI);
        fx.style.backdropFilter = `brightness(${1 + 0.5 * sn}) saturate(${1 - sn * 0.8}) blur(${rg > 0 && rg < 1 ? (1 - rg) * 7 : 0}px)`;
        fx.style.background = `rgba(43,255,136,${0.06 + 0.16 * sn})`;
        q.style.opacity = sn * (0.4 + 0.3 * hash(Math.floor(l * 30)));
        bar.style.top = mix(-60, bh, rg) + 'px';
        bar.style.display = rg > 0 && rg < 1 ? '' : 'none';
        place(tag, { x: 540 - bw / 2, y: 720 - bh / 2 - 12, ax: 0, ay: 1, s: pop(l, 0.6, 0.3) });
        st.innerHTML = rg >= 1 ? `${SVG.check} REGENERADA` : 'REGENERANDO…';
        place(st, { x: 540, y: 720 + bh / 2 + 40, ay: 0, s: pop(l, 0.85, 0.3) });
      };
    },
    // 07 smart UV
    (g) => {
      const card = new Card(g, 'y');
      const atlas = $('div', 'abs', g);
      Object.assign(atlas.style, { width: '440px', height: '440px', border: '3px solid rgba(255,255,255,.7)', borderRadius: '10px' });
      const COLS = ['#2bff88', '#ffc300', '#7b61ff', '#ffffff', '#1d4ed8', '#ff6b9a', '#2bff88', '#ffc300', '#ffffff'];
      const pieces = Array.from({ length: 9 }, (_, i) => {
        const p = $('div', 'abs', atlas);
        Object.assign(p.style, { width: '132px', height: '132px', borderRadius: '6px',
          background: `repeating-conic-gradient(${COLS[i]} 0 25%, #15171c 0 50%) 0 0 / 33px 33px`, boxShadow: '0 0 0 3px #0f1013' });
        return { p, i, sx: (hash(i + 3) - 0.5) * 900, sy: (hash(i + 9) - 0.5) * 700, sr: (hash(i + 5) - 0.5) * 300 };
      });
      const c1 = chip(g, 'DESDOBRAR UV', 'y');
      return (l) => {
        card.set({ src: S.clip('uv', 60 + l * 20), size: SIZE.uv, w: 952, h: 500, x: 540, y: 740, zoom: 3.6, fx: 0.147, fy: 0.385, s: mix(0.9, 1, E.out5(lin(l, 0, 0.4))) });
        place(atlas, { x: 540, y: 1200, o: lin(l, 0.4, 0.6) });
        pieces.forEach((x) => {
          const k = E.out5(lin(l, 0.6 + x.i * 0.08, 1.3 + x.i * 0.08));
          const tx = 10 + (x.i % 3) * 142;
          const ty = 10 + Math.floor(x.i / 3) * 142;
          x.p.style.transform = `translate(${mix(tx + x.sx, tx, k)}px, ${mix(ty + x.sy, ty, k)}px) rotate(${mix(x.sr, 0, k)}deg)`;
          x.p.style.opacity = lin(l, 0.5 + x.i * 0.08, 0.7 + x.i * 0.08);
        });
        place(c1, { x: 900, y: 990, r: 4, s: pop(l, 0.9) });
      };
    },
    // 08 rigging
    (g) => {
      const panel = new Card(g, 'y');
      const rig = new Sprite(g);
      const glow = $('div', 'abs', g);
      Object.assign(glow.style, { width: '820px', height: '820px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(43,255,136,.28), transparent 65%)' });
      const chips = [[chip(g, 'HUMANOIDE', 'k'), 860, 520, -3, 0.5], [chip(g, 'MIXAMO', 'w'), 880, 1330, 3, 0.7], [chip(g, 'AUTO RIG', 'y'), 260, 1340, -3, 0.9]];
      return (l) => {
        const a = E.out5(lin(l, 0, 0.5));
        panel.set({ src: S.clip('rig', 12 + l * 22), size: SIZE.rig, w: 420, h: 700, x: mix(-250, 250, a), y: 930, ry: 16, rz: -3, zoom: 1.02, fx: 0.15, fy: 0.5 });
        place(glow, { x: 700, y: 930, o: lin(l, 0.2, 0.5) });
        rig.set({ src: S.st('huehue', 'rig', l * 22), x: 700, y: 930, w: 780, h: 780, s: pop(l, 0.15, 0.45) });
        for (const [c, x, y, r, t] of chips) place(c, { x, y, r, s: pop(l, t) });
      };
    },
    // 09 text to motion
    (g) => {
      const box = $('div', 'prompt', g);
      const tag = chip(g, 'PROMPT', 'v');
      const go = chip(g, 'GERAR', 'y');
      const R = [['huehue', 'HUEHUE', 210, 0], ['cabeca_guidao', 'CABEÇA DE GUIDÃO', 540, 7], ['manoel_gomes', 'MANOEL GOMES', 870, 15]].map(([id, name, x, off]) => ({
        id, x, off, sp: new Sprite(g), ch: chip(g, name, 'k'),
      }));
      const P = 'correndo em pânico do OVNI';
      return (l) => {
        const n = Math.floor(lin(l, 0.1, 0.85) * P.length);
        const cur = n < P.length || Math.floor(l * 4) % 2 === 0 ? '<span style="color:#7b61ff">|</span>' : '';
        box.innerHTML = P.slice(0, n) + cur;
        place(box, { x: 64, y: 560, ax: 0, ay: 0, o: lin(l, 0, 0.15) });
        place(tag, { x: 64, y: 540, ax: 0, ay: 1, s: pop(l, 0.05, 0.3) });
        place(go, { x: 990, y: 610, ax: 1, s: pop(l, 0.9, 0.25) });
        R.forEach((r, i) => {
          r.sp.set({ src: S.st(r.id, 'run', l * 30 + r.off), x: r.x, y: 1060, w: 380, h: 570, s: pop(l, 1.0 + i * 0.1, 0.4) });
          place(r.ch, { x: r.x, y: 1370, s: 0.72 * pop(l, 1.2 + i * 0.1, 0.3) });
        });
      };
    },
    // 10 export GLB → the game
    (g) => {
      const win = new Card(g, 'g');
      const file = $('div', 'file', g, '<div class="badge">GLB</div>manoel_gomes.glb');
      const ring = $('div', 'abs', g);
      Object.assign(ring.style, { width: '400px', height: '400px', borderRadius: '50%', border: '8px solid #2bff88' });
      const ok = chip(g, `${SVG.check} ASSET NO JOGO`);
      return (l) => {
        win.set({ src: S.game('payoff', 20 + l * 30), size: [1080, 1920], w: 820, h: 800, x: 540, y: 960, zoom: 1.2, fy: 0.45, s: mix(0.9, 1, E.out5(lin(l, 0, 0.4))) });
        const d = E.in3(lin(l, 1.2, 1.6));
        const f = E.out5(lin(l, 0.15, 0.6));
        place(file, { x: 540, y: mix(mix(480, 620, f), 960, d), s: mix(1, 0.2, d), r: mix(-6, 0, f), o: 1 - lin(l, 1.5, 1.6) });
        const rp = lin(l, 1.6, 2.1);
        place(ring, { x: 540, y: 960, s: mix(0.2, 2, E.out3(rp)), o: rp > 0 ? 1 - rp : 0 });
        place(ok, { x: 540, y: 1385, s: pop(l, 1.7, 0.3) });
        place(g.querySelector('.cap'), { x: 0, y: 0, ax: 0, ay: 0, o: 1 - lin(l, 1.65, 1.8) });
      };
    },
  ];

  scene(FT0, FT0 + FD * 10, { cls: 'bp' }, (root) => {
    const dots = $('div', 'dots', root, FEATURES.map(() => '<i></i>').join(''));
    const groups = FEATURES.map(([name, cap], k) => {
      const g = $('div', 'grp', root);
      $('div', 'fidx', g, `${pad(k + 1, 2)}<small>/10</small>`);
      const nm = $('div', 'fname', g, name);
      const cp = $('div', 'cap', g, cap);
      cp.style.top = '1430px';
      return { g, nm, cp, paint: FPAINT[k](g) };
    });
    return (lt) => {
      const cur = clamp(Math.floor(lt / FD), 0, 9);
      [...dots.children].forEach((d, i) => (d.className = (i <= cur ? 'on' : '') + (i === cur ? ' cur' : '')));
      groups.forEach((x, k) => {
        const l = lt - k * FD;
        const vis = l >= -0.3 && l < FD;
        x.g.style.display = vis ? '' : 'none';
        if (!vis) return;
        const enter = k === 0 ? 0 : (1 - E.out5(lin(l, -0.3, 0.3))) * 1080;
        const exit = k === 9 ? 0 : -E.in3(lin(l, FD - 0.3, FD)) * 1080;
        x.g.style.transform = `translateX(${enter + exit}px)`;
        x.nm.style.clipPath = `inset(0 ${(1 - E.out5(lin(l, 0.05, 0.45))) * 100}% 0 0)`;
        x.cp.style.opacity = lin(l, 0.35, 0.6);
        x.paint(l + 0.3);
      });
    };
  });
  // MECÂNICA ─ 44 → 47.5
  scene(44, 47.5, {}, (root) => {
    const bg = $('img', 'full', root);
    const top = $('div', 'fill', root);
    top.style.background = 'linear-gradient(rgba(10,11,14,.8), rgba(10,11,14,0) 40%)';
    const tA = new Title(root, ['OS ASSETS', 'VIRARAM A', { t: '[hl]MECÂNICA.', size: 104 }], { size: 76, y: 215, cls: 'wht' });
    const flow = $('div', 'flow', root);
    flow.style.top = '600px';
    const steps = ['OBJETO', 'JOGO', 'FEIXE', 'PONTOS'].map((s, i, a) => {
      const el = $('div', 'st', flow, s);
      if (i < a.length - 1) $('span', '', flow, SVG.arrow);
      return el;
    });
    const fl = ['huehue', 'manoel_gomes'].map((id) => ({ id, sp: new Sprite(root) }));
    const toast = $('div', 'toast', root);
    const NAMES = { huehue: 'HUEHUE', manoel_gomes: 'MANOEL GOMES' };
    return (lt) => {
      setImg(bg, S.game('payoff', 40 + lt * 30));
      bg.style.transform = `scale(${mix(1.06, 1, lt / 3.5)})`;
      tA.paint(lt, 0.1, 1e9, { st: 0.07 });
      steps.forEach((s, i) => (s.className = 'st' + (lt > 0.5 + i * 0.3 ? ' on' : '')));
      flow.style.opacity = lin(lt, 0.3, 0.5);
      let tf = null;
      fl.forEach((f, i) => {
        const s0 = 0.5 + i * 0.6;
        const u = lin(lt, s0, s0 + 1.9);
        f.sp.set({ show: u > 0 && u < 1, src: S.st(f.id, 'freaky', lt * 30 + i * 5), x: 540 + Math.sin(u * 7 + i * 2) * 70, y: mix(1450, 760, E.inOut(u)),
          w: 300, h: 450, s: mix(1, 0.2, E.in3(u)), r: mix(0, i ? 200 : -200, E.inOut(u)), op: 1 - lin(u, 0.85, 1), filter: 'drop-shadow(0 0 24px rgba(43,255,136,.9))' });
        if (lt >= s0 + 1.9 && lt < s0 + 2.6) tf = { f, t: lt - s0 - 1.9 };
      });
      if (tf) {
        toast.innerHTML = `+1 ${NAMES[tf.f.id]}`;
        place(toast, { x: 540, y: 720, s: pop(tf.t, 0, 0.25), o: 1 - lin(tf.t, 0.5, 0.7) });
      } else place(toast, { show: false });
    };
  });

  // MEMES ─ 47.5 → 51.5
  const MEMES = [
    ['cadeira', 'CADEIRA DE PLÁSTICO'], ['botijao', 'BOTIJÃO'], ['caixa_dagua', 'CAIXA D’ÁGUA'], ['carrinho_mercado', 'CARRINHO'], ['churrasqueira', 'CHURRASQUEIRA'],
    ['cone', 'CONE'], ['van', 'VAN ESCOLAR'], ['brasilia_amarela', 'BRASÍLIA AMARELA'], ['moto', 'MOTO'], ['poste', 'POSTE'], ['lixeira', 'LIXEIRA'],
    ['uno_escada', 'UNO COM ESCADA'], ['carro_pamonha', 'CARRO DA PAMONHA'],
  ];
  scene(47.5, 51.5, { bg: CONCRETE }, (root) => {
    const border = [0, 1].map((k) => {
      const b = $('div', 'abs', root);
      Object.assign(b.style, { width: '1440px', height: '120px', top: k ? '1560px' : '0px', display: 'flex' });
      for (let i = 0; i < 12; i++) {
        const t = $('div', '', b);
        Object.assign(t.style, { width: '120px', height: '120px', flex: 'none', background: BULCAO[(i + k * 2) % BULCAO.length], transform: `rotate(${(i % 4) * 90}deg)` });
      }
      return b;
    });
    const tA = new Title(root, ['COMECEI A ADICIONAR', { t: '[hy]MEMES_BRASILEIROS', size: 70 }, 'AO CATÁLOGO'], { size: 50, y: 175 });
    const lens = $('div', 'lens', root);
    Object.assign(lens.style, { width: '760px', height: '760px' });
    const beam = $('div', 'fill', lens);
    beam.style.background = 'linear-gradient(rgba(43,255,136,.9), rgba(43,255,136,.15))';
    beam.style.clipPath = 'polygon(40% 0, 60% 0, 100% 100%, 0 100%)';
    const item = new Sprite(root);
    const prev = new Sprite(root);
    const label = $('div', 'sticker', root, '<span></span>');
    const COLS = ['#1d4ed8', '#0f1013', '#ffc300'];
    const T0 = 0.55;
    const D = 0.26;
    return (lt) => {
      border.forEach((b, k) => (b.style.transform = `translateX(${(k ? -1 : 1) * ((lt * 120) % 240) - 240}px)`));
      tA.paint(lt, 0, 1e9, { st: 0.05 });
      const k = lt - T0;
      const i = clamp(Math.floor(k / D), 0, MEMES.length - 1);
      const u = clamp((k - i * D) / D);
      lens.style.background = COLS[i % 3];
      place(lens, { x: 540, y: 1050, s: E.out5(lin(lt, 0, 0.4)) });
      item.set({ show: false });
      prev.set({ show: false });
      label.style.display = 'none';
      if (k >= 0) {
        item.set({ src: S.obj(MEMES[i][0]), x: 540, y: 1080, w: 600, h: 600, s: mix(0.35, 1, E.back(Math.min(1, u * 2))), r: (i % 2 ? 1 : -1) * 6,
          filter: 'drop-shadow(0 26px 30px rgba(0,0,0,.35))' });
        label.firstChild.textContent = MEMES[i][1];
        label.style.display = '';
        place(label, { x: 0, y: 1440, ax: 0, ay: 0, s: mix(1.15, 1, E.out5(Math.min(1, u * 3))) });
        if (i > 0) {
          const v = E.out3(Math.min(1, u * 1.6));
          prev.set({ src: S.obj(MEMES[i - 1][0]), x: 540, y: mix(1040, 690, v), w: 600, h: 600, s: mix(0.7, 0.06, v), r: v * 160, op: 1 - lin(u, 0.45, 0.62),
            filter: 'drop-shadow(0 0 26px rgba(43,255,136,.95))' });
        }
      }
    };
  });

  // CTA ─ 51.5 → 60
  scene(51.5, DUR, { bg: '#ffd23f' }, (root) => {
    const n500 = $('div', 'h', root, '+500');
    Object.assign(n500.style, { top: '190px', fontSize: '232px', letterSpacing: '-.06em' });
    const tC = new Title(root, ['CRÉDITOS BÔNUS'], { size: 66, y: 440 });
    const box = $('div', 'codebox', root, '<div class="lb">CÓDIGO DE CONVITE</div><div class="code"></div>');
    const CODE = 'RIWOHB';
    const L = [...CODE].map(() => $('span', '', box.children[1]));
    const s1 = $('div', 'step', root, '<div class="n">1</div><div>Crie sua conta pelo <u>link na descrição</u></div>');
    const s2 = $('div', 'step', root, `<div class="n">2</div><div>Ou no site da Tripo: Referral Program ${SVG.arrow.replace('<svg', '<svg style="width:38px;height:38px;vertical-align:-6px"')} ${CODE}</div>`);
    const warn = $('div', 'warn', root, `<svg viewBox="0 0 24 24"><path d="M12 2 1 21h22L12 2z" fill="#ffd23f"/><path d="M12 9v5" stroke="#0f1013" stroke-width="2.6" stroke-linecap="round"/><circle cx="12" cy="17.6" r="1.5" fill="#0f1013"/></svg>O campo do código aparece <b>só nas primeiras 24 horas</b> depois de criar a conta.`);
    const tD = new Title(root, ['COMENTA QUAL', 'MEME OU OBJETO', 'BRASILEIRO VOCÊ', 'QUER VER NO', { t: '[hk]ABDUZIU.FUN', size: 84 }], { size: 64, y: 905 });
    // second offer: 60% off the first month with TRIPOCREW
    const tE = CREW ? new Title(root, ['ALÉM DE', { t: '[hk]60%_DE_DESCONTO', size: 74 }, 'NO SEU PRIMEIRO MÊS'], { size: 64, y: 884 }) : null;
    const box2 = CREW ? $('div', 'codebox', root, '<div class="lb">CÓDIGO DE DESCONTO</div><div class="code"></div>') : null;
    const CODE2 = 'TRIPOCREW';
    const L2 = CREW ? [...CODE2].map(() => $('span', '', box2.children[1])) : [];
    if (box2) {
      box2.children[1].style.gap = '10px';
      for (const s of L2) s.style.fontSize = '100px';
    }
    const bub = $('div', 'abs', root, SVG.bubble);
    Object.assign(bub.style, { width: '110px', height: '110px', color: '#0f1013' });
    const AL = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    const crew = [['huehue', 210, 0], ['cabeca_guidao', 540, 7], ['manoel_gomes', 870, 15]].map(([id, x, off]) => ({ id, x, off, sp: new Sprite(root) }));
    return (lt) => {
      crew.forEach((c, i) => c.sp.set({ src: S.st(c.id, 'run', lt * 30 + c.off), x: c.x, y: 1560, w: 300, h: 450, s: pop(lt, 0.6 + i * 0.1, 0.4) }));
      const p = lin(lt, 0, 0.3);
      n500.style.transformOrigin = '540px 120px';
      place(n500, { x: 0, y: 0, ax: 0, ay: 0, s: mix(1.5, 1, E.out5(p)), o: p });
      tC.paint(lt, 0.2);
      place(box, { x: 540, y: 700, s: E.back(lin(lt, 0.4, 0.75)) });
      L.forEach((s, i) => {
        const rv = 0.65 + i * 0.08;
        s.textContent = lt >= rv ? CODE[i] : AL[Math.floor(hash(Math.floor(lt * 30) * 5 + i) * AL.length)];
        s.style.color = lt >= rv ? '#fff' : 'rgba(255,255,255,.3)';
      });
      const out = E.in3(lin(lt, 4.7, 5.0));
      place(s1, { x: 64 - out * 1100, y: 885, ax: 0, ay: 0, o: lin(lt, 1.1, 1.3) });
      place(s2, { x: 64 - out * 1100, y: 1000, ax: 0, ay: 0, o: lin(lt, 1.4, 1.6) });
      place(warn, { x: 64 - out * 1100, y: 1135, ax: 0, ay: 0, o: lin(lt, 1.8, 2.0) });
      if (tE && box2) {
        const T = 5.0;
        tE.paint(lt, T, T + 4.4, { st: 0.06 });
        const out2 = E.in3(lin(lt, T + 4.4, T + 4.7));
        place(box2, { x: 540 - out2 * 1100, y: 1238, s: 0.82 * E.back(lin(lt, T + 0.45, T + 0.8)) });
        L2.forEach((s, i) => {
          const rv = T + 0.75 + i * 0.07;
          s.textContent = lt >= rv ? CODE2[i] : AL[Math.floor(hash(Math.floor(lt * 30) * 7 + i) * AL.length)];
          s.style.color = lt >= rv ? '#fff' : 'rgba(255,255,255,.3)';
        });
      }
      tD.paint(lt, 4.95 + CREW_SHIFT, 1e9, { st: 0.05 });
      place(bub, { x: 930, y: 900, s: pop(lt, 5.5 + CREW_SHIFT, 0.35), r: 8 });
    };
  });

  // ─── global layers
  const bars = $('div', '', stage);
  bars.id = 'bars';
  const BARS = Array.from({ length: 8 }, (_, i) => {
    const b = $('i', '', bars);
    b.style.left = i * 136 - 4 + 'px';
    return b;
  });
  const hud = $('div', '', stage, '<div class="l">ABDUZIU.FUN × TRIPO</div><div class="r"></div><div class="rule"></div>');
  hud.id = 'hud';
  const tc = hud.children[1];
  const prog = $('div', '', stage);
  prog.id = 'prog';
  const flash = $('div', '', stage);
  flash.id = 'flash';
  const grain = $('div', '', stage);
  grain.id = 'grain';
  {
    const c = document.createElement('canvas');
    c.width = c.height = 256;
    const g = c.getContext('2d');
    const d = g.createImageData(256, 256);
    for (let i = 0; i < d.data.length; i += 4) {
      const v = Math.floor(hash(i * 0.37) * 255);
      d.data[i] = d.data[i + 1] = d.data[i + 2] = v;
      d.data[i + 3] = 255;
    }
    g.putImageData(d, 0, 0);
    grain.style.backgroundImage = `url(${c.toDataURL()})`;
  }
  // ministry-block wipes on the chapter cuts
  const WIPES = [[4.5, '#0f1013'], [8, '#1d4ed8'], [11.5, '#ffd23f'], [14, '#0f1013'], [44, '#2bff88'], [47.5, '#1d4ed8'], [51.5, '#ffd23f']];
  const FLASH = [17, 20, 23, 26, 29, 32, 35, 38, 41].map((t) => [t, 0.07]);

  async function paint(t) {
    pending = [];
    for (const s of SCENES) {
      const on = t >= s.t0 - s.pre && t < s.t1 + s.post;
      s.root.style.display = on ? 'block' : 'none';
      if (on) s.paint(t - s.t0, t);
    }
    let wipe = null;
    for (const w of WIPES) if (t >= w[0] - 0.45 && t < w[0] + 0.45) wipe = w;
    bars.style.display = wipe ? '' : 'none';
    if (wipe) {
      const [T, col] = wipe;
      BARS.forEach((b, i) => {
        const dir = i % 2 ? 1 : -1;
        const c = E.inOut(lin(t, T - 0.4 + i * 0.022, T - 0.17 + i * 0.022));
        const r = E.inOut(lin(t, T + 0.03 + i * 0.022, T + 0.27 + i * 0.022));
        b.style.background = col;
        b.style.transform = `translateY(${(1 - c) * dir * 1920 - r * dir * 1920}px)`;
      });
    }
    let fl = 0;
    for (const [ft, a] of FLASH) if (t >= ft) fl = Math.max(fl, a * (1 - E.out3(lin(t, ft, ft + 0.3))));
    flash.style.background = '#fff';
    flash.style.opacity = fl;
    const f = Math.floor(t * 30 + 1e-6);
    grain.style.transform = `translate(${Math.floor(hash(f) * 64) - 32}px, ${Math.floor(hash(f + 0.5) * 64) - 32}px)`;
    tc.textContent = `TC 00:00:${pad(Math.floor(f / 30), 2)}:${pad(f % 30, 2)}`;
    prog.style.width = (952 * t) / DUR + 'px';
    await Promise.all(pending);
  }

  window.COMP = {
    DUR,
    init(counts) {
      COUNTS = counts;
      for (const m of MEASURE) m();
    },
    paint,
  };
})();
