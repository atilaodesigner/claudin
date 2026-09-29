// HUD em DOM: velocímetro, combo de drift, bússola, minimapa, controles de
// toque, rádio, intro, pausa. Pensado primeiro pro celular em pé.

import { STATIONS, type Radio } from '../audio/radio';
import type { Input } from '../input';
import { BALAO, EXTENT, NODES, ROAD, nodePos, type City } from '../world/city';

const $ = <T extends HTMLElement = HTMLElement>(root: ParentNode, sel: string) => root.querySelector(sel) as T;

export function fmt(n: number): string {
  return Math.round(n).toLocaleString('pt-BR');
}

function fmtTime(t: number): string {
  const m = Math.floor(t / 60);
  const s = t - m * 60;
  return `${String(m).padStart(2, '0')}:${s.toFixed(1).padStart(4, '0')}`;
}

export function driftLabel(angle: number): string {
  if (angle >= 60) return 'DRIFT LENDÁRIO';
  if (angle >= 45) return 'DRIFT INSANO';
  if (angle >= 35) return 'DRIFT BRABO';
  if (angle >= 24) return 'BOM DRIFT';
  return 'DRIFT';
}

export interface HudState {
  speedKmh: number;
  gear: string;
  rpm: number;
  nitro: number;
  nitroOn: boolean;
  tcs: boolean;
  abs: boolean;
  total: number;
  best: number;
  chain: number;
  mult: number;
  angle: number;
  drifting: boolean;
  grace: number; // 0..1
  heading: number; // da câmera (rad)
  x: number;
  z: number;
  carHeading: number;
  target: { x: number; z: number; label: string } | null;
  fitasGot: number;
  fitasTotal: number;
}

export class Hud {
  readonly root: HTMLElement;
  private els: Record<string, HTMLElement> = {};
  private map: HTMLCanvasElement;
  private mapCtx: CanvasRenderingContext2D;
  private mapBase: HTMLCanvasElement;
  private last: Record<string, string> = {};
  private popupTimer = 0;
  private bannerTimer = 0;
  private cardMode: 'idle' | 'live' | 'bank' | 'lost' = 'idle';
  private cardTimer = 0;
  onStart: (() => void) | null = null;
  onRestart: (() => void) | null = null;
  onPauseChange: ((p: boolean) => void) | null = null;
  onVolumes: ((car: number, music: number) => void) | null = null;
  onMute: ((m: boolean) => void) | null = null;
  paused = false;
  started = false;

  constructor(parent: HTMLElement, private input: Input, private radio: Radio, city: City) {
    const root = document.createElement('div');
    root.id = 'hud';
    root.innerHTML = TEMPLATE;
    parent.appendChild(root);
    this.root = root;
    for (const el of root.querySelectorAll<HTMLElement>('[data-el]')) this.els[el.dataset.el!] = el;
    this.map = $(root, '#minimap canvas');
    this.mapCtx = this.map.getContext('2d')!;
    this.mapBase = renderMapBase(city);
    this.bindTouch();
    this.bindMenus();
    this.renderRadio();
    radio.onChange = () => this.renderRadio();
  }

  private set(key: string, value: string, prop: 'text' | 'html' = 'text'): void {
    if (this.last[key] === value) return;
    this.last[key] = value;
    const el = this.els[key];
    if (!el) return;
    if (prop === 'text') el.textContent = value;
    else el.innerHTML = value;
  }

  private bindTouch(): void {
    const bind = (name: keyof Input['touch']) => {
      const el = $(this.root, `[data-touch="${name}"]`);
      const on = (e: Event) => {
        e.preventDefault();
        this.input.touch[name] = true;
        this.input.usingTouch = true;
        el.classList.add('on');
      };
      const off = (e: Event) => {
        e.preventDefault();
        this.input.touch[name] = false;
        el.classList.remove('on');
      };
      el.addEventListener('pointerdown', on);
      el.addEventListener('pointerup', off);
      el.addEventListener('pointercancel', off);
      el.addEventListener('pointerleave', off);
    };
    (['left', 'right', 'gas', 'brake', 'drift', 'nitro'] as const).forEach(bind);
    this.root.querySelectorAll<HTMLElement>('[data-act]').forEach((el) => {
      el.addEventListener('click', (e) => {
        e.preventDefault();
        this.input.emit(el.dataset.act as never);
      });
    });
    if (matchMedia('(pointer: coarse)').matches) document.body.classList.add('touch');
    window.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'touch') document.body.classList.add('touch');
    });
  }

  private bindMenus(): void {
    $(this.root, '#enter').addEventListener('click', () => {
      $(this.root, '#title').classList.add('hidden');
      $(this.root, '#brief').classList.remove('hidden');
      this.typeMessage();
      this.onStart?.();
    });
    const go = () => {
      $(this.root, '#brief').classList.add('hidden');
      this.root.classList.add('playing');
      this.started = true;
    };
    $(this.root, '#ride').addEventListener('click', go);
    $(this.root, '#skip').addEventListener('click', go);
    $(this.root, '#resume').addEventListener('click', () => this.setPaused(false));
    $(this.root, '#restart').addEventListener('click', () => {
      this.setPaused(false);
      this.onRestart?.();
    });
    $(this.root, '#open-radio').addEventListener('click', () => this.toggleRadio(true));
    $(this.root, '#radio-close').addEventListener('click', () => this.toggleRadio(false));
    $(this.root, '#r-prev').addEventListener('click', () => this.radio.skip(-1));
    $(this.root, '#r-next').addEventListener('click', () => this.radio.skip(1));
    $(this.root, '#r-play').addEventListener('click', () => {
      if (!this.radio.on) this.radio.toggle();
    });
    $(this.root, '#r-stop').addEventListener('click', () => {
      if (this.radio.on) this.radio.toggle();
    });
    $(this.root, '#r-sound').addEventListener('click', () => {
      const m = !$(this.root, '#r-sound').classList.contains('off');
      $(this.root, '#r-sound').classList.toggle('off', m);
      $(this.root, '#r-sound').innerHTML = m ? '🔇 SOM DESLIGADO' : '🔊 SOM LIGADO';
      this.onMute?.(m);
    });
    for (const which of ['music', 'car'] as const) {
      const bar = $(this.root, `#vol-${which}`);
      bar.innerHTML = Array.from({ length: 12 }, (_, i) => `<i data-v="${(i + 1) / 12}"></i>`).join('');
      bar.addEventListener('click', (e) => {
        const v = Number((e.target as HTMLElement).dataset.v);
        if (!v) return;
        this.setVolumeBar(which, v);
        this.onVolumes?.(this.vol.car, this.vol.music);
      });
    }
    this.setVolumeBar('music', 0.7);
    this.setVolumeBar('car', 0.8);
  }

  vol = { car: 0.8, music: 0.7 };

  private setVolumeBar(which: 'music' | 'car', v: number): void {
    this.vol[which] = v;
    $(this.root, `#vol-${which}`).querySelectorAll('i').forEach((el, i) => el.classList.toggle('on', (i + 1) / 12 <= v + 1e-6));
  }

  toggleRadio(open?: boolean): void {
    const p = $(this.root, '#radio-panel');
    const show = open ?? p.classList.contains('hidden');
    p.classList.toggle('hidden', !show);
    this.renderRadio();
  }

  renderRadio(): void {
    const r = this.radio;
    const st = r.current;
    const tr = r.currentTrack;
    $(this.root, '#r-title').textContent = r.on ? tr.title : 'RÁDIO DESLIGADO';
    $(this.root, '#r-artist').textContent = r.on ? `${tr.artist} · ${st.name} ${st.freq}` : '—';
    $(this.root, '#r-stations').innerHTML = STATIONS.map(
      (s, i) => `<button class="st ${i === r.station && r.on ? 'on' : ''}" data-st="${i}"><b>${s.freq}</b> ${s.name}<small>${s.genre}</small></button>`,
    ).join('');
    $(this.root, '#r-stations').querySelectorAll<HTMLElement>('[data-st]').forEach((b) =>
      b.addEventListener('click', () => r.setStation(Number(b.dataset.st))),
    );
    $(this.root, '#r-tracks').innerHTML = st.tracks
      .map((t, i) => `<li class="${i === r.track % st.tracks.length && r.on ? 'on' : ''}"><span>${t.title}<small>${t.artist}</small></span><em>${fmtTime(t.length).slice(0, 5)}</em></li>`)
      .join('');
    this.set('np', r.on ? `<b>${st.name}</b> ${tr.title} — ${tr.artist.toLowerCase()}` : '<b>RÁDIO</b> desligado', 'html');
  }

  setPaused(p: boolean): void {
    if (!this.started) return;
    this.paused = p;
    $(this.root, '#pause').classList.toggle('hidden', !p);
    this.onPauseChange?.(p);
  }

  setObjectives(o: { fitas: string; rachas: string; best: string; total: string }): void {
    $(this.root, '#obj-fitas').textContent = o.fitas;
    $(this.root, '#obj-rachas').textContent = o.rachas;
    $(this.root, '#obj-best').textContent = o.best;
    $(this.root, '#obj-total').textContent = o.total;
  }

  private typeMessage(): void {
    const el = $(this.root, '#msg');
    const text = 'Chegou, véi? O trono do grave tá vazio desde que o último Mustang sumiu na poeira. A quebrada tá de olho. Vai lá e toma o que é teu.';
    let i = 0;
    el.textContent = '';
    const id = window.setInterval(() => {
      i += 2;
      el.textContent = text.slice(0, i);
      if (i >= text.length) {
        window.clearInterval(id);
        $(this.root, '#brief').classList.add('typed');
      }
    }, 28);
  }

  popup(text: string, cls = ''): void {
    const el = this.els.popup!;
    el.className = `popup show ${cls}`;
    el.textContent = text;
    this.popupTimer = 1.6;
  }

  banner(title: string, sub = '', time = 2.2, cls = ''): void {
    const el = this.els.banner!;
    el.className = `banner show ${cls}`;
    el.innerHTML = `<b>${title}</b>${sub ? `<small>${sub}</small>` : ''}`;
    this.bannerTimer = time;
  }

  bank(points: number, label: string): void {
    this.cardMode = 'bank';
    this.cardTimer = 1.8;
    this.set('dscore', fmt(points));
    this.set('dlabel', `NO BOLSO · ${label}`);
    this.els.drift!.className = 'drift show bank';
  }

  lost(points: number): void {
    this.cardMode = 'lost';
    this.cardTimer = 1.6;
    this.set('dscore', fmt(points));
    this.set('dlabel', 'BATEU · PERDEU O COMBO');
    this.els.drift!.className = 'drift show lost';
  }

  race(text: string | null): void {
    this.els.race!.classList.toggle('show', !!text);
    if (text) this.set('race', text, 'html');
  }

  update(dt: number, s: HudState, traffic: { x: number; z: number }[], markers: { x: number; z: number; c: string }[]): void {
    // ---------- velocímetro ----------
    this.set('speed', String(Math.round(s.speedKmh)));
    this.set('gear', s.gear);
    const arc = this.els.arc as unknown as SVGPathElement;
    const frac = Math.min(1, s.speedKmh / 280);
    arc.style.strokeDashoffset = String(220 * (1 - frac));
    const rpm = this.els.rpm as unknown as SVGPathElement;
    rpm.style.strokeDashoffset = String(150 * (1 - Math.min(1, s.rpm / 7500)));
    this.els.tcs!.classList.toggle('lit', s.tcs);
    this.els.abs!.classList.toggle('lit', s.abs);
    this.els.nitro!.style.setProperty('--n', String(s.nitro));
    this.els.nitro!.classList.toggle('on', s.nitroOn);
    this.set('mult', `x${s.mult}`);
    this.set('total', fmt(s.total));
    this.set('fitas', `${s.fitasGot}/${s.fitasTotal}`);

    // ---------- card de drift ----------
    this.cardTimer -= dt;
    if (s.chain > 0) {
      this.cardMode = 'live';
      this.set('dscore', fmt(s.chain));
      this.set('dmult', `x${s.mult}`);
      this.set('dlabel', s.drifting ? `${driftLabel(s.angle)} ${Math.round(s.angle)}°` : 'SEGURA O COMBO...');
      this.els.drift!.className = `drift show ${s.drifting ? 'live' : 'grace'}`;
      this.els.drift!.style.setProperty('--g', String(s.grace));
    } else if (this.cardMode !== 'idle' && this.cardTimer <= 0) {
      this.cardMode = 'idle';
      this.els.drift!.className = 'drift';
    } else if (this.cardMode === 'live') {
      this.cardMode = 'idle';
      this.els.drift!.className = 'drift';
    }

    // ---------- bússola ----------
    if (s.target) {
      const dx = s.target.x - s.x, dz = s.target.z - s.z;
      const dist = Math.hypot(dx, dz);
      const ang = Math.atan2(dx, dz) - s.heading; // relativo à câmera
      this.els.compass!.classList.add('show');
      (this.els.carrow as HTMLElement).style.transform = `rotate(${-ang}rad)`;
      this.set('ctext', `${s.target.label} · ${Math.round(dist)} M`);
    } else {
      this.els.compass!.classList.remove('show');
    }

    // ---------- popups ----------
    this.popupTimer -= dt;
    if (this.popupTimer <= 0) this.els.popup!.classList.remove('show');
    this.bannerTimer -= dt;
    if (this.bannerTimer <= 0) this.els.banner!.classList.remove('show');

    this.drawMap(s, traffic, markers);
  }

  private drawMap(s: HudState, traffic: { x: number; z: number }[], markers: { x: number; z: number; c: string }[]): void {
    const c = this.mapCtx;
    const W = this.map.width;
    const scale = (W / 2) / 170; // 170 m de raio
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.clearRect(0, 0, W, W);
    c.save();
    c.beginPath();
    c.arc(W / 2, W / 2, W / 2 - 2, 0, Math.PI * 2);
    c.clip();
    c.fillStyle = 'rgba(8,10,14,0.72)';
    c.fillRect(0, 0, W, W);
    // mundo -> mapa: gira pra cima ser a direção da câmera
    // tela: +X direita, +Y baixo. frente da câmera (sin h, cos h) deve ir pra cima.
    const h = s.heading;
    c.translate(W / 2, W / 2);
    c.rotate(h + Math.PI);
    c.scale(scale, scale);
    c.translate(-s.x, -s.z);
    const off = EXTENT + ROAD / 2 + 40;
    c.drawImage(this.mapBase, -off, -off, off * 2, off * 2);
    for (const m of markers) {
      c.fillStyle = m.c;
      c.beginPath();
      c.arc(m.x, m.z, 6 / scale, 0, Math.PI * 2);
      c.fill();
    }
    c.fillStyle = 'rgba(255,255,255,0.7)';
    for (const t of traffic) c.fillRect(t.x - 1.5, t.z - 1.5, 3, 3);
    c.restore();
    // jogador no centro
    c.setTransform(1, 0, 0, 1, W / 2, W / 2);
    c.rotate(-(s.carHeading - s.heading));
    c.fillStyle = '#4da3ff';
    c.strokeStyle = '#fff';
    c.lineWidth = 1.5;
    c.beginPath();
    c.moveTo(0, -8);
    c.lineTo(6, 7);
    c.lineTo(0, 3);
    c.lineTo(-6, 7);
    c.closePath();
    c.fill();
    c.stroke();
    // "N"
    c.setTransform(1, 0, 0, 1, W / 2, W / 2);
    const r = W / 2 - 12;
    const north = Math.PI + h; // norte = -Z
    c.fillStyle = '#ffd21a';
    c.font = 'bold 13px Anton, sans-serif';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText('N', Math.sin(north) * r, -Math.cos(north) * r);
  }
}

function renderMapBase(city: City): HTMLCanvasElement {
  const off = EXTENT + ROAD / 2 + 40;
  const S = 1024;
  const k = S / (off * 2);
  const cv = document.createElement('canvas');
  cv.width = cv.height = S;
  const c = cv.getContext('2d')!;
  c.scale(k, k);
  c.translate(off, off);
  c.fillStyle = '#3a1c10';
  c.fillRect(-off, -off, off * 2, off * 2);
  // quadras
  for (const b of city.blocks) {
    c.fillStyle = b.kind === 'terrao' ? '#7a3418' : b.kind === 'praca' ? '#27463a' : b.kind === 'feira' ? '#4a4038' : b.kind === 'posto' ? '#554a40' : '#1c1f26';
    c.fillRect(b.x - 40, b.z - 40, 80, 80);
  }
  // ruas
  c.strokeStyle = '#5b606b';
  c.lineWidth = ROAD * 0.8;
  c.lineCap = 'butt';
  for (let n = 0; n < NODES; n++) {
    const p = nodePos(n);
    c.beginPath();
    c.moveTo(p, -EXTENT - ROAD / 2);
    c.lineTo(p, EXTENT + ROAD / 2);
    c.moveTo(-EXTENT - ROAD / 2, p);
    c.lineTo(EXTENT + ROAD / 2, p);
    c.stroke();
  }
  c.strokeStyle = '#8d93a0';
  c.lineWidth = 3;
  c.beginPath();
  c.moveTo(-EXTENT, 0);
  c.lineTo(EXTENT, 0);
  c.stroke();
  // balão
  c.fillStyle = '#5b606b';
  c.beginPath();
  c.arc(BALAO.x, BALAO.z, BALAO.ring, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = '#27463a';
  c.beginPath();
  c.arc(BALAO.x, BALAO.z, BALAO.island, 0, Math.PI * 2);
  c.fill();
  return cv;
}

const TEMPLATE = /* html */ `
<div id="title" class="screen">
  <div class="title-bg"></div>
  <div class="title-inner">
    <small class="kicker">CEILÂNDIA · SAMAMBAIA · SOL NASCENTE · DF 61</small>
    <h1><span>BSBASS</span><em>DRIFT GAME</em></h1>
    <p>Poeira vermelha, grave no talo e um Mustang azul na madrugada.</p>
    <button id="enter" class="btn-ghost">ENTRAR</button>
    <small class="credits">feito na quebrada · three.js</small>
  </div>
</div>

<div id="brief" class="screen hidden">
  <button id="skip" class="skip">PULAR</button>
  <div class="card">
    <div class="who">
      <div class="avatar"><span>ZÉ</span></div>
      <div><h2>ZÉ DO GRAVE</h2><small>DONO DO PAREDÃO</small></div>
    </div>
    <div class="msgbox">
      <small class="dot">NOVA MENSAGEM</small>
      <p id="msg"></p>
      <ul class="objectives">
        <li><i>▮</i>FITAS K7 <span id="obj-fitas">0/30</span></li>
        <li><i>⚑</i>RACHAS <span id="obj-rachas">0/5</span></li>
        <li><i>◆</i>MAIOR DRIFT <span id="obj-best">0</span></li>
        <li><i>★</i>PONTOS <span id="obj-total">0</span></li>
        <li><i>♛</i>A MADRUGADA <span>TÁ EM ABERTO</span></li>
      </ul>
      <button id="ride" class="btn-yellow">BORA!</button>
      <div class="keys">
        <b>TECLADO</b> W/↑ acelera · S/↓ freia/ré · A D/← → vira · ESPAÇO freio de mão · SHIFT nitro · C câmera · R reset · Q/E rádio · TAB player · ESC pausa<br/>
        <b>CONTROLE</b> RT/LT acelera/freia · analógico · A freio de mão · B nitro · Y câmera · LB/RB rádio
      </div>
    </div>
  </div>
</div>

<div class="hud-top">
  <div class="chip-mult" data-el="mult">x1</div>
  <div class="scorebox"><small>PONTOS</small><b data-el="total">0</b><small class="fitas">K7 <span data-el="fitas">0/30</span></small></div>
  <div class="speedo">
    <svg viewBox="0 0 120 80">
      <path class="track" d="M 18 70 A 48 48 0 1 1 102 70" />
      <path class="arc" data-el="arc" d="M 18 70 A 48 48 0 1 1 102 70" />
      <path class="rpm" data-el="rpm" d="M 30 64 A 36 36 0 1 1 90 64" />
    </svg>
    <b data-el="speed">0</b><span class="gear" data-el="gear">1</span>
    <div class="lamps"><i data-el="tcs">TCS</i><i data-el="abs">ABS</i></div>
    <div class="nitro" data-el="nitro"><span></span></div>
  </div>
  <div class="top-right">
    <button id="open-radio" class="icon-btn" aria-label="Rádio"><span class="eq"><i></i><i></i><i></i><i></i></span></button>
    <button class="icon-btn" data-act="pause" aria-label="Pausa">☰</button>
  </div>
</div>
<div class="compass" data-el="compass"><span class="arrow" data-el="carrow">▲</span><span data-el="ctext"></span></div>
<div class="drift" data-el="drift"><div class="row"><b data-el="dscore">0</b><span class="m" data-el="dmult">x1</span></div><small data-el="dlabel">DRIFT</small><div class="grace"></div></div>
<div class="race" data-el="race"></div>
<div class="popup" data-el="popup"></div>
<div class="banner" data-el="banner"></div>

<div id="minimap"><canvas width="220" height="220"></canvas></div>
<div class="nowplaying" data-el="np"></div>

<div class="controls">
  <div class="row small">
    <button data-act="cam">CAM</button><button data-act="reset">RESET</button><button data-act="radioNext">RÁDIO</button>
    <span class="grow"></span>
    <button class="big drift-b" data-touch="drift">DRIFT</button><button class="big nitro-b" data-touch="nitro">NITRO</button>
  </div>
  <div class="row">
    <button class="round" data-touch="left">◀</button><button class="round" data-touch="right">▶</button>
    <span class="grow"></span>
    <button class="big brake-b" data-touch="brake">FREIO</button><button class="big gas-b" data-touch="gas">GÁS</button>
  </div>
</div>

<div id="pause" class="screen hidden">
  <div class="menu">
    <h2>PAUSA</h2>
    <button id="resume" class="btn-yellow">CONTINUAR</button>
    <button data-act="cam" class="btn-ghost">TROCAR CÂMERA</button>
    <button data-act="radioPanel" class="btn-ghost">RÁDIO</button>
    <button id="restart" class="btn-ghost">ZERAR PROGRESSO</button>
    <div class="keys">W/↑ acelera · S/↓ freia/ré · A D vira · ESPAÇO freio de mão · SHIFT nitro · C câmera · R reset · Q/E rádio</div>
  </div>
</div>

<div id="radio-panel" class="hidden">
  <div class="rp-top"><span class="tag">PLAYER DO GRAVE</span><button id="radio-close">FECHAR</button></div>
  <h3 id="r-title"></h3>
  <small id="r-artist"></small>
  <div class="wave"><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div>
  <div class="rp-btns"><button id="r-prev">⏮</button><button id="r-play">▶</button><button id="r-stop">■</button><button id="r-next">⏭</button></div>
  <div class="vol"><small>MÚSICA</small><div id="vol-music" class="bars"></div></div>
  <div class="vol"><small>CARRO</small><div id="vol-car" class="bars"></div></div>
  <button id="r-sound" class="sound">🔊 SOM LIGADO</button>
  <div id="r-stations"></div>
  <ul id="r-tracks"></ul>
</div>
`;
