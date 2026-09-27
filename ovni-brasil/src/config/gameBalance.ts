/**
 * All tunable numbers of the core loop live here so the game can be rebalanced
 * without touching gameplay code.
 */
export const BALANCE = {
  ufo: {
    /** Visual disc radius at scale 1 (meters). */
    baseRadius: 1.7,
    baseAltitude: 7.2,
    altitudeScaleExp: 0.9,
    /** Minimum clearance over rooftops, multiplied by UFO scale. */
    clearance: 3.2,
    baseSpeed: 10.5,
    speedScaleExp: 0.55,
    /** Higher = snappier velocity response. */
    acceleration: 5.2,
    deceleration: 3.6,
    maxTilt: 0.34,
    baseHull: 100,
    /** UFO scale = scaleBase ^ tierProgress (continuous tier from matter). */
    scaleBase: 1.215,
    maxScale: 9,
  },
  beam: {
    baseRadius: 1.95,
    baseCapacity: 3,
    /** Beam pull is stronger when hovering still: skill expression for heavy objects. */
    stillPowerBonus: 0.35,
    /** Horizontal speed (m/s at scale 1) above which the still bonus is gone. */
    stillSpeedThreshold: 2.2,
    /** Seconds of shaking before an object breaks free from the ground (scaled by tier). */
    breakBaseTime: 0.22,
    breakTimePerTier: 0.07,
    liftBaseTime: 0.95,
    liftTimePerTier: 0.11,
    suckTime: 0.24,
    /** Objects within this ring outside the beam react (anticipation). */
    anticipationRing: 1.9,
    maxAnticipating: 26,
    maxDynamicObjects: 90,
  },
  /**
   * Matter (XP) needed to reach each mass tier. Index = tier.
   * Designed around the target timeline: tier2 ~1:00, tier3 ~2:00, tier5 ~4:00, tier8 ~7:00.
   */
  tierMatterThresholds: [0, 0, 34, 95, 200, 390, 720, 1330, 2400, 4400, 8000, 14500],
  /** Matter given by an object of tier T = matterBase * matterGrowth^T * def.matterMult. */
  matterBase: 0.5,
  matterGrowth: 1.8,
  levels: {
    /** Cumulative XP to reach level L = a * (g^(L-1) - 1). */
    a: 30,
    g: 1.25,
    maxLevel: 60,
  },
  combo: {
    baseWindow: 2.4,
    windowPerTier: 0.12,
    maxWindow: 4.2,
    milestones: [5, 10, 20, 30, 50, 75, 100, 150, 200],
    frenzyAt: 50,
    frenzyEvery: 50,
    frenzyDuration: 8,
    /** Score multiplier per combo count. */
    multiplierPerCount: 0.05,
    maxMultiplier: 8,
    orbitFromCombo: 10,
  },
  frenzy: {
    powerBonusTiers: 0.8,
    radiusMult: 1.35,
    capacityBonus: 6,
    speedMult: 1.2,
    scaleMult: 1.12,
  },
  threat: {
    /** Threat gained per unit of matter. */
    perMatter: 0.9,
    perSecond: 0.12,
    perEnemyDestroyed: 6,
    /** Alert levels (0-6) threshold on accumulated threat. */
    alertThresholds: [0, 12, 24, 36, 520, 1150, 2100],
    heatZoneMult: 2,
  },
  extraction: {
    /** [time in seconds, multiplier]. Portal opens at the first entry. */
    tiers: [
      [300, 1],
      [420, 2],
      [540, 4],
      [720, 8],
    ] as ReadonlyArray<readonly [number, number]>,
    channelTime: 2.2,
    deathCoreShare: 0.35,
  },
  cores: {
    perSqrtMatter: 12,
    perDiscovery: 15,
    perEnemy: 4,
  },
  score: {
    /** Score = massKg^exp * combo * alert * risk * rarity. */
    massExp: 0.62,
    alertMultPerLevel: 0.25,
  },
  player: {
    invulnAfterHit: 0.35,
    shieldBase: 40,
    shieldRegenDelay: 3.2,
    shieldRegenRate: 9,
    shieldBrokenDelay: 6,
    empCooldown: 14,
    empRadius: 34,
    empChargeTime: 0.35,
    dashCooldown: 3.5,
    dashImpulse: 34,
    dashDuration: 0.28,
    perfectDodgeRadius: 5.5,
    perfectDodgeBuffTime: 1.2,
    perfectDodgePowerBonus: 0.25,
  },
  pacing: {
    /** Something new must happen at least this often (seconds). */
    noveltyInterval: 30,
    firstEventAt: 75,
    eventCooldown: 38,
  },
} as const;

export type Balance = typeof BALANCE;
