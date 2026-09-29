/**
 * ginga-arena.pages.dev/api/* → the match server Worker (service binding), so the site and
 * its WebSocket rooms share one origin. 503 while the server isn't deployed.
 */

interface Env {
  SERVER?: { fetch(req: Request): Promise<Response> };
}

export const onRequest = async ({ request, env }: { request: Request; env: Env }): Promise<Response> => {
  if (!env.SERVER) return new Response('match server offline', { status: 503 });
  return env.SERVER.fetch(request);
};
