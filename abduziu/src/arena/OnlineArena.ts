import { Vector3, type Scene, type Texture } from 'three';
import { BALANCE } from '../config/gameBalance';
import type { Game } from '../core/Game';
import type { ArenaNet, Snapshot } from '../online/ArenaNet';
import { levelFromXp, tierFromMatter } from '../progression/RunProgression';
import { h } from '../ui/dom';
import type { RadarBlip } from '../ui/HUD';
import { TractorBeam } from '../ufo/TractorBeam';
import { UFOVisuals } from '../ufo/UFOVisuals';
import { clamp, damp, formatInt } from '../utils/math';
import { EAT_MARGIN } from './ArenaSystem';

const _v = new Vector3();
const _p = new Vector3();

/** Another ship in the room (player or server bot), smoothed between snapshots. */
class Remote {
  readonly visuals: UFOVisuals;
  readonly beam: TractorBeam;
  readonly label: HTMLDivElement;
  /** Latest reported position (canonical, extrapolated with the velocity). */
  readonly target = new Vector3();
  /** Smoothed canonical position. */
  readonly pos = new Vector3();
  readonly vis = new Vector3();
  readonly vel = new Vector3();
  m = 0;
  shownM = 0;
  seen = 0;
  gone = 0;
  alt = 10;
  level = 1;
  fresh = true;

  constructor(
    readonly id: string,
    public name: string,
    public color: number,
    public bot: boolean,
    env: Texture | null,
    noise: Texture,
    parent: HTMLElement,
  ) {
    this.visuals = new UFOVisuals(env);
    this.visuals.setAccent(color);
    this.beam = new TractorBeam(noise);
    this.beam.setColor(color);
    this.beam.setActive(true);
    this.label = h('div', 'arena-tag');
    this.label.style.setProperty('--c', `#${color.toString(16).padStart(6, '0')}`);
    parent.appendChild(this.label);
  }

  get tier(): number {
    return tierFromMatter(this.shownM);
  }
  get scale(): number {
    return Math.min(BALANCE.ufo.maxScale, Math.pow(BALANCE.ufo.scaleBase, Math.max(0, this.tier - 1)));
  }
  get radius(): number {
    return BALANCE.ufo.baseRadius * this.scale;
  }
  get beamRadius(): number {
    return BALANCE.beam.baseRadius * this.scale;
  }
}

/**
 * ARENA ONLINE: the room (server) owns the other ships and every swallow; this class
 * draws them, reports our ship and reacts to "you ate" / "you were eaten".
 */
export class OnlineArena {
  private readonly ships = new Map<string, Remote>();
  private readonly panel: HTMLDivElement;
  private readonly clock: HTMLDivElement;
  private readonly rows: HTMLDivElement;
  private readonly warn: HTMLDivElement;
  private readonly warnBar: HTMLDivElement;
  private snap: Snapshot | null = null;
  private sendTimer = 0;
  private boardTimer = 0;
  active = false;
  place = 0;
  eatenBy: string | null = null;
  private captorId: string | null = null;
  playerName = 'VOCÊ';
  onPlayerEaten: ((by: string) => void) | null = null;
  onDisconnect: (() => void) | null = null;
  net: ArenaNet | null = null;

  constructor(
    private readonly g: Game,
    private readonly scene: Scene,
    private readonly env: Texture | null,
    private readonly noise: Texture,
  ) {
    const root = g.hud.root;
    this.panel = h('div', 'arena-panel');
    this.clock = h('div', 'arena-clock', 'AO VIVO');
    this.rows = h('div', 'arena-rows');
    this.panel.append(this.clock, this.rows);
    this.panel.style.display = 'none';
    (root.querySelector('.tr') ?? root).appendChild(this.panel);
    this.warn = h('div', 'arena-warn');
    this.warn.appendChild(h('div', 't', 'VOCÊ ESTÁ SENDO ABDUZIDO · FUJA!'));
    this.warnBar = h('div', 'bar');
    this.warnBar.appendChild(h('i'));
    this.warn.appendChild(this.warnBar);
    root.appendChild(this.warn);
  }

  private get myId(): string {
    return this.net?.welcome?.id ?? '';
  }

  get total(): number {
    return this.ships.size + 1;
  }

  start(net: ArenaNet): void {
    this.clear();
    this.net = net;
    this.active = true;
    this.place = 0;
    this.eatenBy = null;
    this.captorId = null;
    this.g.hud.root.classList.add('arena');
    this.panel.style.display = '';
    net.onSnap = (s) => (this.snap = s);
    net.onAte = (victim, victimId, gain) => this.onAte(victim, victimId, gain);
    net.onEaten = (by, byId) => {
      if (this.eatenBy) return;
      this.eatenBy = by;
      this.captorId = byId;
      this.place = this.playerPlace();
      this.onPlayerEaten?.(by);
    };
    net.onClose = () => {
      if (this.active && !this.eatenBy) this.onDisconnect?.();
    };
  }

  clear(): void {
    for (const r of this.ships.values()) this.dispose(r);
    this.ships.clear();
    this.snap = null;
    this.active = false;
    this.panel.style.display = 'none';
    this.warn.classList.remove('on');
    this.g.hud.root.classList.remove('arena');
    this.net?.close();
    this.net = null;
  }

  private dispose(r: Remote): void {
    this.scene.remove(r.visuals.root);
    this.scene.remove(r.beam.group);
    r.label.remove();
  }

  private dx(a: number, b: number): number {
    return this.g.world.dx(a, b);
  }
  private dz(a: number, b: number): number {
    return this.g.world.dz(a, b);
  }

  private onAte(victim: string, victimId: string, gain: number): void {
    const g = this.g;
    const r = g.run;
    const levels = r.progression.addMatter(gain);
    if (levels > 0) g.onLevelsGained(levels);
    const pts = Math.round(1500 + gain * 180);
    r.stats.score += pts;
    r.stats.enemiesDestroyed++;
    g.hud.floatText(_v.copy(g.ufo.position).setY(g.ufo.position.y + g.stats.radius * 1.5), `${victim.toUpperCase()} ABDUZIDO!`, 'var(--gold)', 24, 1.4);
    g.hud.floatText(_v.copy(g.ufo.position).setY(g.ufo.position.y + g.stats.radius * 0.8), `+${formatInt(pts)}`, 'var(--alien-green)', 20);
    g.audio.comboMilestone(10);
    g.audio.abductPop(6, 10, true, g.ufo.position.x, g.ufo.position.z);
    const v = this.ships.get(victimId);
    g.vfx.absorb(g.ufo.position, 6, g.stats.radius, 10, true, v?.color ?? 0xffffff);
    g.cameraCtl.addTrauma(0.35);
    g.haptics.light();
    if (v) v.gone = 0.7;
  }

  /** Where the player is being dragged while swallowed. */
  get captorPosition(): Vector3 | null {
    const c = this.captorId ? this.ships.get(this.captorId) : null;
    return c ? c.vis : null;
  }

  playerPlace(): number {
    const mine = this.g.run.progression.matter;
    let above = 0;
    for (const r of this.ships.values()) if (!r.gone && r.m > mine) above++;
    return above + 1;
  }

  update(dt: number, playing: boolean, beamOn: boolean): void {
    if (!this.active) return;
    const g = this.g;
    const now = performance.now();
    const pp = g.ufo.position;

    // report our ship ~10×/s
    this.sendTimer -= dt;
    if (this.sendTimer <= 0 && playing) {
      this.sendTimer = 0.1;
      this.net?.sendState(pp.x, pp.z, g.ufo.velocity.x, g.ufo.velocity.z, g.run.progression.matter, beamOn);
    }

    // apply the latest snapshot
    const s = this.snap;
    if (s) {
      this.snap = null;
      const present = new Set<string>();
      for (const [id, name, color, x, z, vx, vz, m, bot] of s.s) {
        if (id === this.myId) continue;
        present.add(id);
        let r = this.ships.get(id);
        if (!r) {
          r = new Remote(id, name, color, !!bot, this.env, this.noise, g.hud.root);
          this.scene.add(r.visuals.root);
          this.scene.add(r.beam.group);
          this.ships.set(id, r);
        }
        if (r.fresh || r.gone) {
          r.pos.set(x, 0, z);
          r.shownM = m;
          r.fresh = false;
          r.gone = 0;
          r.visuals.root.visible = true;
          r.beam.setActive(true);
        }
        r.target.set(x, 0, z);
        r.vel.set(vx, 0, vz);
        r.m = m;
        r.seen = now;
      }
      for (const r of this.ships.values()) if (!present.has(r.id) && !r.gone) r.gone = 0.6;
      this.board(s);
      const held = playing && s.h > 0.02;
      this.warn.classList.toggle('on', held);
      (this.warnBar.firstChild as HTMLElement).style.transform = `scaleX(${clamp(s.h, 0, 1).toFixed(3)})`;
      if (held) {
        g.ufo.addTug(0.6);
        g.cameraCtl.addTrauma(dt * 0.9);
      }
    }

    for (const r of [...this.ships.values()]) {
      if (r.gone > 0) {
        // swallowed/left: spin down into nothing
        r.gone -= dt;
        const k = clamp(r.gone / 0.6, 0, 1);
        r.visuals.root.scale.setScalar(Math.max(0.01, r.radius * k));
        r.visuals.body.rotation.y += dt * 14;
        r.label.style.display = 'none';
        if (r.gone <= 0) {
          r.visuals.root.visible = false;
          r.beam.setActive(false);
          if (now - r.seen > 5000) {
            this.dispose(r);
            this.ships.delete(r.id);
          }
        }
        continue;
      }
      // dead-reckoning + smoothing toward the reported position
      r.target.x += r.vel.x * dt;
      r.target.z += r.vel.z * dt;
      const k = 1 - Math.exp(-8 * dt);
      r.pos.x += this.dx(r.pos.x, r.target.x) * k;
      r.pos.z += this.dz(r.pos.z, r.target.z) * k;
      g.world.clampToBounds(r.pos, 0);
      r.shownM = damp(r.shownM, r.m, 4, dt);
      const lv = levelFromXp(r.shownM);
      if (lv !== r.level) {
        r.level = lv;
        r.visuals.setLevel(lv);
      }
      const sc = r.scale;
      const roof = g.world.heightField.maxInRadius(r.pos.x, r.pos.z, r.radius * 1.3);
      const target = Math.max(BALANCE.ufo.baseAltitude * Math.pow(sc, BALANCE.ufo.altitudeScaleExp), roof + BALANCE.ufo.clearance * sc + r.radius * 0.4);
      r.alt = damp(r.alt, target, target > r.alt ? 5 : 1.5, dt);
      r.vis.set(pp.x + this.dx(pp.x, r.pos.x), r.alt, pp.z + this.dz(pp.z, r.pos.z));
      const root = r.visuals.root;
      root.position.copy(r.vis);
      root.scale.setScalar(r.radius);
      const inv = 1 / Math.max(1, BALANCE.ufo.baseSpeed * sc);
      r.visuals.body.rotation.x = damp(r.visuals.body.rotation.x, r.vel.z * inv * BALANCE.ufo.maxTilt, 5, dt);
      r.visuals.body.rotation.z = damp(r.visuals.body.rotation.z, -r.vel.x * inv * BALANCE.ufo.maxTilt, 5, dt);
      r.visuals.update(dt, 0.5);
      const ground = g.world.groundAt(r.pos.x, r.pos.z);
      r.beam.update(dt, r.vis, ground, r.radius, r.beamRadius, 1 + r.tier * 0.3, 0, 0, () => ground);
      if (g.world.grid.isWaterAt(r.pos.x, r.pos.z)) g.waterFx.touch(r, r.vis.x, r.vis.z, r.vel.x, r.vel.z, r.beamRadius, dt);
    }
    this.labels();
  }

  private labels(): void {
    const g = this.g;
    const cam = g.cameraCtl.camera;
    const w = g.renderer.width;
    const hh = g.renderer.height;
    const pt = g.stats.baseBeamTier;
    for (const r of this.ships.values()) {
      if (r.gone) continue;
      _p.copy(r.vis).setY(r.vis.y + r.radius * 0.9).project(cam);
      if (_p.z > 1 || Math.abs(_p.x) > 1.1 || Math.abs(_p.y) > 1.1) {
        r.label.style.display = 'none';
        continue;
      }
      r.label.style.display = '';
      const x = clamp((_p.x * 0.5 + 0.5) * w, 70, w - 70);
      const y = clamp((-_p.y * 0.5 + 0.5) * hh, 40, hh - 10);
      r.label.style.transform = `translate(-50%,-100%) translate(${x.toFixed(1)}px,${y.toFixed(1)}px)`;
      const danger = r.tier >= pt + EAT_MARGIN ? 'bad' : pt >= r.tier + EAT_MARGIN ? 'prey' : '';
      const text = `${r.bot ? '' : '● '}${r.name} · ${formatInt(r.m)}`;
      if (r.label.textContent !== text) r.label.textContent = text;
      if (r.label.dataset.k !== danger) {
        r.label.dataset.k = danger;
        r.label.className = `arena-tag ${danger}`;
      }
    }
  }

  private board(s: Snapshot): void {
    this.boardTimer -= 1;
    if (this.boardTimer > 0) return;
    this.boardTimer = 3;
    const mine = Math.round(this.g.run.progression.matter);
    const list = s.lb.filter((e) => e.id !== this.myId).map((e) => ({ n: e.n, m: e.m, me: false, bot: e.bot }));
    list.push({ n: this.playerName, m: mine, me: true, bot: false });
    list.sort((a, b) => b.m - a.m);
    const me = list.findIndex((e) => e.me);
    const shown = list.slice(0, 5).map((e, i) => ({ e, i }));
    if (me >= 5) shown.push({ e: list[me]!, i: me });
    this.clock.textContent = `AO VIVO · ${s.n} ${s.n === 1 ? 'JOGADOR' : 'JOGADORES'}`;
    this.rows.innerHTML = '';
    for (const { e, i } of shown) {
      const row = h('div', `arena-row${e.me ? ' me' : ''}`);
      row.style.setProperty('--c', e.me ? '#5dffa0' : e.bot ? '#8a93b8' : '#ff5ad1');
      row.append(h('span', 'n', `${i + 1}`), h('span', 'who', `${e.bot || e.me ? '' : '● '}${e.n}`), h('span', 'm', formatInt(e.m)));
      this.rows.appendChild(row);
    }
  }

  blips(out: RadarBlip[]): void {
    if (!this.active) return;
    const pt = this.g.stats.baseBeamTier;
    const p = this.g.ufo.position;
    for (const r of this.ships.values()) {
      if (r.gone) continue;
      const x = p.x + this.dx(p.x, r.pos.x);
      const z = p.z + this.dz(p.z, r.pos.z);
      out.push({ x, z, kind: r.tier >= pt + EAT_MARGIN ? 'enemy' : pt >= r.tier + EAT_MARGIN ? 'rare' : 'event' });
    }
  }
}
