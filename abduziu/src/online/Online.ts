import type { AuthChangeEvent, Session, SupabaseClient } from '@supabase/supabase-js';
import { ONLINE_CONFIG, sessionStorageKey } from './config';

export interface Profile {
  nickname: string;
  rp: number;
  peak_rp: number;
  games: number;
}

export interface LeaderboardRow {
  pos: number;
  user_id: string;
  nickname: string;
  score: number;
  rp: number;
  city: string;
  extracted: boolean;
}

export interface Standing {
  pos: number;
  score: number;
  players: number;
}

export interface RankedSubmission {
  week: string;
  city: string;
  seed: number;
  score: number;
  objects: number;
  duration: number;
  extracted: boolean;
}

export interface RankedResult {
  rp: number;
  delta: number;
  rpBefore: number;
  weekBest: number;
  weekPos: number | null;
  players: number | null;
}

export interface CloudSave {
  data: unknown;
  updatedAt: string;
}

export type OnlineStatus = 'disabled' | 'idle' | 'loading' | 'signed-out' | 'signed-in' | 'unreachable';

/** Friendly Portuguese messages for server-side error codes (raised by the SQL RPCs). */
const ERRORS: Record<string, string> = {
  nickname_taken: 'Esse apelido já tem dono. Tenta outro.',
  bad_nickname: 'Use 3 a 16 caracteres: letras, números, ponto, hífen ou _.',
  implausible_run: 'Essa partida não passou na checagem do servidor.',
  too_fast: 'Calma! Espera uns segundos antes de enviar outra partida.',
  wrong_week: 'A temporada virou. Jogue a ranqueada da semana nova.',
  no_profile: 'Seu perfil ainda não existe. Escolha um apelido.',
  not_authenticated: 'Você precisa entrar na sua conta.',
  'Email rate limit exceeded': 'Muitos e-mails em pouco tempo. Tenta de novo daqui a pouco.',
  'Token has expired or is invalid': 'Código inválido ou expirado.',
};

export function friendlyError(err: unknown): string {
  const msg = err instanceof Error ? err.message : typeof err === 'object' && err && 'message' in err ? String((err as { message: unknown }).message) : String(err);
  for (const [k, v] of Object.entries(ERRORS)) if (msg.includes(k)) return v;
  if (/fetch|network|Failed to|Load failed/i.test(msg)) return 'Sem conexão com o servidor agora.';
  return 'Algo deu errado. Tenta de novo.';
}

/**
 * ABDUZIU online: Supabase auth + ranking + cloud save.
 * The SDK is code-split and only loaded when there's a session to restore, an
 * auth redirect to finish, or the player opens something online. The game never
 * waits on it: every call fails soft and the offline save keeps working.
 */
export class Online {
  status: OnlineStatus = ONLINE_CONFIG.enabled ? 'idle' : 'disabled';
  email: string | null = null;
  userId: string | null = null;
  profile: Profile | null = null;
  private client: SupabaseClient | null = null;
  private loading: Promise<SupabaseClient | null> | null = null;
  private readonly listeners = new Set<() => void>();
  /** Called once per sign-in (not on token refresh) so the game can sync saves. */
  onSignedIn: (() => void) | null = null;

  get enabled(): boolean {
    return ONLINE_CONFIG.enabled;
  }

  get signedIn(): boolean {
    return this.status === 'signed-in' && this.userId !== null;
  }

  subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private emit(): void {
    for (const fn of this.listeners) fn();
  }

  /** True when there's something to pick up at boot (stored session or auth redirect). */
  static shouldBootEagerly(): boolean {
    if (!ONLINE_CONFIG.enabled) return false;
    const q = window.location.search + window.location.hash;
    if (/[?&#](code|access_token|error_description)=/.test(q)) return true;
    try {
      return window.localStorage.getItem(sessionStorageKey()) !== null;
    } catch {
      return false;
    }
  }

  /** Loads the SDK and restores the session. Safe to call many times. */
  init(): Promise<SupabaseClient | null> {
    if (!ONLINE_CONFIG.enabled) return Promise.resolve(null);
    if (this.loading) return this.loading;
    this.status = 'loading';
    this.emit();
    this.loading = (async () => {
      try {
        const { createClient } = await import('@supabase/supabase-js');
        const client = createClient(ONLINE_CONFIG.url, ONLINE_CONFIG.key, {
          auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'pkce' },
        });
        this.client = client;
        client.auth.onAuthStateChange((event, session) => {
          // never await inside this callback (supabase-js holds a lock while it runs)
          setTimeout(() => void this.onAuth(event, session), 0);
        });
        const { data } = await client.auth.getSession();
        await this.applySession(data.session, true);
        this.cleanAuthParams();
        return client;
      } catch (err) {
        console.warn('[online] indisponível', err);
        this.status = 'unreachable';
        this.loading = null;
        this.emit();
        return null;
      }
    })();
    return this.loading;
  }

  private async onAuth(event: AuthChangeEvent, session: Session | null): Promise<void> {
    if (event === 'SIGNED_OUT') {
      this.clearUser();
      this.status = 'signed-out';
      this.emit();
      return;
    }
    if (event === 'SIGNED_IN' || event === 'USER_UPDATED') {
      const fresh = session?.user.id !== this.userId;
      await this.applySession(session, fresh);
    }
  }

  private async applySession(session: Session | null, announce: boolean): Promise<void> {
    if (!session) {
      this.clearUser();
      this.status = 'signed-out';
      this.emit();
      return;
    }
    this.userId = session.user.id;
    this.email = session.user.email ?? null;
    this.status = 'signed-in';
    await this.refreshProfile();
    this.emit();
    if (announce) this.onSignedIn?.();
  }

  private clearUser(): void {
    this.userId = null;
    this.email = null;
    this.profile = null;
  }

  private cleanAuthParams(): void {
    const url = new URL(window.location.href);
    let dirty = false;
    for (const k of ['code', 'error', 'error_code', 'error_description']) {
      if (url.searchParams.has(k)) {
        url.searchParams.delete(k);
        dirty = true;
      }
    }
    if (/access_token|error_description/.test(url.hash)) {
      url.hash = '';
      dirty = true;
    }
    if (dirty) window.history.replaceState(null, '', url.toString());
  }

  private async need(): Promise<SupabaseClient> {
    const c = this.client ?? (await this.init());
    if (!c) throw new Error('Failed to reach server');
    return c;
  }

  /** One quiet retry on network hiccups (mobile data, captive portals). */
  private async retry<T>(fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    } catch (err) {
      if (!/fetch|network|Failed|Load failed|timeout/i.test(err instanceof Error ? err.message : String((err as { message?: unknown })?.message ?? err))) throw err;
      await new Promise((r) => setTimeout(r, 900));
      return fn();
    }
  }

  private redirectUrl(): string {
    return window.location.origin + window.location.pathname;
  }

  /** Provedores ligados no painel da Supabase (o botão do Google só aparece se estiver ativo). */
  providers: { google: boolean; email: boolean } | null = null;
  async loadProviders(): Promise<void> {
    if (this.providers || !ONLINE_CONFIG.enabled) return;
    try {
      const r = await fetch(`${ONLINE_CONFIG.url}/auth/v1/settings`, { headers: { apikey: ONLINE_CONFIG.key } });
      const j = (await r.json()) as { external?: Record<string, boolean> };
      this.providers = { google: !!j.external?.google, email: j.external?.email !== false };
    } catch {
      this.providers = { google: false, email: true };
    }
    this.emit();
  }

  // ───────────────────────────── auth

  async signInWithGoogle(): Promise<void> {
    const c = await this.need();
    const { error } = await c.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: this.redirectUrl() } });
    if (error) throw error;
  }

  /** Sends a magic link (and a 6-digit code, if the e-mail template includes {{ .Token }}). */
  async sendEmailLink(email: string): Promise<void> {
    const c = await this.need();
    const { error } = await c.auth.signInWithOtp({ email, options: { emailRedirectTo: this.redirectUrl(), shouldCreateUser: true } });
    if (error) throw error;
  }

  async verifyEmailCode(email: string, token: string): Promise<void> {
    const c = await this.need();
    const { error } = await c.auth.verifyOtp({ email, token, type: 'email' });
    if (error) throw error;
  }

  async signOut(): Promise<void> {
    const c = await this.need();
    await c.auth.signOut();
    this.clearUser();
    this.status = 'signed-out';
    this.emit();
  }

  /** LGPD: removes the account, profile, runs and cloud save. */
  async deleteAccount(): Promise<void> {
    const c = await this.need();
    const { error } = await c.rpc('delete_my_account');
    if (error) throw error;
    await c.auth.signOut({ scope: 'local' });
    this.clearUser();
    this.status = 'signed-out';
    this.emit();
  }

  // ───────────────────────────── profile

  async refreshProfile(): Promise<Profile | null> {
    if (!this.client || !this.userId) return null;
    const { data, error } = await this.client.from('profiles').select('nickname, rp, peak_rp, games').eq('id', this.userId).maybeSingle();
    if (error) {
      console.warn('[online] perfil', error.message);
      return this.profile;
    }
    this.profile = (data as Profile | null) ?? null;
    this.emit();
    return this.profile;
  }

  async setNickname(nickname: string): Promise<Profile> {
    const c = await this.need();
    const { data, error } = await c.rpc('set_nickname', { p_nickname: nickname.trim() });
    if (error) throw error;
    const row = data as Profile;
    this.profile = { nickname: row.nickname, rp: row.rp, peak_rp: row.peak_rp, games: row.games };
    this.emit();
    return this.profile;
  }

  /** Placeholder nicknames ("ET-1A2B3C") are created on sign-up until the player picks one. */
  get needsNickname(): boolean {
    return this.signedIn && (!this.profile || /^ET-[0-9A-F]{6}$/.test(this.profile.nickname));
  }

  // ───────────────────────────── ranking

  async submitRanked(run: RankedSubmission): Promise<RankedResult> {
    const c = await this.need();
    const { data, error } = await c.rpc('submit_ranked_run', {
      p_week: run.week,
      p_city: run.city,
      p_seed: Math.trunc(run.seed),
      p_score: Math.max(0, Math.round(run.score)),
      p_objects: Math.max(0, Math.round(run.objects)),
      p_duration: run.duration,
      p_extracted: run.extracted,
    });
    if (error) throw error;
    const row = (Array.isArray(data) ? data[0] : data) as { rp: number; delta: number; rp_before: number; week_best: number | null; week_pos: number | null; players: number | null };
    if (this.profile) {
      this.profile.rp = row.rp;
      this.profile.peak_rp = Math.max(this.profile.peak_rp, row.rp);
      this.profile.games++;
    }
    this.emit();
    return { rp: row.rp, delta: row.delta, rpBefore: row.rp_before, weekBest: row.week_best ?? run.score, weekPos: row.week_pos, players: row.players };
  }

  async leaderboard(week: string, limit = 50): Promise<LeaderboardRow[]> {
    const c = await this.need();
    return this.retry(async () => {
      const { data, error } = await c.rpc('get_weekly_leaderboard', { p_week: week, p_limit: limit });
      if (error) throw error;
      return (data as LeaderboardRow[]) ?? [];
    });
  }

  async myStanding(week: string): Promise<Standing | null> {
    if (!this.signedIn) return null;
    const c = await this.need();
    return this.retry(async () => {
      const { data, error } = await c.rpc('get_my_weekly_standing', { p_week: week });
      if (error) throw error;
      const rows = data as Standing[] | null;
      return rows && rows.length ? (rows[0] as Standing) : null;
    });
  }

  // ───────────────────────────── cloud save

  async pullSave(): Promise<CloudSave | null> {
    if (!this.signedIn) return null;
    const c = await this.need();
    const uid = this.userId as string;
    return this.retry(async () => {
      const { data, error } = await c.from('saves').select('data, updated_at').eq('user_id', uid).maybeSingle();
      if (error) throw error;
      return data ? { data: (data as { data: unknown }).data, updatedAt: (data as { updated_at: string }).updated_at } : null;
    });
  }

  async pushSave(json: string): Promise<void> {
    if (!this.signedIn) return;
    const c = await this.need();
    const row = { user_id: this.userId, data: JSON.parse(json) as unknown, updated_at: new Date().toISOString() };
    await this.retry(async () => {
      const { error } = await c.from('saves').upsert(row);
      if (error) throw error;
    });
  }
}
