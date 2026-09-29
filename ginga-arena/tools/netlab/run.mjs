// Latency lab runner: two real browsers (Playwright/Chromium), each driven by the bot
// through the SAME online input path as a person (?autobot), connected through proxy.mjs.
// Prints rejected contacts, corrections and whether both clients agree on the score.
//
// Needs: the server running (npm run start:server), the client built and served
// (npm run build && npx vite preview --port 4173 in packages/client), Playwright.
//   node run.mjs --proxy 2600 --seconds 90 --label "100ms"
//   node run.mjs --backend edge --server-url http://127.0.0.1:8787   (Cloudflare Worker, local or deployed)
import { chromium } from 'playwright';

const arg = (name, def) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : def;
};
const PROXY = arg('proxy', '2600');
const SECONDS = Number(arg('seconds', '90'));
const LABEL = arg('label', `proxy ${PROXY}`);
const CLIENT = arg('client', 'http://localhost:4173');
const BACKEND = arg('backend', 'colyseus');
const server = arg('server-url', BACKEND === 'edge' ? `http://localhost:${PROXY}` : `ws://localhost:${PROXY}`);

const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const errors = [];
async function page(name, extra = '') {
  const ctx = await browser.newContext({ viewport: { width: 480, height: 270 } });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errors.push(`${name}: ${e.message}`));
  await p.goto(`${CLIENT}/?intro=0&autobot=medium&backend=${BACKEND}&server=${encodeURIComponent(server)}${extra}`);
  await p.waitForTimeout(1200);
  await p.keyboard.press('Enter');
  await p.waitForSelector('.panel.home', { timeout: 20000 });
  await p.fill('#nick', name);
  return p;
}
const A = await page('LabA');
await A.click('[data-act="create"]');
await A.waitForSelector('.panel.room .code', { timeout: 20000 });
const code = (await A.textContent('.code')).trim();
const B = await page('LabB', `&sala=${code}`);
await B.click('[data-act="accept"]');
await B.waitForSelector('.panel.room .code', { timeout: 20000 });
await A.waitForFunction(() => document.querySelectorAll('.seat b').length === 2);
await A.click('[data-act="ready"]');
await B.click('[data-act="ready"]');
await A.waitForSelector('.hud:not([hidden])', { timeout: 20000 });
await A.waitForTimeout(SECONDS * 1000);

const read = (p) =>
  p.evaluate(() => {
    const s = window.__ginga;
    const pts = document.querySelector('.pts');
    return { ...s, ballCorrections: undefined, score: [pts?.querySelector('.sl')?.textContent, pts?.querySelector('.sr')?.textContent] };
  });
const [a, b] = [await read(A), await read(B)];
const same = a.score[0] === b.score[1] && a.score[1] === b.score[0];
const row = (n, s) =>
  `${n}: RTT ${s.rtt.toFixed(0)} ms, jitter ${s.jitter.toFixed(0)} ms, lead ${s.lead}, interp ${s.interp} | toques previstos ${s.predicted}, confirmados ${s.confirmed}, rejeitados ${s.rejected} (${s.predicted ? ((100 * s.rejected) / s.predicted).toFixed(1) : '0.0'}%), achados no replay ${s.lateFound} | correção da bola p95 ${(s.ballP95 * 100).toFixed(1)} cm | correções do avatar ${s.corrections} (grandes ${s.bigCorrections})`;
console.log(`\n== ${LABEL} ==`);
console.log(row('A', a));
console.log(row('B', b));
console.log(`placar A ${a.score.join('×')} | B ${b.score.join('×')} → ${same ? 'IGUAL' : 'DIFERENTE'}`);
try {
  const stats = await (await fetch(`http://localhost:${arg('server-http', '2567')}/stats`)).json();
  const room = stats.find((r) => r.code === code);
  if (room) console.log(`servidor: ${room.seats.map((x) => `vaga ${x.slot}: ${x.frames} frames, ${x.late} atrasados aplicados, ${x.lateDropped} descartados`).join(' | ')}`);
} catch {
  /* server without /stats */
}
console.log(`erros de página: ${errors.length ? errors.join('; ') : 'nenhum'}`);
await browser.close();
