// Renders the reel score (audio.js) with the abduction events captured with the frames.
//   node audio.mjs <framesDir> out.wav
import { chromium } from 'playwright-core';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const [framesDir, outFile = 'reel.wav'] = process.argv.slice(2);
const events = readdirSync(framesDir)
  .filter((f) => f.startsWith('events-') && f.endsWith('.json'))
  .flatMap((f) => JSON.parse(readFileSync(join(framesDir, f), 'utf8')));
const browser = await chromium.launch({ executablePath: process.env.CHROME || '/opt/pw-browsers/chromium' });
const page = await browser.newPage();
await page.setContent('<html><body></body></html>');
await page.addScriptTag({ path: join(here, 'audio.js') });
const b64 = await page.evaluate(async (ev) => {
  const buf = new Uint8Array(await window.renderReelAudio(ev));
  let s = '';
  for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  return btoa(s);
}, events);
writeFileSync(outFile, Buffer.from(b64, 'base64'));
await browser.close();
console.log(`ok · ${events.filter((e) => e.k === 'pop').length} pops`);
