// Renders trailer shots to JPEG frames by driving the real game with director.js.
//   node capture.mjs <gameUrl> <outDir> [every=1] shotId [shotId...]
import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const [url, outDir, everyArg, ...shots] = process.argv.slice(2);
const every = Math.max(1, Number(everyArg) || 1);
mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch({
  executablePath: process.env.CHROME || '/opt/pw-browsers/chromium',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
for (const id of shots) {
  const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 }, serviceWorkers: 'block' });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log(`[${id}] pageerror`, e.message));
  await page.goto(url);
  await page.waitForFunction(() => window.__game && window.__game.state === 'menu', null, { timeout: 180000 });
  await page.waitForTimeout(1500);
  await page.addScriptTag({ path: join(here, 'director.js') });
  const { f0, f1 } = await page.evaluate((s) => window.TRAILER.prepare(s), id);
  const t0 = Date.now();
  for (let i = f0; i < f1; i++) {
    const draw = (i - f0) % every === 0;
    await page.evaluate(([n, d]) => window.TRAILER.frame(n, d), [i, draw]);
    if (draw) await page.screenshot({ path: join(outDir, `${String(i).padStart(5, '0')}.jpg`), type: 'jpeg', quality: 93 });
  }
  console.log(`[${id}] frames ${f0}-${f1 - 1} in ${((Date.now() - t0) / 1000).toFixed(0)}s`);
  await ctx.close();
}
await browser.close();
