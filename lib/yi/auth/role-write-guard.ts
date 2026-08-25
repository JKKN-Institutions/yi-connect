import "server-only";

import { getCurrentPersonRoles } from "@/lib/yi/auth/yi-directory-roles";

/**
 * Privilege-escalation guard for role writes (locked 2026-06-01,
 * project_yi_auth_tier_model): an app super-admin may write only rows for
 * THEIR OWN app, and only roles BELOW the super tier — they may NOT mint a
 * peer or higher super-admin. Minting any `*_super_admin` (or the platform
 * tier) is platform-super-admin-only.
 *
 * This complements (does not replace) the per-surface app-super gate: callers
 * already gate "is this an app super-admin?"; this answers the narrower "may
 * this actor assign THIS role on THIS app?".
 */

// Platform-tier role names (new + legacy accepted during the rename window).
const PLATFORM_SUPER_ROLES = ["platform_super_admin", "super_admin"];

// Legacy per-app "super admin" role names accepted during the rename window
// (mirrors LEGACY_APP_SUPER_ROLES in yi-directory-roles.ts).
const LEGACY_APP_SUPER_ROLES: Record<string, string[]> = {
  yip: ["national"],
  future: ["national_admin", "platform_admin"],
};

// Every vertical whose super tier is platform-assignable-only. ADD A NEW
// VERTICAL HERE THE DAY IT IS CREATED.
//
// This list is the whole guard. A vertical missing from it FAILS OPEN — its
// `{app}_super_admin` slips past the check on line ~81 and that app's super
// can then mint a peer, which is precisely the privilege escalation this file
// exists to stop. `yiq` was omitted when YIQ shipped on 2026-08-24 and was
// fail-open until it was caught; the same shape of bug has bitten this repo
// before (a hardcoded five-key list that 403'd the sixth). Nothing errors and
// nothing logs when it happens — the check simply does not fire.
const SUPER_TIER_APPS = [
  "yip",
  "future",
  "yifi",
  "yuva",
  "yiq",
  "varnam",
  // Named ahead of their code: no routes or gates exist for these yet. Listing
  // an app that does not exist only ever DENIES more, so it is safe; the
  // dangerous direction is the reverse, which is what bit yiq and varnam.
  "thalir",
  "masoom",
];

// Role names that ONLY a platform super-admin may assign. Any app's super tier
// (new `{app}_super_admin` + that app's legacy top-tier names) plus the
// platform tier itself. Built from the legacy map so it stays in one place.
const SUPER_TIER_ROLES = new Set<string>([
  ...PLATFORM_SUPER_ROLES,
  ...SUPER_TIER_APPS.map((a) => `${a}_super_admin`),
  // YIQ's gate also honours a legacy `yiq_national` alias
  // (lib/yiq/auth/require-super-admin.ts); guard it the same way.
  "yiq_national",
  ...Object.values(LEGACY_APP_SUPER_ROLES).flat(),
]);

export type RoleWriteCheck = { ok: true } | { ok: false; error: string };

/**
 * Returns ok only if the current user may assign `role` on `app`:
 *   - platform super-admin → may write anything (short-circuit);
 *   - otherwise the actor must be an ACTIVE `{app}_super_admin` of THIS app
 *     (legacy top-tier names accepted during transition), AND `role` must be
 *     BELOW the super tier (no minting peer/higher supers, no cross-app writes).
 * Fail-closed: unknown identity / wrong-app / super-tier role → denied.
 */
export async function checkRoleWriteAllowed(
  app: string,
  role: string
): Promise<RoleWriteCheck> {
  const me = await getCurrentPersonRoles();
  if (!me) return { ok: false, error: "Forbidden" };

  const active = me.assignments.filter((a) => a.is_active);

  // Platform super-admin short-circuits every gate.
  if (active.some((a) => PLATFORM_SUPER_ROLES.includes(a.role))) {
    return { ok: true };
  }

  const targetApp = app.trim().toLowerCase();
  const targetRole = role.trim();

  // Must be an active app super-admin of the SAME app.
  const acceptAppSuper = new Set([
    `${targetApp}_super_admin`,
    ...(LEGACY_APP_SUPER_ROLES[targetApp] ?? []),
  ]);
  const isAppSuper = active.some(
    (a) => a.app === targetApp && acceptAppSuper.has(a.role)
  );
  if (!isAppSuper) {
    return {
      ok: false,
      error: `You can only manage roles for your own app (${targetApp}).`,
    };
  }

  // App super-admins may NOT mint a peer or higher super-admin.
  if (SUPER_TIER_ROLES.has(targetRole)) {
    return {
      ok: false,
      error:
        "Only a platform super-admin can assign a super-admin role. App super-admins manage operational roles only.",
    };
  }

  return { ok: true };
}
