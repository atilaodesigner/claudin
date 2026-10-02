// Texturas reais (ambientCG) aplicadas por projeção de mundo ("triplanar")
// nas peças de cor lisa: concreto, concreto com ferragem aparecendo e ferro
// enferrujado. A cor de vértice continua tingindo por cima (pintura).

import * as THREE from 'three';

export interface TriplanarTextures {
  conc?: THREE.Texture;
  rebar?: THREE.Texture;
  metal?: THREE.Texture;
}

export function patchTriplanar(mat: THREE.MeshStandardMaterial, t: TriplanarTextures): void {
  if (!t.conc || !t.rebar || !t.metal) return;
  const white = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1);
  white.needsUpdate = true;
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.tConc = { value: t.conc };
    sh.uniforms.tRebar = { value: t.rebar };
    sh.uniforms.tMetal = { value: t.metal ?? white };
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float mid;\nvarying float vMid;\nvarying vec3 vTriP;\nvarying vec3 vTriN;')
      .replace(
        '#include <project_vertex>',
        '#include <project_vertex>\nvMid = mid;\nvTriP = (modelMatrix * vec4(transformed, 1.0)).xyz;\nvTriN = normalize(mat3(modelMatrix) * objectNormal);',
      );
    sh.fragmentShader = sh.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        uniform sampler2D tConc;
        uniform sampler2D tRebar;
        uniform sampler2D tMetal;
        varying float vMid;
        varying vec3 vTriP;
        varying vec3 vTriN;
        vec3 tri(sampler2D tx, float scale) {
          vec3 w = pow(abs(vTriN), vec3(4.0));
          w /= (w.x + w.y + w.z + 1e-5);
          vec3 p = vTriP * scale;
          return texture2D(tx, p.zy).rgb * w.x + texture2D(tx, p.xz).rgb * w.y + texture2D(tx, p.xy).rgb * w.z;
        }
        float triMetal;`,
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        triMetal = 0.0;
        if (vMid > 0.5) {
          vec3 tc;
          if (vMid < 1.5) tc = tri(tConc, 0.4) * 1.75;
          else if (vMid < 2.5) tc = tri(tRebar, 0.33) * 1.7;
          else { tc = tri(tMetal, 0.7) * 1.55; triMetal = 1.0; }
          diffuseColor.rgb *= tc;
        }`,
      )
      .replace(
        '#include <metalnessmap_fragment>',
        `#include <metalnessmap_fragment>
        if (triMetal > 0.5) { metalnessFactor = 0.55; roughnessFactor = 0.5; }`,
      );
  };
  mat.customProgramCacheKey = () => 'triplanar-v1';
}
