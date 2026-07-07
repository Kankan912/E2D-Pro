import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';
import { getActiveAssociationId } from '@/lib/active-association';

/**
 * Supabase client — credentials loaded from environment variables.
 *
 * SECURITY (Audit Fix #1 / P0):
 * The Supabase URL and publishable (anon) key are NO LONGER hard-coded.
 * They are read from `import.meta.env` (Vite) so the same build can run
 * against dev / staging / prod Supabase projects without code changes,
 * and so secrets can be rotated without a redeploy of the source.
 *
 * The publishable key is safe to expose in the browser (RLS-protected),
 * but it must NOT be the `service_role` key — that one lives only in
 * Edge Functions / server code.
 */
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
  throw new Error(
    '[supabase/client] Missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY. ' +
      'Copy .env.example to .env.local and fill the values.'
  );
}

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  },
  global: {
    fetch: (input: RequestInfo | URL, init?: RequestInit) => {
      const headers = new Headers(init?.headers || {});
      // Multi-tenant routing hint. NOTE: since Audit Fix #8 the server
      // re-validates this header against the authenticated user's
      // `user_roles.association_id` — it can no longer be used to cross
      // tenant boundaries. Kept only as a routing/perf hint.
      const assocId = getActiveAssociationId();
      if (assocId) {
        headers.set('x-association-id', assocId);
      }
      return fetch(input, { ...init, headers });
    },
  },
});
