import { routeArena, type RoomNamespace } from '../../server/src/router';

/** abduziu.fun/api/arena → arena rooms (WebSocket). 503 when the arena server isn't deployed. */
export const onRequest = async ({ request, env }: { request: Request; env: { ROOMS?: RoomNamespace } }): Promise<Response> => {
  if (!env.ROOMS) return new Response('arena offline', { status: 503 });
  return routeArena(request, env.ROOMS);
};
