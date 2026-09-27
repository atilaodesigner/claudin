import { META_BY_ID, META_NODES, metaCost, type MetaNodeDef, type MetaNodeId } from '../config/meta';
import type { SaveService } from '../save/SaveService';

export type BuyResult = 'ok' | 'max' | 'locked' | 'cores';

/** Alien Cores economy between runs. */
export class MetaProgression {
  constructor(private readonly save: SaveService) {}

  get cores(): number {
    return this.save.get().cores;
  }

  level(id: MetaNodeId): number {
    return this.save.get().meta[id] ?? 0;
  }

  levels(): Partial<Record<MetaNodeId, number>> {
    return this.save.get().meta;
  }

  isUnlocked(node: MetaNodeDef): boolean {
    if (!node.requires) return true;
    return this.level(node.requires.id) >= node.requires.level;
  }

  nextCost(id: MetaNodeId): number | null {
    const node = META_BY_ID.get(id);
    if (!node) return null;
    const lvl = this.level(id);
    if (lvl >= node.maxLevel) return null;
    return metaCost(node, lvl);
  }

  canBuy(id: MetaNodeId): BuyResult {
    const node = META_BY_ID.get(id);
    if (!node) return 'locked';
    if (this.level(id) >= node.maxLevel) return 'max';
    if (!this.isUnlocked(node)) return 'locked';
    const cost = metaCost(node, this.level(id));
    return this.cores >= cost ? 'ok' : 'cores';
  }

  buy(id: MetaNodeId): BuyResult {
    const status = this.canBuy(id);
    if (status !== 'ok') return status;
    const node = META_BY_ID.get(id) as MetaNodeDef;
    const cost = metaCost(node, this.level(id));
    this.save.update((d) => {
      d.cores -= cost;
      d.meta[id] = (d.meta[id] ?? 0) + 1;
    }, true);
    return 'ok';
  }

  addCores(amount: number): void {
    const a = Math.max(0, Math.round(amount));
    this.save.update((d) => {
      d.cores += a;
      d.totalCoresEarned += a;
    });
  }

  /** Cheapest affordable-next goal, used by "FALTAM X ALIEN CORES" on the results screen. */
  nextGoal(): { node: MetaNodeDef; cost: number; missing: number; nextLevel: number } | null {
    let best: { node: MetaNodeDef; cost: number; missing: number; nextLevel: number } | null = null;
    for (const node of META_NODES) {
      if (!this.isUnlocked(node)) continue;
      const lvl = this.level(node.id);
      if (lvl >= node.maxLevel) continue;
      const cost = metaCost(node, lvl);
      const missing = Math.max(0, cost - this.cores);
      if (!best || missing < best.missing || (missing === best.missing && cost < best.cost)) {
        best = { node, cost, missing, nextLevel: lvl + 1 };
      }
    }
    return best;
  }
}
