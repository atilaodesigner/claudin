// Renders comp.html frame by frame (1080×1920 JPEG).
//   node comp.mjs <outDir> [every=1] [from=0] [to=DUR] [scale=1]
//   e.g. node comp.mjs look/p 15        -> one frame every half second (contact sheets)
import { chromium } from 'playwright-core';
import { existsSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const [outDir = 'out/frames', everyArg, fromArg, toArg, scaleArg] = process.argv.slice(2);
const every = Math.max(1, Number(everyArg) || 1);
const scale = Number(scaleArg) || 1;
mkdirSync(outDir, { recursive: true });

// frame counts of every image sequence the page may index
const counts = {};
for (const root of ['clips', 'frames', 'studio']) {
  const base = join(here, root);
  if (!existsSync(base)) continue;
  const walk = (dir, rel) => {
    const files = readdirSync(dir);
    const imgs = files.filter((f) => /\.(jpg|png)$/.test(f));
    if (imgs.length) counts[rel] = imgs.length;
    for (const f of files) if (statSync(join(dir, f)).isDirectory()) walk(join(dir, f), `${rel}/${f}`);
  };
  walk(base, root);
}

const browser = await chromium.launch({ executablePath: process.env.CHROME || '/opt/pw-browsers/chromium', args: ['--allow-file-access-from-files'] });
const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: scale });
page.on('pageerror', (e) => console.log('pageerror', e.message));
page.on('console', (m) => m.type() === 'error' && console.log('console', m.text()));
if (process.env.CREW) await page.addInitScript(() => { window.CREW = true; });
await page.goto(pathToFileURL(join(here, process.env.PAGE || 'comp.html')).href);
await page.evaluate(async () => {
  const faces = ['900 italic 40px BC', '800 italic 40px BC', '900 40px BC', '700 40px BC', '700 40px CP', '600 40px CP', '900 40px UB', '700 40px UB', '500 40px UB', '700 40px SM', '400 40px SM', '800 40px AR', '700 40px AR', '600 40px AR'];
  await Promise.all(faces.map((f) => document.fonts.load(f, 'ABÇÃÉÍÔ')));
  await document.fonts.ready;
});
const DUR = await page.evaluate((c) => {
  window.COMP.init(c);
  return window.COMP.DUR;
}, counts);
const f0 = Math.round((Number(fromArg) || 0) * 30);
const f1 = Math.round((Number(toArg) || DUR) * 30);
const t0 = Date.now();
for (let f = f0; f < f1; f += every) {
  await page.evaluate((t) => window.COMP.paint(t), f / 30);
  await page.screenshot({ path: join(outDir, `${String(f).padStart(5, '0')}.jpg`), type: 'jpeg', quality: 92 });
  if ((f - f0) % 300 === 0) console.log(`[comp] ${(f / 30).toFixed(1)}s`);
}
console.log(`[comp] frames ${f0}-${f1 - 1} every ${every} in ${((Date.now() - t0) / 1000).toFixed(0)}s`);
await browser.close();
