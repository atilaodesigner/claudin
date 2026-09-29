// Chuva fina de madrugada, toda na GPU: linhas que caem numa caixa que
// acompanha a câmera.

import * as THREE from 'three';

export class Rain {
  readonly lines: THREE.LineSegments;
  private mat: THREE.ShaderMaterial;
  private count: number;

  constructor(count = 3200) {
    this.count = count;
    const pos = new Float32Array(count * 2 * 3);
    const seed = new Float32Array(count * 2 * 3);
    const end = new Float32Array(count * 2);
    for (let i = 0; i < count; i++) {
      const s = [Math.random(), Math.random(), Math.random()];
      for (let k = 0; k < 2; k++) {
        seed.set(s, (i * 2 + k) * 3);
        end[i * 2 + k] = k;
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('seed', new THREE.BufferAttribute(seed, 3));
    g.setAttribute('endp', new THREE.BufferAttribute(end, 1));
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e6);
    this.mat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uCam: { value: new THREE.Vector3() },
        uVel: { value: new THREE.Vector3() },
        uIntensity: { value: 1 },
      },
      vertexShader: /* glsl */ `
        attribute vec3 seed;
        attribute float endp;
        uniform float uTime;
        uniform vec3 uCam;
        uniform vec3 uVel;
        varying float vA;
        void main() {
          vec3 box = vec3(46.0, 26.0, 46.0);
          vec3 p;
          p.x = uCam.x + mod(seed.x * box.x - uCam.x, box.x) - box.x * 0.5;
          p.z = uCam.z + mod(seed.z * box.z - uCam.z, box.z) - box.z * 0.5;
          p.y = mod(seed.y * box.y - uTime * (17.0 + seed.x * 5.0), box.y) + max(0.0, uCam.y - 10.0);
          // vento + velocidade do carro deixam o risco inclinado
          vec3 streak = vec3(0.25, -1.0, 0.1) * 0.42 - uVel * 0.012;
          p += streak * endp;
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          float d = length(p - uCam);
          vA = smoothstep(26.0, 6.0, d) * smoothstep(0.6, 2.5, d);
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float uIntensity;
        varying float vA;
        void main() {
          gl_FragColor = vec4(vec3(0.62, 0.66, 0.78) * vA * 0.2 * uIntensity, 1.0);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.lines = new THREE.LineSegments(g, this.mat);
    this.lines.frustumCulled = false;
    this.lines.renderOrder = 8;
  }

  /** fração das gotas desenhadas (preset de qualidade) */
  setDensity(f: number): void {
    this.lines.geometry.setDrawRange(0, Math.round(Math.min(1, f) * this.count) * 2);
  }

  update(time: number, cam: THREE.Vector3, vx: number, vz: number): void {
    this.mat.uniforms.uTime!.value = time;
    this.mat.uniforms.uCam!.value.copy(cam);
    this.mat.uniforms.uVel!.value.set(vx, 0, vz);
  }
}

const CONE_SEG = 14;
/** vértices de cada cone (na ordem das cabeças) */
export const CONE_VERTS = (CONE_SEG + 1) * 2;

/** cones de luz dos postes (luz "volumétrica" barata na chuva) */
export function buildLightCones(heads: THREE.Vector3[]): THREE.Mesh {
  const seg = CONE_SEG;
  const pos: number[] = [], nor: number[] = [], hh: number[] = [], idx: number[] = [];
  for (const h of heads) {
    const top = h.y - 0.1, r0 = 0.28, r1 = 5.2, bottom = 0.05;
    const base = pos.length / 3;
    for (let i = 0; i <= seg; i++) {
      const a = (i / seg) * Math.PI * 2;
      const cx = Math.cos(a), cz = Math.sin(a);
      const slope = (r1 - r0) / (top - bottom);
      const nl = Math.hypot(1, slope);
      pos.push(h.x + cx * r0, top, h.z + cz * r0, h.x + cx * r1, bottom, h.z + cz * r1);
      nor.push(cx / nl, slope / nl, cz / nl, cx / nl, slope / nl, cz / nl);
      hh.push(1, 0);
    }
    for (let i = 0; i < seg; i++) {
      const a = base + i * 2;
      idx.push(a, a + 1, a + 3, a, a + 3, a + 2);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('hh', new THREE.Float32BufferAttribute(hh, 1));
  g.setIndex(idx);
  g.computeBoundingSphere();
  const mat = new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color(1.0, 0.55, 0.22) }, uStrength: { value: 0.1 } },
    vertexShader: /* glsl */ `
      attribute float hh;
      varying float vH;
      varying vec3 vN;
      varying vec3 vV;
      varying float vDist;
      void main() {
        vH = hh;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vN = normalize(normalMatrix * normal);
        vV = normalize(-mv.xyz);
        vDist = -mv.z;
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      uniform float uStrength;
      varying float vH;
      varying vec3 vN;
      varying vec3 vV;
      varying float vDist;
      void main() {
        float rim = pow(abs(dot(normalize(vN), normalize(vV))), 1.6);
        float a = pow(vH, 1.4) * rim * uStrength * smoothstep(160.0, 20.0, vDist) * smoothstep(1.0, 4.0, vDist);
        gl_FragColor = vec4(uColor * a, 1.0);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  });
  const mesh = new THREE.Mesh(g, mat);
  mesh.renderOrder = 4;
  mesh.name = 'cones';
  return mesh;
}
