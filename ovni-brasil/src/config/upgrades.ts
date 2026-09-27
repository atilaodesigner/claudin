/**
 * In-run upgrade cards and synergies. Numbers are consumed by UFOStats.
 */
export type UpgradeId =
  | 'feixe_duplo'
  | 'gravidade_bruta'
  | 'campo_maior'
  | 'processamento'
  | 'escudo'
  | 'pulso_emp'
  | 'raio_refletor'
  | 'buraco_negro'
  | 'colheita_cadeia'
  | 'hiperpropulsor'
  | 'campo_temporal'
  | 'trator_multiplo'
  | 'casco'
  | 'ima_materia';

export type SynergyId = 'singularidade' | 'tempestade_magnetica' | 'colheita_industrial' | 'espelho_quantico';

export type UpgradeCategory = 'feixe' | 'defesa' | 'movimento' | 'economia';

export interface UpgradeDef {
  id: UpgradeId;
  name: string;
  category: UpgradeCategory;
  maxLevel: number;
  /** Short text per level (index = level-1). Keep it punchy. */
  describe: (nextLevel: number) => string;
  icon: string;
  weight: number;
  /** Only offered after this run level. */
  minPlayerLevel?: number;
}

export const UPGRADE_VALUES = {
  feixe_duplo: { satellitesPerLevel: 1, satelliteRadiusMult: 0.62, capacityPerLevel: 1 },
  gravidade_bruta: { tiersPerLevel: 0.4 },
  campo_maior: { radiusPerLevel: 0.2 },
  processamento: { speedPerLevel: 0.3 },
  escudo: { shieldPerLevel: 0.5, regenPerLevel: 0.35 },
  pulso_emp: { basePeriod: 16, periodPerLevel: -2.5, radiusMult: 0.7, cooldownReduction: 0.12 },
  raio_refletor: { chancePerLevel: 0.15 },
  buraco_negro: { radiusMult: 2.1, radiusPerLevel: 0.35, pullPerLevel: 1.1 },
  colheita_cadeia: { tiersPerStack: 0.06, maxStacksPerLevel: 5, duration: 3 },
  hiperpropulsor: { speedPerLevel: 0.15 },
  campo_temporal: { radius: 16, slowPerLevel: 0.22 },
  trator_multiplo: { capacityPerLevel: 2 },
  casco: { hullPerLevel: 30 },
  ima_materia: { matterPerLevel: 0.15 },
} as const;

const pct = (v: number) => `${Math.round(v * 100)}%`;

export const UPGRADES: readonly UpgradeDef[] = [
  {
    id: 'feixe_duplo',
    name: 'FEIXE DUPLO',
    category: 'feixe',
    maxLevel: 3,
    icon: '⫶',
    weight: 1,
    minPlayerLevel: 3,
    describe: (l) => `+1 feixe satélite orbitando a nave (${l} no total) e +1 de capacidade.`,
  },
  {
    id: 'gravidade_bruta',
    name: 'GRAVIDADE BRUTA',
    category: 'feixe',
    maxLevel: 5,
    icon: '⬇',
    weight: 1.25,
    describe: () => `+25% de força de abdução. Puxa classes de massa mais pesadas antes.`,
  },
  {
    id: 'campo_maior',
    name: 'CAMPO MAIOR',
    category: 'feixe',
    maxLevel: 5,
    icon: '◎',
    weight: 1.2,
    describe: () => `+${pct(UPGRADE_VALUES.campo_maior.radiusPerLevel)} de área do feixe.`,
  },
  {
    id: 'processamento',
    name: 'PROCESSAMENTO QUÂNTICO',
    category: 'feixe',
    maxLevel: 5,
    icon: '⚛',
    weight: 1.1,
    describe: () => `+${pct(UPGRADE_VALUES.processamento.speedPerLevel)} de velocidade de absorção.`,
  },
  {
    id: 'trator_multiplo',
    name: 'TRATOR MÚLTIPLO',
    category: 'feixe',
    maxLevel: 5,
    icon: '⁂',
    weight: 1.1,
    describe: () => `+${UPGRADE_VALUES.trator_multiplo.capacityPerLevel} objetos puxados ao mesmo tempo.`,
  },
  {
    id: 'buraco_negro',
    name: 'BURACO NEGRO',
    category: 'feixe',
    maxLevel: 3,
    icon: '◉',
    weight: 0.8,
    minPlayerLevel: 4,
    describe: (l) => (l === 1 ? 'Objetos ao redor são lentamente arrastados para o feixe.' : 'Arrasto gravitacional mais forte e mais distante.'),
  },
  {
    id: 'colheita_cadeia',
    name: 'COLHEITA EM CADEIA',
    category: 'feixe',
    maxLevel: 3,
    icon: '⛓',
    weight: 0.9,
    describe: () => `Cada abdução aumenta a força temporariamente (acumula até ${UPGRADE_VALUES.colheita_cadeia.maxStacksPerLevel}× por nível).`,
  },
  {
    id: 'escudo',
    name: 'ESCUDO ALIENÍGENA',
    category: 'defesa',
    maxLevel: 5,
    icon: '⬡',
    weight: 1,
    describe: () => `+50% de escudo e regeneração mais rápida.`,
  },
  {
    id: 'pulso_emp',
    name: 'PULSO EMP',
    category: 'defesa',
    maxLevel: 3,
    icon: 'ϟ',
    weight: 0.9,
    minPlayerLevel: 3,
    describe: (l) => (l === 1 ? 'Dispara um EMP automático periodicamente.' : 'EMP automático mais frequente e recarga manual menor.'),
  },
  {
    id: 'raio_refletor',
    name: 'RAIO REFLETOR',
    category: 'defesa',
    maxLevel: 3,
    icon: '↺',
    weight: 0.8,
    minPlayerLevel: 5,
    describe: () => `+${pct(UPGRADE_VALUES.raio_refletor.chancePerLevel)} de chance de devolver projéteis ao atirador.`,
  },
  {
    id: 'campo_temporal',
    name: 'CAMPO TEMPORAL',
    category: 'defesa',
    maxLevel: 3,
    icon: '⧗',
    weight: 0.7,
    minPlayerLevel: 6,
    describe: () => `Projéteis próximos ficam ${pct(UPGRADE_VALUES.campo_temporal.slowPerLevel)} mais lentos.`,
  },
  {
    id: 'casco',
    name: 'CASCO REFORÇADO',
    category: 'defesa',
    maxLevel: 5,
    icon: '▣',
    weight: 0.8,
    describe: () => `+${UPGRADE_VALUES.casco.hullPerLevel} de integridade e reparo total do casco.`,
  },
  {
    id: 'hiperpropulsor',
    name: 'HIPERPROPULSOR',
    category: 'movimento',
    maxLevel: 5,
    icon: '➤',
    weight: 0.9,
    describe: () => `+${pct(UPGRADE_VALUES.hiperpropulsor.speedPerLevel)} de velocidade da nave.`,
  },
  {
    id: 'ima_materia',
    name: 'ÍMÃ DE MATÉRIA',
    category: 'economia',
    maxLevel: 5,
    icon: '✦',
    weight: 0.8,
    describe: () => `+${pct(UPGRADE_VALUES.ima_materia.matterPerLevel)} de Matéria Alienígena por objeto.`,
  },
];

export const UPGRADE_BY_ID: ReadonlyMap<UpgradeId, UpgradeDef> = new Map(UPGRADES.map((u) => [u.id, u]));

export interface SynergyDef {
  id: SynergyId;
  name: string;
  description: string;
  requires: Partial<Record<UpgradeId, number>>;
}

export const SYNERGIES: readonly SynergyDef[] = [
  {
    id: 'singularidade',
    name: 'SINGULARIDADE',
    description: 'Veículos inteiros orbitam a nave antes de serem absorvidos. O arrasto dobra.',
    requires: { buraco_negro: 3, campo_maior: 3, gravidade_bruta: 3 },
  },
  {
    id: 'tempestade_magnetica',
    name: 'TEMPESTADE MAGNÉTICA',
    description: 'O escudo dispara ondas EMP automaticamente ao ser atingido.',
    requires: { pulso_emp: 3, escudo: 3 },
  },
  {
    id: 'colheita_industrial',
    name: 'COLHEITA INDUSTRIAL',
    description: 'Feixes satélites viram campos completos. +4 de capacidade.',
    requires: { feixe_duplo: 3, processamento: 3 },
  },
  {
    id: 'espelho_quantico',
    name: 'ESPELHO QUÂNTICO',
    description: 'Projéteis refletidos perseguem inimigos e causam dano dobrado.',
    requires: { raio_refletor: 3, campo_temporal: 2 },
  },
];

export const SYNERGY_BY_ID: ReadonlyMap<SynergyId, SynergyDef> = new Map(SYNERGIES.map((s) => [s.id, s]));
