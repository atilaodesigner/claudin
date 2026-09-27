/**
 * Permanent upgrades bought with Alien Cores between runs (ÁRVORE DE EVOLUÇÃO).
 * No predatory mechanics: costs are reachable through play only.
 */
export type MetaNodeId =
  | 'nave_casco'
  | 'nave_tamanho'
  | 'nave_aceleracao'
  | 'feixe_forca'
  | 'feixe_raio'
  | 'feixe_multi'
  | 'feixe_velocidade'
  | 'def_escudo'
  | 'def_regen'
  | 'def_reflexo'
  | 'def_emp'
  | 'mov_velocidade'
  | 'mov_dash'
  | 'mov_afterburner'
  | 'eco_materia'
  | 'eco_combo'
  | 'eco_raridade'
  | 'eco_cores';

export type MetaBranch = 'NAVE' | 'FEIXE' | 'DEFESA' | 'MOVIMENTO' | 'ECONOMIA';

export interface MetaNodeDef {
  id: MetaNodeId;
  branch: MetaBranch;
  name: string;
  description: string;
  maxLevel: number;
  baseCost: number;
  costGrowth: number;
  requires?: { id: MetaNodeId; level: number } | undefined;
  /** Human readable bonus per level. */
  perLevel: string;
}

export const META_NODES: readonly MetaNodeDef[] = [
  { id: 'nave_casco', branch: 'NAVE', name: 'Casco Blindado', description: 'Mais integridade estrutural.', maxLevel: 5, baseCost: 60, costGrowth: 1.6, perLevel: '+15 de casco' },
  { id: 'nave_tamanho', branch: 'NAVE', name: 'Tamanho Inicial', description: 'Começa a invasão com a nave maior.', maxLevel: 4, baseCost: 120, costGrowth: 1.8, requires: { id: 'nave_casco', level: 1 }, perLevel: '+0,25 de classe inicial' },
  { id: 'nave_aceleracao', branch: 'NAVE', name: 'Estabilizadores', description: 'Resposta mais rápida aos comandos.', maxLevel: 3, baseCost: 80, costGrowth: 1.7, requires: { id: 'nave_casco', level: 1 }, perLevel: '+12% de aceleração' },

  { id: 'feixe_forca', branch: 'FEIXE', name: 'Força Gravitacional', description: 'Puxa objetos mais pesados desde o início.', maxLevel: 5, baseCost: 80, costGrowth: 1.7, perLevel: '+0,2 de classe de massa' },
  { id: 'feixe_raio', branch: 'FEIXE', name: 'Alcance do Feixe', description: 'Área de captura maior.', maxLevel: 5, baseCost: 70, costGrowth: 1.65, requires: { id: 'feixe_forca', level: 1 }, perLevel: '+8% de raio' },
  { id: 'feixe_multi', branch: 'FEIXE', name: 'Múltiplos Alvos', description: 'Mais objetos simultâneos no feixe.', maxLevel: 4, baseCost: 110, costGrowth: 1.8, requires: { id: 'feixe_raio', level: 1 }, perLevel: '+1 de capacidade' },
  { id: 'feixe_velocidade', branch: 'FEIXE', name: 'Absorção Rápida', description: 'Processa matéria mais rápido.', maxLevel: 5, baseCost: 90, costGrowth: 1.65, requires: { id: 'feixe_forca', level: 2 }, perLevel: '+10% de velocidade' },

  { id: 'def_escudo', branch: 'DEFESA', name: 'Escudo', description: 'Escudo inicial mais resistente.', maxLevel: 5, baseCost: 70, costGrowth: 1.6, perLevel: '+20% de escudo' },
  { id: 'def_regen', branch: 'DEFESA', name: 'Regeneração', description: 'O escudo volta mais rápido.', maxLevel: 4, baseCost: 90, costGrowth: 1.7, requires: { id: 'def_escudo', level: 1 }, perLevel: '+15% de regeneração' },
  { id: 'def_emp', branch: 'DEFESA', name: 'Capacitor EMP', description: 'Recarga do EMP mais curta e raio maior.', maxLevel: 4, baseCost: 100, costGrowth: 1.7, requires: { id: 'def_escudo', level: 1 }, perLevel: '-8% recarga, +6% raio' },
  { id: 'def_reflexo', branch: 'DEFESA', name: 'Reflexão', description: 'Chance de devolver projéteis.', maxLevel: 3, baseCost: 160, costGrowth: 1.9, requires: { id: 'def_regen', level: 2 }, perLevel: '+6% de reflexão' },

  { id: 'mov_velocidade', branch: 'MOVIMENTO', name: 'Propulsores', description: 'Nave mais rápida.', maxLevel: 5, baseCost: 60, costGrowth: 1.6, perLevel: '+6% de velocidade' },
  { id: 'mov_dash', branch: 'MOVIMENTO', name: 'Dash Dimensional', description: 'Desbloqueia o DASH: impulso rápido para desviar de mísseis.', maxLevel: 1, baseCost: 90, costGrowth: 1, requires: { id: 'mov_velocidade', level: 1 }, perLevel: 'Desbloqueia DASH' },
  { id: 'mov_afterburner', branch: 'MOVIMENTO', name: 'Pós-combustão', description: 'Dash recarrega mais rápido e vai mais longe.', maxLevel: 3, baseCost: 140, costGrowth: 1.8, requires: { id: 'mov_dash', level: 1 }, perLevel: '-15% recarga do dash' },

  { id: 'eco_materia', branch: 'ECONOMIA', name: 'Refinaria de Matéria', description: 'Mais Matéria Alienígena por objeto.', maxLevel: 5, baseCost: 90, costGrowth: 1.7, perLevel: '+6% de matéria' },
  { id: 'eco_combo', branch: 'ECONOMIA', name: 'Ritmo de Colheita', description: 'Janela de combo mais longa.', maxLevel: 4, baseCost: 80, costGrowth: 1.7, requires: { id: 'eco_materia', level: 1 }, perLevel: '+0,25s de combo' },
  { id: 'eco_raridade', branch: 'ECONOMIA', name: 'Sorte Cósmica', description: 'Objetos raros e cartas aprimoradas mais frequentes.', maxLevel: 4, baseCost: 110, costGrowth: 1.75, requires: { id: 'eco_materia', level: 1 }, perLevel: '+rarity' },
  { id: 'eco_cores', branch: 'ECONOMIA', name: 'Extração Eficiente', description: 'Mais Alien Cores no fim da invasão.', maxLevel: 5, baseCost: 150, costGrowth: 1.8, requires: { id: 'eco_combo', level: 1 }, perLevel: '+8% de cores' },
];

export const META_BY_ID: ReadonlyMap<MetaNodeId, MetaNodeDef> = new Map(META_NODES.map((n) => [n.id, n]));

export const META_BRANCHES: readonly MetaBranch[] = ['NAVE', 'FEIXE', 'DEFESA', 'MOVIMENTO', 'ECONOMIA'];

export function metaCost(node: MetaNodeDef, currentLevel: number): number {
  return Math.round(node.baseCost * Math.pow(node.costGrowth, currentLevel) / 5) * 5;
}

/** Numeric effects of meta levels, consumed by UFOStats. */
export const META_VALUES = {
  hullPerLevel: 15,
  startTierPerLevel: 0.25,
  accelPerLevel: 0.12,
  beamTierPerLevel: 0.2,
  beamRadiusPerLevel: 0.08,
  capacityPerLevel: 1,
  absorbSpeedPerLevel: 0.1,
  shieldPerLevel: 0.2,
  regenPerLevel: 0.15,
  empCooldownPerLevel: 0.08,
  empRadiusPerLevel: 0.06,
  reflectPerLevel: 0.06,
  speedPerLevel: 0.06,
  dashCooldownPerLevel: 0.15,
  matterPerLevel: 0.06,
  comboWindowPerLevel: 0.25,
  rarityPerLevel: 0.25,
  coresPerLevel: 0.08,
};
