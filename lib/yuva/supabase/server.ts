import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/types/yuva/database";

/**
 * Yi Youth Academy server Supabase clients.
 *
 * Routes to the `yuva` schema in the shared Supabase project (clone of
 * lib/yi-future/supabase/server.ts — the donor keeps its service client in
 * this same file; splitting into service.ts here is a deliberate deviation
 * noted in docs/yi-youth-academy-spec.md). The second generic pins the
 * schema name to 'yuva', which also satisfies the `db.schema` literal-type
 * constraint. Keep strictly separate from lib/supabase/server.ts
 * (yi_connect), lib/yip/* (yip) and lib/yi-future/* (future).
 *
 * Authorization model: authenticated reads are row-gated by the role-aware
 * RLS in 20260610101000_yuva_academy_rls.sql; ALL writes go through the
 * service client inside gate-first server actions (no write RLS policies).
 */
type CookieToSet = {
  name: string;
  value: string;
  options: Parameters<Awaited<ReturnType<typeof cookies>>["set"]>[2];
};

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database, "yuva">(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      db: { schema: "yuva" },
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
            // Server Component - ignore
          }
        },
      },
    }
  );
}
