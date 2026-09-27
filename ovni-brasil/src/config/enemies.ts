/**
 * Força Sentinela de Defesa Aérea (fictional) + Patrulha Aurora (fictional city patrol).
 */
export type EnemyKind = 'police' | 'drone' | 'helicopter' | 'jet' | 'heavydrone' | 'boss';

export interface EnemyStats {
  kind: EnemyKind;
  name: string;
  hp: number;
  speed: number;
  /** Object def used when it gets abducted. */
  objectId: string;
  /** Tier required to abduct it when disabled (EMP/damaged). */
  disabledTier: number;
  fireInterval: number;
  burst: number;
  burstGap: number;
  bulletDamage: number;
  bulletSpeed: number;
  range: number;
  missileInterval?: number;
  missileDamage?: number;
  threatOnDestroy: number;
  scoreOnDestroy: number;
}

export const ENEMIES: Record<EnemyKind, EnemyStats> = {
  police: {
    kind: 'police',
    name: 'Viatura da Patrulha Aurora',
    hp: 30,
    speed: 13,
    objectId: 'viatura',
    disabledTier: 2,
    fireInterval: 2.6,
    burst: 3,
    burstGap: 0.16,
    bulletDamage: 1.6,
    bulletSpeed: 42,
    range: 46,
    threatOnDestroy: 3,
    scoreOnDestroy: 600,
  },
  drone: {
    kind: 'drone',
    name: 'Drone Sentinela',
    hp: 12,
    speed: 15,
    objectId: 'drone',
    disabledTier: 0,
    fireInterval: 2.1,
    burst: 2,
    burstGap: 0.2,
    bulletDamage: 2.4,
    bulletSpeed: 38,
    range: 34,
    threatOnDestroy: 4,
    scoreOnDestroy: 900,
  },
  heavydrone: {
    kind: 'heavydrone',
    name: 'Drone Pesado Sentinela-X',
    hp: 40,
    speed: 13,
    objectId: 'drone',
    disabledTier: 1,
    fireInterval: 2.6,
    burst: 4,
    burstGap: 0.12,
    bulletDamage: 2.8,
    bulletSpeed: 44,
    range: 44,
    missileInterval: 9,
    missileDamage: 12,
    threatOnDestroy: 8,
    scoreOnDestroy: 2500,
  },
  helicopter: {
    kind: 'helicopter',
    name: 'Helicóptero Beija-Flor',
    hp: 70,
    speed: 14,
    objectId: 'helicoptero',
    disabledTier: 2,
    fireInterval: 3.4,
    burst: 6,
    burstGap: 0.09,
    bulletDamage: 2.2,
    bulletSpeed: 48,
    range: 60,
    missileInterval: 8.5,
    missileDamage: 14,
    threatOnDestroy: 12,
    scoreOnDestroy: 5000,
  },
  jet: {
    kind: 'jet',
    name: 'Caça Carcará',
    hp: 60,
    speed: 62,
    objectId: 'jato',
    disabledTier: 3,
    fireInterval: 0.08,
    burst: 10,
    burstGap: 0.07,
    bulletDamage: 2.6,
    bulletSpeed: 110,
    range: 120,
    missileInterval: 5,
    missileDamage: 18,
    threatOnDestroy: 25,
    scoreOnDestroy: 12000,
  },
  boss: {
    kind: 'boss',
    name: 'Projeto Tucano Negro',
    hp: 100,
    speed: 30,
    objectId: 'tucano_negro',
    disabledTier: 0,
    fireInterval: 1.8,
    burst: 8,
    burstGap: 0.08,
    bulletDamage: 3,
    bulletSpeed: 70,
    range: 140,
    missileInterval: 6,
    missileDamage: 16,
    threatOnDestroy: 200,
    scoreOnDestroy: 250000,
  },
};

/** Max simultaneous enemies per alert level (0-6). */
export const ALERT_BUDGETS: ReadonlyArray<Partial<Record<EnemyKind, number>>> = [
  {},
  { police: 2 },
  { police: 2, drone: 2 },
  { police: 3, drone: 3, helicopter: 1 },
  { police: 2, drone: 3, helicopter: 2, jet: 1 },
  { police: 2, drone: 4, heavydrone: 2, helicopter: 2, jet: 2 },
  { police: 2, drone: 5, heavydrone: 3, helicopter: 3, jet: 3 },
];

/** Seconds between spawn attempts per kind. */
export const SPAWN_INTERVALS: Record<EnemyKind, number> = {
  police: 7,
  drone: 5,
  heavydrone: 11,
  helicopter: 16,
  jet: 18,
  boss: 9999,
};

export const MISSILE = {
  speed: 34,
  maxSpeed: 52,
  accel: 14,
  turnRate: 2.1,
  lifetime: 7.5,
  armTime: 0.35,
  hitRadius: 1.4,
  lockTime: 1.25,
  proximityFuse: 3.2,
  explosionRadius: 7,
};

export const ALERT_NAMES = [
  'CALMARIA',
  'PATRULHA ACIONADA',
  'DRONES NO AR',
  'PERSEGUIÇÃO AÉREA',
  'CAÇAS SENTINELA',
  'UNIDADES ESPECIAIS',
  'PROTOCOLO CÉU VERMELHO',
] as const;

export const BOSS = {
  spawnDelayAtMaxAlert: 28,
  shieldHp: 100,
  shieldRegenDelay: 10,
  shieldDownTime: 9,
  empShieldDamage: 60,
  missileShieldDamage: 34,
  missileHullDamage: 22,
  debrisDamage: 4,
  beamGripDps: 14,
  empPulseInterval: 17,
  empPulseRadius: 46,
  empDisableTime: 2.2,
  droneWaveInterval: 16,
  orbitRadius: 95,
  altitudeHigh: 70,
  altitudeLow: 20,
};
