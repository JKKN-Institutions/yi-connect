import { createBrowserClient } from "@supabase/ssr";

/**
 * YiFuture browser Supabase client.
 *
 * Phase D port (2026-05-22): YiFuture lives in the shared Supabase project
 * (bkmpbcoxbjyafieabxao) under the `future` schema. Setting db.schema makes
 * all .from('X') calls auto-route to future.X without touching any of the
 * YiFuture call sites that were ported in from /Users/omm/PROJECTS/YiFuture.
 *
 * Yi-connect's own supabase client (lib/supabase/client.ts) routes to
 * `yi_connect` — do NOT use this client from yi-connect-native code, and
 * do NOT use that one from yi-future code.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      db: { schema: "future" },
    }
  );
}
