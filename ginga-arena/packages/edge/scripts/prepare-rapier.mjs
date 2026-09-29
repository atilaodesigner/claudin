// Workers can't compile WebAssembly from bytes at runtime, and the Rapier "compat" build
// ships its WASM as an inline base64 string. This extracts the exact same binary to
// generated/rapier.wasm (imported by the Worker as a precompiled WebAssembly.Module) and
// writes generated/rapier.mjs, identical except that init() receives that module.
// Same bytes → same engine → the edge server stays bit-for-bit with clients and tests.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
// resolve the package main (its exports don't expose package.json) and go up from dist/
const pkgDir = join(dirname(require.resolve('@dimforge/rapier3d-deterministic-compat', { paths: [join(here, '../../shared')] })), '..');
const src = readFileSync(join(pkgDir, 'dist/rapier.mjs'), 'utf8');
const re = /(\w+)\(\{module_or_path:(\w+)\.toByteArray\("([A-Za-z0-9+/=]+)"\)\.buffer\}\)/;
const m = src.match(re);
if (!m) throw new Error('rapier init pattern not found: check the Rapier version');
const out = join(here, '../generated');
mkdirSync(out, { recursive: true });
writeFileSync(join(out, 'rapier.wasm'), Buffer.from(m[3], 'base64'));
writeFileSync(join(out, 'rapier.mjs'), src.replace(re, `${m[1]}({module_or_path:globalThis.__GINGA_RAPIER_WASM})`));
writeFileSync(join(out, 'rapier.d.ts'), `export * from '@dimforge/rapier3d-deterministic-compat';\nexport { default } from '@dimforge/rapier3d-deterministic-compat';\n`);
console.log(`[edge] rapier.wasm ${(Buffer.from(m[3], 'base64').length / 1024).toFixed(0)} KB extracted`);
