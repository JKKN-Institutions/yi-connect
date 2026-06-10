"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/types/yuva/database";

/**
 * Yi Youth Academy browser Supabase client (clone of
 * lib/yi-future/supabase/client.ts, pinned to the `yuva` schema).
 * Authenticated reads only — row visibility enforced by the role-aware RLS;
 * all writes go through server actions.
 */
export function createClient() {
  return createBrowserClient<Database, "yuva">(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      db: { schema: "yuva" },
    }
  );
}
