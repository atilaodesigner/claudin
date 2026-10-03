// Downloads the Kenney kits used by src/config/kitCatalog.ts into source/<kit>/ (GLB files,
// textures and the CC0 license). The zip links are read from each kit's page on kenney.nl.
//   node fetch.mjs
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, rmSync, writeFileSync, copyFileSync, statSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const KITS = ['food-kit', 'furniture-kit', 'car-kit', 'nature-kit', 'holiday-kit', 'mini-market', 'train-kit', 'watercraft-kit', 'space-kit', 'survival-kit', 'retro-urban-kit', 'cube-pets', 'mini-characters', 'mini-skate', 'racing-kit', 'platformer-kit', 'fantasy-town-kit', 'pirate-kit', 'graveyard-kit', 'factory-kit'];

const walk = (dir) => readdirSync(dir).flatMap((f) => (statSync(join(dir, f)).isDirectory() ? walk(join(dir, f)) : [join(dir, f)]));

for (const kit of KITS) {
  const out = join(here, 'source', kit);
  if (existsSync(out) && readdirSync(out).some((f) => f.endsWith('.glb'))) continue;
  const page = await (await fetch(`https://kenney.nl/assets/${kit}`)).text();
  const url = page.match(/https:\/\/kenney\.nl\/media\/pages\/assets\/[^"]+\.zip/)?.[0];
  if (!url) throw new Error(`no download link on the ${kit} page`);
  const zip = join(here, 'source', `${kit}.zip`);
  const tmp = join(here, 'source', `${kit}.tmp`);
  mkdirSync(out, { recursive: true });
  writeFileSync(zip, Buffer.from(await (await fetch(url)).arrayBuffer()));
  execFileSync('unzip', ['-q', '-o', zip, '-d', tmp]);
  for (const f of walk(tmp)) {
    const name = basename(f);
    if (name.endsWith('.glb') || /^license/i.test(name)) copyFileSync(f, join(out, name));
    if (/colormap.*\.png$/i.test(name) || f.includes('/Textures/')) {
      mkdirSync(join(out, 'Textures'), { recursive: true });
      copyFileSync(f, join(out, 'Textures', name));
    }
  }
  rmSync(tmp, { recursive: true, force: true });
  rmSync(zip, { force: true });
  console.log(kit, readdirSync(out).filter((f) => f.endsWith('.glb')).length, 'models');
}
