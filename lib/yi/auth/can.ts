/**
 * can() — the single scoped-permission entry point (Phase 7 / Layer 3).
 *
 * This is THE gate. Every page and Server Action that needs to answer "is the
 * current user allowed to do X here?" should call `can(capability, target)`
 * rather than hand-rolling role checks. It composes two layers:
 *
 *   1. WHO the user is + WHAT roles they hold  → getCurrentPersonRoles()
 *      (reads yi_directory.role_assignments — the canonical mother source)
 *   2. WHAT each (app, role) may do + at WHICH scope
 *      → yi_directory.role_permissions (the DRAFT capability map)
 *
 * It then intersects the two: for each active assignment in the requested app,
 * is there a matching permission row whose scope contains the target?
 *
 * Scope types understood by the resolver:
 *   - global  → grants everywhere in the app (no further check)
 *   - zone    → grants when the assignment's yi_zone === target.zone
 *   - chapter → grants when the assignment's yi_chapter === target.chapter
 *   - edition → grants when the assignment's yi_edition_id === target.editionId
 *   - self    → grants only when the target subject record IS the current user
 *               (target.subjectPersonId === the acting person's id)
 *
 * ⚠️ The capability map this reads is a DRAFT pending Director review (see
 * docs/permission-capability-map-DRAFT.md). The MACHINERY here is the
 * deliverable; do not treat the current allow/deny answers as security-final.
 *
 * Deny-by-default: if nothing explicitly grants the capability in scope,
 * can() returns false.
 *
 * Created 2026-05-31 — consolidation plan §4, §6 (Phase 7).
 */
import { createServiceClient } from "@/lib/yip/supabase/server";
import {
  getCurrentPersonRoles,
  type RoleAssignment,
} from "@/lib/yi/auth/yi-directory-roles";

type PermissionRow = {
  capability: string;
  scope_type: string;
};

/**
 * Does the stored permission's `capability` pattern match the requested capability?
 *
 * Wildcard semantics (kept intentionally simple — plan §4):
 *   - stored '*'      → matches ANY requested capability
 *   - stored 'X.*'    → matches when requested starts with 'X.'   (e.g. 'event.*'  ⊇ 'event.delete')
 *   - stored '*.Y'    → matches when requested ends with   '.Y'   (e.g. '*.read'   ⊇ 'event.read')
 *   - otherwise       → exact string match
 */
function capabilityMatches(stored: string, requested: string): boolean {
  if (stored === "*") return true;
  if (stored.endsWith(".*")) {
    const prefix = stored.slice(0, -1); // 'event.*' → 'event.'
    return requested.startsWith(prefix);
  }
  if (stored.startsWith("*.")) {
    const suffix = stored.slice(1); // '*.read' → '.read'
    return requested.endsWith(suffix);
  }
  return stored === requested;
}

/**
 * Resolve whether the current user may perform `capability` against `target`.
 *
 * @param capability dotted capability string, e.g. 'event.delete' / 'event.read'
 * @param target     where the action lands: which app, and (for scoped roles)
 *                   the chapter / zone / year it concerns.
 * @returns true on the FIRST role assignment that grants the capability in scope;
 *          false otherwise (deny-by-default).
 */
/**
 * Policy resolution given an explicit set of role assignments. Reads the
 * capability map from yi_directory.role_permissions and intersects. Separated
 * from the session lookup so it can be previewed/tested for ANY user (see
 * /api/debug-can) — `can()` is the thin session-bound wrapper below.
 */
export async function canForAssignments(
  assignments: RoleAssignment[],
  capability: string,
  target: {
    app: string;
    chapter?: string | null;
    zone?: string | null;
    year?: number;
    subjectPersonId?: string | null;
    editionId?: string | null;
  },
  selfPersonId?: string | null
): Promise<boolean> {
  // Root platform super-admin (decision 2026-05-31, role renamed 2026-06-01): a
  // 'platform_super_admin' assignment grants everything in EVERY app — the
  // yi-connect-level owner is cross-app and can never be locked out by the
  // capability map. Legacy 'super_admin' kept during the rename transition.
  // ({app}_super_admin / {app}_admin stay PER-APP and flow through the map
  // below.) Kept in code, not just data, so a map mistake can never lock out
  // the platform owner.
  if (
    assignments.some(
      (a) =>
        a.is_active &&
        (a.role === "platform_super_admin" || a.role === "super_admin")
    )
  ) {
    return true;
  }

  // Everyone else: only assignments that are active AND for the target app can grant access.
  const relevant = assignments.filter(
    (a) => a.is_active && a.app === target.app
  );
  if (relevant.length === 0) return false;

  const svc = await createServiceClient();

  for (const assignment of relevant) {
    // Pull the (app, role) permission rows once per assignment role.
    // `role_permissions` is brand new (migration 20260531130000) and not yet in the
    // generated Supabase types, so we cast the table name per the codebase convention.
    const { data: perms, error } = await svc
      .schema("yi_directory")
      .from("role_permissions" as never)
      .select("capability, scope_type")
      .eq("app", target.app)
      .eq("role", assignment.role);

    if (error || !perms) continue;

    for (const perm of perms as unknown as PermissionRow[]) {
      if (!capabilityMatches(perm.capability, capability)) continue;

      // Capability matches — now the scope must contain the target.
      switch (perm.scope_type) {
        case "global":
          return true;
        case "zone":
          if (
            target.zone != null &&
            assignment.yi_zone != null &&
            assignment.yi_zone === target.zone
          ) {
            return true;
          }
          break;
        case "chapter":
          if (
            target.chapter != null &&
            assignment.yi_chapter != null &&
            assignment.yi_chapter === target.chapter
          ) {
            return true;
          }
          break;
        case "edition":
          // Edition scope: the assignment is pinned to one yi_edition_id and the
          // target names the edition it concerns. Grant only on an exact match.
          if (
            assignment.yi_edition_id != null &&
            target.editionId != null &&
            assignment.yi_edition_id === target.editionId
          ) {
            return true;
          }
          break;
        case "self":
          // Self scope: the action targets a subject record and that subject IS the
          // acting person. Grant only when both ids are known and equal.
          if (
            target.subjectPersonId != null &&
            selfPersonId != null &&
            target.subjectPersonId === selfPersonId
          ) {
            return true;
          }
          break;
        default:
          break;
      }
    }
  }

  return false;
}

/**
 * Resolve whether the CURRENT (session) user may perform `capability` against
 * `target`. Thin wrapper over canForAssignments using the live auth session —
 * this is what pages and Server Actions call. Deny-by-default if no session.
 */
export async function can(
  capability: string,
  target: {
    app: string;
    chapter?: string | null;
    zone?: string | null;
    year?: number;
    subjectPersonId?: string | null;
    editionId?: string | null;
  }
): Promise<boolean> {
  const me = await getCurrentPersonRoles();
  if (!me) return false;
  return canForAssignments(me.assignments, capability, target, me.person_id);
}
