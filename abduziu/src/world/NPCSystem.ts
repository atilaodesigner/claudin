import { Matrix4, Quaternion, Vector3 } from 'three';
import { getObjectDef } from '../config/objects';
import type { ModelInfo } from '../assets/ModelLibrary';
import { clamp, dampAngle, TAU } from '../utils/math';
import { AState, type Abductable } from './Abductable';
import type { World } from './World';
import type { NpcKind, NpcSpawn, Persona } from './WorldGenerator';
import type { CrowdClip, CrowdClipName } from './crowd/CrowdAssets';
import type { CrowdRenderer } from './crowd/CrowdRenderer';

export const enum NpcState {
  Idle,
  Walking,
  Curious,
  LookingUp,
  Filming,
  Panic,
  Running,
  Hiding,
  Sitting,
  Playing,
  Gone,
}

interface Npc {
  obj: Abductable;
  kind: NpcKind;
  persona: Persona;
  state: NpcState;
  timer: number;
  x: number;
  z: number;
  y: number;
  heading: number;
  targetX: number;
  targetZ: number;
  spawnX: number;
  spawnZ: number;
  roam: number;
  speed: number;
  bob: number;
  batchId: number;
  armsUp: boolean;
  crouch: number;
  seed: number;
  dirty: boolean;
  hidden: boolean;
  /** Crowd character index (Tripo model), -1 = procedural person. */
  look: number;
  clip: CrowdClipName;
  animTime: number;
  /** Smoothed swim heading while carried by the beam. */
  swimYaw: number;
  lastX: number;
  lastZ: number;
}

const _m = new Matrix4();
const _q = new Quaternion();
const _p = new Vector3();
const _s = new Vector3();
const UP = new Vector3(0, 1, 0);
const FWD = new Vector3(0, 0, 1);
const _q2 = new Quaternion();
const _m2 = new Matrix4();
const _pivot = new Vector3();

const DEF_FOR: Record<NpcKind, string> = { person: 'pessoa', dog: 'cachorro', chicken: 'galinha', cow: 'vaca' };
/** Share of pedestrians that are one of the meme characters. */
const MEME_CHANCE = 0.07;

/**
 * City life. People film, point, run, hide or keep drinking their coffee; dogs bark
 * and chase the saucer; chickens peck; cows don't care. All in one batched draw call.
 */
export class NPCSystem {
  readonly npcs: Npc[] = [];
  private readonly personModel: ModelInfo;
  private readonly personUpModel: ModelInfo;
  private time = 0;
  private frame = 0;
  /** Beyond this distance NPCs are hidden and barely simulated. */
  detailDistance = 120;
  /** Reaction hooks for audio (bark, scream...). */
  onReact: ((kind: NpcKind, x: number, z: number, what: 'panic' | 'bark' | 'moo' | 'cluck') => void) | null = null;

  constructor(
    private readonly world: World,
    spawns: readonly NpcSpawn[],
    /** Tripo pedestrians; null keeps every person procedural. */
    private readonly crowd: CrowdRenderer | null = null,
  ) {
    this.personModel = world.lib.get('person');
    this.personUpModel = world.lib.get('person_up');
    for (const s of spawns) this.add(s);
    world.livingDetach = (obj) => this.onDetach(obj);
    const prevReattach = world.livingReattach;
    world.livingReattach = (obj) => (obj.living?.system === 'npc' ? this.onReattach(obj) : (prevReattach?.(obj) ?? false));
  }

  add(s: NpcSpawn): Npc {
    // people get a crowd character up front: a meme one is a different dex entry
    const look = s.kind === 'person' ? this.pickLook() : -1;
    const meme = look >= 0 ? this.crowd?.chars[look]?.meme : undefined;
    const def = getObjectDef(meme ?? DEF_FOR[s.kind]);
    const model = s.kind === 'person' ? this.personUpModel : this.world.lib.get(def.model);
    const obj = this.world.createObject(def, model.key, def.rarity ?? 'normal', s.district, s.kind === 'person' ? s.paint : 0xffffff);
    const y = this.world.groundAt(s.x, s.z);
    obj.home.set(s.x, y, s.z);
    obj.pos.copy(obj.home);
    obj.homeRotY = s.rotY;
    obj.slot = 'living';
    obj.living = { index: this.npcs.length, system: 'npc' };
    const renderModel = s.kind === 'person' ? this.personModel : model;
    const batchId = this.world.livingBatch.add(renderModel, s.x, y, s.z, s.rotY, 1, obj.paint);
    const npc: Npc = {
      obj,
      kind: s.kind,
      persona: s.persona,
      state: s.persona === 'sitter' ? NpcState.Sitting : s.persona === 'player' ? NpcState.Playing : NpcState.Idle,
      timer: Math.random() * 3,
      x: s.x,
      z: s.z,
      y,
      heading: s.rotY,
      targetX: s.x,
      targetZ: s.z,
      spawnX: s.x,
      spawnZ: s.z,
      roam: s.roam,
      speed: 0,
      bob: 0,
      batchId,
      armsUp: false,
      crouch: s.persona === 'sitter' ? 1 : 0,
      seed: Math.random(),
      dirty: true,
      hidden: false,
      look: -1,
      clip: 'afraid',
      animTime: Math.random() * 10,
      swimYaw: s.rotY,
      lastX: s.x,
      lastZ: s.z,
    };
    // drawn by the crowd renderer instead of the procedural person
    if (look >= 0) {
      npc.look = look;
      obj.crowd = look;
      this.world.livingBatch.setVisible(batchId, false);
    }
    this.world.hash.insert(obj.uid, s.x, s.z);
    this.npcs.push(npc);
    return npc;
  }

  /** Generic people most of the time; now and then one of the memes. -1 = procedural person. */
  private pickLook(): number {
    const chars = this.crowd?.chars ?? [];
    if (!chars.length) return -1;
    const memes: number[] = [];
    const people: number[] = [];
    chars.forEach((c, i) => (c.meme ? memes : people).push(i));
    const pool = memes.length && (!people.length || Math.random() < MEME_CHANCE) ? memes : people;
    return pool[Math.floor(Math.random() * pool.length)] as number;
  }

  private onDetach(obj: Abductable): void {
    if (obj.living?.system !== 'npc') return;
    const npc = this.npcs[obj.living.index];
    if (!npc) return;
    npc.state = NpcState.Gone;
    this.world.livingBatch.setVisible(npc.batchId, false);
  }

  private onReattach(obj: Abductable): boolean {
    const npc = obj.living ? this.npcs[obj.living.index] : undefined;
    if (!npc || !obj.alive) return false;
    npc.x = obj.pos.x;
    npc.z = obj.pos.z;
    npc.y = this.world.groundAt(npc.x, npc.z);
    npc.state = npc.kind === 'person' ? NpcState.Panic : NpcState.Running;
    npc.timer = 0.8;
    npc.crouch = 0;
    obj.slot = 'living';
    obj.state = AState.Static;
    this.world.livingBatch.setVisible(npc.batchId, npc.look < 0);
    npc.hidden = false;
    this.world.hash.insert(obj.uid, npc.x, npc.z);
    npc.dirty = true;
    return true;
  }

  update(dt: number, ufo: Vector3, ufoRadius: number, alert: number, focus: Vector3): void {
    this.time += dt;
    this.frame++;
    const aware = 16 + ufoRadius * 5 + alert * 3;
    const panicR = 8 + ufoRadius * 2.5;
    const batch = this.world.livingBatch;
    for (let i = 0; i < this.npcs.length; i++) {
      const n = this.npcs[i] as Npc;
      if (n.state === NpcState.Gone || !n.obj.alive) continue;
      const fdx = this.world.dx(focus.x, n.x);
      const fdz = this.world.dz(focus.z, n.z);
      const far = fdx * fdx + fdz * fdz > this.detailDistance * this.detailDistance;
      if (far !== n.hidden) {
        n.hidden = far;
        if (n.look < 0) batch.setVisible(n.batchId, !far);
      }
      if (far && (this.frame + i) % 8 !== 0) continue;
      const step = far ? dt * 6 : dt;
      const dx = n.x - ufo.x;
      const dz = n.z - ufo.z;
      const d = Math.hypot(dx, dz);
      this.think(n, step, d, dx, dz, aware, panicR);
      this.move(n, step);
      n.obj.home.set(n.x, n.y, n.z);
      n.obj.pos.copy(n.obj.home);
      n.obj.homeRotY = n.heading;
      this.world.hash.insert(n.obj.uid, n.x, n.z);
      // render (crowd characters are drawn by drawCrowd)
      if (n.look >= 0) continue;
      const person = n.kind === 'person';
      if (person) batch.setGeometry(n.batchId, n.armsUp ? this.personUpModel : this.personModel);
      const bobY = n.bob;
      _p.set(n.x, n.y + bobY, n.z);
      _q.setFromAxisAngle(UP, n.heading);
      const sy = 1 - n.crouch * 0.28;
      _s.set(1, sy, 1);
      if (n.state === NpcState.Panic) {
        _p.x += Math.sin(this.time * 40 + n.seed * 10) * 0.05;
      }
      _m.compose(_p, _q, _s);
      batch.setMatrix(n.batchId, _m);
    }
  }

  private think(n: Npc, dt: number, d: number, dx: number, dz: number, aware: number, panicR: number): void {
    n.timer -= dt;
    const person = n.kind === 'person';
    const awayAngle = Math.atan2(dx, dz);
    const faceUfo = Math.atan2(-dx, -dz);
    if (!person) {
      // animals
      if (n.kind === 'dog' && d < aware * 0.8) {
        if (n.state !== NpcState.Running || n.timer <= 0) {
          n.state = NpcState.Running;
          n.timer = 1.2 + Math.random();
          // dogs run around the UFO barking
          const a = awayAngle + (Math.random() - 0.5) * 2.4;
          const r = panicR * (0.8 + Math.random() * 0.6);
          n.targetX = n.x - dx + Math.sin(a) * r;
          n.targetZ = n.z - dz + Math.cos(a) * r;
          n.speed = 5.5;
          if (Math.random() < 0.5) this.onReact?.(n.kind, n.x, n.z, 'bark');
        }
        return;
      }
      if (n.kind === 'chicken' && d < panicR) {
        if (n.state !== NpcState.Running) {
          n.state = NpcState.Running;
          n.targetX = n.x + Math.sin(awayAngle) * 6;
          n.targetZ = n.z + Math.cos(awayAngle) * 6;
          n.speed = 4;
          n.timer = 1.5;
          if (Math.random() < 0.3) this.onReact?.(n.kind, n.x, n.z, 'cluck');
        }
        return;
      }
      if (n.kind === 'cow' && d < aware * 0.5 && Math.random() < dt * 0.15) this.onReact?.(n.kind, n.x, n.z, 'moo');
      this.wander(n, n.kind === 'cow' ? 0.6 : n.kind === 'chicken' ? 1.2 : 1.8);
      return;
    }

    const threatened = d < panicR;
    const seen = d < aware;
    switch (n.persona) {
      case 'calm':
        if (threatened && d < panicR * 0.6) this.flee(n, awayAngle, 3);
        else if (seen) {
          n.state = NpcState.LookingUp;
          n.heading = dampAngle(n.heading, faceUfo, 2, dt);
          n.armsUp = false;
        } else this.wander(n, 0.9);
        break;
      case 'sitter':
        if (threatened && d < panicR * 0.7) {
          n.crouch = 0;
          this.flee(n, awayAngle, 4.5);
        } else {
          n.state = NpcState.Sitting;
          n.crouch = 1;
          n.speed = 0;
          if (seen) n.heading = dampAngle(n.heading, faceUfo, 1.5, dt);
        }
        break;
      case 'filmer':
        if (threatened && d < panicR * 0.55) this.flee(n, awayAngle, 4.5);
        else if (seen) {
          n.state = NpcState.Filming;
          n.speed = 0;
          n.armsUp = true;
          n.crouch = 0;
          n.heading = dampAngle(n.heading, faceUfo, 4, dt);
        } else {
          n.armsUp = false;
          this.wander(n, 1.2);
        }
        break;
      case 'pointer':
        if (threatened) this.flee(n, awayAngle, 5);
        else if (seen) {
          n.state = NpcState.Curious;
          n.speed = 0;
          n.armsUp = Math.sin(this.time * 3 + n.seed * 10) > -0.2;
          n.bob = Math.max(0, Math.sin(this.time * 7 + n.seed * 10)) * 0.25;
          n.heading = dampAngle(n.heading, faceUfo, 4, dt);
        } else {
          n.armsUp = false;
          n.bob = 0;
          this.wander(n, 1.2);
        }
        break;
      case 'player':
        if (threatened || (seen && Math.random() < dt * 0.3)) this.flee(n, awayAngle, 5);
        else {
          n.state = NpcState.Playing;
          if (n.timer <= 0) {
            n.timer = 0.8 + Math.random() * 1.5;
            n.targetX = n.spawnX + (Math.random() - 0.5) * 16;
            n.targetZ = n.spawnZ + (Math.random() - 0.5) * 24;
            n.speed = 3.5 + Math.random() * 2;
          }
        }
        break;
      default:
        // runner / dancer
        if (seen && (threatened || n.state === NpcState.Running || n.state === NpcState.Panic)) {
          if (n.state !== NpcState.Running && n.state !== NpcState.Panic) {
            n.state = NpcState.Panic;
            n.timer = 0.35 + Math.random() * 0.4;
            n.armsUp = true;
            this.onReact?.(n.kind, n.x, n.z, 'panic');
          } else if (n.state === NpcState.Panic && n.timer <= 0) this.flee(n, awayAngle, 5.5);
          else if (n.state === NpcState.Running) this.flee(n, awayAngle, 5.5);
        } else if (n.state === NpcState.Running && !seen) {
          n.state = NpcState.Hiding;
          n.timer = 3 + Math.random() * 4;
          n.speed = 0;
          n.crouch = 1;
          n.armsUp = false;
        } else if (n.state === NpcState.Hiding) {
          if (n.timer <= 0) {
            n.crouch = 0;
            n.state = NpcState.Idle;
          }
        } else if (seen) {
          n.state = NpcState.LookingUp;
          n.speed = 0;
          n.heading = dampAngle(n.heading, faceUfo, 3, dt);
        } else this.wander(n, 1.3);
    }
  }

  private flee(n: Npc, awayAngle: number, speed: number): void {
    n.state = NpcState.Running;
    n.armsUp = true;
    n.crouch = 0;
    const jitter = Math.sin(this.time * 1.3 + n.seed * 20) * 0.6;
    n.targetX = n.x + Math.sin(awayAngle + jitter) * 10;
    n.targetZ = n.z + Math.cos(awayAngle + jitter) * 10;
    n.speed = speed;
  }

  private wander(n: Npc, speed: number): void {
    if (n.state !== NpcState.Walking && n.state !== NpcState.Idle) {
      n.state = NpcState.Idle;
      n.armsUp = false;
      n.bob = 0;
    }
    if (n.timer <= 0) {
      if (n.state === NpcState.Idle && n.roam > 0.5) {
        const a = Math.random() * TAU;
        const r = Math.random() * n.roam;
        n.targetX = n.spawnX + Math.cos(a) * r;
        n.targetZ = n.spawnZ + Math.sin(a) * r;
        n.state = NpcState.Walking;
        n.speed = speed;
        n.timer = 3 + Math.random() * 4;
      } else {
        n.state = NpcState.Idle;
        n.speed = 0;
        n.timer = 1 + Math.random() * 3;
      }
    }
  }

  private move(n: Npc, dt: number): void {
    if (n.speed <= 0) {
      if (n.state !== NpcState.Curious) n.bob *= 0.8;
      return;
    }
    const dx = n.targetX - n.x;
    const dz = n.targetZ - n.z;
    const dist = Math.hypot(dx, dz);
    if (dist < 0.3) {
      if (n.state === NpcState.Walking) {
        n.state = NpcState.Idle;
        n.speed = 0;
      }
      return;
    }
    const step = Math.min(dist, n.speed * dt);
    n.x += (dx / dist) * step;
    n.z += (dz / dist) * step;
    // keep inside the city
    const b = this.world.bounds;
    n.x = clamp(n.x, b.minX + 5, b.maxX - 5);
    n.z = clamp(n.z, b.minZ + 5, b.maxZ - 5);
    n.y = this.world.groundAt(n.x, n.z);
    n.heading = dampAngle(n.heading, Math.atan2(dx, dz), 10, dt);
    const freq = n.kind === 'chicken' ? 18 : n.speed > 3 ? 14 : 8;
    n.bob = Math.abs(Math.sin(this.time * freq + n.seed * 7)) * (n.kind === 'person' ? 0.14 : 0.08) * Math.min(1, n.speed / 2);
  }

  /**
   * Feeds the crowd renderer: pedestrians on the ground pick a clip from their state; the ones the
   * beam carries swim on their back (belly to the sky) around it.
   * @param rimOf abduction glow of a carried object
   */
  drawCrowd(dt: number, camera: Vector3, rimOf: (o: Abductable) => number): void {
    const cr = this.crowd;
    if (!cr) return;
    cr.begin();
    for (let i = 0; i < this.npcs.length; i++) {
      const n = this.npcs[i] as Npc;
      if (n.look < 0) continue;
      const ch = cr.chars[n.look];
      if (!ch) continue;
      const o = n.obj;
      if (n.state === NpcState.Gone) {
        if (!o.alive || o.dynamicIndex < 0 || o.state === AState.Absorbed) continue;
        this.drawCarried(n, ch.clips, ch.height, dt, camera, rimOf(o));
        continue;
      }
      if (n.hidden) continue;
      let name: CrowdClipName = 'afraid';
      let rate = 0.3;
      const run = ch.clips.run;
      switch (n.state) {
        case NpcState.Walking:
          name = 'run';
          rate = clamp(n.speed / run.speed, 0.55, 1.8);
          break;
        case NpcState.Running:
          name = 'run';
          rate = clamp(n.speed / run.speed, 0.85, 1.8);
          break;
        case NpcState.Panic:
          name = 'freaky';
          rate = 1.15;
          break;
        case NpcState.Hiding:
          name = 'afraid';
          rate = 1.3;
          break;
        case NpcState.Curious:
        case NpcState.LookingUp:
        case NpcState.Filming:
          name = 'afraid';
          rate = 0.8;
          break;
        default:
          name = 'afraid';
          rate = 0.3;
      }
      if (n.speed <= 0 && name === 'run') {
        name = 'afraid';
        rate = 0.5;
      }
      n.clip = name;
      n.animTime += dt * rate;
      _p.set(n.x, n.y, n.z);
      _q.setFromAxisAngle(UP, n.heading);
      _s.set(1, 1, 1);
      _m.compose(_p, _q, _s);
      const far = (n.x - camera.x) ** 2 + (n.z - camera.z) ** 2 > 30 * 30;
      cr.add(n.look, _m, ch.clips[name], n.animTime, far);
    }
    cr.end();
  }

  /** Carried by the beam: swimming on its back, facing along its path around the beam. */
  private drawCarried(n: Npc, clips: Record<CrowdClipName, CrowdClip>, height: number, dt: number, camera: Vector3, rim: number): void {
    const o = n.obj;
    const cr = this.crowd as CrowdRenderer;
    const scale = o.visualScale;
    const dx = o.pos.x - n.lastX;
    const dz = o.pos.z - n.lastZ;
    n.lastX = o.pos.x;
    n.lastZ = o.pos.z;
    if (dx * dx + dz * dz > 1e-6) n.swimYaw = dampAngle(n.swimYaw, Math.atan2(dx, dz), 4, dt);
    const shaking = o.state === AState.Anticipate || o.state === AState.Shaking || o.state === AState.Straining;
    // dropped and back on the ground: on its feet again, shaking
    const landed = o.state === AState.Settling;
    const upright = shaking || landed;
    const clip = shaking ? clips.freaky : landed ? clips.afraid : clips.swim;
    n.animTime += dt * (shaking ? 1.4 : landed ? 1.3 : 1);
    if (upright) {
      // still on its feet, freaking out under the beam
      _p.copy(o.pos);
      _q.setFromAxisAngle(UP, n.heading);
      _s.setScalar(scale);
      _m.compose(_p, _q, _s);
    } else {
      // belly to the sky (baked that way; older assets get rolled half a turn), head along its path, lazy sway
      const sway = Math.sin(n.animTime * 2.1 + n.seed * 9) * 0.18;
      _q.setFromAxisAngle(UP, n.swimYaw);
      _q2.setFromAxisAngle(FWD, (clip.bellyUp ? 0 : Math.PI) + sway);
      _q.multiply(_q2);
      const pv = clip.pivot;
      _pivot.set(-pv[0], -pv[1], -pv[2]);
      // centre of the carried object (its pivot sits at the feet)
      _p.set(o.pos.x, o.pos.y + height * 0.5 * scale, o.pos.z);
      _s.setScalar(scale);
      _m.compose(_p, _q, _s);
      _m.multiply(_m2.makeTranslation(_pivot.x, _pivot.y, _pivot.z));
    }
    const far = (o.pos.x - camera.x) ** 2 + (o.pos.z - camera.z) ** 2 > 30 * 30;
    cr.add(n.look, _m, clip, n.animTime, far, rim);
  }

  get activeCount(): number {
    let c = 0;
    for (const n of this.npcs) if (n.state !== NpcState.Gone && n.obj.alive) c++;
    return c;
  }
}
