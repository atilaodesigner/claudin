// Renders the trailer score (audio.js) to a WAV file with headless Chromium.
//   node audio.mjs out.wav
import { chromium } from 'playwright-core';
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const browser = await chromium.launch({ executablePath: process.env.CHROME || '/opt/pw-browsers/chromium' });
const page = await browser.newPage();
await page.setContent('<html><body></body></html>');
await page.addScriptTag({ path: join(here, 'audio.js') });
const b64 = await page.evaluate(async () => {
  const buf = new Uint8Array(await window.renderTrailerAudio());
  let s = '';
  for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  return btoa(s);
});
writeFileSync(process.argv[2] || 'trailer.wav', Buffer.from(b64, 'base64'));
await browser.close();
console.log('ok');
