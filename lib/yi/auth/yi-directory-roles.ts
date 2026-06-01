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
 * Platform super-admin = a user with a cross-vertical "super_admin" role.
 *
 * Convention (locked 2026-05-28): a role assignment with role='super_admin'
 * on ANY app value is treated as platform-wide super-admin. Vertical-
 * specific super-admin gates (e.g. requireSuperAdmin in YIP) MUST also
 * accept this as a positive answer.
 *
 * Today no rows match (the role enum used by humans is 'national' / 'rm' /
 * 'chapter_em' / 'chapter_chair'). The hook is here so a future migration
 * can introduce a single platform super-admin without touching every gate.
 */
export async function isPlatformSuperAdmin(): Promise<boolean> {
  const me = await getCurrentPersonRoles();
  if (!me) return false;

  return me.assignments.some(
    (a) => a.is_active && a.role === "super_admin"
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
