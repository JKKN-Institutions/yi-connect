/**
 * Yi Youth Academy national gate (mirror of lib/yip/auth/require-super-admin.ts).
 *
 * Gates platform/master-data actions: program templates, academy CRUD,
 * activate/deactivate, compliance dashboards, quarterly export — everything
 * the spec marks `requireYuvaNational()` (NOT event/run-scoped work; that is
 * getYuvaAccess().canManageRun / canManageAcademy).
 *
 * Predicate (canonical identity rule — yi_directory only):
 *   active assignment with app='yuva' AND role IN ('yuva_super_admin','yuva_admin')
 *   OR the cross-app platform tier (platform_super_admin / legacy super_admin
 *   on any app — same acceptance set as the YIP donor gate).
 *
 * Every verdict (allow + both deny paths) emits a single-line JSON log so a
 * 403 is never silent — grep Vercel logs for `yuva_national_gate`. (The YIP
 * donor earned this the hard way: a silent deny was misattributed for hours
 * on 2026-05-28.)
 *
 * Usage:
 *     const gate = await requireYuvaNational();
 *     if (!gate.ok) return { success: false, error: gate.error };
 */
import { getCurrentPersonRoles } from "@/lib/yi/auth/yi-directory-roles";
import { YUVA_APP, ROLE_SUPER_ADMIN, ROLE_ADMIN } from "@/lib/yuva/constants";

export type YuvaNationalGate =
  | { ok: true; userId: string; personId: string }
  | { ok: false; error: string };

const UNAUTH_MESSAGE = "Not authenticated";
const DENY_MESSAGE =
  "Only the Yi YUVA national team can perform this action.";

// app='yuva' national-tier roles (tier model locked 2026-06-01).
const YUVA_NATIONAL_ROLES = new Set<string>([ROLE_SUPER_ADMIN, ROLE_ADMIN]);

// Cross-app platform tier (new + legacy names during the rename transition).
const PLATFORM_SUPER_ROLES = new Set(["platform_super_admin", "super_admin"]);

/** Structured audit line on EVERY verdict — denials must be diagnosable. */
function logGateVerdict(payload: Record<string, unknown>): void {
  console.log(JSON.stringify({ tag: "yuva_national_gate", ...payload }));
}

export async function requireYuvaNational(): Promise<YuvaNationalGate> {
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

  // Path 1: explicit yuva national assignment.
  const yuvaNational = me.assignments.some(
    (a) =>
      a.is_active && a.app === YUVA_APP && YUVA_NATIONAL_ROLES.has(a.role)
  );

  // Path 2: cross-app platform tier (any app).
  const platformSuper =
    yuvaNational ||
    me.assignments.some(
      (a) => a.is_active && PLATFORM_SUPER_ROLES.has(a.role)
    );

  if (!yuvaNational && !platformSuper) {
    logGateVerdict({
      verdict: "deny",
      reason: "no_national_role",
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
    matched_path: yuvaNational ? "yuva_national" : "platform_super",
    active_roles: activeRoles,
  });

  return { ok: true, userId: me.user_id, personId: me.person_id };
}

/**
 * Client-safe probe — UI hide/show only; the server gate above is the
 * security boundary.
 */
export async function isCurrentUserYuvaNational(): Promise<boolean> {
  return (await requireYuvaNational()).ok;
}
