/** localStorage that never throws (private windows, blocked storage, previews). */
export function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(`ginga:${key}`);
    return raw === null ? fallback : { ...fallback, ...(JSON.parse(raw) as object) };
  } catch {
    return fallback;
  }
}

export function save(key: string, value: unknown): void {
  try {
    localStorage.setItem(`ginga:${key}`, JSON.stringify(value));
  } catch {
    /* ignore */
  }
}

export function session(key: string, value?: string | null): string | null {
  try {
    if (value === undefined) return sessionStorage.getItem(`ginga:${key}`);
    if (value === null) sessionStorage.removeItem(`ginga:${key}`);
    else sessionStorage.setItem(`ginga:${key}`, value);
  } catch {
    /* ignore */
  }
  return null;
}

export interface Settings {
  name: string;
  master: number;
  music: number;
  sfx: number;
  voice: number;
  reduceMotion: boolean;
  reduceFx: boolean;
  touchScale: number;
  touchOpacity: number;
  leftHanded: boolean;
}

export const settings: Settings = load<Settings>('settings', {
  name: '',
  master: 0.8,
  music: 0.6,
  sfx: 0.9,
  voice: 0.8,
  reduceMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
  reduceFx: false,
  touchScale: 1,
  touchOpacity: 0.55,
  leftHanded: false,
});

export function saveSettings(): void {
  save('settings', settings);
}
