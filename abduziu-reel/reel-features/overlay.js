/*
 * ABDUZIU feature reel — caption layer (1080×1920, transparent), one language per render.
 * Stateless: paint(t) rebuilds the whole frame for time t, so any frame renders on its own.
 *
 *   OVERLAY.init({ lang: 'en', tracks, events })   // tracks/events captured with the footage
 *   OVERLAY.paint(12.5)
 */
(() => {
  const FPS = 60;
  const BEAT = 0.4; // 150 BPM
  const SHOTS = [
    ['hook', 0, 2.4],
    ['orbit', 2.4, 4.8],
    ['grow', 4.8, 7.2],
    ['beach', 7.2, 9.6],
    ['legends', 9.6, 12.0],
    ['army', 12.0, 14.4],
    ['arena', 14.4, 16.8],
    ['friends', 16.8, 19.2],
    ['skins', 19.2, 21.6],
    ['end', 21.6, 25.6],
  ];
  const CUTS = SHOTS.map((s) => s[1]).filter((t) => t > 0);
  const ACC = { green: '#5dffa0', gold: '#ffcf3f', pink: '#ff5ad1', cyan: '#4dc9ff', red: '#ff4d5e', orange: '#ff9a3d' };
  const SKINS = [
    // id, start (s into the shot), tier colour
    ['neon_rosa', 0, '#4dc9ff'],
    ['lava', 0.3, '#c28bff'],
    ['cristal', 0.6, '#c28bff'],
    ['ouro', 0.9, '#ffcf3f'],
    ['buraco_negro', 1.2, '#ff5ad1'],
    ['nave_mae', 1.5, '#ff5ad1'],
  ];
  const CITIES = ['RIO', 'SÃO PAULO', 'SALVADOR', 'RECIFE', 'MANAUS', 'BRASÍLIA'];

  const COPY = {
    en: {
      hook: { lines: ['ABDUCT THE', '*WHOLE CITY*'], acc: 'gold', place: 'SÃO PAULO' },
      orbit: { lines: ['DROP IN', '*FROM ORBIT*'], acc: 'cyan', place: 'RIO DE JANEIRO' },
      grow: { a: ['START', '*TINY...*'], b: ['...END UP', '*GIANT*'], acc: 'green', gauge: 'SAUCER SIZE' },
      beach: { lines: ['ABDUCT', '*ANYTHING*'], sub: '<b>227</b> OBJECTS TO COLLECT', acc: 'pink', count: 'COLLECTION' },
      legends: { lines: ['HUNT SECRET', '*LEGENDS*'], acc: 'gold', place: 'SALVADOR' },
      army: { lines: ['THE ARMY', '*FIGHTS BACK*'], acc: 'red', alert: 'THREAT LEVEL: MAX', place: 'BRASÍLIA' },
      arena: { lines: ['EAT OTHER', '*SAUCERS*'], sub: 'LIVE <b>ONLINE PvP</b>', acc: 'pink', burst: 'GULP!' },
      friends: { lines: ['SQUAD UP WITH', '*FRIENDS*'], sub: 'INVITE BY <b>NICK#CODE</b>', acc: 'cyan', me: 'YOU', joined: 'joined your squad', party: 'SQUAD 4/8', btn: 'PLAY' },
      skins: { lines: ['UNLOCK', '*LEGENDARY SKINS*'], acc: 'pink' },
      end: { tagline: 'ALIEN INVASION · BRAZIL', cta: 'PLAY FREE', fine: 'NO DOWNLOAD · PHONE & PC' },
      legendNames: { saci: 'SACI', et_varginha: 'VARGINHA ALIEN', mula_sem_cabeca: 'HEADLESS MULE', curupira: 'CURUPIRA', boitata: 'BOITATÁ', chupacabra: 'CHUPACABRA', caramelo_dourado: 'GOLDEN CARAMELO' },
      skinNames: { neon_rosa: ['NEON PINK', 'RARE'], lava: ['LAVA', 'EPIC'], cristal: ['ICE CRYSTAL', 'EPIC'], ouro: ['24K GOLD', 'LEGENDARY'], buraco_negro: ['BLACK HOLE', 'SUPER CLASS'], nave_mae: ['MOTHERSHIP', 'SUPER CLASS'] },
    },
    pt: {
      hook: { lines: ['ABDUZA A', '*CIDADE INTEIRA*'], acc: 'gold', place: 'SÃO PAULO' },
      orbit: { lines: ['DESÇA DIRETO', '*DA ÓRBITA*'], acc: 'cyan', place: 'RIO DE JANEIRO' },
      grow: { a: ['COMECE', '*PEQUENO...*'], b: ['...E FIQUE', '*GIGANTE*'], acc: 'green', gauge: 'TAMANHO DA NAVE' },
      beach: { lines: ['ABDUZA', '*QUALQUER COISA*'], sub: '<b>227</b> OBJETOS PRA COLECIONAR', acc: 'pink', count: 'CATÁLOGO' },
      legends: { lines: ['CACE LENDAS', '*SECRETAS*'], acc: 'gold', place: 'SALVADOR' },
      army: { lines: ['O EXÉRCITO', '*REVIDA*'], acc: 'red', alert: 'AMEAÇA: MÁXIMA', place: 'BRASÍLIA' },
      arena: { lines: ['ENGULA OUTRAS', '*NAVES*'], sub: '<b>PvP ONLINE</b> AO VIVO', acc: 'pink', burst: 'NHAC!' },
      friends: { lines: ['JOGUE COM OS', '*AMIGOS*'], sub: 'CHAME PELO <b>NICK#CÓDIGO</b>', acc: 'cyan', me: 'VOCÊ', joined: 'entrou no seu squad', party: 'SQUAD 4/8', btn: 'JOGAR' },
      skins: { lines: ['DESBLOQUEIE', '*SKINS LENDÁRIAS*'], acc: 'pink' },
      end: { tagline: 'INVASÃO ALIENÍGENA · BRASIL', cta: 'JOGUE GRÁTIS', fine: 'SEM DOWNLOAD · CELULAR E PC' },
      legendNames: { saci: 'SACI-PERERÊ', et_varginha: 'ET DE VARGINHA', mula_sem_cabeca: 'MULA SEM CABEÇA', curupira: 'CURUPIRA', boitata: 'BOITATÁ', chupacabra: 'CHUPA-CABRA', caramelo_dourado: 'CARAMELO DOURADO' },
      skinNames: { neon_rosa: ['NEON ROSA', 'RARO'], lava: ['LAVA', 'ÉPICO'], cristal: ['CRISTAL DE GELO', 'ÉPICO'], ouro: ['OURO 24K', 'LENDÁRIO'], buraco_negro: ['BURACO NEGRO', 'SUPER CLASSE'], nave_mae: ['NAVE-MÃE', 'SUPER CLASSE'] },
    },
  };
  // id, nick, code, colour, nudge (px) from the tracked point down onto the saucer's dome
  const FRIENDS = [
    ['f0', 'ZECA', '#7K2P', '#ffd23f', 235],
    ['f1', 'BIA', '#Q4M9', '#ff5ad1', 250],
    ['f2', 'LUA', '#X3A8', '#ff9a3d', 262],
  ];

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, k) => a + (b - a) * k;
  const prog = (x, a, d) => clamp((x - a) / d, 0, 1);
  const outCubic = (x) => 1 - Math.pow(1 - x, 3);
  const outBack = (x) => 1 + 2.4 * Math.pow(x - 1, 3) + 1.4 * Math.pow(x - 1, 2);
  const PIN = '<svg viewBox="0 0 24 24"><path fill="#ff4d5e" d="M12 2C8.1 2 5 5.1 5 9c0 5.2 7 13 7 13s7-7.8 7-13c0-3.9-3.1-7-7-7zm0 9.5a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5z"/></svg>';

  let L = COPY.en;
  let lang = 'en';
  const TR = {}; // shot -> Map(frame -> row)
  const EV = {}; // shot -> events
  const stage = document.getElementById('stage');

  function el(tag, cls, html, parent = stage) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    parent.appendChild(e);
    return e;
  }
  function row(shot, t) {
    const m = TR[shot];
    if (!m) return null;
    const f = Math.round(t * FPS);
    return m.get(f) ?? m.get(f - 1) ?? null;
  }

  /** Big two-line caption: words punch in one after the other, the *starred* phrase on a colour box. */
  function caption(lines, lt, acc, t, opts = {}) {
    const cap = el('div', 'cap');
    cap.style.setProperty('--acc', ACC[acc]);
    if (opts.top != null) cap.style.top = `${opts.top}px`;
    let wi = 0;
    for (const line of lines) {
      const ln = el('div', 'line', null, cap);
      const hl = /^\*(.*)\*$/.exec(line);
      const words = (hl ? hl[1] : line).split(' ');
      let host = ln;
      if (hl) {
        host = el('span', 'hl', null, ln);
        const box = el('span', 'box', null, host);
        const kb = outCubic(prog(lt, 0.05 + wi * 0.07, 0.16));
        box.style.transform = `skewX(-10deg) scaleX(${kb})`;
        host.style.display = 'inline-flex';
        host.style.gap = '20px';
      }
      for (const w of words) {
        const k = prog(lt, 0.02 + wi * 0.07 + (hl ? 0.06 : 0), 0.22);
        const s = lerp(1.55, 1, outBack(k));
        const e = el('span', 'w', w, host);
        e.style.opacity = String(clamp(k * 4, 0, 1));
        e.style.transform = `translateY(${(1 - outCubic(k)) * 36}px) scale(${s})`;
        e.style.filter = k < 1 ? `blur(${(1 - k) * 10}px)` : '';
        wi++;
      }
    }
    // gentle push-in over the shot + a kick on every beat
    const ph = (t % BEAT) / BEAT;
    const bump = 1 + 0.022 * Math.exp(-ph * 7);
    cap.style.transform = `scale(${(1 + lt * 0.012) * bump})`;
    // keep long lines inside the frame
    for (const ln of cap.children) {
      const w = ln.scrollWidth;
      if (w > 1000) ln.style.transform = `scale(${1000 / w})`;
    }
    if (opts.sub) {
      const k = prog(lt, 0.3, 0.2);
      const sub = el('div', 'sub', opts.sub, cap);
      sub.style.opacity = String(k);
      sub.style.transform = `translateY(${(1 - outCubic(k)) * 20}px)`;
    }
    return cap;
  }
  function place(name, lt, top = 640) {
    const k = prog(lt, 0.35, 0.2);
    const c = el('div', 'chip', `${PIN}<span>${name}</span>`);
    c.style.top = `${top}px`;
    c.style.opacity = String(k);
    c.style.transform = `translateX(-50%) translateY(${(1 - outCubic(k)) * 16}px)`;
  }

  /** Keeps world tags inside the frame, under the caption, and pushes overlapping ones apart. */
  function settle(tags, minTop = 690) {
    const boxes = [];
    for (const e of tags) {
      const r = e.getBoundingClientRect();
      let dx = 0;
      if (r.left < 24) dx = 24 - r.left;
      if (r.right > 1056) dx = 1056 - r.right;
      let dy = Math.max(0, minTop - r.top);
      let box = { l: r.left + dx, r: r.right + dx, t: r.top + dy, b: r.bottom + dy };
      for (let k = 0; k < 6; k++) {
        const hit = boxes.find((o) => box.l < o.r + 8 && box.r > o.l - 8 && box.t < o.b + 6 && box.b > o.t - 6);
        if (!hit) break;
        const push = hit.b + 6 - box.t;
        dy += push;
        box = { ...box, t: box.t + push, b: box.b + push };
      }
      boxes.push(box);
      e.style.left = `${parseFloat(e.style.left) + dx}px`;
      e.style.top = `${parseFloat(e.style.top) + dy}px`;
    }
  }

  // ─────────────────────────────────────────── shot layers
  const LAYER = {
    hook(lt, t) {
      caption(L.hook.lines, lt, L.hook.acc, t);
      place(L.hook.place, lt);
    },
    orbit(lt, t) {
      caption(L.orbit.lines, lt, L.orbit.acc, t);
      place(L.orbit.place, lt);
    },
    grow(lt, t) {
      const second = lt >= 1.2;
      caption(second ? L.grow.b : L.grow.a, second ? lt - 1.2 : lt, L.grow.acc, t);
      const r = row('grow', t)?.size?.r;
      if (r == null) return;
      const k = prog(lt, 0.15, 0.2);
      const g = el('div', 'gauge');
      g.style.setProperty('--acc', ACC.green);
      g.style.opacity = String(k);
      const m = r * 2;
      const txt = m < 10 ? m.toFixed(1) : String(Math.round(m));
      g.innerHTML = `<div class="row"><span>${L.grow.gauge}</span><b>${txt} m</b></div><div class="bar"><i style="width:${clamp((Math.log(m) - Math.log(1.5)) / (Math.log(900) - Math.log(1.5)), 0.03, 1) * 100}%"></i></div>`;
    },
    beach(lt, t) {
      caption(L.beach.lines, lt, L.beach.acc, t, { sub: L.beach.sub });
      const n = (EV.beach ?? []).filter((e) => e.k === 'pop' && e.t <= t).length;
      if (!n) return;
      const k = prog(lt, 0.2, 0.2);
      const c = el('div', 'count');
      c.style.setProperty('--acc', ACC.gold);
      c.style.opacity = String(k);
      const last = (EV.beach ?? []).filter((e) => e.k === 'pop' && e.t <= t).pop();
      const kick = last ? Math.exp(-(t - last.t) * 14) : 0;
      // collection progress: every abduction can be a new catalogue entry
      c.innerHTML = `<span class="l">${L.beach.count}</span><span class="n" style="display:inline-block;transform:scale(${1 + kick * 0.12})">${141 + n}</span><span class="l">/ 227</span>`;
    },
    legends(lt, t) {
      caption(L.legends.lines, lt, L.legends.acc, t);
      const m = TR.legends;
      if (!m) return;
      const cur = row('legends', t);
      if (!cur) return;
      // first frame each legend showed up on screen / started to lift
      const info = (LAYER.legends.info ??= (() => {
        const o = {};
        for (const [f, r] of [...m.entries()].sort((a, b) => a[0] - b[0])) {
          for (const [id, v] of Object.entries(r)) {
            if (id === 'f') continue;
            const s = (o[id] ??= { on: null, lift: null, gone: null });
            if (v.on && s.on == null) s.on = f / FPS;
            if (v.lift && s.lift == null) s.lift = f / FPS;
          }
        }
        return o;
      })());
      const made = [];
      for (const [id, name] of Object.entries(L.legendNames)) {
        const v = cur[id];
        const s = info[id];
        if (!v || !v.on || !s || s.lift == null || v.x < 0.03 || v.x > 0.97) continue;
        const kin = outBack(prog(t, s.lift, 0.16));
        const kout = prog(t, s.lift + 0.75, 0.15);
        if (kout >= 1 || kin <= 0) continue;
        const tag = el('div', 'tag', name);
        made.push(tag);
        tag.style.setProperty('--acc', ACC.gold);
        tag.style.left = `${v.x * 1080}px`;
        tag.style.top = `${v.y * 1920 - 14}px`;
        tag.style.opacity = String(clamp(kin * 3, 0, 1) * (1 - kout));
        tag.style.transform = `translate(-50%, -100%) scale(${kin * (1 - kout * 0.4)})`;
      }
      settle(made);
    },
    army(lt, t) {
      caption(L.army.lines, lt, L.army.acc, t);
      place(L.army.place, lt);
      const k = prog(lt, 0.45, 0.15);
      if (k <= 0) return;
      const a = el('div', 'alert', `⚠&nbsp; ${L.army.alert}`);
      const blink = (t % BEAT) / BEAT < 0.55 ? 1 : 0.55;
      a.style.opacity = String(k * blink);
      a.style.transform = `translateX(-50%) scale(${lerp(1.3, 1, outBack(k))})`;
    },
    arena(lt, t) {
      caption(L.arena.lines, lt, L.arena.acc, t, { sub: L.arena.sub });
      for (const e of (EV.arena ?? []).filter((e) => e.k === 'swallow')) {
        const dt = t - e.t;
        if (dt < 0 || dt > 0.7) continue;
        const me = row('arena', e.t) ?? row('arena', t);
        if (!me?.me) continue;
        const k = outBack(prog(dt, 0, 0.2));
        const b = el('div', 'burst', L.arena.burst);
        b.style.left = `${me.me.x * 1080}px`;
        b.style.top = `${me.me.y * 1920 + 250 - dt * 90}px`;
        b.style.opacity = String(1 - prog(dt, 0.5, 0.2));
        b.style.transform = `translate(-50%, -50%) rotate(-8deg) scale(${k})`;
      }
    },
    friends(lt, t) {
      caption(L.friends.lines, lt, L.friends.acc, t);
      const r = row('friends', t);
      const made = [];
      if (r) {
        const tags = FRIENDS.map(([id, nick, code, c, dy]) => [id, `${nick}<small>${code}</small>`, c, dy]);
        tags.forEach(([id, html, c, dy], i) => {
          const v = r[id];
          if (!v || !v.on) return;
          const k = outBack(prog(lt, 0.25 + i * 0.08, 0.2));
          const n = el('div', 'nick', `<i></i>${html}`);
          n.style.setProperty('--acc', c);
          n.style.left = `${v.x * 1080}px`;
          n.style.top = `${v.y * 1920 + dy}px`;
          n.style.opacity = String(clamp(k * 3, 0, 1));
          n.style.transform = `translate(-50%, -100%) scale(${k})`;
          made.push(n);
        });
        settle(made, 640);
      }
      // notification: a friend joins the squad
      const k = prog(lt, 0.7, 0.25);
      if (k > 0) {
        const tt = el('div', 'toast', `<div class="av">B</div><div class="tx"><b>BIA#Q4M9</b> ${L.friends.joined}<small>${L.friends.party}</small></div><div class="bt">${L.friends.btn}</div>`);
        tt.style.opacity = String(clamp(k * 2, 0, 1));
        tt.style.transform = `translateY(${(1 - outBack(k)) * -70}px)`;
      }
    },
    skins(lt, t) {
      caption(L.skins.lines, lt, L.skins.acc, t);
      let cur = 0;
      SKINS.forEach((s, i) => {
        if (lt >= s[1]) cur = i;
      });
      const [id, at, color] = SKINS[cur];
      const [name, tier] = L.skinNames[id];
      const k = outBack(prog(lt, at, 0.14));
      const c = el('div', 'skin');
      c.style.setProperty('--acc', color);
      c.style.transform = `translateX(-50%) scale(${lerp(1.25, 1, k)})`;
      c.innerHTML = `<div class="tier">${tier}</div><div class="nm">${name}</div><div class="dots">${SKINS.map((_, i) => `<i class="${i <= cur ? 'on' : ''}"></i>`).join('')}</div>`;
    },
    end(lt, t) {
      const shade = el('div', null);
      shade.id = 'endShade';
      shade.style.opacity = String(outCubic(prog(lt, 0.6, 0.3)));
      const box = el('div', null);
      box.id = 'end';
      box.style.opacity = '1';
      const at = 0.82; // the slam lands on the launch white-out (22.4 s)
      const wm = el('div', 'wordmark', 'ABDUZIU', box);
      const kw = prog(lt, at, 0.26);
      wm.style.opacity = String(clamp(kw * 3, 0, 1));
      wm.style.transform = `scale(${lerp(1.9, 1, outBack(kw))})`;
      const tg = el('div', 'tagline', L.end.tagline, box);
      const kt = prog(lt, at + 0.25, 0.2);
      tg.style.opacity = String(kt);
      tg.style.transform = `translateY(${(1 - outCubic(kt)) * 20}px)`;
      const cta = el('div', 'cta', L.end.cta, box);
      const kc = prog(lt, at + 0.45, 0.24);
      const ph = (t % BEAT) / BEAT;
      const pulse = kc >= 1 ? 1 + 0.035 * Math.exp(-ph * 6) : 1;
      cta.style.opacity = String(clamp(kc * 3, 0, 1));
      cta.style.transform = `scale(${lerp(0.4, 1, outBack(kc)) * pulse})`;
      const url = el('div', 'url', 'abduziu<b>.fun</b>', box);
      const ku = prog(lt, at + 0.65, 0.2);
      url.style.opacity = String(ku);
      url.style.transform = `translateY(${(1 - outCubic(ku)) * 24}px)`;
      const fine = el('div', 'fine', L.end.fine, box);
      fine.style.opacity = String(prog(lt, at + 0.8, 0.2));
      const cities = el('div', 'cities', null, box);
      CITIES.forEach((c, i) => {
        const s = el('span', null, c, cities);
        const k = prog(lt, at + 0.9 + i * 0.05, 0.16);
        s.style.opacity = String(k);
        s.style.transform = `translateY(${(1 - outCubic(k)) * 16}px)`;
      });
    },
  };

  window.OVERLAY = {
    SHOTS,
    init(opts) {
      lang = opts.lang;
      L = COPY[lang];
      for (const [shot, rows] of Object.entries(opts.tracks ?? {})) TR[shot] = new Map(rows.map((r) => [r.f, r]));
      Object.assign(EV, opts.events ?? {});
      LAYER.legends.info = null;
    },
    paint(t) {
      stage.textContent = '';
      const s = SHOTS.find((x) => t >= x[1] && t < x[2]) ?? SHOTS[SHOTS.length - 1];
      LAYER[s[0]](t - s[1], t);
      // white punch on every cut
      let fl = 0;
      for (const c of CUTS) if (t >= c && t - c < 0.25) fl = Math.max(fl, 0.55 * Math.exp(-(t - c) * 20));
      if (fl > 0.01) {
        const f = el('div', null);
        f.id = 'flash';
        f.style.opacity = String(fl);
      }
    },
  };
})();
