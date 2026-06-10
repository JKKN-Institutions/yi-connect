import { createServerClient } from "@supabase/ssr";
import type { Database } from "@/types/yuva/database";

/**
 * Yi Youth Academy SERVICE-ROLE client (bypasses RLS).
 *
 * ⚠️ Use ONLY inside gate-first server actions / RSCs that have already
 * verified authorization (getYuvaAccess / requireYuvaNational /
 * getStudentSession). A service-client call without a preceding gate is an
 * open write — the gate-first convention is the entire authorization layer
 * for writes (no INSERT/UPDATE/DELETE RLS policies exist in `yuva`).
 */
export async function createServiceClient() {
  return createServerClient<Database, "yuva">(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      db: { schema: "yuva" },
      cookies: {
        getAll() {
          return [];
        },
        setAll() {},
      },
    }
  );
}
