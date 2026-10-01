// Transparent renders of game objects + Tripo characters from abduziu/tools/studio (vite dev on :5180).
//   node studio.mjs [objects|chars|all]   -> studio/obj/<id>.png, studio/<char>/<kind>/<nnn>.png
import { chromium } from 'playwright-core';
import { mkdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';

const BASE = process.env.STUDIO || 'http://127.0.0.1:5180/tools/studio/index.html';
const mode = process.argv[2] ?? 'all';
const OUT = 'studio';

// asset wall + Brazilian memes (object ids of the game catalogue)
const OBJECTS = [
  'cadeira', 'botijao', 'caixa_dagua', 'carrinho_mercado', 'churrasqueira', 'cone', 'carrinho_rolima', 'van', 'brasilia_amarela',
  'moto', 'mototaxi', 'poste', 'lixeira', 'onibus', 'uno_escada', 'opala', 'carro_pamonha', 'orelhao', 'placa_rua', 'semaforo',
  'arvore', 'ipe', 'geladeira', 'sofa', 'isopor', 'guarda_sol', 'carrinho_pipoca', 'carrinho_churros', 'caramelo_dourado',
  'caminhao_gas', 'banca_pastel', 'taxi', 'hatch', 'helicoptero', 'vaca', 'galinha', 'cachorro', 'cadeira_praia', 'moto_entrega', 'quadradinho',
];
const CHARS = {
  huehue: { url: '/tools/crowd/source/huehue.glb', extra: '/tools/crowd/source/manoel_gomes.glb' },
  cabeca_guidao: { url: '/tools/crowd/source/cabeca_guidao.glb', extra: '/tools/crowd/source/huehue.glb' },
  manoel_gomes: { url: '/tools/crowd/source/manoel_gomes.glb', extra: '/tools/crowd/source/huehue.glb' },
};

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const page = await browser.newPage({ viewport: { width: 400, height: 400 } });
page.setDefaultTimeout(0);
page.on('pageerror', (e) => console.log('pageerror', e.message));
page.on('console', (m) => m.type() === 'error' && console.log('console', m.text()));
await page.goto(BASE);
await page.waitForFunction(() => window.studioReady === true, null, { timeout: 180000 });

const save = async (file, dataUrl) => writeFile(file, Buffer.from(dataUrl.split(',')[1], 'base64'));

if (mode === 'objects' || mode === 'all') {
  await mkdir(`${OUT}/obj`, { recursive: true });
  for (const [i, id] of OBJECTS.entries()) {
    const file = `${OUT}/obj/${id}.png`;
    if (existsSync(file)) continue;
    try {
      const png = await page.evaluate(([id, yaw]) => window.studio.object(id, { size: 720, yaw, pitch: 0.32, fill: 1.0 }), [id, 0.5 + (i % 3) * 0.25]);
      await save(file, png);
      console.log('obj', id);
    } catch (e) {
      console.log('obj FAIL', id, e.message.split('\n')[0]);
    }
  }
}

async function seq(char, kind, n, opts) {
  const dir = `${OUT}/${char}/${kind}`;
  await mkdir(dir, { recursive: true });
  const c = CHARS[char];
  for (let i = 0; i < n; i++) {
    const file = `${dir}/${String(i).padStart(3, '0')}.png`;
    if (existsSync(file)) continue;
    const o = typeof opts === 'function' ? opts(i / n, i) : opts;
    const png = await page.evaluate(([url, o]) => window.studio.character(url, o), [c.url, { extra: c.extra, ...o }]);
    await save(file, png);
  }
  console.log(char, kind, n);
}

if (mode === 'chars' || mode === 'all') {
  const TAU = Math.PI * 2;
  for (const char of Object.keys(CHARS)) {
    // turntable in the rest pose (multiview / "modelo 3D")
    await seq(char, 'turn', 48, (k) => ({ yaw: k * TAU, pitch: 0.08, size: [800, 800], fill: 1.02 }));
    // run cycle in place, three-quarter view
    await seq(char, 'run', 24, (k) => ({ clip: 'run', t: k * 0.8, yaw: 0.95, pitch: 0.1, size: [640, 960], fill: 1.12 }));
    // flailing in the beam
    await seq(char, 'freaky', 24, (k) => ({ clip: 'freaky', t: k * 1.6, yaw: 0.4, pitch: -0.25, size: [640, 960], fill: 1.25 }));
  }
  // the rig as graphic: skeleton over a ghosted body, turning, then a run pose with the rig
  await seq('huehue', 'rig', 48, (k) => ({ rig: 1, ghost: 0.7, yaw: 0.6 + k * Math.PI, pitch: 0.06, size: [800, 800], fill: 1.02 }));
  await seq('huehue', 'rigrun', 24, (k) => ({ clip: 'run', t: k * 0.8, rig: 1, ghost: 0.62, yaw: 1.1, pitch: 0.08, size: [640, 960], fill: 1.12 }));
  await seq('manoel_gomes', 'rig', 24, (k) => ({ rig: 1, ghost: 0.7, yaw: -0.5 + k * 1.2, pitch: 0.06, size: [800, 800], fill: 1.02 }));
}
await browser.close();
