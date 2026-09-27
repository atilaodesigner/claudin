import { BufferAttribute, BufferGeometry, Color, LineSegments, ShaderMaterial, UniformsLib, UniformsUtils, Vector3 } from 'three';

const SEGMENTS = 7;

/**
 * Tangled Brazilian power lines between poles. One LineSegments draw call; sway in the
 * vertex shader grows near the UFO (wind from the beam). Wires snap (collapse) when a
 * pole is abducted.
 */
export class Wires {
  readonly mesh: LineSegments;
  private readonly positions: Float32Array;
  private readonly wireOfPole = new Map<number, number[]>();
  private readonly geometry: BufferGeometry;
  readonly uniforms = {
    uTime: { value: 0 },
    uUfo: { value: new Vector3(0, -999, 0) },
    uWind: { value: 0 },
    uColor: { value: new Color(0x1a1a1c) },
  };

  constructor(poleTops: ReadonlyArray<{ a: Vector3; b: Vector3; poleA: number; poleB: number }>) {
    const count = poleTops.length;
    const strands = 2;
    const vertsPerWire = SEGMENTS * 2;
    this.positions = new Float32Array(count * strands * vertsPerWire * 3);
    const tAttr = new Float32Array(count * strands * vertsPerWire);
    const phase = new Float32Array(count * strands * vertsPerWire);
    let v = 0;
    poleTops.forEach((w, wi) => {
      for (let s = 0; s < strands; s++) {
        const off = (s - 0.5) * 1.1;
        const sag = 0.9 + s * 0.35;
        const dx = w.b.x - w.a.x;
        const dz = w.b.z - w.a.z;
        const len = Math.hypot(dx, dz) || 1;
        const px = (-dz / len) * off;
        const pz = (dx / len) * off;
        const ph = wi * 1.7 + s * 0.9;
        for (let i = 0; i < SEGMENTS; i++) {
          for (let k = 0; k < 2; k++) {
            const t = (i + k) / SEGMENTS;
            const y = w.a.y + (w.b.y - w.a.y) * t - Math.sin(t * Math.PI) * sag - (s === 1 ? 0.2 : 0);
            this.positions[v * 3] = w.a.x + dx * t + px;
            this.positions[v * 3 + 1] = y;
            this.positions[v * 3 + 2] = w.a.z + dz * t + pz;
            tAttr[v] = t;
            phase[v] = ph;
            v++;
          }
        }
      }
      for (const p of [w.poleA, w.poleB]) {
        const list = this.wireOfPole.get(p) ?? [];
        list.push(wi);
        this.wireOfPole.set(p, list);
      }
    });

    this.geometry = new BufferGeometry();
    this.geometry.setAttribute('position', new BufferAttribute(this.positions, 3));
    this.geometry.setAttribute('aT', new BufferAttribute(tAttr, 1));
    this.geometry.setAttribute('aPhase', new BufferAttribute(phase, 1));
    this.geometry.computeBoundingSphere();

    const mat = new ShaderMaterial({
      uniforms: UniformsUtils.merge([UniformsLib.fog]),
      fog: true,
      vertexShader: /* glsl */ `
        attribute float aT;
        attribute float aPhase;
        uniform float uTime;
        uniform vec3 uUfo;
        uniform float uWind;
        #include <fog_pars_vertex>
        void main() {
          vec3 p = position;
          float sagW = sin(aT * 3.14159);
          float d = length(p.xz - uUfo.xz);
          float near = 1.0 - smoothstep(4.0, 28.0 + uWind * 10.0, d);
          float amp = 0.05 + near * (0.35 + uWind * 0.5);
          p.y += sin(uTime * (1.3 + near * 5.0) + aPhase) * amp * sagW;
          p.x += cos(uTime * (1.1 + near * 4.0) + aPhase * 1.3) * amp * 0.6 * sagW;
          vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
          gl_Position = projectionMatrix * mvPosition;
          #include <fog_vertex>
        }`,
      fragmentShader: /* glsl */ `
        uniform vec3 uColor;
        #include <fog_pars_fragment>
        void main() {
          gl_FragColor = vec4(uColor, 1.0);
          #include <colorspace_fragment>
          #include <fog_fragment>
        }`,
    });
    Object.assign(mat.uniforms, this.uniforms);
    this.mesh = new LineSegments(this.geometry, mat);
    this.mesh.frustumCulled = false;
    this.mesh.name = 'wires';
  }

  /** Collapse every strand attached to a pole (the wires snap). */
  snapPole(poleUid: number): number {
    const list = this.wireOfPole.get(poleUid);
    if (!list) return 0;
    const vertsPerWire = SEGMENTS * 2;
    for (const wi of list) {
      for (let s = 0; s < 2; s++) {
        const start = (wi * 2 + s) * vertsPerWire;
        for (let v = start; v < start + vertsPerWire; v++) {
          this.positions[v * 3 + 1] = -50;
        }
      }
    }
    this.wireOfPole.delete(poleUid);
    (this.geometry.getAttribute('position') as BufferAttribute).needsUpdate = true;
    return list.length;
  }
}
