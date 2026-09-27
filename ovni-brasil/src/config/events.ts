/** Random events. The EventDirector uses these to guarantee novelty every ~30 seconds. */
export type RandomEventId = 'festa_rua' | 'carro_forte' | 'carreta' | 'meteoros' | 'invasao_militar' | 'lendario';

export interface RandomEventDef {
  id: RandomEventId;
  title: string;
  subtitle: string;
  weight: number;
  minTime: number;
  minTier: number;
  minAlert: number;
  duration: number;
  cooldown: number;
}

export const RANDOM_EVENTS: readonly RandomEventDef[] = [
  { id: 'festa_rua', title: 'FESTA DE RUA!', subtitle: 'Muita coisa pequena junta. Hora do combo.', weight: 1.4, minTime: 50, minTier: 0, minAlert: 0, duration: 40, cooldown: 90 },
  { id: 'carro_forte', title: 'CARRO-FORTE EM FUGA', subtitle: 'Abduza antes que escape!', weight: 1, minTime: 100, minTier: 2, minAlert: 1, duration: 28, cooldown: 110 },
  { id: 'carreta', title: 'CARRETA PESADA', subtitle: 'Carga extremamente valiosa na avenida.', weight: 0.8, minTime: 160, minTier: 4, minAlert: 0, duration: 45, cooldown: 140 },
  { id: 'meteoros', title: 'CHUVA DE METEOROS', subtitle: 'Fragmentos alienígenas caindo na cidade.', weight: 0.8, minTime: 130, minTier: 2, minAlert: 0, duration: 16, cooldown: 150 },
  { id: 'invasao_militar', title: 'INVASÃO MILITAR', subtitle: 'Onda especial da Força Sentinela.', weight: 0.9, minTime: 200, minTier: 3, minAlert: 3, duration: 30, cooldown: 120 },
  { id: 'lendario', title: 'SINAL LENDÁRIO', subtitle: 'Algo raríssimo apareceu no radar.', weight: 0.6, minTime: 90, minTier: 1, minAlert: 0, duration: 60, cooldown: 160 },
];

export const EVENT_VALUES = {
  festaRua: { props: 34, people: 10, radius: 14 },
  carroForte: { speed: 9, coreBonus: 60 },
  carreta: { speed: 4 },
  meteoros: { count: 9, interval: 1.4, damageRadius: 7, playerDamage: 10 },
  invasao: { drones: 5, helicopters: 1, coreBonus: 50 },
};
