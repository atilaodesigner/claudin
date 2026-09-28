/**
 * LOJA: purely cosmetic looks for the saucer, bought with Alien Cores. Super classes
 * also ask for a best score (prestige: money alone doesn't buy them).
 */

export type CosmeticTier = 'comum' | 'raro' | 'epico' | 'lendario' | 'super';

/** Animated finishes for the fancy ones. */
export type SkinFx = 'none' | 'pulse' | 'rainbow' | 'void' | 'royal' | 'nova' | 'mothership';

export interface Skin {
  id: string;
  name: string;
  tier: CosmeticTier;
  price: number;
  /** Best score needed to unlock the purchase (super classes). */
  minScore?: number;
  description: string;
  hull: number;
  metalness: number;
  roughness: number;
  /** Rim band / rings / fins. */
  trim: number;
  dome: number;
  domeGlow: number;
  /** Rim lights / hatch / core (overridden by frenzy etc. in game). */
  accent: number;
  hullGlow?: number;
  fx: SkinFx;
}

export interface BeamStyle {
  id: string;
  name: string;
  tier: CosmeticTier;
  price: number;
  /** A colour, or 'rainbow' for the cycling one. */
  color: number | 'rainbow';
}

export const TIER_INFO: Record<CosmeticTier, { label: string; color: string }> = {
  comum: { label: 'COMUM', color: '#9fb3c8' },
  raro: { label: 'RARO', color: '#4dc9ff' },
  epico: { label: 'ÉPICO', color: '#c28bff' },
  lendario: { label: 'LENDÁRIO', color: '#ffcf3f' },
  super: { label: 'SUPER CLASSE', color: '#ff5ad1' },
};

export const SKINS: readonly Skin[] = [
  { id: 'classico', name: 'Clássico', tier: 'comum', price: 0, description: 'O disco de fábrica. Confiável como fusca.', hull: 0xc9d2dc, metalness: 0.82, roughness: 0.26, trim: 0x3b4450, dome: 0x7dffc8, domeGlow: 0x1d8f6a, accent: 0x5dffa0, fx: 'none' },
  { id: 'carbono', name: 'Carbono', tier: 'comum', price: 400, description: 'Fosco, discreto e com cheiro de carro novo.', hull: 0x2a2e35, metalness: 0.55, roughness: 0.5, trim: 0x111418, dome: 0x6fd8ff, domeGlow: 0x145b7a, accent: 0x4dc9ff, fx: 'none' },
  { id: 'camuflado', name: 'Camuflado', tier: 'comum', price: 700, description: 'Some no meio do mato. Não no meio do céu.', hull: 0x5b6b3a, metalness: 0.35, roughness: 0.7, trim: 0x2f3a1d, dome: 0xc8ff7d, domeGlow: 0x4f7a14, accent: 0xb6ff5a, fx: 'none' },
  { id: 'canarinho', name: 'Canarinho', tier: 'comum', price: 1200, description: 'Verde e amarelo, pronto pra final da Copa.', hull: 0x1f9d55, metalness: 0.6, roughness: 0.3, trim: 0xffd23f, dome: 0x5aa9ff, domeGlow: 0x1b3f9e, accent: 0xffd23f, fx: 'none' },
  { id: 'neon_rosa', name: 'Neon Rosa', tier: 'raro', price: 2500, description: 'Direto de um fliperama de 1987.', hull: 0xff4fa3, metalness: 0.5, roughness: 0.28, trim: 0x2a0b1f, dome: 0xffb3e0, domeGlow: 0x9e1b6a, accent: 0xff5ad1, hullGlow: 0x3d0a24, fx: 'none' },
  { id: 'oceano', name: 'Fundo do Mar', tier: 'raro', price: 4000, description: 'Azul abissal com brilho de água-viva.', hull: 0x0f3d6e, metalness: 0.7, roughness: 0.22, trim: 0x06182c, dome: 0x5affea, domeGlow: 0x0f8a7a, accent: 0x5affea, fx: 'pulse' },
  { id: 'cromo', name: 'Cromo Espelhado', tier: 'raro', price: 6000, description: 'Dá pra se pentear olhando pro casco.', hull: 0xf2f5f8, metalness: 1, roughness: 0.04, trim: 0x9aa4b0, dome: 0xd9f3ff, domeGlow: 0x3a6b8a, accent: 0xffffff, fx: 'none' },
  { id: 'lava', name: 'Lava', tier: 'epico', price: 15000, description: 'Rachaduras incandescentes. Não encoste.', hull: 0x2b0f0a, metalness: 0.4, roughness: 0.6, trim: 0x140504, dome: 0xffb35a, domeGlow: 0xb33a00, accent: 0xff7a1a, hullGlow: 0xff3d00, fx: 'pulse' },
  { id: 'cristal', name: 'Cristal de Gelo', tier: 'epico', price: 22000, description: 'Esculpido num cometa. Ainda está gelado.', hull: 0xbfe9ff, metalness: 0.2, roughness: 0.05, trim: 0x7ab8d9, dome: 0xffffff, domeGlow: 0x5ab0e0, accent: 0xaee8ff, hullGlow: 0x123a55, fx: 'none' },
  { id: 'ouro', name: 'Ouro 24K', tier: 'lendario', price: 60000, description: 'Pra quem abduz com classe.', hull: 0xffc83d, metalness: 1, roughness: 0.14, trim: 0x8a5a00, dome: 0xfff1b3, domeGlow: 0x9e6a00, accent: 0xffe27a, fx: 'none' },
  // ── super classes: exorbitant and gated by score
  { id: 'imperador', name: 'Imperador Galáctico', tier: 'super', price: 250_000, minScore: 2_000_000, description: 'Casco de ouro, luzes em arco-íris e uma coroa de energia. Os outros abrem caminho.', hull: 0xffd35a, metalness: 1, roughness: 0.1, trim: 0x5a2d8a, dome: 0xffffff, domeGlow: 0xc28bff, accent: 0xffffff, fx: 'royal' },
  { id: 'supernova', name: 'Supernova', tier: 'super', price: 600_000, minScore: 10_000_000, description: 'Um sol em miniatura. Brilha, pulsa e ofusca a cidade inteira.', hull: 0xfff4e0, metalness: 0.3, roughness: 0.3, trim: 0xff8a1a, dome: 0xffffff, domeGlow: 0xffb35a, accent: 0xffb020, hullGlow: 0xff7a1a, fx: 'nova' },
  { id: 'buraco_negro', name: 'Buraco Negro', tier: 'super', price: 1_200_000, minScore: 30_000_000, description: 'Negro absoluto com um horizonte de eventos roxo. Nem a luz escapa.', hull: 0x05030a, metalness: 0.9, roughness: 0.35, trim: 0x2a0b4a, dome: 0x8a4dff, domeGlow: 0x5a1dcc, accent: 0xb36bff, hullGlow: 0x1a0633, fx: 'void' },
  { id: 'nave_mae', name: 'Nave-Mãe', tier: 'super', price: 3_000_000, minScore: 100_000_000, description: 'A lenda. Cromo, ouro e um arco-íris que dá a volta no casco. Só os maiores invasores chegam aqui.', hull: 0xe9eef5, metalness: 1, roughness: 0.06, trim: 0xffc83d, dome: 0xffffff, domeGlow: 0x5affea, accent: 0xffffff, fx: 'mothership' },
];

export const BEAMS: readonly BeamStyle[] = [
  { id: 'verde', name: 'Verde Clássico', tier: 'comum', price: 0, color: 0x4dffa0 },
  { id: 'azul', name: 'Azul Elétrico', tier: 'comum', price: 300, color: 0x4dc9ff },
  { id: 'rosa', name: 'Rosa Choque', tier: 'comum', price: 300, color: 0xff5ad1 },
  { id: 'laranja', name: 'Laranja Pôr do Sol', tier: 'comum', price: 500, color: 0xff9a3d },
  { id: 'vermelho', name: 'Vermelho Alerta', tier: 'raro', price: 1500, color: 0xff4d5e },
  { id: 'roxo', name: 'Roxo Galáctico', tier: 'raro', price: 1800, color: 0xa66bff },
  { id: 'branco', name: 'Luz Branca', tier: 'raro', price: 2500, color: 0xf2fbff },
  { id: 'dourado', name: 'Raio Dourado', tier: 'lendario', price: 12000, color: 0xffd23f },
  { id: 'arco_iris', name: 'Arco-Íris', tier: 'epico', price: 20000, color: 'rainbow' },
];

export const SKIN_BY_ID = new Map(SKINS.map((s) => [s.id, s]));
export const BEAM_BY_ID = new Map(BEAMS.map((b) => [b.id, b]));
export const DEFAULT_SKIN = 'classico';
export const DEFAULT_BEAM = 'verde';

export function getSkin(id: string | undefined | null): Skin {
  return SKIN_BY_ID.get(id ?? '') ?? (SKIN_BY_ID.get(DEFAULT_SKIN) as Skin);
}
export function getBeam(id: string | undefined | null): BeamStyle {
  return BEAM_BY_ID.get(id ?? '') ?? (BEAM_BY_ID.get(DEFAULT_BEAM) as BeamStyle);
}

/** Beam colour right now (the rainbow one cycles). */
export function beamColorAt(b: BeamStyle, time: number): number {
  if (b.color !== 'rainbow') return b.color;
  return hslHex((time * 0.12) % 1, 0.9, 0.6);
}

export function hslHex(h: number, s: number, l: number): number {
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h * 12) % 12;
    return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
  };
  return (Math.round(f(0) * 255) << 16) | (Math.round(f(8) * 255) << 8) | Math.round(f(4) * 255);
}

/** Cheap looks the server/arena bots wear so rooms look varied. */
export const BOT_SKINS = ['classico', 'carbono', 'camuflado', 'canarinho', 'neon_rosa', 'oceano', 'cromo'];
