// Posto de gasolina em 3D: cobertura de bordas arredondadas com faixa
// vermelha e painéis de LED, pilares pintados, ilhas com meio-fio zebrado,
// bombas com visor de preço aceso, mangueira e bico, totem de preços em LED
// e os objetos de rua do Poly Haven (lixeira, galões, pneu) em volta.
// Mesmo lugar e mesmos colisores do posto antigo (city.ts).

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import type { Assets } from '../assets';

function canvasTex(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d')!);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

/** faixa da cobertura: vermelho, filete branco e o nome */
function fasciaTex(): THREE.CanvasTexture {
  return canvasTex(1024, 128, (g) => {
    g.fillStyle = '#c4141c';
    g.fillRect(0, 0, 1024, 128);
    g.fillStyle = '#f4f4f4';
    g.fillRect(0, 96, 1024, 12);
    g.fillStyle = '#1b3a8c';
    g.fillRect(0, 108, 1024, 20);
    g.font = '64px Anton, Impact, sans-serif';
    g.textBaseline = 'middle';
    g.fillStyle = '#ffffff';
    g.fillText('POSTO 61', 60, 50);
    g.font = '34px Anton, Impact, sans-serif';
    g.fillText('COMBUSTÍVEL • CONVENIÊNCIA 24H', 400, 52);
  });
}

/** visor da bomba: tipo do combustível, preço e litros em LCD */
function displayTex(fuel: string, price: string, color: string): THREE.CanvasTexture {
  return canvasTex(256, 320, (g) => {
    g.fillStyle = '#e9ecef';
    g.fillRect(0, 0, 256, 320);
    g.fillStyle = color;
    g.fillRect(0, 0, 256, 56);
    g.font = '40px Anton, Impact, sans-serif';
    g.fillStyle = '#ffffff';
    g.textBaseline = 'middle';
    g.textAlign = 'center';
    g.fillText(fuel, 128, 30);
    g.fillStyle = '#0d1a10';
    g.fillRect(18, 74, 220, 150);
    g.font = '22px "Chakra Petch", monospace';
    g.fillStyle = '#7cff8a';
    g.textAlign = 'left';
    g.fillText('R$/LITRO', 30, 96);
    g.font = '58px "Chakra Petch", monospace';
    g.fillText(price, 30, 146);
    g.font = '22px "Chakra Petch", monospace';
    g.fillText('LITROS   0,00', 30, 200);
    // teclado
    g.fillStyle = '#3a3f45';
    for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++) g.fillRect(40 + c * 46, 240 + r * 24, 36, 18);
  });
}

function totemTex(): THREE.CanvasTexture {
  return canvasTex(256, 640, (g) => {
    g.fillStyle = '#c4141c';
    g.fillRect(0, 0, 256, 640);
    g.fillStyle = '#ffffff';
    g.font = '120px Anton, Impact, sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('61', 128, 100);
    g.font = '30px Anton, Impact, sans-serif';
    g.fillText('POSTO', 128, 180);
    const rows: [string, string][] = [['GASOLINA', '6,49'], ['ETANOL', '4,29'], ['DIESEL S10', '6,09']];
    rows.forEach(([n, p], i) => {
      const y = 230 + i * 130;
      g.fillStyle = '#0b0b0d';
      g.fillRect(16, y, 224, 116);
      g.fillStyle = '#f4f4f4';
      g.font = '28px Anton, Impact, sans-serif';
      g.fillText(n, 128, y + 26);
      g.fillStyle = '#ff3b2a';
      g.font = '64px "Chakra Petch", monospace';
      g.fillText(p, 128, y + 78);
    });
  });
}

function hazardTex(): THREE.CanvasTexture {
  const t = canvasTex(256, 32, (g) => {
    g.fillStyle = '#f2c814';
    g.fillRect(0, 0, 256, 32);
    g.fillStyle = '#111';
    for (let x = -32; x < 256; x += 32) {
      g.beginPath();
      g.moveTo(x, 32); g.lineTo(x + 16, 0); g.lineTo(x + 32, 0); g.lineTo(x + 16, 32);
      g.fill();
    }
  });
  t.wrapS = THREE.RepeatWrapping;
  return t;
}

/** bico + mangueira pendurada até a bomba */
function hose(pump: THREE.Group, side: 1 | -1, dz: number, mat: THREE.Material, nozzleMat: THREE.Material): void {
  const x = side * 0.3;
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(x, 1.55, dz),
    new THREE.Vector3(x + side * 0.25, 1.1, dz + 0.05),
    new THREE.Vector3(x + side * 0.22, 0.5, dz + 0.1),
    new THREE.Vector3(x + side * 0.05, 1.05, dz + 0.12),
  ]);
  pump.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 20, 0.025, 6, false), mat));
  const noz = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.05, 0.28, 8), nozzleMat);
  noz.position.set(x + side * 0.03, 1.12, dz + 0.12);
  noz.rotation.z = side * 0.5;
  pump.add(noz);
}

function buildPump(fuels: [string, string, string][], mats: Record<string, THREE.Material>): THREE.Group {
  const pump = new THREE.Group();
  // corpo: largura 1,1 (z), profundidade 0,6 (x), altura 2,1
  const body = new THREE.Mesh(new RoundedBoxGeometry(0.6, 1.9, 1.1, 3, 0.06), mats.white!);
  body.position.y = 0.95 + 0.25;
  pump.add(body);
  const base = new THREE.Mesh(new RoundedBoxGeometry(0.7, 0.25, 1.2, 2, 0.04), mats.dark!);
  base.position.y = 0.125;
  pump.add(base);
  const head = new THREE.Mesh(new RoundedBoxGeometry(0.66, 0.32, 1.18, 3, 0.08), mats.red!);
  head.position.y = 2.28;
  pump.add(head);
  // visores dos dois lados (um combustível de cada lado)
  for (const side of [1, -1] as const) {
    const [fuel, price, color] = fuels[side > 0 ? 0 : 1]!;
    const disp = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.78), new THREE.MeshBasicMaterial({ map: displayTex(fuel, price, color), toneMapped: true }));
    disp.position.set(side * 0.305, 1.6, 0);
    disp.rotation.y = side * Math.PI / 2;
    pump.add(disp);
    // faixa colorida do combustível embaixo
    const band = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 0.12), new THREE.MeshStandardMaterial({ color, roughness: 0.4 }));
    band.position.set(side * 0.302, 0.6, 0);
    band.rotation.y = side * Math.PI / 2;
    pump.add(band);
    for (const dz of [-0.36, 0.36]) hose(pump, side, dz, mats.hose!, mats.nozzle!);
  }
  return pump;
}

export interface PostoPlace {
  x: number;
  z: number;
}

export function buildPosto(at: PostoPlace, models: Assets['models'] = {}): THREE.Group {
  const g = new THREE.Group();
  g.name = 'posto';
  const { x, z } = at;
  const cz = z + 15;
  const mats: Record<string, THREE.Material> = {
    white: new THREE.MeshStandardMaterial({ color: 0xe9ecef, roughness: 0.35, metalness: 0.15 }),
    dark: new THREE.MeshStandardMaterial({ color: 0x2a2d31, roughness: 0.6, metalness: 0.3 }),
    red: new THREE.MeshStandardMaterial({ color: 0xc4141c, roughness: 0.35, metalness: 0.2, emissive: 0x300404 }),
    hose: new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.55 }),
    nozzle: new THREE.MeshStandardMaterial({ color: 0x1b1b1b, roughness: 0.3, metalness: 0.7 }),
  };

  // ---- cobertura ----
  const roof = new THREE.Mesh(new RoundedBoxGeometry(26, 0.9, 20, 4, 0.3), new THREE.MeshStandardMaterial({ color: 0xf2f2f2, roughness: 0.5, metalness: 0.1 }));
  roof.position.set(x, 5.85, cz);
  g.add(roof);
  const fascia = fasciaTex();
  fascia.wrapS = THREE.RepeatWrapping;
  for (const [w, px, pz, ry] of [[26, 0, 10.02, 0], [26, 0, -10.02, Math.PI], [20, 13.02, 0, Math.PI / 2], [20, -13.02, 0, -Math.PI / 2]] as const) {
    const t = fascia.clone();
    t.repeat.set(w / 26, 1);
    t.needsUpdate = true;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, 0.92), new THREE.MeshStandardMaterial({ map: t, roughness: 0.4, emissive: 0xffffff, emissiveMap: t, emissiveIntensity: 0.35 }));
    m.position.set(x + px, 5.85, cz + pz);
    m.rotation.y = ry;
    g.add(m);
  }
  // painéis de LED embaixo da cobertura
  const led = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.1, 1.13, 1.2) });
  const panel = new THREE.PlaneGeometry(1.4, 1.4).rotateX(Math.PI / 2);
  const leds = new THREE.InstancedMesh(panel, led, 12);
  let k = 0;
  for (const px of [-8, 0, 8]) for (const pz of [-6, -2, 2, 6]) leds.setMatrixAt(k++, new THREE.Matrix4().makeTranslation(x + px, 5.39, cz + pz));
  g.add(leds);

  // ---- pilares (mesmos lugares dos colisores) ----
  const colGeo = new THREE.CylinderGeometry(0.38, 0.4, 5.4, 20);
  const stripe = new THREE.CylinderGeometry(0.41, 0.41, 0.6, 20, 1, true);
  for (const sx of [-10, 10]) for (const sz of [-7, 7]) {
    const c = new THREE.Mesh(colGeo, mats.white!);
    c.position.set(x + sx, 2.7, cz + sz);
    g.add(c);
    const s = new THREE.Mesh(stripe, mats.red!);
    s.position.set(x + sx, 0.8, cz + sz);
    g.add(s);
  }

  // ---- ilhas e bombas ----
  const haz = hazardTex();
  const curbTop = new THREE.MeshStandardMaterial({ color: 0xbdbab3, roughness: 0.85 });
  const fuelsA: [string, string, string][] = [['GASOLINA', '6,49', '#c4141c'], ['ETANOL', '4,29', '#14853b']];
  const fuelsB: [string, string, string][] = [['DIESEL S10', '6,09', '#c47a14'], ['GASOLINA', '6,49', '#c4141c']];
  for (const [i, sx] of [-5, 5].entries()) {
    const island = new THREE.Mesh(new RoundedBoxGeometry(1.5, 0.22, 4.6, 2, 0.08), curbTop);
    island.position.set(x + sx, 0.11, cz);
    g.add(island);
    for (const side of [1, -1]) {
      const t = haz.clone();
      t.repeat.set(4.6, 1);
      t.needsUpdate = true;
      const strip = new THREE.Mesh(new THREE.PlaneGeometry(4.6, 0.2), new THREE.MeshStandardMaterial({ map: t, roughness: 0.7 }));
      strip.position.set(x + sx + side * 0.76, 0.11, cz);
      strip.rotation.y = side * Math.PI / 2;
      g.add(strip);
    }
    for (const dz of [-1.05, 1.05]) {
      const p = buildPump(i === 0 ? fuelsA : fuelsB, mats);
      p.position.set(x + sx, 0.22, cz + dz);
      g.add(p);
    }
    // lixeira e galão na ponta da ilha
    const bin = models.metal_trash_can;
    if (bin) {
      const b = bin.clone();
      b.position.set(x + sx, 0.22, cz + 2.0);
      b.scale.setScalar(0.8);
      g.add(b);
    }
  }

  // ---- totem de preços ----
  const totem = new THREE.Group();
  const post = new THREE.Mesh(new RoundedBoxGeometry(1.6, 9, 0.5, 3, 0.1), mats.dark!);
  post.position.y = 4.5;
  totem.add(post);
  const tt = totemTex();
  for (const side of [1, -1]) {
    const face = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 3.75), new THREE.MeshStandardMaterial({ map: tt, emissive: 0xffffff, emissiveMap: tt, emissiveIntensity: 0.9, roughness: 0.4 }));
    face.position.set(0, 6.8, side * 0.26);
    if (side < 0) face.rotation.y = Math.PI;
    totem.add(face);
  }
  totem.position.set(x + 16, 0, z + 36);
  g.add(totem);

  // ---- calibrador e pneus perto da loja ----
  const air = new THREE.Mesh(new RoundedBoxGeometry(0.45, 1.3, 0.35, 2, 0.05), mats.red!);
  air.position.set(x + 11, 0.65, z - 14);
  g.add(air);
  const tyre = models.old_tyre;
  if (tyre) {
    for (let i = 0; i < 3; i++) {
      const t = tyre.clone();
      t.position.set(x + 12.2, 0.12 + i * 0.24, z - 14.2);
      t.rotation.y = i * 0.7;
      g.add(t);
    }
  }
  g.traverse((o) => {
    o.matrixAutoUpdate = false;
    o.updateMatrix();
  });
  g.updateMatrixWorld(true);
  return g;
}
