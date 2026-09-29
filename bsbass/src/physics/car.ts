// Física do carro: modelo bicicleta com pneus tipo Pacejka simplificado,
// transferência de carga, círculo de atrito na traseira (tração traseira)
// e alguns "assists" arcade pra deixar o drift gostoso de controlar.
//
// Convenções (iguais ao three.js): plano XZ, heading = rotation.y.
// Frente do carro = (sin h, cos h). Lado esquerdo = (cos h, -sin h).
// Yaw positivo e steer positivo = virar pra esquerda.

export interface CarInput {
  throttle: number; // 0..1
  brake: number; // 0..1 (também dá ré parado)
  steer: number; // -1..1 (positivo = esquerda)
  handbrake: boolean;
  nitro: boolean;
}

export const NO_INPUT: CarInput = { throttle: 0, brake: 0, steer: 0, handbrake: false, nitro: false };

export const CAR = {
  mass: 1650,
  inertia: 2900,
  cgToFront: 1.38,
  cgToRear: 1.42,
  cgHeight: 0.5,
  halfWidth: 0.98,
  halfLength: 2.42,
  mu: 1.24,
  power: 290_000, // W
  maxDrive: 9_200, // N
  nitroForce: 6_500,
  brakeForce: 14_000,
  handbrakeForce: 7_500,
  drag: 0.62,
  rolling: 14,
  maxSteer: 0.62,
  steerSpeed: 4.2,
  // curva do pneu (Pacejka "mágica" simplificada)
  tireB: 10,
  tireC: 1.32,
  rearGripHandbrake: 0.45,
  reverseMax: 9,
  maxDriftAngle: 1.15, // ~66°: limite só quando o jogador NÃO está forçando a rotação
} as const;

const G = 9.81;
const L = CAR.cgToFront + CAR.cgToRear;
const GEAR_TOP = [0, 13, 24, 35, 47, 60, 80]; // m/s de troca (1ª..6ª)

function tire(alpha: number, load: number, mu: number): number {
  return load * mu * Math.sin(CAR.tireC * Math.atan(CAR.tireB * alpha));
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

export class CarPhysics {
  x = 0;
  z = 0;
  heading = 0;
  vx = 0; // velocidade no mundo
  vz = 0;
  yawRate = 0;
  steerAngle = 0; // ângulo real das rodas dianteiras

  // telemetria (lida pelo jogo, áudio e efeitos)
  speed = 0; // m/s (módulo)
  vLong = 0; // m/s na direção do carro
  vLat = 0; // m/s pro lado esquerdo
  slipAngle = 0; // rad, ângulo entre a frente e a velocidade (β)
  driftTarget = 0; // ângulo que o controle de drift está segurando
  rearSlip = 0; // 0..1 intensidade de derrapagem da traseira
  wheelSpin = 0; // 0..1 patinando por excesso de torque
  accelLong = 0;
  accelLat = 0;
  rpm = 900;
  gear = 1;
  nitro = 0.6; // tanque 0..1
  nitroActive = false;
  surfaceGrip = 1; // asfalto 1, terra ~0.72
  throttle = 0;
  braking = false;
  reversing = false;
  wheelRot = 0; // rotação visual das rodas (rad)
  /** ajuste por carro/piloto (carros do bonde): força do motor, arrasto e aderência */
  mods = { power: 1, drag: 1, grip: 1 };

  reset(x: number, z: number, heading: number): void {
    this.x = x;
    this.z = z;
    this.heading = heading;
    this.vx = this.vz = this.yawRate = this.steerAngle = 0;
    this.speed = this.vLong = this.vLat = this.slipAngle = 0;
    this.rearSlip = this.wheelSpin = 0;
    this.accelLong = this.accelLat = 0;
    this.gear = 1;
    this.rpm = 900;
  }

  step(dt: number, input: CarInput): void {
    const sin = Math.sin(this.heading);
    const cos = Math.cos(this.heading);
    const fx = sin, fz = cos; // frente
    const lx = cos, lz = -sin; // esquerda

    let vLong = this.vx * fx + this.vz * fz;
    let vLat = this.vx * lx + this.vz * lz;
    const speed = Math.hypot(this.vx, this.vz);
    const absLong = Math.abs(vLong);

    // ---------- direção ----------
    // trava menor em alta, mas libera o contra-esterço quando a traseira sai
    const beta = speed > 1.5 ? Math.atan2(vLat, Math.max(absLong, 0.5)) : 0;
    const lockBySpeed = CAR.maxSteer * (1 / (1 + speed * 0.035));
    const lock = Math.max(lockBySpeed, Math.min(CAR.maxSteer, Math.abs(beta) + 0.18));
    // assist de contra-esterço: com o volante solto as rodas apontam pra onde o carro vai
    // (some quando o jogador esterça de propósito, pra ele poder girar o carro inteiro)
    const assist = vLong > 2 ? clamp(beta * 0.75, -0.5, 0.5) * (1 - Math.min(1, Math.abs(input.steer) * 1.3)) : 0;
    const target = clamp(input.steer * lock + assist, -CAR.maxSteer, CAR.maxSteer);
    const maxDelta = CAR.steerSpeed * dt;
    this.steerAngle += clamp(target - this.steerAngle, -maxDelta, maxDelta);
    const delta = this.steerAngle;

    // ---------- câmbio / motor ----------
    let reversing = false;
    let throttle = input.throttle;
    let brake = input.brake;
    if (brake > 0.1 && throttle < 0.1 && vLong < 0.5) {
      // parado + freio = ré
      reversing = true;
      throttle = brake;
      brake = 0;
    }
    this.reversing = reversing;

    // escolhe a marcha por velocidade (automático com histerese)
    const fwdSpeed = Math.max(0, vLong);
    if (!reversing) {
      while (this.gear < 6 && fwdSpeed > GEAR_TOP[this.gear]! * 0.98) this.gear++;
      while (this.gear > 1 && fwdSpeed < GEAR_TOP[this.gear - 1]! * 0.72) this.gear--;
    }

    // ---------- forças longitudinais ----------
    const loadStatic = CAR.mass * G;
    const loadF = clamp(loadStatic * (CAR.cgToRear / L) - (CAR.mass * this.accelLong * CAR.cgHeight) / L, loadStatic * 0.2, loadStatic * 0.8);
    const loadR = loadStatic - loadF;
    const mu = CAR.mu * this.surfaceGrip * this.mods.grip;
    const rearMax = loadR * mu;

    this.nitroActive = input.nitro && this.nitro > 0.01 && !reversing && throttle > 0.05;
    if (this.nitroActive) {
      this.nitro = Math.max(0, this.nitro - dt * 0.22);
      throttle = 1;
    }

    let drive = 0;
    if (reversing) {
      drive = vLong > -CAR.reverseMax ? -throttle * 5_500 : 0;
    } else {
      drive = throttle * this.mods.power * Math.min(CAR.maxDrive, CAR.power / Math.max(fwdSpeed, 1));
    }

    // torque demais pra tração disponível = pneu patinando
    const spin = clamp((Math.abs(drive) - rearMax * 0.92) / (rearMax * 0.5), 0, 1);
    this.wheelSpin += (spin - this.wheelSpin) * Math.min(1, dt * 8);
    let rearLong = clamp(drive, -rearMax, rearMax);

    // freio de mão trava a traseira
    if (input.handbrake && absLong > 0.5) {
      rearLong -= Math.sign(vLong) * Math.min(CAR.handbrakeForce, rearMax * 0.8);
    }

    let brakeF = 0;
    if (brake > 0 && absLong > 0.2) brakeF = -Math.sign(vLong) * brake * CAR.brakeForce;

    // ---------- forças laterais (pneus) ----------
    // em baixa velocidade o slip angle explode, então usa um piso e esmaece as forças
    const vRef = Math.max(absLong, 3);
    const alphaF = Math.atan2(vLat + this.yawRate * CAR.cgToFront, vRef) - delta * Math.sign(vLong || 1);
    const alphaR = Math.atan2(vLat - this.yawRate * CAR.cgToRear, vRef);

    let fyF = -tire(alphaF, loadF, mu);

    // traseira: círculo de atrito (torque come a aderência lateral)
    let rearGrip = 1;
    if (input.handbrake) rearGrip *= CAR.rearGripHandbrake;
    const usedLong = clamp(Math.abs(rearLong) / rearMax, 0, 0.93);
    // círculo de atrito mais "grudado": acelerar solta a traseira, mas não vira sabão
    rearGrip *= (1 - 0.5 * usedLong * usedLong) * (1 - this.wheelSpin * 0.2);
    // volante travado + pé embaixo = traseira sai de propósito (giro completo / donut)
    const lockIn = clamp((Math.abs(input.steer) - 0.75) / 0.25, 0, 1);
    rearGrip *= 1 - 0.42 * lockIn * throttle * (reversing ? 0 : 1);
    let fyR = -tire(alphaR, loadR, mu) * rearGrip;

    const lowSpeed = clamp(speed / 2, 0, 1);
    fyF *= lowSpeed;
    fyR *= lowSpeed;

    // ---------- soma no referencial do carro ----------
    const cosD = Math.cos(delta), sinD = Math.sin(delta);
    let fLong = rearLong + brakeF - fyF * sinD;
    let fLat = fyR + fyF * cosD;

    // nitro: empurrão arcade direto no chassi (não depende da tração)
    if (this.nitroActive) fLong += CAR.nitroForce;

    // arrasto aerodinâmico e rolagem
    fLong -= CAR.drag * this.mods.drag * vLong * Math.abs(vLong) + CAR.rolling * vLong;
    fLat -= CAR.rolling * 4 * vLat;

    // assist de drift: segurando o acelerador de lado o carro não "morre"
    const driftAmount = clamp((Math.abs(beta) - 0.12) / 0.5, 0, 1);
    if (!reversing && vLong > 4) fLong += throttle * driftAmount * 1_600;

    let torque = CAR.cgToFront * fyF * cosD - CAR.cgToRear * fyR;
    torque -= this.yawRate * (600 + (1 - lowSpeed) * 4_000);

    // ---------- controle de drift ----------
    // volante solto segura ~30°, contra-esterço endireita. Esterçando pra dentro
    // da curva (e/ou freio de mão) o controle sai de cena e o carro gira inteiro:
    // dá pra fazer 180°, 360° e "donut".
    this.driftTarget = 0;
    if (speed > 5 && vLong > 0.5) {
      const ab = Math.abs(beta);
      const dir = Math.sign(beta);
      const into = clamp(-dir * input.steer, -1, 1);
      // só gira livre se o jogador pedir: volante pra dentro E (pé embaixo OU freio de mão)
      const forcing = (into > 0.55 && throttle > 0.5) || (input.handbrake && into > 0.2);
      if (forcing) {
        // empurrão de rotação: deixa o carro passar de 90° e girar inteiro
        const push = 0.6 * throttle + (input.handbrake ? 0.5 : 0);
        torque -= dir * 5_500 * push * clamp(Math.abs(input.steer), 0, 1);
      } else {
        let want = 0.55 + 0.3 * Math.max(0, into) + 0.1 * throttle - 0.45 * Math.max(0, -into);
        want = clamp(want, 0.12, CAR.maxDriftAngle);
        this.driftTarget = want;
        const opening = -dir * this.yawRate;
        const over = ab + 0.3 * Math.max(0, opening) - want;
        if (over > 0) {
          torque += dir * 16_000 * over;
          if (opening > 0) torque -= this.yawRate * 4_000 * clamp(over / 0.2, 0, 1);
        }
      }
    }

    // ---------- integra ----------
    const ax = fLong / CAR.mass;
    const ay = fLat / CAR.mass;
    this.vx += (ax * fx + ay * lx) * dt;
    this.vz += (ax * fz + ay * lz) * dt;
    this.yawRate += (torque / CAR.inertia) * dt;

    // em baixíssima velocidade usa cinemática pura (sem slip), estável
    if (speed < 2.5) {
      vLong = this.vx * fx + this.vz * fz;
      const kin = (vLong * Math.tan(delta)) / L;
      const k = 1 - speed / 2.5;
      this.yawRate += (kin - this.yawRate) * k * Math.min(1, dt * 20);
      if (throttle < 0.05 && brake < 0.05 && speed < 0.4) {
        this.vx *= 0.9;
        this.vz *= 0.9;
      }
      // mata o deslize lateral residual
      const lat = this.vx * lx + this.vz * lz;
      this.vx -= lx * lat * k * Math.min(1, dt * 10);
      this.vz -= lz * lat * k * Math.min(1, dt * 10);
    }
    // parar de verdade no freio em vez de oscilar
    if (brake > 0 && Math.abs(this.vx * fx + this.vz * fz) < 0.3 && throttle < 0.05) {
      this.vx *= 0.8;
      this.vz *= 0.8;
    }

    this.heading += this.yawRate * dt;
    this.x += this.vx * dt;
    this.z += this.vz * dt;

    // ---------- telemetria ----------
    const s2 = Math.sin(this.heading), c2 = Math.cos(this.heading);
    vLong = this.vx * s2 + this.vz * c2;
    vLat = this.vx * c2 - this.vz * s2;
    this.accelLong += (ax - this.accelLong) * Math.min(1, dt * 10);
    this.accelLat += (ay - this.accelLat) * Math.min(1, dt * 10);
    this.vLong = vLong;
    this.vLat = vLat;
    this.speed = Math.hypot(this.vx, this.vz);
    this.slipAngle = this.speed > 1 ? Math.atan2(vLat, Math.abs(vLong)) : 0;
    const slide = Math.abs(vLat - this.yawRate * CAR.cgToRear);
    this.rearSlip = clamp(Math.max((slide - 2.2) / 8, this.wheelSpin * clamp(this.speed / 3, 0.4, 1)), 0, 1);
    this.throttle = throttle;
    this.braking = brake > 0.1 || (input.brake > 0.1 && !reversing);

    // rpm pro áudio
    if (reversing) {
      this.rpm = 1100 + Math.abs(vLong) * 380;
    } else {
      const lo = this.gear === 1 ? 0 : GEAR_TOP[this.gear - 1]! * 0.72;
      const hi = GEAR_TOP[this.gear]!;
      const t = clamp((fwdSpeed - lo) / (hi - lo), 0, 1);
      let target = this.gear === 1 ? 900 + t * 6100 : 3300 + t * 3700;
      target = Math.max(target, 900 + throttle * 1200);
      target += (this.wheelSpin * 2600 + this.rearSlip * throttle * 1500);
      this.rpm += (Math.min(7400, target) - this.rpm) * Math.min(1, dt * 9);
    }
    const wheelSpeed = vLong + (reversing ? 0 : this.wheelSpin * 25);
    this.wheelRot += (wheelSpeed / 0.34) * dt;
  }

  addNitro(amount: number): void {
    this.nitro = clamp(this.nitro + amount, 0, 1);
  }

  /** cantos do retângulo do carro (pra colisão) */
  get halfW(): number {
    return CAR.halfWidth;
  }
  get halfL(): number {
    return CAR.halfLength;
  }
}
