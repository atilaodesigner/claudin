/*
 * ABDUZIU × Tripo showreel compositor (1080×1920, 30 fps, 63.5 s).
 * Every layer is DOM: game footage, Tripo screen recordings (cropped, no browser chrome) as cards
 * in 3D, studio renders of the game assets and the Tripo characters, kinetic type.
 * COMP.paint(t) is deterministic: comp.mjs calls it frame by frame and screenshots.
 */
(() => {
  const W = 1080;
  const H = 1920;
  const DUR = 63.5;

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
    constructor(parent, lines, { size = 120, y = 300, cls = '', lh = 0.88 } = {}) {
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
        w.style.transform = `translateY(${ty}%) skewX(${(1 - p) * -10}deg) rotate(${(1 - p) * 5 * from}deg)`;
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
    const s = { t0, t1, pre: opt.pre || 0, post: opt.post || 0, root };
    s.paint = init(root, s);
    SCENES.push(s);
    return s;
  }

  // 01 ─ A IDEIA ──────────────────────────────────────────────────────────── 0 → 6.5
  scene(0, 6.5, { post: 0.5, bg: '#000' }, (root) => {
    const bg = $('img', 'full', root);
    const top = $('div', 'grad-top', root);
    const bot = $('div', 'grad-bot', root);
    const group = $('div', 'fill', root);
    const t1 = new Title(group, ['E SE DESSE PRA'], { size: 100, y: 540 });
    const t2 = new Title(group, ['[vid]ABDUZIR'], { size: 330, y: 640 });
    const t3 = new Title(group, ['[yl]BRASÍLIA [yl]INTEIRA?'], { size: 146, y: 955 });
    const t4 = new Title(root, ['EU CRIEI UM GAME', 'ONDE VOCÊ PODE ABDUZIR', { t: '[hl]QUASE_TUDO.', size: 200 }], { size: 112, y: 1090 });
    const logo = $('div', 'logo', root, 'ABDUZIU<span>.FUN</span>');
    const vid = t2.words[0];
    MEASURE.push(() => {
      const r = vid.getBoundingClientRect();
      vid.style.backgroundPosition = `${-r.left}px ${-r.top}px`;
    });
    return (lt) => {
      const src = S.game('ideia', lt * 30);
      setImg(bg, src);
      vid.style.backgroundImage = `url(${src})`;
      const open = E.out3(lin(lt, 2.45, 3.0));
      bg.style.filter = `blur(${mix(18, 0, open)}px) brightness(${mix(0.3, 1, open) * mix(0.4, 1, lin(lt, 0, 0.5))}) saturate(${mix(0.5, 1.15, open)})`;
      bg.style.transform = `scale(${mix(1.18, 1.04, E.out3(lin(lt, 0, 6.5)))})`;
      const z = E.in3(lin(lt, 2.3, 2.85));
      group.style.transformOrigin = '540px 790px';
      group.style.transform = `scale(${1 + z * 16})`;
      group.style.opacity = 1 - lin(lt, 2.6, 2.85);
      t1.paint(lt, 0.15);
      t2.paint(lt, 0.55, 1e9, { d: 0.32 });
      t2.el.style.transform = `scale(${mix(1.3, 1, E.out5(lin(lt, 0.55, 0.9)))})`;
      t3.paint(lt, 1.25);
      top.style.opacity = 0.6 * lin(lt, 2.8, 3.2) * (1 - lin(lt, 5.4, 5.7));
      bot.style.opacity = lin(lt, 3.1, 3.4) * (1 - lin(lt, 5.5, 5.8));
      t4.paint(lt, 3.3, 5.4, { st: 0.07 });
      const lp = lin(lt, 5.62, 5.9);
      const dx = lt < 6.05 && lt > 5.62 ? (hash(Math.floor(lt * 30)) - 0.5) * 26 : 0;
      place(logo, { x: 540, y: 880, ax: 0.5, ay: 0.5, s: mix(1.7, 1, E.out5(lp)), o: lp, show: lt > 5.62 });
      logo.style.left = '0px';
      logo.style.textShadow = `${dx}px 0 #ff2e63, ${-dx}px 0 #00e5ff, 0 10px 50px rgba(0,0,0,.6)`;
    };
  });

  // 02 ─ PROTÓTIPO ───────────────────────────────────────────────────────── 6.5 → 11.5
  scene(6.5, 11.5, {}, (root) => {
    const bg = $('img', 'full', root);
    const grid = $('div', 'gridov', root);
    const corners = [0, 1, 2, 3].map((i) => {
      const c = $('div', 'corner', root);
      const L = i % 2 === 0;
      const T = i < 2;
      Object.assign(c.style, {
        left: L ? '50px' : '', right: L ? '' : '50px', top: T ? '270px' : '', bottom: T ? '' : '440px',
        borderLeftWidth: L ? '6px' : '0', borderRightWidth: L ? '0' : '6px', borderTopWidth: T ? '6px' : '0', borderBottomWidth: T ? '0' : '6px',
      });
      return c;
    });
    const tag = $('div', 'mono abs', root, 'BLOCKOUT_V0.1 · SEM ASSETS · SÓ CAIXA CINZA');
    tag.style.fontSize = '26px';
    const top = $('div', 'grad-top', root);
    const tA = new Title(root, ['O PROTÓTIPO', '[gr]JÁ_FUNCIONAVA.'], { size: 150, y: 300 });
    const ok = $('div', 'stamp', root, SVG.check + 'FUNCIONANDO');
    const tB = new Title(root, ['MAS FALTAVA DEIXAR', 'O MUNDO MAIS', { t: '[vivo]VIVO.', size: 300 }], { size: 120, y: 290 });
    const vivo = tB.words[tB.words.length - 1];
    const scan = $('div', 'scan', root);
    return (lt) => {
      const p = E.inOut(lin(lt, 0, 0.42));
      root.style.clipPath = p < 1 ? `inset(0 0 ${(1 - p) * 100}% 0)` : '';
      place(scan, { x: 0, y: p * H, ax: 0, ay: 0.5, show: p > 0 && p < 1 });
      setImg(bg, S.game('proto', lt * 30));
      bg.style.transform = `scale(${mix(1.06, 1.0, lt / 5)})`;
      grid.style.opacity = 0.5 + 0.2 * Math.sin(lt * 3);
      corners.forEach((c, i) => (c.style.opacity = lin(lt, 0.35 + i * 0.05, 0.6 + i * 0.05)));
      place(tag, { x: 540, y: 1430, o: lin(lt, 0.6, 0.9) * (0.75 + 0.25 * Math.round(hash(Math.floor(lt * 4)))) });
      top.style.opacity = 0.75;
      tA.paint(lt, 0.3, 2.15);
      const sp = lin(lt, 0.95, 1.2);
      place(ok, { x: 540, y: 720, r: -7, s: mix(2.4, 1, E.out5(sp)), o: sp * (1 - lin(lt, 2.1, 2.3)) });
      tB.paint(lt, 2.35, 1e9, { st: 0.06 });
      vivo.style.backgroundPosition = `${(lt * 90) % 300}% 0`;
      // the clay world gets its first splash of color right before the cut
      const c = lin(lt, 4.2, 5);
      bg.style.filter = `saturate(${1 + c * 2}) hue-rotate(${c * 40}deg)`;
    };
  });

  // 03 ─ MUITOS ASSETS ───────────────────────────────────────────────────── 11.5 → 16
  const RAPID = [
    ['onibus', 'ÔNIBUS'], ['poste', 'POSTES'], ['arvore', 'ÁRVORES'], ['placa_rua', 'PLACAS'],
    ['semaforo', 'SEMÁFOROS'], ['taxi', 'CARROS'], ['ipe', 'IPÊS'], ['orelhao', 'ORELHÃO'],
  ];
  const WALL = ['onibus', 'cadeira', 'poste', 'botijao', 'taxi', 'arvore', 'caixa_dagua', 'van', 'cone', 'semaforo', 'moto', 'opala', 'ipe', 'lixeira',
    'carrinho_mercado', 'orelhao', 'sofa', 'brasilia_amarela', 'geladeira', 'helicoptero', 'vaca', 'placa_rua', 'churrasqueira', 'uno_escada',
    'carrinho_pipoca', 'isopor', 'guarda_sol', 'caramelo_dourado', 'hatch', 'galinha', 'banca_pastel', 'mototaxi', 'carro_pamonha', 'caminhao_gas',
    'carrinho_churros', 'cachorro', 'quadradinho', 'moto_entrega', 'cadeira_praia', 'carrinho_rolima'];
  scene(11.5, 16, { pre: 0.5, bg: 'radial-gradient(ellipse at 50% 40%, #12324a, #070b14 70%)' }, (root) => {
    root.style.perspective = '1500px';
    const wall = $('div', 'wall', root);
    const wtop = $('div', 'grad-top', root);
    wtop.style.height = '900px';
    const tiles = [];
    const COLS = 7;
    const ROWS = 15;
    for (let r = 0; r < ROWS; r++)
      for (let c = 0; c < COLS; c++) {
        const t = $('div', 'tile', wall);
        const x = (c - (COLS - 1) / 2) * 256 - 115;
        const y = (r - (ROWS - 1) / 2) * 256 - 115;
        t.style.left = x + 'px';
        t.style.top = y + 'px';
        const img = $('img', '', t);
        img.src = S.obj(WALL[(r * 3 + c * 5) % WALL.length]);
        tiles.push({ el: t, d: Math.hypot(c - 3, (r - 7) * 0.8) });
      }
    const tapes = [
      ['tape', 1330, -5, 1],
      ['tape y', 1425, 4, -1],
    ].map(([cls, y, r, dir]) => {
      const t = $('div', cls, root);
      t.style.top = y + 'px';
      t.style.transform = `rotate(${r}deg)`;
      const txt = 'CARROS • ÔNIBUS • PLACAS • POSTES • ÁRVORES • PRÉDIOS • OBJETOS URBANOS • MEMES • COLECIONÁVEIS • ';
      const inner = $('div', '', t, txt + txt + txt);
      return { t, inner, dir };
    });
    const tA = new Title(root, ['EU PRECISAVA DE', { t: '[yl]MUITOS', size: 250 }, { t: '[ol]ASSETS_3D', size: 250 }], { size: 104, y: 270 });
    const disc = $('div', 'disc', root);
    const item = new Sprite(root);
    const label = $('div', 'label', root, '<span></span>');
    const num = $('div', 'mono abs', root);
    num.style.fontSize = '30px';
    const COLORS = ['#5dffa0', '#ffdf00', '#7b61ff', '#3fb6ff', '#ff6b9a', '#ffd23f', '#19e3b1', '#ff8a3d'];
    return (lt) => {
      // circular reveal out of the clay world
      const rv = E.inOut(lin(lt, -0.5, 0.1));
      root.style.clipPath = rv < 1 ? `circle(${rv * 1250}px at 540px 960px)` : '';
      const fast = lin(lt, 2.0, 2.3);
      wall.style.transform = `rotateX(54deg) rotateZ(-26deg) translate3d(0,${180 - lt * 150}px,${-140 + fast * -200}px)`;
      wall.style.filter = `blur(${fast * 9}px) brightness(${1 - fast * 0.55})`;
      for (const t of tiles) {
        const p = E.back(lin(lt, -0.35 + t.d * 0.07, -0.05 + t.d * 0.07));
        t.el.style.transform = `scale(${p})`;
      }
      for (const tp of tapes) {
        const sl = (lt * 300 * tp.dir) % 1600;
        tp.inner.style.transform = `translateX(${-1600 + sl}px)`;
        const o = lin(lt, 0.3, 0.5) * (1 - lin(lt, 1.85, 2.05));
        tp.t.style.opacity = o;
        tp.t.style.display = o > 0 ? '' : 'none';
      }
      wtop.style.opacity = 1 - lin(lt, 1.9, 2.2);
      tA.paint(lt, 0.15, 1.9, { st: 0.07 });
      // rapid fire: one asset per 1/8 bar
      const k = lt - 2.1;
      const i = Math.floor(k / 0.25);
      const on = k >= 0 && i < RAPID.length;
      const u = on ? (k - i * 0.25) / 0.25 : 0;
      disc.style.display = on ? '' : 'none';
      label.style.display = on ? '' : 'none';
      num.style.display = on ? '' : 'none';
      item.set({ show: false });
      if (on) {
        const [id, name] = RAPID[i];
        disc.style.background = `radial-gradient(circle, ${COLORS[i % COLORS.length]} 0%, ${COLORS[i % COLORS.length]}55 60%, transparent 71%)`;
        disc.style.transform = `scale(${mix(0.7, 1, E.out3(Math.min(1, u * 3)))})`;
        const s = mix(0.5, 1, E.back(Math.min(1, u * 2.4)));
        item.set({ src: S.obj(id), x: 540, y: 900, w: 760, h: 760, s, r: (i % 2 ? -1 : 1) * mix(10, 2, u), filter: 'drop-shadow(0 30px 40px rgba(0,0,0,.45))' });
        label.firstChild.textContent = name;
        place(label, { x: 0, y: 1300, ax: 0, ay: 0, s: mix(1.25, 1, E.out5(Math.min(1, u * 3))), o: 1 });
        num.textContent = `ASSET ${pad(i + 1, 2)}`;
        place(num, { x: 540, y: 470 });
      }
      const ex = lin(lt, 4.15, 4.5);
      root.style.opacity = 1;
      if (ex > 0) item.set({ src: S.obj(RAPID[7][0]), x: 540, y: 900, w: 760, h: 760, s: 1 + ex * 3, op: 1 - ex });
    };
  });

  // 04 ─ ENTRA A TRIPO ───────────────────────────────────────────────────── 16 → 19
  scene(16, 19, { bg: 'radial-gradient(ellipse at 50% 55%, #2a1d63 0%, #0d0a1d 55%, #06050c 100%)' }, (root) => {
    const tA = new Title(root, ['ENTÃO EU USEI A'], { size: 100, y: 215 });
    const tB = new Title(root, [{ t: '[tp]TRIPO', size: 320 }], { y: 300 });
    const dash = new Card(root);
    const home = new Card(root, 'ylw');
    const c1 = chip(root, `IMAGEM ${SVG.arrow} 3D`, 'y');
    const c2 = chip(root, `TEXTO ${SVG.arrow} 3D`, 'v');
    return (lt) => {
      tA.paint(lt, 0, 2.75);
      tB.paint(lt, 0.25, 2.75, { d: 0.45 });
      const a = E.out5(lin(lt, 0.1, 0.8));
      home.set({
        src: S.clip('home', lt * 30), size: SIZE.home, w: 960, h: 475, x: mix(1500, 540, a), y: 880, ry: mix(-50, -8, a) + lt * 4, rx: 8, rz: mix(6, -2, a),
        zoom: mix(1, 1.18, E.inOut(lin(lt, 0.6, 3))), fx: 0.5, fy: 0.5, op: 1 - lin(lt, 2.75, 3),
      });
      const b = E.out5(lin(lt, 0.45, 1.15));
      dash.set({
        src: S.clip('dash', 60 + lt * 30), size: SIZE.dash, w: 860, h: 287, x: mix(-500, 600, b), y: 1250, ry: mix(40, 10, b) - lt * 3, rx: 6, z: -120,
        zoom: 1.35, fx: 0.5, fy: 0.25, op: 0.95 * (1 - lin(lt, 2.75, 3)),
      });
      place(c1, { x: 220, y: 650, r: -6, s: pop(lt, 1.5), o: 1 - lin(lt, 2.7, 2.9) });
      place(c2, { x: 860, y: 1110, r: 5, s: pop(lt, 1.75), o: 1 - lin(lt, 2.7, 2.9) });
    };
  });

  // 04A ─ REFERÊNCIA → 3D ────────────────────────────────────────────────── 19 → 23
  scene(19, 23, { bg: 'radial-gradient(ellipse at 50% 60%, #1c2440, #070910 70%)' }, (root) => {
    const tA = new Title(root, ['DA [gr]REFERÊNCIA', 'AO [gr]MODELO_3D'], { size: 136, y: 215 });
    const sub = $('div', 'sub', root, 'IMAGEM OU TEXTO → MODELO 3D');
    sub.innerHTML = `IMAGEM OU TEXTO <span style="color:var(--beam)">${SVG.arrow.replace('<svg', '<svg style="width:28px;height:28px;vertical-align:-4px"')}</span> MODELO 3D`;
    const A = new Card(root, 'ylw');
    const B = new Card(root, 'glow');
    const badge = $('div', 'abs', root, `<div style="width:130px;height:130px;border-radius:50%;background:var(--beam);color:#04150c;display:flex;align-items:center;justify-content:center;box-shadow:0 0 50px rgba(93,255,160,.6)">${SVG.arrow.replace('<svg', '<svg style="width:76px;height:76px"')}</div>`);
    const cA = chip(root, 'REFERÊNCIA', 'y');
    const cB = chip(root, 'MODELO 3D');
    return (lt) => {
      tA.paint(lt, 0, 3.7);
      place(sub, { x: 0, y: 500, ax: 0, ay: 0, o: lin(lt, 0.4, 0.7) * (1 - lin(lt, 3.6, 3.8)) });
      const a = E.out5(lin(lt, 0.15, 0.8));
      A.set({
        src: S.clip('upload', 140 + lt * 30), size: SIZE.upload, w: 540, h: 660, x: mix(-300, 310, a), y: 900, ry: 16, rz: -3,
        zoom: 2.9, fx: 0.0745, fy: 0.3, op: 1 - lin(lt, 3.7, 3.95),
      });
      const b = E.out5(lin(lt, 1.15, 1.8));
      B.set({
        src: S.clip('man', 95 + lt * 30), size: SIZE.man, w: 560, h: 640, x: mix(1400, 770, b), y: 1150, ry: -14, rz: 2,
        zoom: 1.12, fx: 0.5, fy: 0.42, op: 1 - lin(lt, 3.7, 3.95),
      });
      place(badge, { x: 560, y: 1035, s: pop(lt, 1.55), r: mix(-90, -20, E.out3(lin(lt, 1.55, 2))), o: 1 - lin(lt, 3.7, 3.9) });
      place(cA, { x: 150, y: 590, r: -5, s: pop(lt, 0.7), o: 1 - lin(lt, 3.7, 3.9) });
      place(cB, { x: 900, y: 845, r: 4, s: pop(lt, 2.0), o: 1 - lin(lt, 3.7, 3.9) });
    };
  });

  // 04B ─ MULTIVISÕES ────────────────────────────────────────────────────── 23 → 26.5
  scene(23, 26.5, { bg: 'radial-gradient(ellipse at 50% 55%, #10303a, #05080c 70%)' }, (root) => {
    const tA = new Title(root, [{ t: '[gr]MULTIVISÕES', size: 210 }], { y: 220 });
    const sub = $('div', 'sub', root, 'FRENTE · 3/4 · LADO · COSTAS');
    const views = [
      { base: 255, x: 300, y: 770, lb: 'FRENTE' },
      { base: 238, x: 780, y: 770, lb: '3/4' },
      { base: 286, x: 300, y: 1260, lb: 'LADO' },
      { base: 300, x: 780, y: 1260, lb: 'COSTAS' },
    ].map((v) => ({ ...v, card: new Card(root, 'glow'), chip: chip(root, v.lb, 'dk') }));
    const ring = $('div', 'abs', root);
    Object.assign(ring.style, { width: '700px', height: '700px', borderRadius: '50%', border: '6px solid #5dffa0', boxShadow: '0 0 60px rgba(93,255,160,.6)' });
    const hero = new Sprite(root);
    const tB = new Title(root, [{ t: 'UM [gr]MODELO_3D', size: 120 }], { y: 1500 });
    return (lt) => {
      tA.paint(lt, 0, 3.25);
      place(sub, { x: 0, y: 440, ax: 0, ay: 0, o: lin(lt, 0.35, 0.6) * (1 - lin(lt, 3.1, 3.3)) });
      const m = E.inOut(lin(lt, 2.15, 2.65));
      views.forEach((v, i) => {
        const f = E.back(lin(lt, 0.1 + i * 0.22, 0.5 + i * 0.22));
        const idx = v.base + Math.round(Math.sin(lt * 2 + i) * 4);
        v.card.set({
          src: S.clip('gtex', idx), size: SIZE.gtex, w: 440, h: 460, x: mix(v.x, 540, m), y: mix(v.y, 1010, m), ry: mix(90, 0, f) + (i % 2 ? -6 : 6) * (1 - m),
          rz: m * (i - 1.5) * 8, s: mix(1, 0.55, m), zoom: 1.6, fx: 0.5, fy: 0.24, op: (f > 0.02 ? 1 : 0) * (1 - lin(lt, 2.5, 2.7)),
        });
        place(v.chip, { x: v.x - 200, y: v.y + 210, ax: 0, ay: 1, s: pop(lt, 0.35 + i * 0.22, 0.3), o: 1 - m });
      });
      const h = pop(lt, 2.5, 0.45);
      hero.set({ src: S.st('cabeca_guidao', 'turn', lt * 30), x: 540, y: 990, w: 860, h: 860, s: h, op: 1 - lin(lt, 3.3, 3.5),
        filter: 'drop-shadow(0 0 40px rgba(93,255,160,.35))' });
      const rp = lin(lt, 2.5, 3.1);
      place(ring, { x: 540, y: 990, s: mix(0.3, 1.5, E.out3(rp)), o: (1 - rp) * (rp > 0 ? 1 : 0) });
      tB.paint(lt, 2.7, 3.3);
    };
  });

  // 04C ─ TEXTURA / PBR ──────────────────────────────────────────────────── 26.5 → 31
  scene(26.5, 31, { bg: 'radial-gradient(ellipse at 50% 55%, #3a1f12, #0b0706 70%)' }, (root) => {
    const tA = new Title(root, ['NÃO É SÓ [ol]MALHA.'], { size: 150, y: 230 });
    const tB = new Title(root, ['É [yl]TEXTURA, [tp]MATERIAL', 'E [gr]IDENTIDADE.'], { size: 122, y: 215 });
    const cmp = $('div', 'cmp', root);
    const clay = $('img', '', cmp);
    const txw = $('div', 'tx', cmp);
    const tex = $('img', '', txw);
    const line = $('div', 'wipe', cmp);
    const lc = chip(cmp, 'MALHA', 'dark');
    const rc = chip(cmp, 'TEXTURA', 'y');
    const panel = new Card(root, 'ylw');
    const uvChip = chip(root, 'SMART UV', 'y');
    const chips = [
      [chip(root, 'PBR', 'v'), 960, 1220, 4, 1.4],
      [chip(root, 'TEXTURA 8K'), 905, 1380, -4, 1.65],
      [chip(root, 'REMOVER ILUMINAÇÃO', 'dark'), 640, 1470, 2, 1.9],
    ];
    const CW = 900;
    const CH = 880;
    return (lt) => {
      tA.paint(lt, 0, 1.85);
      tB.paint(lt, 2.0, 4.3, { st: 0.07 });
      const a = E.out5(lin(lt, 0, 0.55));
      cmp.style.width = CW + 'px';
      cmp.style.height = CH + 'px';
      cmp.style.transform = `translate3d(${540 - CW / 2}px,${1000 - CH / 2 + (1 - a) * 300}px,0) rotateX(${(1 - a) * 30}deg) scale(${mix(0.9, 1, a)})`;
      cmp.style.opacity = a * (1 - lin(lt, 4.25, 4.5));
      // both recordings share the same framing: clay (t5) under, textured (t6) on top
      const sc = Math.max(CW / 780, CH / 595) * 1.12;
      for (const [im, src] of [[clay, S.clip('guid', 120 + lt * 30)], [tex, S.clip('gtex', lt * 30)]]) {
        setImg(im, src);
        Object.assign(im.style, { width: 780 * sc + 'px', height: 595 * sc + 'px', left: CW / 2 - 0.5 * 780 * sc + 'px', top: CH / 2 - 0.45 * 595 * sc + 'px' });
      }
      const wx = kf(lt, [[0, -140], [1.3, 640], [2.4, 230], [3.4, 760], [4.5, 450]]);
      const dx = 150;
      txw.style.clipPath = `polygon(${wx + dx}px 0, ${CW}px 0, ${CW}px ${CH}px, ${wx - dx}px ${CH}px)`;
      line.style.left = wx + 'px';
      line.style.transform = `rotate(${Math.atan2(2 * dx, CH) * 57.3}deg)`;
      place(lc, { x: 30, y: 30, ax: 0, ay: 0 });
      place(rc, { x: CW - 30, y: 30, ax: 1, ay: 0 });
      const p = E.out5(lin(lt, 0.9, 1.5));
      // the side card flips from the texture panel to Smart UV
      const fl = lin(lt, 2.15, 2.5);
      const uv = fl >= 0.5;
      panel.set({
        src: uv ? S.clip('uv', 60 + lt * 30) : S.clip('tex', 30 + lt * 30), size: uv ? SIZE.uv : SIZE.tex, w: 330, h: 560, x: mix(-250, 190, p), y: 1300,
        ry: 14 + Math.sin(fl * Math.PI) * 76 * (uv ? -1 : 1), rz: -4, zoom: 1.03, fx: 0.143, fy: 0.5, op: 1 - lin(lt, 4.25, 4.45),
      });
      place(uvChip, { x: 190, y: 985, r: -4, s: pop(lt, 2.45), o: 1 - lin(lt, 4.2, 4.4) });
      for (const [c, x, y, r, t] of chips) place(c, { x, y, r, s: pop(lt, t), o: 1 - lin(lt, 4.2, 4.4) });
    };
  });

  // 04D ─ SMART MESH P2.0 ───────────────────────────────────────────────── 31 → 36
  scene(31, 36, { bg: '#05090a' }, (root) => {
    const bg = $('img', 'full', root);
    const tint = $('div', 'fill', root);
    tint.style.background = 'linear-gradient(rgba(3,22,13,.5), rgba(2,8,6,.9))';
    const tA = new Title(root, ['[olg]SMART_MESH', { t: '[gr]P2.0', size: 250 }], { size: 190, y: 200 });
    const quad = chip(root, 'QUAD TOPOLOGY', 'dk');
    const main = new Card(root, 'glow');
    const topo = new Card(root, 'ylw');
    const counter = $('div', 'counter', root);
    const slider = $('div', 'slider', root, '<div class="fillb"></div><div class="knob"></div><div class="lo">500</div><div class="hi">25K</div>');
    const fillb = slider.children[0];
    const knob = slider.children[1];
    // mesh edit
    const tC = new Title(root, ['[olg]MESH_EDIT'], { size: 200, y: 200 });
    const sub = $('div', 'sub', root, 'SELECIONA · AJUSTA · REGENERA');
    const big = new Card(root, 'glow');
    const box = $('div', 'selbox', root, '<div class="fx"><div class="qgrid"></div><div class="bar"></div></div>');
    const fx = box.firstChild;
    const qgrid = fx.children[0];
    const bar = fx.children[1];
    const boxTag = chip(root, 'MESH EDIT', 'dk');
    const status = $('div', 'abs', root, '<div class="mono" style="font-size:28px;margin-bottom:14px"></div><div class="prog"><i></i></div>');
    const stTxt = status.children[0];
    const stBar = status.children[1].firstChild;
    return (lt) => {
      setImg(bg, S.clip('man', 90 + lt * 20));
      bg.style.filter = 'grayscale(1) contrast(1.6) brightness(.32) blur(2px)';
      bg.style.transform = `scale(${1.1 + lt * 0.02})`;
      // phase 1: Smart Mesh P2.0, quads, 500 → 25K faces
      tA.paint(lt, 0, 2.45, { st: 0.08 });
      place(quad, { x: 540, y: 690, s: pop(lt, 0.45), o: 1 - lin(lt, 2.4, 2.6) });
      const m = E.out5(lin(lt, 0.2, 0.8));
      main.set({
        src: S.clip('retopo', lt * 30), size: SIZE.retopo, w: 980, h: 520, x: 540, y: mix(1300, 1010, m), rx: mix(40, 6, m), ry: -4,
        zoom: mix(1, 2.0, E.inOut(lin(lt, 0.7, 2.2))), fx: 0.753, fy: 0.46, op: m * (1 - lin(lt, 2.4, 2.6)),
      });
      const tp = E.out5(lin(lt, 1.0, 1.5));
      topo.set({
        src: S.clip('topo', 40 + lt * 30), size: SIZE.topo, w: 300, h: 433, x: mix(1300, 905, tp), y: 860, ry: -16, rz: 4,
        zoom: 1.0, fx: 0.5, fy: 0.5, op: 1 - lin(lt, 2.4, 2.6),
      });
      const c = E.inOut(lin(lt, 0.9, 2.2));
      const faces = Math.round(mix(500, 25000, c) / 100) * 100;
      counter.innerHTML = faces.toLocaleString('pt-BR') + '<small>FACES</small>';
      const co = lin(lt, 0.75, 0.95) * (1 - lin(lt, 2.4, 2.6));
      place(counter, { x: 0, y: 1300, ax: 0, ay: 0, o: co });
      place(slider, { x: 0, y: 1520, ax: 0, ay: 0, o: co });
      fillb.style.width = c * 100 + '%';
      knob.style.left = c * 100 + '%';
      // phase 2: Mesh Edit, a region selected and regenerated
      tC.paint(lt, 2.55, 4.75);
      place(sub, { x: 0, y: 400, ax: 0, ay: 0, o: lin(lt, 2.8, 3.0) * (1 - lin(lt, 4.7, 4.9)) });
      const b = E.out5(lin(lt, 2.45, 3.0));
      big.set({
        src: S.clip('man', 240 + (lt - 2.5) * 12), size: SIZE.man, w: 900, h: 900, x: 540, y: mix(1500, 1010, b), rx: mix(30, 0, b),
        zoom: 1.85, fx: 0.495, fy: 0.27, op: b * (1 - lin(lt, 4.75, 4.95)), filter: 'contrast(1.15)',
      });
      const bx = E.out3(lin(lt, 3.05, 3.35));
      const bw = mix(40, 520, bx);
      const bh = mix(40, 440, bx);
      box.style.width = bw + 'px';
      box.style.height = bh + 'px';
      place(box, { x: 540, y: 780, o: lt > 3.05 ? 1 - lin(lt, 4.75, 4.9) : 0 });
      box.style.backgroundPosition = `${lt * 60}px 0, ${-lt * 60}px 100%, 0 ${-lt * 60}px, 100% ${lt * 60}px`;
      const rg = lin(lt, 3.45, 4.35);
      fx.style.backdropFilter = `brightness(${1 + 0.6 * Math.sin(rg * Math.PI)}) saturate(${1 - Math.sin(rg * Math.PI) * 0.8}) blur(${(1 - rg) * 8 * (rg > 0 ? 1 : 0)}px)`;
      fx.style.background = `rgba(93,255,160,${0.08 + 0.15 * Math.sin(rg * Math.PI)})`;
      qgrid.style.opacity = Math.sin(rg * Math.PI) * (0.4 + 0.3 * hash(Math.floor(lt * 30)));
      bar.style.top = mix(-70, bh, rg) + 'px';
      bar.style.display = rg > 0 && rg < 1 ? '' : 'none';
      place(boxTag, { x: 540 - bw / 2, y: 780 - bh / 2 - 14, ax: 0, ay: 1, s: pop(lt, 3.3, 0.3), o: 1 - lin(lt, 4.75, 4.9) });
      stTxt.innerHTML = rg >= 1 ? `<span style="color:var(--beam)">${SVG.check.replace('<svg', '<svg style="width:26px;height:26px;vertical-align:-4px"')} MALHA REGENERADA</span>` : 'REGENERANDO REGIÃO…';
      stBar.style.width = rg * 100 + '%';
      place(status, { x: 540, y: 1500, ax: 0.5, ay: 0, o: lin(lt, 3.4, 3.55) * (1 - lin(lt, 4.75, 4.9)) });
    };
  });

  // 04E ─ RIGGING ────────────────────────────────────────────────────────── 36 → 39.5
  scene(36, 39, { bg: 'radial-gradient(ellipse at 60% 55%, #123a2a, #050a08 70%)' }, (root) => {
    const tA = new Title(root, ['RIG TAMBÉM FAZ', '[gr]PARTE_DO_FLUXO.'], { size: 140, y: 215 });
    const tB = new Title(root, ['DO MODELO AO PERSONAGEM', { t: '[hl]PRONTO_PRA_ANIMAR.', size: 140 }], { size: 102, y: 215 });
    const panel = new Card(root, 'ylw');
    const glow = $('div', 'abs', root);
    Object.assign(glow.style, { width: '900px', height: '900px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(93,255,160,.35), transparent 65%)' });
    const rig = new Sprite(root);
    const chips = [
      [chip(root, 'HUMANOIDE', 'dk'), 860, 560, -4, 0.7],
      [chip(root, 'ESQUELETO MIXAMO'), 760, 1440, 3, 0.95],
      [chip(root, 'AUTO RIG', 'y'), 330, 1470, -3, 1.2],
    ];
    return (lt) => {
      tA.paint(lt, 0, 1.4);
      tB.paint(lt, 1.5, 2.78, { st: 0.05 });
      const p = E.out5(lin(lt, 0.05, 0.65));
      panel.set({
        src: S.clip('rig', 12 + lt * 22), size: SIZE.rig, w: 430, h: 720, x: mix(-300, 245, p), y: 1010, ry: 18, rz: -3,
        zoom: 1.02, fx: 0.15, fy: 0.5, op: 1 - lin(lt, 2.78, 2.98),
      });
      place(glow, { x: 690, y: 990, s: 1 + 0.05 * Math.sin(lt * 6), o: lin(lt, 0.2, 0.6) * (1 - lin(lt, 2.78, 2.98)) });
      const r = pop(lt, 0.2, 0.5);
      if (lt < 1.6) rig.set({ src: S.st('huehue', 'rig', lt * 30), x: 700, y: 990, w: 820, h: 820, s: r, op: 1 });
      else rig.set({ src: S.st('huehue', 'rigrun', (lt - 1.6) * 30), x: 720, y: 1000, w: 640, h: 960, s: mix(1.15, 1.3, lin(lt, 1.6, 3)), op: 1 - lin(lt, 2.78, 2.98) });
      for (const [c, x, y, rr, t] of chips) place(c, { x, y, r: rr, s: pop(lt, t - 0.1), o: 1 - lin(lt, 2.72, 2.92) });
    };
  });

  // 04F ─ ANIMAÇÃO ───────────────────────────────────────────────────────── 39.5 → 41.5
  scene(39, 41.5, { bg: 'linear-gradient(#0d1a2c, #060a12)' }, (root) => {
    const streaks = $('div', 'fill', root);
    streaks.style.backgroundImage = 'repeating-linear-gradient(0deg, transparent 0 46px, rgba(255,255,255,.06) 46px 50px, transparent 50px 130px)';
    const back = $('div', 'h', root);
    Object.assign(back.style, { top: '700px', fontSize: '470px', width: '4000px', textAlign: 'left', color: 'transparent', WebkitTextStroke: '3px rgba(93,255,160,.28)' });
    back.textContent = 'ANIMAÇÃO ANIMAÇÃO ANIMAÇÃO ';
    const ground = $('div', 'abs', root);
    Object.assign(ground.style, { width: '2400px', height: '8px', backgroundImage: 'repeating-linear-gradient(90deg, rgba(255,255,255,.5) 0 60px, transparent 60px 120px)' });
    const tA = new Title(root, ['E ELES', { t: '[gr]GANHAM_VIDA', size: 190 }], { size: 130, y: 215 });
    const prompt = $('div', 'abs', root);
    Object.assign(prompt.style, { width: '900px', height: '96px', borderRadius: '20px', background: 'rgba(10,12,22,.92)', border: '3px solid #7b61ff',
      boxShadow: '0 0 50px rgba(123,97,255,.35)', fontFamily: 'CP', fontWeight: 600, fontSize: '38px', color: '#f4f7ff', padding: '24px 30px', whiteSpace: 'nowrap', letterSpacing: '.02em' });
    const ttm = chip(root, 'TEXT TO MOTION', 'v');
    const go = chip(root, 'GERAR', 'y');
    const PROMPT = 'correndo em pânico do OVNI';
    const C = [
      ['huehue', 'HUEHUE', 210, 0],
      ['cabeca_guidao', 'CABEÇA DE GUIDÃO', 540, 7],
      ['manoel_gomes', 'MANOEL GOMES', 870, 15],
    ].map(([id, name, x, off]) => ({ id, x, off, sp: new Sprite(root), c: chip(root, name, 'dark') }));
    return (lt) => {
      streaks.style.backgroundPosition = `${-lt * 2000}px 0`;
      back.style.transform = `translateX(${-200 - lt * 700}px)`;
      place(ground, { x: -lt * 1200 % 120 - 200, y: 1345, ax: 0, ay: 0.5 });
      tA.paint(lt, 0, 2.25);
      // Text to Motion: a prompt typed, the motion comes out
      const n = Math.floor(lin(lt, 0.15, 0.8) * PROMPT.length);
      const cur = Math.floor(lt * 4) % 2 === 0 || n < PROMPT.length ? '<span style="color:#7b61ff">▍</span>' : '';
      prompt.innerHTML = `<span style="color:rgba(244,247,255,.45)">›&nbsp;</span>${PROMPT.slice(0, n)}${cur}`;
      const po = lin(lt, 0, 0.15) * (1 - lin(lt, 2.3, 2.5));
      place(prompt, { x: 540, y: 650, o: po });
      place(ttm, { x: 120, y: 598, ax: 0, ay: 1, r: -3, s: pop(lt, 0.05, 0.3), o: po });
      place(go, { x: 975, y: 650, ax: 1, s: pop(lt, 0.82, 0.25), o: po });
      C.forEach((c, i) => {
        const s = pop(lt, 0.9 + i * 0.1, 0.4);
        c.sp.set({ src: S.st(c.id, 'run', lt * 30 + c.off), x: c.x, y: 1030, w: 420, h: 630, s, op: 1 - lin(lt, 2.3, 2.5) });
        place(c.c, { x: c.x, y: 1405, s: 0.78 * pop(lt, 1.1 + i * 0.1, 0.3), o: 1 - lin(lt, 2.3, 2.5) });
      });
    };
  });

  // 04G ─ EXPORT GLB → JOGO ──────────────────────────────────────────────── 41.5 → 44.5
  const PIPE_Y = [600, 760, 920, 1080, 1240, 1400];
  scene(41.5, 44.5, { bg: 'radial-gradient(ellipse at 30% 50%, #171a3a, #07080f 70%)' }, (root) => {
    const tA = new Title(root, ['EXPORTEI EM [gr]GLB', 'DIRETO PRO JOGO'], { size: 128, y: 205 });
    const pline = $('div', 'pline', root, '<i></i>');
    Object.assign(pline.style, { top: PIPE_Y[0] + 'px', height: PIPE_Y[5] - PIPE_Y[0] + 'px' });
    const names = ['REFERÊNCIA', 'MODELO 3D', 'TEXTURA', 'RIG', 'GLB', 'ASSET NO JOGO'];
    const nodes = names.map((n, i) => {
      const node = $('div', 'node', root, String(i + 1));
      node.style.top = PIPE_Y[i] + 'px';
      const lb = $('div', 'nlabel', root, n);
      lb.style.top = PIPE_Y[i] + 'px';
      return { node, lb };
    });
    const thumbs = [new Card(root, 'ylw'), new Card(root), new Card(root), new Sprite(root), null, new Card(root, 'glow')];
    const glb = $('div', 'glbchip', root, '.GLB');
    return (lt) => {
      tA.paint(lt, 0, 2.4);
      const act = (i) => lt >= 0.3 + i * 0.28;
      pline.firstChild.style.height = clamp((lt - 0.3) / (5 * 0.28)) * 100 + '%';
      const out = 1 - lin(lt, 2.45, 2.7);
      pline.style.opacity = out;
      nodes.forEach((n, i) => {
        n.node.className = 'node' + (act(i) ? ' on' : '');
        n.lb.className = 'nlabel' + (act(i) ? ' on' : '');
        const s = act(i) ? 1 + 0.25 * (1 - E.out3(lin(lt, 0.3 + i * 0.28, 0.55 + i * 0.28))) : 1;
        n.node.style.transform = `scale(${s})`;
        n.node.style.opacity = out;
        n.lb.style.opacity = out;
        n.lb.style.transform = `translateX(${act(i) ? 0 : -20}px)`;
      });
      const tp = (i) => E.back(lin(lt, 0.3 + i * 0.28, 0.6 + i * 0.28));
      const TX = 900;
      thumbs[0].set({ src: S.clip('upload', 180), size: SIZE.upload, w: 210, h: 130, x: TX, y: PIPE_Y[0], s: tp(0), zoom: 3.2, fx: 0.0745, fy: 0.25, rz: -3, op: out });
      thumbs[1].set({ src: S.clip('man', 240), size: SIZE.man, w: 210, h: 130, x: TX, y: PIPE_Y[1], s: tp(1), zoom: 1.4, fy: 0.3, rz: 3, op: out });
      thumbs[2].set({ src: S.clip('gtex', 20), size: SIZE.gtex, w: 210, h: 130, x: TX, y: PIPE_Y[2], s: tp(2), zoom: 1.6, fy: 0.3, rz: -2, op: out });
      thumbs[3].set({ src: S.st('huehue', 'rig', 0), x: TX, y: PIPE_Y[3], w: 160, h: 160, s: tp(3), op: out });
      place(glb, { x: TX, y: PIPE_Y[4], s: tp(4) * 0.8, r: 3, o: out });
      // the game frame grows out of the last thumbnail (continued by the payoff scene)
      thumbs[5].set({ src: S.game('payoff', 0), size: [1080, 1920], w: 210, h: 130, x: TX, y: PIPE_Y[5], s: tp(5), zoom: 1.4, fy: 0.45, op: 1 });
    };
  });

  // 05 ─ PAYOFF ──────────────────────────────────────────────────────────── 44.5 → 49.5
  scene(44.5, 49.5, { pre: 0.5 }, (root) => {
    const bg = $('img', 'full', root);
    const bot = $('div', 'grad-bot', root);
    const top = $('div', 'grad-top', root);
    top.style.height = '420px';
    const flow = $('div', 'flow', root);
    const steps = ['OBJETO', 'JOGO', 'OVNI PUXA', 'PONTOS'].map((s, i, a) => {
      const el = $('div', 'st', flow, s);
      if (i < a.length - 1) $('span', '', flow, SVG.arrow).style.color = 'rgba(244,247,255,.7)';
      return el;
    });
    const flyers = ['huehue', 'manoel_gomes', 'cabeca_guidao'].map((id) => ({ id, sp: new Sprite(root) }));
    const NAMES = { huehue: 'HUEHUE', manoel_gomes: 'MANOEL GOMES', cabeca_guidao: 'CABEÇA DE GUIDÃO' };
    const toast = $('div', 'toast', root);
    const tA = new Title(root, ['OS ASSETS VIRARAM', { t: '[hl]A_PRÓPRIA_MECÂNICA.', size: 128 }], { size: 116, y: 1140 });
    const tB = new Title(root, ['NO ABDUZIU, OS ASSETS', { t: 'TAMBÉM SÃO [hl]GAMEPLAY.', size: 112 }], { size: 104, y: 1140 });
    return (lt) => {
      // window grows from the pipeline thumbnail to full screen
      const g = E.inOut(lin(lt, -0.5, 0));
      if (g < 1) {
        const cx = mix(900, 540, g);
        const cy = mix(PIPE_Y[5], 960, g);
        const hw = mix(105, 540, g);
        const hh = mix(65, 960, g);
        root.style.clipPath = `inset(${cy - hh}px ${W - cx - hw}px ${H - cy - hh}px ${cx - hw}px round ${mix(26, 0, g)}px)`;
      } else root.style.clipPath = '';
      setImg(bg, S.game('payoff', Math.max(0, lt) * 30));
      bg.style.transform = `scale(${mix(1.08, 1, g)})`;
      steps.forEach((s, i) => (s.className = 'st' + (lt > 0.25 + i * 0.35 ? ' on' : '')));
      flow.style.opacity = lin(lt, 0.05, 0.25);
      let last = null;
      flyers.forEach((f, i) => {
        const s0 = 1.0 + i * 0.75;
        const u = lin(lt, s0, s0 + 2.4);
        if (u >= 1) last = f;
        f.sp.set({
          show: u > 0 && u < 1, src: S.st(f.id, 'freaky', lt * 30 + i * 5), x: 540 + Math.sin(u * 7 + i * 2) * 80, y: mix(1450, 470, E.inOut(u)),
          w: 330, h: 495, s: mix(1, 0.2, E.in3(u)), r: mix(0, i % 2 ? 200 : -200, E.inOut(u)), op: 1 - lin(u, 0.85, 1),
          filter: 'drop-shadow(0 0 26px rgba(93,255,160,.9)) brightness(1.08)',
        });
      });
      // a toast for the latest catch
      let tf = null;
      flyers.forEach((f, i) => {
        const end = 1.0 + i * 0.75 + 2.4;
        if (lt >= end && lt < end + 0.8) tf = { f, t: lt - end };
      });
      if (tf) {
        toast.innerHTML = `<b>+1</b> ${NAMES[tf.f.id]} <b>ABDUZIDO!</b>`;
        place(toast, { x: 540, y: 380, s: pop(tf.t, 0, 0.25), o: 1 - lin(tf.t, 0.6, 0.8) });
      } else place(toast, { show: false });
      bot.style.opacity = lin(lt, 0.2, 0.5);
      tA.paint(lt, 0.3, 2.45, { st: 0.06 });
      tB.paint(lt, 2.65, 4.85, { st: 0.06 });
      void last;
    };
  });

  // 06 ─ MEMES BRASILEIROS ──────────────────────────────────────────────── 49.5 → 55.5
  const MEMES = [
    ['cadeira', 'CADEIRA DE PLÁSTICO'], ['botijao', 'BOTIJÃO DE GÁS'], ['caixa_dagua', 'CAIXA D’ÁGUA AZUL'], ['carrinho_mercado', 'CARRINHO DE MERCADO'],
    ['churrasqueira', 'CHURRASQUEIRA'], ['cone', 'CONE'], ['carrinho_rolima', 'CARRINHO DE ROLIMÃ'], ['van', 'VAN ESCOLAR'],
    ['brasilia_amarela', 'BRASÍLIA AMARELA'], ['moto', 'MOTO'], ['poste', 'POSTE'], ['lixeira', 'LIXEIRA'], ['uno_escada', 'UNO COM ESCADA'],
    ['carro_pamonha', 'CARRO DA PAMONHA'], ['caramelo_dourado', 'CARAMELO'],
  ];
  const FLAG = ['#009c3b', '#ffdf00', '#002776'];
  scene(49.5, 55.5, { bg: '#009c3b' }, (root) => {
    const stripes = $('div', 'fill', root);
    stripes.style.backgroundImage = 'repeating-linear-gradient(-30deg, #009c3b 0 140px, #ffdf00 140px 280px, #002776 280px 420px)';
    stripes.style.inset = '-600px';
    const shade = $('div', 'fill', root);
    const rain = Array.from({ length: 12 }, (_, i) => ({ sp: new Sprite(root), id: WALL[(i * 7) % WALL.length], i }));
    const tA = new Title(root, ['PRA DEIXAR O JOGO', { t: '[hy]MAIS_DIVERTIDO...', size: 160 }], { size: 130, y: 760 });
    const band = $('div', 'abs', root);
    Object.assign(band.style, { width: '1080px', height: '440px', background: 'linear-gradient(rgba(6,8,14,.92) 75%, rgba(6,8,14,0))' });
    const tB = new Title(root, ['EU COLOQUEI', { t: '[yl]MEMES_BRASILEIROS', size: 128 }, 'NO CATÁLOGO'], { size: 96, y: 190 });
    const beam = $('div', 'beam', root);
    const item = new Sprite(root);
    const prev = new Sprite(root);
    const label = $('div', 'label', root, '<span></span>');
    const trio = ['huehue', 'cabeca_guidao', 'manoel_gomes'].map((id, i) => ({ id, sp: new Sprite(root), x: [230, 540, 850][i] }));
    const names = $('div', 'label', root, '<span style="font-size:58px">HUEHUE · CABEÇA DE GUIDÃO · MANOEL GOMES</span>');
    const D = 0.22;
    const T0 = 1.75;
    return (lt) => {
      stripes.style.transform = `translate(${(lt * 160) % 485}px, 0)`;
      shade.style.background = lt < 1.65 ? 'rgba(6,8,14,.55)' : 'rgba(6,8,14,.25)';
      rain.forEach((r) => {
        const y = ((lt * 260 + r.i * 230) % 2300) - 250;
        r.sp.set({ show: lt < 1.7, src: S.obj(r.id), x: 90 + ((r.i * 397) % 900), y, w: 260, h: 260, r: lt * 60 * (r.i % 2 ? 1 : -1) + r.i * 30, op: 0.55, filter: 'blur(2px)' });
      });
      tA.paint(lt, 0, 1.5, { st: 0.07 });
      const on2 = lt >= 1.6;
      band.style.display = on2 ? '' : 'none';
      tB.paint(lt, 1.6, 1e9, { st: 0.05 });
      // beam from under the title
      beam.style.display = on2 ? '' : 'none';
      beam.style.top = '470px';
      beam.style.opacity = 0.65 + 0.2 * Math.sin(lt * 20);
      beam.style.transform = `scaleX(${E.out3(lin(lt, 1.6, 1.9))})`;
      const k = lt - T0;
      const i = Math.floor(k / D);
      const run = k >= 0 && i < MEMES.length;
      item.set({ show: false });
      prev.set({ show: false });
      label.style.display = 'none';
      if (run) {
        const u = (k - i * D) / D;
        root.style.background = FLAG[i % 3];
        const [id, name] = MEMES[i];
        item.set({ src: S.obj(id), x: 540, y: 1010, w: 640, h: 640, s: mix(0.35, 1, E.back(Math.min(1, u * 2))), r: (i % 2 ? 1 : -1) * 6,
          filter: 'drop-shadow(0 30px 40px rgba(0,0,0,.4))' });
        label.firstChild.textContent = name;
        label.style.display = '';
        place(label, { x: 0, y: 1350, ax: 0, ay: 0, s: mix(1.2, 1, E.out5(Math.min(1, u * 3))) });
        if (i > 0) {
          const v = E.out3(Math.min(1, u * 1.5));
          prev.set({ src: S.obj(MEMES[i - 1][0]), x: 540, y: mix(960, 520, v), w: 640, h: 640, s: mix(0.75, 0.08, v), r: v * 160, op: 1 - lin(u, 0.5, 0.67),
            filter: 'drop-shadow(0 0 30px rgba(93,255,160,.9))' });
        }
      }
      // grand finale: the three Tripo characters, then up they go
      const tt = T0 + MEMES.length * D;
      if (lt >= tt) {
        root.style.background = '#002776';
        const up = E.in3(lin(lt, tt + 0.6, tt + 0.95));
        trio.forEach((c, j) => {
          c.sp.set({ src: S.st(c.id, 'freaky', lt * 30 + j * 6), x: mix(c.x, 540, up), y: mix(1040, 520, up), w: 330, h: 495,
            s: pop(lt, tt + j * 0.06, 0.3) * mix(1, 0.15, up), r: up * (j - 1) * 120, filter: 'drop-shadow(0 0 30px rgba(93,255,160,.8))' });
        });
        place(names, { x: 0, y: 1360, ax: 0, ay: 0, o: lin(lt, tt + 0.05, tt + 0.15) * (1 - up) });
      } else {
        trio.forEach((c) => c.sp.set({ show: false }));
        place(names, { show: false });
      }
    };
  });

  // 07 ─ CTA ─────────────────────────────────────────────────────────────── 55.5 → 63.5
  scene(55.5, 63.5, { bg: 'radial-gradient(ellipse at 50% 18%, #3b3110 0%, #0a0c14 45%, #06080e 100%)' }, (root) => {
    const floaters = Array.from({ length: 8 }, (_, i) => ({ sp: new Sprite(root), id: MEMES[(i * 2) % MEMES.length][0], i }));
    const lock = $('div', 'sub', root, 'TRIPO × ABDUZIU.FUN');
    const n500 = $('div', 'big500', root, '+500');
    const tC = new Title(root, ['CRÉDITOS BÔNUS'], { size: 120, y: 520 });
    const card = $('div', 'codecard', root, '<div class="lb">CÓDIGO DE CONVITE</div><div class="slots"></div>');
    const CODE = 'RIWOHB';
    const slots = [...CODE].map(() => $('div', 'slot', card.children[1]));
    const s1 = $('div', 'step', root, '<div class="n">1</div><div class="tx">Acesse o <b>link na descrição</b> e crie sua conta</div>');
    const ou = $('div', 'ou', root, '— OU —');
    const s2 = $('div', 'step', root, `<div class="n">2</div><div class="tx">No site da Tripo: <b>Referral Program</b> e digite <b>${CODE}</b></div>`);
    const warn = $('div', 'warn', root, `${SVG.warn}O campo para inserir o código de convite aparece apenas nas <u>primeiras 24 horas</u> após a criação da conta.`);
    const tD = new Title(root, ['COMENTA UM [yl]MEME OU', '[yl]OBJETO_BRASILEIRO QUE', 'VOCÊ QUER VER SENDO', { t: '[hl]ABDUZIDO_NO_ABDUZIU.', size: 104 }], { size: 92, y: 990 });
    const logo = $('div', 'logo', root, 'ABDUZIU<span>.FUN</span>');
    logo.style.fontSize = '120px';
    const AL = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    return (lt) => {
      floaters.forEach((f) => {
        const x = 80 + ((f.i * 331) % 920);
        const y = 1900 - ((lt * 70 + f.i * 260) % 2100);
        f.sp.set({ src: S.obj(f.id), x, y, w: 200, h: 200, r: lt * 20 * (f.i % 2 ? 1 : -1), op: 0.16, filter: 'blur(3px)' });
      });
      place(lock, { x: 0, y: 195, ax: 0, ay: 0, o: lin(lt, 0.1, 0.4) });
      const p5 = lin(lt, 0.05, 0.4);
      place(n500, { x: 0, y: 255, ax: 0, ay: 0, s: mix(1.6, 1, E.out5(p5)), o: p5 });
      n500.style.transformOrigin = '540px 150px';
      tC.paint(lt, 0.25);
      const cp = E.back(lin(lt, 0.45, 0.85));
      place(card, { x: 540, y: 820, s: cp, o: lin(lt, 0.45, 0.6) });
      slots.forEach((s, i) => {
        const rv = 0.75 + i * 0.09;
        s.textContent = lt >= rv ? CODE[i] : AL[Math.floor(hash(Math.floor(lt * 30) * 7 + i) * AL.length)];
        s.style.color = lt >= rv ? '#fff' : 'rgba(255,255,255,.35)';
        s.style.transform = lt >= rv ? `scale(${1 + 0.18 * (1 - E.out3(lin(lt, rv, rv + 0.25)))})` : '';
      });
      // how to redeem → then the community ask
      const out = E.in3(lin(lt, 5.0, 5.35));
      const sp = (t0) => ({ x: -out * 900, o: lin(lt, t0, t0 + 0.25) * (1 - out) });
      const a = sp(1.2);
      place(s1, { x: a.x, y: 1010, ax: 0, ay: 0, o: a.o });
      place(ou, { x: a.x, y: 1145, ax: 0, ay: 0, o: lin(lt, 1.45, 1.6) * (1 - out) });
      const b = sp(1.55);
      place(s2, { x: b.x, y: 1200, ax: 0, ay: 0, o: b.o });
      const c = sp(1.95);
      place(warn, { x: c.x, y: 1345, ax: 0, ay: 0, o: c.o, s: 1 + 0.015 * Math.sin(lt * 8) * (lt > 2.2 ? 1 : 0) });
      tD.paint(lt, 5.3, 1e9, { st: 0.05 });
      const lg = lin(lt, 6.3, 6.6);
      place(logo, { x: 0, y: 1395, ax: 0, ay: 0, s: mix(1.4, 1, E.out5(lg)), o: lg });
      logo.style.transformOrigin = '540px 60px';
    };
  });

  // ─── global layers
  const hud = $('div', '', stage);
  hud.id = 'hud';
  const brand = $('div', '', stage, 'ABDUZIU<span>.FUN</span> × TRIPO');
  brand.id = 'brand';
  const flash = $('div', '', stage);
  flash.id = 'flash';
  const grain = $('div', '', stage);
  grain.id = 'grain';
  const vig = $('div', '', stage);
  vig.id = 'vig';
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
  const CHAPTERS = [
    [0, '01', 'A IDEIA'], [6.5, '02', 'PROTÓTIPO'], [11.5, '03', 'ASSETS'], [16, '04', 'TRIPO'], [19, '04', 'IMAGEM/TEXTO → 3D'],
    [23, '04', 'MULTIVISÕES'], [26.5, '04', 'TEXTURA · PBR · SMART UV'], [31, '04', 'SMART MESH P2.0'], [36, '04', 'RIGGING'],
    [39, '04', 'TEXT TO MOTION'], [41.5, '04', 'EXPORT GLB'], [44.5, '05', 'GAMEPLAY'], [49.5, '06', 'MEMES'], [55.5, '07', 'BÔNUS'],
  ];
  const CUTS = [6.5, 11.5, 16, 19, 23, 26.5, 31, 36, 39, 41.5, 44.5, 49.5, 55.5];
  const FLASH = [[6.5, '#5dffa0', 0.3], [11.5, '#ffffff', 0.35], [16, '#ffd23f', 0.85], [19, '#ffffff', 0.22], [23, '#5dffa0', 0.3], [26.5, '#ffffff', 0.22],
    [31, '#5dffa0', 0.35], [36, '#ffffff', 0.25], [39, '#7b61ff', 0.3], [41.5, '#7b61ff', 0.3], [49.5, '#ffdf00', 0.6], [55.5, '#ffffff', 0.75]];

  async function paint(t) {
    pending = [];
    for (const s of SCENES) {
      const on = t >= s.t0 - s.pre && t < s.t1 + s.post;
      s.root.style.display = on ? 'block' : 'none';
      if (on) s.paint(t - s.t0, t);
    }
    // a little punch on every cut
    let cut = -9;
    for (const c of CUTS) if (t >= c) cut = c;
    const pk = 1 - E.out3(lin(t, cut, cut + 0.3));
    stage.style.transform = `scale(${1 + 0.03 * pk})`;
    let fl = 0;
    let col = '#fff';
    for (const [ft, c, a] of FLASH) {
      const v = t >= ft ? a * (1 - E.out3(lin(t, ft, ft + 0.35))) : 0;
      if (v > fl) {
        fl = v;
        col = c;
      }
    }
    flash.style.background = col;
    flash.style.opacity = fl;
    const f = Math.floor(t * 30);
    grain.style.transform = `translate(${Math.floor(hash(f) * 64) - 32}px, ${Math.floor(hash(f + 0.5) * 64) - 32}px)`;
    let ch = CHAPTERS[0];
    for (const c of CHAPTERS) if (t >= c[0]) ch = c;
    const n = Number(ch[1]);
    hud.innerHTML = `<b>${ch[1]}</b> / ${ch[2]}<div class="bar">${[1, 2, 3, 4, 5, 6, 7].map((i) => `<i class="${i <= n ? 'on' : ''}"></i>`).join('')}</div>`;
    hud.style.opacity = brand.style.opacity = lin(t, 0.3, 0.8) * (1 - lin(t, 55.4, 55.6));
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
