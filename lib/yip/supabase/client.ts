/**
 * YIP Browser Supabase Client (Phase D port — 2026-05-22)
 *
 * NOTE: yi-connect's shared client (`@/lib/supabase/client`) hard-sets
 * `db: { schema: 'yi_connect' }`, but YIP's tables live in `public.*` in the
 * same Supabase project. To avoid silently routing YIP queries to the wrong
 * schema, this client constructs its own browser client WITHOUT the schema
 * override — defaulting to `public`.
 *
 * If/when YIP tables move into a dedicated schema, add `db: { schema: 'yip' }`
 * here and migrate the tables.
 */
import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
