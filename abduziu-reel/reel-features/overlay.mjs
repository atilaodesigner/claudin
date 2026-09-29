// Renders the caption layer (overlay.html) to transparent PNG frames for one language.
//   node overlay.mjs <framesDir> <lang> <outDir> [every=1] [f0=0] [f1=1536]
// Reads tracks-*.json / events-*.json that capture.mjs wrote next to the footage.
import { chromium } from 'playwright-core';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const [framesDir, lang, outDir, everyArg, f0Arg, f1Arg] = process.argv.slice(2);
const every = Math.max(1, Number(everyArg) || 1);
const f0 = Number(f0Arg) || 0;
const f1 = Number(f1Arg) || 1536;
mkdirSync(outDir, { recursive: true });

const SHOTS = ['hook', 'orbit', 'grow', 'beach', 'legends', 'army', 'arena', 'friends', 'skins', 'end'];
const read = (f) => (existsSync(f) ? JSON.parse(readFileSync(f, 'utf8')) : null);
const tracks = {};
const events = {};
for (const s of SHOTS) {
  const t = read(join(framesDir, `tracks-${s}.json`));
  if (t) tracks[s] = t;
  const e = read(join(framesDir, `events-${s}.json`));
  if (e) events[s] = e;
}

const browser = await chromium.launch({ executablePath: process.env.CHROME || '/opt/pw-browsers/chromium' });
const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
page.on('pageerror', (e) => console.log('pageerror', e.message));
await page.goto(pathToFileURL(join(here, 'overlay.html')).href);
await page.evaluate(async () => {
  const faces = ['900 italic 40px BC', '800 italic 40px BC', '900 40px BC', '700 40px BC', '700 40px CP', '600 40px CP'];
  await Promise.all(faces.map((f) => document.fonts.load(f, 'ABÇÃÉ')));
  await document.fonts.ready;
});
await page.evaluate((o) => window.OVERLAY.init(o), { lang, tracks, events });
const t0 = Date.now();
for (let i = f0; i < f1; i += every) {
  await page.evaluate((t) => window.OVERLAY.paint(t), i / 60);
  await page.screenshot({ path: join(outDir, `${String(i).padStart(5, '0')}.png`), omitBackground: true });
}
console.log(`[overlay ${lang}] frames ${f0}-${f1 - 1} in ${((Date.now() - t0) / 1000).toFixed(0)}s`);
await browser.close();
