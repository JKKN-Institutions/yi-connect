import "server-only";

import {
  getCurrentPersonRoles,
  isPlatformSuperAdmin,
} from "@/lib/yi/auth/yi-directory-roles";

/**
 * YIQ PLATFORM master-data gate — gate #2 of the two-gate model.
 *
 * Covers everything NOT scoped to one chapter event: the national question
 * bank, topics, paper templates, the edition + its calendar, national rounds,
 * and cross-chapter promotion to the National Grand Finale.
 *
 * For anything tied to ONE chapter event (registration, running the online
 * round, finals scoring, publishing that chapter's result) use
 * getYiqEventAccess() in ./event-access.ts instead. Never mix the two.
 *
 * Passes for: app='yiq' role yiq_super_admin, OR any platform_super_admin.
 */

export type YiqSuperAdminGate =
  | { ok: true; userId: string; personId: string; email: string | null }
  | { ok: false; error: string };

const DENY_MESSAGE =
  "Only a YIQ national administrator can change platform master data.";
const UNAUTH_MESSAGE = "Not authenticated";

const YIQ_SUPER_ROLES = new Set([
  "yiq_super_admin",
  "yiq_national",
  "platform_super_admin",
]);

/**
 * Structured audit line on EVERY verdict — allow and both deny paths. A 403
 * must never be silent; grep Vercel logs for `yiq_super_admin_gate` to see
 * exactly who hit the gate and what roles they actually held.
 */
function logGateVerdict(payload: Record<string, unknown>): void {
  console.log(JSON.stringify({ tag: "yiq_super_admin_gate", ...payload }));
}

export async function requireYiqSuperAdmin(): Promise<YiqSuperAdminGate> {
  const me = await getCurrentPersonRoles();
  if (!me) {
    logGateVerdict({
      verdict: "deny",
      reason: "unauthenticated_or_no_person_row",
    });
    return { ok: false, error: UNAUTH_MESSAGE };
  }

  const activeRoles = me.assignments
    .filter((a) => a.is_active)
    .map((a) => `${a.app}:${a.role}`);

  const yiqSuper = me.assignments.some(
    (a) => a.is_active && a.app === "yiq" && YIQ_SUPER_ROLES.has(a.role)
  );
  const platformSuper = yiqSuper ? true : await isPlatformSuperAdmin();

  if (!yiqSuper && !platformSuper) {
    logGateVerdict({
      verdict: "deny",
      reason: "no_super_role",
      user_id: me.user_id,
      email: me.email,
      active_roles: activeRoles,
    });
    return { ok: false, error: DENY_MESSAGE };
  }

  logGateVerdict({
    verdict: "allow",
    user_id: me.user_id,
    email: me.email,
    matched_path: yiqSuper ? "yiq_super" : "platform_super",
    active_roles: activeRoles,
  });

  return {
    ok: true,
    userId: me.user_id,
    personId: me.person_id,
    email: me.email,
  };
}

/** Client-safe probe for hiding admin-only UI. Server gate is the boundary. */
export async function isCurrentUserYiqSuperAdmin(): Promise<boolean> {
  return (await requireYiqSuperAdmin()).ok;
}
