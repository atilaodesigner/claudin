import type { RoomNamespace } from '../../server/src/router';

/** abduziu.fun/api/hub → friends, invites and parties (WebSocket). */
export const onRequest = async ({ request, env }: { request: Request; env: { HUB?: RoomNamespace } }): Promise<Response> => {
  if (!env.HUB) return new Response('hub offline', { status: 503 });
  return env.HUB.get(env.HUB.idFromName('hub')).fetch(request);
};
