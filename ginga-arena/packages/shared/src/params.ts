/**
 * Every tuning number of the simulation lives here (PLANO.md §3.10).
 * Nothing in this file may depend on graphics quality, device or latency.
 * Changing any value changes SIM_VERSION, so client and server must ship together.
 */

export const TICK_HZ = 60;
export const DT = 1 / TICK_HZ;

export const COURT = {
  /** Net → baseline, per side (1v1). */
  half: 6.5,
  /** Free zone past the baseline where players may still play the ball. */
  freeZone: 3.0,
  netTop: 2.2,
  /** Half thickness of the (solid) net collider. */
  netHalf: 0.05,
  /** Players can't get closer than this to the net plane. */
  netGap: 0.3,
} as const;

export const BALL = {
  radius: 0.12,
  gravity: 11,
  maxSpeed: 22,
  maxLaunchVy: 11,
  damping: 0.02,
  restitutionGround: 0.4,
  restitutionNet: 0.25,
  /** Below this speed for `stuckTicks` without touching the sand → rally void. */
  stuckSpeed: 0.2,
  stuckTicks: 60,
} as const;

export const PLAYER = {
  runSpeed: 5.5,
  accelGround: 45,
  decelGround: 60,
  accelAir: 20,
  jumpSpeed: 7.0,
  gravity: 22,
  jumpSquat: 2,
  jumpBuffer: 4,
  landLag: 3,
  /** Ground speed multiplier while an action is running / while recovering. */
  moveInAction: 0.35,
  moveInRecovery: 0.3,
  height: 1.8,
} as const;

export const CONTACT = {
  /** Contact volume relative to the feet, +x toward the net. */
  back: 0.45,
  front: 0.85,
  top: 2.05,
  /** Fixed tolerance added to the volume (never scales with anything). */
  grace: 0.12,
  /** Ideal horizontal contact point, in front of the body. */
  ideal: 0.3,
  perfect: 0.25,
  perfectFast: 0.18,
  good: 0.5,
  fastBall: 14,
  /** Same player can't touch again for this many ticks. */
  cooldown: 10,
  /** Action press buffer. */
  buffer: 6,
  /** Timing error → horizontal speed change (±14 %). */
  errorGain: 0.14,
} as const;

/** Body-part bands by ball height above the feet (m). */
export const PARTS = { foot: 0.55, thigh: 1.05, chest: 1.55 } as const;

export interface ActionTiming {
  startup: number;
  active: number;
  recover: number;
  whiff: number;
}

/** Action windows in ticks (PLANO.md §3.5). Air actions recover on landing (+ recover/whiff). */
export const TIMING = {
  touchGround: { startup: 3, active: 7, recover: 10, whiff: 16 },
  touchAir: { startup: 2, active: 6, recover: 4, whiff: 8 },
  attackGround: { startup: 6, active: 4, recover: 16, whiff: 24 },
  attackAir: { startup: 5, active: 4, recover: 8, whiff: 12 },
  serve: { startup: 12, active: 1, recover: 20, whiff: 20 },
} as const satisfies Record<string, ActionTiming>;

export const SHOT = {
  /** Set apex and the height where the setter wants the ball back. */
  setApex: 3.2,
  setChestDrop: 0.4,
  setReturn: 1.0,
  setForward: 0.6,
  setFront: 1.5,
  setBack: -1.0,
  /** Closest a set may land to the net. */
  setNetMin: 0.9,
  lobApex: 4.0,
  serveApex: 4.6,
  netMargin: 0.15,
  /** Attack horizontal speed by contact type (m/s). */
  attackKick: 10,
  attackVolley: 12,
  attackHead: 13,
  attackAirFoot: 16,
  attackAirHead: 15,
  /** Depth targets on the opponent side (m from the net). */
  depthShort: 1.6,
  depthMid: 0.55, // × half
  depthDeepFromBase: 0.7,
} as const;

export const MATCH = {
  target: 7,
  winBy: 2,
  cap: 11,
  maxTouches: 3,
  countdown: 180,
  prep: 72,
  serveWindow: 300,
  pending: 6,
  point: 90,
  void: 60,
  resume: 180,
  rallyMax: 3600,
  reconnectSeconds: 15,
  maxDrops: 3,
  maxPauseTicks: 45 * 60,
} as const;
