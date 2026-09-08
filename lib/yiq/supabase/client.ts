import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/types/yiq/database";

/**
 * YIQ browser client. Pinned to the `yiq` schema. Note that yiq tables have
 * RLS on with no policies, so this client is deliberately near-powerless —
 * it exists for realtime channel subscriptions (live finals scoreboard),
 * not for data access. All data flows through server actions.
 */
export function createClient() {
  return createBrowserClient<Database, "yiq">(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { db: { schema: "yiq" } }
  );
}
