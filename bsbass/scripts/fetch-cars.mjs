// Baixa os carros de scripts/cars.json do Sketchfab, otimiza (malha
// simplificada, meshopt, texturas WebP) e escreve public/models/cars/ +
// manifest.json. Precisa de SKETCHFAB_TOKEN (conta grátis: Settings →
// Password & API → API token) no ambiente.
//
//   node scripts/fetch-cars.mjs            baixa o que ainda não existe
//   node scripts/fetch-cars.mjs --force    rebaixa tudo
//   node scripts/fetch-cars.mjs --local mustang=/caminho/carro.glb
//                                          usa um GLB local no lugar do download

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'public/models/cars');
const tmp = join(root, 'node_modules/.cache/cars');
mkdirSync(out, { recursive: true });
mkdirSync(tmp, { recursive: true });

const list = JSON.parse(readFileSync(join(root, 'scripts/cars.json'), 'utf8'));
const args = process.argv.slice(2);
const force = args.includes('--force');
const local = Object.fromEntries(
  args.flatMap((a, i) => (a === '--local' ? [args[i + 1].split('=')] : [])),
);
const token = process.env.SKETCHFAB_TOKEN;

async function download(uid, dest) {
  if (!token) throw new Error('SKETCHFAB_TOKEN não configurado');
  const r = await fetch(`https://api.sketchfab.com/v3/models/${uid}/download`, { headers: { Authorization: `Token ${token}` } });
  if (!r.ok) throw new Error(`download ${uid}: HTTP ${r.status}`);
  const info = await r.json();
  if (!info.glb?.url) throw new Error(`${uid}: sem GLB pra baixar`);
  const f = await fetch(info.glb.url);
  if (!f.ok) throw new Error(`${uid}: HTTP ${f.status} no arquivo`);
  writeFileSync(dest, Buffer.from(await f.arrayBuffer()));
}

function optimize(src, dest, car) {
  const tris = car.tris ?? 30000;
  const ratio = Math.min(1, tris / Math.max(1, car.faces ?? tris)).toFixed(3);
  execFileSync('npx', ['-y', '@gltf-transform/cli@4', 'optimize', src, dest,
    '--compress', 'meshopt',
    '--texture-compress', 'webp',
    '--texture-size', String(car.tex ?? 512),
    '--simplify', ratio < 1 ? 'true' : 'false',
    '--simplify-ratio', ratio,
    '--simplify-error', '0.002',
    // mantém nós separados (rodas precisam girar) e os nomes
    '--join', 'false',
    '--flatten', 'false',
    '--instance', 'false',
    '--palette', 'false',
  ], { stdio: 'inherit' });
}

const manifest = [];
for (const car of list) {
  const file = `${car.id}.glb`;
  const dest = join(out, file);
  try {
    if (force || !existsSync(dest)) {
      const raw = local[car.id] ?? join(tmp, `${car.id}.raw.glb`);
      if (!local[car.id] && (force || !existsSync(raw))) {
        console.log(`↓ ${car.name}`);
        await download(car.uid, raw);
      }
      console.log(`⚙ ${car.name}`);
      optimize(raw, dest, car);
    }
    console.log(`✓ ${car.name} ${(statSync(dest).size / 1e6).toFixed(1)} MB`);
    const { uid, faces, tris, tex, ...entry } = car;
    manifest.push({ ...entry, file, url: `https://sketchfab.com/3d-models/${uid}` });
  } catch (e) {
    console.warn(`✗ ${car.name}: ${e.message}`);
  }
}
writeFileSync(join(out, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(`manifest: ${manifest.length} carros`);
