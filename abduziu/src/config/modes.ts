/**
 * Game modes. Casual is relaxed (no enemies, no death), Campanha is the progression
 * through the cities, Ranqueada is the competitive weekly map, Diária the daily seed.
 */
import { CAMPAIGN, type CityId } from './cities';
import { hashNumbers } from '../utils/rng';

export type GameMode = 'casual' | 'campanha' | 'ranqueada' | 'diaria' | 'arena' | 'online';

export interface ModeInfo {
  id: GameMode;
  name: string;
  tag: string;
  description: string;
  /** Multiplies Alien Cores earned. */
  coreMult: number;
  enemies: boolean;
  /** Hull damage applies (casual can't die). */
  damage: boolean;
}

export const MODES: Record<GameMode, ModeInfo> = {
  casual: {
    id: 'casual',
    name: 'PASSEIO',
    tag: 'CASUAL',
    description: 'Sem tiros e sem pressa. Só você, o feixe e a cidade. Encerre quando quiser.',
    coreMult: 0.5,
    enemies: false,
    damage: false,
  },
  campanha: {
    id: 'campanha',
    name: 'INVASÃO DO BRASIL',
    tag: 'CAMPANHA',
    description: 'Sete cidades, três estrelas em cada. Extraia com vida para liberar a próxima.',
    coreMult: 1,
    enemies: true,
    damage: true,
  },
  ranqueada: {
    id: 'ranqueada',
    name: 'RANQUEADA',
    tag: 'RANK',
    description: 'A mesma cidade e o mesmo mapa da semana para todo mundo. Pontue para subir de divisão.',
    coreMult: 1.2,
    enemies: true,
    damage: true,
  },
  online: {
    id: 'online',
    name: 'ARENA ONLINE',
    tag: 'PVP',
    description: 'Jogadores de verdade na mesma cidade sem fim. Engula as naves menores, fuja das maiores e domine a sala.',
    coreMult: 1,
    enemies: false,
    damage: false,
  },
  arena: {
    id: 'arena',
    name: 'ARENA',
    tag: '.IO',
    description: 'Todo mundo começa pequeno. Abduza a cidade, cresça e engula as naves menores antes que uma maior engula você.',
    coreMult: 0.8,
    enemies: false,
    damage: false,
  },
  diaria: {
    id: 'diaria',
    name: 'INVASÃO DO DIA',
    tag: 'DIÁRIA',
    description: 'Um mapa novo por dia, igual para todos.',
    coreMult: 1,
    enemies: true,
    damage: true,
  },
};

export interface RunSetup {
  mode: GameMode;
  city: CityId;
  seed: number;
}

/** ISO-8601 week, e.g. "2026-W39". */
export function weekKey(d = new Date()): string {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((t.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${t.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

function keyNumber(key: string): number {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (Math.imul(h, 31) + key.charCodeAt(i)) >>> 0;
  return h;
}

/** Weekly ranked map: every player gets the same city and seed. */
export function weeklySetup(d = new Date()): RunSetup {
  const key = weekKey(d);
  const n = keyNumber(key);
  const cities = CAMPAIGN.filter((c) => c.id !== 'nova_aurora');
  const city = cities[n % cities.length] as (typeof cities)[number];
  return { mode: 'ranqueada', city: city.id, seed: hashNumbers(n, 7777) };
}

/** Daily map: rotates through every city. */
export function dailySetup(seed: number, d = new Date()): RunSetup {
  const start = Date.UTC(d.getFullYear(), 0, 0);
  const dayOfYear = Math.floor((Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) - start) / 86400000);
  const city = CAMPAIGN[dayOfYear % CAMPAIGN.length] as (typeof CAMPAIGN)[number];
  return { mode: 'diaria', city: city.id, seed };
}
