/** Secondary objectives: each run rolls 3. */
export type ChallengeKind =
  | 'abduct_tag'
  | 'abduct_count'
  | 'destroy_enemy'
  | 'combo'
  | 'survive_max_alert'
  | 'capture_jet'
  | 'no_damage_streak'
  | 'reach_alert'
  | 'mass_tons'
  | 'perfect_dodge'
  | 'abduct_radar';

export interface ChallengeTemplate {
  kind: ChallengeKind;
  title: (goal: number) => string;
  goals: readonly number[];
  reward: number;
  tag?: string;
  enemy?: string;
  weight: number;
}

export const CHALLENGES: readonly ChallengeTemplate[] = [
  { kind: 'abduct_tag', tag: 'carro', title: (g) => `Abduza ${g} carros`, goals: [8, 12, 20], reward: 60, weight: 1.2 },
  { kind: 'abduct_tag', tag: 'onibus', title: (g) => (g === 1 ? 'Abduza um ônibus' : `Abduza ${g} ônibus`), goals: [1, 3], reward: 80, weight: 1 },
  { kind: 'abduct_tag', tag: 'animal', title: (g) => `Abduza ${g} animais`, goals: [6, 10], reward: 40, weight: 0.8 },
  { kind: 'abduct_tag', tag: 'casa', title: (g) => (g === 1 ? 'Arranque uma casa inteira' : `Arranque ${g} casas inteiras`), goals: [1, 3], reward: 90, weight: 0.9 },
  { kind: 'abduct_tag', tag: 'predio', title: () => 'Abduza um prédio', goals: [1], reward: 150, weight: 0.5 },
  { kind: 'abduct_count', title: (g) => `Abduza ${g} objetos`, goals: [150, 250, 400], reward: 50, weight: 1 },
  { kind: 'destroy_enemy', enemy: 'helicopter', title: (g) => `Derrube ${g} helicópteros`, goals: [1, 3], reward: 90, weight: 0.9 },
  { kind: 'destroy_enemy', enemy: 'drone', title: (g) => `Derrube ${g} drones`, goals: [5, 10], reward: 60, weight: 1 },
  { kind: 'combo', title: (g) => `Faça combo x${g}`, goals: [20, 30, 50], reward: 70, weight: 1.1 },
  { kind: 'survive_max_alert', title: (g) => `Sobreviva ${g}s no alerta máximo`, goals: [60], reward: 160, weight: 0.4 },
  { kind: 'capture_jet', title: () => 'Capture um caça', goals: [1], reward: 150, weight: 0.6 },
  { kind: 'no_damage_streak', title: (g) => `Abduza ${g} objetos sem tomar dano`, goals: [60, 100], reward: 70, weight: 0.8 },
  { kind: 'reach_alert', title: (g) => `Chegue ao alerta ${g}`, goals: [3, 4, 5], reward: 50, weight: 0.9 },
  { kind: 'mass_tons', title: (g) => `Abduza ${g} toneladas`, goals: [50, 200, 1000], reward: 60, weight: 0.8 },
  { kind: 'perfect_dodge', title: (g) => `Faça ${g} desvios perfeitos`, goals: [2, 4], reward: 70, weight: 0.6 },
  { kind: 'abduct_radar', title: () => 'Destrua uma torre de radar', goals: [1], reward: 120, weight: 0.5 },
];
