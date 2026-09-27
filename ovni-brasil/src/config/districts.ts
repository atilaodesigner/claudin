/**
 * CIDADE 01 — NOVA AURORA.
 * The city is a grid of blocks; each char in LAYOUT is a district type.
 * Row 0 is north (negative Z). The player starts in the residential south.
 */
export type DistrictId = 'R' | 'V' | 'C' | 'P' | 'S' | 'I' | 'F' | 'B' | 'U';

export interface DistrictDef {
  id: DistrictId;
  name: string;
  area: number;
  /** Multiplies threat gained while abducting here. */
  threatMult: number;
  matterMult: number;
  groundColor: number;
  /** Weighted spawn table for loose street props. */
  props: ReadonlyArray<{ id: string; w: number }>;
  propDensity: number;
  /** Rare/special spawn table. */
  rares: ReadonlyArray<{ id: string; w: number }>;
  rareChance: number;
}

export const CITY = {
  name: 'NOVA AURORA',
  blockSize: 58,
  roadWidth: 12,
  sidewalk: 3,
  layout: [
    'BBBFFFCR',
    'BBBFFFCR',
    'IIIFFCCR',
    'IIICCCPR',
    'IIVCSCRR',
    'VVVRRRRU',
    'VVRRRRRU',
    'UURRRUUU',
  ],
  start: { col: 4, row: 6 },
} as const;

export const DISTRICTS: Record<DistrictId, DistrictDef> = {
  R: {
    id: 'R',
    name: 'Bairro Residencial',
    area: 1,
    threatMult: 1,
    matterMult: 1,
    groundColor: 0x7fae5a,
    propDensity: 1,
    props: [
      { id: 'lata', w: 10 },
      { id: 'garrafa', w: 6 },
      { id: 'chinelo', w: 3 },
      { id: 'caixa', w: 7 },
      { id: 'saco_lixo', w: 7 },
      { id: 'cone', w: 4 },
      { id: 'coco', w: 3 },
      { id: 'bola', w: 2 },
      { id: 'isopor', w: 2 },
      { id: 'engradado', w: 3 },
      { id: 'vaso', w: 3 },
      { id: 'cadeira', w: 6 },
      { id: 'mesa_bar', w: 2 },
      { id: 'bicicleta', w: 4 },
      { id: 'lixeira', w: 3 },
      { id: 'botijao', w: 2 },
      { id: 'carrinho_mercado', w: 1.5 },
      { id: 'churrasqueira', w: 1.5 },
      { id: 'moto', w: 2.5 },
      { id: 'mototaxi', w: 1 },
      { id: 'carrinho_pipoca', w: 0.6 },
      { id: 'orelhao', w: 0.6 },
    ],
    rares: [
      { id: 'galinha_cosmica', w: 2 },
      { id: 'carro_dourado', w: 1 },
      { id: 'perua_alien', w: 0.6 },
    ],
    rareChance: 0.12,
  },
  V: {
    id: 'V',
    name: 'Comunidade do Morro Azul',
    area: 1,
    threatMult: 1,
    matterMult: 1.1,
    groundColor: 0xb07a52,
    propDensity: 1.2,
    props: [
      { id: 'lata', w: 8 },
      { id: 'garrafa', w: 5 },
      { id: 'caixa', w: 5 },
      { id: 'saco_lixo', w: 6 },
      { id: 'cadeira', w: 6 },
      { id: 'mesa_bar', w: 3 },
      { id: 'caixa_som', w: 2 },
      { id: 'moto', w: 4 },
      { id: 'mototaxi', w: 3 },
      { id: 'bicicleta', w: 3 },
      { id: 'botijao', w: 3 },
      { id: 'engradado', w: 3 },
      { id: 'churrasqueira', w: 2 },
    ],
    rares: [{ id: 'galinha_cosmica', w: 1 }],
    rareChance: 0.1,
  },
  C: {
    id: 'C',
    name: 'Centro Comercial',
    area: 2,
    threatMult: 1.1,
    matterMult: 1,
    groundColor: 0x9aa08c,
    propDensity: 1,
    props: [
      { id: 'lata', w: 5 },
      { id: 'caixa', w: 5 },
      { id: 'saco_lixo', w: 3 },
      { id: 'cone', w: 3 },
      { id: 'lixeira', w: 4 },
      { id: 'cadeira', w: 4 },
      { id: 'mesa_bar', w: 2 },
      { id: 'carrinho_mercado', w: 3 },
      { id: 'bicicleta', w: 2 },
      { id: 'moto', w: 4 },
      { id: 'mototaxi', w: 2 },
      { id: 'carrinho_pipoca', w: 2 },
      { id: 'barraca_feira', w: 2 },
      { id: 'orelhao', w: 1.5 },
      { id: 'guarda_sol', w: 1.5 },
    ],
    rares: [
      { id: 'carro_dourado', w: 1 },
      { id: 'perua_alien', w: 1 },
    ],
    rareChance: 0.1,
  },
  P: {
    id: 'P',
    name: 'Praça da Aurora',
    area: 2,
    threatMult: 1,
    matterMult: 1,
    groundColor: 0x6aa84f,
    propDensity: 1,
    props: [
      { id: 'lata', w: 5 },
      { id: 'coco', w: 4 },
      { id: 'bola', w: 2 },
      { id: 'lixeira', w: 3 },
      { id: 'carrinho_pipoca', w: 2 },
      { id: 'guarda_sol', w: 2 },
      { id: 'bicicleta', w: 3 },
    ],
    rares: [{ id: 'estatua', w: 1 }],
    rareChance: 0,
  },
  S: {
    id: 'S',
    name: 'Campo de Várzea',
    area: 1,
    threatMult: 1,
    matterMult: 1,
    groundColor: 0x6aa84f,
    propDensity: 0.6,
    props: [
      { id: 'lata', w: 5 },
      { id: 'garrafa', w: 3 },
      { id: 'isopor', w: 3 },
      { id: 'cadeira', w: 5 },
      { id: 'bola', w: 1 },
      { id: 'moto', w: 2 },
    ],
    rares: [],
    rareChance: 0,
  },
  I: {
    id: 'I',
    name: 'Zona Industrial',
    area: 3,
    threatMult: 1.15,
    matterMult: 1.1,
    groundColor: 0x8d8a7f,
    propDensity: 0.8,
    props: [
      { id: 'caixa', w: 5 },
      { id: 'engradado', w: 4 },
      { id: 'cone', w: 5 },
      { id: 'botijao', w: 3 },
      { id: 'lixeira', w: 2 },
      { id: 'moto', w: 2 },
      { id: 'empilhadeira', w: 2 },
    ],
    rares: [{ id: 'caminhao_conspiracao', w: 1 }],
    rareChance: 0.25,
  },
  F: {
    id: 'F',
    name: 'Centro Financeiro',
    area: 4,
    threatMult: 1.3,
    matterMult: 1.15,
    groundColor: 0x8f9a8c,
    propDensity: 0.8,
    props: [
      { id: 'lata', w: 3 },
      { id: 'lixeira', w: 4 },
      { id: 'cone', w: 3 },
      { id: 'caixa', w: 3 },
      { id: 'banco_praca', w: 2 },
      { id: 'moto', w: 3 },
      { id: 'carrinho_pipoca', w: 1 },
    ],
    rares: [{ id: 'carro_dourado', w: 1 }],
    rareChance: 0.08,
  },
  B: {
    id: 'B',
    name: 'Base Aérea Sentinela',
    area: 5,
    threatMult: 2,
    matterMult: 1.5,
    groundColor: 0x8b8f6a,
    propDensity: 0.5,
    props: [
      { id: 'cone', w: 4 },
      { id: 'caixa', w: 3 },
      { id: 'botijao', w: 2 },
      { id: 'engradado', w: 3 },
    ],
    rares: [{ id: 'antena_secreta', w: 1 }],
    rareChance: 0.35,
  },
  U: {
    id: 'U',
    name: 'Sítio da Periferia',
    area: 1,
    threatMult: 1,
    matterMult: 1,
    groundColor: 0x86b45b,
    propDensity: 0.6,
    props: [
      { id: 'galinha', w: 8 },
      { id: 'coco', w: 4 },
      { id: 'caixa', w: 2 },
      { id: 'cachorro', w: 2 },
      { id: 'bicicleta', w: 2 },
      { id: 'churrasqueira', w: 1 },
    ],
    rares: [
      { id: 'vaca_dourada', w: 1 },
      { id: 'galinha_cosmica', w: 1 },
    ],
    rareChance: 0.35,
  },
};

/** Fictional signs. Humor stays ambient and organic. */
export const SHOP_SIGNS = [
  'BAR DO ET',
  'LANCHONETE 51',
  'DISCOS VOADORES AUTO PEÇAS',
  'PROMOÇÃO: 3 COXINHAS',
  'PADARIA AURORA',
  'MERCADINHO ÓRBITA',
  'AÇAÍ DA GALÁXIA',
  'SALÃO DA DONA NENÊ',
  'BORRACHARIA 24H',
  'FARMÁCIA POPULAR DO BAIRRO',
  'PASTELARIA ESTRELA',
  'CHAVEIRO & CIA',
  'ESPETINHO DO MARTE',
  'LOTÉRICA SORTE GRANDE',
  'OFICINA DO BIGODE',
  'ÓTICA VISÃO NOTURNA',
];

export const BILLBOARD_ADS = [
  'DISCOS VOADORES AUTO PEÇAS',
  'COXINHA ESPACIAL — R$ 5',
  'VOTE NINGUÉM',
  'SEU CARRO SUMIU? SEGUROS AURORA',
  'NOVA AURORA TE ESPERA',
];
