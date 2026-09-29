import type * as THREE from 'three';
import type { CarPhysics } from '../physics/car';
import type { AudioSystem as Audio } from '../audio/audio';
import type { ApplyResult, ChapterDef, CarDef, SaveStore, Summary } from './core.js';
import type { Route } from './routes';
import type { MissionHud } from './missionHud';

export interface MissionResult {
  win: boolean;
  why: string;
  title: string;
  sub: string;
  res: Summary & { win: boolean };
  ap: ApplyResult;
  stars: boolean[];
  chapter: ChapterDef;
  index: number;
}

export interface MissionHost {
  scene: THREE.Scene;
  car: CarPhysics;
  audio: Audio;
  hud: MissionHud;
  save: SaveStore;
  playerRoot(): THREE.Object3D;
  playerBody(): THREE.Object3D;
  playerDims(): { wid: number; len: number; hgt: number };
  /** parâmetros do carro quando não é um dos três do bonde (o Mustang) */
  playerStats(): Partial<CarDef>;
  carKey(): string;
  reduceFx(): boolean;
  quality(): number;
  touch(): boolean;
  input(): { throttle: number; handbrake: boolean };
  onResult(r: MissionResult): void;
}

export interface Mission {
  readonly state: 'idle' | 'intro' | 'play' | 'cinematic' | 'result';
  readonly chapterIndex: number;
  readonly player: { s: number; x: number; v: number; life: number; maxLife: number; dead: boolean };
  shake: number;
  readonly fovKick: number;
  timeScale(realDt: number): number;
  controls(): boolean;
  start(idx: number, route: Route): void;
  contact(impact: number, src: string): void;
  step(dt: number, camera: THREE.Camera): void;
  cameraTarget(outPos: THREE.Vector3, outLook: THREE.Vector3): boolean;
  playerLift(): { lift: number; roll: number };
  end(): void;
}

export const RESULT_TEXT: Record<string, [string, string]>;
export function createMission(host: MissionHost): Mission;
