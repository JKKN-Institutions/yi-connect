/**
 * Super-admin gate — refactored 2026-05-28 to read from yi_directory.
 *
 * Per the 2026-05-27 CLAUDE.md rule: yi_directory is the canonical mother
 * source for identity + role assignments across all Yi apps. We no longer
 * query yip.organizers for authorization decisions.
 *
 * Super-admin predicate:
 *   (app='yip' AND role IN ('national','super_admin') AND is_active=true)
 *   OR isPlatformSuperAdmin() (any active role='super_admin' on any app)
 *
 * Historical note (Phase 19 / E, commit 6efc129): the previous implementation
 * read `yip.organizers.role='national'`. The shape of the returned gate is
 * preserved so no caller needs to change (13 call sites in app/yip/actions/*
 * and 2 in app/yip/dashboard/*).
 *
 * Usage:
 *
 *     const gate = await requireSuperAdmin();
 *     if (!gate.ok) return { success: false, error: gate.error };
 */
import { createServiceClient } from "@/lib/yip/supabase/server";
import {
  getCurrentPersonRoles,
  isPlatformSuperAdmin,
} from "@/lib/yi/auth/yi-directory-roles";

export type SuperAdminGate =
  | { ok: true; userId: string; organizerId: string }
  | { ok: false; error: string };

const DENY_MESSAGE = "Only super-admin (national role) can perform deletions.";
const UNAUTH_MESSAGE = "Not authenticated";

// Roles that count as YIP super-admin in yi_directory.role_assignments.
const YIP_SUPER_ROLES = new Set(["national", "super_admin"]);

/**
 * Structured audit line for the super-admin gate. Emitted on EVERY verdict
 * (allow + both deny paths) so a 403 is never silent — Vercel logs will show
 * exactly which user hit the gate, what roles they held, and which path (if
 * any) matched.
 *
 * Why this exists: on 2026-05-28 a 403 on /admin/directory was misattributed
 * to director@ when the session was actually a regional_admin (punitknsinghal@).
 * The gate was correct; the diagnosis was wrong because the denial was silent.
 * Grep Vercel logs for `super_admin_gate` to see verdicts.
 */
function logGateVerdict(payload: Record<string, unknown>): void {
  // Single-line JSON so Vercel log search can filter on the `tag` field.
  console.log(JSON.stringify({ tag: "super_admin_gate", ...payload }));
}

export async function requireSuperAdmin(): Promise<SuperAdminGate> {
  const me = await getCurrentPersonRoles();
  if (!me) {
    logGateVerdict({ verdict: "deny", reason: "unauthenticated_or_no_person_row" });
    return { ok: false, error: UNAUTH_MESSAGE };
  }

  // Compact summary of the user's active assignments — the single most useful
  // field when triaging an unexpected 403 ("what did they actually have?").
  const activeRoles = me.assignments
    .filter((a) => a.is_active)
    .map((a) => `${a.app}:${a.role}`);

  // Path 1: explicit YIP super-admin assignment.
  const yipSuper = me.assignments.some(
    (a) => a.is_active && a.app === "yip" && YIP_SUPER_ROLES.has(a.role)
  );

  // Path 2: cross-vertical platform super-admin.
  const platformSuper = yipSuper ? true : await isPlatformSuperAdmin();

  if (!yipSuper && !platformSuper) {
    logGateVerdict({
      verdict: "deny",
      reason: "no_super_role",
      user_id: me.user_id,
      email: me.email,
      yip_super: false,
      platform_super: false,
      active_roles: activeRoles,
    });
    return { ok: false, error: DENY_MESSAGE };
  }

  logGateVerdict({
    verdict: "allow",
    user_id: me.user_id,
    email: me.email,
    matched_path: yipSuper ? "yip_super" : "platform_super",
    active_roles: activeRoles,
  });

  // Backward-compat: callers expect a string `organizerId` field. The field
  // is currently unread (no caller dereferences gate.organizerId), but the
  // type must remain stable. Look up the legacy yip.organizers row if it
  // exists; otherwise return empty string. Deprecate this field in a future
  // pass once we're sure nothing depends on it.
  const svc = await createServiceClient();
  const { data: organizer } = await svc
    .from("organizers")
    .select("id")
    .eq("user_id", me.user_id)
    .maybeSingle();

  return {
    ok: true,
    userId: me.user_id,
    organizerId: organizer?.id ?? "",
  };
}

/**
 * Client-safe role probe — used by UI to hide/disable delete buttons for
 * non-super-admins. Server gate is the security boundary; this is UX only.
 *
 * Returns `false` for any unauthenticated / non-super user.
 */
export async function isCurrentUserSuperAdmin(): Promise<boolean> {
  const gate = await requireSuperAdmin();
  return gate.ok;
}
