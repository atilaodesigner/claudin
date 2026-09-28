import { PROTOCOL_VERSION, SIM_VERSION } from '@ginga/shared';
import { startServer } from './app';

const port = Number(process.env.PORT ?? 2567);
const server = await startServer(port);
console.log(`[ginga] servidor de partidas em ws://localhost:${port} (protocolo ${PROTOCOL_VERSION}, sim ${SIM_VERSION})`);

const stop = async (): Promise<void> => {
  await server.gracefullyShutdown(false);
  process.exit(0);
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
