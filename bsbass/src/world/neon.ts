// Neon e LED de quebrada: letreiro de bar com copo de cerveja, açaí, sinuca,
// espetinho, cruz de igreja, barbearia, forró, pagode... mais outdoors
// iluminados em cima das lajes e fita de LED nas fachadas de comércio.

import * as THREE from 'three';
import { GeoBuilder, hex, type RGB } from '../utils/geo';
import { mulberry32, pick, range } from '../utils/rng';
import type { City, Lot } from './city';
import { CURB_H } from './city';

type Draw = (g: CanvasRenderingContext2D, cx: number, cy: number) => void;

function tube(g: CanvasRenderingContext2D, color: string, width: number, draw: () => void): void {
  g.save();
  g.lineCap = 'round';
  g.lineJoin = 'round';
  g.shadowColor = color;
  g.shadowBlur = 22;
  g.strokeStyle = color;
  g.lineWidth = width * 1.8;
  g.globalAlpha = 0.55;
  draw();
  g.stroke();
  g.shadowBlur = 8;
  g.globalAlpha = 1;
  g.lineWidth = width;
  draw();
  g.stroke();
  g.shadowBlur = 0;
  g.strokeStyle = 'rgba(255,255,255,0.85)';
  g.lineWidth = width * 0.35;
  draw();
  g.stroke();
  g.restore();
}

function word(g: CanvasRenderingContext2D, text: string, cx: number, cy: number, size: number, color: string, font = 'Anton, Impact, sans-serif'): void {
  g.save();
  g.font = `${size}px ${font}`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  const w = g.measureText(text).width;
  const sx = Math.min(1, 220 / w);
  g.translate(cx, cy);
  g.scale(sx, 1);
  g.lineJoin = 'round';
  g.shadowColor = color;
  g.shadowBlur = 24;
  g.strokeStyle = color;
  g.lineWidth = 7;
  g.globalAlpha = 0.6;
  g.strokeText(text, 0, 0);
  g.globalAlpha = 1;
  g.shadowBlur = 10;
  g.lineWidth = 4;
  g.strokeText(text, 0, 0);
  g.shadowBlur = 0;
  g.strokeStyle = 'rgba(255,255,255,0.9)';
  g.lineWidth = 1.4;
  g.strokeText(text, 0, 0);
  g.restore();
}

const SIGNS: { color: string; draw: Draw }[] = [
  {
    color: '#ffb020', // BAR + copo
    draw: (g, cx, cy) => {
      word(g, 'BAR', cx + 30, cy - 10, 96, '#ffb020');
      tube(g, '#ffe070', 5, () => {
        g.beginPath();
        g.moveTo(cx - 100, cy - 60); g.lineTo(cx - 92, cy + 50); g.lineTo(cx - 48, cy + 50); g.lineTo(cx - 40, cy - 60);
        g.moveTo(cx - 40, cy - 30); g.quadraticCurveTo(cx - 14, cy - 20, cx - 40, cy + 20);
      });
      tube(g, '#ffffff', 3, () => { g.beginPath(); g.moveTo(cx - 98, cy - 42); g.lineTo(cx - 42, cy - 42); });
      word(g, 'GELADA', cx + 30, cy + 70, 34, '#ff5a30');
    },
  },
  { color: '#c050ff', draw: (g, cx, cy) => { word(g, 'AÇAÍ', cx, cy - 10, 110, '#c050ff'); word(g, 'NA TIGELA', cx, cy + 72, 32, '#40ff9a'); } },
  {
    color: '#ff2a3a',
    draw: (g, cx, cy) => {
      tube(g, '#ff2a3a', 5, () => { g.beginPath(); g.roundRect(cx - 110, cy - 64, 220, 128, 18); });
      word(g, 'ABERTO', cx, cy - 12, 70, '#ff2a3a');
      word(g, '24H', cx, cy + 40, 40, '#3ad0ff');
    },
  },
  {
    color: '#e8f4ff', // igreja
    draw: (g, cx, cy) => {
      tube(g, '#e8f4ff', 9, () => { g.beginPath(); g.moveTo(cx, cy - 100); g.lineTo(cx, cy + 40); g.moveTo(cx - 44, cy - 58); g.lineTo(cx + 44, cy - 58); });
      word(g, 'JESUS É O CAMINHO', cx, cy + 82, 30, '#40c8ff');
    },
  },
  {
    color: '#30ff70',
    draw: (g, cx, cy) => {
      tube(g, '#30ff70', 5, () => { g.beginPath(); g.arc(cx, cy - 40, 42, 0, Math.PI * 2); });
      word(g, '8', cx, cy - 40, 54, '#ffffff');
      word(g, 'SINUCA', cx, cy + 58, 64, '#30ff70');
    },
  },
  {
    color: '#ff7a1a',
    draw: (g, cx, cy) => {
      tube(g, '#ffd060', 4, () => { g.beginPath(); g.moveTo(cx - 100, cy - 70); g.lineTo(cx + 100, cy - 30); });
      for (let k = 0; k < 4; k++) tube(g, '#ff5a20', 5, () => { g.beginPath(); g.arc(cx - 60 + k * 36, cy - 59 + k * 7.2, 12, 0, Math.PI * 2); });
      word(g, 'ESPETINHO', cx, cy + 30, 62, '#ff7a1a');
      word(g, 'R$ 7', cx, cy + 86, 34, '#ffe070');
    },
  },
  {
    color: '#3a8aff',
    draw: (g, cx, cy) => {
      for (let k = 0; k < 5; k++) tube(g, k % 2 ? '#ff3040' : '#3a8aff', 5, () => { g.beginPath(); g.moveTo(cx - 100, cy - 90 + k * 22); g.lineTo(cx - 70, cy - 70 + k * 22); });
      word(g, 'BARBEARIA', cx + 20, cy + 10, 50, '#3a8aff');
      word(g, 'DEGRADÊ', cx + 20, cy + 64, 36, '#ffffff');
    },
  },
  { color: '#ff3aa0', draw: (g, cx, cy) => { word(g, 'FORRÓ', cx, cy - 16, 96, '#ff3aa0'); word(g, 'SEXTA', cx, cy + 62, 38, '#ffe070'); } },
  { color: '#ffe030', draw: (g, cx, cy) => { word(g, 'PAGODE', cx, cy - 24, 80, '#ffe030'); word(g, 'HOJE', cx, cy + 50, 56, '#ff3aa0'); } },
  {
    color: '#30ff90', // garrafa (tipo a da referência, só que de cerveja de bar)
    draw: (g, cx, cy) => {
      tube(g, '#30ff90', 6, () => {
        g.beginPath();
        g.moveTo(cx - 12, cy - 110); g.lineTo(cx - 12, cy - 70); g.quadraticCurveTo(cx - 40, cy - 55, cx - 40, cy - 25);
        g.lineTo(cx - 40, cy + 100); g.lineTo(cx + 40, cy + 100); g.lineTo(cx + 40, cy - 25);
        g.quadraticCurveTo(cx + 40, cy - 55, cx + 12, cy - 70); g.lineTo(cx + 12, cy - 110); g.closePath();
      });
      tube(g, '#ffe070', 4, () => { g.beginPath(); g.rect(cx - 30, cy + 5, 60, 44); });
    },
  },
  { color: '#ff3020', draw: (g, cx, cy) => { word(g, 'LANCHES', cx, cy - 20, 72, '#ff3020'); word(g, 'X-TUDO', cx, cy + 52, 46, '#ffd020'); } },
  { color: '#30e0ff', draw: (g, cx, cy) => { word(g, 'DISK', cx, cy - 50, 56, '#30e0ff'); word(g, 'CERVEJA', cx, cy + 20, 70, '#30e0ff'); word(g, '61 9', cx, cy + 82, 32, '#ffffff'); } },
  {
    color: '#ff4fb4',
    draw: (g, cx, cy) => {
      tube(g, '#ff4fb4', 6, () => {
        g.beginPath();
        g.moveTo(cx, cy + 70);
        g.bezierCurveTo(cx - 120, cy - 10, cx - 60, cy - 110, cx, cy - 50);
        g.bezierCurveTo(cx + 60, cy - 110, cx + 120, cy - 10, cx, cy + 70);
      });
      word(g, '61', cx, cy - 10, 60, '#ffffff');
    },
  },
  { color: '#a060ff', draw: (g, cx, cy) => { word(g, 'TATTOO', cx, cy - 10, 84, '#a060ff'); word(g, '& PIERCING', cx, cy + 60, 32, '#30e0ff'); } },
  {
    color: '#30e0ff',
    draw: (g, cx, cy) => {
      for (let k = 0; k < 3; k++) tube(g, '#30e0ff', 6, () => { g.beginPath(); g.arc(cx, cy + 20, 30 + k * 30, -Math.PI * 0.8, -Math.PI * 0.2); });
      tube(g, '#30e0ff', 8, () => { g.beginPath(); g.arc(cx, cy + 20, 3, 0, Math.PI * 2); });
      word(g, 'WI-FI GRÁTIS', cx, cy + 80, 36, '#ffffff');
    },
  },
  {
    color: '#ff3aa0',
    draw: (g, cx, cy) => {
      tube(g, '#ff3aa0', 7, () => { g.beginPath(); g.moveTo(cx - 90, cy - 50); g.lineTo(cx + 60, cy - 50); g.moveTo(cx + 30, cy - 80); g.lineTo(cx + 70, cy - 50); g.lineTo(cx + 30, cy - 20); });
      word(g, 'BAILE', cx, cy + 40, 70, '#ffe030');
    },
  },
];

const SHOP_TO_NEON: Record<number, number[]> = {
  0: [0, 9], 1: [5], 2: [1], 3: [2], 4: [14], 5: [6], 6: [2, 11], 7: [11], 8: [2], 9: [3], 10: [10], 11: [15, 12],
};

const POSTERS = [
  { bg: ['#2a0a3a', '#12051c'], title: 'BAILE DO GRAVE', sub: 'SÁBADO · PAREDÃO 61 · FEIRA', tc: '#ff3aa0', sc: '#30e0ff' },
  { bg: ['#ffd21a', '#e8a800'], title: 'CURSINHO PRÉ-ENEM', sub: 'MATRÍCULAS ABERTAS · CEILÂNDIA', tc: '#111', sc: '#6a1010' },
  { bg: ['#0c3a8a', '#06204a'], title: 'CELULAR NA HORA', sub: 'CONSERTO EM 1H · TELA · BATERIA', tc: '#fff', sc: '#ffd21a' },
  { bg: ['#b01020', '#600810'], title: 'GÁS E ÁGUA 24H', sub: 'ENTREGA RÁPIDA · DISK 61', tc: '#fff', sc: '#ffe070' },
];

function makeAtlases(): { neon: THREE.CanvasTexture; posters: THREE.CanvasTexture } {
  const c = document.createElement('canvas');
  c.width = c.height = 1024;
  const g = c.getContext('2d')!;
  SIGNS.forEach((s, i) => {
    const cx = (i % 4) * 256 + 128, cy = Math.floor(i / 4) * 256 + 128;
    g.save();
    g.beginPath();
    g.rect(cx - 128, cy - 128, 256, 256);
    g.clip();
    s.draw(g, cx, cy);
    g.restore();
  });
  const neon = new THREE.CanvasTexture(c);
  neon.colorSpace = THREE.SRGBColorSpace;

  const p = document.createElement('canvas');
  p.width = 1024;
  p.height = 1024;
  const q = p.getContext('2d')!;
  POSTERS.forEach((ps, i) => {
    const y = i * 256;
    const gr = q.createLinearGradient(0, y, 1024, y + 256);
    gr.addColorStop(0, ps.bg[0]!);
    gr.addColorStop(1, ps.bg[1]!);
    q.fillStyle = gr;
    q.fillRect(0, y, 1024, 256);
    q.fillStyle = 'rgba(255,255,255,0.06)';
    for (let k = 0; k < 12; k++) q.fillRect(k * 90, y, 40, 256);
    q.textAlign = 'center';
    q.fillStyle = ps.tc;
    q.font = '112px Anton, Impact, sans-serif';
    q.fillText(ps.title, 512, y + 132, 960);
    q.fillStyle = ps.sc;
    q.font = '40px Anton, Impact, sans-serif';
    q.fillText(ps.sub, 512, y + 208, 960);
    // desgaste e pixo no canto
    q.fillStyle = 'rgba(0,0,0,0.25)';
    for (let k = 0; k < 40; k++) q.fillRect(Math.random() * 1024, y + Math.random() * 256, 6 + Math.random() * 30, 2 + Math.random() * 6);
  });
  const posters = new THREE.CanvasTexture(p);
  posters.colorSpace = THREE.SRGBColorSpace;
  return { neon, posters };
}

function cellUV(i: number): [number, number, number, number] {
  const col = i % 4, row = Math.floor(i / 4);
  return [col / 4 + 0.002, 1 - (row + 1) / 4 + 0.002, (col + 1) / 4 - 0.002, 1 - row / 4 - 0.002];
}

export interface NeonMeshes {
  group: THREE.Group;
  lights: { x: number; y: number; z: number; color: THREE.Color }[];
}

export function buildNeon(city: City): NeonMeshes {
  const { neon, posters } = makeAtlases();
  const rnd = mulberry32(8181);
  const signs = new GeoBuilder();
  const leds = new GeoBuilder();
  const boards = new GeoBuilder();
  const frames = new GeoBuilder();
  const lights: NeonMeshes['lights'] = [];
  const tmp = new THREE.Color();

  const place = (lot: Lot, fn: () => void) => {
    for (const b of [signs, leds, boards, frames]) b.setTransform(lot.x, CURB_H, lot.z, lot.rot);
    fn();
    for (const b of [signs, leds, boards, frames]) b.resetTransform();
  };

  const front = (lot: Lot) => lot.d / 2 - (lot.muro ? 4 : 0) + 0.12;
  let boardsLeft = 18;

  for (const lot of city.lots) {
    const f = front(lot);
    const hw = lot.w / 2;
    const isShop = lot.shop >= 0;
    const r = rnd();
    if (isShop || r < 0.07) {
      const options = isShop ? SHOP_TO_NEON[lot.shop] ?? [2] : [3, 12, 14, 13];
      const idx = pick(rnd, options);
      const col = SIGNS[idx]!.color;
      const k = range(rnd, 1.7, 2.4);
      const c: RGB = [k, k, k];
      const blade = rnd() < 0.55 && lot.floors >= 2;
      place(lot, () => {
        if (blade) {
          // letreiro "bandeira", saindo da fachada
          const x = rnd() < 0.5 ? -hw + 0.4 : hw - 0.4;
          const y0 = 3.3, s = 1.9;
          signs.quad([x, y0, f + 0.15], [x, y0, f + 0.15 + s], [x, y0 + s, f + 0.15 + s], [x, y0 + s, f + 0.15], cellUV(idx), c);
          frames.box(x, y0 + s / 2, f + 0.1, 0.06, 0.06, 0.2, hex(0x222222));
          frames.box(x, y0 + s + 0.05, f + 0.15 + s / 2, 0.05, 0.05, s, hex(0x222222));
        } else {
          const s = Math.min(2.6, lot.w * 0.4);
          const x = range(rnd, -hw + s / 2 + 0.3, hw - s / 2 - 0.3);
          const y0 = isShop ? 3.45 : 2.2 + (lot.floors - 1) * 1.5;
          signs.wallZ(x - s / 2, x + s / 2, y0, y0 + s, f + 0.08, cellUV(idx), c);
        }
        // fita de LED no comércio
        if (isShop) {
          const ledCol = hex(parseInt(col.slice(1), 16), 2.4);
          leds.box(0, 2.66, f + 0.02, lot.w - 0.3, 0.05, 0.05, ledCol);
          if (rnd() < 0.5) {
            leds.box(-hw + 0.2, 1.35, f + 0.02, 0.05, 2.6, 0.05, ledCol);
            leds.box(hw - 0.2, 1.35, f + 0.02, 0.05, 2.6, 0.05, ledCol);
          }
        }
      });
      if (lights.length < 60) {
        const c2 = Math.cos(lot.rot), s2 = Math.sin(lot.rot);
        tmp.set(col);
        lights.push({ x: lot.x + (f + 1.5) * s2, y: 3.5, z: lot.z + (f + 1.5) * c2, color: tmp.clone() });
      }
    }
    // outdoor iluminado em cima da laje
    if (boardsLeft > 0 && lot.floors >= 2 && rnd() < 0.035) {
      boardsLeft--;
      const H = lot.floors * 3;
      const p = Math.floor(rnd() * POSTERS.length);
      const w = Math.min(9, lot.w + 2), h = w / 4;
      const z = f - 5;
      const y0 = H + 1.4;
      place(lot, () => {
        boards.wallZ(-w / 2, w / 2, y0, y0 + h, z + 0.12, [0, 1 - (p + 1) / 4 + 0.003, 1, 1 - p / 4 - 0.003], [1.1, 1.1, 1.1]);
        frames.box(0, y0 + h / 2, z, w + 0.3, h + 0.3, 0.2, hex(0x1a1a1c));
        for (const sx of [-w / 3, w / 3]) {
          frames.box(sx, H + 0.7, z - 0.2, 0.18, 1.4 + 0.02, 0.18, hex(0x3a3a3a));
          leds.box(sx, y0 + h + 0.35, z + 0.5, 0.5, 0.12, 0.2, hex(0xfff4d8, 3));
          frames.box(sx, y0 + h + 0.25, z + 0.25, 0.06, 0.06, 0.6, hex(0x222222));
        }
      });
    }
  }

  const group = new THREE.Group();
  const add = (b: GeoBuilder, m: THREE.Material, order = 0) => {
    if (!b.vertexCount) return;
    const mesh = new THREE.Mesh(b.build(), m);
    mesh.renderOrder = order;
    mesh.matrixAutoUpdate = false;
    group.add(mesh);
  };
  add(signs, new THREE.MeshBasicMaterial({ map: neon, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }), 3);
  add(leds, new THREE.MeshBasicMaterial({ vertexColors: true }));
  add(boards, new THREE.MeshBasicMaterial({ map: posters, vertexColors: true }));
  add(frames, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, metalness: 0.4 }));
  return { group, lights };
}
