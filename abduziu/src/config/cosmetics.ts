/**
 * LOJA: purely cosmetic looks for the saucer, bought with Alien Cores. Super classes
 * also ask for a best score (prestige: money alone doesn't buy them).
 */

export type CosmeticTier = 'comum' | 'raro' | 'epico' | 'lendario' | 'super';

/** Animated finishes for the fancy ones. */
export type SkinFx = 'none' | 'pulse' | 'rainbow' | 'void' | 'royal' | 'nova' | 'mothership';

/** Painted hull patterns (see ufo/SkinArt.ts). */
export type SkinPattern =
  | 'stripes'
  | 'rings'
  | 'checker'
  | 'dots'
  | 'sprinkles'
  | 'seeds'
  | 'flag_br'
  | 'camo'
  | 'flames'
  | 'zebra'
  | 'husk'
  | 'pen'
  | 'galaxy'
  | 'pride';

/** Little 3D extras that sit on the dome (see ufo/SkinArt.ts). */
export type SkinTopper =
  | 'cangaceiro'
  | 'palha'
  | 'bone'
  | 'helice'
  | 'chifres'
  | 'aureola'
  | 'antenas'
  | 'cartola'
  | 'unicornio'
  | 'tampa_caneta'
  | 'cuia'
  | 'vela'
  | 'laranja'
  | 'orelhas'
  | 'penas'
  | 'laco';

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
  /** Painted hull (the hull colour is then ignored: the paint carries it). */
  pattern?: SkinPattern;
  /** Pattern palette: [base, second, detail]. */
  patternColors?: readonly number[];
  topper?: SkinTopper;
  /** Shows up in the MEMES shelf. */
  meme?: boolean;
}

/** Animated beam colours. */
export type BeamMode = 'rainbow' | 'brasil' | 'fogo' | 'vapor';

export interface BeamStyle {
  id: string;
  name: string;
  tier: CosmeticTier;
  price: number;
  /** A colour, or one of the animated modes. */
  color: number | BeamMode;
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
  // ── painted / dressed-up ones (pricier, more personal)
  { id: 'tatico', name: 'Camuflado Tático', tier: 'epico', price: 35_000, description: 'Pintura de verdade, três tons de mato. Agora sim some no meio do céu. Mentira.', hull: 0x5b6b3a, metalness: 0.2, roughness: 0.75, trim: 0x23291a, dome: 0xc8ff7d, domeGlow: 0x4f7a14, accent: 0xb6ff5a, fx: 'none', pattern: 'camo', patternColors: [0x6b7a45, 0x3a4524, 0x9a8a5a] },
  { id: 'arco_iris_casco', name: 'Arco-Íris', tier: 'epico', price: 90_000, description: 'Sete cores no casco e um pote de ouro no fim do feixe.', hull: 0xff4d5e, metalness: 0.25, roughness: 0.35, trim: 0xffffff, dome: 0xffffff, domeGlow: 0x8a5aff, accent: 0xffffff, fx: 'rainbow', pattern: 'pride', patternColors: [0xff4d5e] },
  { id: 'jade', name: 'Jade Imperial', tier: 'lendario', price: 180_000, description: 'Pedra verde polida com frisos de ouro. Herança de família alienígena.', hull: 0x0f9d6b, metalness: 0.45, roughness: 0.12, trim: 0xffc83d, dome: 0xd9fff0, domeGlow: 0x0f8a5a, accent: 0x7dffc8, hullGlow: 0x022a1a, fx: 'none' },
  { id: 'diamante', name: 'Diamante', tier: 'lendario', price: 450_000, description: 'Lapidado num asteroide de carbono puro. Reflete a cidade inteira.', hull: 0xe6f9ff, metalness: 1, roughness: 0.02, trim: 0x9fe8ff, dome: 0xffffff, domeGlow: 0x5ad8ff, accent: 0xbff4ff, hullGlow: 0x0e2f44, fx: 'pulse' },
  { id: 'magnata', name: 'Magnata', tier: 'lendario', price: 750_000, description: 'Tão rico que abduz só pra ter onde guardar as coisas. Cartola inclusa.', hull: 0x111116, metalness: 0.9, roughness: 0.2, trim: 0xffc83d, dome: 0xfff1b3, domeGlow: 0x9e6a00, accent: 0xffd23f, fx: 'none', topper: 'cartola' },
  // ── MEMES
  { id: 'caneta_azul', name: 'Caneta Azul', tier: 'lendario', price: 220_000, meme: true, description: 'Azul caneta, caneta azul. Tampa na cabeça e o hit que ninguém tira da mente.', hull: 0x1d4ed8, metalness: 0.15, roughness: 0.3, trim: 0x0b2a7a, dome: 0xbfd7ff, domeGlow: 0x1d4ed8, accent: 0x6fa8ff, fx: 'none', pattern: 'pen', patternColors: [0x1d4ed8, 0xffffff, 0x0b2a7a], topper: 'tampa_caneta' },
  { id: 'capivara', name: 'Capivara Plena', tier: 'lendario', price: 160_000, meme: true, description: 'Calma, plena e com uma laranja na cabeça. Nada abala essa nave.', hull: 0x8b5e3c, metalness: 0.05, roughness: 0.95, trim: 0x4a3020, dome: 0xffe0b3, domeGlow: 0x9e5a14, accent: 0xffa53d, fx: 'none', topper: 'laranja' },
  { id: 'caramelo', name: 'Vira-Lata Caramelo', tier: 'epico', price: 95_000, meme: true, description: 'Patrimônio nacional. Late pra viatura e abana o feixe quando vê a vaca.', hull: 0xc98a4b, metalness: 0.05, roughness: 0.9, trim: 0x7a4a26, dome: 0xfff1d6, domeGlow: 0x9e6a2a, accent: 0xffc27a, fx: 'none', topper: 'orelhas' },
  { id: 'cangaceiro', name: 'Cangaceiro', tier: 'lendario', price: 190_000, meme: true, description: 'Chapéu de couro, estrela de ouro e coragem pra encarar o exército inteiro.', hull: 0x8a5a32, metalness: 0.1, roughness: 0.8, trim: 0xffc83d, dome: 0xffe3b3, domeGlow: 0x9e5a14, accent: 0xffd23f, fx: 'none', pattern: 'stripes', patternColors: [0x8a5a32, 0x6b4224], topper: 'cangaceiro' },
  { id: 'festa_junina', name: 'Arraiá', tier: 'epico', price: 85_000, meme: true, description: 'Xadrez, chapéu de palha e quentão no tanque. Olha a cobra! É mentira.', hull: 0xd7263d, metalness: 0.05, roughness: 0.85, trim: 0x8a5a32, dome: 0xfff1b3, domeGlow: 0xb35a00, accent: 0xffb020, fx: 'none', pattern: 'checker', patternColors: [0xf4e4c1, 0xd7263d, 0x2b2b2b], topper: 'palha' },
  { id: 'gauderio', name: 'Gaudério', tier: 'epico', price: 110_000, meme: true, description: 'Bah, tchê! Chimarrão quentinho até fora da atmosfera.', hull: 0x1f7a3a, metalness: 0.2, roughness: 0.55, trim: 0xffd23f, dome: 0xd9ffe0, domeGlow: 0x1f7a3a, accent: 0xff4d5e, fx: 'none', pattern: 'stripes', patternColors: [0x1f7a3a, 0xd7263d], topper: 'cuia' },
  { id: 'pamonha', name: 'Pamonha Fresquinha', tier: 'epico', price: 70_000, meme: true, description: 'Pamonha, pamonha, pamonha! Pura, caseira e com o carro de som embutido.', hull: 0x8cc152, metalness: 0.05, roughness: 0.85, trim: 0xefe4c8, dome: 0xfff3a8, domeGlow: 0x9e8a14, accent: 0xffe05a, fx: 'none', pattern: 'husk', patternColors: [0x9ccc65, 0x6b9c3a, 0xc5e1a5] },
  { id: 'pao_de_queijo', name: 'Pão de Queijo', tier: 'raro', price: 40_000, meme: true, description: 'Quentinho, saído do forno de Minas. Uai, abduz um cafezinho também.', hull: 0xf3c66b, metalness: 0.02, roughness: 0.9, trim: 0xb3752a, dome: 0xfff0c2, domeGlow: 0xb38a2a, accent: 0xffd27a, fx: 'none', pattern: 'dots', patternColors: [0xf3c66b, 0xd99a3a, 0xfff0c2] },
  { id: 'brigadeiro', name: 'Brigadeiro', tier: 'raro', price: 45_000, meme: true, description: 'Granulado colorido de verdade. Proibido lamber o casco.', hull: 0x4a2414, metalness: 0.1, roughness: 0.6, trim: 0x2a1408, dome: 0xffd1ec, domeGlow: 0x9e1b6a, accent: 0xff8fc7, fx: 'none', pattern: 'sprinkles', patternColors: [0x4a2414, 0xff4fa3, 0xffd23f] },
  { id: 'biscoito', name: 'Biscoito (ou Bolacha)', tier: 'raro', price: 65_000, meme: true, description: 'A discussão que dividiu o país agora voa. E abduz quem chamar errado.', hull: 0xd9a05b, metalness: 0.02, roughness: 0.9, trim: 0x8a5a2a, dome: 0xfff0d6, domeGlow: 0x8a5a2a, accent: 0xffc27a, fx: 'none', pattern: 'dots', patternColors: [0xd9a05b, 0x4a2a14, 0x2e1a0c] },
  { id: 'melancia', name: 'Melancia', tier: 'raro', price: 55_000, meme: true, description: 'Fatia geladinha de verão. Cuidado que o caroço vira projétil.', hull: 0xe8394a, metalness: 0.05, roughness: 0.5, trim: 0x2f9e44, dome: 0xffd9de, domeGlow: 0x9e1b2a, accent: 0xff7a8a, fx: 'none', pattern: 'seeds', patternColors: [0xe8394a, 0x2f9e44, 0x1a1a1a] },
  { id: 'bolo', name: 'Bolo de Aniversário', tier: 'raro', price: 60_000, meme: true, description: 'Parabéns pra você, nessa data querida... e pra vaca que foi abduzida.', hull: 0xffd1ec, metalness: 0.05, roughness: 0.7, trim: 0xffffff, dome: 0xfff1f5, domeGlow: 0xff8fc7, accent: 0xffd23f, fx: 'none', pattern: 'rings', patternColors: [0xfff1f5, 0xff8fc7, 0x7a3a1a], topper: 'vela' },
  { id: 'deu_zebra', name: 'Deu Zebra', tier: 'raro', price: 50_000, meme: true, description: 'Ninguém apostava nessa nave. Deu zebra.', hull: 0xffffff, metalness: 0.05, roughness: 0.6, trim: 0x111111, dome: 0xeeeeee, domeGlow: 0x555555, accent: 0xffffff, fx: 'none', pattern: 'zebra', patternColors: [0xffffff, 0x111111] },
  { id: 'rebaixado', name: 'Rebaixado', tier: 'epico', price: 120_000, meme: true, description: 'Tunado, com chamas no casco e um som que treme a cidade inteira.', hull: 0x111111, metalness: 0.6, roughness: 0.25, trim: 0xd3d7dc, dome: 0xffb35a, domeGlow: 0xb33a00, accent: 0xff7a1a, hullGlow: 0x1a0500, fx: 'none', pattern: 'flames', patternColors: [0x111111, 0xff5a1f, 0xffd23f], topper: 'bone' },
  { id: 'busquem', name: 'Busquem Conhecimento', tier: 'lendario', price: 260_000, meme: true, description: 'Recado do espaço pra todo mundo: busquem conhecimento. E abduzam também.', hull: 0x7dff9b, metalness: 0.3, roughness: 0.3, trim: 0x1d5a2f, dome: 0xd9ffe0, domeGlow: 0x1d8f4a, accent: 0x7dff9b, hullGlow: 0x0a2a12, fx: 'pulse', topper: 'antenas' },
  { id: 'helice', name: 'Boné de Hélice', tier: 'epico', price: 75_000, meme: true, description: 'Voa por conta própria. A nave é só enfeite.', hull: 0x4dc9ff, metalness: 0.2, roughness: 0.4, trim: 0xffd23f, dome: 0xffffff, domeGlow: 0x1d5fbf, accent: 0xffd23f, fx: 'none', pattern: 'stripes', patternColors: [0x4dc9ff, 0xffffff], topper: 'helice' },
  { id: 'anjinho', name: 'Anjinho', tier: 'epico', price: 130_000, meme: true, description: 'Abduz com todo carinho do mundo. Devolver? Aí não.', hull: 0xf7f9ff, metalness: 0.3, roughness: 0.2, trim: 0xfff1a8, dome: 0xffffff, domeGlow: 0xfff1a8, accent: 0xfff6c8, hullGlow: 0x2a2a1a, fx: 'none', topper: 'aureola' },
  { id: 'capetinha', name: 'Capetinha', tier: 'epico', price: 130_000, meme: true, description: 'Pegou o seu gato, o seu carro e a sua sogra. Não vai devolver nada.', hull: 0xb3121f, metalness: 0.4, roughness: 0.3, trim: 0x2a0508, dome: 0xff8a5a, domeGlow: 0xb32a00, accent: 0xff4d2a, hullGlow: 0x3d0505, fx: 'pulse', topper: 'chifres' },
  { id: 'fofinha', name: 'Fofinha', tier: 'raro', price: 45_000, meme: true, description: 'Bolinha, lacinho e zero piedade.', hull: 0xff8fc7, metalness: 0.1, roughness: 0.5, trim: 0xffffff, dome: 0xfff1f8, domeGlow: 0xff4fa3, accent: 0xff8fc7, fx: 'none', pattern: 'dots', patternColors: [0xff8fc7, 0xffffff, 0xffe0f0], topper: 'laco' },
  { id: 'hexa', name: 'Hexa Vem', tier: 'lendario', price: 300_000, meme: true, description: 'Verde, amarelo e azul anil, com boné de torcedor. Desta vez vai!', hull: 0x1f9d55, metalness: 0.2, roughness: 0.4, trim: 0xffd23f, dome: 0x5aa9ff, domeGlow: 0x1b3f9e, accent: 0xffd23f, fx: 'none', pattern: 'flag_br', patternColors: [0x1f9d55], topper: 'bone' },
  { id: 'unicornio', name: 'Unicórnio', tier: 'lendario', price: 480_000, meme: true, description: 'Mágico, brilhante, com chifre dourado e absolutamente desnecessário.', hull: 0xfff0fb, metalness: 0.3, roughness: 0.25, trim: 0xc8b6ff, dome: 0xffffff, domeGlow: 0xc28bff, accent: 0xffb3e0, fx: 'rainbow', pattern: 'rings', patternColors: [0xfff0fb, 0xc8b6ff, 0xffd1ec], topper: 'unicornio' },
  { id: 'carnaval', name: 'Carnaval', tier: 'lendario', price: 900_000, meme: true, description: 'Confete, purpurina e um cocar de plumas. A escola de samba mais rápida da galáxia.', hull: 0x6a1b9a, metalness: 0.5, roughness: 0.25, trim: 0xffd23f, dome: 0xffffff, domeGlow: 0xb36bff, accent: 0xffd23f, hullGlow: 0x1a0633, fx: 'rainbow', pattern: 'sprinkles', patternColors: [0x6a1b9a, 0xffd23f, 0x5dffa0], topper: 'penas' },
  // ── super classes: exorbitant and gated by score
  { id: 'imperador', name: 'Imperador Galáctico', tier: 'super', price: 250_000, minScore: 2_000_000, description: 'Casco de ouro, luzes em arco-íris e uma coroa de energia. Os outros abrem caminho.', hull: 0xffd35a, metalness: 1, roughness: 0.1, trim: 0x5a2d8a, dome: 0xffffff, domeGlow: 0xc28bff, accent: 0xffffff, fx: 'royal' },
  { id: 'supernova', name: 'Supernova', tier: 'super', price: 600_000, minScore: 10_000_000, description: 'Um sol em miniatura. Brilha, pulsa e ofusca a cidade inteira.', hull: 0xfff4e0, metalness: 0.3, roughness: 0.3, trim: 0xff8a1a, dome: 0xffffff, domeGlow: 0xffb35a, accent: 0xffb020, hullGlow: 0xff7a1a, fx: 'nova' },
  { id: 'buraco_negro', name: 'Buraco Negro', tier: 'super', price: 1_200_000, minScore: 30_000_000, description: 'Negro absoluto com um horizonte de eventos roxo. Nem a luz escapa.', hull: 0x05030a, metalness: 0.9, roughness: 0.35, trim: 0x2a0b4a, dome: 0x8a4dff, domeGlow: 0x5a1dcc, accent: 0xb36bff, hullGlow: 0x1a0633, fx: 'void' },
  { id: 'nave_mae', name: 'Nave-Mãe', tier: 'super', price: 3_000_000, minScore: 100_000_000, description: 'A lenda. Cromo, ouro e um arco-íris que dá a volta no casco. Só os maiores invasores chegam aqui.', hull: 0xe9eef5, metalness: 1, roughness: 0.06, trim: 0xffc83d, dome: 0xffffff, domeGlow: 0x5affea, accent: 0xffffff, fx: 'mothership' },
  { id: 'galaxia', name: 'Galáxia Viva', tier: 'super', price: 6_000_000, minScore: 150_000_000, description: 'Uma nebulosa inteira pintada no casco, com estrelas de verdade girando dentro. Dizem que tem vida lá.', hull: 0x1a0a3a, metalness: 0.4, roughness: 0.2, trim: 0x8a4dff, dome: 0xd9c8ff, domeGlow: 0x8a4dff, accent: 0xc28bff, hullGlow: 0x14062a, fx: 'void', pattern: 'galaxy', patternColors: [0x1a0f45, 0xa65bff, 0xff5ad1] },
  { id: 'rei_do_meme', name: 'Rei do Meme', tier: 'super', price: 12_000_000, minScore: 300_000_000, description: 'Ouro, coroa de energia, arco-íris no casco e uma cartola por cima de tudo. O ápice da internet brasileira.', hull: 0xffd35a, metalness: 0.9, roughness: 0.12, trim: 0xff5ad1, dome: 0xffffff, domeGlow: 0xffcf3f, accent: 0xffffff, hullGlow: 0x3a2400, fx: 'royal', pattern: 'pride', patternColors: [0xffd35a], topper: 'cartola', meme: true },
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
  { id: 'brasil', name: 'Pra Frente Brasil', tier: 'epico', price: 45_000, color: 'brasil' },
  { id: 'fogo', name: 'Feixe de Fogo', tier: 'lendario', price: 80_000, color: 'fogo' },
  { id: 'vapor', name: 'Vaporwave', tier: 'lendario', price: 120_000, color: 'vapor' },
];

/** What the shop calls each topper. */
export const TOPPER_NAMES: Record<SkinTopper, string> = {
  cangaceiro: 'chapéu de couro',
  palha: 'chapéu de palha',
  bone: 'boné',
  helice: 'hélice girando',
  chifres: 'chifrinhos',
  aureola: 'auréola',
  antenas: 'antenas',
  cartola: 'cartola',
  unicornio: 'chifre dourado',
  tampa_caneta: 'tampa de caneta',
  cuia: 'cuia de chimarrão',
  vela: 'vela acesa',
  laranja: 'laranja na cabeça',
  orelhas: 'orelhinhas',
  penas: 'cocar de plumas',
  laco: 'laço',
};

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

const BRASIL = [0x1fd36a, 0xffd23f, 0x3d7bff] as const;

/** Beam colour right now (the animated ones cycle). */
export function beamColorAt(b: BeamStyle, time: number): number {
  switch (b.color) {
    case 'rainbow':
      return hslHex((time * 0.12) % 1, 0.9, 0.6);
    case 'brasil': {
      // green → yellow → blue, easing between them
      const t = (time * 0.5) % 3;
      const i = Math.floor(t);
      return mixHex(BRASIL[i] as number, BRASIL[(i + 1) % 3] as number, smooth(t - i));
    }
    case 'fogo':
      // flickering orange/red
      return hslHex(0.02 + 0.06 * (0.5 + 0.5 * Math.sin(time * 9) * Math.sin(time * 3.7)), 1, 0.55);
    case 'vapor':
      // pink ↔ cyan
      return mixHex(0xff5ad1, 0x5affea, 0.5 + 0.5 * Math.sin(time * 1.4));
    default:
      return b.color;
  }
}

const smooth = (x: number) => x * x * (3 - 2 * x);

export function mixHex(a: number, b: number, t: number): number {
  const ch = (s: number) => Math.round(((a >> s) & 255) + (((b >> s) & 255) - ((a >> s) & 255)) * t);
  return (ch(16) << 16) | (ch(8) << 8) | ch(0);
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
export const BOT_SKINS = ['classico', 'carbono', 'camuflado', 'canarinho', 'neon_rosa', 'oceano', 'cromo', 'melancia', 'caramelo', 'deu_zebra', 'festa_junina'];
