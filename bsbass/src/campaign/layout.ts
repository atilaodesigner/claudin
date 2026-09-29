// Onde ficam as coisas da campanha na cidade (dados puros, sem import):
// os circuitos dos 5 capítulos e a quadra do ferro-velho. A cidade usa isso
// pra deixar a quadra livre e não estacionar carro no meio das rotas.

export type Node = [number, number];

export interface RouteDef {
  /** índice do capítulo (0..4) */
  chapter: number;
  /** cantos do circuito, em ordem; o ponto do capítulo fica no meio do primeiro trecho */
  nodes: Node[];
}

export const ROUTES: RouteDef[] = [
  // 1. Na Mira: sudoeste, perto do ferro-velho
  { chapter: 0, nodes: [[3, 3], [0, 3], [0, 2], [1, 2], [1, 1], [0, 1], [0, 0], [3, 0], [3, 1], [2, 1], [2, 2], [3, 2]] },
  // 2. O Corre: sudeste
  { chapter: 1, nodes: [[8, 0], [5, 0], [5, 1], [6, 1], [6, 2], [5, 2], [5, 3], [8, 3], [8, 2], [7, 2], [7, 1], [8, 1]] },
  // 3. A Carga: nordeste, na borda leste
  { chapter: 2, nodes: [[8, 7], [8, 8], [5, 8], [5, 7], [6, 7], [6, 6], [5, 6], [5, 5], [8, 5], [8, 6], [7, 6], [7, 7]] },
  // 4. No Retrovisor: noroeste
  { chapter: 3, nodes: [[0, 8], [3, 8], [3, 7], [2, 7], [2, 6], [3, 6], [3, 5], [0, 5], [0, 6], [1, 6], [1, 7], [0, 7]] },
  // 5. Sumir na Noite: o miolo, cruzando a avenida duas vezes
  { chapter: 4, nodes: [[5, 6], [3, 6], [3, 5], [2, 5], [2, 3], [3, 3], [3, 1], [5, 1], [5, 3], [6, 3], [6, 5], [5, 5]] },
];

/** quadra do ferro-velho (entre os nós i..i+1, j..j+1); o portão dá pra avenida */
export const YARD_BLOCK = { i: 2, j: 3 };


/** trechos de rua (entre nós vizinhos) usados por qualquer rota: "i,j|i,j" */
export function routeStreetSegments(): Set<string> {
  const out = new Set<string>();
  for (const r of ROUTES) {
    const m = r.nodes.length;
    for (let c = 0; c < m; c++) {
      const [i0, j0] = r.nodes[c]!, [i1, j1] = r.nodes[(c + 1) % m]!;
      const si = Math.sign(i1 - i0), sj = Math.sign(j1 - j0);
      let i = i0, j = j0;
      while (i !== i1 || j !== j1) {
        const a = `${i},${j}`, b = `${i + si},${j + sj}`;
        out.add(a < b ? `${a}|${b}` : `${b}|${a}`);
        i += si;
        j += sj;
      }
    }
  }
  return out;
}
