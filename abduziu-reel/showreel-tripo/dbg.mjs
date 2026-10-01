// Debug probe: node dbg.mjs <shot> <every> "<js expression evaluated with g=window.__game>" [frames]
import { chromium } from 'playwright-core';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const here = dirname(fileURLToPath(import.meta.url));
const [shot, every, expr, nf] = process.argv.slice(2);
const QUERY = {};
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 270, height: 480 } });
page.setDefaultTimeout(0);
page.on('pageerror', (e) => console.log('pageerror', e.message));
await page.goto('http://localhost:4173/' + (QUERY[shot] ?? ''));
await page.waitForFunction(() => window.__game && window.__game.state === 'menu', null, { timeout: 180000 });
await page.waitForTimeout(800);
await page.addScriptTag({ path: join(here, 'director.js') });
const { f0, f1 } = await page.evaluate((s) => window.TRAILER.prepare(s), shot);
const end = nf ? f0 + Number(nf) : f1;
for (let i = f0; i < end; i++) {
  await page.evaluate(([n]) => window.TRAILER.frame(n, false), [i]);
  if ((i - f0) % Number(every) === 0) console.log(i - f0, await page.evaluate((e) => { const g = window.__game; return JSON.stringify(eval(e)); }, expr));
}
await browser.close();
