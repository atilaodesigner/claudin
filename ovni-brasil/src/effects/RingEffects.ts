import { AdditiveBlending, Color, DoubleSide, Mesh, RingGeometry, ShaderMaterial, SphereGeometry, type Scene, type Vector3 } from 'three';

interface Ring {
  mesh: Mesh;
  mat: ShaderMaterial;
  life: number;
  maxLife: number;
  from: number;
  to: number;
  active: boolean;
  sphere: boolean;
}

const RING_FRAG = /* glsl */ `
uniform vec3 uColor;
uniform float uAlpha;
uniform float uThickness;
varying vec2 vUv;
varying vec3 vPos;
void main() {
  float r = length(vPos.xy);
  float band = 1.0 - smoothstep(0.0, uThickness, abs(r - 0.92));
  float fill = (1.0 - smoothstep(0.0, 0.92, r)) * 0.12;
  float a = (band + fill) * uAlpha;
  gl_FragColor = vec4(uColor * a * 1.8, a);
}`;

const SPHERE_FRAG = /* glsl */ `
uniform vec3 uColor;
uniform float uAlpha;
varying vec3 vNormalV;
varying vec3 vViewDir;
void main() {
  float f = 1.0 - abs(dot(normalize(vNormalV), normalize(vViewDir)));
  float a = pow(f, 2.5) * uAlpha;
  gl_FragColor = vec4(uColor * a * 2.0, a);
}`;

/** Expanding ground rings and energy spheres (EMP, shockwaves, level-up). Pooled. */
export class RingEffects {
  private readonly pool: Ring[] = [];

  constructor(private readonly scene: Scene) {
    for (let i = 0; i < 14; i++) this.pool.push(this.create(false));
    for (let i = 0; i < 6; i++) this.pool.push(this.create(true));
  }

  private create(sphere: boolean): Ring {
    const mat = sphere
      ? new ShaderMaterial({
          uniforms: { uColor: { value: new Color() }, uAlpha: { value: 1 } },
          vertexShader: `varying vec3 vNormalV; varying vec3 vViewDir; void main(){ vec4 mv = modelViewMatrix*vec4(position,1.0); vNormalV = normalMatrix*normal; vViewDir = -mv.xyz; gl_Position = projectionMatrix*mv; }`,
          fragmentShader: SPHERE_FRAG,
          transparent: true,
          depthWrite: false,
          blending: AdditiveBlending,
          side: DoubleSide,
        })
      : new ShaderMaterial({
          uniforms: { uColor: { value: new Color() }, uAlpha: { value: 1 }, uThickness: { value: 0.06 } },
          vertexShader: `varying vec2 vUv; varying vec3 vPos; void main(){ vUv = uv; vPos = position; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
          fragmentShader: RING_FRAG,
          transparent: true,
          depthWrite: false,
          blending: AdditiveBlending,
          side: DoubleSide,
        });
    const mesh = new Mesh(sphere ? new SphereGeometry(1, 24, 14) : new RingGeometry(0, 1, 64, 1), mat);
    if (!sphere) mesh.rotation.x = -Math.PI / 2;
    mesh.visible = false;
    mesh.frustumCulled = false;
    mesh.renderOrder = 9;
    this.scene.add(mesh);
    return { mesh, mat, life: 0, maxLife: 1, from: 0, to: 1, active: false, sphere };
  }

  spawn(pos: Vector3, color: number, from: number, to: number, duration: number, opts: { sphere?: boolean; thickness?: number; tilt?: boolean } = {}): void {
    const sphere = opts.sphere ?? false;
    const r = this.pool.find((x) => !x.active && x.sphere === sphere);
    if (!r) return;
    r.active = true;
    r.life = 0;
    r.maxLife = duration;
    r.from = from;
    r.to = to;
    r.mesh.position.copy(pos);
    r.mesh.visible = true;
    (r.mat.uniforms.uColor!.value as Color).setHex(color);
    if (!sphere) {
      r.mat.uniforms.uThickness!.value = opts.thickness ?? 0.06;
      r.mesh.rotation.set(opts.tilt ? -Math.PI / 2 + (Math.random() - 0.5) * 0.6 : -Math.PI / 2, 0, opts.tilt ? (Math.random() - 0.5) * 0.6 : 0);
    }
    r.mesh.scale.setScalar(from);
  }

  update(dt: number): void {
    for (const r of this.pool) {
      if (!r.active) continue;
      r.life += dt;
      const t = Math.min(1, r.life / r.maxLife);
      const e = 1 - Math.pow(1 - t, 3);
      r.mesh.scale.setScalar(r.from + (r.to - r.from) * e);
      r.mat.uniforms.uAlpha!.value = (1 - t) * (1 - t);
      if (t >= 1) {
        r.active = false;
        r.mesh.visible = false;
      }
    }
  }

  clear(): void {
    for (const r of this.pool) {
      r.active = false;
      r.mesh.visible = false;
    }
  }
}
