// Baixa os objetos de rua do Poly Haven (CC0) listados abaixo, otimiza
// (texturas WebP pequenas, malha simplificada, meshopt) e grava em
// public/models/<id>.glb. Não precisa de token.
//
//   node scripts/fetch-props.mjs           baixa o que ainda não existe
//   node scripts/fetch-props.mjs --force   rebaixa tudo

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'public/models');
const tmp = join(root, 'node_modules/.cache/props');
const force = process.argv.includes('--force');

// id do Poly Haven → tamanho da textura e fração de triângulos que fica
const PROPS = [
  { id: 'plastic_monobloc_chair_01', tex: 256, ratio: 0.35, error: 0.004 }, // cadeira de bar
  { id: 'plastic_crate_02', tex: 256, ratio: 0.4, error: 0.005 }, // engradado de cerveja
  { id: 'propane_tank', tex: 256, ratio: 0.15, error: 0.008 }, // botijão de gás
  { id: 'trashbag', tex: 256, ratio: 0.12, error: 0.01 }, // saco de lixo
  { id: 'wooden_crate_01', tex: 256, ratio: 0.3, error: 0.004 }, // caixote de feira
  // postes de madeira de verdade: o pacote traz três montados (preset_01..03); pega só um por arquivo
  { id: 'modular_electricity_poles', out: 'utility_pole_a', nodes: 'preset_02_', skip: 'ring_|bolt_|nail|connection_single', tex: 512, ratio: 0.04, error: 0.06 }, // cruzetas e isoladores
  { id: 'modular_electricity_poles', out: 'utility_pole_b', nodes: 'preset_03_', skip: 'ring_|bolt_|nail|connection_single', tex: 512, ratio: 0.04, error: 0.06 }, // com transformador
];

async function get(url, dest) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`HTTP ${r.status} em ${url}`);
  mkdirSync(dirname(dest), { recursive: true });
  writeFileSync(dest, Buffer.from(await r.arrayBuffer()));
}

for (const p of PROPS) {
  const dest = join(out, `${p.out ?? p.id}.glb`);
  try {
    if (force || !existsSync(dest)) {
      const dir = join(tmp, p.id);
      const files = await (await fetch(`https://api.polyhaven.com/files/${p.id}`)).json();
      const g = files.gltf['1k'].gltf;
      let src = join(dir, `${p.id}.gltf`);
      console.log(`↓ ${p.id}`);
      if (force || !existsSync(src)) {
        await get(g.url, src);
        for (const [rel, f] of Object.entries(g.include ?? {})) await get(f.url, join(dir, rel));
      }
      if (p.nodes) {
        // só os nós com esse prefixo, com o poste na origem (o resto o optimize joga fora)
        const doc = JSON.parse(readFileSync(src, 'utf8'));
        const skip = p.skip ? new RegExp(p.skip) : null; // peças miúdas que não aparecem no jogo
        const keep = doc.scenes[0].nodes.filter((i) => doc.nodes[i].name.startsWith(p.nodes) && !skip?.test(doc.nodes[i].name));
        const pole = doc.nodes.find((n) => n.name === `${p.nodes}pole`);
        const x0 = pole?.translation?.[0] ?? 0;
        for (const i of keep) {
          const t = doc.nodes[i].translation ?? [0, 0, 0];
          doc.nodes[i].translation = [t[0] - x0, t[1], t[2]];
        }
        doc.scenes[0].nodes = keep;
        src = join(dir, `${p.out}.gltf`);
        writeFileSync(src, JSON.stringify(doc));
      }
      console.log(`⚙ ${p.out ?? p.id}`);
      execFileSync('npx', ['-y', '@gltf-transform/cli@4', 'optimize', src, dest,
        '--compress', 'meshopt',
        '--texture-compress', 'webp',
        '--texture-size', String(p.tex),
        '--simplify', p.ratio < 1 ? 'true' : 'false',
        '--simplify-ratio', String(p.ratio),
        '--simplify-error', String(p.error ?? 0.001),
        '--instance', 'false',
        ...(p.nodes ? ['--join', 'true'] : []),
      ], { stdio: 'inherit' });
    }
    console.log(`✓ ${p.out ?? p.id} ${(statSync(dest).size / 1e3).toFixed(0)} kB`);
  } catch (e) {
    console.warn(`✗ ${p.out ?? p.id}: ${e.message}`);
  }
}
