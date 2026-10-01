// Poste de verdade: poste de madeira do Poly Haven (CC0, com cruzeta,
// isoladores e, num dos dois, transformador) com braço curvo de ferro
// galvanizado e luminária arredondada acesa na ponta. O braço aponta pra +Z
// local (pra rua), igual ao poste de desenho, e a lente fica na mesma altura.

import * as THREE from 'three';
import { mergeByMaterial } from '../utils/mergeModel';

/** o poste do pacote tem 6 m; escala pra 8,4 m (cruzeta a ~8 m, onde passam os fios) */
const POLE_K = 1.4;
/** altura da base da luminária e quanto ela sai do poste (o cone de luz parte daí) */
export const HEAD_Y = 8.62;
export const HEAD_OUT = 2.2;
/** pontos de amarração dos fios (deslocamento pra rua, altura): cruzeta de cima e de baixo */
export const WIRE_TIES: [number, number][] = [[-0.74, 8.12], [0.74, 8.12], [0.42, 6.6]];

export interface LampPart {
  geo: THREE.BufferGeometry;
  mat: THREE.Material;
}

export interface LampModel {
  /**
   * por variante de poste: as peças leves (poste, braço, luminária) e a
   * pesada (cruzeta com isoladores, transformador), que some de longe
   */
  variants: { parts: LampPart[]; detail: LampPart | null }[];
  /** só braço + luminária (pros postes de braço duplo do canteiro) */
  arm: LampPart[];
}

function armParts(): LampPart[] {
  const metal = new THREE.MeshStandardMaterial({ color: 0x8b8f93, metalness: 0.65, roughness: 0.45 });
  const housing = new THREE.MeshStandardMaterial({ color: 0x55595e, metalness: 0.5, roughness: 0.38 });
  const lens = new THREE.MeshBasicMaterial({ color: new THREE.Color(0xffb050).multiplyScalar(3.2) });
  // braço curvo saindo do topo do poste
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 8.22, 0.08),
    new THREE.Vector3(0, 8.5, 0.62),
    new THREE.Vector3(0, 8.68, 1.35),
    new THREE.Vector3(0, 8.72, HEAD_OUT - 0.25),
  ]);
  const arm = new THREE.TubeGeometry(curve, 10, 0.045, 6, false);
  // abraçadeira no poste
  const clamp = new THREE.CylinderGeometry(0.135, 0.135, 0.16, 8, 1, true).translate(0, 8.22, 0);
  // luminária "cabeça de cobra": meia gota achatada, lente embaixo
  const dome = new THREE.SphereGeometry(1, 14, 5, 0, Math.PI * 2, 0, Math.PI / 2).scale(0.23, 0.15, 0.48).translate(0, HEAD_Y, HEAD_OUT);
  const lip = new THREE.CylinderGeometry(1, 1, 1, 14, 1, true).scale(0.23, 0.035, 0.48).translate(0, HEAD_Y - 0.017, HEAD_OUT);
  const glass = new THREE.CircleGeometry(1, 14).rotateX(Math.PI / 2).scale(0.2, 1, 0.43).translate(0, HEAD_Y - 0.03, HEAD_OUT);
  return [
    { geo: mergeTwo(arm, clamp), mat: metal },
    { geo: mergeTwo(dome, lip), mat: housing },
    { geo: glass, mat: lens },
  ];
}

function mergeTwo(a: THREE.BufferGeometry, b: THREE.BufferGeometry): THREE.BufferGeometry {
  const pos: number[] = [], nor: number[] = [];
  for (const g of [a, b]) {
    const n = g.index ? g.toNonIndexed() : g;
    pos.push(...(n.attributes.position!.array as Float32Array));
    nor.push(...(n.attributes.normal!.array as Float32Array));
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  return out;
}

/** tronco do poste (8,4 m, um pouco mais grosso embaixo), textura enrolada uma vez em volta */
function trunk(): THREE.BufferGeometry {
  const h = 6 * POLE_K;
  return new THREE.CylinderGeometry(0.1, 0.125, h, 12, 4, false).translate(0, h / 2, 0);
}

/** monta as variantes a partir dos GLB que carregaram; null = fica o poste de desenho */
export function buildLampModel(poles: (THREE.Object3D | undefined)[]): LampModel | null {
  const found = poles.filter((p): p is THREE.Object3D => !!p);
  if (!found.length) return null;
  const arm = armParts();
  // cruzeta do pacote fica no X: gira pra ela atravessar a calçada (fios correm ao longo da rua)
  const fit = new THREE.Matrix4().makeRotationY(Math.PI / 2).multiply(new THREE.Matrix4().makeScale(POLE_K, POLE_K, POLE_K));
  const variants = found.map((root) => {
    let detail: LampPart | null = null;
    const parts: LampPart[] = [];
    for (const { geo, mat } of mergeByMaterial(root)) {
      geo.applyMatrix4(fit);
      const sm = mat as THREE.MeshStandardMaterial;
      // madeira velha molhada: reflexo fraco
      if (sm.isMeshStandardMaterial) sm.envMapIntensity = 0.6;
      // o tronco tem poucas dezenas de triângulos; as pecinhas, milhares
      const tris = (geo.index ? geo.index.count : geo.attributes.position!.count) / 3;
      if (tris > 500 && !detail) detail = { geo, mat };
      // o simplificador afina o tronco até virar espeto: refaz como cilindro com a mesma textura de madeira
      else if (tris < 100) parts.push({ geo: trunk(), mat });
      else parts.push({ geo, mat });
    }
    return { parts: [...parts, ...arm], detail };
  });
  return { variants, arm };
}
