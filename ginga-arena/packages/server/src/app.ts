import { Server, WebSocketTransport, matchMaker } from 'colyseus';
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
      // diagnostics for the latency lab: per-room input stats (late / dropped frames)
      app.get('/stats', async (_req: unknown, res: { json(body: unknown): void }) => {
        const rooms = await matchMaker.query({});
        res.json(rooms.map((r) => (matchMaker.getLocalRoomById(r.roomId) as MatchRoom | undefined)?.getStats()).filter(Boolean));
      });
    },
  });
  server.define(ROOM_NAME, MatchRoom);
  await server.listen(port);
  return server;
}
