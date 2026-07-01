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
import { cache } from "react";
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
 * True if `now` falls within [valid_from, valid_until] (inclusive). NULL bounds
 * are open. Fail-closed: a malformed/unparseable bound yields false, so a
 * broken window can only DENY, never grant (matches the project's
 * null-scope-must-deny doctrine).
 */
export function withinValidityWindow(
  validFrom: string | null | undefined,
  validUntil: string | null | undefined
): boolean {
  const now = Date.now();
  if (validFrom) {
    const from = Date.parse(validFrom);
    if (Number.isNaN(from) || now < from) return false;
  }
  if (validUntil) {
    const until = Date.parse(validUntil);
    if (Number.isNaN(until) || now > until) return false;
  }
  return true;
}

/**
 * Resolve the currently-authenticated user's yi_directory identity and all
 * their role assignments.
 *
 * IMPORTANT: the per-assignment `is_active` returned here is the EFFECTIVE
 * active flag = stored is_active AND now() within [valid_from, valid_until].
 * Every auth gate funnels through this function, so time-bounded roles
 * auto-activate / auto-expire across all gates with no per-gate change. The 4
 * DB SECURITY DEFINER auth functions enforce the same window on the SQL plane.
 *
 * Returns `null` if:
 *   - no auth session
 *   - no matching yi_directory.people row for this auth user
 *   - the person is deactivated (is_active=false)
 */
// Memoized per request with React cache(): auth gates across a single render or
// request resolve the current person's roles many times (every getYipEventAccess,
// every dashboard scope check), and each call otherwise re-runs auth.getUser plus
// two yi_directory reads. cache() collapses them to one resolution per request.
// Takes no arguments, so it memoizes to a single value — safe: the returned object
// (including the assignments array) is read-only and never mutated by callers.
export const getCurrentPersonRoles = cache(async (): Promise<PersonRoles | null> => {
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
    .select("id, email, is_active")
    .eq("user_id", user.id)
    .maybeSingle();

  if (personErr || !person) return null;

  // A soft-deleted (deactivated) person holds no effective roles — treat them
  // as having no directory identity so every gate fails closed immediately.
  // Deactivation takes effect on the next request (no session invalidation
  // needed) because every predicate funnels through this function.
  if (person.is_active === false) return null;

  // 2. person.id → role_assignments.
  // valid_from / valid_until are new columns not yet in the generated types,
  // so cast this query to a local typed row (the columns exist in the DB).
  type RoleRow = {
    app: string;
    role: string;
    yi_year: number;
    yi_chapter: string | null;
    yi_zone: string | null;
    yi_edition_id: string | null;
    is_active: boolean | null;
    valid_from: string | null;
    valid_until: string | null;
  };
  const rolesQuery = svc
    .schema("yi_directory")
    .from("role_assignments") as unknown as {
    select: (cols: string) => {
      eq: (
        k: string,
        v: unknown
      ) => Promise<{ data: RoleRow[] | null; error: unknown }>;
    };
  };
  const { data: rows, error: rowsErr } = await rolesQuery
    .select(
      "app, role, yi_year, yi_chapter, yi_zone, yi_edition_id, is_active, valid_from, valid_until"
    )
    .eq("person_id", person.id);

  if (rowsErr) return null;

  const assignments: RoleAssignment[] = (rows ?? []).map((r) => ({
    app: r.app,
    role: r.role,
    yi_year: r.yi_year,
    yi_chapter: r.yi_chapter,
    yi_zone: r.yi_zone,
    yi_edition_id: r.yi_edition_id ?? null,
    // EFFECTIVE active: stored flag AND within the validity window.
    is_active:
      (r.is_active ?? false) &&
      withinValidityWindow(r.valid_from, r.valid_until),
  }));

  return {
    user_id: user.id,
    person_id: person.id,
    email: person.email,
    assignments,
  };
});

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

  // Directory-chair recognition (YIP-only): a Yi directory chapter_chair /
  // chapter_co_chair is the canonical chair of their chapter and auto-administers
  // that chapter's YIP events even without a separate app='yip' role — mirrors
  // getYipEventAccess step 3a-ii. Without this, a directory chair who is NOT also
  // the chapter's chair_email (e.g. it was repointed to another admin) saw an
  // EMPTY YIP dashboard despite getYipEventAccess granting them admin on the event.
  if (app === "yip") {
    for (const a of me.assignments) {
      if (!a.is_active) continue;
      if (a.app !== "yi") continue;
      if (a.role !== "chapter_chair" && a.role !== "chapter_co_chair") continue;
      if (yi_year !== undefined && a.yi_year !== yi_year) continue;
      if (a.yi_chapter) chapters.add(a.yi_chapter);
    }
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

// ─── Chapter-wide chair (cross-vertical) ────────────────────────────────

/**
 * Role names that denote a CHAPTER-WIDE chair — a person who leads the WHOLE
 * chapter for the Yi year, across EVERY vertical (Yi Future, YIP, Youth
 * Academy, …), not a Yi-Future-specific role.
 *
 * Matched by ROLE NAME ONLY, never by `app`. `chapter_chair` currently lives at
 * `app='future'` (a load-bearing future.chapter_core_team sync artifact) and is
 * being re-tagged to a chapter-wide `app='yi'`. Because NO other app uses these
 * exact role names (verified against live data 2026-06-14 — YiFi's chair roles
 * are `host_chair` / `chapter_ent_chair`, distinct names), a role-name filter is
 * correct BEFORE and AFTER that migration: it never needs an app-specific
 * change, so every consumer (hub, per-vertical gates) is automatically
 * re-tag-safe. See memory project_chapter_chair_is_chapter_wide.
 */
export const CHAPTER_WIDE_CHAIR_ROLES = [
  "chapter_chair",
  "chapter_co_chair",
] as const;

/** Structural slice the chair helpers need — accepts any role-row shape. */
type ChairRoleLike = {
  role: string;
  yi_chapter: string | null;
  is_active: boolean;
  yi_year?: number;
};

/**
 * PURE: the distinct chapter names this person chairs (chapter-wide), from an
 * already-fetched role list. No I/O — feed it `me.assignments` (whose
 * `is_active` is the EFFECTIVE flag = stored flag AND within validity window),
 * so expired/time-bounded chair seats drop out automatically.
 *
 * Fail closed: a chair row with a null/blank `yi_chapter` grants NO chapter — a
 * chair with no chapter scope is meaningless and must never widen to "all
 * chapters". `yi_year` optionally narrows to one Yi year (omitted = any year;
 * the active flag already gates staleness).
 */
export function chairedChaptersFromRoles(
  roles: ReadonlyArray<ChairRoleLike>,
  yi_year?: number
): string[] {
  const chairRoles: ReadonlySet<string> = new Set(CHAPTER_WIDE_CHAIR_ROLES);
  const chapters = new Set<string>();
  for (const a of roles) {
    if (!a.is_active) continue;
    if (!chairRoles.has(a.role)) continue;
    if (yi_year !== undefined && a.yi_year !== yi_year) continue;
    const ch = (a.yi_chapter ?? "").trim();
    if (ch) chapters.add(ch);
  }
  return Array.from(chapters);
}

/**
 * Chapters the current session user chairs (chapter-wide). Empty array if they
 * chair nothing or are not signed in.
 */
export async function getChairedChapters(yi_year?: number): Promise<string[]> {
  const me = await getCurrentPersonRoles();
  if (!me) return [];
  return chairedChaptersFromRoles(me.assignments, yi_year);
}

/**
 * True if the current user is the chapter-wide chair of `chapter`. Fail-closed
 * on a blank target (a null/empty chapter never matches).
 */
export async function isChapterChairOf(
  chapter: string,
  yi_year?: number
): Promise<boolean> {
  const target = (chapter ?? "").trim();
  if (!target) return false;
  return (await getChairedChapters(yi_year)).includes(target);
}
