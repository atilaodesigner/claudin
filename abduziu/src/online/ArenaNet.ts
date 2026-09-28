/** WebSocket link to an arena room (see server/src/room.ts for the protocol). */

export interface Welcome {
  id: string;
  city: string;
  seed: number;
  tile: number;
  /** Public room name (friends join it with ?room=). */
  room?: string;
}

/** [id, name, color, x, z, vx, vz, matter, bot, skin, beam] */
export type ShipRow = [string, string, number, number, number, number, number, number, number, string?, string?];

export interface Snapshot {
  s: ShipRow[];
  lb: Array<{ id: string; n: string; m: number; bot: boolean }>;
  /** Players connected to the room. */
  n: number;
  /** 0..1: how close a bigger ship is to swallowing you. */
  h: number;
  hb: string | null;
}

export function arenaUrl(): string {
  const env = (import.meta.env.VITE_ARENA_URL as string | undefined) ?? '';
  if (env) return env;
  const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${proto}//${location.host}/api/arena`;
}

export class ArenaNet {
  private ws: WebSocket | null = null;
  welcome: Welcome | null = null;
  onSnap: ((s: Snapshot) => void) | null = null;
  onAte: ((victim: string, victimId: string, gain: number) => void) | null = null;
  onEaten: ((by: string, byId: string) => void) | null = null;
  onClose: (() => void) | null = null;
  private closedByUs = false;
  private pinger: ReturnType<typeof setInterval> | null = null;

  /**
   * Opens the socket and waits for the room's welcome. `room` joins a specific room
   * (friends playing together); otherwise the server picks the first with free seats.
   */
  connect(name: string, color: number, skin = 'classico', beam = 'verde', room: string | null = null, timeoutMs = 7000): Promise<Welcome> {
    return new Promise((resolve, reject) => {
      let settled = false;
      const fail = (why: string) => {
        if (settled) return;
        settled = true;
        this.close();
        reject(new Error(why));
      };
      const timer = setTimeout(() => fail('timeout'), timeoutMs);
      let ws: WebSocket;
      try {
        ws = new WebSocket(room ? `${arenaUrl()}?room=${encodeURIComponent(room)}` : arenaUrl());
      } catch {
        clearTimeout(timer);
        fail('unreachable');
        return;
      }
      this.ws = ws;
      ws.onopen = () => {
        ws.send(JSON.stringify({ t: 'hello', name, color, skin, beam }));
        // keep-alive while the city is still being built / the intro plays
        this.pinger = setInterval(() => {
          if (this.open) this.ws!.send('{"t":"ping"}');
        }, 2000);
      };
      ws.onerror = () => fail('unreachable');
      ws.onclose = () => {
        clearTimeout(timer);
        this.stopPing();
        if (!settled) fail('closed');
        else if (!this.closedByUs) this.onClose?.();
      };
      ws.onmessage = (ev) => {
        let m: Record<string, unknown>;
        try {
          m = JSON.parse(String(ev.data));
        } catch {
          return;
        }
        if (m.t === 'welcome') {
          clearTimeout(timer);
          settled = true;
          this.welcome = m as unknown as Welcome;
          resolve(this.welcome);
        } else if (m.t === 'snap') this.onSnap?.(m as unknown as Snapshot);
        else if (m.t === 'ate') this.onAte?.(String(m.victim), String(m.victimId), Number(m.gain) || 0);
        else if (m.t === 'eaten') this.onEaten?.(String(m.by), String(m.byId));
      };
    });
  }

  get open(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  sendState(x: number, z: number, vx: number, vz: number, m: number, beam: boolean): void {
    if (!this.open) return;
    this.ws!.send(JSON.stringify({ t: 'st', x: +x.toFixed(2), z: +z.toFixed(2), vx: +vx.toFixed(2), vz: +vz.toFixed(2), m: Math.round(m), b: beam ? 1 : 0 }));
  }

  private stopPing(): void {
    if (this.pinger) clearInterval(this.pinger);
    this.pinger = null;
  }

  close(): void {
    this.closedByUs = true;
    this.stopPing();
    try {
      if (this.open) this.ws!.send(JSON.stringify({ t: 'bye' }));
      this.ws?.close();
    } catch {
      /* ignore */
    }
    this.ws = null;
  }
}
