import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/types/yiq/database";

/**
 * YIQ server Supabase client — routes to the `yiq` schema in the shared
 * Supabase project. The second generic pins the schema literal, matching the
 * Yi-Future pattern (lib/yi-future/supabase/server.ts).
 *
 * IMPORTANT: `yiq` tables carry RLS ENABLED with ZERO policies, so the
 * anon/authenticated clients see nothing by design. Every read and write in
 * this vertical goes through createServiceClient() BEHIND an explicit auth
 * gate (lib/yiq/auth/*). Never call createServiceClient() without one.
 */
type CookieToSet = {
  name: string;
  value: string;
  options: Parameters<Awaited<ReturnType<typeof cookies>>["set"]>[2];
};

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database, "yiq">(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      db: { schema: "yiq" },
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: CookieToSet[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Server Component — cookie writes are a no-op here.
          }
        },
      },
    }
  );
}

export async function createServiceClient() {
  return createServerClient<Database, "yiq">(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      db: { schema: "yiq" },
      cookies: {
        getAll() {
          return [];
        },
        setAll() {},
      },
    }
  );
}
