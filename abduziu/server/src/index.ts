import { routeArena, type RoomNamespace } from './router';

export { ArenaRoom } from './room';

interface Env {
  ROOMS: RoomNamespace;
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    return routeArena(req, env.ROOMS);
  },
};
