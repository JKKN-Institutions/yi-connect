// ═══════════════════════════════════════════════════════════════════════
// Yi-Future admin SOURCE OF TRUTH — yi_directory.role_assignments.
//
// Before this file there were TWO sources that disagreed about who is an
// admin:
//
//   • yi.national_admins  — 11 rows, is_super_admin (1) / is_platform_admin
//     (3). The Admins page listed it and its buttons wrote it.
//   • yi_directory.role_assignments — the project's declared mother source
//     (CLAUDE.md, effective 2026-05-28), read by requirePlatformAdmin()
//     and the /national/admin view gate.
//
// The split had a concrete, provable bug: two accounts
// (anuj.agarwal@gyandairy.com, arun@flosil.com) carried future_super_admin
// in yi_directory but flag-less rows in yi.national_admins. Pressing
// "Remove" on them deleted the legacy row and revoked NOTHING — they kept
// full structural-config power over all 65 chapters. The button lied.
// Two more accounts (yiqa.futuresuper@, yiqa.futureadmin@) held Yi-Future
// admin power via yi_directory while being invisible on the Admins page
// entirely — no row existed to press Remove on.
//
// Now: yi_directory is the ONLY thing any Yi-Future gate reads, and the
// Admins page writes exactly that. yi.national_admins is unread by Yi-Future
// authorization; it survives only for app/admin/directory/sync-status, whose
// job is to REPORT the legacy drift.
//
// The property deliberately chosen in the old platform-admin.ts header —
// "gate on the thing the Director can SEE AND CHANGE, so Demote has no
// second place to remember" — is preserved: the badges, the buttons, and
// every gate now all resolve to the same rows.
//
// ── Role vocabulary (app = 'future') ───────────────────────────────────
//
//   allowlist_owner   Gate A. Owns the Yi-Future admin allow-list: add /
//                     remove admins, promote/demote super, reset other
//                     admins' passwords. Rendered as the "Super admin"
//                     badge. Written by toggleSuperAdmin().
//
//   platform_admin    Gate B. Platform operator: stand inside another
//                     chapter (chapter switcher), manage chapter chairs.
//                     Rendered as the "Platform" badge. Written by
//                     togglePlatformAdmin().
//
//   future_admin      Plain listed national admin — view access only.
//                     Written by addNationalAdmin().
//
// `allowlist_owner` is deliberately a NEW, Yi-Future-scoped value rather
// than a reuse of the cross-app `platform_super_admin`. Reusing that one
// would have matched today's headcount exactly (director is its sole
// holder) but would have handed the Yi-Future "Promote super" button the
// power to grant platform ownership of YIP, YiFi and Yuva as a side
// effect. The blast radius of every button on this page stays inside
// app='future'.
//
// ── Fail CLOSED ────────────────────────────────────────────────────────
// Unknown email, no directory person, ambiguous person (two people rows
// sharing an email), or a failed query all DENY. Never grant on absence.
// ═══════════════════════════════════════════════════════════════════════

import { createServiceClient } from "@/lib/yi-future/supabase/server";

export const FUTURE_APP = "future";

// yi_directory.role_assignments.yi_year is NOT NULL and every existing
// app='future' row is 2026. No gate filters on year, so this only decides
// which row a write lands on / upserts against.
export const FUTURE_ROLE_YEAR = 2026;

/** Gate A — owns the allow-list. Rendered as the "Super admin" badge. */
export const ROLE_ALLOWLIST_OWNER = "allowlist_owner";

/** Gate B — platform operator. Rendered as the "Platform" badge. */
export const ROLE_PLATFORM_OPERATOR = "platform_admin";

/** Plain listed national admin (view-only). What "Add" grants. */
export const ROLE_PLAIN_ADMIN = "future_admin";

/**
 * Cross-app platform-owner short-circuit. Checked with NO app filter,
 * because platform ownership lives on app='platform' for some owners
 * (director@jkkn.ac.in holds platform:platform_super_admin). Unchanged
 * from the pre-existing predicates — do not narrow.
 */
export const CROSS_APP_OWNER_ROLES = [
  "platform_super_admin",
  "super_admin",
] as const;

/**
 * STRICT platform/super tier on app='future'. Gates privileged writes:
 * editions, tracks, problem statements, scoring rubrics, and the
 * registration window across all 65 chapters.
 *
 * Byte-identical to the set previously inlined in national-admins.ts and
 * duplicated in push.ts. Membership must not change.
 */
export const FUTURE_PLATFORM_TIER_ROLES = [
  "future_super_admin",
  "platform_super_admin",
  "super_admin",
  "platform_admin",
] as const;

/**
 * BROAD "any future admin" tier on app='future' — the regular tier is
 * INCLUDED. Gates the READ surface of /national/admin only. Must never
 * gate a privileged write (2026-06-01 privilege-escalation finding).
 */
export const FUTURE_BROAD_ADMIN_ROLES = [
  "future_super_admin",
  "future_admin",
  "super_admin",
  "platform_admin",
  "national_admin",
] as const;

/**
 * Every app='future' role that confers ANY admin capability — the union of
 * the two tiers above plus the allow-list marker.
 *
 * Two jobs: it decides who is LISTED on the Admins page (so nobody holds
 * power invisibly), and it is exactly what "Remove" deactivates (so the
 * button genuinely revokes rather than deleting a decorative row).
 */
export const FUTURE_ADMIN_ROLES = [
  ROLE_ALLOWLIST_OWNER,
  "future_super_admin",
  "future_admin",
  "platform_super_admin",
  "super_admin",
  "platform_admin",
  "national_admin",
] as const;

// ─── yi_directory accessor ──────────────────────────────────────────────
//
// createServiceClient() is generically pinned to the `future` schema, so
// yi_directory tables are not in its Database type. Rather than repeat an
// inline `as unknown as {...}` cast at each call site (the old shape — six
// separate hand-written builder types, each subtly different), this is ONE
// structural interface matching PostgREST's actual builder: every filter
// returns the builder, and the builder is thenable.

type DirResult<T> = { data: T[] | null; error: { message: string } | null };

interface DirFilterBuilder<T> extends PromiseLike<DirResult<T>> {
  eq(column: string, value: string | number | boolean): DirFilterBuilder<T>;
  in(column: string, values: readonly string[]): DirFilterBuilder<T>;
  limit(count: number): DirFilterBuilder<T>;
}

interface DirTable {
  select<T>(columns: string): DirFilterBuilder<T>;
  insert(rows: Record<string, unknown>[]): PromiseLike<DirResult<unknown>>;
  update(patch: Record<string, unknown>): DirFilterBuilder<unknown>;
}

interface DirSchema {
  from(table: string): DirTable;
}

async function directory(): Promise<DirSchema> {
  const svc = await createServiceClient();
  return (svc as unknown as { schema(name: string): DirSchema }).schema(
    "yi_directory"
  );
}

// ─── Identity resolution ────────────────────────────────────────────────

export function normalizeAdminEmail(
  raw: string | null | undefined
): string | null {
  const clean = raw?.trim().toLowerCase();
  return clean ? clean : null;
}

/**
 * Resolve an email to exactly one yi_directory person id, or null.
 *
 * FAIL CLOSED on ambiguity: if two people rows share an email we cannot
 * tell which human is signing in, so we deny. This is the same outcome the
 * previous `.maybeSingle()` produced (PostgREST errors on >1 row and the
 * callers dropped the error), made explicit instead of incidental.
 */
export async function resolveDirectoryPersonId(
  email: string | null | undefined
): Promise<string | null> {
  const clean = normalizeAdminEmail(email);
  if (!clean) return null;

  const dir = await directory();
  const { data } = await dir
    .from("people")
    .select<{ id: string }>("id")
    .eq("email", clean)
    .limit(2);

  if (!data || data.length !== 1) return null;
  return data[0].id;
}

/** Active role names held by a person, optionally scoped to one app. */
async function activeRolesFor(
  personId: string,
  roles: readonly string[],
  app?: string
): Promise<string[]> {
  const dir = await directory();
  let query = dir
    .from("role_assignments")
    .select<{ role: string }>("role")
    .eq("person_id", personId)
    .eq("is_active", true)
    .in("role", roles);
  if (app) query = query.eq("app", app);

  const { data } = await query;
  return (data ?? []).map((r) => r.role);
}

// ─── Gate predicates ────────────────────────────────────────────────────

/**
 * Does this person hold a cross-app platform-owner role? Used both as the
 * short-circuit inside the tier predicates and as the guard that stops the
 * Yi-Future Remove button from stripping platform-wide ownership.
 */
export async function hasCrossAppOwnerRole(
  email: string | null | undefined
): Promise<boolean> {
  const personId = await resolveDirectoryPersonId(email);
  if (!personId) return false;
  return (await activeRolesFor(personId, CROSS_APP_OWNER_ROLES)).length > 0;
}

/** Gate A — owns the Yi-Future admin allow-list ("Super admin" badge). */
export async function isFutureAllowlistOwner(
  email: string | null | undefined
): Promise<boolean> {
  const personId = await resolveDirectoryPersonId(email);
  if (!personId) return false;
  return (
    (await activeRolesFor(personId, [ROLE_ALLOWLIST_OWNER], FUTURE_APP))
      .length > 0
  );
}

/** Gate B — platform operator ("Platform" badge): chapter switcher, chairs. */
export async function isFuturePlatformOperator(
  email: string | null | undefined
): Promise<boolean> {
  const personId = await resolveDirectoryPersonId(email);
  if (!personId) return false;
  return (
    (await activeRolesFor(personId, [ROLE_PLATFORM_OPERATOR], FUTURE_APP))
      .length > 0
  );
}

/**
 * Gate C — STRICT platform/super tier. Gates every structural-config write
 * (editions, tracks, problems, rubrics, registration window).
 */
export async function hasFuturePlatformTier(
  email: string | null | undefined
): Promise<boolean> {
  const personId = await resolveDirectoryPersonId(email);
  if (!personId) return false;

  if ((await activeRolesFor(personId, CROSS_APP_OWNER_ROLES)).length > 0) {
    return true;
  }
  return (
    (await activeRolesFor(personId, FUTURE_PLATFORM_TIER_ROLES, FUTURE_APP))
      .length > 0
  );
}

/**
 * Gate D — BROAD "any future admin" tier. VIEW gate for /national/admin.
 * MUST NOT gate a privileged write.
 */
export async function hasFutureBroadAdminRole(
  email: string | null | undefined
): Promise<boolean> {
  const personId = await resolveDirectoryPersonId(email);
  if (!personId) return false;

  if ((await activeRolesFor(personId, CROSS_APP_OWNER_ROLES)).length > 0) {
    return true;
  }
  return (
    (await activeRolesFor(personId, FUTURE_BROAD_ADMIN_ROLES, FUTURE_APP))
      .length > 0
  );
}

// ─── Listing ────────────────────────────────────────────────────────────

export type FutureAdminDirectoryRow = {
  email: string;
  isAllowlistOwner: boolean;
  isPlatformOperator: boolean;
  /** Every active role that put this person on the list, for display. */
  roles: string[];
  /** Free-text note captured when they were added (role_assignments.title). */
  title: string | null;
  /** Earliest created_at across those roles — "Added" on the page. */
  addedAt: string | null;
};

type ListedRoleRow = {
  role: string;
  app: string;
  created_at: string | null;
  title: string | null;
  people: { email: string | null } | null;
};

/**
 * Everyone who holds ANY Yi-Future admin capability today.
 *
 * Deliberately a union of two queries:
 *   1. app='future' rows in FUTURE_ADMIN_ROLES, and
 *   2. cross-app owner rows on ANY app,
 * because the tier predicates short-circuit on (2). Listing only (1) would
 * leave a platform owner holding power while invisible on the page — the
 * exact class of bug this file exists to close.
 *
 * Volume is ~20 rows against PostgREST's ~1000-row default cap, so no
 * pagination is needed here.
 */
export async function listFutureAdmins(): Promise<FutureAdminDirectoryRow[]> {
  const dir = await directory();
  const columns = "role, app, created_at, title, people!inner(email)";

  const [scoped, crossApp] = await Promise.all([
    dir
      .from("role_assignments")
      .select<ListedRoleRow>(columns)
      .eq("is_active", true)
      .eq("app", FUTURE_APP)
      .in("role", FUTURE_ADMIN_ROLES),
    dir
      .from("role_assignments")
      .select<ListedRoleRow>(columns)
      .eq("is_active", true)
      .in("role", CROSS_APP_OWNER_ROLES),
  ]);

  const byEmail = new Map<string, FutureAdminDirectoryRow>();

  for (const row of [...(scoped.data ?? []), ...(crossApp.data ?? [])]) {
    const email = normalizeAdminEmail(row.people?.email);
    if (!email) continue;

    const existing = byEmail.get(email) ?? {
      email,
      isAllowlistOwner: false,
      isPlatformOperator: false,
      roles: [],
      title: null,
      addedAt: null,
    };
    if (!existing.title && row.title) existing.title = row.title;

    const label = row.app === FUTURE_APP ? row.role : `${row.app}:${row.role}`;
    if (!existing.roles.includes(label)) existing.roles.push(label);

    if (row.app === FUTURE_APP && row.role === ROLE_ALLOWLIST_OWNER) {
      existing.isAllowlistOwner = true;
    }
    if (row.app === FUTURE_APP && row.role === ROLE_PLATFORM_OPERATOR) {
      existing.isPlatformOperator = true;
    }
    if (
      row.created_at &&
      (existing.addedAt === null || row.created_at < existing.addedAt)
    ) {
      existing.addedAt = row.created_at;
    }

    byEmail.set(email, existing);
  }

  for (const row of byEmail.values()) row.roles.sort();
  return [...byEmail.values()];
}

/**
 * How many DISTINCT people hold an active app='future' role. Backs the
 * last-owner / last-platform-admin guards.
 */
export async function countFutureRoleHolders(role: string): Promise<number> {
  const dir = await directory();
  const { data } = await dir
    .from("role_assignments")
    .select<{ person_id: string }>("person_id")
    .eq("is_active", true)
    .eq("app", FUTURE_APP)
    .eq("role", role);
  return new Set((data ?? []).map((r) => r.person_id)).size;
}

// ─── Writes ─────────────────────────────────────────────────────────────

export type WriteResult = { ok: true } | { ok: false; error: string };

/**
 * Grant or revoke ONE app='future' role for one person.
 *
 * Read-then-update-or-insert rather than an upsert: the only unique index
 * on role_assignments is `uq_role_assignment_scope (person_id, app, role,
 * COALESCE(yi_chapter,''), yi_year)`, and PostgREST's on_conflict cannot
 * target an index built on an expression. Two round-trips at human speed
 * is the cheaper correctness.
 *
 * Revoking sets is_active = false rather than deleting, so the grant
 * history survives for audit.
 */
export async function setFutureRoleActive(
  email: string,
  role: string,
  active: boolean,
  title?: string | null
): Promise<WriteResult> {
  const clean = normalizeAdminEmail(email);
  if (!clean) return { ok: false, error: "Missing email." };

  const personId = await resolveDirectoryPersonId(clean);
  if (!personId) {
    return {
      ok: false,
      error: `${clean} has no unique yi_directory person record. Add them to the directory first.`,
    };
  }

  const dir = await directory();
  const { data: existing } = await dir
    .from("role_assignments")
    .select<{ id: string }>("id")
    .eq("person_id", personId)
    .eq("app", FUTURE_APP)
    .eq("role", role)
    .eq("yi_year", FUTURE_ROLE_YEAR)
    .limit(1);

  if (existing && existing.length > 0) {
    const { error } = await dir
      .from("role_assignments")
      .update({ is_active: active, updated_at: new Date().toISOString() })
      .eq("id", existing[0].id);
    return error ? { ok: false, error: error.message } : { ok: true };
  }

  // Revoking something that was never granted is already the desired state.
  if (!active) return { ok: true };

  const { error } = await dir.from("role_assignments").insert([
    {
      person_id: personId,
      app: FUTURE_APP,
      role,
      yi_year: FUTURE_ROLE_YEAR,
      is_active: true,
      is_primary: false,
      title: title ?? null,
    },
  ]);
  return error ? { ok: false, error: error.message } : { ok: true };
}

/**
 * Revoke EVERY app='future' admin role for one person — what "Remove" on
 * the Admins page now does.
 *
 * Cross-app owner roles are deliberately NOT touched: stripping
 * platform:platform_super_admin from the Yi-Future page would silently
 * remove that person's ownership of YIP, YiFi and Yuva too. Callers must
 * refuse the operation for cross-app owners instead (explicitly, with a
 * reason) — see removeNationalAdmin().
 */
export async function deactivateFutureAdminRoles(
  email: string
): Promise<WriteResult> {
  const clean = normalizeAdminEmail(email);
  if (!clean) return { ok: false, error: "Missing email." };

  const personId = await resolveDirectoryPersonId(clean);
  if (!personId) {
    return { ok: false, error: `${clean} has no unique yi_directory person record.` };
  }

  const dir = await directory();
  const { error } = await dir
    .from("role_assignments")
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq("person_id", personId)
    .eq("app", FUTURE_APP)
    .in("role", FUTURE_ADMIN_ROLES);

  return error ? { ok: false, error: error.message } : { ok: true };
}
