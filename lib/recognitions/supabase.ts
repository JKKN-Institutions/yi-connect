import "server-only";

import { createClient } from "@supabase/supabase-js";

/**
 * Service client pinned to the yi_connect schema, where the
 * recognition_* tables live. Those tables have RLS ENABLED and ZERO
 * policies, so only this client can read them. NEVER call it without first
 * passing a gate in ./auth.ts — the gate is the security boundary.
 *
 * Untyped on purpose: the generated Database type does not yet include the
 * recognition_* tables. Row shapes live in ./types.ts.
 */
export function rxService() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      db: { schema: "yi_connect" },
      auth: { persistSession: false, autoRefreshToken: false },
    }
  );
}
