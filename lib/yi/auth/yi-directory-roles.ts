/**
 * Cross-vertical role helper — reads from yi_directory.role_assignments
 * (the canonical "mother source" for identity + roles across all Yi apps).
 *
 * Per CLAUDE.md: yi_directory is the canonical identity store. Vertical-
 * specific organizer tables (yip.organizers, future.team_members, etc.)
 * are derived/mirrored from yi_directory and must NOT be queried directly
 * for authorization decisions.
 *
 * Lookup chain:
 *   auth.users.id → yi_directory.people.user_id → yi_directory.role_assignments
 *
 * All reads use the service client to bypass RLS — authorization is the
 * caller's responsibility (this helper just answers "what roles does the
 * current session user have?").
 *
 * Created 2026-05-28 as part of YIP super-admin refactor (Phase 19 followup).
 */
import { createClient, createServiceClient } from "@/lib/yip/supabase/server";

export type RoleAssignment = {
  app: string;
  role: string;
  yi_year: number;
  yi_chapter: string | null;
  yi_zone: string | null;
  yi_edition_id: string | null;
  is_active: boolean;
};

export type PersonRoles = {
  user_id: string;
  person_id: string;
  email: string | null;
  assignments: RoleAssignment[];
};

/**
 * Resolve the currently-authenticated user's yi_directory identity and all
 * their role assignments (active + inactive — callers filter as needed).
 *
 * Returns `null` if:
 *   - no auth session
 *   - no matching yi_directory.people row for this auth user
 */
export async function getCurrentPersonRoles(): Promise<PersonRoles | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const svc = await createServiceClient();

  // 1. auth.users.id → yi_directory.people.user_id
  const { data: person, error: personErr } = await svc
    .schema("yi_directory")
    .from("people")
    .select("id, email")
    .eq("user_id", user.id)
    .maybeSingle();

  if (personErr || !person) return null;

  // 2. person.id → role_assignments
  const { data: rows, error: rowsErr } = await svc
    .schema("yi_directory")
    .from("role_assignments")
    .select("app, role, yi_year, yi_chapter, yi_zone, yi_edition_id, is_active")
    .eq("person_id", person.id);

  if (rowsErr) return null;

  const assignments: RoleAssignment[] = (rows ?? []).map((r) => ({
    app: r.app,
    role: r.role,
    yi_year: r.yi_year,
    yi_chapter: r.yi_chapter,
    yi_zone: r.yi_zone,
    yi_edition_id: r.yi_edition_id ?? null,
    is_active: r.is_active ?? false,
  }));

  return {
    user_id: user.id,
    person_id: person.id,
    email: person.email,
    assignments,
  };
}

/**
 * Convenience predicate — true if the current user has an active role
 * assignment matching the given (app, role[]) filter, optionally scoped
 * to a yi_year.
 */
export async function hasRole(opts: {
  app: string;
  roles: string[];
  yi_year?: number;
}): Promise<boolean> {
  const me = await getCurrentPersonRoles();
  if (!me) return false;

  return me.assignments.some(
    (a) =>
      a.is_active &&
      a.app === opts.app &&
      opts.roles.includes(a.role) &&
      (opts.yi_year === undefined || a.yi_year === opts.yi_year)
  );
}

/**
 * Three-tier app-scoped role model (locked 2026-06-01, Director interview;
 * see memory project_yi_auth_tier_model):
 *   - platform_super_admin : cross-app; owns the platform; sole directory editor.
 *   - {app}_super_admin     : manages ONE app's roles, scoped to that app.
 *   - {app}_admin           : operates ONE app; not a role-manager.
 *
 * TRANSITION (rename in flight): until the Phase-1 data migration renames the
 * legacy role values, these predicates ALSO accept the OLD names so no admin
 * is locked out between the code deploy and the data migration. The legacy
 * acceptance is removed in the Phase-6 cleanup migration.
 */

// Platform-tier role names (new + legacy accepted during the transition window).
const PLATFORM_SUPER_ROLES = ["platform_super_admin", "super_admin"];

// Legacy per-app "super admin" role names accepted during the rename window.
const LEGACY_APP_SUPER_ROLES: Record<string, string[]> = {
  yip: ["national"],
  future: ["national_admin", "platform_admin"],
};

/** Pure check against an already-fetched PersonRoles (avoids a second fetch). */
function holdsPlatformSuper(me: PersonRoles): boolean {
  return me.assignments.some(
    (a) => a.is_active && PLATFORM_SUPER_ROLES.includes(a.role)
  );
}

/**
 * Platform super-admin = the cross-app platform owner
 * (role='platform_super_admin', or legacy 'super_admin' during transition) on
 * ANY app. The ONLY tier allowed to edit the cross-app directory; short-
 * circuits every per-app gate.
 */
export async function isPlatformSuperAdmin(): Promise<boolean> {
  const me = await getCurrentPersonRoles();
  return me ? holdsPlatformSuper(me) : false;
}

/**
 * App super-admin = manages ONE app's roles, scoped to that app. Platform
 * super-admin short-circuits to true. Accepts the new `{app}_super_admin`
 * plus that app's legacy top-tier names during the transition.
 */
export async function isAppSuperAdmin(app: string): Promise<boolean> {
  const me = await getCurrentPersonRoles();
  if (!me) return false;
  if (holdsPlatformSuper(me)) return true;
  const accept = new Set([
    `${app}_super_admin`,
    ...(LEGACY_APP_SUPER_ROLES[app] ?? []),
  ]);
  return me.assignments.some(
    (a) => a.is_active && a.app === app && accept.has(a.role)
  );
}

/**
 * App admin (or above) = operates ONE app. True for `{app}_admin`,
 * `{app}_super_admin`, that app's legacy top-tier names, or platform super.
 */
export async function isAppAdmin(app: string): Promise<boolean> {
  const me = await getCurrentPersonRoles();
  if (!me) return false;
  if (holdsPlatformSuper(me)) return true;
  const accept = new Set([
    `${app}_super_admin`,
    `${app}_admin`,
    ...(LEGACY_APP_SUPER_ROLES[app] ?? []),
  ]);
  return me.assignments.some(
    (a) => a.is_active && a.app === app && accept.has(a.role)
  );
}

/**
 * Regional admin zones for the current user, within a given app.
 *
 * Returns the list of `yi_zone` codes (e.g. ['ER', 'NER']) where this user
 * has an active `role='regional_admin'` assignment for the given app. Empty
 * array if the user is not a regional admin anywhere (or not signed in).
 *
 * Provisioned 2026-05-28: 6 YIP RMs hold one zone each (ER, NER, NR, WR,
 * SRTN, SRTKKA). National admins (role='national') are NOT regional admins —
 * they're scoped wider via requireSuperAdmin/isCurrentUserSuperAdmin.
 */
export async function getRegionalAdminZones(
  app: string,
  yi_year?: number
): Promise<string[]> {
  const me = await getCurrentPersonRoles();
  if (!me) return [];

  const zones = new Set<string>();
  for (const a of me.assignments) {
    if (!a.is_active) continue;
    if (a.app !== app) continue;
    if (a.role !== "regional_admin") continue;
    if (yi_year !== undefined && a.yi_year !== yi_year) continue;
    if (a.yi_zone) zones.add(a.yi_zone);
  }
  return Array.from(zones);
}

/**
 * Chapter names where the current user holds an active CHAPTER role
 * (chapter_admin or chapter_organizer) for `app`. Used to scope the YIP
 * dashboard event list: under the two-role-per-chapter model `created_by` is
 * no longer an authz signal, so a chapter chair/organiser must see their
 * chapter's events even when someone else (national / SQL) created them.
 *
 * For app='yip' this ALSO projects the chair_email fallback: a Yi chapter
 * chair registered only via yi.chapters.chair_email — with NO explicit
 * chapter_admin/chapter_organizer role — must still see their chapter's
 * events. getYipEventAccess already honours chair_email for a single event;
 * this closes the listing half of that gap (found 2026-06-01, where the
 * Mizoram chair saw an empty dashboard despite chairing the chapter).
 */
export async function getYipChapterScopes(
  app: string,
  yi_year?: number
): Promise<string[]> {
  const me = await getCurrentPersonRoles();
  if (!me) return [];

  const chapters = new Set<string>();
  for (const a of me.assignments) {
    if (!a.is_active) continue;
    if (a.app !== app) continue;
    if (a.role !== "chapter_admin" && a.role !== "chapter_organizer") continue;
    if (yi_year !== undefined && a.yi_year !== yi_year) continue;
    if (a.yi_chapter) chapters.add(a.yi_chapter);
  }

  // chair_email fallback (YIP-only). Other apps recognise their chapter chair
  // via their own role/context layer, not yi.chapters.chair_email.
  if (app === "yip") {
    const email = (me.email ?? "").trim().toLowerCase();
    if (email) {
      const svc = await createServiceClient();
      const { data: chaired } = await svc
        .schema("yi")
        .from("chapters")
        .select("name, chair_email")
        .ilike("chair_email", email);
      for (const c of chaired ?? []) {
        // Re-verify on the normalised value and require non-empty (fail-closed),
        // mirroring the equality guard in getYipEventAccess.
        if (c.name && (c.chair_email ?? "").trim().toLowerCase() === email) {
          chapters.add(c.name);
        }
      }
    }
  }

  return Array.from(chapters);
}

/**
 * Convenience predicate — true if the current user is an active regional
 * admin for the given app + zone. Used by event-level read gates.
 */
export async function isRegionalAdminForZone(
  app: string,
  zoneCode: string,
  yi_year?: number
): Promise<boolean> {
  const zones = await getRegionalAdminZones(app, yi_year);
  return zones.includes(zoneCode);
}
