import { UPGRADES, UPGRADE_BY_ID, SYNERGIES, type SynergyId, type UpgradeDef, type UpgradeId } from '../config/upgrades';
import type { Rng } from '../utils/rng';
import { findNewSynergies } from './SynergySystem';

export interface UpgradeOffer {
  id: UpgradeId;
  def: UpgradeDef;
  nextLevel: number;
  /** Enhanced cards grant two levels at once. */
  enhanced: boolean;
  /** Synergy this card would help complete, if any. */
  synergyHint: SynergyId | null;
}

export class UpgradeSystem {
  readonly levels = new Map<UpgradeId, number>();
  readonly synergies = new Set<SynergyId>();
  /** Incremented every time something changes so stats can be cached. */
  version = 0;

  reset(): void {
    this.levels.clear();
    this.synergies.clear();
    this.version++;
  }

  level(id: UpgradeId): number {
    return this.levels.get(id) ?? 0;
  }

  has(id: SynergyId): boolean {
    return this.synergies.has(id);
  }

  rollOffers(rng: Rng, playerLevel: number, count = 3, enhancedChance = 0.08): UpgradeOffer[] {
    const pool = UPGRADES.filter((u) => this.level(u.id) < u.maxLevel && (u.minPlayerLevel ?? 0) <= playerLevel);
    const offers: UpgradeOffer[] = [];
    const candidates = pool.map((u) => ({ item: u, weight: this.weightFor(u) }));
    while (offers.length < count && candidates.length > 0) {
      const def = rng.weighted(candidates);
      const idx = candidates.findIndex((c) => c.item === def);
      candidates.splice(idx, 1);
      const current = this.level(def.id);
      const enhanced = current + 2 <= def.maxLevel && rng.chance(enhancedChance);
      offers.push({ id: def.id, def, nextLevel: current + 1, enhanced, synergyHint: this.synergyHintFor(def.id) });
    }
    return offers;
  }

  /** Cards that push towards a synergy (or already owned lines) are a bit more likely. */
  private weightFor(u: UpgradeDef): number {
    let w = u.weight;
    const lvl = this.level(u.id);
    if (lvl > 0) w *= 1.25;
    if (this.synergyHintFor(u.id)) w *= 1.35;
    return w;
  }

  private synergyHintFor(id: UpgradeId): SynergyId | null {
    for (const syn of SYNERGIES) {
      if (this.synergies.has(syn.id)) continue;
      const need = syn.requires[id];
      if (need === undefined || this.level(id) >= need) continue;
      // only hint when the player already invested in another part of it
      const others = Object.entries(syn.requires).filter(([k]) => k !== id);
      if (others.some(([k]) => this.level(k as UpgradeId) > 0)) return syn.id;
    }
    return null;
  }

  apply(offer: Pick<UpgradeOffer, 'id' | 'enhanced'>): { level: number; newSynergies: SynergyId[] } {
    const def = UPGRADE_BY_ID.get(offer.id);
    if (!def) throw new Error(`Unknown upgrade ${offer.id}`);
    const next = Math.min(def.maxLevel, this.level(offer.id) + (offer.enhanced ? 2 : 1));
    this.levels.set(offer.id, next);
    const newSynergies = findNewSynergies(this.levels, this.synergies);
    for (const s of newSynergies) this.synergies.add(s);
    this.version++;
    return { level: next, newSynergies };
  }

  /** Debug helper. */
  maxAll(): void {
    for (const u of UPGRADES) this.levels.set(u.id, u.maxLevel);
    for (const s of findNewSynergies(this.levels, this.synergies)) this.synergies.add(s);
    this.version++;
  }
}
