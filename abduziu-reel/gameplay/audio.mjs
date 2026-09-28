// Renders one clip's sound (audio.js) from the events captured with its frames.
//   node audio.mjs <clip> <framesDir> <seconds> out.wav
import { chromium } from 'playwright-core';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const [clip, framesDir, seconds, outFile] = process.argv.slice(2);
const evFile = join(framesDir, `events-${clip}.json`);
const events = existsSync(evFile) ? JSON.parse(readFileSync(evFile, 'utf8')) : [];
const browser = await chromium.launch({ executablePath: process.env.CHROME || '/opt/pw-browsers/chromium' });
const page = await browser.newPage();
await page.setContent('<html><body></body></html>');
await page.addScriptTag({ path: join(here, 'audio.js') });
const b64 = await page.evaluate(
  async ([c, ev, len]) => {
    const buf = new Uint8Array(await window.renderGameplayAudio(c, ev, len));
    let s = '';
    for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode(...buf.subarray(i, i + 0x8000));
    return btoa(s);
  },
  [clip, events, Number(seconds)],
);
writeFileSync(outFile, Buffer.from(b64, 'base64'));
await browser.close();
const count = (k) => events.filter((e) => e.k === k).length;
console.log(`[${clip}] ${count('pop')} pops · ${count('level')} levels · ${count('boom')} booms · ${count('emp')} emp · ${count('swallow')} swallows`);
