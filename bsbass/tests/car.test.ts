import { describe, expect, it } from 'vitest';
import { CarPhysics, type CarInput } from '../src/physics/car';

const dt = 1 / 120;
function sim(c: CarPhysics, seconds: number, input: Partial<CarInput> | ((c: CarPhysics) => Partial<CarInput>)) {
  for (let t = 0; t < seconds; t += dt) {
    const i = typeof input === 'function' ? input(c) : input;
    c.step(dt, { throttle: 0, brake: 0, steer: 0, handbrake: false, nitro: false, ...i });
  }
}

describe('CarPhysics', () => {
  it('0-100 em menos de 6 s e anda reto', () => {
    const c = new CarPhysics();
    c.reset(0, 0, 0);
    let t100 = Infinity;
    for (let t = 0; t < 8; t += dt) {
      c.step(dt, { throttle: 1, brake: 0, steer: 0, handbrake: false, nitro: false });
      if (c.speed * 3.6 >= 100 && t100 === Infinity) t100 = t;
    }
    expect(t100).toBeLessThan(6);
    expect(Math.abs(c.x)).toBeLessThan(0.01);
    expect(c.z).toBeGreaterThan(50);
  });

  it('velocidade máxima limitada pelo arrasto', () => {
    const c = new CarPhysics();
    c.reset(0, 0, 0);
    sim(c, 60, { throttle: 1 });
    expect(c.speed * 3.6).toBeGreaterThan(200);
    expect(c.speed * 3.6).toBeLessThan(300);
  });

  it('freio para o carro e depois dá ré', () => {
    const c = new CarPhysics();
    c.reset(0, 0, 0);
    sim(c, 4, { throttle: 1 });
    sim(c, 3.5, { brake: 1 });
    expect(c.speed).toBeLessThan(2);
    sim(c, 3, { brake: 1 });
    expect(c.vLong).toBeLessThan(-3);
    expect(c.reversing).toBe(true);
  });

  it('freio de mão em velocidade joga a traseira (drift)', () => {
    const c = new CarPhysics();
    c.reset(0, 0, 0);
    sim(c, 4, (car) => ({ throttle: car.speed < 22 ? 1 : 0.2 }));
    let maxSlip = 0;
    sim(c, 1.2, (car) => {
      maxSlip = Math.max(maxSlip, Math.abs(car.slipAngle));
      return { steer: 1, handbrake: true, throttle: 0.6 };
    });
    expect(maxSlip * 57.3).toBeGreaterThan(25);
    expect(c.rearSlip).toBeGreaterThan(0.5);
  });

  it('dá pra sustentar o drift com acelerador e contra-esterço', () => {
    const c = new CarPhysics();
    c.reset(0, 0, 0);
    sim(c, 4, (car) => ({ throttle: car.speed < 22 ? 1 : 0.2 }));
    sim(c, 0.5, { steer: 1, handbrake: true, throttle: 0.6 });
    let sideways = 0;
    for (let t = 0; t < 4; t += dt) {
      const s = c.slipAngle;
      c.step(dt, { throttle: 0.9, brake: 0, steer: s < -0.7 ? -0.7 : s < -0.35 ? 0.1 : 0.7, handbrake: false, nitro: false });
      if (Math.abs(c.slipAngle) > 0.21 && c.speed > 8) sideways += dt;
    }
    expect(sideways).toBeGreaterThan(1.5);
    expect(c.speed * 3.6).toBeGreaterThan(30);
  });

  it('volante solto em curva leve não vira pião', () => {
    const c = new CarPhysics();
    c.reset(0, 0, 0);
    sim(c, 3, (car) => ({ throttle: car.speed < 20 ? 1 : 0 }));
    sim(c, 3, { steer: 0.4, throttle: 0.3 });
    expect(Math.abs(c.slipAngle) * 57.3).toBeLessThan(12);
  });

  it('nitro gasta o tanque e empurra mais', () => {
    const a = new CarPhysics();
    const b = new CarPhysics();
    a.reset(0, 0, 0);
    b.reset(0, 0, 0);
    b.nitro = 1;
    sim(a, 3, { throttle: 1 });
    sim(b, 3, { throttle: 1, nitro: true });
    expect(b.speed).toBeGreaterThan(a.speed + 3);
    expect(b.nitro).toBeLessThan(0.5);
  });
});
