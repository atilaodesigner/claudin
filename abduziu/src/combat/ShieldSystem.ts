import { AdditiveBlending, Color, Mesh, ShaderMaterial, SphereGeometry, Vector3, Vector4 } from 'three';
import { BALANCE } from '../config/gameBalance';

const MAX_HITS = 4;

const VERT = /* glsl */ `
varying vec3 vNormalW;
varying vec3 vPosL;
varying vec3 vViewDir;
void main() {
  vPosL = normalize(position);
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vNormalW = normalize(mat3(modelMatrix) * normal);
  vViewDir = normalize(cameraPosition - wp.xyz);
  gl_Position = projectionMatrix * viewMatrix * wp;
}`;

const FRAG = /* glsl */ `
uniform vec3 uColor;
uniform float uTime;
uniform float uStrength;
uniform float uInstability;
uniform float uVisible;
uniform vec4 uHits[${MAX_HITS}];
varying vec3 vNormalW;
varying vec3 vPosL;
varying vec3 vViewDir;

float hexEdge(vec2 p) {
  p *= 6.0;
  vec2 r = vec2(1.0, 1.7320508);
  vec2 h = r * 0.5;
  vec2 a = mod(p, r) - h;
  vec2 b = mod(p - h, r) - h;
  vec2 g = dot(a, a) < dot(b, b) ? a : b;
  float d = max(abs(g.x), dot(abs(g), normalize(r)));
  return smoothstep(0.42, 0.5, d);
}

void main() {
  float fres = pow(1.0 - abs(dot(normalize(vNormalW), normalize(vViewDir))), 2.4);
  vec2 uv = vec2(atan(vPosL.z, vPosL.x) / 3.14159, vPosL.y);
  float hex = hexEdge(uv * vec2(2.0, 1.0));
  float ripple = 0.0;
  for (int i = 0; i < ${MAX_HITS}; i++) {
    vec4 h = uHits[i];
    float age = uTime - h.w;
    if (age < 0.0 || age > 1.2) continue;
    float d = acos(clamp(dot(vPosL, normalize(h.xyz)), -1.0, 1.0));
    float wave = 1.0 - smoothstep(0.0, 0.12, abs(d - age * 2.4));
    ripple += wave * (1.0 - age / 1.2) * 1.6;
    ripple += (1.0 - smoothstep(0.0, 0.5, d)) * max(0.0, 1.0 - age * 3.0) * 1.2;
  }
  float flicker = 1.0 - uInstability * (0.5 + 0.5 * sin(uTime * 45.0 + vPosL.y * 30.0)) * step(0.6, fract(sin(floor(uTime * 12.0)) * 43758.5));
  float a = (fres * (0.35 + hex * 0.5) * uStrength + ripple * (0.4 + hex * 0.6)) * flicker * uVisible;
  gl_FragColor = vec4(uColor * a, a);
}`;

/** Regenerating energy shield with impact ripples at the hit location. */
export class ShieldSystem {
  readonly mesh: Mesh;
  private readonly mat: ShaderMaterial;
  value = 0;
  max: number = BALANCE.player.shieldBase;
  private regenDelay = 0;
  broken = false;
  private hitIndex = 0;
  private time = 0;
  private visible = 0;
  private readonly hits: Vector4[];

  constructor() {
    this.hits = Array.from({ length: MAX_HITS }, () => new Vector4(0, 1, 0, -10));
    this.mat = new ShaderMaterial({
      uniforms: {
        uColor: { value: new Color(0x6ff4ff) },
        uTime: { value: 0 },
        uStrength: { value: 1 },
        uInstability: { value: 0 },
        uVisible: { value: 0 },
        uHits: { value: this.hits },
      },
      vertexShader: VERT,
      fragmentShader: FRAG,
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
    });
    this.mesh = new Mesh(new SphereGeometry(1, 32, 20), this.mat);
    this.mesh.renderOrder = 10;
    this.mesh.frustumCulled = false;
  }

  reset(max: number): void {
    this.max = max;
    this.value = max;
    this.broken = false;
    this.regenDelay = 0;
  }

  /** Absorbs damage, returns the overflow that goes to the hull. */
  absorb(amount: number, worldHit: Vector3 | null, center: Vector3): number {
    if (this.broken || this.value <= 0) return amount;
    this.regenDelay = BALANCE.player.shieldRegenDelay;
    if (worldHit) {
      const h = this.hits[this.hitIndex] as Vector4;
      h.set(worldHit.x - center.x, (worldHit.y - center.y) / 0.62, worldHit.z - center.z, this.time);
      this.hitIndex = (this.hitIndex + 1) % MAX_HITS;
    }
    this.visible = 1;
    const absorbed = Math.min(this.value, amount);
    this.value -= absorbed;
    if (this.value <= 0.001) {
      this.value = 0;
      this.broken = true;
      this.regenDelay = BALANCE.player.shieldBrokenDelay;
    }
    return amount - absorbed;
  }

  get justBroke(): boolean {
    return this.broken && this.value === 0 && this.regenDelay >= BALANCE.player.shieldBrokenDelay - 0.001;
  }

  /** Returns true when the shield comes back online after breaking. */
  update(dt: number, center: Vector3, ufoRadius: number, max: number, regen: number): boolean {
    this.time += dt;
    this.max = max;
    let restored = false;
    if (this.regenDelay > 0) this.regenDelay -= dt;
    else if (this.value < this.max) {
      this.value = Math.min(this.max, this.value + regen * dt);
      if (this.broken && this.value > this.max * 0.25) {
        this.broken = false;
        restored = true;
        this.visible = 1;
      }
    }
    this.visible = Math.max(this.broken ? 0 : 0.12, this.visible - dt * 1.4);
    const frac = this.max > 0 ? this.value / this.max : 0;
    const u = this.mat.uniforms;
    u.uTime!.value = this.time;
    u.uStrength!.value = 0.4 + frac * 0.8;
    u.uInstability!.value = frac < 0.4 ? (0.4 - frac) * 2 : 0;
    u.uVisible!.value = this.broken ? 0 : Math.max(this.visible, 0.18 + (1 - frac) * 0.3);
    this.mesh.visible = !this.broken && this.value > 0;
    this.mesh.position.copy(center);
    this.mesh.scale.set(ufoRadius * 1.45, ufoRadius * 0.9, ufoRadius * 1.45);
    return restored;
  }

  get fraction(): number {
    return this.max > 0 ? this.value / this.max : 0;
  }
}
