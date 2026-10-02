// Teclado, controle (Gamepad API) e botões de toque.

import type { CarInput } from './physics/car';

export type Action = 'cam' | 'reset' | 'pause' | 'radioNext' | 'radioPrev' | 'mute' | 'radioPanel' | 'help';

export class Input {
  private keys = new Set<string>();
  touch = { left: false, right: false, gas: false, brake: false, drift: false, nitro: false };
  private steerValue = 0;
  private padPrev: boolean[] = [];
  private listeners: ((a: Action) => void)[] = [];
  usingPad = false;
  usingTouch = false;
  /** segurando o botão de ação (E / X no controle / botão na tela) */
  actHeld = false;
  /** segurando o botão do mapa (M / View no controle / botão na tela) */
  mapHeld = false;
  touchAct = false;
  touchMap = false;
  enabled = true;
  /** direção pelo giroscópio (celular deitado, igual volante) */
  tilt = false;
  /** já chegou leitura do sensor */
  tiltAlive = false;
  private tiltRaw = 0;
  private tiltSteer = 0;
  private onOrient = (e: DeviceOrientationEvent): void => {
    if (e.beta == null || e.gamma == null) return;
    this.tiltAlive = true;
    // beta = inclinação no eixo comprido do aparelho: com a tela deitada é o
    // "volante" (o mesmo se segurar em pé na frente do rosto ou mais deitado)
    const ang = screenAngle();
    const deg = ang === 90 ? -e.beta : ang === 270 ? e.beta : -e.gamma;
    const max = 24, dz = 1.5;
    const a = Math.max(0, Math.abs(deg) - dz) * Math.sign(deg);
    this.tiltRaw = Math.max(-1, Math.min(1, a / (max - dz)));
  };
  readonly state: CarInput = { throttle: 0, brake: 0, steer: 0, handbrake: false, nitro: false };

  constructor() {
    window.addEventListener('keydown', (e) => {
      if ((e.target as HTMLElement | null)?.tagName === 'INPUT') return;
      const k = e.code;
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'Tab'].includes(k)) e.preventDefault();
      if (e.repeat) return;
      this.keys.add(k);
      this.usingPad = false;
      const map: Record<string, Action> = {
        KeyC: 'cam', KeyR: 'reset', Escape: 'pause', KeyP: 'pause', KeyQ: 'radioNext', KeyZ: 'radioPrev',
        KeyO: 'mute', Tab: 'radioPanel', KeyH: 'help',
      };
      const a = map[k];
      if (a) this.emit(a);
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => {
      this.keys.clear();
      for (const k of Object.keys(this.touch) as (keyof typeof this.touch)[]) this.touch[k] = false;
    });
  }

  /** liga a direção por inclinação (no iPhone precisa vir de um toque) */
  async enableTilt(): Promise<boolean> {
    if (typeof DeviceOrientationEvent === 'undefined') return false;
    const D = DeviceOrientationEvent as unknown as { requestPermission?: () => Promise<string> };
    if (typeof D.requestPermission === 'function') {
      try {
        if ((await D.requestPermission()) !== 'granted') return false;
      } catch {
        return false;
      }
    }
    if (!this.tilt) window.addEventListener('deviceorientation', this.onOrient);
    this.tilt = true;
    return true;
  }

  disableTilt(): void {
    window.removeEventListener('deviceorientation', this.onOrient);
    this.tilt = false;
    this.tiltRaw = this.tiltSteer = 0;
  }

  on(fn: (a: Action) => void): void {
    this.listeners.push(fn);
  }

  emit(a: Action): void {
    for (const l of this.listeners) l(a);
  }

  private key(...codes: string[]): boolean {
    return codes.some((c) => this.keys.has(c));
  }

  update(dt: number): CarInput {
    const s = this.state;
    let throttle = this.key('KeyW', 'ArrowUp') || this.touch.gas ? 1 : 0;
    let brake = this.key('KeyS', 'ArrowDown') || this.touch.brake ? 1 : 0;
    let target = (this.key('KeyA', 'ArrowLeft') || this.touch.left ? 1 : 0) - (this.key('KeyD', 'ArrowRight') || this.touch.right ? 1 : 0);
    let handbrake = this.key('Space') || this.touch.drift;
    let nitro = this.key('ShiftLeft', 'ShiftRight', 'KeyN') || this.touch.nitro;
    let analog = false;
    let act = this.key('KeyE', 'Enter') || this.touchAct;
    let map = this.key('KeyM') || this.touchMap;

    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    for (const p of pads) {
      if (!p || !p.connected) continue;
      const b = (i: number) => p.buttons[i]?.value ?? 0;
      const pressed = (i: number) => (p.buttons[i]?.pressed ?? false);
      const ax = p.axes[0] ?? 0;
      const any = Math.abs(ax) > 0.15 || b(7) > 0.1 || b(6) > 0.1 || pressed(0) || pressed(1) || pressed(2);
      if (any) this.usingPad = true;
      if (!this.usingPad) continue;
      if (Math.abs(ax) > 0.12) {
        target = -Math.sign(ax) * Math.min(1, (Math.abs(ax) - 0.12) / 0.88) ** 1.4;
        analog = true;
      }
      throttle = Math.max(throttle, b(7));
      brake = Math.max(brake, b(6));
      handbrake = handbrake || pressed(0);
      nitro = nitro || pressed(1);
      act = act || pressed(2);
      map = map || pressed(8);
      const edges: [number, Action][] = [[3, 'cam'], [5, 'radioNext'], [4, 'radioPrev'], [9, 'pause'], [13, 'reset']];
      for (const [i, a] of edges) {
        const now = pressed(i);
        if (now && !this.padPrev[i]) this.emit(a);
        this.padPrev[i] = now;
      }
      break;
    }

    if (this.tilt) {
      this.tiltSteer += (this.tiltRaw - this.tiltSteer) * Math.min(1, dt * 14);
      if (!analog && target === 0) {
        target = this.tiltSteer;
        analog = true;
      }
    }

    if (!this.enabled) {
      throttle = brake = target = 0;
      handbrake = nitro = false;
    }

    if (analog) {
      this.steerValue = target;
    } else {
      // digital: rampa suave (volta pro centro mais rápido)
      const rate = target === 0 ? 7 : Math.sign(target) !== Math.sign(this.steerValue) && this.steerValue !== 0 ? 9 : 4.2;
      const d = target - this.steerValue;
      this.steerValue += Math.sign(d) * Math.min(Math.abs(d), rate * dt);
    }
    s.throttle = throttle;
    s.brake = brake;
    s.steer = this.steerValue;
    s.handbrake = handbrake;
    s.nitro = nitro;
    this.actHeld = this.enabled && act;
    this.mapHeld = map;
    return s;
  }
}

/** rotação da tela (0 em pé, 90 / 270 deitado) */
function screenAngle(): number {
  const o = (screen as Screen & { orientation?: { angle: number } }).orientation;
  const a = o ? o.angle : Number((window as unknown as { orientation?: number }).orientation ?? 0);
  return ((Math.round(a) % 360) + 360) % 360;
}
