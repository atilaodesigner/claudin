import { CAMPAIGN, type CityDef, type CityId } from '../config/cities';
import type { CityProgress } from '../save/SaveService';

/**
 * Campaign rules (pure): cities unlock in order, each needs one extraction in the
 * previous city. Stars are kept per slot, so a run only has to improve on missing ones.
 */
export const CAMPAIGN_RULES = {
  coresPerNewStar: 40,
  clearBonus: 60,
} as const;

export function emptyProgress(): CityProgress {
  return { stars: [false, false, false], bestScore: 0, clears: 0, plays: 0 };
}

export function isUnlocked(progress: Readonly<Record<string, CityProgress>>, id: CityId): boolean {
  const i = CAMPAIGN.findIndex((c) => c.id === id);
  if (i <= 0) return true;
  const prev = CAMPAIGN[i - 1] as CityDef;
  return (progress[prev.id]?.clears ?? 0) > 0;
}

export function starCount(p: CityProgress | undefined): number {
  return p ? p.stars.filter(Boolean).length : 0;
}

export function totalStars(progress: Readonly<Record<string, CityProgress>>): number {
  return CAMPAIGN.reduce((s, c) => s + starCount(progress[c.id]), 0);
}

export function citiesUnlocked(progress: Readonly<Record<string, CityProgress>>): number {
  return CAMPAIGN.filter((c) => isUnlocked(progress, c.id)).length;
}

export interface CampaignRunResult {
  progress: CityProgress;
  newStars: number;
  firstClear: boolean;
  /** City that became available thanks to this run. */
  unlocked: CityDef | null;
  bonusCores: number;
}

export function applyCampaignRun(
  all: Readonly<Record<string, CityProgress>>,
  city: CityId,
  starsNow: readonly boolean[],
  score: number,
  extracted: boolean,
): CampaignRunResult {
  const prev = all[city] ?? emptyProgress();
  const stars: [boolean, boolean, boolean] = [prev.stars[0] || !!starsNow[0], prev.stars[1] || !!starsNow[1], prev.stars[2] || !!starsNow[2]];
  const newStars = stars.filter(Boolean).length - starCount(prev);
  const firstClear = extracted && prev.clears === 0;
  const progress: CityProgress = {
    stars,
    bestScore: Math.max(prev.bestScore, score),
    clears: prev.clears + (extracted ? 1 : 0),
    plays: prev.plays + 1,
  };
  let unlocked: CityDef | null = null;
  if (firstClear) {
    const i = CAMPAIGN.findIndex((c) => c.id === city);
    unlocked = CAMPAIGN[i + 1] ?? null;
  }
  const bonusCores = newStars * CAMPAIGN_RULES.coresPerNewStar + (firstClear ? CAMPAIGN_RULES.clearBonus : 0);
  return { progress, newStars, firstClear, unlocked, bonusCores };
}
