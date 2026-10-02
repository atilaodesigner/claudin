// Instâncias espalhadas pelo mapa inteiro num InstancedMesh só não deixam a
// câmera descartar nada (a esfera de corte cobre a cidade toda): tudo é
// desenhado, até o que está atrás ou a 600 m. Aqui cada modelo é repartido em
// pedaços de CELL metros, e o ChunkCuller esconde os pedaços longe da câmera.
// O que sobra fora da tela o three já descarta pela esfera de cada pedaço.

import * as THREE from 'three';

export const CELL = 160;

/** pedaço da grade de uma posição */
export function cellOf(x: number, z: number): string {
  return `${Math.floor(x / CELL)},${Math.floor(z / CELL)}`;
}

/** agrupa índices de instância por pedaço (pela posição da matriz base) */
export function groupByCell(base: THREE.Matrix4[]): number[][] {
  const by = new Map<string, number[]>();
  base.forEach((m, i) => {
    const k = cellOf(m.elements[12]!, m.elements[14]!);
    if (!by.has(k)) by.set(k, []);
    by.get(k)!.push(i);
  });
  return [...by.values()];
}

interface Entry {
  im: THREE.InstancedMesh;
  far: number;
}

/** esconde os pedaços além da distância de desenho de cada um */
export class ChunkCuller {
  private list: Entry[] = [];
  private v = new THREE.Vector3();

  /** `far` = metros até a borda da esfera do pedaço */
  add(im: THREE.InstancedMesh, far: number): void {
    if (!im.boundingSphere) im.computeBoundingSphere();
    this.list.push({ im, far });
  }

  get size(): number {
    return this.list.length;
  }

  update(cam: THREE.Vector3): void {
    for (const e of this.list) {
      const s = e.im.boundingSphere!;
      this.v.copy(s.center).applyMatrix4(e.im.matrixWorld);
      const d = Math.hypot(this.v.x - cam.x, this.v.z - cam.z) - s.radius;
      e.im.visible = d < e.far;
    }
  }

  /** mostra tudo (pré-compilação dos shaders) */
  showAll(): void {
    for (const e of this.list) e.im.visible = true;
  }
}
