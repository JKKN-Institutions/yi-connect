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
 * and 2 in app/yip/dashboard/*). As of the tier-1 cutover the gate no longer
 * touches yip.organizers at all — the backward-compat `organizerId` field now
 * carries the canonical yi_directory `person_id`.
 *
 * Usage:
 *
 *     const gate = await requireSuperAdmin();
 *     if (!gate.ok) return { success: false, error: gate.error };
 */
import {
  getCurrentPersonRoles,
  isPlatformSuperAdmin,
} from "@/lib/yi/auth/yi-directory-roles";
import { shadowCompare } from "@/lib/yi/auth/shadow";

export type SuperAdminGate =
  | { ok: true; userId: string; organizerId: string }
  | { ok: false; error: string };

const DENY_MESSAGE = "Only super-admin (national role) can perform deletions.";
const UNAUTH_MESSAGE = "Not authenticated";

// Roles that count as YIP super-admin in yi_directory.role_assignments.
// New scheme: yip_super_admin / platform_super_admin. Legacy 'national' /
// 'super_admin' kept during the rename transition (dropped in Phase-6 cleanup).
const YIP_SUPER_ROLES = new Set([
  "yip_super_admin",
  "platform_super_admin",
  "national",
  "super_admin",
]);

// Platform-tier role names (new + legacy) for the strict directory gate.
const PLATFORM_SUPER_ROLES = ["platform_super_admin", "super_admin"];

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
    // SHADOW MODE (deny path): the SIGNAL-RICH side — log where the new gate
    // `can('event.delete',{app:'yip'})` would GRANT what this legacy
    // national/super_admin gate DENIES. Expected hit: platform_admin (global '*'
    // in the map, but not national/super_admin here). Observational only.
    void shadowCompare("require_super_admin", false, "event.delete", { app: "yip" });
    return { ok: false, error: DENY_MESSAGE };
  }

  logGateVerdict({
    verdict: "allow",
    user_id: me.user_id,
    email: me.email,
    matched_path: yipSuper ? "yip_super" : "platform_super",
    active_roles: activeRoles,
  });

  // SHADOW MODE (Phase 7): fire-and-forget logging of where the new scoped gate
  // `can('event.delete', { app: 'yip' })` would DISAGREE with this legacy
  // national/super_admin verdict. Purely observational — the verdict here is an
  // allow (both deny paths already returned), returned unchanged below; can()
  // enforces nothing. Expected signal: platform_admin (per-app, via the
  // capability map rather than this gate) surfaces as a disagreement.
  void shadowCompare("require_super_admin", true, "event.delete", { app: "yip" });

  // Backward-compat: callers expect a string `organizerId` field (the type
  // must remain stable; no caller currently dereferences it). We return the
  // canonical yi_directory person_id rather than touching the legacy
  // yip.organizers table — the gate no longer reads organizers at all.
  return {
    ok: true,
    userId: me.user_id,
    organizerId: me.person_id,
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

/**
 * STRICT platform-tier gate — ONLY platform_super_admin (the cross-app
 * platform owner) passes. Used to lock the cross-app yi_directory console
 * (/admin/directory) to the platform owner ALONE; YIP super-admins / national
 * do NOT pass (2026-06-01 model: only director edits the directory). Distinct
 * from requireSuperAdmin, which also accepts YIP super-admins for YIP
 * master-data.
 */
export async function requirePlatformSuperAdmin(): Promise<SuperAdminGate> {
  const me = await getCurrentPersonRoles();
  if (!me) {
    logGateVerdict({
      tag_gate: "platform",
      verdict: "deny",
      reason: "unauthenticated_or_no_person_row",
    });
    return { ok: false, error: UNAUTH_MESSAGE };
  }

  const activeRoles = me.assignments
    .filter((a) => a.is_active)
    .map((a) => `${a.app}:${a.role}`);

  const isPlatform = me.assignments.some(
    (a) => a.is_active && PLATFORM_SUPER_ROLES.includes(a.role)
  );

  if (!isPlatform) {
    logGateVerdict({
      tag_gate: "platform",
      verdict: "deny",
      reason: "not_platform_super_admin",
      user_id: me.user_id,
      email: me.email,
      active_roles: activeRoles,
    });
    return {
      ok: false,
      error: "Only the platform super-admin can manage the directory.",
    };
  }

  logGateVerdict({
    tag_gate: "platform",
    verdict: "allow",
    user_id: me.user_id,
    email: me.email,
    active_roles: activeRoles,
  });

  return { ok: true, userId: me.user_id, organizerId: me.person_id };
}

/** Client-safe probe for the strict platform gate (UX only). */
export async function isCurrentUserPlatformSuperAdmin(): Promise<boolean> {
  return (await requirePlatformSuperAdmin()).ok;
}
