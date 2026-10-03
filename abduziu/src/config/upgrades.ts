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
  | 'ima_materia'
  | 'nanoreparo'
  | 'casco_vivo'
  | 'ritmo_alien'
  | 'furtividade'
  | 'frenesi_longo'
  | 'onda_choque'
  | 'turbina_dobra'
  | 'estabilizador'
  | 'cacador_cores'
  | 'radar_raros'
  | 'jackpot'
  | 'catalogador'
  | 'colosso';

export type SynergyId = 'singularidade' | 'tempestade_magnetica' | 'colheita_industrial' | 'espelho_quantico' | 'fenix' | 'fantasma' | 'febre_ouro' | 'tempo_bala';

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
  nanoreparo: { hullPerSecondPerLevel: 0.9 },
  casco_vivo: { hullPerAbductionPerLevel: 0.6 },
  ritmo_alien: { windowPerLevel: 0.35 },
  furtividade: { threatPerLevel: -0.12 },
  frenesi_longo: { durationPerLevel: 0.25 },
  onda_choque: { radiusPerLevel: 0.2 },
  turbina_dobra: { cooldownPerLevel: -0.15 },
  estabilizador: { accelPerLevel: 0.2 },
  cacador_cores: { coresPerLevel: 0.1 },
  radar_raros: { rarityPerLevel: 0.5 },
  jackpot: { chancePerLevel: 0.04, multiplier: 3 },
  catalogador: { newDexMatterPerLevel: 0.4 },
  colosso: { scalePerLevel: 0.07 },
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
  {
    id: 'nanoreparo',
    name: 'NANORREPARO',
    category: 'defesa',
    maxLevel: 3,
    icon: '✚',
    weight: 0.9,
    minPlayerLevel: 2,
    describe: () => `Nanomáquinas consertam o casco: +${UPGRADE_VALUES.nanoreparo.hullPerSecondPerLevel} de casco por segundo.`,
  },
  {
    id: 'casco_vivo',
    name: 'CASCO VIVO',
    category: 'defesa',
    maxLevel: 3,
    icon: '❦',
    weight: 0.85,
    minPlayerLevel: 3,
    describe: () => `Cada abdução recupera ${UPGRADE_VALUES.casco_vivo.hullPerAbductionPerLevel} de casco. A nave se alimenta da cidade.`,
  },
  {
    id: 'ritmo_alien',
    name: 'RITMO ALIENÍGENA',
    category: 'economia',
    maxLevel: 4,
    icon: '♫',
    weight: 1,
    describe: () => `+${UPGRADE_VALUES.ritmo_alien.windowPerLevel}s na janela do combo.`,
  },
  {
    id: 'furtividade',
    name: 'MODO FURTIVO',
    category: 'defesa',
    maxLevel: 3,
    icon: '◐',
    weight: 0.85,
    minPlayerLevel: 2,
    describe: () => `A Força Sentinela demora mais pra notar: ${Math.round(UPGRADE_VALUES.furtividade.threatPerLevel * 100)}% de ameaça.`,
  },
  {
    id: 'frenesi_longo',
    name: 'FRENESI PROLONGADO',
    category: 'feixe',
    maxLevel: 3,
    icon: '✺',
    weight: 0.85,
    minPlayerLevel: 3,
    describe: () => `O Abduction Frenzy dura +${pct(UPGRADE_VALUES.frenesi_longo.durationPerLevel)}.`,
  },
  {
    id: 'onda_choque',
    name: 'ONDA DE CHOQUE',
    category: 'defesa',
    maxLevel: 3,
    icon: '◍',
    weight: 0.8,
    minPlayerLevel: 2,
    describe: () => `EMP com +${pct(UPGRADE_VALUES.onda_choque.radiusPerLevel)} de alcance.`,
  },
  {
    id: 'turbina_dobra',
    name: 'TURBINA DE DOBRA',
    category: 'movimento',
    maxLevel: 3,
    icon: '⇉',
    weight: 0.85,
    minPlayerLevel: 2,
    describe: (l) => (l === 1 ? 'Libera o DASH nesta invasão (e recarrega 15% mais rápido se você já tem).' : `Dash recarrega mais ${pct(-UPGRADE_VALUES.turbina_dobra.cooldownPerLevel)} mais rápido.`),
  },
  {
    id: 'estabilizador',
    name: 'ESTABILIZADOR INERCIAL',
    category: 'movimento',
    maxLevel: 3,
    icon: '⟲',
    weight: 0.8,
    describe: () => `+${pct(UPGRADE_VALUES.estabilizador.accelPerLevel)} de aceleração. Curvas fechadas, zero enjoo.`,
  },
  {
    id: 'cacador_cores',
    name: 'CAÇADOR DE CORES',
    category: 'economia',
    maxLevel: 3,
    icon: '❖',
    weight: 0.75,
    describe: () => `+${pct(UPGRADE_VALUES.cacador_cores.coresPerLevel)} de Alien Cores no fim da invasão.`,
  },
  {
    id: 'radar_raros',
    name: 'RADAR DE RARIDADES',
    category: 'economia',
    maxLevel: 3,
    icon: '✧',
    weight: 0.7,
    minPlayerLevel: 2,
    describe: () => `Cartas aprimoradas (2 níveis de uma vez) aparecem bem mais.`,
  },
  {
    id: 'jackpot',
    name: 'JACKPOT CÓSMICO',
    category: 'economia',
    maxLevel: 5,
    icon: '$',
    weight: 0.8,
    minPlayerLevel: 2,
    describe: () => `+${pct(UPGRADE_VALUES.jackpot.chancePerLevel)} de chance de uma abdução valer ${UPGRADE_VALUES.jackpot.multiplier}× a matéria.`,
  },
  {
    id: 'catalogador',
    name: 'CATALOGADOR',
    category: 'economia',
    maxLevel: 3,
    icon: '☰',
    weight: 0.75,
    describe: () => `Objetos que ainda não estão na sua Coleção valem +${pct(UPGRADE_VALUES.catalogador.newDexMatterPerLevel)} de matéria.`,
  },
  {
    id: 'colosso',
    name: 'COLOSSO',
    category: 'feixe',
    maxLevel: 3,
    icon: '⬢',
    weight: 0.7,
    minPlayerLevel: 4,
    describe: () => `A nave fica ${pct(UPGRADE_VALUES.colosso.scalePerLevel)} maior: mais feixe, mais escudo, mais presença.`,
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
  {
    id: 'fenix',
    name: 'FÊNIX ALIENÍGENA',
    description: 'Uma vez por invasão, ao ser abatida, a nave renasce com metade do casco.',
    requires: { nanoreparo: 3, casco_vivo: 2 },
  },
  {
    id: 'fantasma',
    name: 'FANTASMA',
    description: 'Ameaça cai mais 25% e cada dash devolve metade da recarga.',
    requires: { furtividade: 3, turbina_dobra: 2 },
  },
  {
    id: 'febre_ouro',
    name: 'FEBRE DO OURO',
    description: 'Todo jackpot também rende +3 Alien Cores.',
    requires: { jackpot: 3, cacador_cores: 2 },
  },
  {
    id: 'tempo_bala',
    name: 'TEMPO-BALA',
    description: 'O frenesi dura o dobro e recarrega o EMP na hora em que começa.',
    requires: { frenesi_longo: 3, ritmo_alien: 3 },
  },
];

export const SYNERGY_BY_ID: ReadonlyMap<SynergyId, SynergyDef> = new Map(SYNERGIES.map((s) => [s.id, s]));
