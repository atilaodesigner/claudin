/**
 * Wire protocol between client and server. Any change here bumps PROTOCOL_VERSION.
 * Messages go through Colyseus (msgpack), so numbers keep full float64 precision.
 */

import { BALL, COURT, MATCH, PLAYER, TICK_HZ } from './params';
import type { MatchState, SimEvent } from './sim';

export const PROTOCOL_VERSION = 1;
/** Bump with any rule or tuning change: both sides must run the same simulation. */
export const SIM_VERSION = `1:${TICK_HZ}:${COURT.half}:${BALL.gravity}:${PLAYER.runSpeed}:${MATCH.target}`;

export const ROOM_NAME = 'match';
/** Snapshot every N ticks (60 / 3 = 20 Hz). */
export const SNAPSHOT_EVERY = 3;
/** Room codes skip look-alikes (O/0, I/1). */
export const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const CODE_LENGTH = 4;

export const INPUT_LIMITS = {
  /** Accepted tick window relative to the server tick. */
  pastTicks: 6,
  futureTicks: 30,
  /** Frames per message (the last few are repeated for redundancy). */
  maxFramesPerMessage: 8,
  /** Token bucket: sustained frames per second and burst. */
  ratePerSecond: 90,
  burst: 30,
  /** Violations per minute before the client is kicked. */
  maxViolations: 20,
} as const;

export interface JoinOptions {
  name: string;
  pv: number;
  sv: string;
}

/** client → server */
export interface InputMsg {
  f: Array<[seq: number, tick: number, buttons: number]>;
}
export interface PingMsg {
  c: number;
}

/** server → client */
export interface PongMsg {
  c: number;
  t: number;
}
export interface SnapMsg {
  /** Authoritative state at s.tick. */
  s: MatchState;
  /** Last input seq applied for the receiving client. */
  ack: number;
}
export interface EventsMsg {
  e: SimEvent[];
}
export interface LobbySeat {
  slot: number;
  name: string;
  ready: boolean;
  connected: boolean;
  rematch: boolean;
}
export interface LobbyMsg {
  code: string;
  you: number;
  seats: LobbySeat[];
  stage: 'lobby' | 'match' | 'result';
  /** Seconds left for a dropped player, by slot (-1 if connected). */
  away: number[];
}

export const ERR = {
  VERSION: 4001,
  FULL: 4002,
  NOT_FOUND: 4003,
  KICKED: 4004,
  NAME: 4005,
} as const;

export function sanitizeName(raw: unknown): string {
  const s = typeof raw === 'string' ? raw : '';
  const clean = s.normalize('NFC').replace(/[^\p{L}\p{N} _.-]/gu, '').trim().slice(0, 14);
  return clean || 'Jogador';
}
