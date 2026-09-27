import type { Vector3 } from 'three';
import type { EnemyKind } from '../config/enemies';
import type { UpgradeId, SynergyId } from '../config/upgrades';
import type { Rarity } from '../config/objects';

export interface AbductPayload {
  uid: number;
  defId: string;
  tier: number;
  massKg: number;
  rarity: Rarity;
  position: Vector3;
  isEnemy: boolean;
  enemyKind?: EnemyKind | undefined;
}

export interface HighlightPayload {
  kind: 'jet_capture' | 'building_abduction' | 'frenzy' | 'boss' | 'legendary' | 'combo_record';
  label: string;
  score: number;
  time: number;
  position?: { x: number; y: number; z: number } | undefined;
}

/** Every event in the game and its payload. Keeps systems decoupled but type-safe. */
export interface GameEvents {
  'object:abduct:start': AbductPayload;
  'object:abduct:complete': AbductPayload & { score: number; matter: number; combo: number };
  'object:strain': { uid: number; defId: string; progress: number; requiredTier: number; position: Vector3 };
  'object:discovered': { defId: string; name: string; dexNumber: number };
  'object:destroyed': { uid: number; defId: string; position: Vector3 };
  'combo:changed': { combo: number; multiplier: number };
  'combo:milestone': { combo: number };
  'combo:ended': { combo: number };
  'combo:frenzy': { active: boolean };
  'player:levelup': { level: number };
  'player:tierup': { tier: number };
  'player:damage': { amount: number; hull: number; shield: number; source: Vector3 | null };
  'player:death': Record<string, never>;
  'player:dash': Record<string, never>;
  'player:perfectDodge': { position: Vector3 };
  'shield:hit': { position: Vector3; amount: number };
  'shield:break': Record<string, never>;
  'shield:restored': Record<string, never>;
  'emp:fired': { position: Vector3; radius: number };
  'alert:changed': { level: number; previous: number };
  'threat:changed': { threat: number };
  'enemy:spawn': { kind: EnemyKind; id: number; position: Vector3 };
  'enemy:destroyed': { kind: EnemyKind; id: number; position: Vector3; byMissile: boolean; abducted: boolean };
  'enemy:disabled': { kind: EnemyKind; id: number };
  'missile:launch': { id: number; position: Vector3 };
  'missile:lock': { active: boolean };
  'missile:explode': { position: Vector3; hitPlayer: boolean };
  'upgrade:chosen': { id: UpgradeId; level: number };
  'synergy:unlocked': { id: SynergyId };
  'event:start': { id: string; title: string; subtitle: string; position?: Vector3 | undefined };
  'event:end': { id: string; success: boolean };
  'challenge:progress': { index: number; progress: number; goal: number };
  'challenge:complete': { index: number; title: string; reward: number };
  'extraction:available': { multiplier: number };
  'extraction:start': Record<string, never>;
  'boss:spawn': Record<string, never>;
  'boss:defeated': Record<string, never>;
  'run:start': { daily: boolean };
  'run:end': { reason: 'extracted' | 'destroyed' | 'quit' };
  'highlight': HighlightPayload;
  'highlight:jet_capture': HighlightPayload;
  'highlight:building_abduction': HighlightPayload;
  'highlight:frenzy': HighlightPayload;
  'highlight:boss': HighlightPayload;
  'camera:impulse': { strength: number };
  'ui:toast': { title: string; subtitle?: string | undefined; tone?: 'info' | 'good' | 'warn' | 'danger' | 'alien' | 'gold'; duration?: number };
  'quality:changed': { level: number; renderScale: number };
}

type Handler<T> = (payload: T) => void;

export class EventBus<Events extends object = GameEvents> {
  private readonly handlers = new Map<keyof Events, Set<Handler<never>>>();

  on<K extends keyof Events>(event: K, handler: Handler<Events[K]>): () => void {
    let set = this.handlers.get(event);
    if (!set) {
      set = new Set();
      this.handlers.set(event, set);
    }
    set.add(handler as Handler<never>);
    return () => this.off(event, handler);
  }

  once<K extends keyof Events>(event: K, handler: Handler<Events[K]>): () => void {
    const off = this.on(event, (p) => {
      off();
      handler(p);
    });
    return off;
  }

  off<K extends keyof Events>(event: K, handler: Handler<Events[K]>): void {
    this.handlers.get(event)?.delete(handler as Handler<never>);
  }

  emit<K extends keyof Events>(event: K, payload: Events[K]): void {
    const set = this.handlers.get(event);
    if (!set) return;
    for (const h of set) {
      try {
        (h as Handler<Events[K]>)(payload);
      } catch (err) {
        console.error(`[EventBus] handler for "${String(event)}" failed`, err);
      }
    }
  }

  clear(): void {
    this.handlers.clear();
  }
}
