import { Quaternion, Vector3 } from 'three';
import type { ModelInfo } from '../assets/ModelLibrary';
import type { DistrictId } from '../config/districts';
import type { EnemyKind } from '../config/enemies';
import type { ObjectDef, Rarity } from '../config/objects';

/** Fake-physics state machine of every abductable thing. */
export const enum AState {
  Static = 0,
  Anticipate = 1,
  Shaking = 2,
  Straining = 3,
  Lifting = 4,
  Orbiting = 5,
  Sucking = 6,
  Absorbed = 7,
  Carried = 8,
  Falling = 9,
  Settling = 10,
}

export type SlotKind = 'static' | 'living' | 'dynamic' | 'none';

export interface LivingLink {
  /** NPC / animal / traffic index in its system. */
  index: number;
  system: 'npc' | 'traffic' | 'enemy';
}

export class Abductable {
  readonly uid: number;
  /** Mutable: a pedestrian can be promoted to a meme character (story mode). */
  def: ObjectDef;
  readonly model: ModelInfo;
  rarity: Rarity;
  readonly district: DistrictId;
  paint: number;

  /** Rest transform (where it lives in the city). */
  readonly home = new Vector3();
  homeRotY = 0;
  scale = 1;

  /** Current simulated transform. */
  readonly pos = new Vector3();
  readonly vel = new Vector3();
  readonly quat = new Quaternion();
  readonly angVel = new Vector3();
  visualScale = 1;

  slot: SlotKind = 'none';
  batchId = -1;
  dynamicIndex = -1;
  /** Crowd character drawing this object (Tripo pedestrian), -1 = its own model. */
  crowd = -1;
  living: LivingLink | null = null;

  parent: Abductable | null = null;
  children: Abductable[] = [];
  /** Offset relative to the parent (in parent's local space at rest). */
  readonly localOffset = new Vector3();

  state: AState = AState.Static;
  stateTime = 0;
  /** 0..1 progress of the current phase. */
  progress = 0;
  phaseDuration = 1;
  /** Polar coords relative to beam center while lifting. */
  orbitAngle = 0;
  orbitRadius = 0;
  orbitSpeed = 0;
  startY = 0;
  liftHeight = 0;
  strain = 0;
  anticipation = 0;
  /** Index of the beam (0 = main, 1..n satellites) holding it. */
  beamIndex = 0;
  seed = 0;
  alive = true;
  /** Excluded from the heightfield (tiny props). */
  structural = false;
  /** Enemy wreck that can be abducted (EMP'd drone, falling jet...). */
  enemyKind: EnemyKind | null = null;
  enemyId = -1;
  /** Event bookkeeping (money truck, legendary spawn...). */
  eventTag: string | null = null;
  /** Transient flash intensity for dynamic meshes. */
  flash = 0;

  constructor(uid: number, def: ObjectDef, model: ModelInfo, rarity: Rarity, district: DistrictId, paint: number) {
    this.uid = uid;
    this.def = def;
    this.model = model;
    this.rarity = rarity;
    this.district = district;
    this.paint = paint;
    this.seed = ((uid * 2654435761) >>> 0) / 4294967296;
  }

  /** Disabled enemies (EMP) are easier to grab than their def says. */
  tierOverride: number | null = null;

  get tier(): number {
    return this.tierOverride ?? this.def.tier;
  }

  get isResting(): boolean {
    return this.state === AState.Static || this.state === AState.Anticipate;
  }

  get isCaptured(): boolean {
    return this.state === AState.Lifting || this.state === AState.Orbiting || this.state === AState.Sucking || this.state === AState.Carried;
  }

  setState(s: AState, duration = 1): void {
    this.state = s;
    this.stateTime = 0;
    this.progress = 0;
    this.phaseDuration = Math.max(0.0001, duration);
  }
}
