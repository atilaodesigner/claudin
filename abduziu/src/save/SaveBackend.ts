/**
 * Storage abstraction. LocalStorage today; a remote backend (ranking, cloud save)
 * can implement the same interface later without touching game code.
 */
export interface SaveBackend {
  readonly name: string;
  load(key: string): string | null;
  save(key: string, value: string): boolean;
  remove(key: string): void;
}

export class LocalStorageBackend implements SaveBackend {
  readonly name = 'localStorage';

  static isAvailable(): boolean {
    try {
      const k = '__ovni_probe__';
      window.localStorage.setItem(k, '1');
      window.localStorage.removeItem(k);
      return true;
    } catch {
      return false;
    }
  }

  load(key: string): string | null {
    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  }

  save(key: string, value: string): boolean {
    try {
      window.localStorage.setItem(key, value);
      return true;
    } catch {
      return false;
    }
  }

  remove(key: string): void {
    try {
      window.localStorage.removeItem(key);
    } catch {
      /* ignore */
    }
  }
}

/** In-memory fallback (private browsing, tests). */
export class MemoryBackend implements SaveBackend {
  readonly name = 'memory';
  private readonly store = new Map<string, string>();

  load(key: string): string | null {
    return this.store.get(key) ?? null;
  }

  save(key: string, value: string): boolean {
    this.store.set(key, value);
    return true;
  }

  remove(key: string): void {
    this.store.delete(key);
  }
}
