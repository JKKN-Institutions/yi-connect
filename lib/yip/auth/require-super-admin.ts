/**
 * Super-admin gate (Phase 19 / E — 2026-05-27)
 *
 * Per the 2026-05-27 meeting decision: "Amendment and deletion rights should
 * not be with anyone — Deletion: super admin only."
 *
 * Super-admin definition: an organizer row whose `role = 'national'`. The
 * existing `yi_role` enum is `national | rm | chapter_em`; `national` sits at
 * the top of the hierarchy (national chair / co-chair) and is the natural
 * super-admin tier. No new column / migration is required.
 *
 * Usage in any destructive server action:
 *
 *     const gate = await requireSuperAdmin();
 *     if (!gate.ok) return { success: false, error: gate.error };
 *
 * The gate uses the cookie-scoped client to read `auth.getUser()` and the
 * service client to look up `organizers.role` (organizers RLS may not be
 * readable by the user themselves). It deliberately does NOT throw — callers
 * return the structured `{ success: false, error }` result that all server
 * actions already use.
 */
import { createClient, createServiceClient } from "@/lib/yip/supabase/server";

export type SuperAdminGate =
  | { ok: true; userId: string; organizerId: string }
  | { ok: false; error: string };

const DENY_MESSAGE = "Only super-admin (national role) can perform deletions.";
const UNAUTH_MESSAGE = "Not authenticated";

export async function requireSuperAdmin(): Promise<SuperAdminGate> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { ok: false, error: UNAUTH_MESSAGE };

  // Look up organizer row via service client (organizers RLS may block the
  // user from selecting their own row by user_id).
  const svc = await createServiceClient();
  const { data: organizer, error } = await svc
    .from("organizers")
    .select("id, role, is_active")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error || !organizer) return { ok: false, error: DENY_MESSAGE };
  if (organizer.is_active === false) return { ok: false, error: DENY_MESSAGE };
  if (organizer.role !== "national") return { ok: false, error: DENY_MESSAGE };

  return { ok: true, userId: user.id, organizerId: organizer.id };
}

/**
 * Client-safe role probe — used by UI to hide/disable delete buttons for
 * non-super-admins. Server gate is the security boundary; this is UX only.
 *
 * Returns `false` for any unauthenticated / non-national organizer.
 */
export async function isCurrentUserSuperAdmin(): Promise<boolean> {
  const gate = await requireSuperAdmin();
  return gate.ok;
}
