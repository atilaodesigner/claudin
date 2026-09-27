/**
 * CIDADES. Each city is data: a block layout (see districts.ts for the letters),
 * look (light/sky/water), local signage, landmarks, extra props and the three
 * campaign stars. Add a city by adding an entry here.
 */
import type { ChallengeKind } from './challenges';
import type { DistrictId } from './districts';

export type CityId = 'nova_aurora' | 'recife' | 'salvador' | 'rio' | 'manaus' | 'sao_paulo' | 'brasilia';

export interface CityLook {
  sun: number;
  sunIntensity: number;
  /** Sun position relative to the focus point (direction matters, not length). */
  sunDir: readonly [number, number, number];
  hemiSky: number;
  hemiGround: number;
  hemiIntensity: number;
  fog: number;
  fogMult: number;
  skyTop: number;
  skyHorizon: number;
  tint: readonly [number, number, number];
  shadowTint: readonly [number, number, number];
  saturation: number;
  exposure: number;
  /** Ground outside the blocks (outskirts) and lawns. */
  grass: number;
  /** Water tint from west to east (Encontro das Águas in Manaus). */
  water: readonly [number, number];
  cloudTint: number;
}

export interface StarSpec {
  kind: ChallengeKind;
  title: string;
  goal: number;
  tag?: string;
  enemy?: string;
  objectId?: string;
}

export interface CityDef {
  id: CityId;
  name: string;
  uf: string;
  nickname: string;
  /** One line for the city picker. */
  blurb: string;
  /** Map position (longitude, latitude) and HUD coordinates. */
  lon: number;
  lat: number;
  /** 1 (tranquila) .. 5 (capital sob alerta). */
  difficulty: number;
  threatMult: number;
  trafficMult: number;
  layout: readonly string[];
  start: { col: number; row: number };
  /** Local names per district type. */
  names: Partial<Record<DistrictId, string>>;
  /** Names for single blocks, key "col,row" (landmarks, rivers...). */
  blockNames?: Readonly<Record<string, string>>;
  /** Landmark per L block (object id). */
  landmarks: ReadonlyArray<{ id: string; col: number; row: number; rot?: number; dx?: number; dz?: number }>;
  /** Road lines that continue over water as bridges (x: vertical line index, z: horizontal). */
  bridges?: { x?: readonly number[]; z?: readonly number[] };
  /** Scenery outside the play area (not abductable). Offsets in meters from the city edge. */
  backdrop?: ReadonlyArray<{ model: string; side: 'n' | 's' | 'e' | 'w'; along: number; out: number; rot?: number; scale?: number }>;
  extraProps?: Partial<Record<DistrictId, ReadonlyArray<{ id: string; w: number }>>>;
  extraRares?: Partial<Record<DistrictId, ReadonlyArray<{ id: string; w: number }>>>;
  /** What floats on this city's water. */
  boats: ReadonlyArray<{ id: string; w: number }>;
  /** Special generator touches for this city. */
  features: ReadonlyArray<'helipads' | 'trio' | 'palafitas' | 'jacares' | 'lifeguards' | 'shark_signs' | 'bondinho' | 'jangadas' | 'estaiada'>;
  signs: readonly string[];
  billboards: readonly string[];
  labels: { police: string; bus: string; posto: string; radio: string; predio: string; score: string };
  radio: readonly [readonly [string, string], readonly [string, string]];
  look: CityLook;
  secret: string;
  /** Campaign order (0 = first). */
  order: number;
  stars: readonly [StarSpec, StarSpec, StarSpec];
}

const BASE_LOOK: CityLook = {
  sun: 0xfff0d2,
  sunIntensity: 2.7,
  sunDir: [-70, 110, 48],
  hemiSky: 0xbfe2ff,
  hemiGround: 0x8a7a55,
  hemiIntensity: 1.25,
  fog: 0xbfdcee,
  fogMult: 1,
  skyTop: 0x2d7fd8,
  skyHorizon: 0xc4e6fb,
  tint: [1.03, 1.0, 0.95],
  shadowTint: [0.9, 0.98, 1.08],
  saturation: 1.14,
  exposure: 1.0,
  grass: 0x78a650,
  water: [0x1f6f96, 0x2b8fb0],
  cloudTint: 0xffffff,
};

const EXTRACT: StarSpec = { kind: 'extract', title: 'Extraia com vida', goal: 1 };

export const CITIES: readonly CityDef[] = [
  {
    id: 'nova_aurora',
    name: 'Nova Aurora',
    uf: 'BR',
    nickname: 'CIDADE DE TESTES',
    blurb: 'Cidade de testes da Força Sentinela. Ninguém sabe onde fica. Perfeita pra treinar.',
    lon: -44.6,
    lat: -19.6,
    difficulty: 1,
    threatMult: 0.9,
    trafficMult: 1,
    layout: ['BBBFFFCR', 'BBBFFFCR', 'IIIFFCCR', 'IIICCCPR', 'IIVCSCRR', 'VVVRRRRU', 'VVRRRRRU', 'UURRRUUU'],
    start: { col: 4, row: 6 },
    names: {},
    landmarks: [],
    boats: [],
    features: [],
    signs: [],
    billboards: [],
    labels: { police: 'PATRULHA AURORA', bus: '051 CENTRO / VIA LÁCTEA', posto: 'POSTO AURORA', radio: 'RÁDIO AURORA FM', predio: 'EDIFÍCIO AURORA', score: 'AURORA 0 x 0 VISITANTE' },
    radio: [
      ['CONTROLE:', 'TEMOS UM OBJETO NÃO IDENTIFICADO...'],
      ['TORRE AURORA:', 'ELE ESTÁ DESCENDO SOBRE A CIDADE.'],
    ],
    look: BASE_LOOK,
    secret: 'galinha_cosmica',
    order: 0,
    stars: [EXTRACT, { kind: 'combo', title: 'Faça combo x20', goal: 20 }, { kind: 'abduct_id', title: 'Abduza o Arranha-céu Aurora', goal: 1, objectId: 'arranha_ceu' }],
  },
  {
    id: 'recife',
    name: 'Recife',
    uf: 'PE',
    nickname: 'VENEZA BRASILEIRA',
    blurb: 'Rios, pontes e frevo. Boa Viagem é linda, mas respeite a placa do tubarão.',
    lon: -34.9,
    lat: -8.05,
    difficulty: 1,
    threatMult: 0.85,
    trafficMult: 1,
    layout: ['VVRIIIWW', 'VRRCKLWW', 'WWWWWWWW', 'RRCCFPAW', 'URRCFRAW', 'URSRRRAW', 'URRRCRAW', 'UURRRRAW'],
    start: { col: 3, row: 6 },
    names: { V: 'Comunidade do Alto', A: 'Praia de Boa Viagem', K: 'Recife Antigo', C: 'Boa Vista', F: 'Centro', I: 'Porto do Recife', R: 'Bairro das Graças', U: 'Várzea', P: 'Praça do Derby', S: 'Campinho da Várzea' },
    blockNames: { '5,1': 'Marco Zero', '0,2': 'Rio Capibaribe', '1,2': 'Rio Capibaribe', '2,2': 'Rio Capibaribe', '3,2': 'Rio Capibaribe', '4,2': 'Rio Capibaribe', '5,2': 'Rio Capibaribe' },
    landmarks: [{ id: 'galo_gigante', col: 5, row: 1 }],
    bridges: { x: [2, 5] },
    backdrop: [{ model: 'bd_olinda', side: 'n', along: 0.35, out: 150 }],
    extraProps: {
      A: [{ id: 'barraca_praia', w: 3 }, { id: 'sombrinha_frevo', w: 2 }, { id: 'jangada', w: 1.2 }],
      K: [{ id: 'sombrinha_frevo', w: 6 }],
      L: [{ id: 'sombrinha_frevo', w: 6 }],
      C: [{ id: 'sombrinha_frevo', w: 2 }],
      R: [{ id: 'sombrinha_frevo', w: 1 }],
    },
    extraRares: { A: [{ id: 'tubarao', w: 3 }] },
    boats: [{ id: 'jangada', w: 3 }, { id: 'lancha', w: 2 }, { id: 'barco_pesca', w: 1.5 }],
    features: ['shark_signs', 'jangadas', 'lifeguards'],
    signs: ['BAR DO ET', 'TAPIOCARIA CAPIBARIBE', 'BOLO DE ROLO DA VÓ', 'FREVO & CIA', 'CARANGUEJO DO MARCO', 'LANCHONETE MANGUE', 'PADARIA BOA VIAGEM', 'AÇAÍ DO RECIFE ANTIGO', 'CALDINHO DE FEIJÃO', 'OFICINA DO GALEGO', 'FARMÁCIA DO POVO', 'SORVETE DE MANGABA', 'CHAVEIRO VENEZA', 'ESPETINHO DO MARTE', 'SOMBRINHAS DE FREVO', 'BORRACHARIA 24H'],
    billboards: ['BOLO DE ROLO ESPACIAL — R$ 12', 'VAI TER FREVO — ATÉ NO ESPAÇO', 'VOTE NINGUÉM', 'SEU CARRO SUMIU? SEGUROS VENEZA', 'RECIFE TE ESPERA'],
    labels: { police: 'PATRULHA VENEZA', bus: '045 BOA VIAGEM / MARTE', posto: 'POSTO CAPIBARIBE', radio: 'RÁDIO FREVO FM', predio: 'EDIFÍCIO BEIRA-MAR', score: 'VENEZA 0 x 0 VISITANTE' },
    radio: [
      ['CONTROLE:', 'OBJETO NÃO IDENTIFICADO SOBRE O ATLÂNTICO...'],
      ['TORRE VENEZA:', 'ESTÁ DESCENDO NO MARCO ZERO. OXE!'],
    ],
    look: { ...BASE_LOOK, skyTop: 0x1f86e0, skyHorizon: 0xc9ecfa, fog: 0xc3e6f0, sun: 0xfff2d6, sunIntensity: 2.8, saturation: 1.18, grass: 0x6fa84c, water: [0x1f7fa0, 0x2a9bb0] },
    secret: 'tubarao',
    order: 1,
    stars: [EXTRACT, { kind: 'abduct_id', title: 'Abduza 5 sombrinhas de frevo', goal: 5, objectId: 'sombrinha_frevo' }, { kind: 'abduct_id', title: 'Abduza o Galo Gigante', goal: 1, objectId: 'galo_gigante' }],
  },
  {
    id: 'salvador',
    name: 'Salvador',
    uf: 'BA',
    nickname: 'PRIMEIRA CAPITAL',
    blurb: 'Pelourinho colorido, trio elétrico e o Elevador Lacerda ligando a Cidade Alta à Baixa.',
    lon: -38.5,
    lat: -12.97,
    difficulty: 2,
    threatMult: 0.95,
    trafficMult: 1,
    layout: ['WWIICRVV', 'WWCLKKVV', 'WWCKKRRV', 'WWACRRSR', 'WWARRFRR', 'WWARFFRU', 'WWALRRRU', 'WWWWAAAW'],
    start: { col: 4, row: 4 },
    names: { V: 'Comunidade do Alto', A: 'Porto da Barra', K: 'Pelourinho', C: 'Comércio', F: 'Iguatemi', I: 'Cidade Baixa', R: 'Rio Vermelho', U: 'Subúrbio', S: 'Campo do Bairro' },
    blockNames: { '3,1': 'Elevador Lacerda', '3,6': 'Farol da Barra', '4,7': 'Praia de Ondina', '5,7': 'Praia de Ondina', '6,7': 'Praia de Ondina' },
    landmarks: [
      { id: 'elevador_lacerda', col: 3, row: 1 },
      { id: 'farol_barra', col: 3, row: 6, dx: -8, dz: 10 },
    ],
    backdrop: [{ model: 'bd_island', side: 'w', along: 0.1, out: 220 }],
    extraProps: {
      K: [{ id: 'baiana_acaraje', w: 3 }, { id: 'fitinha', w: 5 }],
      L: [{ id: 'fitinha', w: 5 }, { id: 'baiana_acaraje', w: 2 }],
      A: [{ id: 'baiana_acaraje', w: 2 }, { id: 'barraca_praia', w: 3 }],
      C: [{ id: 'fitinha', w: 2 }, { id: 'baiana_acaraje', w: 1 }],
    },
    extraRares: { K: [{ id: 'acaraje_cosmico', w: 3 }], L: [{ id: 'acaraje_cosmico', w: 3 }] },
    boats: [{ id: 'barco_pesca', w: 2 }, { id: 'lancha', w: 2 }, { id: 'jangada', w: 1 }],
    features: ['trio', 'lifeguards'],
    signs: ['ACARAJÉ DA TIA', 'BAR DO ET', 'SORVETE DE UMBU', 'MOQUECA DA BAÍA', 'LOJA DE FITINHAS', 'CAPOEIRA ANGOLA', 'AXÉ DISCOS', 'PADARIA PELÔ', 'ABARÁ & CIA', 'FARMÁCIA DA LADEIRA', 'OFICINA DO PAINHO', 'LANCHONETE 51', 'ÓTICA OLHO GORDO', 'ESPETINHO DO MARTE', 'MERCADINHO ÓRBITA', 'BORRACHARIA 24H'],
    billboards: ['CARNAVAL INTERGALÁCTICO — PIPOCA LIBERADA', 'ACARAJÉ QUENTE OU FRIO? — QUENTE', 'VOTE NINGUÉM', 'SEU CARRO SUMIU? SEGUROS BAHIA', 'SALVADOR TE ESPERA'],
    labels: { police: 'PATRULHA BAÍA', bus: '1502 BARRA / VIA LÁCTEA', posto: 'POSTO BARRA', radio: 'RÁDIO AXÉ FM', predio: 'EDIFÍCIO FAROL', score: 'BAÍA 0 x 0 VISITANTE' },
    radio: [
      ['CONTROLE:', 'LUZES ESTRANHAS SOBRE A BAÍA DE TODOS OS SANTOS...'],
      ['TORRE BAÍA:', 'DESCENDO NO PELOURINHO, PAINHO!'],
    ],
    look: { ...BASE_LOOK, sun: 0xffdcaa, sunIntensity: 2.8, sunDir: [-110, 80, 30], skyTop: 0x2f78cf, skyHorizon: 0xffe2b8, fog: 0xf2d9b8, tint: [1.07, 1.0, 0.91], saturation: 1.17, grass: 0x7aa54e, water: [0x1e7fa8, 0x2c9ac0], cloudTint: 0xfff0dc },
    secret: 'acaraje_cosmico',
    order: 2,
    stars: [EXTRACT, { kind: 'abduct_id', title: 'Abduza o trio elétrico', goal: 1, objectId: 'trio_eletrico' }, { kind: 'abduct_id', title: 'Abduza o Elevador Lacerda', goal: 1, objectId: 'elevador_lacerda' }],
  },
  {
    id: 'rio',
    name: 'Rio de Janeiro',
    uf: 'RJ',
    nickname: 'CIDADE MARAVILHOSA',
    blurb: 'Copacabana, morros, Arcos da Lapa e um estádio colossal. O Pão de Açúcar assiste de longe.',
    lon: -43.2,
    lat: -22.9,
    difficulty: 3,
    threatMult: 1.05,
    trafficMult: 1.2,
    layout: ['VVRLRIIW', 'VVRRCFFW', 'VRCLFFCW', 'RRCCPRRW', 'VRRSRRVW', 'RRCRRCVW', 'AAAAAAAW', 'WWWWWWWW'],
    start: { col: 3, row: 5 },
    names: { V: 'Comunidade do Morro', A: 'Praia de Copacabana', C: 'Botafogo', F: 'Centro', I: 'Porto Maravilha', R: 'Tijuca', P: 'Praça General Osório', S: 'Campo do Aterro' },
    blockNames: { '3,0': 'Complexo do Estádio', '3,2': 'Lapa' },
    landmarks: [
      { id: 'estadio', col: 3, row: 0 },
      { id: 'arcos_lapa', col: 3, row: 2 },
    ],
    backdrop: [
      { model: 'bd_sugarloaf', side: 'e', along: 0.62, out: 120 },
      { model: 'bd_redeemer', side: 'n', along: -0.55, out: 170 },
      { model: 'bd_hills', side: 'w', along: 0, out: 150 },
    ],
    extraProps: {
      A: [{ id: 'barraca_praia', w: 4 }, { id: 'rede_volei', w: 1 }, { id: 'carrinho_mate', w: 2 }, { id: 'biscoito', w: 5 }],
      C: [{ id: 'biscoito', w: 2 }],
      L: [{ id: 'biscoito', w: 3 }, { id: 'carrinho_mate', w: 1 }],
    },
    extraRares: { A: [{ id: 'prancha_dourada', w: 3 }] },
    boats: [{ id: 'lancha', w: 3 }, { id: 'barco_pesca', w: 1 }],
    features: ['lifeguards', 'bondinho'],
    signs: ['BAR DO ET', 'BISCOITO & MATE', 'SUCO DE LARANJA C/ ACEROLA', 'PADARIA COPACABANA', 'CHOPE GELADO', 'BAR DO BIGODE', 'LOJA DE CANGAS', 'SURF SHOP ÓRBITA', 'AÇAÍ CARIOCA', 'FARMÁCIA DO LEME', 'SALÃO DA DONA NENÊ', 'PASTELARIA LAPA', 'CHAVEIRO & CIA', 'ESPETINHO DO MARTE', 'ÓTICA SOL NA CARA', 'BORRACHARIA 24H'],
    billboards: ['MATE COM LIMÃO — GELADO', 'OLHA O MATE! — OLHA O BISCOITO!', 'VOTE NINGUÉM', 'SEU CARRO SUMIU? SEGUROS GUANABARA', 'O RIO TE ESPERA'],
    labels: { police: 'PATRULHA GUANABARA', bus: '474 COPACABANA / JÚPITER', posto: 'POSTO ATLÂNTICA', radio: 'RÁDIO MARAVILHA FM', predio: 'EDIFÍCIO PRAIA', score: 'GUANABARA 0 x 0 VISITANTE' },
    radio: [
      ['CONTROLE:', 'OBJETO SOBRE A BAÍA DE GUANABARA...'],
      ['TORRE GUANABARA:', 'ESTÁ DESCENDO EM COPACABANA, MERMÃO.'],
    ],
    look: { ...BASE_LOOK, skyTop: 0x1d7ae0, skyHorizon: 0xbfe8ff, fog: 0xbfe0f0, sun: 0xfff4dc, sunIntensity: 2.8, saturation: 1.2, grass: 0x5f9e45, water: [0x1a6f9a, 0x33a7c4] },
    secret: 'prancha_dourada',
    order: 3,
    stars: [EXTRACT, { kind: 'abduct_id', title: 'Limpe a praia: 12 guarda-sóis', goal: 12, objectId: 'guarda_sol' }, { kind: 'abduct_id', title: 'Abduza os Arcos da Lapa', goal: 1, objectId: 'arcos_lapa' }],
  },
  {
    id: 'manaus',
    name: 'Manaus',
    uf: 'AM',
    nickname: 'PORTA DA AMAZÔNIA',
    blurb: 'Floresta até o horizonte, barcos recreio e o Encontro das Águas. Tem jacaré na margem.',
    lon: -60.02,
    lat: -3.1,
    difficulty: 3,
    threatMult: 1.0,
    trafficMult: 0.8,
    layout: ['MMMMMMMM', 'MMRRIIMM', 'MRRCRIIM', 'MRCLCRRM', 'RRCFCRVM', 'VRRPRRVV', 'WWWWWWWW', 'WWWWWWWW'],
    start: { col: 4, row: 5 },
    names: { V: 'Comunidade Ribeirinha', C: 'Centro', F: 'Adrianópolis', I: 'Zona Franca', R: 'Aparecida', M: 'Floresta Amazônica', P: 'Praça da Saudade' },
    blockNames: { '3,3': 'Largo de São Sebastião', '0,6': 'Rio Negro', '1,6': 'Rio Negro', '2,6': 'Rio Negro', '3,6': 'Rio Negro', '4,6': 'Encontro das Águas', '5,6': 'Rio Solimões', '6,6': 'Rio Solimões', '7,6': 'Rio Solimões' },
    landmarks: [{ id: 'teatro_amazonas', col: 3, row: 3 }],
    backdrop: [{ model: 'bd_forest', side: 'n', along: 0, out: 110 }, { model: 'bd_forest', side: 's', along: 0.3, out: 260 }],
    extraProps: {
      R: [{ id: 'palmeira_acai', w: 1 }, { id: 'arara', w: 1 }],
      V: [{ id: 'palmeira_acai', w: 2 }, { id: 'arara', w: 2 }, { id: 'capivara', w: 1 }],
      C: [{ id: 'arara', w: 1 }],
      L: [{ id: 'arara', w: 2 }],
    },
    extraRares: { M: [{ id: 'boto', w: 1 }] },
    boats: [{ id: 'barco_recreio', w: 3 }, { id: 'casa_flutuante', w: 3 }, { id: 'lancha', w: 1.5 }, { id: 'barco_pesca', w: 1 }],
    features: ['palafitas', 'jacares'],
    signs: ['TACACÁ DA DONA NENÊ', 'X-CABOQUINHO', 'AÇAÍ DE VERDADE', 'BAR DO ET', 'PEIXARIA TAMBAQUI', 'GUARANÁ DA FLORESTA', 'REDES & MAQUEIRAS', 'MOTOS ZONA FRANCA', 'PADARIA RIO NEGRO', 'FARMÁCIA DO PORTO', 'LOJA DO PESCADOR', 'SORVETE DE CUPUAÇU', 'ESPETINHO DO MARTE', 'CHAVEIRO & CIA', 'OFICINA DO CURUPIRA', 'BORRACHARIA 24H'],
    billboards: ['CUPUAÇU ESPACIAL — R$ 8', 'PASSEIO DE BARCO — ENCONTRO DAS ÁGUAS', 'VOTE NINGUÉM', 'SEU BARCO SUMIU? SEGUROS AMAZÔNIA', 'MANAUS TE ESPERA'],
    labels: { police: 'PATRULHA RIO NEGRO', bus: '640 CENTRO / SATURNO', posto: 'POSTO RIO NEGRO', radio: 'RÁDIO FLORESTA FM', predio: 'EDIFÍCIO AMAZONAS', score: 'RIO NEGRO 0 x 0 VISITANTE' },
    radio: [
      ['CONTROLE:', 'OBJETO SOBRE A FLORESTA, SENTIDO RIO NEGRO...'],
      ['TORRE RIO NEGRO:', 'ESTÁ DESCENDO NO PORTO. ÉGUA!'],
    ],
    look: { ...BASE_LOOK, skyTop: 0x3a88c8, skyHorizon: 0xdbe8e4, fog: 0xcad8d2, fogMult: 1.3, sun: 0xfff0c8, sunIntensity: 2.5, hemiGround: 0x5f7a45, saturation: 1.15, tint: [1.0, 1.02, 0.95], grass: 0x2f6e2f, water: [0x2c1c10, 0x9a7a4c], cloudTint: 0xf2f6f0 },
    secret: 'boto',
    order: 4,
    stars: [EXTRACT, { kind: 'abduct_id', title: 'Abduza 2 barcos recreio', goal: 2, objectId: 'barco_recreio' }, { kind: 'abduct_id', title: 'Abduza o Teatro Amazonas', goal: 1, objectId: 'teatro_amazonas' }],
  },
  {
    id: 'sao_paulo',
    name: 'São Paulo',
    uf: 'SP',
    nickname: 'TERRA DA GAROA',
    blurb: 'Arranha-céu até perder de vista, helicóptero em todo teto e trânsito eterno na Marginal.',
    lon: -46.63,
    lat: -23.55,
    difficulty: 4,
    threatMult: 1.15,
    trafficMult: 1.8,
    layout: ['RRCFFFCI', 'RCFLFFCI', 'CFFFFLFC', 'RCFFFFCR', 'RRCCFCRV', 'WWWWWWWW', 'VRIICRRV', 'VRIIRRUU'],
    start: { col: 5, row: 6 },
    names: { V: 'Comunidade da Zona Sul', C: 'Pinheiros', F: 'Avenida Paulista', I: 'Mooca Industrial', R: 'Vila Madalena', U: 'Periferia' },
    blockNames: { '3,1': 'Centro Velho', '5,2': 'Vão Livre da Paulista', '0,5': 'Rio Pinheiros', '1,5': 'Rio Pinheiros', '2,5': 'Rio Pinheiros', '3,5': 'Rio Pinheiros', '4,5': 'Ponte Estaiada', '5,5': 'Rio Pinheiros', '6,5': 'Rio Pinheiros', '7,5': 'Rio Pinheiros' },
    landmarks: [
      { id: 'copan', col: 3, row: 1 },
      { id: 'masp', col: 5, row: 2 },
    ],
    bridges: { x: [2, 4, 6] },
    backdrop: [{ model: 'bd_skyline', side: 'n', along: 0, out: 110 }, { model: 'bd_skyline', side: 'e', along: -0.2, out: 120, rot: Math.PI / 2 }],
    extraProps: {
      C: [{ id: 'banca_pastel', w: 3 }],
      F: [{ id: 'banca_pastel', w: 1 }],
      R: [{ id: 'banca_pastel', w: 0.6 }],
    },
    extraRares: { C: [{ id: 'pastel_gigante', w: 2 }], F: [{ id: 'pastel_gigante', w: 1 }] },
    boats: [{ id: 'lancha', w: 1 }],
    features: ['helipads', 'estaiada'],
    signs: ['PASTEL DE FEIRA', 'PADARIA 24 HORAS', 'PIZZARIA DO BAIRRO', 'BAR DO ET', 'COXINHA DA ESQUINA', 'BOLOVO DA VILA', 'LOJA DE CELULAR', 'ESTACIONAMENTO R$ 40', 'CHAVEIRO & CIA', 'COWORKING ÓRBITA', 'FARMÁCIA DA ESQUINA', 'ESFIHA DO TIO', 'OFICINA DO BIGODE', 'ÓTICA GAROA', 'LANCHONETE 51', 'BORRACHARIA 24H'],
    billboards: ['TRÂNSITO? — VOE DE DISCO', 'PASTEL + CALDO DE CANA — R$ 15', 'VOTE NINGUÉM', 'SEU CARRO SUMIU? SEGUROS PAULISTA', 'SAMPA TE ESPERA'],
    labels: { police: 'PATRULHA PAULISTA', bus: '875 PAULISTA / NETUNO', posto: 'POSTO MARGINAL', radio: 'RÁDIO GAROA FM', predio: 'EDIFÍCIO GAROA', score: 'PAULISTA 0 x 0 VISITANTE' },
    radio: [
      ['CONTROLE:', 'OBJETO SOBRE A MARGINAL. TRÂNSITO PAROU. MAIS AINDA.'],
      ['TORRE PAULISTA:', 'ESTÁ DESCENDO NA PAULISTA, MANO.'],
    ],
    look: { ...BASE_LOOK, skyTop: 0x6f8497, skyHorizon: 0xc9d0d4, fog: 0xb9c1c6, fogMult: 1.5, sun: 0xf2f0ea, sunIntensity: 2.15, hemiSky: 0xd0d8de, hemiIntensity: 1.38, saturation: 0.98, tint: [1.0, 1.0, 1.02], shadowTint: [0.95, 0.98, 1.05], grass: 0x7c8f62, water: [0x4f5a4a, 0x5d6650], cloudTint: 0xd6dadc },
    secret: 'pastel_gigante',
    order: 5,
    stars: [EXTRACT, { kind: 'abduct_id', title: 'Abduza 3 helicópteros executivos', goal: 3, objectId: 'heli_civil' }, { kind: 'abduct_id', title: 'Abduza o Museu Suspenso', goal: 1, objectId: 'masp' }],
  },
  {
    id: 'brasilia',
    name: 'Brasília',
    uf: 'DF',
    nickname: 'CAPITAL FEDERAL',
    blurb: 'Superquadras, Esplanada e o Congresso. A capital tem a defesa aérea mais pesada do país.',
    lon: -47.93,
    lat: -15.78,
    difficulty: 5,
    threatMult: 1.3,
    trafficMult: 1.2,
    layout: ['UQQQQQWW', 'BQQCQQWW', 'BCPGGLAW', 'BGGLGGWW', 'UQQCQQWW', 'UQQQQRWW', 'UIQQQRWW', 'UURRRUWW'],
    start: { col: 2, row: 5 },
    names: { Q: 'Asa Sul', C: 'Comércio Local', G: 'Esplanada dos Ministérios', P: 'Setor de Diversões', A: 'Pontão do Lago', I: 'SIA', R: 'Cruzeiro', U: 'Cerrado', B: 'Base Aérea do Planalto' },
    blockNames: { '5,2': 'Praça dos Três Poderes', '3,3': 'Eixo Monumental', '6,0': 'Lago Paranoá', '7,0': 'Lago Paranoá' },
    landmarks: [
      { id: 'congresso', col: 5, row: 2 },
      { id: 'palacio', col: 3, row: 3 },
    ],
    backdrop: [{ model: 'bd_tv_tower', side: 'w', along: -0.1, out: 90 }],
    extraProps: {
      Q: [{ id: 'ipe', w: 2 }],
      U: [{ id: 'pequi', w: 6 }],
    },
    extraRares: { Q: [{ id: 'pequi_radioativo', w: 2 }] },
    boats: [{ id: 'lancha', w: 3 }],
    features: [],
    signs: ['PAMONHARIA DO CERRADO', 'PADARIA DA QUADRA', 'BAR DO ET', 'GALINHADA COM PEQUI', 'CÓPIAS E AUTENTICAÇÕES', 'CONCURSEIRO FELIZ', 'CURSINHO APROVAÇÃO', 'LANCHONETE 51', 'AÇAÍ DO EIXÃO', 'FARMÁCIA DA 108', 'CHAVEIRO & CIA', 'DESPACHANTE SOLUÇÕES', 'ESPETINHO DO MARTE', 'ÓTICA PLANALTO', 'SALÃO DA DONA NENÊ', 'BORRACHARIA 24H'],
    billboards: ['CONCURSO PÚBLICO — PARA MARCIANOS', 'PEQUI: AME OU ODEIE — NÃO MORDA', 'VOTE NINGUÉM', 'SEU CARRO SUMIU? SEGUROS PLANALTO', 'BRASÍLIA TE ESPERA'],
    labels: { police: 'PATRULHA DO PLANALTO', bus: '0.110 EIXÃO / PLUTÃO', posto: 'POSTO EIXÃO', radio: 'RÁDIO CERRADO FM', predio: 'BLOCO C', score: 'PLANALTO 0 x 0 VISITANTE' },
    radio: [
      ['CONTROLE:', 'OBJETO SOBRE O PLANALTO CENTRAL. ACIONEM TUDO.'],
      ['TORRE PLANALTO:', 'PROTOCOLO CÉU VERMELHO EM ESPERA. BOA SORTE.'],
    ],
    look: { ...BASE_LOOK, skyTop: 0x2266d8, skyHorizon: 0xd9e6ef, fog: 0xe2ddd2, fogMult: 0.9, sun: 0xfff6e2, sunIntensity: 3.0, sunDir: [-50, 130, 30], hemiGround: 0x9a6a45, saturation: 1.1, tint: [1.05, 1.0, 0.94], grass: 0xb5a863, water: [0x2b6e9a, 0x3a86b0] },
    secret: 'pequi_radioativo',
    order: 6,
    stars: [EXTRACT, { kind: 'capture_jet', title: 'Capture um caça', goal: 1 }, { kind: 'abduct_id', title: 'Abduza o Congresso Nacional', goal: 1, objectId: 'congresso' }],
  },
];

export const CITY_BY_ID: ReadonlyMap<CityId, CityDef> = new Map(CITIES.map((c) => [c.id, c]));

export function getCity(id: string): CityDef {
  return CITY_BY_ID.get(id as CityId) ?? (CITIES[0] as CityDef);
}

/** Campaign order. */
export const CAMPAIGN: readonly CityDef[] = [...CITIES].sort((a, b) => a.order - b.order);
