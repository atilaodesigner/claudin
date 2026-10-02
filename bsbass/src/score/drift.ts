// Pontuação de drift: combo que cresce enquanto você emenda drifts,
// multiplicador por tempo de lado, bônus de "raspando" no tráfego
// e perda do combo se bater.

export const DRIFT_MIN_ANGLE = 12; // graus
export const DRIFT_MIN_SPEED = 28; // km/h
export const GRACE = 1.8; // s pra emendar o próximo drift sem perder o combo
export const MULT_STEP = 2.4; // s de drift pra subir o multiplicador
export const MAX_MULT = 10;

export type DriftEvent =
  | { type: 'start' }
  | { type: 'bank'; points: number; label: string; mult: number }
  | { type: 'lost'; points: number }
  | { type: 'mult'; mult: number }
  | { type: 'nearMiss'; points: number };

export interface DriftSample {
  speedKmh: number;
  angleDeg: number; // absoluto
  forward: boolean;
  surface: number; // 1 asfalto, <1 terra (vale um pouco menos)
}

export function bankLabel(points: number): string {
  if (points >= 100_000) return 'LENDA DO DF!';
  if (points >= 40_000) return 'É O CRIME!';
  if (points >= 15_000) return 'CABULOSO!';
  if (points >= 5_000) return 'MASSA DEMAIS!';
  if (points >= 1_500) return 'BOA, VÉI!';
  return 'DE LADO!';
}

export class DriftScorer {
  total = 0;
  chain = 0; // pontos crus do combo atual
  mult = 1;
  driftTime = 0; // tempo acumulado de lado no combo
  grace = 0; // tempo restante pra emendar
  drifting = false;
  angle = 0;
  best = 0; // maior combo já fechado
  nitroGain = 0; // nitro gerado nesse frame (0..)

  get active(): boolean {
    return this.chain > 0;
  }

  get chainValue(): number {
    return Math.round(this.chain * this.mult);
  }

  update(dt: number, s: DriftSample): DriftEvent[] {
    const ev: DriftEvent[] = [];
    this.angle = s.angleDeg;
    this.nitroGain = 0;
    const isDrift = s.forward && s.angleDeg >= DRIFT_MIN_ANGLE && s.speedKmh >= DRIFT_MIN_SPEED;

    if (isDrift) {
      if (!this.drifting && !this.active) ev.push({ type: 'start' });
      this.drifting = true;
      this.grace = GRACE;
      const a = Math.min(s.angleDeg, 70);
      const angleF = (a - DRIFT_MIN_ANGLE * 0.5) / 30; // ~0.2 .. 2.1
      const speedF = Math.min(s.speedKmh, 180) / 60; // ~0.5 .. 3
      this.chain += dt * 160 * angleF * speedF * (0.6 + 0.4 * s.surface);
      this.driftTime += dt;
      const m = Math.min(MAX_MULT, 1 + Math.floor(this.driftTime / MULT_STEP));
      if (m > this.mult) {
        this.mult = m;
        ev.push({ type: 'mult', mult: m });
      }
      this.nitroGain = dt * 0.07 * Math.min(angleF, 1.5);
    } else {
      this.drifting = false;
      if (this.active) {
        this.grace -= dt;
        if (this.grace <= 0) ev.push(this.bank());
      }
    }
    return ev;
  }

  /** passou raspando num carro durante o combo */
  nearMiss(): DriftEvent | null {
    if (!this.active) return null;
    const pts = 250;
    this.chain += pts;
    this.driftTime += MULT_STEP * 0.5;
    const m = Math.min(MAX_MULT, 1 + Math.floor(this.driftTime / MULT_STEP));
    this.mult = Math.max(this.mult, m);
    this.grace = GRACE;
    return { type: 'nearMiss', points: pts * this.mult };
  }

  crash(): DriftEvent | null {
    if (!this.active) return null;
    const lost = this.chainValue;
    this.resetChain();
    return { type: 'lost', points: lost };
  }

  private bank(): DriftEvent {
    const points = this.chainValue;
    const mult = this.mult;
    this.total += points;
    this.best = Math.max(this.best, points);
    this.resetChain();
    return { type: 'bank', points, label: bankLabel(points), mult };
  }

  private resetChain(): void {
    this.chain = 0;
    this.mult = 1;
    this.driftTime = 0;
    this.grace = 0;
    this.drifting = false;
  }
}
