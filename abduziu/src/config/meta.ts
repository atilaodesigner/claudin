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
  | 'eco_cores'
  | 'nave_reparo'
  | 'nave_colosso'
  | 'feixe_satelite'
  | 'feixe_residual'
  | 'def_camuflagem'
  | 'def_ultimo_suspiro'
  | 'mov_frenesi'
  | 'mov_estabilizador'
  | 'eco_jackpot'
  | 'eco_catalogo'
  | 'eco_frenesi'
  | 'eco_meme';

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
  { id: 'eco_raridade', branch: 'ECONOMIA', name: 'Sorte Cósmica', description: 'Objetos raros e cartas aprimoradas mais frequentes.', maxLevel: 4, baseCost: 110, costGrowth: 1.75, requires: { id: 'eco_materia', level: 1 }, perLevel: 'Mais cartas aprimoradas' },
  { id: 'eco_cores', branch: 'ECONOMIA', name: 'Extração Eficiente', description: 'Mais Alien Cores no fim da invasão.', maxLevel: 5, baseCost: 150, costGrowth: 1.8, requires: { id: 'eco_combo', level: 1 }, perLevel: '+8% de cores' },

  // second tier: long-term goals for players who already finished the first trees
  { id: 'nave_reparo', branch: 'NAVE', name: 'Auto-reparo', description: 'O casco se conserta sozinho durante a invasão.', maxLevel: 3, baseCost: 260, costGrowth: 1.9, requires: { id: 'nave_casco', level: 3 }, perLevel: '+0,3 de casco por segundo' },
  { id: 'nave_colosso', branch: 'NAVE', name: 'Núcleo Colossal', description: 'A nave nasce maior e continua maior.', maxLevel: 3, baseCost: 480, costGrowth: 2, requires: { id: 'nave_tamanho', level: 3 }, perLevel: '+4% de tamanho' },
  { id: 'feixe_satelite', branch: 'FEIXE', name: 'Satélite de Fábrica', description: 'Toda invasão já começa com feixes satélites orbitando a nave.', maxLevel: 2, baseCost: 600, costGrowth: 2.2, requires: { id: 'feixe_multi', level: 3 }, perLevel: '+1 feixe satélite' },
  { id: 'feixe_residual', branch: 'FEIXE', name: 'Gravidade Residual', description: 'Um arrasto leve puxa objetos soltos pro feixe, mesmo sem Buraco Negro.', maxLevel: 3, baseCost: 340, costGrowth: 1.9, requires: { id: 'feixe_raio', level: 3 }, perLevel: '+arrasto gravitacional' },
  { id: 'def_camuflagem', branch: 'DEFESA', name: 'Camuflagem Óptica', description: 'A Força Sentinela demora mais pra perceber a invasão.', maxLevel: 5, baseCost: 220, costGrowth: 1.75, requires: { id: 'def_escudo', level: 2 }, perLevel: '-5% de ameaça' },
  { id: 'def_ultimo_suspiro', branch: 'DEFESA', name: 'Último Suspiro', description: 'Uma vez por invasão, um tiro fatal deixa a nave com 1 de casco em vez de derrubá-la.', maxLevel: 1, baseCost: 900, costGrowth: 1, requires: { id: 'def_regen', level: 3 }, perLevel: 'Sobrevive a 1 golpe fatal' },
  { id: 'mov_frenesi', branch: 'MOVIMENTO', name: 'Frenesi Turbinado', description: 'No Abduction Frenzy a nave voa ainda mais rápido.', maxLevel: 3, baseCost: 260, costGrowth: 1.8, requires: { id: 'mov_velocidade', level: 3 }, perLevel: '+8% de velocidade no frenesi' },
  { id: 'mov_estabilizador', branch: 'MOVIMENTO', name: 'Giroscópio Quântico', description: 'Freia e acelera quase na hora.', maxLevel: 3, baseCost: 200, costGrowth: 1.8, requires: { id: 'mov_velocidade', level: 2 }, perLevel: '+10% de aceleração' },
  { id: 'eco_jackpot', branch: 'ECONOMIA', name: 'Jackpot Cósmico', description: 'Chance de uma abdução render o triplo de matéria.', maxLevel: 5, baseCost: 300, costGrowth: 1.8, requires: { id: 'eco_raridade', level: 2 }, perLevel: '+2% de jackpot' },
  { id: 'eco_catalogo', branch: 'ECONOMIA', name: 'Catalogador', description: 'Objetos que faltam na Coleção valem mais matéria.', maxLevel: 4, baseCost: 240, costGrowth: 1.8, requires: { id: 'eco_materia', level: 3 }, perLevel: '+15% de matéria em novos' },
  { id: 'eco_frenesi', branch: 'ECONOMIA', name: 'Frenesi Estendido', description: 'O Abduction Frenzy dura mais.', maxLevel: 4, baseCost: 220, costGrowth: 1.8, requires: { id: 'eco_combo', level: 2 }, perLevel: '+10% de duração do frenesi' },
  { id: 'eco_meme', branch: 'ECONOMIA', name: 'Radar de Memes', description: 'Memes raros aparecem mais vezes no modo história.', maxLevel: 3, baseCost: 700, costGrowth: 2, requires: { id: 'eco_raridade', level: 3 }, perLevel: '+30% de chance de meme' },
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
  hullRegenPerLevel: 0.3,
  colossusPerLevel: 0.04,
  satellitesPerLevel: 1,
  residualPullPerLevel: 0.35,
  camouflagePerLevel: 0.05,
  frenzySpeedPerLevel: 0.08,
  gyroPerLevel: 0.1,
  jackpotPerLevel: 0.02,
  catalogPerLevel: 0.15,
  frenzyDurationPerLevel: 0.1,
  memeChancePerLevel: 0.3,
};
