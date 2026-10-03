import { META_VALUES } from '../config/meta';
import { AdditiveBlending, CylinderGeometry, Mesh, MeshBasicMaterial, type PerspectiveCamera, type Scene } from 'three';
import { getObjectDef, RARITY_INFO, type ObjectDef } from '../config/objects';
import type { GameMode } from '../config/modes';
import { h } from '../ui/dom';
import type { RadarBlip } from '../ui/HUD';
import { AState, type Abductable } from '../world/Abductable';
import type { Game } from './Game';

/** Chance that a story-mode stage gets a meme at all, and a second one after it. */
const FIRST_CHANCE = 0.35;
const SECOND_CHANCE = 0.1;
/** Slow motion while the cinematic plays (game time scale). */
const CINE_SCALE = 0.4;
/** Longest the cinematic may hold the game, in real seconds. */
const CINE_MAX = 6.5;

interface Live {
  obj: Abductable;
  def: ObjectDef;
  beam: Mesh;
  halo: Mesh;
  /** The cinematic already played for it. */
  seen: boolean;
}

interface Cine {
  m: Live;
  t: number;
  /** Real time when the meme was absorbed (-1 = still rising). */
  done: number;
  yaw: number;
  cam: (cam: PerspectiveCamera, dt: number) => void;
  /** Abduction phase whose length was already trimmed for the cinematic. */
  paced: AState | -1;
}

const BEAM_H = 240;

/**
 * The Tripo memes in story mode (campanha): super rare. Now and then one of them shows up in the
 * crowd, shining gold, with a column of light that can be seen across the city and a blip on the
 * radar. The moment the beam lifts it, a short cinematic plays on the spot (letterbox, slow motion,
 * a camera circling the meme as it rises, its name card), then the game picks up again.
 * Other modes never get memes: the city is only generic people there.
 */
export class MemeHunt {
  private live: Live[] = [];
  private schedule: number[] = [];
  private time = 0;
  private enabled = false;
  private cine: Cine | null = null;
  private readonly beamGeo = new CylinderGeometry(0.35, 0.35, 1, 10, 1, true);
  private readonly haloGeo = new CylinderGeometry(1.8, 1.8, 1, 18, 1, true);
  private readonly layer: HTMLDivElement;
  private readonly label: HTMLDivElement;
  private readonly name: HTMLDivElement;
  private readonly rarity: HTMLDivElement;
  private readonly got: HTMLDivElement;

  constructor(
    private readonly g: Game,
    private readonly scene: Scene,
    parent: HTMLElement,
  ) {
    this.layer = h('div', 'meme-cine');
    const card = h('div', 'mc-card');
    this.label = h('div', 'mc-label');
    this.name = h('div', 'mc-name');
    this.rarity = h('div', 'mc-rarity');
    card.append(this.label, this.name, this.rarity);
    this.got = h('div', 'mc-got', '+1 NA COLEÇÃO');
    this.layer.append(h('div', 'mc-bar mc-top'), h('div', 'mc-bar mc-bot'), card, this.got);
    parent.appendChild(this.layer);
  }

  /** A cinematic is holding the game (input, camera, time). */
  get cinematic(): boolean {
    return this.cine !== null;
  }

  start(mode: GameMode): void {
    this.stop();
    this.g.npcs.clearMemes();
    this.time = 0;
    this.enabled = mode === 'campanha' && this.g.npcs.memeLooks.length > 0;
    const radar = 1 + (this.g.save.get().meta.eco_meme ?? 0) * META_VALUES.memeChancePerLevel;
    if (!this.enabled || Math.random() >= Math.min(0.95, FIRST_CHANCE * radar)) return;
    const t1 = 35 + Math.random() * 75;
    this.schedule.push(t1);
    if (Math.random() < SECOND_CHANCE * radar) this.schedule.push(t1 + 60 + Math.random() * 60);
  }

  /** Run over (or quit): no meme, no cinematic, nothing held. */
  stop(): void {
    this.endCine();
    for (const m of this.live) this.dispose(m);
    this.live = [];
    this.schedule = [];
    this.enabled = false;
  }

  /** @param dt game time, @param rdt real time */
  update(dt: number, rdt: number): void {
    if (!this.enabled) return;
    this.time += dt;
    while (this.schedule.length && this.time >= (this.schedule[0] as number)) {
      this.schedule.shift();
      this.spawn();
    }
    const pulse = 0.5 + 0.5 * Math.sin(this.g.time.realElapsed * 4);
    for (const m of [...this.live]) {
      const o = m.obj;
      const gone = !o.alive || o.state === AState.Absorbed;
      const rising = o.state === AState.Lifting || o.state === AState.Orbiting || o.state === AState.Sucking;
      if (rising && !m.seen && !this.cine && this.g.state === 'playing') this.startCine(m);
      if (gone && this.cine?.m !== m) {
        this.dispose(m);
        this.live.splice(this.live.indexOf(m), 1);
        continue;
      }
      // the column of light follows it on the ground and fades once the beam has it
      const ground = this.g.world.groundAt(o.pos.x, o.pos.z);
      const fade = rising || gone ? 0 : 1;
      for (const [mesh, base] of [[m.beam, 0.55], [m.halo, 0.16]] as const) {
        mesh.position.set(o.pos.x, ground + BEAM_H / 2, o.pos.z);
        const mat = mesh.material as MeshBasicMaterial;
        mat.opacity = (base + base * 0.5 * pulse) * fade;
        mesh.visible = mat.opacity > 0.01;
      }
    }
    if (this.cine) this.tickCine(rdt);
  }

  /** Radar: every meme on the loose. */
  blips(out: RadarBlip[]): void {
    for (const m of this.live) if (m.obj.alive && m.obj.state !== AState.Absorbed) out.push({ x: m.obj.pos.x, z: m.obj.pos.z, kind: 'meme' });
  }

  private spawn(): void {
    const npcs = this.g.npcs;
    const busy = new Set(this.live.map((m) => m.def.id));
    let pool = npcs.memeLooks.filter((l) => !busy.has(npcs.memeDefOf(l) ?? ''));
    // usually one that is not in the collection yet
    const dex = this.g.save.get().dex;
    const fresh = pool.filter((l) => !dex[npcs.memeDefOf(l) ?? '']);
    if (fresh.length && Math.random() < 0.75) pool = fresh;
    if (!pool.length) return;
    const look = pool[Math.floor(Math.random() * pool.length)] as number;
    const def = getObjectDef(npcs.memeDefOf(look) as string);
    const obj = npcs.spawnMeme(look, def, this.g.ufo.position, 50, 170, Math.random);
    if (!obj) return;
    const mat = () => new MeshBasicMaterial({ color: 0xffc84a, transparent: true, opacity: 0, blending: AdditiveBlending, depthWrite: false });
    const beam = new Mesh(this.beamGeo, mat());
    const halo = new Mesh(this.haloGeo, mat());
    for (const b of [beam, halo]) {
      b.scale.y = BEAM_H;
      b.frustumCulled = false;
      b.renderOrder = 5;
      this.scene.add(b);
    }
    this.live.push({ obj, def, beam, halo, seen: false });
    this.g.hud.toast('MEME À SOLTA!', `${def.name.toUpperCase()} apareceu brilhando na cidade`, 'gold', 3.4);
    this.g.audio.discovery();
    this.g.vfx.discovery(obj.pos, 0xffc84a);
  }

  private dispose(m: Live): void {
    for (const b of [m.beam, m.halo]) {
      this.scene.remove(b);
      (b.material as MeshBasicMaterial).dispose();
    }
  }

  // ─── the cinematic
  private startCine(m: Live): void {
    m.seen = true;
    const g = this.g;
    const cam = g.cameraCtl.camera;
    // start on the side the player was looking from, so the cut keeps its bearings
    const yaw = Math.atan2(cam.position.x - m.obj.pos.x, cam.position.z - m.obj.pos.z);
    const c: Cine = { m, t: 0, done: -1, yaw, cam: (cm, dt) => this.cineCamera(cm, dt), paced: -1 };
    this.cine = c;
    g.cameraCtl.override = c.cam;
    g.time.setHold(CINE_SCALE);
    g.hud.setCinematic(true);
    g.audio.discovery();
    this.label.textContent = `MEME ABDUZIDO · #${m.def.dex.toString().padStart(3, '0')}`;
    this.name.textContent = m.def.name.toUpperCase();
    const r = RARITY_INFO[m.def.rarity ?? 'normal'];
    this.rarity.textContent = r.label.toUpperCase();
    this.rarity.style.setProperty('--rc', `#${r.color.toString(16).padStart(6, '0')}`);
    this.layer.classList.remove('got');
    this.layer.classList.add('on');
  }

  private tickCine(rdt: number): void {
    const c = this.cine as Cine;
    c.t += rdt;
    const o = c.m.obj;
    // keep the rise short enough to land inside the shot, even in slow motion
    const rising = o.state === AState.Lifting || o.state === AState.Orbiting || o.state === AState.Sucking;
    if (rising && c.paced !== o.state) {
      c.paced = o.state;
      o.phaseDuration = Math.min(o.phaseDuration, o.stateTime + (o.state === AState.Lifting ? 0.9 : 0.45));
    }
    const gone = !o.alive || o.state === AState.Absorbed;
    if (gone && c.done < 0) {
      c.done = c.t;
      this.layer.classList.add('got');
    }
    // dropped on the way up (the beam lost it): no point holding the game
    const dropped = o.state === AState.Falling || o.state === AState.Settling || o.state === AState.Static;
    if ((c.done >= 0 && c.t - c.done > 1.1) || c.t > CINE_MAX || dropped || this.g.state !== 'playing') this.endCine();
  }

  /** Camera spot on the orbit around the meme (yaw), below the saucer, above the ground. */
  private orbitSpot(yaw: number, r: number): { x: number; y: number; z: number } {
    const c = this.cine as Cine;
    const p = c.m.obj.pos;
    const w = this.g.world;
    const x = p.x + Math.sin(yaw) * r;
    const z = p.z + Math.cos(yaw) * r;
    const under = this.g.ufo.position.y - this.g.stats.radius * 1.2 - 2;
    const y = Math.max(Math.min(p.y - 0.4, under), w.groundAt(x, z) + 1.3);
    return { x, y, z };
  }

  /** Nothing tall between the camera and the meme (and the camera is not inside a building). */
  private clearView(s: { x: number; y: number; z: number }): boolean {
    const p = (this.cine as Cine).m.obj.pos;
    const hf = this.g.world.heightField;
    for (let i = 0; i <= 10; i++) {
      const k = i / 10;
      if (k > 0.9) break;
      const x = s.x + (p.x - s.x) * k;
      const y = s.y + (p.y + 0.8 - s.y) * k;
      const z = s.z + (p.z - s.z) * k;
      if (hf.maxInRadius(x, z, 0.8) > y - 0.2) return false;
    }
    return true;
  }

  /**
   * Low orbit around the rising meme, looking up at it and the saucer above (never into the hatch).
   * When a building would hide it, the camera cuts to the nearest clear angle.
   */
  private cineCamera(cam: PerspectiveCamera, dt: number): void {
    const c = this.cine;
    if (!c) return;
    const p = c.m.obj.pos;
    const u = this.g.ufo.position;
    const k = Math.min(1, c.t / 3);
    const risen = Math.max(0, p.y - this.g.world.groundAt(p.x, p.z));
    // pull back as it rises so the meme and the saucer stay in frame together
    let r = 7 - 1.5 * k + risen * 0.55;
    c.yaw += dt * 0.5;
    let spot = this.orbitSpot(c.yaw, r);
    if (!this.clearView(spot)) {
      let found = false;
      for (const rr of [r, 4.5]) {
        for (let i = 1; i <= 12 && !found; i++) {
          for (const sign of [1, -1]) {
            const yaw = c.yaw + sign * i * (Math.PI / 12);
            const s2 = this.orbitSpot(yaw, rr);
            if (this.clearView(s2)) {
              c.yaw = yaw;
              r = rr;
              spot = s2;
              found = true;
              break;
            }
          }
        }
        if (found) break;
      }
      // boxed in: look down the beam from just under the saucer
      if (!found) spot = { x: p.x + Math.sin(c.yaw) * 3, y: u.y - this.g.stats.radius * 1.2 - 1, z: p.z + Math.cos(c.yaw) * 3 };
    }
    cam.position.set(spot.x, spot.y, spot.z);
    cam.lookAt(p.x + (u.x - p.x) * 0.25, p.y + 0.6 + (u.y - p.y) * 0.25, p.z + (u.z - p.z) * 0.25);
    cam.fov = 48 - 8 * k;
    cam.updateProjectionMatrix();
  }

  private endCine(): void {
    const c = this.cine;
    if (!c) return;
    this.cine = null;
    const g = this.g;
    if (g.cameraCtl.override === c.cam) g.cameraCtl.override = null;
    g.time.setHold(null);
    g.hud.setCinematic(false);
    this.layer.classList.remove('on');
    const i = this.live.indexOf(c.m);
    if (i >= 0 && (!c.m.obj.alive || c.m.obj.state === AState.Absorbed)) {
      this.dispose(c.m);
      this.live.splice(i, 1);
    }
  }
}
