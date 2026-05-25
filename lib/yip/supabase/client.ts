/**
 * YIP Browser Supabase Client (Phase 2 absorption — 2026-05-25)
 *
 * Schema-pinned to "yip". All YIP tables live in `yip.*` after Agent A's
 * migration 031. For cross-schema reads, use per-call `.schema("yi")...`.
 */
import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/types/yip/database";

export function createClient() {
  return createBrowserClient<Database, "yip">(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      db: { schema: "yip" },
    }
  );
}
