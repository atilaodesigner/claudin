import { BALANCE } from '../config/gameBalance';

const { a, g, maxLevel } = BALANCE.levels;

/** Cumulative Alien Matter required to reach `level` (level 1 = 0). */
export function xpForLevel(level: number): number {
  if (level <= 1) return 0;
  return a * (Math.pow(g, level - 1) - 1);
}

export function levelFromXp(xp: number): number {
  if (xp <= 0) return 1;
  const l = Math.floor(Math.log(xp / a + 1) / Math.log(g)) + 1;
  // guard against floating point drift at exact thresholds
  let level = Math.min(Math.max(1, l), maxLevel);
  while (level < maxLevel && xpForLevel(level + 1) <= xp + 1e-9) level++;
  while (level > 1 && xpForLevel(level) > xp + 1e-9) level--;
  return level;
}

/** Matter yielded by an object of a given tier. */
export function matterForTier(tier: number, mult = 1): number {
  return BALANCE.matterBase * Math.pow(BALANCE.matterGrowth, tier) * mult;
}

/**
 * Continuous mass tier reached with the given total matter. Tier 1 at zero matter
 * (the UFO starts able to lift tiers 0 and 1).
 */
export function tierFromMatter(matter: number): number {
  const th = BALANCE.tierMatterThresholds;
  if (matter <= 0) return 1;
  for (let t = 1; t < th.length - 1; t++) {
    const lo = th[t] as number;
    const hi = th[t + 1] as number;
    if (matter < hi) return t + (matter - lo) / (hi - lo);
  }
  // extrapolate beyond the table with the same growth ratio
  const last = th.length - 1;
  const lastTh = th[last] as number;
  const ratio = lastTh / (th[last - 1] as number);
  return last + Math.log(matter / lastTh) / Math.log(ratio);
}

/** Matter needed to reach an integer tier. */
export function matterForTierThreshold(tier: number): number {
  const th = BALANCE.tierMatterThresholds;
  if (tier <= 1) return 0;
  if (tier < th.length) return th[tier] as number;
  const last = th.length - 1;
  const ratio = (th[last] as number) / (th[last - 1] as number);
  return (th[last] as number) * Math.pow(ratio, tier - last);
}

export class RunProgression {
  matter = 0;
  level = 1;
  /** Level-ups waiting for a card choice. */
  pendingLevelUps = 0;

  reset(): void {
    this.matter = 0;
    this.level = 1;
    this.pendingLevelUps = 0;
  }

  /** Returns how many levels were gained. */
  addMatter(amount: number): number {
    if (amount <= 0) return 0;
    this.matter += amount;
    const newLevel = levelFromXp(this.matter);
    const gained = newLevel - this.level;
    if (gained > 0) {
      this.level = newLevel;
      this.pendingLevelUps += gained;
    }
    return Math.max(0, gained);
  }

  get levelProgress(): number {
    const lo = xpForLevel(this.level);
    const hi = xpForLevel(this.level + 1);
    return hi > lo ? (this.matter - lo) / (hi - lo) : 1;
  }

  get tier(): number {
    return tierFromMatter(this.matter);
  }
}
