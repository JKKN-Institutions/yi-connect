/**
 * Varnam Vizha authorization — a thin wrapper over the canonical cross-app role
 * helper (lib/yi/auth/yi-directory-roles). NO new auth table: roles live in
 * yi_directory.role_assignments with app='varnam' (free-text, no CHECK).
 *
 * Doctrine (matches the rest of yi-connect): deny EXPLICITLY by rendering
 * Forbidden403 — never silent-redirect to a landing page (that creates an
 * undiagnosable bounce-loop).
 */
import {
  getCurrentPersonRoles,
  type PersonRoles,
} from "@/lib/yi/auth/yi-directory-roles";

export const VARNAM_APP = "varnam" as const;

/** Role values stored in yi_directory.role_assignments.role for app='varnam'. */
export const VARNAM_ROLE = {
  superAdmin: "varnam_super_admin", // festival master data
  chair: "chair",
  coChair: "co_chair",
  organizer: "organizer",
  forumLead: "forum_lead",
  viewer: "viewer",
} as const;

const PLATFORM_SUPER_ROLES = ["platform_super_admin", "super_admin"];

// Roles that may create/manage festival content (everything but delete).
const MANAGE_ROLES: string[] = [
  VARNAM_ROLE.superAdmin,
  VARNAM_ROLE.chair,
  VARNAM_ROLE.coChair,
  VARNAM_ROLE.organizer,
  VARNAM_ROLE.forumLead,
];

// Display priority, highest first.
const ROLE_ORDER: string[] = [
  VARNAM_ROLE.superAdmin,
  VARNAM_ROLE.chair,
  VARNAM_ROLE.coChair,
  VARNAM_ROLE.organizer,
  VARNAM_ROLE.forumLead,
  VARNAM_ROLE.viewer,
];

export type VarnamAccess = {
  /** Any active varnam role (or platform super) — may enter the committee area. */
  canView: boolean;
  /** Create/edit events, registrations, sponsors, etc. (not delete). */
  canManage: boolean;
  /** Festival master data — platform super or varnam_super_admin. */
  canAdmin: boolean;
  /** Highest-priority role held (for display), or null. */
  role: string | null;
  /** Human-readable denial reason (empty when canView). */
  reason: string;
};

function pickTopRole(roles: string[]): string | null {
  for (const r of ROLE_ORDER) if (roles.includes(r)) return r;
  return roles[0] ?? null;
}

function evaluate(me: PersonRoles | null): VarnamAccess {
  if (!me) {
    return {
      canView: false,
      canManage: false,
      canAdmin: false,
      role: null,
      reason: "Please sign in to access the Varnam Vizha committee area.",
    };
  }

  const platformSuper = me.assignments.some(
    (a) => a.is_active && PLATFORM_SUPER_ROLES.includes(a.role)
  );
  const varnamRoles = me.assignments
    .filter((a) => a.is_active && a.app === VARNAM_APP)
    .map((a) => a.role);

  if (!platformSuper && varnamRoles.length === 0) {
    return {
      canView: false,
      canManage: false,
      canAdmin: false,
      role: null,
      reason:
        "You don't have a Varnam Vizha role yet. Ask the festival chair to add you to the committee.",
    };
  }

  const canAdmin =
    platformSuper || varnamRoles.includes(VARNAM_ROLE.superAdmin);
  const canManage =
    canAdmin || varnamRoles.some((r) => MANAGE_ROLES.includes(r));

  return {
    canView: true,
    canManage,
    canAdmin,
    role: platformSuper ? "platform_super_admin" : pickTopRole(varnamRoles),
    reason: "",
  };
}

/** Resolve the current user's Varnam Vizha access. */
export async function getVarnamAccess(): Promise<VarnamAccess> {
  return evaluate(await getCurrentPersonRoles());
}

/** Convenience: true if the current user holds festival master-data rights. */
export async function isVarnamAdmin(): Promise<boolean> {
  return (await getVarnamAccess()).canAdmin;
}
