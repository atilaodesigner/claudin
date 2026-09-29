/**
 * GINGA ARENA edge server (Cloudflare Worker + Durable Objects).
 *
 *   POST /api/new            → reserves a free room code, returns { code }
 *   GET  /api/room/:code     → WebSocket into that room (?name&pv&sv, or ?token to reconnect)
 *   GET  /api/health         → { ok }
 *
 * Every rule lives in RoomCore (packages/shared); GameRoom only moves messages.
 */

import rapierWasm from '../generated/rapier.wasm';
import { CODE_ALPHABET, CODE_LENGTH, randomCode } from '@ginga/shared';

// Must be set before any Rapier init (see scripts/prepare-rapier.mjs).
(globalThis as unknown as { __GINGA_RAPIER_WASM: WebAssembly.Module }).__GINGA_RAPIER_WASM = rapierWasm;

export { GameRoom } from './GameRoom';

export interface Env {
  ROOMS: DurableObjectNamespace;
}

// The site calls /api on its own origin; CORS only matters for local dev and tools.
const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'GET, POST, OPTIONS' };
const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store', ...CORS } });

const CODE_RE = new RegExp(`^[${CODE_ALPHABET}]{${CODE_LENGTH}}$`);

function roomStub(env: Env, code: string): DurableObjectStub {
  // rooms live close to the players: South America
  return env.ROOMS.get(env.ROOMS.idFromName(code), { locationHint: 'sam' });
}

const rand = (): number => crypto.getRandomValues(new Uint32Array(1))[0]! / 2 ** 32;

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    const path = url.pathname.replace(/\/+$/, '');
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
    if (path === '/api/health') return json({ ok: true });
    if (path === '/api/new' && req.method === 'POST') {
      for (let i = 0; i < 12; i++) {
        const code = randomCode(rand);
        const r = await roomStub(env, code).fetch(`https://room/create?code=${code}`, { method: 'POST' });
        if (r.ok) return json({ code });
      }
      return json({ error: 'no free code' }, 503);
    }
    const m = path.match(/^\/api\/room\/([A-Za-z0-9]+)$/);
    if (m) {
      const code = m[1]!.toUpperCase();
      if (!CODE_RE.test(code)) return json({ error: 'bad code' }, 404);
      return roomStub(env, code).fetch(req);
    }
    return json({ error: 'not found' }, 404);
  },
} satisfies ExportedHandler<Env>;
