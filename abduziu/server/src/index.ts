import { routeArena, type RoomNamespace } from './router';

export { ArenaRoom } from './room';
export { Hub } from './hub';

interface Env {
  ROOMS: RoomNamespace;
  HUB: RoomNamespace;
}

/** Friends hub: one global object. */
export function routeHub(req: Request, ns: RoomNamespace): Promise<Response> {
  return ns.get(ns.idFromName('hub')).fetch(req);
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    if (new URL(req.url).pathname.endsWith('/hub')) return routeHub(req, env.HUB);
    return routeArena(req, env.ROOMS);
  },
};
