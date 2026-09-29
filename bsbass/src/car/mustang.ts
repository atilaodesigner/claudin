// O Mustang azul-escuro: carroceria fastback extrudada do perfil lateral,
// três barras verticais de lanterna, faróis com LED, rodas pretas,
// neon azul por baixo (rebaixado de quebrada).

import * as THREE from 'three';
import { CAR } from '../physics/car';

export const WHEEL_R = 0.345;
export const WHEEL_POS: [number, number][] = [
  [0.85, 1.45], // dianteira esquerda (x+ = esquerda do carro)
  [-0.85, 1.45],
  [0.86, -1.36],
  [-0.86, -1.36],
];

export interface MustangRig {
  root: THREE.Group; // posição/heading no mundo
  body: THREE.Group; // inclina com rolagem/arfagem
  wheels: { steer: THREE.Group; spin: THREE.Group }[];
  tailMat: THREE.MeshBasicMaterial;
  brakeMat: THREE.MeshBasicMaterial;
  reverseMat: THREE.MeshBasicMaterial;
  headMat: THREE.MeshBasicMaterial;
  underglow: THREE.Mesh;
  heads: THREE.SpotLight[];
  exhausts: THREE.Vector3[]; // posição local das ponteiras
  tailLocal: THREE.Vector3[]; // lanternas (pros rastros de luz)
  paint: THREE.MeshPhysicalMaterial;
}

function profile(points: [number, number][]): THREE.Shape {
  const s = new THREE.Shape();
  s.moveTo(points[0]![0], points[0]![1]);
  for (let i = 1; i < points.length; i++) s.lineTo(points[i]![0], points[i]![1]);
  s.closePath();
  return s;
}

function arch(out: [number, number][], cz: number, cy: number, r: number, from: number, to: number, steps = 10): void {
  for (let i = 0; i <= steps; i++) {
    const a = from + ((to - from) * i) / steps;
    out.push([cz + Math.cos(a) * r, cy + Math.sin(a) * r]);
  }
}

function extrudeSide(shape: THREE.Shape, width: number, bevel: number): THREE.BufferGeometry {
  const g = new THREE.ExtrudeGeometry(shape, {
    depth: width - bevel * 2,
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel * 0.18,
    bevelSegments: 3,
    curveSegments: 6,
  });
  g.rotateY(-Math.PI / 2);
  g.translate((width - bevel * 2) / 2, 0, 0);
  g.computeVertexNormals();
  return g;
}

export function buildMustang(envMap: THREE.Texture | null): MustangRig {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);

  const paint = new THREE.MeshPhysicalMaterial({
    color: 0x14307a,
    metalness: 0.5,
    roughness: 0.32,
    clearcoat: 1,
    clearcoatRoughness: 0.05,
    envMap,
    envMapIntensity: 2.4,
  });
  const glass = new THREE.MeshPhysicalMaterial({ color: 0x05070c, metalness: 0.9, roughness: 0.05, envMap, envMapIntensity: 1.2 });
  const trim = new THREE.MeshStandardMaterial({ color: 0x0b0b0d, roughness: 0.55, metalness: 0.3, envMap, envMapIntensity: 0.4 });
  const chrome = new THREE.MeshStandardMaterial({ color: 0xcfd3d8, roughness: 0.15, metalness: 1, envMap, envMapIntensity: 1.2 });

  // ---------- carroceria (perfil lateral) ----------
  const WR = WHEEL_R + 0.08;
  const [fz, rz] = [WHEEL_POS[0]![1], WHEEL_POS[2]![1]];
  const lower: [number, number][] = [];
  lower.push([-2.36, 0.3]);
  lower.push([rz - WR, 0.3]);
  arch(lower, rz, 0.36, WR, Math.PI, 0);
  lower.push([rz + WR, 0.3]);
  lower.push([fz - WR, 0.3]);
  arch(lower, fz, 0.36, WR, Math.PI, 0);
  lower.push([fz + WR, 0.3]);
  lower.push([2.3, 0.28], [2.42, 0.4], [2.47, 0.62], [2.36, 0.8], [1.9, 0.9], [1.2, 0.96], [0.62, 0.99], [-1.55, 1.0], [-2.08, 0.99], [-2.36, 1.0], [-2.44, 0.8], [-2.45, 0.5]);
  const bodyGeo = extrudeSide(profile(lower), 1.94, 0.09);
  const bodyMesh = new THREE.Mesh(bodyGeo, paint);
  body.add(bodyMesh);

  // ---------- cabine (vidro) ----------
  const cab = profile([[-1.72, 0.97], [-0.62, 1.33], [0.04, 1.37], [0.66, 0.97]]);
  const cabGeo = extrudeSide(cab, 1.52, 0.12);
  body.add(new THREE.Mesh(cabGeo, glass));
  // teto e colunas na cor do carro
  const roof = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.035, 0.7), paint);
  roof.position.set(0, 1.372, -0.29);
  roof.rotation.x = 0.055;
  body.add(roof);
  // coluna C (fastback) na cor do carro, tapando o fundo do vidro lateral
  for (const s of [-1, 1]) {
    const c = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.3, 0.9), paint);
    c.position.set(s * 0.69, 1.1, -1.25);
    c.rotation.x = -0.32;
    body.add(c);
  }

  // ---------- detalhes ----------
  const add = (g: THREE.BufferGeometry, m: THREE.Material, x: number, y: number, z: number, rx = 0, ry = 0, rzz = 0) => {
    const mesh = new THREE.Mesh(g, m);
    mesh.position.set(x, y, z);
    mesh.rotation.set(rx, ry, rzz);
    body.add(mesh);
    return mesh;
  };
  // grade grande (boca de tubarão)
  add(new THREE.BoxGeometry(1.2, 0.26, 0.08), trim, 0, 0.5, 2.44, 0.2);
  add(new THREE.BoxGeometry(1.5, 0.1, 0.12), trim, 0, 0.3, 2.34);
  // entradas de ar no capô
  for (const s of [-1, 1]) add(new THREE.BoxGeometry(0.22, 0.03, 0.4), trim, s * 0.32, 0.93, 1.45, -0.06);
  // bolha do capô
  add(new THREE.BoxGeometry(0.62, 0.05, 1.3), paint, 0, 0.94, 1.4, -0.05);
  // retrovisores
  for (const s of [-1, 1]) add(new THREE.BoxGeometry(0.2, 0.1, 0.16), paint, s * 1.02, 1.03, 0.52);
  // aerofólio "ducktail"
  add(new THREE.BoxGeometry(1.6, 0.05, 0.25), trim, 0, 1.04, -2.26, 0.2);
  // difusor + ponteiras (4)
  add(new THREE.BoxGeometry(1.6, 0.16, 0.2), trim, 0, 0.36, -2.4);
  const exhausts: THREE.Vector3[] = [];
  for (const s of [-1, 1]) {
    for (const o of [0.52, 0.72]) {
      const e = add(new THREE.CylinderGeometry(0.055, 0.055, 0.14, 12), chrome, s * o, 0.36, -2.47, Math.PI / 2);
      exhausts.push(e.position.clone().add(new THREE.Vector3(0, 0, -0.08)));
    }
  }
  // saias laterais
  for (const s of [-1, 1]) add(new THREE.BoxGeometry(0.05, 0.08, 1.7), trim, s * 0.98, 0.33, 0.05);
  // assoalho escuro entre as rodas (tapa o vão das caixas de roda)
  add(new THREE.BoxGeometry(1.4, 0.4, 0.95), trim, 0, 0.5, fz);
  add(new THREE.BoxGeometry(1.4, 0.4, 0.95), trim, 0, 0.5, rz);

  // ---------- luzes ----------
  const headMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 3, 3.2) });
  const drlMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.2, 2.4, 3) });
  const tailMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.2, 0.08, 0.05) });
  const brakeMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.8, 0.02, 0.02) });
  const reverseMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.2, 0.2, 0.2) });
  const tailLocal: THREE.Vector3[] = [];
  for (const s of [-1, 1]) {
    // farol: bloco escuro + LED
    add(new THREE.BoxGeometry(0.5, 0.1, 0.18), trim, s * 0.64, 0.73, 2.34, 0.3, s * -0.25);
    add(new THREE.BoxGeometry(0.34, 0.035, 0.05), headMat, s * 0.62, 0.74, 2.43, 0.3, s * -0.25);
    // os três "caninos" de LED
    for (let k = 0; k < 3; k++) add(new THREE.BoxGeometry(0.03, 0.12, 0.04), drlMat, s * (0.5 + k * 0.1), 0.64, 2.45 - k * 0.02);
    // lanterna: 3 barras verticais
    add(new THREE.BoxGeometry(0.46, 0.3, 0.06), trim, s * 0.6, 0.78, -2.43);
    for (let k = 0; k < 3; k++) {
      add(new THREE.BoxGeometry(0.07, 0.24, 0.03), tailMat, s * (0.44 + k * 0.14), 0.78, -2.465);
    }
    // faixa de freio
    add(new THREE.BoxGeometry(0.44, 0.03, 0.03), brakeMat, s * 0.6, 0.62, -2.46);
    add(new THREE.BoxGeometry(0.12, 0.05, 0.03), reverseMat, s * 0.3, 0.62, -2.46);
    tailLocal.push(new THREE.Vector3(s * 0.58, 0.78, -2.5));
  }
  // barra entre as lanternas
  add(new THREE.BoxGeometry(0.5, 0.05, 0.04), trim, 0, 0.78, -2.45);

  // ---------- neon por baixo ----------
  const glowTex = makeUnderglowTexture();
  const underglow = new THREE.Mesh(
    new THREE.PlaneGeometry(2.8, 5.6),
    new THREE.MeshBasicMaterial({ map: glowTex, color: new THREE.Color(0.1, 0.45, 1.6), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }),
  );
  underglow.rotation.x = -Math.PI / 2;
  underglow.position.y = 0.03;
  underglow.renderOrder = 3;
  root.add(underglow);
  const tubes = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.3, 1.2, 4) });
  for (const s of [-1, 1]) add(new THREE.BoxGeometry(0.03, 0.03, 3.2), tubes, s * 0.85, 0.26, 0);

  // ---------- rodas ----------
  const tire = new THREE.MeshStandardMaterial({ color: 0x111112, roughness: 0.9 });
  const rim = new THREE.MeshStandardMaterial({ color: 0x1c1d20, roughness: 0.3, metalness: 0.9, envMap, envMapIntensity: 0.8 });
  const caliper = new THREE.MeshStandardMaterial({ color: 0xc41a1a, roughness: 0.4 });
  const tireGeo = new THREE.CylinderGeometry(WHEEL_R, WHEEL_R, 0.29, 22);
  tireGeo.rotateZ(Math.PI / 2);
  const rimGeo = new THREE.CylinderGeometry(WHEEL_R * 0.68, WHEEL_R * 0.68, 0.3, 18);
  rimGeo.rotateZ(Math.PI / 2);
  const spokeGeo = new THREE.BoxGeometry(0.04, WHEEL_R * 1.3, 0.06);
  const wheels: { steer: THREE.Group; spin: THREE.Group }[] = [];
  for (const [x, z] of WHEEL_POS) {
    const steer = new THREE.Group();
    steer.position.set(x, WHEEL_R, z);
    const spin = new THREE.Group();
    steer.add(spin);
    spin.add(new THREE.Mesh(tireGeo, tire));
    spin.add(new THREE.Mesh(rimGeo, rim));
    const side = Math.sign(x);
    for (let k = 0; k < 5; k++) {
      const sp = new THREE.Mesh(spokeGeo, chrome);
      sp.position.x = side * 0.15;
      sp.rotation.x = (k / 5) * Math.PI;
      spin.add(sp);
    }
    const cal = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.16, 0.2), caliper);
    cal.position.set(side * 0.1, 0.12, z > 0 ? -0.1 : 0.1);
    steer.add(cal);
    root.add(steer);
    wheels.push({ steer, spin });
  }

  // ---------- faróis (luz de verdade) ----------
  const heads: THREE.SpotLight[] = [];
  for (const s of [-1, 1]) {
    const l = new THREE.SpotLight(0xf2f0ff, 45, 70, 0.44, 0.6, 1.4);
    l.position.set(s * 0.62, 0.75, 2.4);
    l.target.position.set(s * 0.9, 0, 22);
    root.add(l, l.target);
    heads.push(l);
  }

  body.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) o.castShadow = false;
  });
  void CAR;

  return { root, body, wheels, tailMat, brakeMat, reverseMat, headMat, underglow, heads, exhausts, tailLocal, paint };
}

function makeUnderglowTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 256;
  const g = c.getContext('2d')!;
  const grd = g.createRadialGradient(64, 128, 10, 64, 128, 128);
  grd.addColorStop(0, 'rgba(255,255,255,0.9)');
  grd.addColorStop(0.45, 'rgba(255,255,255,0.35)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.save();
  g.scale(1, 1);
  g.fillStyle = grd;
  g.fillRect(0, 0, 128, 256);
  g.restore();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
