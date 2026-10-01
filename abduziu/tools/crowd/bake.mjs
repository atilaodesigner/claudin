// ABDUZIU crowd pipeline driver (characters.json lists the characters).
//   node bake.mjs prep       -> work/<id>.glb for generic pedestrians ("prep" entries): merged mesh,
//                               palette texture, authored run/afraid/freaky/swim (src/prep.js)
//   node bake.mjs sheet      -> work/sheet-<id>.png: the authored clips of the "prep" entries
//   node bake.mjs simplify   -> work/<id>.glb: decimated copies of source/<id>.glb (skin and UVs kept)
//   node bake.mjs preview    -> work/preview-<id>.png: every clip, a few poses (check before baking)
//   node bake.mjs bake       -> ../../public/crowd/<id>.bin + <id>.webp (what the game loads)
//   node bake.mjs thumbs     -> ../../public/crowd/thumbs/<id>.webp: dex portraits of the "thumb" entries (memes)
import { execFileSync } from 'node:child_process';
import { chromium } from 'playwright-core';
import { createServer } from 'node:http';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const gameRoot = resolve(here, '../..');
const mode = process.argv[2] ?? 'preview';
const chars = JSON.parse(await readFile(join(here, 'characters.json'), 'utf8'));

if (mode === 'simplify') {
  await mkdir(join(here, 'work'), { recursive: true });
  for (const c of chars) {
    if (c.prep) continue; // generic pedestrians come out of `prep`
    execFileSync('node', [join(here, 'src/simplify.mjs'), join(here, c.source), join(here, c.file), String(c.tris ?? 5000)], { stdio: 'inherit' });
  }
  process.exit(0);
}

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.glb': 'model/gltf-binary', '.gltf': 'model/gltf+json', '.json': 'application/json' };
const server = createServer(async (req, res) => {
  const p = join(gameRoot, decodeURIComponent(new URL(req.url, 'http://x').pathname));
  if (!p.startsWith(gameRoot) || !existsSync(p)) {
    res.writeHead(404).end();
    return;
  }
  res.writeHead(200, { 'Content-Type': MIME[extname(p)] ?? 'application/octet-stream' });
  res.end(await readFile(p));
});
await new Promise((r) => server.listen(0, r));
const base = `http://localhost:${server.address().port}/tools/crowd/`;

const browser = await chromium.launch({
  executablePath: process.env.CHROME || '/opt/pw-browsers/chromium',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('pageerror', e.message));
page.on('console', (m) => m.type() === 'error' && console.log('console', m.text()));
const prepMode = mode === 'prep' || mode === 'sheet';
await page.goto(base + (prepMode ? 'src/prep.html' : 'src/bake.html'));
await page.waitForFunction(() => window.ready === true, null, { timeout: 60000 });

const url = (f) => base + f;
// optional filter: a character id, or "generic" for every prep entry
const only = process.argv[3];
const pick = (c) => !only || c.id === only || (only === 'generic' && c.prep);
if (prepMode) {
  await mkdir(join(here, 'work'), { recursive: true });
  for (const c of chars.filter((x) => x.prep && pick(x))) {
    if (mode === 'sheet') {
      const r = await page.evaluate((o) => window.sheet(o), { file: url(c.prep), yaw: Number(process.env.YAW ?? 0.6), cell: Number(process.env.CELL ?? 200) });
      await writeFile(join(here, 'work', `sheet-${c.id}.png`), Buffer.from(r.png.split(',')[1], 'base64'));
      console.log(`${c.id}: work/sheet-${c.id}.png`);
    } else {
      const r = await page.evaluate((o) => window.prep(o), { file: url(c.prep) });
      await writeFile(join(here, c.file), Buffer.from(r.glb, 'base64'));
      const i = r.info;
      console.log(`${c.id} (${c.prep}) ${i.materials} colours, ${i.vertices} verts, ${i.triangles} tris, h=${i.height}, run speed ${i.speed} · ${i.clips.join(' · ')}`);
    }
  }
} else if (mode === 'thumbs') {
  const out = join(gameRoot, 'public', 'crowd', 'thumbs');
  await mkdir(out, { recursive: true });
  for (const c of chars.filter((x) => x.thumb && pick(x))) {
    const r = await page.evaluate((o) => window.thumb(o), { file: url(c.source), extra: (c.extra ?? []).map(url), ...c.thumb });
    await writeFile(join(out, `${c.id}.webp`), Buffer.from(r.webp, 'base64'));
    console.log(`${c.id}: public/crowd/thumbs/${c.id}.webp`);
  }
} else if (mode === 'preview') {
  for (const c of chars.filter(pick)) {
    const r = await page.evaluate((o) => window.preview(o), { file: url(c.file), extra: (c.extra ?? []).map(url), clips: c.clips?.map((x) => x.name) });
    await writeFile(join(here, 'work', `preview-${c.id}.png`), Buffer.from(r.png.split(',')[1], 'base64'));
    console.log(`${c.id} (${c.file}) bones=${r.bones} h=${r.height.toFixed(3)}\n  ${r.info.join('\n  ')}`);
  }
} else {
  const out = join(gameRoot, 'public', 'crowd');
  await mkdir(out, { recursive: true });
  for (const c of chars.filter(pick)) {
    const r = await page.evaluate((o) => window.bake(o), { id: c.id, file: url(c.file), extra: (c.extra ?? []).map(url), clips: c.clips, height: c.height ?? 1.75, texSize: c.texSize ?? 512, turn: c.turn ?? 0 });
    await writeFile(join(out, `${c.id}.bin`), Buffer.from(r.bin, 'base64'));
    await writeFile(join(out, `${c.id}.webp`), Buffer.from(r.webp, 'base64'));
    const clips = r.info.clips.map((k) => `${k.name}(${k.frames}f ${k.duration.toFixed(2)}s)`).join(' ');
    console.log(`${c.id}: ${r.info.vertexCount} verts, ${r.info.indexCount / 3} tris, ${r.info.frames} frames · ${(r.info.bytes / 1024).toFixed(0)} KB + webp ${(Buffer.from(r.webp, 'base64').length / 1024).toFixed(0)} KB · ${clips}`);
  }
}
await browser.close();
server.close();
