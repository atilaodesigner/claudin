// Downloads the generic pedestrians: Quaternius "Ultimate Modular Men" + "Ultimate Modular Women"
// (CC0 1.0, https://quaternius.com), the glTF files of the packs' public Google Drive folders,
// into source/quaternius/ (git-ignored: only the baked public/crowd/* ships with the game).
//   node fetch.mjs
import { mkdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const FILES = {
  'M_Suit.gltf': '1NhXHnGU0zK9hBrT5FoZp8nTz_EmvTPg5',
  'M_Worker.gltf': '14d8n7IDnnlnGt_uiATnNg3uvi_4dyd9V',
  'M_Beach.gltf': '1IL1YJPJvNkuGnKI69-W-VMBIDCo-u49N',
  'M_Casual_2.gltf': '1Jn7kULNmrtqP8BUUL19h8MhbdOnwPFhv',
  'M_Casual_Hoodie.gltf': '1em1So1xwwQNfHJYMvzKcXkZllvtxpKP5',
  'M_Farmer.gltf': '1B9Dln-oR5Yk6sdsDR3yHCw86LobAN3Zd',
  'M_Punk.gltf': '1yHWu5ezXq4dYBcn4sWiNd16YN9fMtXo0',
  'W_Formal.gltf': '1iayBzVv_zLjuPtaNPouw_auwKlQLLmes',
  'W_Suit.gltf': '1GjWtofxjmPku25cXJxHrzLLeUbXw7A_s',
  'W_Worker.gltf': '1iwF_fqDErPH9uyol6NmS-MnzGgsZ5ejV',
  'W_Casual.gltf': '18b3WwlrwrFYWAM7BcnjWeIxKJyxAQiGh',
  'W_Punk.gltf': '1ITb_iFiroAsmjQI38z_p6nNXinwliVLA',
  'W_Adventurer.gltf': '1uxAFnDp73NO1c16LvHHjAYh1-deMNk5I',
};
const out = join(here, 'source', 'quaternius');
await mkdir(out, { recursive: true });
for (const [name, id] of Object.entries(FILES)) {
  const file = join(out, name);
  if (existsSync(file)) continue;
  const r = await fetch(`https://drive.usercontent.google.com/download?id=${id}&export=download&confirm=t`);
  if (!r.ok) throw new Error(`${name}: HTTP ${r.status}`);
  const buf = Buffer.from(await r.arrayBuffer());
  if (buf[0] !== 0x7b) throw new Error(`${name}: not a glTF (Drive returned a page?)`);
  await writeFile(file, buf);
  console.log(`${name} ${(buf.length / 1e6).toFixed(1)} MB`);
}
