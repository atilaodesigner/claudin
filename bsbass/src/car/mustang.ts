// O Mustang azul-escuro. A carroceria é "lofted": uma sequência de seções
// transversais (largura, altura da cintura, do teto...) ao longo do carro,
// ligadas numa malha lisa. A cabine é outro loft de vidro com teto e colunas
// na cor do carro. Faixas prata, interior visível, rodas de 10 raios com
// disco e pinça, as três barras de lanterna e neon azul por baixo.

import * as THREE from 'three';

export const WHEEL_R = 0.35;
export const WHEEL_POS: [number, number][] = [
  [0.84, 1.45], // dianteira esquerda (x+ = esquerda do carro)
  [-0.84, 1.45],
  [0.86, -1.34],
  [-0.86, -1.34],
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

// ------------------------------------------------------------------
// seções da carroceria: z, meia-largura, fundo, cintura (mais largo), topo

interface Station { z: number; hw: number; bot: number; belt: number; top: number }

const BODY: Station[] = [
  { z: -2.47, hw: 0.8, bot: 0.34, belt: 0.6, top: 0.9 },
  { z: -2.42, hw: 0.9, bot: 0.28, belt: 0.64, top: 0.99 },
  { z: -2.28, hw: 0.96, bot: 0.26, belt: 0.68, top: 1.03 }, // ducktail
  { z: -1.95, hw: 1.0, bot: 0.25, belt: 0.72, top: 1.0 },
  { z: -1.35, hw: 1.02, bot: 0.25, belt: 0.72, top: 0.99 }, // quadril traseiro
  { z: -0.7, hw: 0.98, bot: 0.25, belt: 0.7, top: 0.98 },
  { z: 0.0, hw: 0.96, bot: 0.25, belt: 0.68, top: 0.97 },
  { z: 0.65, hw: 0.96, bot: 0.25, belt: 0.67, top: 0.96 },
  { z: 1.4, hw: 0.98, bot: 0.25, belt: 0.66, top: 0.92 }, // para-lama dianteiro
  { z: 1.95, hw: 0.95, bot: 0.26, belt: 0.62, top: 0.86 },
  { z: 2.3, hw: 0.88, bot: 0.28, belt: 0.56, top: 0.78 },
  { z: 2.46, hw: 0.76, bot: 0.32, belt: 0.52, top: 0.7 },
  { z: 2.52, hw: 0.6, bot: 0.38, belt: 0.52, top: 0.62 },
];

function catmull(p0: number, p1: number, p2: number, p3: number, t: number): number {
  const t2 = t * t, t3 = t2 * t;
  return 0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3);
}

function stationAt(list: Station[], z: number): Station {
  let i = 0;
  while (i < list.length - 2 && list[i + 1]!.z < z) i++;
  const a = list[Math.max(0, i - 1)]!, b = list[i]!, c = list[i + 1]!, d = list[Math.min(list.length - 1, i + 2)]!;
  const t = Math.min(1, Math.max(0, (z - b.z) / (c.z - b.z)));
  const k = (key: keyof Station) => catmull(a[key], b[key], c[key], d[key], t);
  return { z, hw: k('hw'), bot: k('bot'), belt: k('belt'), top: k('top') };
}

/** meia seção (lado +x), do fundo central até o topo central */
function halfRing(s: Station, n = 7): [number, number][] {
  const out: [number, number][] = [];
  const pLow = 5, pUp = 2.8;
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * (Math.PI / 2);
    out.push([s.hw * Math.pow(Math.sin(a), 2 / pLow), s.belt - (s.belt - s.bot) * Math.pow(Math.cos(a), 2 / pLow)]);
  }
  for (let i = 1; i <= n + 2; i++) {
    const b = (i / (n + 2)) * (Math.PI / 2);
    out.push([s.hw * Math.pow(Math.cos(b), 2 / pUp), s.belt + (s.top - s.belt) * Math.pow(Math.sin(b), 2 / pUp)]);
  }
  return out;
}

/** altura do topo da carroceria na posição x (pra colar faixas e detalhes) */
export function bodyTopAt(z: number, x: number): number {
  const s = stationAt(BODY, z);
  const pUp = 2.8;
  const c = Math.min(1, Math.abs(x) / s.hw);
  const cosb = Math.pow(c, pUp / 2);
  const sinb = Math.sqrt(Math.max(0, 1 - cosb * cosb));
  return s.belt + (s.top - s.belt) * Math.pow(sinb, 2 / pUp);
}

function archCut(z: number, x: number, y: number): number {
  // caixa de roda: puxa pra dentro o que fica abaixo do arco
  for (const [, wz] of [WHEEL_POS[0]!, WHEEL_POS[2]!]) {
    const R = WHEEL_R + 0.1;
    const dz = z - wz;
    if (Math.abs(dz) < R) {
      const archY = 0.36 + Math.sqrt(R * R - dz * dz);
      if (y < archY && Math.abs(x) > 0.62) return Math.sign(x) * 0.62;
    }
  }
  return x;
}

function loft(stations: Station[], zs: number[], ringFn: (s: Station) => [number, number][], cut = false): { geo: THREE.BufferGeometry; rings: number; per: number } {
  const pos: number[] = [];
  let per = 0;
  for (const z of zs) {
    const s = stationAt(stations, z);
    const half = ringFn(s);
    // anel completo: lado +x de baixo pra cima, depois lado -x de cima pra baixo
    const full: [number, number][] = [...half, ...half.slice(0, -1).reverse().map(([x, y]) => [-x, y] as [number, number])];
    per = full.length;
    for (const [x, y] of full) pos.push(cut ? archCut(z, x, y) : x, y, z);
  }
  const idx: number[] = [];
  const rings = zs.length;
  for (let r = 0; r < rings - 1; r++) {
    for (let i = 0; i < per - 1; i++) {
      const a = r * per + i, b = a + 1, c = a + per, d = c + 1;
      idx.push(a, b, c, b, d, c);
    }
  }
  // tampas
  const cap = (r: number, flip: boolean) => {
    const base = pos.length / 3;
    let cx = 0, cy = 0;
    for (let i = 0; i < per; i++) { cx += pos[(r * per + i) * 3]!; cy += pos[(r * per + i) * 3 + 1]!; }
    pos.push(cx / per, cy / per, pos[r * per * 3 + 2]!);
    for (let i = 0; i < per - 1; i++) {
      const a = r * per + i, b = a + 1;
      if (flip) idx.push(base, b, a);
      else idx.push(base, a, b);
    }
  };
  cap(0, true);
  cap(rings - 1, false);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return { geo, rings, per };
}

function sampleZ(z0: number, z1: number, n: number): number[] {
  const out: number[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    // mais seções nas pontas (curvas mais fechadas)
    const e = 0.5 - 0.5 * Math.cos(t * Math.PI);
    out.push(z0 + (z1 - z0) * (t * 0.35 + e * 0.65));
  }
  return out;
}

// ------------------------------------------------------------------
// cabine

const CAB_TOP: [number, number][] = [[-1.8, 1.0], [-1.45, 1.1], [-1.0, 1.23], [-0.55, 1.33], [-0.15, 1.37], [0.12, 1.365], [0.35, 1.26], [0.55, 1.1], [0.7, 0.99]];
function cabTop(z: number): number {
  for (let i = 0; i < CAB_TOP.length - 1; i++) {
    const [z0, y0] = CAB_TOP[i]!, [z1, y1] = CAB_TOP[i + 1]!;
    if (z <= z1) {
      const t = Math.max(0, (z - z0) / (z1 - z0));
      const s = t * t * (3 - 2 * t);
      return y0 + (y1 - y0) * (0.5 * t + 0.5 * s);
    }
  }
  return CAB_TOP[CAB_TOP.length - 1]![1];
}

function buildCabin(glassMat: THREE.Material, paintMat: THREE.Material): THREE.Mesh {
  const zs = sampleZ(-1.8, 0.7, 30);
  const pos: number[] = [];
  let per = 0;
  for (const z of zs) {
    const top = cabTop(z);
    const base = bodyTopAt(z, 0.8) - 0.02;
    const hwB = 0.84, hwT = 0.6;
    const h = Math.max(0.001, top - base);
    const half: [number, number][] = [
      [hwB, base],
      [hwB - 0.05, base + h * 0.35],
      [hwT + 0.12, base + h * 0.75],
      [hwT + 0.02, top - 0.025],
      [hwT * 0.55, top - 0.005],
      [0, top],
    ];
    const full = [...half, ...half.slice(0, -1).reverse().map(([x, y]) => [-x, y] as [number, number])];
    per = full.length;
    for (const [x, y] of full) pos.push(x, y, z);
  }
  const glass: number[] = [], paint: number[] = [];
  for (let r = 0; r < zs.length - 1; r++) {
    for (let i = 0; i < per - 1; i++) {
      const a = r * per + i, b = a + 1, c = a + per, d = c + 1;
      const zc = (zs[r]! + zs[r + 1]!) / 2;
      const xc = Math.abs((pos[a * 3]! + pos[b * 3]!) / 2);
      const top = i >= 3 && i <= per - 5; // faixas do teto
      const roof = top && zc > -0.72 && zc < 0.2;
      const sail = zc < -0.72 && xc > 0.5; // coluna C do fastback
      const aPillar = zc > 0.25 && xc > 0.62 && xc < 0.74;
      const list = roof || sail || aPillar ? paint : glass;
      list.push(a, b, c, b, d, c);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex([...glass, ...paint]);
  g.addGroup(0, glass.length, 0);
  g.addGroup(glass.length, paint.length, 1);
  g.computeVertexNormals();
  return new THREE.Mesh(g, [glassMat, paintMat]);
}

// ------------------------------------------------------------------

function buildWheel(tireMat: THREE.Material, rimMat: THREE.Material, discMat: THREE.Material, caliperMat: THREE.Material, side: number, front: boolean): { steer: THREE.Group; spin: THREE.Group } {
  const steer = new THREE.Group();
  const spin = new THREE.Group();
  steer.add(spin);
  // pneu com flanco arredondado (torno)
  const R = WHEEL_R, W = 0.27, rimR = 0.24;
  const prof: THREE.Vector2[] = [];
  for (let i = 0; i <= 12; i++) {
    const a = -Math.PI / 2 + (i / 12) * Math.PI;
    prof.push(new THREE.Vector2(R - 0.06 + Math.cos(a) * 0.06, (Math.sin(a) * W) / 2));
  }
  prof.unshift(new THREE.Vector2(rimR, -W / 2 + 0.02));
  prof.push(new THREE.Vector2(rimR, W / 2 - 0.02));
  const tire = new THREE.LatheGeometry(prof, 28);
  tire.rotateZ(Math.PI / 2);
  spin.add(new THREE.Mesh(tire, tireMat));
  // aro fundo + 10 raios (5 duplos)
  const barrel = new THREE.CylinderGeometry(rimR, rimR, W - 0.04, 24, 1, true);
  barrel.rotateZ(Math.PI / 2);
  spin.add(new THREE.Mesh(barrel, rimMat));
  const face = side * (W / 2 - 0.035);
  const lip = new THREE.TorusGeometry(rimR - 0.005, 0.012, 6, 28);
  lip.rotateY(Math.PI / 2);
  const lipM = new THREE.Mesh(lip, rimMat);
  lipM.position.x = face + side * 0.012;
  spin.add(lipM);
  const spoke = new THREE.BoxGeometry(0.03, rimR * 0.92, 0.03);
  spoke.translate(0, rimR * 0.5, 0);
  for (let k = 0; k < 5; k++) {
    for (const o of [-0.13, 0.13]) {
      const m = new THREE.Mesh(spoke, rimMat);
      m.position.x = face - side * 0.015;
      m.rotation.x = (k / 5) * Math.PI * 2 + o;
      m.rotation.z = side * 0.12;
      spin.add(m);
    }
  }
  const hub = new THREE.CylinderGeometry(0.055, 0.055, 0.05, 12);
  hub.rotateZ(Math.PI / 2);
  const hubM = new THREE.Mesh(hub, rimMat);
  hubM.position.x = face;
  spin.add(hubM);
  // disco de freio e pinça (não giram)
  const disc = new THREE.CylinderGeometry(0.2, 0.2, 0.025, 20);
  disc.rotateZ(Math.PI / 2);
  const discM = new THREE.Mesh(disc, discMat);
  discM.position.x = side * 0.02;
  steer.add(discM);
  const cal = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.14, 0.2), caliperMat);
  cal.position.set(side * 0.045, 0.1, front ? -0.1 : 0.1);
  steer.add(cal);
  return { steer, spin };
}

export function buildMustang(envMap: THREE.Texture | null): MustangRig {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);

  const paint = new THREE.MeshPhysicalMaterial({
    color: 0x16338a,
    metalness: 0.55,
    roughness: 0.3,
    clearcoat: 1,
    clearcoatRoughness: 0.04,
    envMap,
    envMapIntensity: 2.2,
  });
  const glass = new THREE.MeshPhysicalMaterial({
    color: 0x0a0e16,
    metalness: 0.1,
    roughness: 0.12,
    specularIntensity: 0.35,
    envMap,
    envMapIntensity: 1.0,
    transparent: true,
    opacity: 0.82,
  });
  const trim = new THREE.MeshStandardMaterial({ color: 0x0a0a0c, roughness: 0.5, metalness: 0.4, envMap, envMapIntensity: 0.5 });
  const chrome = new THREE.MeshStandardMaterial({ color: 0xd6dade, roughness: 0.12, metalness: 1, envMap, envMapIntensity: 1.3 });
  const stripeMat = new THREE.MeshPhysicalMaterial({ color: 0xc8ccd2, metalness: 0.6, roughness: 0.3, clearcoat: 1, envMap, envMapIntensity: 1.6 });

  // ---------- carroceria ----------
  const bodyLoft = loft(BODY, sampleZ(-2.47, 2.52, 64), (s) => halfRing(s), true);
  body.add(new THREE.Mesh(bodyLoft.geo, paint));
  body.add(buildCabin(glass, paint));

  const add = (g: THREE.BufferGeometry, m: THREE.Material, x: number, y: number, z: number, rx = 0, ry = 0, rz = 0) => {
    const mesh = new THREE.Mesh(g, m);
    mesh.position.set(x, y, z);
    mesh.rotation.set(rx, ry, rz);
    body.add(mesh);
    return mesh;
  };

  // ---------- faixas prata (capô, teto, tampa traseira) ----------
  const stripe = (z0: number, z1: number, yFn: (z: number, x: number) => number) => {
    const pos: number[] = [], idx: number[] = [];
    const n = 24;
    for (const x0 of [0.09, -0.27]) {
      const base = pos.length / 3;
      for (let i = 0; i <= n; i++) {
        const z = z0 + ((z1 - z0) * i) / n;
        for (const x of [x0, x0 + 0.18]) pos.push(x, yFn(z, x) + 0.006, z);
      }
      for (let i = 0; i < n; i++) {
        const a = base + i * 2;
        idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    body.add(new THREE.Mesh(g, stripeMat));
  };
  stripe(0.72, 2.42, bodyTopAt);
  stripe(-0.62, 0.14, (z) => cabTop(z));
  stripe(-2.4, -1.82, bodyTopAt);

  // ---------- capô, grade, detalhes ----------
  // entradas de ar no capô
  for (const s of [-1, 1]) add(new THREE.BoxGeometry(0.2, 0.025, 0.36), trim, s * 0.45, bodyTopAt(1.55, 0.45) + 0.005, 1.55, -0.1);
  // grade trapezoidal (boca de tubarão)
  const grille = new THREE.Shape();
  grille.moveTo(-0.52, 0);
  grille.lineTo(0.52, 0);
  grille.lineTo(0.6, 0.24);
  grille.lineTo(-0.6, 0.24);
  grille.closePath();
  const gGeo = new THREE.ExtrudeGeometry(grille, { depth: 0.06, bevelEnabled: false });
  add(gGeo, trim, 0, 0.36, 2.47);
  // colmeia da grade
  for (let k = 0; k < 6; k++) add(new THREE.BoxGeometry(1.05, 0.008, 0.01), chrome, 0, 0.4 + k * 0.035, 2.535);
  add(new THREE.BoxGeometry(1.5, 0.08, 0.18), trim, 0, 0.3, 2.4); // spoiler dianteiro
  // retrovisores
  for (const s of [-1, 1]) {
    add(new THREE.BoxGeometry(0.2, 0.1, 0.15), paint, s * 0.98, 1.06, 0.5);
    add(new THREE.BoxGeometry(0.05, 0.04, 0.08), trim, s * 0.9, 1.03, 0.53);
  }
  // maçanetas e friso das portas
  for (const s of [-1, 1]) {
    add(new THREE.BoxGeometry(0.02, 0.025, 0.16), chrome, s * 0.99, 0.86, -0.25);
    add(new THREE.BoxGeometry(0.012, 0.52, 0.012), trim, s * 0.985, 0.55, 0.62);
    add(new THREE.BoxGeometry(0.012, 0.52, 0.012), trim, s * 1.0, 0.55, -0.72);
  }
  // aerofólio ducktail
  add(new THREE.BoxGeometry(1.7, 0.035, 0.22), trim, 0, 1.055, -2.3, 0.22);
  // difusor + 4 ponteiras
  add(new THREE.BoxGeometry(1.5, 0.14, 0.22), trim, 0, 0.33, -2.38);
  for (let k = -3; k <= 3; k++) add(new THREE.BoxGeometry(0.012, 0.08, 0.12), trim, k * 0.12, 0.31, -2.47);
  const exhausts: THREE.Vector3[] = [];
  for (const s of [-1, 1]) {
    for (const o of [0.5, 0.68]) {
      const e = add(new THREE.CylinderGeometry(0.052, 0.058, 0.16, 16, 1, true), chrome, s * o, 0.33, -2.47, Math.PI / 2);
      add(new THREE.CircleGeometry(0.045, 12), new THREE.MeshBasicMaterial({ color: 0x050505 }), s * o, 0.33, -2.48, 0, Math.PI);
      exhausts.push(e.position.clone().add(new THREE.Vector3(0, 0, -0.1)));
    }
  }
  // saias laterais
  for (const s of [-1, 1]) add(new THREE.BoxGeometry(0.06, 0.07, 1.9), trim, s * 0.95, 0.3, 0.05);

  // ---------- interior (aparece pelo vidro) ----------
  const seat = new THREE.MeshStandardMaterial({ color: 0x141416, roughness: 0.8 });
  for (const s of [-1, 1]) {
    add(new THREE.BoxGeometry(0.46, 0.14, 0.5), seat, s * 0.38, 0.62, -0.3);
    add(new THREE.BoxGeometry(0.46, 0.62, 0.14), seat, s * 0.38, 0.95, -0.58, -0.22);
    add(new THREE.BoxGeometry(0.3, 0.14, 0.1), seat, s * 0.38, 1.3, -0.66, -0.22);
  }
  add(new THREE.BoxGeometry(1.5, 0.22, 0.35), seat, 0, 0.9, 0.5);
  const wheelRing = new THREE.TorusGeometry(0.17, 0.02, 8, 20);
  add(wheelRing, trim, 0.38, 1.0, 0.25, -0.3);
  // painel aceso
  add(new THREE.BoxGeometry(0.5, 0.1, 0.02), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.05, 0.3, 0.55) }), 0.36, 1.02, 0.36, -0.4);
  add(new THREE.BoxGeometry(0.24, 0.12, 0.02), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.35, 0.12, 0.04) }), -0.05, 0.98, 0.44, -0.4);

  // ---------- luzes ----------
  const headMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.0, 2.0, 2.2) });
  const drlMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.6, 1.8, 2.3) });
  const tailMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.2, 0.08, 0.05) });
  const brakeMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.8, 0.02, 0.02) });
  const reverseMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.2, 0.2, 0.2) });
  const lens = new THREE.MeshPhysicalMaterial({ color: 0x0c0c10, roughness: 0.05, metalness: 0.3, envMap, envMapIntensity: 1.5, clearcoat: 1 });
  const tailLocal: THREE.Vector3[] = [];
  for (const s of [-1, 1]) {
    // farol: lente escura inclinada + LED
    add(new THREE.BoxGeometry(0.46, 0.11, 0.2), lens, s * 0.58, 0.68, 2.38, 0.35, s * -0.3);
    add(new THREE.BoxGeometry(0.3, 0.028, 0.03), headMat, s * 0.56, 0.7, 2.47, 0.35, s * -0.3);
    for (let k = 0; k < 3; k++) add(new THREE.BoxGeometry(0.024, 0.1, 0.03), drlMat, s * (0.44 + k * 0.09), 0.6, 2.47 - k * 0.025);
    // lanterna: painel preto + 3 barras verticais
    add(new THREE.BoxGeometry(0.46, 0.26, 0.05), lens, s * 0.58, 0.8, -2.455);
    for (let k = 0; k < 3; k++) add(new THREE.BoxGeometry(0.06, 0.21, 0.03), tailMat, s * (0.43 + k * 0.14), 0.8, -2.485);
    add(new THREE.BoxGeometry(0.42, 0.022, 0.03), brakeMat, s * 0.58, 0.66, -2.47);
    add(new THREE.BoxGeometry(0.1, 0.04, 0.03), reverseMat, s * 0.26, 0.66, -2.47);
    tailLocal.push(new THREE.Vector3(s * 0.57, 0.8, -2.52));
  }
  // faixa preta entre as lanternas + terceira luz de freio
  add(new THREE.BoxGeometry(0.62, 0.2, 0.04), lens, 0, 0.8, -2.46);
  add(new THREE.BoxGeometry(0.4, 0.015, 0.015), brakeMat, 0, 1.03, -1.79);

  // ---------- sombra de contato + neon por baixo ----------
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 5.6), new THREE.MeshBasicMaterial({ map: makeSoftTexture(), color: 0x000000, transparent: true, opacity: 0.75, depthWrite: false }));
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.025;
  shadow.renderOrder = 2;
  root.add(shadow);
  const underglow = new THREE.Mesh(
    new THREE.PlaneGeometry(2.8, 5.6),
    new THREE.MeshBasicMaterial({ map: makeSoftTexture(), color: new THREE.Color(0.1, 0.45, 1.6), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }),
  );
  underglow.rotation.x = -Math.PI / 2;
  underglow.position.y = 0.03;
  underglow.renderOrder = 3;
  root.add(underglow);
  const tubes = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.3, 1.2, 4) });
  for (const s of [-1, 1]) add(new THREE.BoxGeometry(0.025, 0.025, 2.6), tubes, s * 0.8, 0.24, 0.05);

  // ---------- rodas ----------
  const tireMat = new THREE.MeshStandardMaterial({ color: 0x141416, roughness: 0.85 });
  const rimMat = new THREE.MeshStandardMaterial({ color: 0x26282c, roughness: 0.25, metalness: 0.95, envMap, envMapIntensity: 1.3 });
  const discMat = new THREE.MeshStandardMaterial({ color: 0x55575a, roughness: 0.4, metalness: 0.9 });
  const caliperMat = new THREE.MeshStandardMaterial({ color: 0xd01818, roughness: 0.35 });
  const wheels: { steer: THREE.Group; spin: THREE.Group }[] = [];
  WHEEL_POS.forEach(([x, z], i) => {
    const w = buildWheel(tireMat, rimMat, discMat, caliperMat, Math.sign(x), i < 2);
    w.steer.position.set(x, WHEEL_R, z);
    root.add(w.steer);
    wheels.push(w);
  });

  // ---------- faróis (luz de verdade) ----------
  const heads: THREE.SpotLight[] = [];
  for (const s of [-1, 1]) {
    const l = new THREE.SpotLight(0xf2f0ff, 45, 70, 0.44, 0.6, 1.4);
    l.position.set(s * 0.6, 0.72, 2.4);
    l.target.position.set(s * 0.9, 0, 22);
    root.add(l, l.target);
    heads.push(l);
  }

  return { root, body, wheels, tailMat, brakeMat, reverseMat, headMat, underglow, heads, exhausts, tailLocal, paint };
}

function makeSoftTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 256;
  const g = c.getContext('2d')!;
  g.save();
  g.scale(1, 2);
  const grd = g.createRadialGradient(64, 64, 8, 64, 64, 64);
  grd.addColorStop(0, 'rgba(255,255,255,0.95)');
  grd.addColorStop(0.55, 'rgba(255,255,255,0.45)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 128, 128);
  g.restore();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
