/**
 * Colyseus host for a room: translates Colyseus clients and messages to RoomCore
 * (packages/shared/src/room.ts), where every rule lives. Used for local development and
 * for a persistent Node server; production on Cloudflare uses packages/edge instead.
 */

import { randomInt } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { type Client, Room, ServerError, matchMaker } from 'colyseus';
import { MATCH, RoomCore, TICK_HZ, checkJoin, initPhysics, randomCode, type Conn, type JoinOptions, type RoomStats } from '@ginga/shared';

export type { RoomStats };

async function freshCode(): Promise<string> {
  const rand = () => randomInt(2 ** 30) / 2 ** 30;
  for (let attempt = 0; attempt < 20; attempt++) {
    const code = randomCode(rand);
    if ((await matchMaker.query({ roomId: code })).length === 0) return code;
  }
  throw new Error('no free room code');
}

const conn = (client: Client): Conn => ({
  id: client.sessionId,
  send: (type, msg) => client.send(type, msg),
  close: (code, reason) => client.leave(code, reason),
});

export class MatchRoom extends Room {
  override maxClients = 2;
  private core!: RoomCore;

  override async onCreate(): Promise<void> {
    await initPhysics();
    this.roomId = await freshCode();
    this.core = new RoomCore(this.roomId, () => randomInt(2 ** 30) / 2 ** 30);
    this.core.onMatchLog = (log) => {
      const dir = process.env.GINGA_LOG_DIR;
      if (!dir) return;
      try {
        mkdirSync(dir, { recursive: true });
        writeFileSync(join(dir, `${log.code}-${log.startTick}.json`), JSON.stringify(log));
      } catch (e) {
        console.warn('[ginga] could not write match log', e);
      }
    };
    this.onMessage('*', (client, type, message) => this.core.message(client.sessionId, String(type), message));
    this.setFixedTimestep(() => this.core.tickOnce(), TICK_HZ);
    // No schema state: snapshots are messages. Must come after setFixedTimestep, otherwise
    // Colyseus starts a second clock ticker that starves the fixed-step accumulator (D-19).
    this.patchRate = null;
  }

  override onAuth(_client: Client, options: Partial<JoinOptions>): boolean {
    const bad = checkJoin(options);
    if (bad) throw new ServerError(bad.code, bad.reason);
    return true;
  }

  override onJoin(client: Client, options: Partial<JoinOptions>): void {
    const r = this.core.join(conn(client), options);
    if (typeof r !== 'number') throw new ServerError(r.code, r.reason);
  }

  override onDrop(client: Client): void {
    this.core.drop(client.sessionId);
    try {
      this.allowReconnection(client, MATCH.reconnectSeconds);
    } catch {
      // room is shutting down: nothing to reconnect to
    }
  }

  override onReconnect(client: Client): void {
    this.core.reconnect(client.sessionId, conn(client));
  }

  override onLeave(client: Client): void {
    this.core.leave(client.sessionId);
  }

  override onDispose(): void {
    this.core.dispose();
  }

  /** Test/diagnostics hook. */
  getStats(): RoomStats {
    return this.core.stats();
  }
}
