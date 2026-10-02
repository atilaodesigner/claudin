// Céu da madrugada no DF: zênite azul-marinho, horizonte alaranjado pela
// luz de sódio e pela poeira seca, estrelas fracas e a lua.

import * as THREE from 'three';

export function buildSky(): THREE.Mesh {
  const geo = new THREE.SphereGeometry(2800, 32, 16);
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: { uTime: { value: 0 } },
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec3 vDir;
      uniform float uTime;
      float hash(vec3 p) { return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }
      void main() {
        float h = vDir.y;
        vec3 zenith = vec3(0.012, 0.016, 0.045);
        vec3 mid = vec3(0.05, 0.035, 0.07);
        vec3 horizon = vec3(0.42, 0.17, 0.07);
        vec3 col = mix(horizon, mid, smoothstep(0.0, 0.16, h));
        col = mix(col, zenith, smoothstep(0.12, 0.6, h));
        // brilho mais forte pro lado do Plano Piloto
        float east = max(0.0, dot(normalize(vec3(vDir.x, 0.0, vDir.z)), normalize(vec3(1.0, 0.0, -0.35))));
        col += vec3(0.25, 0.1, 0.04) * pow(east, 6.0) * (1.0 - smoothstep(0.0, 0.25, h));
        // chão abaixo do horizonte
        col = mix(col, vec3(0.05, 0.025, 0.02), smoothstep(0.0, -0.08, h));
        // estrelas
        vec3 p = floor(vDir * 420.0);
        float s = hash(p);
        float star = step(0.9985, s) * smoothstep(0.15, 0.5, h);
        star *= 0.6 + 0.4 * sin(uTime * 2.0 + s * 80.0);
        col += vec3(star) * 0.8;
        // lua
        vec3 moonDir = normalize(vec3(-0.5, 0.42, 0.6));
        float m = dot(vDir, moonDir);
        col += vec3(1.0, 0.95, 0.85) * smoothstep(0.9993, 0.9996, m) * 2.0;
        col += vec3(0.25, 0.25, 0.3) * pow(max(m, 0.0), 300.0) * 0.6;
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.renderOrder = -10;
  mesh.frustumCulled = false;
  return mesh;
}
