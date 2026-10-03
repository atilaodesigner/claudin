// Renders Play Store screenshot candidates (1920x1080 PNG) from the real game, reusing director.js.
//   node stills.mjs <gameUrl> <outDir> <every> <hud:0|1> clip [clip...]
import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const [url, outDir, everyArg, hudArg, ...clips] = process.argv.slice(2);
const every = Number(everyArg) || 30;
const hud = hudArg === '1';
// FRAMES=359,404 renders only those frames (otherwise one every <every>)
const only = process.env.FRAMES ? new Set(process.env.FRAMES.split(',').map(Number)) : null;
mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.CHROME || '/opt/pw-browsers/chromium',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
for (const id of clips) {
  const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 }, serviceWorkers: 'block' });
  const page = await ctx.newPage();
  page.setDefaultTimeout(0);
  page.on('pageerror', (e) => console.log(`[${id}] pageerror`, e.message));
  await page.goto(id === 'espaco' ? `${url}?city=rio` : url);
  await page.waitForFunction(() => window.__game && window.__game.state === 'menu', null, { timeout: 180000 });
  await page.waitForTimeout(1500);
  await page.addScriptTag({ path: join(process.cwd(), 'director.js') });
  const { f0, f1 } = await page.evaluate((s) => window.TRAILER.prepare(s), id);
  if (hud) {
    // show the real HUD (the director hides all UI for the clean videos)
    await page.evaluate(() => {
      for (const s of document.querySelectorAll('style')) if (s.textContent.includes('#ui > *:not(.space-flash)')) s.remove();
    });
  }
  const last = only ? Math.max(...only) + 1 : f1;
  for (let i = f0; i < last; i++) {
    const draw = only ? only.has(i) : (i - f0) % every === every - 1;
    await page.evaluate(([n, d]) => window.TRAILER.frame(n, d), [i, draw]);
    if (draw) await page.screenshot({ path: join(outDir, `${id}${hud ? '-hud' : ''}-${String(i).padStart(4, '0')}.png`), timeout: 0 });
  }
  console.log(`[${id}] done`);
  await ctx.close();
}
await browser.close();
