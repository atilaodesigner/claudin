import { MAX_PLAYERS } from './logic';

/** Minimal shape of a Durable Object namespace binding (keeps this file type-light). */
export interface RoomNamespace {
  idFromName(name: string): unknown;
  get(id: unknown): { fetch(input: Request | string, init?: RequestInit): Promise<Response> };
}

/** Public rooms, filled one at a time so players end up together. */
export const ROOMS = ['br-1', 'br-2', 'br-3', 'br-4', 'br-5', 'br-6', 'br-7', 'br-8', 'br-9', 'br-10'];

export function isRoomName(name: string | null): name is string {
  return !!name && ROOMS.includes(name);
}

export async function roomCount(ns: RoomNamespace, name: string): Promise<number> {
  const stub = ns.get(ns.idFromName(name));
  const info = (await (await stub.fetch('https://room/count', { headers: { 'X-Room': name } })).json()) as { players: number };
  return info.players;
}

/** First public room with room for `seats` more players. */
export async function pickRoom(ns: RoomNamespace, seats = 1): Promise<string | null> {
  for (const name of ROOMS) {
    try {
      if ((await roomCount(ns, name)) + seats <= MAX_PLAYERS) return name;
    } catch {
      /* try the next room */
    }
  }
  return null;
}

function forward(req: Request, ns: RoomNamespace, name: string): Promise<Response> {
  const r = new Request(req);
  r.headers.set('X-Room', name);
  return ns.get(ns.idFromName(name)).fetch(r);
}

/**
 * ?room=br-3 joins that room (friends playing together); otherwise the player goes to
 * the first public room with a free seat.
 */
export async function routeArena(req: Request, ns: RoomNamespace): Promise<Response> {
  const url = new URL(req.url);
  if (url.searchParams.get('health') !== null) return new Response('ok');
  const wanted = url.searchParams.get('room');
  if (isRoomName(wanted)) return forward(req, ns, wanted);
  const name = await pickRoom(ns);
  if (!name) return new Response('arena full', { status: 503 });
  return forward(req, ns, name);
}
