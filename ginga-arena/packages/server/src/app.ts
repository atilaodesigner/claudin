import { Server, WebSocketTransport } from 'colyseus';
import { ROOM_NAME, initPhysics } from '@ginga/shared';
import { MatchRoom } from './MatchRoom';

export async function startServer(port: number): Promise<Server> {
  await initPhysics();
  const server = new Server({
    transport: new WebSocketTransport(),
    gracefullyShutdown: false,
    express: (app) => {
      app.get('/health', (_req: unknown, res: { json(body: unknown): void }) => {
        res.json({ ok: true });
      });
    },
  });
  server.define(ROOM_NAME, MatchRoom);
  await server.listen(port);
  return server;
}
