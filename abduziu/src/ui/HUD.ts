import { Vector3, type PerspectiveCamera } from 'three';
import { ALERT_NAMES } from '../config/enemies';
import { TIER_NAMES } from '../config/objects';
import { formatInt, formatTime } from '../utils/math';
import { bar, h, onTap, setFill, setText, toggleClass } from './dom';
import { ObjectiveTracker } from './ObjectiveTracker';

export type Tone = 'info' | 'good' | 'warn' | 'danger' | 'alien' | 'gold';

export interface RadarBlip {
  x: number;
  z: number;
  kind: 'enemy' | 'missile' | 'event' | 'rare' | 'boss' | 'meme';
}

const ALERT_COLORS = ['#5dffa0', '#9dffb0', '#ffe066', '#ffb020', '#ff7a2a', '#ff3b4e', '#ff1a3a'];
const _v = new Vector3();

/**
 * Clean, holographic HUD: level (top-left), alert (top-right), combo (top-center),
 * hull/shield (bottom-left), abilities near the thumb (bottom-right).
 */
export class HUD {
  readonly root: HTMLDivElement;
  private readonly lvl: HTMLDivElement;
  private readonly xp: HTMLDivElement;
  private readonly mass: HTMLDivElement;
  private readonly classBar: HTMLDivElement;
  private readonly objectives: ObjectiveTracker;
  private readonly score: HTMLDivElement;
  private readonly combo: HTMLDivElement;
  private readonly comboCount: HTMLDivElement;
  private readonly comboLabel: HTMLDivElement;
  private readonly comboTimer: HTMLDivElement;
  private readonly alert: HTMLDivElement;
  private readonly alertPips: HTMLElement[] = [];
  private readonly alertName: HTMLDivElement;
  private readonly threat: HTMLDivElement;
  private readonly radar: HTMLCanvasElement;
  private readonly radarCtx: CanvasRenderingContext2D;
  private readonly timer: HTMLDivElement;
  private readonly hull: HTMLDivElement;
  private readonly hullVal: HTMLSpanElement;
  private readonly shield: HTMLDivElement;
  private readonly coords: HTMLDivElement;
  readonly empBtn: HTMLButtonElement;
  readonly dashBtn: HTMLButtonElement;
  readonly extractBtn: HTMLButtonElement;
  private readonly extractHint: HTMLDivElement;
  private readonly extractWrap: HTMLDivElement;
  private readonly toasts: HTMLDivElement;
  private readonly banner: HTMLDivElement;
  private readonly strain: HTMLDivElement;
  private readonly strainBar: HTMLDivElement;
  private readonly strainSub: HTMLDivElement;
  private readonly lockWarn: HTMLDivElement;
  private readonly missileInds: HTMLDivElement[] = [];
  private readonly bossBar: HTMLDivElement;
  private readonly bossShield: HTMLDivElement;
  private readonly bossHp: HTMLDivElement;
  private readonly tutorial: HTMLDivElement;
  private readonly tutorialText: HTMLDivElement;
  private readonly tutorialHand: HTMLDivElement;
  private readonly district: HTMLDivElement;
  private readonly districtName: HTMLDivElement;
  private readonly districtHeat: HTMLDivElement;
  private readonly floats: Array<{ el: HTMLDivElement; pos: Vector3; life: number; max: number; active: boolean }> = [];
  private comboPunch = 1;
  private lastCombo = 0;
  private radarTimer = 0;
  private districtTimer = 0;
  onPause: (() => void) | null = null;
  onEMP: (() => void) | null = null;
  onDash: (() => void) | null = null;
  onExtract: (() => void) | null = null;

  constructor(parent: HTMLElement) {
    this.root = h('div', 'hud');
    parent.appendChild(this.root);

    // top-left
    const tl = h('div', 'tl');
    const row = h('div', 'lvl-row');
    this.lvl = h('div', 'lvl');
    row.appendChild(this.lvl);
    tl.appendChild(row);
    this.xp = bar('xp');
    tl.appendChild(this.xp);
    this.classBar = bar('classbar');
    tl.appendChild(this.classBar);
    this.mass = h('div', 'mass');
    tl.appendChild(this.mass);
    this.objectives = new ObjectiveTracker(tl);
    this.root.appendChild(tl);

    // top-center
    const tc = h('div', 'tc');
    this.score = h('div', 'score', '0');
    this.combo = h('div', 'combo');
    this.comboCount = h('div', 'combo-count', 'x0');
    this.comboLabel = h('div', 'combo-label', 'ABDUCTION COMBO');
    this.comboTimer = bar('combo-timer');
    this.combo.append(this.comboCount, this.comboLabel, this.comboTimer);
    this.bossBar = h('div', 'boss-bar');
    this.bossBar.appendChild(h('div', 'name', 'PROJETO TUCANO NEGRO'));
    this.bossShield = bar('sh');
    this.bossHp = bar('hp');
    this.bossBar.append(this.bossShield, this.bossHp);
    tc.append(this.score, this.combo, this.bossBar);
    this.root.appendChild(tc);

    // top-right
    const tr = h('div', 'tr');
    const trRow = h('div', 'tr-row');
    this.alert = h('div', 'alert');
    this.alert.appendChild(h('div', 'label', 'ALERTA'));
    const pips = h('div', 'alert-pips');
    for (let i = 0; i < 6; i++) {
      const p = h('i');
      this.alertPips.push(p);
      pips.appendChild(p);
    }
    this.alert.appendChild(pips);
    this.threat = bar('threat');
    this.alert.appendChild(this.threat);
    this.alertName = h('div', 'alert-name');
    this.alert.appendChild(this.alertName);
    const pause = h('button', 'pause-btn', 'II');
    pause.setAttribute('aria-label', 'Pausar');
    onTap(pause, () => this.onPause?.());
    trRow.append(this.alert, pause);
    tr.appendChild(trRow);
    this.radar = h('canvas', 'radar');
    this.radar.width = 128;
    this.radar.height = 128;
    this.radarCtx = this.radar.getContext('2d') as CanvasRenderingContext2D;
    this.timer = h('div', 'timer', '00:00');
    tr.append(this.radar, this.timer);
    this.root.appendChild(tr);

    // bottom-left
    const bl = h('div', 'bl');
    const l1 = h('div', 'lbl');
    l1.appendChild(h('span', '', 'CASCO'));
    this.hullVal = h('span', '', '100');
    l1.appendChild(this.hullVal);
    this.hull = bar('hull');
    const l2 = h('div', 'lbl');
    l2.appendChild(h('span', '', 'ESCUDO'));
    this.shield = bar('shield');
    this.coords = h('div', 'coords');
    bl.append(l1, this.hull, l2, this.shield, this.coords);
    this.root.appendChild(bl);

    // bottom-right abilities (thumb zone)
    const br = h('div', 'br');
    this.dashBtn = h('button', 'ability dash', 'DASH');
    this.dashBtn.appendChild(h('div', 'cd'));
    this.dashBtn.appendChild(h('div', 'key', 'SHIFT'));
    this.empBtn = h('button', 'ability', 'EMP');
    this.empBtn.appendChild(h('div', 'cd'));
    this.empBtn.appendChild(h('div', 'key', 'ESPAÇO'));
    onTap(this.empBtn, () => this.onEMP?.());
    onTap(this.dashBtn, () => this.onDash?.());
    br.append(this.dashBtn, this.empBtn);
    this.root.appendChild(br);

    // bottom-center extraction
    this.extractWrap = h('div', 'bc');
    this.extractBtn = h('button', 'btn extract-btn', 'EXTRAIR');
    onTap(this.extractBtn, () => this.onExtract?.());
    this.extractHint = h('div', 'extract-hint');
    this.extractWrap.append(this.extractBtn, this.extractHint);
    this.extractWrap.style.display = 'none';
    this.root.appendChild(this.extractWrap);

    this.toasts = h('div', 'toasts');
    this.banner = h('div', 'banner');
    this.root.append(this.toasts, this.banner);

    this.strain = h('div', 'strain');
    this.strain.appendChild(h('div', 't', 'PODER INSUFICIENTE'));
    this.strainBar = bar();
    this.strainSub = h('div', 's');
    this.strain.append(this.strainBar, this.strainSub);
    this.root.appendChild(this.strain);

    this.lockWarn = h('div', 'lock-warning', 'MÍSSIL TRAVADO');
    this.root.appendChild(this.lockWarn);
    for (let i = 0; i < 6; i++) {
      const m = h('div', 'missile-ind');
      m.style.display = 'none';
      this.missileInds.push(m);
      this.root.appendChild(m);
    }

    this.tutorial = h('div', 'tutorial');
    this.tutorialHand = h('div', 'hand');
    this.tutorialText = h('div', 't');
    this.tutorial.append(this.tutorialHand, this.tutorialText);
    this.root.appendChild(this.tutorial);

    this.district = h('div', 'district');
    this.districtName = h('div', 'n');
    this.districtHeat = h('div', 'h');
    this.district.append(this.districtName, this.districtHeat);
    this.root.appendChild(this.district);

    for (let i = 0; i < 12; i++) {
      const el = h('div', 'float-text');
      el.style.display = 'none';
      this.root.appendChild(el);
      this.floats.push({ el, pos: new Vector3(), life: 0, max: 1, active: false });
    }
  }

  show(on: boolean): void {
    toggleClass(this.root, 'visible', on);
  }

  private shownLevel = -1;

  setLevel(level: number, progress: number): void {
    if (level !== this.shownLevel) {
      this.shownLevel = level;
      this.lvl.innerHTML = `<small>LVL</small>${level}`;
    }
    setFill(this.xp, progress);
  }

  setMassClass(tier: number, progress: number): void {
    const name = TIER_NAMES[Math.min(TIER_NAMES.length - 1, tier)] ?? '';
    setText(this.mass, `CLASSE ${tier} · ${name}`);
    setFill(this.classBar, progress);
  }

  /** Objectives with progress bars; campaign runs show them as the city's three stars. */
  setObjectives(list: ReadonlyArray<{ title: string; progress: number; goal: number; done: boolean }>, stars = false, heading = 'OBJETIVOS'): void {
    this.objectives.set(list, stars, heading);
  }

  setScore(score: number): void {
    setText(this.score, formatInt(score));
  }

  setCombo(count: number, timerFrac: number, frenzy: boolean, dt: number): void {
    if (count > this.lastCombo && count > 1) this.comboPunch = 1.35 + Math.min(0.25, count * 0.004);
    this.lastCombo = count;
    this.comboPunch += (1 - this.comboPunch) * Math.min(1, dt * 12);
    toggleClass(this.combo, 'active', count >= 2);
    toggleClass(this.combo, 'frenzy', frenzy);
    setText(this.comboCount, `x${count}`);
    setText(this.comboLabel, frenzy ? 'ABDUCTION FRENZY' : 'ABDUCTION COMBO');
    this.comboCount.style.setProperty('--combo-punch', this.comboPunch.toFixed(3));
    const heat = Math.min(1, count / 50);
    this.comboCount.style.setProperty('--combo-glow', frenzy ? 'rgba(179,107,255,.95)' : `rgba(${Math.round(93 + heat * 162)},${Math.round(255 - heat * 48)},${Math.round(160 - heat * 97)},.85)`);
    setFill(this.comboTimer, timerFrac);
  }

  setAlert(level: number, progress: number): void {
    const color = ALERT_COLORS[Math.min(6, level)] as string;
    this.alertPips.forEach((p, i) => {
      toggleClass(p, 'on', i < level);
      if (i < level) p.style.setProperty('--pip', ALERT_COLORS[i + 1] as string);
    });
    setText(this.alertName, level === 0 ? 'SEM DETECÇÃO' : `${level} · ${ALERT_NAMES[level] ?? ''}`);
    toggleClass(this.alert, 'max', level >= 6);
    setFill(this.threat, progress);
    this.alertName.style.color = level >= 6 ? '' : level >= 3 ? color : '';
  }

  setHull(frac: number, value: number): void {
    setFill(this.hull, frac);
    setText(this.hullVal, `${Math.ceil(value)}`);
    toggleClass(this.hull, 'low', frac < 0.3);
  }

  setShield(frac: number): void {
    setFill(this.shield, frac);
  }

  setCoords(text: string): void {
    setText(this.coords, text);
  }

  setTimer(seconds: number): void {
    setText(this.timer, formatTime(seconds));
  }

  setEMP(frac: number, ready: boolean): void {
    const cd = `${Math.round((1 - frac) * 100)}%`;
    const el = this.empBtn.firstElementChild as HTMLElement;
    if (el.style.getPropertyValue('--cd') !== cd) el.style.setProperty('--cd', cd);
    toggleClass(this.empBtn, 'ready', ready);
  }

  setDash(visible: boolean, frac: number): void {
    this.dashBtn.style.display = visible ? '' : 'none';
    const el = this.dashBtn.firstElementChild as HTMLElement;
    el.style.setProperty('--cd', `${Math.round((1 - frac) * 100)}%`);
  }

  setExtraction(mult: number, hint: string, channeling: boolean): void {
    const show = mult > 0;
    this.extractWrap.style.display = show ? '' : 'none';
    toggleClass(this.root, 'extract-on', show);
    if (!show) return;
    setText(this.extractBtn, channeling ? 'EXTRAINDO...' : `EXTRAIR  x${mult}`);
    setText(this.extractHint, hint);
  }

  toast(title: string, subtitle = '', tone: Tone = 'good', duration = 2.4): void {
    const t = h('div', `toast ${tone}`);
    t.appendChild(h('div', 't', title));
    if (subtitle) t.appendChild(h('div', 's', subtitle));
    this.toasts.appendChild(t);
    while (this.toasts.children.length > 2) this.toasts.firstElementChild?.remove();
    setTimeout(() => t.classList.add('out'), duration * 1000);
    setTimeout(() => t.remove(), duration * 1000 + 400);
  }

  showBanner(title: string, sub = '', tone = 'var(--alien-green)'): void {
    this.banner.innerHTML = '';
    this.banner.appendChild(document.createTextNode(title));
    if (sub) this.banner.appendChild(h('span', 'bsub', sub));
    this.banner.style.setProperty('--tone', tone);
    this.banner.classList.remove('show');
    void this.banner.offsetWidth;
    this.banner.classList.add('show');
  }

  setStrain(visible: boolean, sx: number, sy: number, progress: number, sub: string): void {
    toggleClass(this.strain, 'visible', visible);
    if (!visible) return;
    this.strain.style.left = `${sx}px`;
    this.strain.style.top = `${sy}px`;
    setFill(this.strainBar, progress);
    setText(this.strainSub, sub);
  }

  /** Meme cinematic: the HUD steps aside (letterbox and name card are drawn by MemeHunt). */
  setCinematic(on: boolean): void {
    toggleClass(this.root, 'cine', on);
  }

  setLock(on: boolean): void {
    toggleClass(this.lockWarn, 'on', on);
  }

  /** Edge arrows pointing to incoming missiles. */
  setMissiles(points: ReadonlyArray<{ x: number; y: number; angle: number; close: boolean }>): void {
    for (let i = 0; i < this.missileInds.length; i++) {
      const el = this.missileInds[i] as HTMLDivElement;
      const p = points[i];
      if (!p) {
        if (el.style.display !== 'none') el.style.display = 'none';
        continue;
      }
      el.style.display = '';
      el.style.left = `${p.x}px`;
      el.style.top = `${p.y}px`;
      el.style.transform = `rotate(${p.angle}rad) scale(${p.close ? 1.3 : 1})`;
      toggleClass(el, 'blink', p.close && Math.floor(performance.now() / 120) % 2 === 0);
    }
  }

  setBoss(visible: boolean, shield: number, hull: number): void {
    toggleClass(this.bossBar, 'on', visible);
    if (!visible) return;
    setFill(this.bossShield, shield);
    setFill(this.bossHp, hull);
  }

  setTutorial(text: string | null, hand = false): void {
    toggleClass(this.tutorial, 'on', !!text);
    if (text) setText(this.tutorialText, text);
    this.tutorialHand.style.display = hand ? '' : 'none';
  }

  showDistrict(name: string, heat: string, dt = 0): void {
    if (name) {
      setText(this.districtName, name);
      setText(this.districtHeat, heat);
      this.districtTimer = 3;
      toggleClass(this.district, 'on', true);
    } else if (this.districtTimer > 0) {
      this.districtTimer -= dt;
      if (this.districtTimer <= 0) toggleClass(this.district, 'on', false);
    }
  }

  floatText(world: Vector3, text: string, tone: string, size = 22, duration = 1.1): void {
    const f = this.floats.find((x) => !x.active);
    if (!f) return;
    f.active = true;
    f.life = 0;
    f.max = duration;
    f.pos.copy(world);
    f.el.textContent = text;
    // everything that pops up over the saucer stays discreet: ~70% of the asked size
    f.el.style.fontSize = `calc(${(size * 0.7).toFixed(1)}px * var(--ui-scale))`;
    f.el.style.setProperty('--tone', tone);
    f.el.style.display = '';
  }

  updateFloats(dt: number, camera: PerspectiveCamera, w: number, hgt: number): void {
    for (const f of this.floats) {
      if (!f.active) continue;
      f.life += dt;
      const t = f.life / f.max;
      if (t >= 1) {
        f.active = false;
        f.el.style.display = 'none';
        continue;
      }
      _v.copy(f.pos).project(camera);
      const x = (_v.x * 0.5 + 0.5) * w;
      const y = (-_v.y * 0.5 + 0.5) * hgt - t * 38;
      const s = t < 0.12 ? 0.75 + (t / 0.12) * 0.3 : 1.05 - Math.min(0.1, (t - 0.12) * 0.3);
      f.el.style.transform = `translate(-50%,-50%) translate(${x.toFixed(1)}px,${y.toFixed(1)}px) scale(${s.toFixed(3)})`;
      f.el.style.left = '0';
      f.el.style.top = '0';
      f.el.style.opacity = `${(t > 0.65 ? (1 - t) / 0.35 : 1) * 0.92}`;
    }
  }

  drawRadar(dt: number, px: number, pz: number, range: number, blips: readonly RadarBlip[], time: number): void {
    this.radarTimer -= dt;
    if (this.radarTimer > 0) return;
    this.radarTimer = 1 / 15;
    const c = this.radarCtx;
    const s = 128;
    const r = s / 2;
    c.clearRect(0, 0, s, s);
    c.strokeStyle = 'rgba(93,255,160,0.18)';
    c.lineWidth = 1;
    for (const k of [0.33, 0.66]) {
      c.beginPath();
      c.arc(r, r, r * k, 0, Math.PI * 2);
      c.stroke();
    }
    c.beginPath();
    c.moveTo(r, 4);
    c.lineTo(r, s - 4);
    c.moveTo(4, r);
    c.lineTo(s - 4, r);
    c.stroke();
    // sweep
    const a = (time * 1.6) % (Math.PI * 2);
    const grad = c.createConicGradient ? c.createConicGradient(a - 0.6, r, r) : null;
    if (grad) {
      grad.addColorStop(0, 'rgba(93,255,160,0)');
      grad.addColorStop(0.09, 'rgba(93,255,160,0.28)');
      grad.addColorStop(0.1, 'rgba(93,255,160,0)');
      c.fillStyle = grad;
      c.beginPath();
      c.arc(r, r, r - 2, 0, Math.PI * 2);
      c.fill();
    }
    for (const b of blips) {
      let dx = (b.x - px) / range;
      let dz = (b.z - pz) / range;
      const d = Math.hypot(dx, dz);
      if (d > 0.95) {
        dx *= 0.95 / d;
        dz *= 0.95 / d;
      }
      const x = r + dx * r;
      const y = r + dz * r;
      const blink = b.kind === 'missile' ? Math.floor(time * 8) % 2 === 0 : true;
      if (!blink) continue;
      if (b.kind === 'meme') {
        // meme on the loose: a pulsing gold ring around the dot
        c.strokeStyle = '#ffc84a';
        c.lineWidth = 1.5;
        c.globalAlpha = 0.5 + 0.5 * Math.sin(time * 6);
        c.beginPath();
        c.arc(x, y, 6 + 2 * Math.sin(time * 6), 0, Math.PI * 2);
        c.stroke();
        c.globalAlpha = 1;
      }
      c.fillStyle = b.kind === 'enemy' ? '#ff4d5e' : b.kind === 'missile' ? '#ffb020' : b.kind === 'event' ? '#ffcf3f' : b.kind === 'boss' ? '#ff7b00' : b.kind === 'meme' ? '#ffc84a' : '#b36bff';
      c.beginPath();
      c.arc(x, y, b.kind === 'boss' ? 6 : b.kind === 'missile' ? 2.5 : b.kind === 'meme' ? 4 : 3.5, 0, Math.PI * 2);
      c.fill();
    }
    c.fillStyle = '#eafff4';
    c.beginPath();
    c.arc(r, r, 3.5, 0, Math.PI * 2);
    c.fill();
  }

  get extractionVisible(): boolean {
    return this.extractWrap.style.display !== 'none';
  }
}
