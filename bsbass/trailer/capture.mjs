// Renderiza cenas do trailer quadro a quadro (JPEG) a partir do jogo rodando.
//   node capture.mjs <url> <pasta> <passo> <cena...>
// passo = 1 pro vídeo final; 10 = prévia (1 de cada 10 quadros).
import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const [url = 'http://localhost:4173/', out = 'frames', stepArg = '1', ...ids] = process.argv.slice(2);
const stride = Number(stepArg) || 1;
const here = dirname(fileURLToPath(import.meta.url));
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'],
});
for (const id of ids) {
  const page = await (await browser.newContext({ viewport: { width: 1080, height: 1920 } })).newPage();
  page.on('pageerror', (e) => console.log(`[${id}] pageerror`, e.message));
  await page.goto(url + (url.includes('?') ? '&' : '?') + 'manual');
  await page.waitForFunction(() => window.__game, null, { timeout: 240000, polling: 1000 });
  await page.evaluate(() => document.querySelector('#enter').click());
  await page.waitForTimeout(200);
  await page.evaluate(() => document.querySelector('#ride').click());
  await page.addScriptTag({ path: join(here, 'director.js') });
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate((id) => window.TRAILER.prepare(id), id);
  const [n, off] = await page.evaluate((id) => [window.TRAILER.frames(id), window.TRAILER.offset(id)], id);
  const t0 = Date.now();
  for (let i = 0; i < n; i++) {
    const shoot = i % stride === 0;
    await page.evaluate((r) => window.TRAILER.frame(r), shoot);
    if (shoot) await page.screenshot({ path: join(out, `${String(off + i).padStart(5, '0')}.jpg`), type: 'jpeg', quality: 93 });
  }
  console.log(`[${id}] ${n} quadros em ${((Date.now() - t0) / 1000).toFixed(0)} s`);
  await page.close();
}
await browser.close();
