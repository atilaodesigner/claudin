// Configurações do jogador (qualidade gráfica, efeitos, câmera), salvas no
// localStorage separadas do progresso. Os presets definem o custo de GPU;
// "auto" começa num preset pelo tipo de aparelho e vai baixando sozinho se
// o FPS cair.

export type Preset = 'baixa' | 'media' | 'alta' | 'ultra';
export type PresetChoice = Preset | 'auto';

export interface QualityParams {
  /** teto do devicePixelRatio */
  pixelRatio: number;
  /** resolução do reflexo do asfalto molhado (0 = desligado) */
  reflection: number;
  bloom: boolean;
  /** fração das gotas de chuva */
  rain: number;
  /** luzes dinâmicas de poste / neon perto do carro */
  lamps: number;
  neon: number;
  cones: boolean;
  /** fração das partículas (fumaça, faísca) */
  particles: number;
}

export const PRESETS: Record<Preset, QualityParams> = {
  baixa: { pixelRatio: 0.75, reflection: 0, bloom: false, rain: 0.3, lamps: 2, neon: 1, cones: false, particles: 0.4 },
  media: { pixelRatio: 1, reflection: 0.3, bloom: true, rain: 0.6, lamps: 4, neon: 2, cones: true, particles: 0.7 },
  alta: { pixelRatio: 1.5, reflection: 0.5, bloom: true, rain: 1, lamps: 7, neon: 3, cones: true, particles: 1 },
  ultra: { pixelRatio: 2, reflection: 0.75, bloom: true, rain: 1.3, lamps: 10, neon: 4, cones: true, particles: 1 },
};

export const PRESET_NAMES: Record<PresetChoice, string> = { auto: 'AUTO', baixa: 'BAIXA', media: 'MÉDIA', alta: 'ALTA', ultra: 'ULTRA' };

export interface Settings {
  preset: PresetChoice;
  /** rabiscos estilo Unbound */
  doodles: boolean;
  /** rastro das lanternas e faróis */
  trails: boolean;
  rain: boolean;
  shake: boolean;
  /** aberração cromática / granulado */
  lens: boolean;
  fps: boolean;
  /** celular: botões na tela ou girar o celular (igual volante) */
  control: 'buttons' | 'tilt';
  /** girar a câmera com o mouse / arrastando o dedo */
  orbit: boolean;
}

const KEY = 'bsbass-drift-settings-v1';

export const DEFAULT_SETTINGS: Settings = { preset: 'auto', doodles: true, trails: true, rain: true, shake: true, lens: true, fps: false, control: 'buttons', orbit: true };

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    const s = { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } as Settings;
    if (!(s.preset in PRESET_NAMES)) s.preset = 'auto';
    if (s.control !== 'tilt') s.control = 'buttons';
    return s;
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(s: Settings): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* sem storage (aba anônima): vale só pra essa sessão */
  }
}

/** preset inicial do modo auto: celular começa no médio, PC no alto */
export function autoPreset(touch: boolean): Preset {
  return touch ? 'media' : 'alta';
}

/** um degrau abaixo (usado pelo auto quando o FPS cai) */
export function lowerPreset(p: Preset): Preset | null {
  const order: Preset[] = ['baixa', 'media', 'alta', 'ultra'];
  const i = order.indexOf(p);
  return i > 0 ? order[i - 1]! : null;
}
