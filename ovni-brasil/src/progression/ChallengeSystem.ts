import { CHALLENGES, type ChallengeKind, type ChallengeTemplate } from '../config/challenges';
import type { Rng } from '../utils/rng';

export interface ActiveChallenge {
  template: ChallengeTemplate;
  kind: ChallengeKind;
  title: string;
  goal: number;
  progress: number;
  done: boolean;
  reward: number;
}

/** Three secondary objectives per run. Pure logic: the game feeds it facts. */
export class ChallengeSystem {
  active: ActiveChallenge[] = [];
  private noDamageStreak = 0;
  onComplete: ((index: number, c: ActiveChallenge) => void) | null = null;
  onProgress: ((index: number, c: ActiveChallenge) => void) | null = null;

  roll(rng: Rng, count = 3): void {
    this.noDamageStreak = 0;
    const pool = CHALLENGES.map((t) => ({ item: t, weight: t.weight }));
    const picked: ChallengeTemplate[] = [];
    const usedKinds = new Set<string>();
    while (picked.length < count && pool.length > 0) {
      const t = rng.weighted(pool);
      pool.splice(pool.findIndex((p) => p.item === t), 1);
      const key = t.kind + (t.tag ?? '') + (t.enemy ?? '');
      if (usedKinds.has(t.kind) && t.kind !== 'abduct_tag') continue;
      if (usedKinds.has(key)) continue;
      usedKinds.add(t.kind);
      usedKinds.add(key);
      picked.push(t);
    }
    this.active = picked.map((t) => {
      const goal = rng.pick(t.goals);
      return { template: t, kind: t.kind, title: t.title(goal), goal, progress: 0, done: false, reward: t.reward + Math.round(goal > 1 ? Math.log2(goal) * 8 : 0) };
    });
  }

  private bump(pred: (c: ActiveChallenge) => boolean, value: number, mode: 'add' | 'max'): void {
    this.active.forEach((c, i) => {
      if (c.done || !pred(c)) return;
      const before = c.progress;
      c.progress = mode === 'add' ? c.progress + value : Math.max(c.progress, value);
      if (c.progress === before) return;
      if (c.progress >= c.goal) {
        c.progress = c.goal;
        c.done = true;
        this.onComplete?.(i, c);
      } else {
        this.onProgress?.(i, c);
      }
    });
  }

  onAbduct(tags: readonly string[], massKg: number): void {
    this.bump((c) => c.kind === 'abduct_tag' && c.template.tag !== undefined && tags.includes(c.template.tag), 1, 'add');
    this.bump((c) => c.kind === 'abduct_count', 1, 'add');
    this.bump((c) => c.kind === 'mass_tons', massKg / 1000, 'add');
    if (tags.includes('radar')) this.bump((c) => c.kind === 'abduct_radar', 1, 'add');
    if (tags.includes('jato')) this.bump((c) => c.kind === 'capture_jet', 1, 'add');
    this.noDamageStreak++;
    this.bump((c) => c.kind === 'no_damage_streak', this.noDamageStreak, 'max');
  }

  onDamage(): void {
    this.noDamageStreak = 0;
  }

  onEnemyDestroyed(kind: string): void {
    this.bump((c) => c.kind === 'destroy_enemy' && c.template.enemy === kind, 1, 'add');
  }

  onCombo(count: number): void {
    this.bump((c) => c.kind === 'combo', count, 'max');
  }

  onAlert(level: number): void {
    this.bump((c) => c.kind === 'reach_alert', level, 'max');
  }

  onMaxAlertTime(seconds: number): void {
    this.bump((c) => c.kind === 'survive_max_alert', Math.floor(seconds), 'max');
  }

  onPerfectDodge(): void {
    this.bump((c) => c.kind === 'perfect_dodge', 1, 'add');
  }

  onRadarDestroyed(): void {
    this.bump((c) => c.kind === 'abduct_radar', 1, 'add');
  }

  get completedRewards(): number {
    return this.active.filter((c) => c.done).reduce((s, c) => s + c.reward, 0);
  }
}
