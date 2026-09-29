// HUD em DOM: velocímetro, combo de drift, bússola, minimapa, controles de
// toque, rádio, intro, pausa. Pensado primeiro pro celular em pé.

import { STATIONS, type Radio } from '../audio/radio';
import type { Input } from '../input';
import { BALAO, EXTENT, NODES, ROAD, nodePos, type City } from '../world/city';
import { PRESETS, PRESET_NAMES, type Preset, type PresetChoice, type Settings } from '../settings';

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
  esc: boolean;
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
  onSettings: ((s: Settings) => void) | null = null;
  onCamera: ((mode: string) => void) | null = null;
  paused = false;
  started = false;
  settings: Settings | null = null;
  activePreset: Preset = 'alta';
  camMode = 'chase';

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
      if (this.started) {
        // voltou pro menu no meio do jogo: JOGAR = continuar
        this.setPaused(false);
        return;
      }
      $(this.root, '#brief').classList.remove('hidden');
      this.typeMessage();
      this.onStart?.();
    });
    for (const [btn, screen] of [['#open-settings', '#settings'], ['#open-howto', '#howto'], ['#open-credits', '#credits'], ['#p-settings', '#settings']] as const) {
      $(this.root, btn).addEventListener('click', () => this.openSub(screen));
    }
    this.root.querySelectorAll<HTMLElement>('[data-back]').forEach((b) => b.addEventListener('click', () => this.closeSub()));
    $(this.root, '#p-menu').addEventListener('click', () => {
      $(this.root, '#pause').classList.add('hidden');
      $(this.root, '#enter span').textContent = 'CONTINUAR';
      $(this.root, '#title').classList.remove('hidden');
    });
    this.bindSettings();
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

  setVolumeBar(which: 'music' | 'car', v: number): void {
    this.vol[which] = v;
    $(this.root, `#vol-${which}`).querySelectorAll('i').forEach((el, i) => el.classList.toggle('on', (i + 1) / 12 <= v + 1e-6));
    const slider = this.root.querySelector<HTMLInputElement>(`[data-vol="${which}"]`);
    if (slider) slider.value = String(Math.round(v * 100));
  }

  // ---------------- submenus (configurações, como jogar, créditos) ----------------

  private subStack: string[] = [];

  private openSub(sel: string): void {
    this.subStack.push(sel);
    if (sel === '#settings') this.renderSettings();
    $(this.root, sel).classList.remove('hidden');
  }

  /** fecha o submenu do topo; devolve false se não tinha nenhum aberto */
  closeSub(): boolean {
    const sel = this.subStack.pop();
    if (!sel) return false;
    $(this.root, sel).classList.add('hidden');
    return true;
  }

  private bindSettings(): void {
    const box = $(this.root, '#settings');
    box.addEventListener('click', (e) => {
      const t = (e.target as HTMLElement).closest<HTMLElement>('[data-preset],[data-opt],[data-cam]');
      if (!t || !this.settings) return;
      if (t.dataset.preset) this.settings.preset = t.dataset.preset as PresetChoice;
      else if (t.dataset.opt) {
        const k = t.dataset.opt as keyof Settings;
        (this.settings as unknown as Record<string, boolean>)[k] = !this.settings[k];
      } else if (t.dataset.cam) {
        this.camMode = t.dataset.cam;
        this.onCamera?.(this.camMode);
        this.renderSettings();
        return;
      }
      this.onSettings?.(this.settings);
      this.renderSettings();
    });
    box.querySelectorAll<HTMLInputElement>('[data-vol]').forEach((inp) =>
      inp.addEventListener('input', () => {
        this.setVolumeBar(inp.dataset.vol as 'music' | 'car', Number(inp.value) / 100);
        this.onVolumes?.(this.vol.car, this.vol.music);
      }),
    );
  }

  renderSettings(): void {
    const st = this.settings;
    if (!st) return;
    const box = $(this.root, '#settings');
    box.querySelectorAll<HTMLElement>('[data-preset]').forEach((b) => b.classList.toggle('on', b.dataset.preset === st.preset));
    box.querySelectorAll<HTMLElement>('[data-opt]').forEach((b) => {
      const on = !!st[b.dataset.opt as keyof Settings];
      b.classList.toggle('on', on);
      b.setAttribute('aria-checked', String(on));
    });
    box.querySelectorAll<HTMLElement>('[data-cam]').forEach((b) => b.classList.toggle('on', b.dataset.cam === this.camMode));
    const q = PRESETS[this.activePreset];
    const res = Math.round(Math.min(window.devicePixelRatio || 1, q.pixelRatio) * 100);
    $(this.root, '#q-info').innerHTML =
      (st.preset === 'auto' ? `<b>AUTO → ${PRESET_NAMES[this.activePreset]}</b> · baixa sozinho se o FPS cair<br/>` : '') +
      `resolução ${res}% · reflexo ${q.reflection ? `${Math.round(q.reflection * 100)}%` : 'desligado'} · bloom ${q.bloom ? 'sim' : 'não'}<br/>` +
      `luzes dinâmicas ${q.lamps + q.neon} · chuva ${Math.round(q.rain * 100)}% · partículas ${Math.round(q.particles * 100)}%`;
  }

  showFps(on: boolean): void {
    this.els.fps!.classList.toggle('hidden', !on);
    if (on && !this.last.fps) this.set('fps', `-- FPS · ${PRESET_NAMES[this.activePreset]}`);
  }

  setFps(fps: number, preset: Preset): void {
    this.set('fps', `${Math.round(fps)} FPS · ${PRESET_NAMES[preset]}`);
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
    if (!p) $(this.root, '#title').classList.add('hidden');
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
    arc.style.strokeDashoffset = String(207.3 * (1 - frac));
    const rpm = this.els.rpm as unknown as SVGPathElement;
    rpm.style.strokeDashoffset = String(169.6 * (1 - Math.min(1, s.rpm / 7000)));
    this.els.tcs!.classList.toggle('lit', s.tcs);
    this.els.abs!.classList.toggle('lit', s.abs);
    this.els.esc!.classList.toggle('lit', s.esc);
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
      this.set('dlabel', s.drifting ? `${driftLabel(s.angle)} <em>${Math.round(s.angle)}°</em>` : 'SEGURA O COMBO...', 'html');
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
    <nav class="main-menu">
      <button id="enter" class="mm primary"><span>JOGAR</span><small>a madrugada tá esperando</small></button>
      <button id="open-settings" class="mm"><span>CONFIGURAÇÕES</span><small>gráfico · efeitos · som</small></button>
      <button id="open-howto" class="mm"><span>COMO JOGAR</span><small>controles e pontuação</small></button>
      <button id="open-credits" class="mm"><span>CRÉDITOS</span><small>quem fez e de onde veio</small></button>
    </nav>
    <small class="credits">feito na quebrada · three.js · DF 61</small>
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
<svg viewBox="0 0 120 100">
      <path class="track" d="M 28.9 85.1 A 44 44 0 1 1 91.1 85.1" />
      <path class="arc" data-el="arc" d="M 28.9 85.1 A 44 44 0 1 1 91.1 85.1" />
      <path class="rpm" data-el="rpm" d="M 34.5 79.5 A 36 36 0 1 1 85.5 79.5" />
      <line x1="30.3" y1="83.7" x2="33.8" y2="80.2" class="tk big" /><text x="38.8" y="78.2" class="tl">0</text><line x1="27.6" y1="82.3" x2="29.9" y2="80.3" class="tk" /><line x1="25.8" y1="80.0" x2="28.2" y2="78.2" class="tk" /><line x1="24.1" y1="77.7" x2="26.6" y2="76.0" class="tk" /><line x1="22.6" y1="75.2" x2="25.2" y2="73.7" class="tk" /><line x1="21.3" y1="72.7" x2="24.0" y2="71.4" class="tk" /><line x1="20.1" y1="70.0" x2="22.9" y2="68.9" class="tk" /><line x1="19.1" y1="67.3" x2="22.0" y2="66.4" class="tk" /><line x1="18.3" y1="64.5" x2="21.2" y2="63.8" class="tk" /><line x1="17.7" y1="61.7" x2="20.6" y2="61.1" class="tk" /><line x1="18.3" y1="58.7" x2="23.2" y2="58.1" class="tk big" /><text x="30.2" y="60.4" class="tl">1</text><line x1="17.0" y1="55.9" x2="20.0" y2="55.8" class="tk" /><line x1="17.0" y1="53.0" x2="20.0" y2="53.1" class="tk" /><line x1="17.2" y1="50.1" x2="20.2" y2="50.4" class="tk" /><line x1="17.5" y1="47.3" x2="20.5" y2="47.7" class="tk" /><line x1="18.1" y1="44.4" x2="21.0" y2="45.1" class="tk" /><line x1="18.8" y1="41.6" x2="21.7" y2="42.5" class="tk" /><line x1="19.7" y1="38.9" x2="22.6" y2="39.9" class="tk" /><line x1="20.8" y1="36.2" x2="23.6" y2="37.5" class="tk" /><line x1="22.1" y1="33.6" x2="24.8" y2="35.0" class="tk" /><line x1="24.4" y1="31.7" x2="28.7" y2="34.3" class="tk big" /><text x="34.6" y="41.0" class="tl">2</text><line x1="25.2" y1="28.7" x2="27.6" y2="30.5" class="tk" /><line x1="27.0" y1="26.4" x2="29.3" y2="28.4" class="tk" /><line x1="28.9" y1="24.3" x2="31.1" y2="26.4" class="tk" /><line x1="31.0" y1="22.3" x2="33.0" y2="24.5" class="tk" /><line x1="33.2" y1="20.4" x2="35.1" y2="22.7" class="tk" /><line x1="35.5" y1="18.7" x2="37.2" y2="21.1" class="tk" /><line x1="37.9" y1="17.1" x2="39.5" y2="19.7" class="tk" /><line x1="40.5" y1="15.7" x2="41.8" y2="18.4" class="tk" /><line x1="43.1" y1="14.5" x2="44.3" y2="17.2" class="tk" /><line x1="46.1" y1="14.4" x2="47.8" y2="19.1" class="tk big" /><text x="50.1" y="28.7" class="tl">3</text><line x1="48.6" y1="12.5" x2="49.4" y2="15.4" class="tk" /><line x1="51.4" y1="11.9" x2="52.0" y2="14.8" class="tk" /><line x1="54.2" y1="11.4" x2="54.6" y2="14.4" class="tk" /><line x1="57.1" y1="11.1" x2="57.3" y2="14.1" class="tk" /><line x1="60.0" y1="11.0" x2="60.0" y2="14.0" class="tk" /><line x1="62.9" y1="11.1" x2="62.7" y2="14.1" class="tk" /><line x1="65.8" y1="11.4" x2="65.4" y2="14.4" class="tk" /><line x1="68.6" y1="11.9" x2="68.0" y2="14.8" class="tk" /><line x1="71.4" y1="12.5" x2="70.6" y2="15.4" class="tk" /><line x1="73.9" y1="14.4" x2="72.2" y2="19.1" class="tk big" /><text x="69.9" y="28.7" class="tl">4</text><line x1="76.9" y1="14.5" x2="75.7" y2="17.2" class="tk" /><line x1="79.5" y1="15.7" x2="78.2" y2="18.4" class="tk" /><line x1="82.1" y1="17.1" x2="80.5" y2="19.7" class="tk" /><line x1="84.5" y1="18.7" x2="82.8" y2="21.1" class="tk" /><line x1="86.8" y1="20.4" x2="84.9" y2="22.7" class="tk" /><line x1="89.0" y1="22.3" x2="87.0" y2="24.5" class="tk" /><line x1="91.1" y1="24.3" x2="88.9" y2="26.4" class="tk" /><line x1="93.0" y1="26.4" x2="90.7" y2="28.4" class="tk" /><line x1="94.8" y1="28.7" x2="92.4" y2="30.5" class="tk" /><line x1="95.6" y1="31.7" x2="91.3" y2="34.3" class="tk big" /><text x="85.4" y="41.0" class="tl">5</text><line x1="97.9" y1="33.6" x2="95.2" y2="35.0" class="tk" /><line x1="99.2" y1="36.2" x2="96.4" y2="37.5" class="tk" /><line x1="100.3" y1="38.9" x2="97.4" y2="39.9" class="tk" /><line x1="101.2" y1="41.6" x2="98.3" y2="42.5" class="tk" /><line x1="101.9" y1="44.4" x2="99.0" y2="45.1" class="tk" /><line x1="102.5" y1="47.3" x2="99.5" y2="47.7" class="tk" /><line x1="102.8" y1="50.1" x2="99.8" y2="50.4" class="tk" /><line x1="103.0" y1="53.0" x2="100.0" y2="53.1" class="tk" /><line x1="103.0" y1="55.9" x2="100.0" y2="55.8" class="tk" /><line x1="101.7" y1="58.7" x2="96.8" y2="58.1" class="tk big" data-red /><text x="89.8" y="60.4" class="tl">6</text><line x1="102.3" y1="61.7" x2="99.4" y2="61.1" class="tk" data-red /><line x1="101.7" y1="64.5" x2="98.8" y2="63.8" class="tk" data-red /><line x1="100.9" y1="67.3" x2="98.0" y2="66.4" class="tk" data-red /><line x1="99.9" y1="70.0" x2="97.1" y2="68.9" class="tk" data-red /><line x1="98.7" y1="72.7" x2="96.0" y2="71.4" class="tk" data-red /><line x1="97.4" y1="75.2" x2="94.8" y2="73.7" class="tk" data-red /><line x1="95.9" y1="77.7" x2="93.4" y2="76.0" class="tk" data-red /><line x1="94.2" y1="80.0" x2="91.8" y2="78.2" class="tk" data-red /><line x1="92.4" y1="82.3" x2="90.1" y2="80.3" class="tk" data-red /><line x1="89.7" y1="83.7" x2="86.2" y2="80.2" class="tk big" data-red /><text x="81.2" y="78.2" class="tl">7</text>
      <text x="60" y="36" class="ul">RPM x1000</text>
    </svg>
    <b data-el="speed">0</b><small class="unit">km/h</small><span class="gear" data-el="gear">1</span><small class="auto">AUTO</small>
    <div class="lamps"><i data-el="tcs">TCS</i><i data-el="abs">ABS</i><i data-el="esc">ESC</i></div>
    <div class="nitro" data-el="nitro"><span></span></div>
  </div>
  <div class="top-right">
    <button id="open-radio" class="icon-btn" aria-label="Rádio"><span class="eq"><i></i><i></i><i></i><i></i></span></button>
    <button class="icon-btn" data-act="pause" aria-label="Pausa">☰</button>
  </div>
</div>
<div class="fps hidden" data-el="fps"></div>
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
    <button id="p-settings" class="btn-ghost">CONFIGURAÇÕES</button>
    <button id="p-menu" class="btn-ghost">MENU INICIAL</button>
    <button id="restart" class="btn-ghost">ZERAR PROGRESSO</button>
    <div class="keys">W/↑ acelera · S/↓ freia/ré · A D vira · ESPAÇO freio de mão · SHIFT nitro · C câmera · R reset · Q/E rádio</div>
  </div>
</div>

<div id="settings" class="screen sub hidden" role="dialog" aria-label="Configurações">
  <div class="sheet">
    <div class="sheet-top"><h2>CONFIGURAÇÕES</h2><button data-back class="x" aria-label="Voltar">VOLTAR</button></div>
    <section>
      <h4>QUALIDADE GRÁFICA</h4>
      <div class="seg" role="radiogroup">
        <button data-preset="auto">AUTO</button><button data-preset="baixa">BAIXA</button><button data-preset="media">MÉDIA</button><button data-preset="alta">ALTA</button><button data-preset="ultra">ULTRA</button>
      </div>
      <p id="q-info" class="q-info"></p>
    </section>
    <section>
      <h4>EFEITOS</h4>
      <button class="tg" role="switch" data-opt="doodles"><span>Rabiscos no drift e no nitro</span><i></i></button>
      <button class="tg" role="switch" data-opt="trails"><span>Rastro das lanternas e faróis</span><i></i></button>
      <button class="tg" role="switch" data-opt="rain"><span>Chuva</span><i></i></button>
      <button class="tg" role="switch" data-opt="shake"><span>Tremida de câmera</span><i></i></button>
      <button class="tg" role="switch" data-opt="lens"><span>Efeito de lente (aberração e granulado)</span><i></i></button>
      <button class="tg" role="switch" data-opt="fps"><span>Mostrar FPS</span><i></i></button>
    </section>
    <section>
      <h4>CÂMERA</h4>
      <div class="seg"><button data-cam="chase">PERTO</button><button data-cam="far">LONGE</button><button data-cam="hood">CAPÔ</button></div>
    </section>
    <section>
      <h4>SOM</h4>
      <label class="sl"><span>Música</span><input type="range" min="0" max="100" data-vol="music" /></label>
      <label class="sl"><span>Carro</span><input type="range" min="0" max="100" data-vol="car" /></label>
    </section>
  </div>
</div>

<div id="howto" class="screen sub hidden" role="dialog" aria-label="Como jogar">
  <div class="sheet">
    <div class="sheet-top"><h2>COMO JOGAR</h2><button data-back class="x" aria-label="Voltar">VOLTAR</button></div>
    <section>
      <h4>O ROLÊ</h4>
      <p>Derrapa de lado pra encher o combo. Quanto mais ângulo e velocidade, mais ponto por segundo. Emenda um drift no outro antes da barra vermelha zerar pra subir o multiplicador (até x10). Bater no muro ou num carro perde o combo; passar raspando dá bônus.</p>
      <p>Cata as 30 fitas K7 espalhadas pela quebrada e ganha os 5 rachas (os pontos azuis no minimapa).</p>
    </section>
    <section>
      <h4>TECLADO</h4>
      <ul class="kb">
        <li><kbd>W</kbd><kbd>↑</kbd> acelera</li><li><kbd>S</kbd><kbd>↓</kbd> freia / ré</li>
        <li><kbd>A</kbd><kbd>D</kbd> vira</li><li><kbd>ESPAÇO</kbd> freio de mão</li>
        <li><kbd>SHIFT</kbd> nitro</li><li><kbd>C</kbd> câmera</li>
        <li><kbd>R</kbd> volta pra pista</li><li><kbd>Q</kbd><kbd>E</kbd> troca a rádio</li>
        <li><kbd>TAB</kbd> player</li><li><kbd>ESC</kbd> pausa</li>
      </ul>
    </section>
    <section>
      <h4>TOQUE</h4>
      <p>◀ ▶ vira · GÁS e FREIO (segura o freio parado pra dar ré) · DRIFT é o freio de mão · NITRO · CAM, RESET e RÁDIO em cima</p>
    </section>
    <section>
      <h4>CONTROLE</h4>
      <p>RT/LT acelera e freia · analógico vira · A freio de mão · B nitro · Y câmera · LB/RB rádio · START pausa</p>
    </section>
    <section>
      <h4>DICA DO ZÉ</h4>
      <p>Pra rodar: puxa o freio de mão com o volante virado e segura o gás. Pra endireitar, solta o gás e contra-esterça. Nitro no meio do drift abre o ângulo.</p>
    </section>
  </div>
</div>

<div id="credits" class="screen sub hidden" role="dialog" aria-label="Créditos">
  <div class="sheet">
    <div class="sheet-top"><h2>CRÉDITOS</h2><button data-back class="x" aria-label="Voltar">VOLTAR</button></div>
    <section>
      <h4>BSBASS DRIFT GAME</h4>
      <p>Jogo de drift na periferia do Distrito Federal. Cidade, carro, trilhas da rádio e efeitos gerados em código com three.js.</p>
    </section>
    <section>
      <h4>TEXTURAS E HDRI</h4>
      <p>ambientCG (CC0): asfalto, tijolo, reboco, concreto, ferragem, ferro, chapa, telha, calçada, terra, casca e folhas. Poly Haven (CC0): HDRI de rua à noite.</p>
    </section>
    <section>
      <h4>MODELOS 3D</h4>
      <p>Poly Haven (CC0): tambores, pneu, carro com capa, ar-condicionado, hidrante, lixeira, caixa de energia, barreira, saco de cimento, caixa, rádio.</p>
    </section>
    <section>
      <h4>SONS</h4>
      <p>Freesound: FreeCarSoundsGaming, audible-edge, magnuswaker, LPA134, qubodup, innov8_Music, Pól, craigsmith, mihnelis, FiretailHorizons.</p>
    </section>
    <section>
      <h4>FONTES</h4>
      <p>Anton, Permanent Marker e Chakra Petch (Google Fonts, OFL).</p>
    </section>
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
