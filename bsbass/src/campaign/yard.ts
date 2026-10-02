// Ferro-velho, a base do bonde, montado numa quadra de verdade da cidade.
// Visual e posições copiados do BSBASS THE GAME (buildYard): pátio de terra,
// cerca de chapas, portão de correr, torres de carro amassado, pilhas de
// pneu, contêiner com o grafite, tambor com fogo, torre de luz, dois
// guindastes com a bandeira pendurada nos ganchos. Aqui ganha colisão (dá
// pra dirigir dentro) e o portão abre quando o carro chega perto.

import * as THREE from 'three';
import { circle, rect, type Shape } from '../physics/collide';
import { nodePos } from '../world/city';
import { YARD_BLOCK } from './layout';
import { FLAG_IMAGE, MODELS, canvasTex, glowTex, propGeo, propMat, toonGrad, type CampaignModel } from './models';

const V3 = THREE.Vector3;
const rand = (a: number, b: number) => a + Math.random() * (b - a);

// meia largura (ao longo da rua) e meia profundidade, como no original
const W = 22, D = 20;
/** distância do centro do pátio até o eixo da avenida */
const OFF = 44;

interface Cloth {
  P: Float32Array;
  Q: Float32Array;
  CS: Float32Array;
  pinned: Uint8Array;
  pins: [number, THREE.Vector3][];
  gF: THREE.PlaneGeometry;
  gB: THREE.PlaneGeometry;
  pos: THREE.BufferAttribute;
  nx: number;
  ny: number;
  N: number;
  t: number;
  skip: number;
  colLen: number;
  toRoad: THREE.Vector3;
  along: THREE.Vector3;
}

export interface YardSpot {
  pos: THREE.Vector3;
  h: number;
  a: number;
}

export class Yard {
  readonly group = new THREE.Group();
  readonly C = new V3();
  readonly along = new V3(-1, 0, 0);
  readonly toRoad = new V3(0, 0, 1);
  readonly spots: YardSpot[];
  readonly colliders: Shape[] = [];
  readonly gateCollider: Shape;
  readonly lights: THREE.PointLight[] = [];
  readonly fireAt = new V3();
  /** onde fica o piloto escolhido e os outros (em volta do fogo) */
  readonly crewSel: { pos: THREE.Vector3; h: number };
  readonly crewFire: THREE.Vector3[];
  gateOpen = 0;
  private gate: { mesh: THREE.Mesh; closed: THREE.Vector3; open: THREE.Vector3 } | null = null;
  private cloth: Cloth | null = null;
  lowQuality = false;

  constructor() {
    const bx = nodePos(YARD_BLOCK.i) + 50, bz = nodePos(YARD_BLOCK.j) + 50;
    // o portão dá pra avenida (+z); o pátio fica no meio da quadra, recuado
    const roadZ = nodePos(YARD_BLOCK.j + 1);
    this.C.set(bx, 0, roadZ - OFF);
    void bz;
    this.group.name = 'ferro-velho';
    this.build();
    const yR = Math.atan2(this.toRoad.x, this.toRoad.z);
    this.spots = [0, -5.4, 5.4, -10.8].map((a) => ({ pos: this.pt(a, -3), h: yR, a }));
    this.crewSel = { pos: this.pt(-2.75, -1.3), h: yR };
    this.crewFire = [[-10.4, 5.2], [-7.1, 6.2], [-10, 2.4]].map(([a, b]) => this.pt(a!, b!));
    // portão: bloqueia o vão quando fechado
    this.gateCollider = this.boxAB(0, D, 5.2, 0.4);
  }

  /** ponto do pátio: a = ao longo da rua, b = em direção à rua */
  pt(a: number, b: number, y = 0, out = new V3()): THREE.Vector3 {
    return out.set(this.C.x + this.along.x * a + this.toRoad.x * b, y, this.C.z + this.along.z * a + this.toRoad.z * b);
  }

  /** o carro está dentro do pátio (inclui o corredor do portão) */
  inside(x: number, z: number, pad = 0): boolean {
    const dx = x - this.C.x, dz = z - this.C.z;
    const a = dx * this.along.x + dz * this.along.z, b = dx * this.toRoad.x + dz * this.toRoad.z;
    return Math.abs(a) < W + pad && b > -D - pad && b < D + pad;
  }

  /** caixa alinhada no pátio (a, b = centro; ha, hb = meias medidas) */
  private boxAB(a: number, b: number, ha: number, hb: number): Shape {
    const p = this.pt(a, b);
    // o pátio é alinhado aos eixos do mundo (ao longo = X, rumo à rua = Z)
    return rect(p.x, p.z, ha, hb);
  }

  private build(): void {
    const grp = this.group;
    const yA = Math.atan2(this.along.x, this.along.z), yR = Math.atan2(this.toRoad.x, this.toRoad.z), Yv = new V3(0, 1, 0);
    const G: Partial<Record<CampaignModel, THREE.BufferGeometry>> = {};
    const geo = (k: CampaignModel) => (MODELS[k] ? (G[k] = G[k] || propGeo(k)) : null);
    const inst = (k: CampaignModel, list: number[][]) => {
      const g = geo(k);
      if (!g || !list.length) return null;
      const im = new THREE.InstancedMesh(g, propMat(k), list.length);
      list.forEach((o, i) =>
        im.setMatrixAt(i, new THREE.Matrix4().compose(this.pt(o[0]!, o[1]!, 0), new THREE.Quaternion().setFromAxisAngle(Yv, o[2]!), new V3(o[3] || 1, (o[3] || 1) * (o[4] || 1), o[3] || 1))),
      );
      grp.add(im);
      return im;
    };
    // chão de terra batida
    const dirt = canvasTex(256, 256, (g, w, h) => {
      g.fillStyle = '#4a3a2c';
      g.fillRect(0, 0, w, h);
      for (let i = 0; i < 2600; i++) {
        const v = (40 + Math.random() * 50) | 0;
        g.fillStyle = `rgba(${v + 30},${v + 14},${v},.35)`;
        g.fillRect(Math.random() * w, Math.random() * h, 2 + Math.random() * 4, 2 + Math.random() * 4);
      }
      for (let i = 0; i < 14; i++) {
        g.fillStyle = 'rgba(18,14,10,.28)';
        g.beginPath();
        g.ellipse(Math.random() * w, Math.random() * h, 10 + Math.random() * 30, 6 + Math.random() * 16, Math.random() * 3, 0, 7);
        g.fill();
      }
    });
    dirt.wrapS = dirt.wrapT = THREE.RepeatWrapping;
    dirt.repeat.set(4, 4);
    const gm = new THREE.MeshToonMaterial({ map: dirt, gradientMap: toonGrad });
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(D * 2 + 2, W * 2 + 2).rotateX(-Math.PI / 2), gm);
    ground.position.copy(this.C).setY(0.04);
    ground.rotation.y = yA;
    grp.add(ground);
    const pl = OFF - D - 10 + 1, path = new THREE.Mesh(new THREE.PlaneGeometry(pl, 10).rotateX(-Math.PI / 2), gm);
    this.pt(0, D + pl / 2 - 0.5, 0.05, path.position);
    path.rotation.y = yA;
    grp.add(path);
    // cerca de chapas coloridas (esticada na altura pra fechar o terreno)
    const fl: number[][] = [], fA = yA - Math.PI / 2;
    for (const a of [-18, -9, 9, 18]) fl.push([a, D, fA, 1, 2]);
    for (const a of [-18, -9, 0, 9, 18]) fl.push([a, -D, fA, 1, 2]);
    for (const s of [-1, 1]) for (const b of [-16, -8, 0, 8, 16]) fl.push([s * W, b, yA, 1, 2]);
    inst('jFence', fl);
    this.colliders.push(this.boxAB(0, -D, W + 0.5, 0.4), this.boxAB(-W, 0, 0.4, D + 0.5), this.boxAB(W, 0, 0.4, D + 0.5));
    this.colliders.push(this.boxAB(-13.75, D, 8.75, 0.4), this.boxAB(13.75, D, 8.75, 0.4));
    // portão de correr no vão da cerca
    const gg = geo('jGate1');
    if (gg) {
      const gt = new THREE.Mesh(gg, propMat('jGate1'));
      gt.scale.set(1, 0.78, 1);
      this.pt(0, D, 0, gt.position);
      gt.rotation.y = fA;
      grp.add(gt);
      this.gate = { mesh: gt, closed: gt.position.clone(), open: gt.position.clone().addScaledVector(this.along, 10.5) };
    }
    // sucata: torres de carros empilhados
    const sk = (['jStacked', 'jCrushStack'] as const).filter((k) => MODELS[k]);
    const sl: Partial<Record<CampaignModel, number[][]>> = {};
    const spots = [[-18.2, -9], [-18.2, -1], [-18.2, 7.5], [18.2, -9], [18.2, -1], [18.2, 7.5], [-13.5, 15.2], [13.5, 15.2]];
    spots.forEach((s, i) => {
      const k = sk[i % sk.length];
      if (!k) return;
      const a = s[0]! + rand(-0.4, 0.4), b = s[1]! + rand(-0.4, 0.4);
      (sl[k] = sl[k] || []).push([a, b, rand(0, 6.28), rand(0.88, 1.08)]);
      const p = this.pt(a, b);
      this.colliders.push(circle(p.x, p.z, 2.3));
    });
    for (const k in sl) inst(k as CampaignModel, sl[k as CampaignModel]!);
    // pilhas de pneu
    const tires = [[-11.8, 7.4, rand(0, 6), 1], [7.4, 15.8, rand(0, 6), 0.9], [-7.4, 16, rand(0, 6), 0.85], [-15, -15.8, rand(0, 6), 1], [15, -15.8, rand(0, 6), 0.95]];
    inst('jTirePile', tires);
    for (const t of tires) {
      const p = this.pt(t[0]!, t[1]!);
      this.colliders.push(circle(p.x, p.z, 1.6 * t[3]!));
    }
    // contêiner com o grafite do BSBASS nas portas
    const cg = geo('jCont0');
    if (cg) {
      const c = new THREE.Mesh(cg, propMat('jCont0'));
      this.pt(0, -15.6, 0, c.position);
      c.rotation.y = yR;
      grp.add(c);
      const bx = cg.boundingBox!, fw = bx.max.x - bx.min.x, fh = bx.max.y - bx.min.y, fz = bx.max.z, fd = bx.max.z - bx.min.z;
      this.colliders.push(this.boxAB(0, -15.6, fw / 2 + 0.1, fd / 2 + 0.1));
      const gmap = MODELS.graffiti?.map;
      if (gmap) {
        const g = new THREE.PlaneGeometry(fw * 0.86, fw * 0.86 * 0.75), uv = g.attributes.uv!;
        for (let i = 0; i < uv.count; i++) uv.setY(i, 1 - uv.getY(i));
        const d = new THREE.Mesh(
          g,
          new THREE.MeshToonMaterial({ map: gmap, gradientMap: toonGrad, transparent: true, alphaTest: 0.35, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, emissive: 0xffffff, emissiveMap: gmap, emissiveIntensity: 0.2 }),
        );
        this.pt(0, -15.6 + fz + 0.06, fh * 0.5, d.position);
        d.rotation.y = yR;
        grp.add(d);
      }
    }
    // tambor com fogo
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.42, 1.1, 12), new THREE.MeshToonMaterial({ color: 0x5a3322, gradientMap: toonGrad }));
    this.pt(-8.5, 4, 0.55, barrel.position);
    grp.add(barrel);
    this.pt(-8.5, 4, 1.15, this.fireAt);
    this.colliders.push(circle(barrel.position.x, barrel.position.z, 0.5));
    const fL = new THREE.PointLight(0xff8a3a, 0, 26, 1.6);
    fL.position.copy(this.fireAt).y += 0.9;
    fL.userData.base = 2.8 * 6;
    grp.add(fL);
    this.lights.push(fL);
    const fg2 = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xff7a2a, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.7 }));
    fg2.scale.set(5, 5, 1);
    fg2.position.copy(this.fireAt).y += 0.6;
    grp.add(fg2);
    // torre de iluminação
    inst('jTow1', [[10, -6, yR + 2.4, 1]]);
    {
      const p = this.pt(10, -6);
      this.colliders.push(circle(p.x, p.z, 0.8));
    }
    const ll = new THREE.PointLight(0xffdca0, 0, 44, 1.4);
    this.pt(9.4, -5, 7.2, ll.position);
    ll.userData.base = 2.6 * 8;
    grp.add(ll);
    this.lights.push(ll);
    const lg = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xffe0a8, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.85 }));
    lg.scale.set(6, 6, 1);
    this.pt(10, -6, 7, lg.position);
    grp.add(lg);
    // dois guindastes: a ponta da lança fica exatamente acima de cada canto da bandeira
    let FT = 10.8, FH = 5.6;
    const FW = 10, FB = -12;
    const hooks: THREE.Vector3[] = [];
    const cgeo = geo('jCrane');
    if (cgeo) {
      const pa = cgeo.attributes.position!;
      let ty = -1e9;
      for (let i = 0; i < pa.count; i++) ty = Math.max(ty, pa.getY(i));
      let sheave = -1, best = -1;
      for (let i = 0; i < pa.count; i++) {
        if (pa.getY(i) < ty - 1.2) continue;
        const r = Math.hypot(pa.getX(i), pa.getZ(i));
        if (r > best) {
          best = r;
          sheave = i;
        }
      }
      const sx0 = pa.getX(sheave), sz0 = pa.getZ(sheave);
      let hy = ty, hx = sx0, hz = sz0;
      for (let i = 0; i < pa.count; i++) {
        const y = pa.getY(i);
        if (y < ty - 1.5 && y < hy && Math.hypot(pa.getX(i) - sx0, pa.getZ(i) - sz0) < 0.75) hy = y;
      }
      {
        let sx = 0, sz = 0, n = 0;
        for (let i = 0; i < pa.count; i++) {
          if (pa.getY(i) < hy + 0.4 && Math.hypot(pa.getX(i) - sx0, pa.getZ(i) - sz0) < 0.75) {
            sx += pa.getX(i);
            sz += pa.getZ(i);
            n++;
          }
        }
        if (n) {
          hx = sx / n;
          hz = sz / n;
        }
      }
      FT = hy - 0.05;
      FH = Math.min(5.6, Math.max(3, (FT - 1.2) / 1.35));
      const phi = Math.atan2(hx, hz);
      const cm = new THREE.InstancedMesh(cgeo, propMat('jCrane'), 2);
      [-1, 1].forEach((s, i) => {
        const corner = this.pt((s * FW) / 2, FB), dir = this.along.clone().multiplyScalar(-s), yaw = Math.atan2(dir.x, dir.z) - phi;
        const off = new V3(hx * Math.cos(yaw) + hz * Math.sin(yaw), 0, -hx * Math.sin(yaw) + hz * Math.cos(yaw));
        const base = corner.clone().sub(off);
        base.y = 0;
        cm.setMatrixAt(i, new THREE.Matrix4().compose(base, new THREE.Quaternion().setFromAxisAngle(Yv, yaw), new V3(1, 1, 1)));
        hooks.push(new V3(corner.x, FT, corner.z));
        this.colliders.push(circle(base.x, base.z, 1.6));
      });
      grp.add(cm);
    }
    // bandeira de tecido: presa só pelas duas pontas de cima, uma em cada guindaste
    {
      const fc = document.createElement('canvas');
      fc.width = 1024;
      fc.height = 640;
      const g2 = fc.getContext('2d')!;
      const ft = new THREE.CanvasTexture(fc);
      ft.colorSpace = THREE.SRGBColorSpace;
      g2.fillStyle = '#0B0B0F';
      g2.fillRect(0, 0, 1024, 640);
      const img = FLAG_IMAGE;
      if (img && img.naturalWidth) {
        const k = Math.min(880 / img.naturalWidth, 470 / img.naturalHeight), iw = img.naturalWidth * k, ih = img.naturalHeight * k;
        g2.drawImage(img, (1024 - iw) / 2, (640 - ih) / 2 + 20, iw, ih);
      }
      ft.needsUpdate = true;
      this.cloth = makeCloth({
        pinA: hooks[0] || this.pt(-FW / 2, FB, FT),
        pinB: hooks[1] || this.pt(FW / 2, FB, FT),
        toRoad: this.toRoad,
        along: this.along,
        restW: FW * 1.2,
        restH: FH * 1.05,
        nx: 24,
        ny: 13,
        map: ft,
        group: grp,
      });
    }
  }

  setLights(on: boolean): void {
    for (const L of this.lights) L.intensity = on ? L.userData.base : 0;
  }

  /**
   * a cada quadro: bandeira no vento, fogo tremendo, portão abre com o carro
   * perto (de dentro ou de fora) e fecha depois que ele passa
   */
  update(dt: number, carX: number, carZ: number, emitFire: (p: THREE.Vector3) => void): void {
    if (this.cloth) stepCloth(dt, this.cloth, false, this.lowQuality);
    const L = this.lights[0];
    if (L && L.intensity > 0) L.intensity = L.userData.base * (0.78 + Math.random() * 0.4);
    if (Math.random() < 0.9) emitFire(this.fireAt);
    const gp = this.pt(0, D);
    const near = Math.hypot(carX - gp.x, carZ - gp.z) < 16;
    this.gateOpen = THREE.MathUtils.clamp(this.gateOpen + (near ? dt : -dt) / 1.4, 0, 1);
    if (this.gate) {
      const u = this.gateOpen;
      this.gate.mesh.position.lerpVectors(this.gate.closed, this.gate.open, u * u * (3 - 2 * u));
    }
  }

  get gateClosed(): boolean {
    return this.gateOpen < 0.35;
  }
}

// ---------------- tecido (copiado do original) ----------------
function makeCloth(o: {
  pinA: THREE.Vector3;
  pinB: THREE.Vector3;
  toRoad: THREE.Vector3;
  along: THREE.Vector3;
  restW: number;
  restH: number;
  nx: number;
  ny: number;
  map: THREE.Texture;
  group: THREE.Group;
}): Cloth {
  const nx = o.nx, ny = o.ny, Wd = o.restW, H = o.restH, N = (nx + 1) * (ny + 1);
  const up = new V3(0, 1, 0), xAx = new V3().crossVectors(o.toRoad.clone().negate(), up).normalize();
  const mid = o.pinA.clone().add(o.pinB).multiplyScalar(0.5);
  mid.y -= H / 2;
  const P = new Float32Array(N * 3), Q = new Float32Array(N * 3);
  for (let iy = 0; iy <= ny; iy++)
    for (let ix = 0; ix <= nx; ix++) {
      const i = iy * (nx + 1) + ix, x = -Wd / 2 + (Wd * ix) / nx, y = H / 2 - (H * iy) / ny;
      P[i * 3] = mid.x + xAx.x * x;
      P[i * 3 + 1] = mid.y + y;
      P[i * 3 + 2] = mid.z + xAx.z * x;
    }
  Q.set(P);
  const tl = 0, tr = nx, d = (i: number, p: THREE.Vector3) => Math.hypot(P[i * 3]! - p.x, P[i * 3 + 1]! - p.y, P[i * 3 + 2]! - p.z);
  const pins: [number, THREE.Vector3][] = d(tl, o.pinA) < d(tl, o.pinB) ? [[tl, o.pinA], [tr, o.pinB]] : [[tl, o.pinB], [tr, o.pinA]];
  const pinned = new Uint8Array(N);
  for (const [i] of pins) pinned[i] = 1;
  const Cc: number[] = [];
  const add = (a: number, b: number) => {
    Cc.push(a, b, Math.hypot(P[a * 3]! - P[b * 3]!, P[a * 3 + 1]! - P[b * 3 + 1]!, P[a * 3 + 2]! - P[b * 3 + 2]!));
  };
  for (let iy = 0; iy <= ny; iy++)
    for (let ix = 0; ix <= nx; ix++) {
      const i = iy * (nx + 1) + ix;
      if (ix < nx) add(i, i + 1);
      if (iy < ny) add(i, i + nx + 1);
      if (ix < nx && iy < ny) {
        add(i, i + nx + 2);
        add(i + 1, i + nx + 1);
      }
      if (ix < nx - 1) add(i, i + 2);
      if (iy < ny - 1) add(i, i + 2 * (nx + 1));
    }
  const CS = Float32Array.from(Cc);
  const gF = new THREE.PlaneGeometry(1, 1, nx, ny), gB = new THREE.PlaneGeometry(1, 1, nx, ny);
  const pos = new THREE.BufferAttribute(P, 3);
  pos.setUsage(THREE.DynamicDrawUsage);
  gF.setAttribute('position', pos);
  gB.setAttribute('position', pos);
  const ib = gB.index!.array as Uint16Array;
  for (let t = 0; t < ib.length; t += 3) {
    const x = ib[t + 1]!;
    ib[t + 1] = ib[t + 2]!;
    ib[t + 2] = x;
  }
  const ub = gB.attributes.uv!;
  for (let i = 0; i < ub.count; i++) ub.setX(i, 1 - ub.getX(i));
  const mat = new THREE.MeshToonMaterial({ map: o.map, gradientMap: toonGrad, emissive: 0xffffff, emissiveMap: o.map, emissiveIntensity: 0.42 });
  for (const g of [gF, gB]) {
    const m = new THREE.Mesh(g, mat);
    m.frustumCulled = false;
    o.group.add(m);
  }
  const cl: Cloth = { P, Q, CS, pinned, pins, gF, gB, pos, nx, ny, N, t: 0, skip: 0, colLen: H, toRoad: o.toRoad.clone(), along: o.along.clone() };
  for (let i = 0; i < 300; i++) stepCloth(1 / 60, cl, true, false); // já nasce assentado, não caindo
  return cl;
}

function stepCloth(dt: number, cl: Cloth, settle: boolean, low: boolean): void {
  low = !settle && low;
  if (low && cl.skip++ % 2) return;
  const h = low ? dt * 2 : dt, it = low ? 4 : 9, P = cl.P, Q = cl.Q, CS = cl.CS, pn = cl.pinned;
  cl.t += h;
  // vento em rajadas, empurrando pra rua e um pouco de lado
  const t = cl.t, gust = settle ? 0 : 1.5 + Math.sin(t * 0.63) * 0.9 + Math.sin(t * 1.9 + 1.3) * 0.45 + Math.max(0, Math.sin(t * 0.21)) * 1.6;
  const wx = (cl.toRoad.x * 0.85 + cl.along.x * 0.35) * gust, wz = (cl.toRoad.z * 0.85 + cl.along.z * 0.35) * gust, h2 = h * h;
  const cols = cl.nx + 1;
  for (let i = 0; i < cl.N; i++) {
    if (pn[i]) continue;
    const k = i * 3, row = (i / cols) | 0, v = row / cl.ny;
    const turb = (0.55 + 0.45 * Math.sin(t * 2.7 + i * 0.37)) * (1 - 0.65 * v), grav = row === cl.ny ? 2.6 : 1 + v * 0.5;
    const vx = (P[k]! - Q[k]!) * 0.982, vy = (P[k + 1]! - Q[k + 1]!) * 0.982, vz = (P[k + 2]! - Q[k + 2]!) * 0.982;
    Q[k] = P[k]!;
    Q[k + 1] = P[k + 1]!;
    Q[k + 2] = P[k + 2]!;
    P[k] = P[k]! + vx + wx * turb * h2;
    P[k + 1] = P[k + 1]! + vy - 9.8 * grav * h2;
    P[k + 2] = P[k + 2]! + vz + wz * turb * h2;
  }
  for (let r = 0; r < it; r++) {
    for (let c = 0; c < CS.length; c += 3) {
      const a = CS[c]! * 3, b = CS[c + 1]! * 3, rest = CS[c + 2]!;
      const dx = P[b]! - P[a]!, dy = P[b + 1]! - P[a + 1]!, dz = P[b + 2]! - P[a + 2]!, L = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1e-6, f = (L - rest) / L;
      const pa = pn[CS[c]!], pb = pn[CS[c + 1]!];
      if (pa && pb) continue;
      const wa = pa ? 0 : pb ? 1 : 0.5, wb = pb ? 0 : pa ? 1 : 0.5;
      P[a] = P[a]! + dx * f * wa;
      P[a + 1] = P[a + 1]! + dy * f * wa;
      P[a + 2] = P[a + 2]! + dz * f * wa;
      P[b] = P[b]! - dx * f * wb;
      P[b + 1] = P[b + 1]! - dy * f * wb;
      P[b + 2] = P[b + 2]! - dz * f * wb;
    }
    for (const [i, p] of cl.pins) {
      P[i * 3] = p.x;
      P[i * 3 + 1] = p.y;
      P[i * 3 + 2] = p.z;
    }
    // cada coluna não pode encolher: a borda de baixo não sobe nem dobra por cima do pano
    for (let ix = 0; ix < cols; ix++) {
      const a = ix * 3, b = (cl.ny * cols + ix) * 3;
      const dx = P[b]! - P[a]!, dy = P[b + 1]! - P[a + 1]!, dz = P[b + 2]! - P[a + 2]!, L = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1e-6, minL = cl.colLen * 0.9;
      if (L < minL) {
        const f = (minL - L) / L;
        P[b] = P[b]! + dx * f;
        P[b + 1] = P[b + 1]! + dy * f;
        P[b + 2] = P[b + 2]! + dz * f;
      }
      if (P[b + 1]! > P[a + 1]! - cl.colLen * 0.6) P[b + 1] = P[a + 1]! - cl.colLen * 0.6;
    }
  }
  if (settle) return;
  cl.pos.needsUpdate = true;
  cl.gF.computeVertexNormals();
  cl.gB.computeVertexNormals();
}
