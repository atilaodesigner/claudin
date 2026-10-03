// node preview.mjs <kit> [start] [count] -> work/preview-<kit>-<start>.jpg (needs a static server on :8765 rooted at abduziu/)
import { chromium } from 'playwright-core';
import { readdirSync, mkdirSync } from 'node:fs';
const [kit, startArg = '0', countArg = '48', filter = ''] = process.argv.slice(2);
const all = readdirSync(`source/${kit}`).filter((f) => f.endsWith('.glb') && (!filter || new RegExp(filter).test(f))).sort();
const start = Number(startArg), files = all.slice(start, start + Number(countArg)).map((f) => `/tools/props/source/${kit}/${f}`);
mkdirSync('work', { recursive: true });
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport: { width: 1600, height: 400 } });
p.on('pageerror', (e) => console.log('pageerror', e.message));
await p.goto('http://localhost:8765/tools/props/preview.html#' + encodeURIComponent(JSON.stringify(files)));
await p.waitForFunction(() => document.title === 'ready', null, { timeout: 0 });
const out = `work/preview-${kit}${filter ? '-f' : ''}-${start}.jpg`;
await p.screenshot({ path: out, fullPage: true, type: 'jpeg', quality: 75 });
console.log(out, all.length);
await b.close();
