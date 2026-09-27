import { BALANCE } from '../config/gameBalance';

export interface ScoreInput {
  massKg: number;
  comboMultiplier: number;
  alert: number;
  riskMultiplier: number;
  rarityMultiplier: number;
}

/** Score = mass × combo × alert × risk × rarity (mass is compressed so buildings don't dwarf everything). */
export function objectScore(i: ScoreInput): number {
  const mass = Math.pow(Math.max(0.1, i.massKg), BALANCE.score.massExp) * 10;
  const alert = 1 + i.alert * BALANCE.score.alertMultPerLevel;
  return Math.round(mass * i.comboMultiplier * alert * i.riskMultiplier * i.rarityMultiplier);
}

/** Extraction multiplier currently offered (0 = portal not open yet). */
export function extractionMultiplierAt(runTime: number): number {
  let mult = 0;
  for (const [t, m] of BALANCE.extraction.tiers) {
    if (runTime >= t) mult = m;
  }
  return mult;
}

export function nextExtractionTier(runTime: number): { time: number; multiplier: number } | null {
  for (const [t, m] of BALANCE.extraction.tiers) {
    if (runTime < t) return { time: t, multiplier: m };
  }
  return null;
}

export interface CoreInput {
  matter: number;
  discoveries: number;
  enemiesDestroyed: number;
  challengeRewards: number;
  extracted: boolean;
  extractionMultiplier: number;
  metaCoreBonus: number;
  bonusCores: number;
}

export function computeCores(i: CoreInput): { base: number; total: number; multiplier: number } {
  const C = BALANCE.cores;
  const base =
    C.perSqrtMatter * Math.sqrt(Math.max(0, i.matter)) +
    i.discoveries * C.perDiscovery +
    i.enemiesDestroyed * C.perEnemy +
    i.challengeRewards +
    i.bonusCores;
  const multiplier = i.extracted ? Math.max(1, i.extractionMultiplier) : BALANCE.extraction.deathCoreShare;
  const total = Math.round(base * multiplier * (1 + i.metaCoreBonus));
  return { base: Math.round(base), total, multiplier };
}
