import { SYNERGIES, type SynergyId, type UpgradeId } from '../config/upgrades';

/** Returns synergies whose requirements are met and that are not owned yet. */
export function findNewSynergies(levels: ReadonlyMap<UpgradeId, number>, owned: ReadonlySet<SynergyId>): SynergyId[] {
  const result: SynergyId[] = [];
  for (const syn of SYNERGIES) {
    if (owned.has(syn.id)) continue;
    let ok = true;
    for (const [id, need] of Object.entries(syn.requires) as [UpgradeId, number][]) {
      if ((levels.get(id) ?? 0) < need) {
        ok = false;
        break;
      }
    }
    if (ok) result.push(syn.id);
  }
  return result;
}

/** How close a synergy is (0..1) — used to hint players in the card screen. */
export function synergyProgress(synergyId: SynergyId, levels: ReadonlyMap<UpgradeId, number>): number {
  const syn = SYNERGIES.find((s) => s.id === synergyId);
  if (!syn) return 0;
  let have = 0;
  let need = 0;
  for (const [id, lvl] of Object.entries(syn.requires) as [UpgradeId, number][]) {
    need += lvl;
    have += Math.min(lvl, levels.get(id) ?? 0);
  }
  return need > 0 ? have / need : 0;
}
