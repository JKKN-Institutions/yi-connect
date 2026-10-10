import "server-only";

import { createClient } from "@supabase/supabase-js";

/**
 * Service client pinned to yi_connect, where the tp_* tables live. Those
 * tables have RLS ENABLED and ZERO policies, so only this client can read
 * them. Every caller must first pass a gate: a secret link token
 * (partner / delegate) or requireTpOrganiser() in ./auth.ts.
 */
export function tpService() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      db: { schema: "yi_connect" },
      auth: { persistSession: false, autoRefreshToken: false },
    }
  );
}
