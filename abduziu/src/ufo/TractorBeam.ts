import {
  AdditiveBlending,
  Color,
  CylinderGeometry,
  DoubleSide,
  FrontSide,
  Group,
  Mesh,
  RingGeometry,
  ShaderMaterial,
  Vector3,
  type Texture,
} from 'three';
import { damp } from '../utils/math';

const BEAM_VERT = /* glsl */ `
uniform float uTopR;
uniform float uBottomR;
uniform float uHeight;
uniform float uTime;
uniform float uWobble;
varying vec2 vUv;
varying float vFres;
void main() {
  vUv = uv;
  float t = position.y + 0.5;
  float r = mix(uBottomR, uTopR, pow(t, 0.9));
  float ang = atan(position.z, position.x);
  r *= 1.0 + sin(ang * 5.0 + uTime * 3.0 + t * 8.0) * 0.025 * uWobble;
  vec3 p = vec3(normalize(position.xz + 1e-5).x * r, t * uHeight, normalize(position.xz + 1e-5).y * r);
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  vec3 n = normalize(normalMatrix * vec3(normalize(position.xz + 1e-5).x, 0.0, normalize(position.xz + 1e-5).y));
  vFres = 1.0 - abs(dot(n, normalize(-mv.xyz)));
  gl_Position = projectionMatrix * mv;
}`;

const BEAM_FRAG = /* glsl */ `
uniform vec3 uColor;
uniform vec3 uCore;
uniform float uTime;
uniform float uIntensity;
uniform float uStrain;
uniform float uPulse;
uniform sampler2D uNoise;
varying vec2 vUv;
varying float vFres;
void main() {
  float t = vUv.y;
  float rings = pow(fract(t * 5.0 - uTime * (1.4 + uIntensity)), 10.0) * 0.55;
  float streak = texture2D(uNoise, vec2(vUv.x * 3.0 + uTime * 0.07, t * 0.7 - uTime * 0.55)).r;
  streak = smoothstep(0.45, 0.85, streak);
  float edge = pow(vFres, 2.2);
  float body = 0.05 + edge * 0.5 + streak * 0.2 + rings;
  float fade = smoothstep(0.0, 0.12, t) * (0.55 + 0.45 * t);
  vec3 col = mix(uColor, uCore, edge * 0.5 + rings * 0.5);
  col = mix(col, vec3(1.0, 0.45, 0.15), uStrain * 0.6 * (0.5 + 0.5 * sin(uTime * 40.0)));
  float a = body * fade * uIntensity * (1.0 + uPulse * 1.5);
  gl_FragColor = vec4(col * a, a);
}`;

const RING_FRAG = /* glsl */ `
uniform vec3 uColor;
uniform float uTime;
uniform float uIntensity;
uniform float uPulse;
varying vec2 vUv;
varying vec3 vPos;
void main() {
  float r = length(vPos.xy);
  float ang = atan(vPos.y, vPos.x);
  float dashes = step(0.5, fract(ang * 6.0 / 3.14159 + uTime * 0.6));
  float outer = smoothstep(0.86, 0.94, r) * (1.0 - smoothstep(0.97, 1.0, r));
  float inner = (1.0 - smoothstep(0.0, 0.95, r)) * 0.22;
  float wave = (1.0 - smoothstep(0.0, 0.08, abs(r - fract(uTime * 0.8)))) * 0.35;
  float a = (outer * (0.6 + dashes * 0.6) + inner + wave + uPulse * inner * 3.0) * uIntensity;
  gl_FragColor = vec4(uColor * a * 1.6, a);
}`;

const RING_VERT = /* glsl */ `
varying vec2 vUv;
varying vec3 vPos;
void main() { vUv = uv; vPos = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;

interface BeamVisual {
  cone: Mesh;
  ring: Mesh;
  coneMat: ShaderMaterial;
  ringMat: ShaderMaterial;
}

/** The TRACTOR BEAM visuals: main cone + ground ring + satellite beams. */
export class TractorBeam {
  readonly group = new Group();
  private readonly main: BeamVisual;
  private readonly sats: BeamVisual[] = [];
  readonly color = new Color(0x4dffa0);
  private readonly targetColor = new Color(0x4dffa0);
  private readonly core = new Color(0xeafff4);
  intensity = 1;
  /** Extra dimmer (the meme close-up films from inside the cone). */
  dim = 1;
  private intensityTarget = 1;
  private pulse = 0;
  private strain = 0;
  private time = 0;
  readonly satellitePositions: Vector3[] = [];

  constructor(private readonly noise: Texture) {
    this.main = this.createVisual();
    for (let i = 0; i < 4; i++) {
      const s = this.createVisual();
      s.cone.visible = false;
      s.ring.visible = false;
      this.sats.push(s);
      this.satellitePositions.push(new Vector3());
    }
  }

  private createVisual(): BeamVisual {
    const coneMat = new ShaderMaterial({
      uniforms: {
        uTopR: { value: 0.5 },
        uBottomR: { value: 2 },
        uHeight: { value: 8 },
        uTime: { value: 0 },
        uWobble: { value: 1 },
        uColor: { value: this.color },
        uCore: { value: this.core },
        uIntensity: { value: 1 },
        uStrain: { value: 0 },
        uPulse: { value: 0 },
        uNoise: { value: this.noise },
      },
      vertexShader: BEAM_VERT,
      fragmentShader: BEAM_FRAG,
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      side: DoubleSide,
    });
    const cone = new Mesh(new CylinderGeometry(1, 1, 1, 40, 1, true), coneMat);
    cone.frustumCulled = false;
    cone.renderOrder = 5;
    const ringMat = new ShaderMaterial({
      uniforms: { uColor: { value: this.color }, uTime: { value: 0 }, uIntensity: { value: 1 }, uPulse: { value: 0 } },
      vertexShader: RING_VERT,
      fragmentShader: RING_FRAG,
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
    });
    const ring = new Mesh(new RingGeometry(0.0, 1, 48, 1), ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.renderOrder = 4;
    ring.frustumCulled = false;
    this.group.add(cone, ring);
    return { cone, ring, coneMat, ringMat };
  }

  setLowQuality(low: boolean): void {
    for (const v of [this.main, ...this.sats]) v.coneMat.side = low ? FrontSide : DoubleSide;
  }

  setColor(hex: number): void {
    this.targetColor.setHex(hex);
  }

  setActive(active: boolean): void {
    this.intensityTarget = active ? 1 : 0;
  }

  onAbsorb(): void {
    this.pulse = Math.min(1.5, this.pulse + 0.5);
  }

  setStrain(v: number): void {
    this.strain = Math.max(this.strain, v);
  }

  private apply(v: BeamVisual, x: number, groundY: number, z: number, topY: number, topR: number, bottomR: number, intensity: number): void {
    v.cone.position.set(x, groundY, z);
    const u = v.coneMat.uniforms;
    u.uTopR!.value = topR;
    u.uBottomR!.value = bottomR;
    u.uHeight!.value = Math.max(0.5, topY - groundY);
    u.uTime!.value = this.time;
    u.uIntensity!.value = intensity;
    u.uStrain!.value = this.strain;
    u.uPulse!.value = this.pulse;
    v.ring.position.set(x, groundY + 0.08, z);
    v.ring.scale.setScalar(bottomR);
    const r = v.ringMat.uniforms;
    r.uTime!.value = this.time;
    r.uIntensity!.value = intensity;
    r.uPulse!.value = this.pulse;
    v.cone.visible = intensity > 0.01;
    v.ring.visible = intensity > 0.01;
  }

  /**
   * @param power 0..n visual power (bigger/brighter with upgrades and combo)
   */
  update(dt: number, ufoPos: Vector3, groundY: number, ufoRadius: number, beamRadius: number, power: number, satellites: number, satRadius: number, satGround: (x: number, z: number) => number): void {
    this.time += dt;
    this.color.lerp(this.targetColor, 1 - Math.exp(-5 * dt));
    this.intensity = damp(this.intensity, this.intensityTarget, 6, dt);
    this.pulse = Math.max(0, this.pulse - dt * 3);
    this.strain = Math.max(0, this.strain - dt * 2.5);
    const inten = this.intensity * (0.75 + Math.min(0.9, power * 0.12)) * this.dim;
    const topY = ufoPos.y - ufoRadius * 0.3;
    this.apply(this.main, ufoPos.x, groundY, ufoPos.z, topY, ufoRadius * 0.34, beamRadius, inten);

    for (let i = 0; i < this.sats.length; i++) {
      const s = this.sats[i]!;
      if (i >= satellites) {
        s.cone.visible = false;
        s.ring.visible = false;
        continue;
      }
      const a = this.time * 0.9 + (i / Math.max(1, satellites)) * Math.PI * 2;
      const off = beamRadius + satRadius * 1.15;
      const sx = ufoPos.x + Math.cos(a) * off;
      const sz = ufoPos.z + Math.sin(a) * off;
      this.satellitePositions[i]!.set(sx, 0, sz);
      const g = satGround(sx, sz);
      const topX = ufoPos.x + Math.cos(a) * ufoRadius * 0.85;
      const topZ = ufoPos.z + Math.sin(a) * ufoRadius * 0.85;
      // satellite cone leans from the rim to its ground spot: approximate with a vertical cone at the midpoint
      this.apply(s, (sx + topX) / 2, g, (sz + topZ) / 2, topY, ufoRadius * 0.12, satRadius, inten * 0.8);
      s.ring.position.set(sx, g + 0.08, sz);
    }
  }
}
