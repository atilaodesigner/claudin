// Renders the showreel soundtrack: node music.mjs <music|sfx> out.wav
import { chromium } from 'playwright-core';
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const [mode = 'music', outFile = 'out/music.wav'] = process.argv.slice(2);
const browser = await chromium.launch({ executablePath: process.env.CHROME || '/opt/pw-browsers/chromium' });
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('pageerror', e.message));
await page.setContent('<html><body></body></html>');
await page.addScriptTag({ path: join(here, process.env.MUSIC || 'music.js') });
const b64 = await page.evaluate(async (m) => {
  const buf = new Uint8Array(await window.renderShowreelAudio(m));
  let s = '';
  for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  return btoa(s);
}, mode);
writeFileSync(outFile, Buffer.from(b64, 'base64'));
await browser.close();
console.log(`[music] ${mode} -> ${outFile}`);
