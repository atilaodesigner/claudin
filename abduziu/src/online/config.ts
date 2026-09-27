/**
 * Supabase project behind ABDUZIU online (login, weekly ranking, cloud save).
 * The publishable key is designed to ship inside the client: every table is
 * guarded by RLS and all writes that matter (RP, runs) go through checked RPCs.
 * Override per deploy with VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY,
 * or build with VITE_ONLINE=off for an offline-only copy.
 */
const env = import.meta.env;

export const ONLINE_CONFIG = {
  url: (env.VITE_SUPABASE_URL as string | undefined) || 'https://dhdtawdkmzcuoklzyqig.supabase.co',
  key: (env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined) || 'sb_publishable_zGVAkDxUy6Kx5mWLPVO7ww_H5bZVCC9',
  enabled: env.VITE_ONLINE !== 'off',
} as const;

/** localStorage key supabase-js uses for the session ("sb-<ref>-auth-token"). */
export function sessionStorageKey(): string {
  const ref = new URL(ONLINE_CONFIG.url).hostname.split('.')[0] ?? '';
  return `sb-${ref}-auth-token`;
}
