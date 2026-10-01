// Renders feature-reel shots to JPEG frames by driving the real game with director.js.
//   node capture.mjs <gameUrl> <outDir> [every=1] shotId [shotId...]
// Env: W/H (viewport, default 1080x1920), DPR (device scale).
// Next to the frames: events-<shot>.json (sound design) and tracks-<shot>.json (overlay tags).
import { chromium } from 'playwright-core';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const [url, outDir, everyArg, ...shots] = process.argv.slice(2);
const every = Math.max(1, Number(everyArg) || 1);
const QUERY = {};
mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch({
  executablePath: process.env.CHROME || '/opt/pw-browsers/chromium',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
for (const id of shots) {
  const ctx = await browser.newContext({ viewport: { width: Number(process.env.W || 1080), height: Number(process.env.H || 1920) }, deviceScaleFactor: Number(process.env.DPR || 1), serviceWorkers: 'block' });
  const page = await ctx.newPage();
  page.setDefaultTimeout(0);
  page.on('pageerror', (e) => console.log(`[${id}] pageerror`, e.message));
  await page.goto(url + (QUERY[id] ?? ''));
  await page.waitForFunction(() => window.__game && window.__game.state === 'menu', null, { timeout: 180000 });
  await page.waitForTimeout(1500);
  await page.addScriptTag({ path: join(here, 'director.js') });
  const { f0, f1 } = await page.evaluate((s) => window.TRAILER.prepare(s), id);
  const t0 = Date.now();
  for (let i = f0; i < f1; i++) {
    const draw = (i - f0) % every === 0;
    await page.evaluate(([n, d]) => window.TRAILER.frame(n, d), [i, draw]);
    if (draw) await page.screenshot({ path: join(outDir, `${String(i).padStart(5, '0')}.jpg`), type: 'jpeg', quality: 94, timeout: 0 });
  }
  const events = await page.evaluate(() => window.TRAILER.events ?? []);
  const tracks = await page.evaluate(() => window.TRAILER.tracks ?? []);
  writeFileSync(join(outDir, `events-${id}.json`), JSON.stringify(events));
  if (tracks.length) writeFileSync(join(outDir, `tracks-${id}.json`), JSON.stringify(tracks));
  console.log(`[${id}] frames ${f0}-${f1 - 1} in ${((Date.now() - t0) / 1000).toFixed(0)}s · ${events.length} events`);
  await ctx.close();
}
await browser.close();
