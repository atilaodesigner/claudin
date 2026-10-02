// Asfalto molhado depois do temporal: uma câmera espelhada renderiza a cena
// de baixo do chão e o material do asfalto lê essa imagem por projeção,
// com poças (espelho quase limpo) e o "borrão" vertical de rua molhada.

import * as THREE from 'three';

/** camada dos objetos que NÃO aparecem no reflexo (o próprio chão, decalques, partículas) */
export const NO_REFLECT = 1;

export class WetReflection {
  readonly target: THREE.WebGLRenderTarget;
  readonly mirror = new THREE.PerspectiveCamera();
  readonly uniforms = {
    tReflect: { value: null as THREE.Texture | null },
    tPuddle: { value: null as THREE.Texture | null },
    uReflMatrix: { value: new THREE.Matrix4() },
  };
  enabled = true;
  private scale: number;
  private v = new THREE.Vector3();
  private t = new THREE.Vector3();

  constructor(scale: number) {
    this.scale = scale;
    this.target = new THREE.WebGLRenderTarget(16, 16, { type: THREE.HalfFloatType, depthBuffer: true });
    this.target.texture.generateMipmaps = false;
    this.uniforms.tReflect.value = this.target.texture;
    this.uniforms.tPuddle.value = makePuddleTexture();
    this.mirror.layers.set(0);
  }

  setSize(w: number, h: number): void {
    this.target.setSize(Math.max(64, Math.round(w * this.scale)), Math.max(64, Math.round(h * this.scale)));
  }

  setScale(s: number, w: number, h: number): void {
    this.scale = s;
    this.setSize(w, h);
  }

  render(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.PerspectiveCamera): void {
    if (!this.enabled) return;
    const m = this.mirror;
    camera.updateMatrixWorld();
    // posição e alvo espelhados no plano y = 0
    m.position.copy(camera.position);
    m.position.y = -m.position.y;
    camera.getWorldDirection(this.v);
    this.t.copy(camera.position).addScaledVector(this.v, 10);
    this.t.y = -this.t.y;
    this.v.set(0, 1, 0).applyQuaternion(camera.quaternion);
    m.up.set(this.v.x, -this.v.y, this.v.z);
    m.lookAt(this.t);
    m.fov = camera.fov;
    m.aspect = camera.aspect;
    m.near = camera.near;
    m.far = camera.far;
    m.updateProjectionMatrix();
    m.updateMatrixWorld();
    this.uniforms.uReflMatrix.value
      .set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1)
      .multiply(m.projectionMatrix)
      .multiply(m.matrixWorldInverse);

    const prev = renderer.getRenderTarget();
    renderer.setRenderTarget(this.target);
    renderer.clear();
    renderer.render(scene, m);
    renderer.setRenderTarget(prev);
  }

  /**
   * Deixa um MeshStandardMaterial molhado. `wet` = intensidade do reflexo,
   * `puddles` = quanto das poças aparece (0 = só úmido).
   */
  patch(mat: THREE.MeshStandardMaterial, wet: number, puddles: number): void {
    const u = this.uniforms;
    mat.onBeforeCompile = (sh) => {
      sh.uniforms.tReflect = u.tReflect;
      sh.uniforms.tPuddle = u.tPuddle;
      sh.uniforms.uReflMatrix = u.uReflMatrix;
      sh.uniforms.uWet = { value: wet };
      sh.uniforms.uPuddles = { value: puddles };
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nuniform mat4 uReflMatrix;\nvarying vec4 vReflUv;\nvarying vec3 vWetPos;')
        .replace(
          '#include <project_vertex>',
          '#include <project_vertex>\nvec4 wetWp = modelMatrix * vec4(transformed, 1.0);\nvReflUv = uReflMatrix * wetWp;\nvWetPos = wetWp.xyz;',
        );
      sh.fragmentShader = sh.fragmentShader
        .replace(
          '#include <common>',
          '#include <common>\nuniform sampler2D tReflect;\nuniform sampler2D tPuddle;\nuniform float uWet;\nuniform float uPuddles;\nvarying vec4 vReflUv;\nvarying vec3 vWetPos;\nfloat wetPuddle;',
        )
        .replace(
          '#include <roughnessmap_fragment>',
          `#include <roughnessmap_fragment>
          vec4 pz = texture2D(tPuddle, vWetPos.xz / 26.0);
          vec4 pz2 = texture2D(tPuddle, vWetPos.xz / 7.0 + 0.37);
          wetPuddle = smoothstep(0.52, 0.66, pz.r * 0.8 + pz2.r * 0.25) * uPuddles;
          roughnessFactor = mix(roughnessFactor * 0.75, 0.06, wetPuddle);
          diffuseColor.rgb *= mix(0.72, 0.35, wetPuddle);`,
        )
        .replace(
          '#include <opaque_fragment>',
          `{
            vec2 ruv = vReflUv.xy / vReflUv.w;
            vec2 nrm = (texture2D(tPuddle, vWetPos.xz / 3.0).gb - 0.5);
            float rough = 1.0 - wetPuddle;
            ruv += nrm * 0.012 * rough;
            vec3 refl = vec3(0.0);
            // borrão vertical: rua molhada estica as luzes
            for (int i = 0; i < 7; i++) {
              float o = (float(i) - 3.0) / 3.0;
              refl += texture2D(tReflect, ruv + vec2(0.0, o * 0.022 * rough + o * 0.002)).rgb;
            }
            refl /= 7.0;
            vec3 vd = normalize(vViewPosition);
            float fres = pow(1.0 - clamp(abs(dot(normal, vd)), 0.0, 1.0), 4.0);
            float k = uWet * (0.3 + 0.62 * wetPuddle) * (0.35 + 0.65 * fres);
            outgoingLight += refl * k;
          }
          #include <opaque_fragment>`,
        );
    };
    mat.customProgramCacheKey = () => `wet-${wet}-${puddles}`;
  }
}

function makePuddleTexture(): THREE.CanvasTexture {
  const S = 256;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d')!;
  const img = g.createImageData(S, S);
  // ruído de valor suave e periódico (R = poça, G/B = micro-normal)
  const grid = (n: number, seed: number) => {
    const a: number[] = [];
    let s = seed;
    for (let i = 0; i < n * n; i++) {
      s = (s * 16807) % 2147483647;
      a.push(s / 2147483647);
    }
    return (x: number, y: number) => {
      const fx = (x / S) * n, fy = (y / S) * n;
      const x0 = Math.floor(fx), y0 = Math.floor(fy);
      const tx = fx - x0, ty = fy - y0;
      const sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
      const at = (i: number, j: number) => a[((j % n) + n) % n * n + (((i % n) + n) % n)]!;
      const top = at(x0, y0) * (1 - sx) + at(x0 + 1, y0) * sx;
      const bot = at(x0, y0 + 1) * (1 - sx) + at(x0 + 1, y0 + 1) * sx;
      return top * (1 - sy) + bot * sy;
    };
  };
  const n1 = grid(6, 11), n2 = grid(14, 29), n3 = grid(40, 71), n4 = grid(64, 97);
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const p = n1(x, y) * 0.65 + n2(x, y) * 0.28 + n3(x, y) * 0.07;
      const i = (y * S + x) * 4;
      img.data[i] = p * 255;
      img.data[i + 1] = n4(x, y) * 255;
      img.data[i + 2] = n4(y, x) * 255;
      img.data[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.NoColorSpace;
  return t;
}
