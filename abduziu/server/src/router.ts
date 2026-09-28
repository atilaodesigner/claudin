import { MAX_PLAYERS } from './logic';

/** Minimal shape of a Durable Object namespace binding (keeps this file type-light). */
export interface RoomNamespace {
  idFromName(name: string): unknown;
  get(id: unknown): { fetch(input: Request | string, init?: RequestInit): Promise<Response> };
}

const ROOMS = ['br-1', 'br-2', 'br-3', 'br-4', 'br-5'];

/** Sends the player to the first room with a free seat (rooms fill up one at a time). */
export async function routeArena(req: Request, ns: RoomNamespace): Promise<Response> {
  const url = new URL(req.url);
  if (url.searchParams.get('health') !== null) return new Response('ok');
  for (const name of ROOMS) {
    const stub = ns.get(ns.idFromName(name));
    try {
      const info = (await (await stub.fetch('https://room/count')).json()) as { players: number };
      if (info.players < MAX_PLAYERS) return stub.fetch(req);
    } catch {
      /* try the next room */
    }
  }
  return new Response('arena full', { status: 503 });
}
