/**
 * YIP Server Supabase Client (Phase 2 absorption — 2026-05-25)
 *
 * Schema-pinned to "yip". All YIP tables live in `yip.*` after Agent A's
 * migration 031. For cross-schema reads (yi.chapters, yi.brand_rules,
 * yi_directory.people), use the per-call `.schema("yi")...` override.
 */
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/types/yip/database";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database, "yip">(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
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
      db: { schema: "yip" },
    }
  );
}

export async function createServiceClient() {
  return createServerClient<Database, "yip">(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: {
        getAll() {
          return [];
        },
        setAll() {},
      },
      db: { schema: "yip" },
    }
  );
}
