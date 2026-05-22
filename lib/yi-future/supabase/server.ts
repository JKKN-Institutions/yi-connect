import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/types/yi-future/database";

/**
 * YiFuture server Supabase client.
 *
 * Phase D port (2026-05-22): routes to the `future` schema in the shared
 * Supabase project. See lib/yi-future/supabase/client.ts for rationale.
 * Yi-connect's own server client (lib/supabase/server.ts) routes to
 * `yi_connect` — keep them strictly separate.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      db: { schema: "future" },
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Server Component - ignore
          }
        },
      },
    }
  );
}

export async function createServiceClient() {
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      db: { schema: "future" },
      cookies: {
        getAll() {
          return [];
        },
        setAll() {},
      },
    }
  );
}
