import { META_VALUES } from '../config/meta';
import { AdditiveBlending, CylinderGeometry, Mesh, MeshBasicMaterial, Vector3, type PerspectiveCamera, type Scene } from 'three';
import { getObjectDef, RARITY_INFO, type ObjectDef } from '../config/objects';
import type { GameMode } from '../config/modes';
import { h } from '../ui/dom';
import type { RadarBlip } from '../ui/HUD';
import { AState, type Abductable } from '../world/Abductable';
import type { Game } from './Game';

/** Chance that a story-mode stage gets a meme at all, and a second one after it. */
const FIRST_CHANCE = 0.35;
const SECOND_CHANCE = 0.1;
/** Slow motion while the cinematic plays (game time scale): heavier on the face close-up. */
const CINE_SCALE_FACE = 0.3;
const CINE_SCALE_LIFT = 0.5;
/** Longest the cinematic may hold the game, in real seconds. */
const CINE_MAX = 7.5;
/** Real seconds of the startled face before it starts running in the air. */
const STARTLE = 0.45;
/** What they yell in the close-up. */
const SCREAMS = ['SOCORRO!', 'AAAAAH!', 'ME SOLTA!', 'NÃÃÃO!', 'MÃÃÃE!', 'TÁ MALUCO?!', 'ME AJUDA!'];

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
  /** Abduction phase whose length was already pre-paced for the cinematic. */
  paced: AState | -1;
  /** 0 = tight on the face, 1 = pulled back following the rise. */
  pull: number;
  /** Smoothed camera spot (the first frame snaps). */
  spot: Vector3;
  fresh: boolean;
  /** Last face position (held once it is absorbed). */
  face: Vector3;
  /** Line the abduction system keeps clear of other carried things. */
  clear: { from: Vector3; to: Vector3; keep: Abductable };
}

const _target = new Vector3();
const _aim = new Vector3();

const BEAM_H = 240;

/**
 * The Tripo memes in story mode (campanha): super rare. Now and then one of them shows up in the
 * crowd, shining gold, with a column of light that can be seen across the city and a blip on the
 * radar. The moment the beam grabs it, a short cinematic plays on the spot: letterbox and slow
 * motion, an extreme close-up of its face as it freaks out and runs in the air going nowhere, then
 * the camera rides up with it, face still in frame, until the saucer swallows it (name card,
 * +1 in the collection). Then the game picks up again.
 * Other modes never get memes: the city is only generic people there.
 */
export class MemeHunt {
  private live: Live[] = [];
  private schedule: number[] = [];
  private time = 0;
  private enabled = false;
  private cine: Cine | null = null;
  private readonly near: Abductable[] = [];
  private readonly beamGeo = new CylinderGeometry(0.35, 0.35, 1, 10, 1, true);
  private readonly haloGeo = new CylinderGeometry(1.8, 1.8, 1, 18, 1, true);
  private readonly layer: HTMLDivElement;
  private readonly label: HTMLDivElement;
  private readonly name: HTMLDivElement;
  private readonly rarity: HTMLDivElement;
  private readonly got: HTMLDivElement;
  private readonly scream: HTMLDivElement;

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
    this.scream = h('div', 'mc-scream');
    this.layer.append(h('div', 'mc-panic'), h('div', 'mc-bar mc-top'), h('div', 'mc-bar mc-bot'), this.scream, card, this.got);
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
      // the beam has it (still on its feet or already rising): roll the close-up
      if ((rising || o.state === AState.Shaking) && !m.seen && !this.cine && this.g.state === 'playing') this.startCine(m);
      if (gone && this.cine?.m !== m) {
        this.dispose(m);
        this.live.splice(this.live.indexOf(m), 1);
        continue;
      }
      // the column of light follows it on the ground and fades once the beam has it
      const ground = this.g.world.groundAt(o.pos.x, o.pos.z);
      const fade = rising || gone || o.state === AState.Shaking ? 0 : 1;
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
    const spot = new Vector3();
    const face = new Vector3();
    const c: Cine = { m, t: 0, done: -1, yaw, cam: (cm, dt) => this.cineCamera(cm, dt), paced: -1, pull: 0, spot, fresh: true, face, clear: { from: spot, to: face, keep: m.obj } };
    this.cine = c;
    g.cameraCtl.override = c.cam;
    g.time.setHold(CINE_SCALE_FACE);
    g.hud.setCinematic(true);
    g.audio.discovery();
    // on its feet, facing the lens: startled first, then running in the air
    g.npcs.panicMeme = m.obj;
    g.npcs.panicClip = 'freaky';
    this.scream.textContent = SCREAMS[Math.floor(Math.random() * SCREAMS.length)] as string;
    this.label.textContent = `MEME ABDUZIDO · #${m.def.dex.toString().padStart(3, '0')}`;
    this.name.textContent = m.def.name.toUpperCase();
    const r = RARITY_INFO[m.def.rarity ?? 'normal'];
    this.rarity.textContent = r.label.toUpperCase();
    this.rarity.style.setProperty('--rc', `#${r.color.toString(16).padStart(6, '0')}`);
    this.layer.classList.remove('got', 'rise');
    this.layer.classList.add('on');
  }

  private tickCine(rdt: number): void {
    const c = this.cine as Cine;
    c.t += rdt;
    const o = c.m.obj;
    const npcs = this.g.npcs;
    if (c.t > STARTLE && npcs.panicMeme === o) npcs.panicClip = 'run';
    // pacing: the face beat gets a moment, the rise stays short enough to land inside the shot
    const rising = o.state === AState.Lifting || o.state === AState.Orbiting || o.state === AState.Sucking;
    if (c.paced !== o.state) {
      if (o.state === AState.Shaking) o.phaseDuration = Math.max(o.phaseDuration, o.stateTime + 0.5);
      else if (rising) o.phaseDuration = Math.min(o.phaseDuration, o.stateTime + (o.state === AState.Lifting ? 1 : 0.45));
      if (rising && !this.layer.classList.contains('rise')) {
        this.g.time.setHold(CINE_SCALE_LIFT);
        this.layer.classList.add('rise');
      }
      c.paced = o.state;
    }
    const gone = !o.alive || o.state === AState.Absorbed;
    if (gone && c.done < 0) {
      c.done = c.t;
      this.layer.classList.add('got');
      if (npcs.panicMeme === o) npcs.panicMeme = null;
    }
    // dropped on the way up (the beam lost it): no point holding the game
    const dropped = o.state === AState.Falling || o.state === AState.Settling || o.state === AState.Static;
    if ((c.done >= 0 && c.t - c.done > 1.2) || c.t > CINE_MAX || dropped || this.g.state !== 'playing') this.endCine();
  }

  /**
   * Nothing between the camera spot and the target: no building (height field) and no prop,
   * car or passer-by standing in the line (the close-up is low, a bus stop is enough to hide it).
   */
  private clearView(s: Vector3, t: Vector3): boolean {
    const w = this.g.world;
    const hf = w.heightField;
    const self = (this.cine as Cine).m.obj;
    for (let i = 0; i <= 9; i++) {
      const k = i / 10;
      const x = s.x + (t.x - s.x) * k;
      const y = s.y + (t.y - s.y) * k;
      const z = s.z + (t.z - s.z) * k;
      if (hf.maxInRadius(x, z, 0.5) > y - 0.15) return false;
      w.query(x, z, 0.6, this.near);
      for (const b of this.near) {
        if (b === self || b.state !== AState.Static) continue;
        if (b.pos.y + b.model.height * b.scale < y - 0.1) continue;
        const r = b.model.radius * b.scale * 0.8 + 0.25;
        if ((b.pos.x - x) ** 2 + (b.pos.z - z) ** 2 < r * r) return false;
      }
    }
    return true;
  }

  /** Camera spot in front of the face (yaw around it), below the saucer, above the ground. */
  private faceSpot(out: Vector3, face: Vector3, yaw: number, dist: number, lift: number): Vector3 {
    const g = this.g;
    out.set(face.x + Math.sin(yaw) * dist, face.y + lift, face.z + Math.cos(yaw) * dist);
    const under = g.ufo.position.y - g.stats.radius * 0.7 - 0.6;
    out.y = Math.max(Math.min(out.y, under), g.world.groundAt(out.x, out.z) + 0.35);
    return out;
  }

  /**
   * Beat 1: extreme close-up on the face (long lens, slow push-in, handheld shake) while it freaks
   * out and runs in the air. Beat 2: as the beam lifts it the camera rides up with it, dropping a
   * little below to look up at it against the hatch light, face always in frame. When a building
   * would hide it, the camera swings to the nearest clear angle.
   */
  private cineCamera(cam: PerspectiveCamera, dt: number): void {
    const c = this.cine;
    if (!c) return;
    const g = this.g;
    const o = c.m.obj;
    const alive = o.alive && o.state !== AState.Absorbed;
    const h = g.npcs.crowdHeight(o) * Math.max(0.5, o.visualScale);
    // eye line (the run/freak clips hunch a little below the bind-pose height)
    if (alive) c.face.set(o.pos.x, o.pos.y + h * 0.72, o.pos.z);
    const face = c.face;
    const rising = !alive || o.state === AState.Lifting || o.state === AState.Orbiting || o.state === AState.Sucking;
    c.pull += ((rising ? 1 : 0) - c.pull) * (1 - Math.exp(-1.8 * dt));
    const pull = c.pull;
    const push = Math.min(1, c.t / 1.5);
    const pushS = push * push * (3 - 2 * push);
    // opens on the upper body (arms pumping), pushes in to the face, backs off a little on the rise
    let dist = h * ((2.4 - 1.1 * pushS) * (1 - pull) + 1.9 * pull);
    let lift = h * (-0.05 - 0.45 * pull);
    // swallowed: back off and down so the saucer closing over it reads
    const after = alive ? 0 : Math.min(1, (c.t - c.done) / 0.8);
    const afterS = after * after * (3 - 2 * after);
    dist += (h * 5 - dist) * afterS;
    lift += (-h * 2.6 - lift) * afterS;
    // the cone is right in front of the lens: dim it on the close-up
    g.beam.dim = alive ? 0.3 + 0.7 * pull : 1;
    c.yaw += dt * (0.22 + 0.3 * pull);
    let spot = this.faceSpot(_target, face, c.yaw, dist, lift);
    if (!this.clearView(spot, face)) {
      let found = false;
      for (const dd of [dist, dist * 0.7]) {
        for (let i = 1; i <= 12 && !found; i++) {
          for (const sign of [1, -1]) {
            const yaw = c.yaw + sign * i * (Math.PI / 12);
            if (this.clearView(this.faceSpot(_target, face, yaw, dd, lift), face)) {
              c.yaw = yaw;
              found = true;
              break;
            }
          }
        }
        if (found) break;
      }
      // boxed in: hug the face from as close as the lens allows
      if (!found) spot = this.faceSpot(_target, face, c.yaw, h * 0.9, lift);
      else spot = _target;
    }
    // handheld: a nervous shake on the close-up, steadier on the rise
    const shake = h * (0.022 * (1 - pull) + 0.008);
    const st = g.time.realElapsed;
    spot.x += Math.sin(st * 13.1) * Math.sin(st * 7.3) * shake;
    spot.y += Math.sin(st * 11.7 + 1.3) * shake;
    spot.z += Math.sin(st * 9.4 + 2.1) * Math.sin(st * 5.9) * shake;
    if (c.fresh) {
      c.spot.copy(spot);
      c.fresh = false;
    } else c.spot.lerp(spot, 1 - Math.exp(-(9 - 4 * pull) * dt));
    cam.position.copy(c.spot);
    g.abduction.cineClear = alive ? c.clear : null;
    // aim at the face; on the rise drift a little toward the hatch so the light shows above
    const u = g.ufo.position;
    _aim.copy(face).lerp(u, 0.05 * pull);
    if (!alive) _aim.lerp(u, Math.min(1, (c.t - c.done) * 0.8));
    cam.lookAt(_aim);
    cam.fov = 24 + 10 * pull + 10 * afterS;
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
    if (g.npcs.panicMeme === c.m.obj) g.npcs.panicMeme = null;
    g.beam.dim = 1;
    g.abduction.cineClear = null;
    this.layer.classList.remove('on', 'rise');
    const i = this.live.indexOf(c.m);
    if (i >= 0 && (!c.m.obj.alive || c.m.obj.state === AState.Absorbed)) {
      this.dispose(c.m);
      this.live.splice(i, 1);
    }
  }
}
