"use server";

/**
 * YIQ organiser roles — grant, revoke, list.
 *
 * ── ONE TABLE, NO PARALLEL STORE ────────────────────────────────────────
 * Every YIQ role is a row in `yi_directory.role_assignments` with app='yiq'.
 * There is no yiq.organisers table and there must never be one (CLAUDE.md).
 * This file writes the same table the live gates read, so a grant made here
 * takes effect on the granted person's very next request — no sync, no cache,
 * no second source to drift.
 *
 * ── THIS FILE DOES NOT CREATE PEOPLE ────────────────────────────────────
 * Creating a human being in yi_directory.people (and their auth login) is the
 * DIRECTORY's job, not YIQ's. grantYiqRole looks the person up by email and
 * refuses with an actionable message when they are not there. Minting people
 * from a vertical console is how duplicate identities get made.
 *
 * ── GATE ────────────────────────────────────────────────────────────────
 * requireYiqSuperAdmin() — platform master data, gate #2 of the two-gate
 * model. Managing who runs YIQ is not scoped to one chapter event, so
 * getYiqEventAccess does NOT apply here. Denials return
 * { success: false, error } — never redirect(), which produces a bounce-loop
 * the user cannot diagnose.
 *
 * ── WHY THE YIP SUPABASE CLIENT ─────────────────────────────────────────
 * `types/yiq/database.ts` types only the `yi` and `yiq` schemas;
 * `types/yip/database.ts` is the generated file that carries `yi_directory`.
 * A Supabase client is just a connection — `.schema()` overrides its default
 * pin — so we borrow the typed one rather than casting yi_directory writes to
 * `any`. lib/yi/auth/yi-directory-roles.ts (which every YIQ gate already
 * depends on) does exactly the same thing for the read path.
 */

import { revalidatePath } from "next/cache";
import { createServiceClient as createDirectoryClient } from "@/lib/yip/supabase/server";
import { createServiceClient as createYiqClient } from "@/lib/yiq/supabase/server";
import { requireYiqSuperAdmin } from "@/lib/yiq/auth/require-super-admin";
import {
  isPlatformSuperAdmin,
  withinValidityWindow,
} from "@/lib/yi/auth/yi-directory-roles";
import {
  YIQ_ROLE_ORDER,
  YIQ_ROLES_THAT_GRANT_NATIONAL,
  isYiZoneCode,
  isYiqRoleValue,
  normalizeRoleGrant,
  validateRoleGrant,
  yiqAssignmentTitle,
  yiqRoleLabel,
  type YiqRoleValue,
  type YiqTeamMember,
  type YiqUnmanagedRole,
} from "@/lib/yiq/roles";

type Err = { success: false; error: string };
type Ok<T = Record<string, never>> = { success: true } & T;

const TEAM_PATH = "/yiq/admin/team";

const norm = (s: string | null | undefined) => (s ?? "").trim().toLowerCase();
const isEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);

/** Row shape we read back from yi_directory, with the person embedded. */
type AssignmentRow = {
  id: string;
  person_id: string;
  role: string;
  yi_chapter: string | null;
  yi_zone: string | null;
  yi_year: number;
  is_active: boolean | null;
  valid_from: string | null;
  valid_until: string | null;
  person: {
    full_name: string;
    email: string | null;
    user_id: string | null;
    is_active: boolean | null;
  } | null;
};

const ASSIGNMENT_SELECT =
  "id, person_id, role, yi_chapter, yi_zone, yi_year, is_active, valid_from, valid_until, " +
  "person:people!inner(full_name, email, user_id, is_active)";

/**
 * EFFECTIVE active — the stored flag AND the validity window, exactly as
 * getCurrentPersonRoles computes it. Listing a time-expired row as "active"
 * would show an organiser who can no longer sign in as though they can.
 */
function effectivelyActive(r: AssignmentRow): boolean {
  return (
    (r.is_active ?? false) && withinValidityWindow(r.valid_from, r.valid_until)
  );
}

// ─── Read ───────────────────────────────────────────────────────────────

export type YiqTeam = {
  /** Roles granted through this console (app='yiq'). Revocable. */
  granted: YiqTeamMember[];
  /**
   * Yi directory chapter chairs. They are YIQ chapter chairs already — the
   * gate reads app='yi' chapter_chair / chapter_co_chair directly — so they
   * are shown as DERIVED and cannot be revoked here. Never duplicate them as
   * app='yiq' rows: the copy drifts the day a chapter changes chair.
   */
  derived: YiqTeamMember[];
  /** app='yiq' rows whose role this console does not manage. See below. */
  unmanaged: YiqUnmanagedRole[];
};

export async function listYiqTeam(): Promise<Ok<{ team: YiqTeam }> | Err> {
  const gate = await requireYiqSuperAdmin();
  if (!gate.ok) return { success: false, error: gate.error };

  const dir = await createDirectoryClient();

  const [{ data: yiqRows, error: yiqErr }, { data: chairRows }] =
    await Promise.all([
      dir
        .schema("yi_directory")
        .from("role_assignments")
        .select(ASSIGNMENT_SELECT)
        .eq("app", "yiq"),
      dir
        .schema("yi_directory")
        .from("role_assignments")
        .select(ASSIGNMENT_SELECT)
        .eq("app", "yi")
        .in("role", ["chapter_chair", "chapter_co_chair"]),
    ]);

  if (yiqErr) {
    return { success: false, error: `Could not read the team: ${yiqErr.message}` };
  }

  const granted: YiqTeamMember[] = [];
  const unmanaged: YiqUnmanagedRole[] = [];

  for (const raw of (yiqRows ?? []) as unknown as AssignmentRow[]) {
    // A deactivated row is history, not team. Deactivated PEOPLE hold no
    // effective roles either (getCurrentPersonRoles returns null for them).
    if (!effectivelyActive(raw)) continue;
    if (raw.person?.is_active === false) continue;

    const person = raw.person;
    if (!isYiqRoleValue(raw.role)) {
      // Not filtered away: a role this console cannot manage can still be a
      // role the GATE honours (e.g. a hand-written 'yiq_national'). Surface
      // it so somebody can see it and decide.
      unmanaged.push({
        assignmentId: raw.id,
        personId: raw.person_id,
        fullName: person?.full_name ?? "—",
        email: person?.email ?? null,
        role: raw.role,
        chapter: raw.yi_chapter,
        zone: raw.yi_zone,
        grantsNational: YIQ_ROLES_THAT_GRANT_NATIONAL.includes(raw.role),
      });
      continue;
    }

    granted.push({
      assignmentId: raw.id,
      personId: raw.person_id,
      fullName: person?.full_name ?? "—",
      email: person?.email ?? null,
      role: raw.role,
      chapter: raw.yi_chapter,
      zone: raw.yi_zone,
      yiYear: raw.yi_year,
      source: "granted",
      hasLogin: Boolean(person?.user_id),
    });
  }

  const derived: YiqTeamMember[] = [];
  for (const raw of (chairRows ?? []) as unknown as AssignmentRow[]) {
    if (!effectivelyActive(raw)) continue;
    if (raw.person?.is_active === false) continue;
    // Fail closed, exactly like the gate: a chair row with no chapter matches
    // no event, so it confers nothing and must not be listed as if it did.
    const chapter = (raw.yi_chapter ?? "").trim();
    if (!chapter) continue;
    derived.push({
      assignmentId: null,
      personId: raw.person_id,
      fullName: raw.person?.full_name ?? "—",
      email: raw.person?.email ?? null,
      role: "chapter_admin",
      chapter,
      zone: raw.yi_zone,
      yiYear: raw.yi_year,
      source: "derived_chapter_chair",
      hasLogin: Boolean(raw.person?.user_id),
    });
  }

  return { success: true, team: { granted, derived, unmanaged } };
}

// ─── Grant ──────────────────────────────────────────────────────────────

export type GrantInput = {
  email: string;
  role: string;
  chapter?: string | null;
  zone?: string | null;
};

export async function grantYiqRole(
  input: GrantInput
): Promise<Ok<{ message: string; warning?: string }> | Err> {
  const gate = await requireYiqSuperAdmin();
  if (!gate.ok) return { success: false, error: gate.error };

  // 1. Shape. validateRoleGrant is the SAME function the form runs, so the
  //    browser and the server can never disagree about what a role needs.
  const shapeError = validateRoleGrant(input);
  if (shapeError) return { success: false, error: shapeError };
  const grant = normalizeRoleGrant(input);
  if (!grant) return { success: false, error: "That role and scope do not go together." };

  const email = norm(input.email);
  if (!isEmail(email)) return { success: false, error: "Enter a valid email address." };

  // 2. Privilege escalation. A YIQ national admin runs YIQ; they do not get to
  //    mint peers. Only the platform super-admin — the sole directory owner in
  //    the locked three-tier model — may add another national admin.
  //
  //    NOTE for whoever owns lib/yi/auth/: checkRoleWriteAllowed()'s
  //    SUPER_TIER_ROLES list enumerates apps and does NOT include 'yiq', so
  //    'yiq_super_admin' passes through it. That is a fail-open for YIQ; this
  //    local check closes it here, but the shared guard should be fixed.
  if (grant.role === "yiq_super_admin" && !(await isPlatformSuperAdmin())) {
    return {
      success: false,
      error:
        "Only a platform super-admin can add a YIQ national admin. You can grant regional admins, chapter chairs and chapter organisers.",
    };
  }

  const yiq = await createYiqClient();
  const dir = await createDirectoryClient();

  // 3. The chapter has to be REAL. The gate matches yi_chapter against the
  //    event's chapter_name; a typo grants nothing at all and looks in this
  //    list exactly like a working grant.
  let chapter = grant.chapter;
  let zone = grant.zone;
  if (chapter) {
    const { data: chapters, error: chErr } = await yiq
      .schema("yi")
      .from("chapters")
      .select("name, region")
      .ilike("name", chapter);
    if (chErr) return { success: false, error: `Could not check the chapter: ${chErr.message}` };
    const match = (chapters ?? []).find((c) => norm(c.name) === norm(chapter));
    if (!match) {
      return {
        success: false,
        error: `"${chapter}" is not a Yi chapter. Pick the chapter from the list so the spelling matches exactly — the access check compares chapter names literally.`,
      };
    }
    // Store the chapter's canonical spelling and carry its own zone. Checked,
    // not cast: an unrecognised region code is dropped rather than written.
    chapter = match.name;
    if (!zone && isYiZoneCode(match.region)) zone = match.region;
  }

  // 4. The person must already exist in the Yi directory.
  const { data: people, error: pErr } = await dir
    .schema("yi_directory")
    .from("people")
    .select("id, full_name, email, user_id, is_active")
    .ilike("email", email);
  if (pErr) return { success: false, error: `Could not search the directory: ${pErr.message}` };

  const matches = (people ?? []).filter((p) => norm(p.email) === email);
  if (matches.length === 0) {
    return {
      success: false,
      error: `Nobody in the Yi directory uses ${email}. Add them to the Yi directory first (Admin → Directory) — YIQ grants roles to people who already exist, it does not create them.`,
    };
  }
  if (matches.length > 1) {
    return {
      success: false,
      error: `${email} matches ${matches.length} directory records. Ask a platform super-admin to merge them before granting a role, or the role may land on the wrong one.`,
    };
  }
  const person = matches[0];
  if (person.is_active === false) {
    return {
      success: false,
      error: `${person.full_name} is deactivated in the Yi directory. A deactivated person holds no roles at all, so this grant would do nothing. Reactivate them first.`,
    };
  }

  // 5. Yi year — mirrored from the active YIQ edition, never assumed.
  //
  // KNOWN PLATFORM GAP (found 2026-08-24): the Supabase project's PostgREST
  // `db_schema` list does NOT include `yiq`, so every read of a yiq.* table
  // fails with "Invalid schema: yiq". That is a project-config fix, not a
  // migration. Until it lands, this read fails — and it must say WHY rather
  // than blaming a missing edition, or the next person debugs the wrong thing.
  const { data: edition, error: edErr } = await yiq
    .from("editions")
    .select("yi_year")
    .eq("is_active", true)
    .maybeSingle();
  if (edErr) {
    return {
      success: false,
      error: `Could not read the YIQ edition: ${edErr.message}. If this says "Invalid schema: yiq", the Supabase project has not exposed the yiq schema to the API yet — that is a project setting, not something this page can fix.`,
    };
  }
  if (!edition) {
    return { success: false, error: "No active YIQ edition — set one before granting roles." };
  }
  const yiYear = edition.yi_year;

  // 6. Insert, or revive the existing row. The live unique index is
  //    (person_id, app, role, coalesce(yi_chapter,''), yi_year) — note it does
  //    NOT include yi_zone, so one person can hold only ONE zone per role.
  const { data: existingRows, error: exErr } = await dir
    .schema("yi_directory")
    .from("role_assignments")
    .select("id, yi_zone, is_active, yi_chapter")
    .eq("person_id", person.id)
    .eq("app", "yiq")
    .eq("role", grant.role)
    .eq("yi_year", yiYear);
  if (exErr) return { success: false, error: `Could not check existing roles: ${exErr.message}` };

  const existing = (existingRows ?? []).find(
    (r) => (r.yi_chapter ?? "") === (chapter ?? "")
  );
  const roleLabel = yiqRoleLabel(grant.role);
  const scopeText = chapter ?? zone ?? "nationally";

  if (existing) {
    if (existing.is_active) {
      // Re-scoping a zone role through a "grant" would silently move someone
      // off the zone they are currently running. Say so instead.
      if (grant.role === "regional_admin" && norm(existing.yi_zone) !== norm(zone)) {
        return {
          success: false,
          error: `${person.full_name} already runs zone ${existing.yi_zone ?? "(none)"}. A person can hold one YIQ zone at a time — revoke that first, then grant ${zone}.`,
        };
      }
      return {
        success: true,
        message: `${person.full_name} already had ${roleLabel} for ${scopeText}. Nothing changed.`,
      };
    }
    const { error: upErr } = await dir
      .schema("yi_directory")
      .from("role_assignments")
      .update({
        is_active: true,
        yi_zone: zone,
        title: yiqAssignmentTitle({ ...grant, chapter, zone }),
        // Clear any expiry left over from the previous revocation, or the row
        // would come back already dead.
        valid_from: null,
        valid_until: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id);
    if (upErr) return { success: false, error: `Could not restore the role: ${upErr.message}` };
  } else {
    const { error: insErr } = await dir
      .schema("yi_directory")
      .from("role_assignments")
      .insert({
        person_id: person.id,
        app: "yiq",
        role: grant.role,
        yi_year: yiYear,
        yi_chapter: chapter,
        yi_zone: zone,
        title: yiqAssignmentTitle({ ...grant, chapter, zone }),
        is_active: true,
        is_primary: false,
      });
    if (insErr) return { success: false, error: `Could not grant the role: ${insErr.message}` };
  }

  revalidatePath(TEAM_PATH);
  return {
    success: true,
    message: `${person.full_name} is now ${roleLabel} for ${scopeText}.`,
    // A role on a person with no login is invisible to them: they sign in to
    // nothing and see an empty app with no error. Say it out loud.
    warning: person.user_id
      ? undefined
      : `${person.full_name} has no Yi login yet, so they cannot sign in to use this. Link their account in the Yi directory.`,
  };
}

// ─── Revoke ─────────────────────────────────────────────────────────────

/**
 * Deactivate, never delete — the row is the audit trail of who could do what
 * and when. Re-granting the same role revives this row.
 */
export async function revokeYiqRole(
  assignmentId: string
): Promise<Ok<{ message: string }> | Err> {
  const gate = await requireYiqSuperAdmin();
  if (!gate.ok) return { success: false, error: gate.error };

  const id = (assignmentId ?? "").trim();
  if (!id) return { success: false, error: "No role selected." };

  const dir = await createDirectoryClient();

  const { data: row, error: readErr } = await dir
    .schema("yi_directory")
    .from("role_assignments")
    .select("id, app, role, yi_chapter, yi_zone, is_active, person_id")
    .eq("id", id)
    .maybeSingle();
  if (readErr) return { success: false, error: `Could not read that role: ${readErr.message}` };
  if (!row) return { success: false, error: "That role no longer exists." };

  // Scope guard: this console revokes YIQ roles only. It must never be able to
  // strip someone's Yi directory chair seat or another vertical's role.
  if (row.app !== "yiq") {
    return {
      success: false,
      error: `That is a ${row.app} role, not a YIQ one. Yi chapter chairs are YIQ chairs automatically — change that in the Yi directory, not here.`,
    };
  }
  if (!row.is_active) {
    return { success: true, message: "That role was already revoked." };
  }

  // Same escalation rule as granting: only the platform tier removes a peer
  // national admin.
  if (
    YIQ_ROLES_THAT_GRANT_NATIONAL.includes(row.role) &&
    !(await isPlatformSuperAdmin())
  ) {
    return {
      success: false,
      error: "Only a platform super-admin can remove a YIQ national admin.",
    };
  }

  // Lockout guard: removing the LAST national admin leaves nobody able to
  // manage papers, the question bank, or this page — including to undo it.
  if (YIQ_ROLES_THAT_GRANT_NATIONAL.includes(row.role)) {
    const { data: supers } = await dir
      .schema("yi_directory")
      .from("role_assignments")
      .select("id, role, is_active, valid_from, valid_until")
      .eq("app", "yiq")
      .eq("is_active", true)
      .in("role", [...YIQ_ROLES_THAT_GRANT_NATIONAL]);
    const liveSupers = (supers ?? []).filter((s) =>
      withinValidityWindow(s.valid_from, s.valid_until)
    );
    if (liveSupers.length <= 1) {
      return {
        success: false,
        error:
          "This is the only YIQ national admin. Removing them would leave nobody able to run YIQ — or to undo this. Grant a replacement first.",
      };
    }
  }

  const { error: upErr } = await dir
    .schema("yi_directory")
    .from("role_assignments")
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("app", "yiq");
  if (upErr) return { success: false, error: `Could not revoke the role: ${upErr.message}` };

  revalidatePath(TEAM_PATH);
  const where = row.yi_chapter ?? row.yi_zone ?? "nationally";
  return {
    success: true,
    message: `Removed ${yiqRoleLabel(row.role)} for ${where}.`,
  };
}

// ─── Scope options for the grant form ───────────────────────────────────

export type YiqScopeOptions = {
  chapters: { name: string; zone: string | null }[];
  zones: string[];
};

/**
 * The chapter list the grant form picks from. Reading it from yi.chapters (not
 * a hand-typed field) is what makes the "chapter must be real" guard in
 * grantYiqRole unreachable in normal use rather than a trap.
 */
export async function listYiqScopeOptions(): Promise<
  Ok<{ options: YiqScopeOptions }> | Err
> {
  const gate = await requireYiqSuperAdmin();
  if (!gate.ok) return { success: false, error: gate.error };

  const yiq = await createYiqClient();
  const { data, error } = await yiq
    .schema("yi")
    .from("chapters")
    .select("name, region")
    .eq("is_active", true)
    .order("name");
  if (error) return { success: false, error: `Could not load chapters: ${error.message}` };

  const chapters = (data ?? []).map((c) => ({
    name: c.name,
    zone: c.region ?? null,
  }));
  const zones = Array.from(
    new Set(chapters.map((c) => c.zone).filter((z): z is string => Boolean(z)))
  ).sort();

  return { success: true, options: { chapters, zones } };
}

/** Roles this console offers, narrowed to what the signed-in admin may grant. */
export async function listGrantableYiqRoles(): Promise<YiqRoleValue[]> {
  const gate = await requireYiqSuperAdmin();
  if (!gate.ok) return [];
  const platform = await isPlatformSuperAdmin();
  return YIQ_ROLE_ORDER.filter(
    (r) => platform || r !== "yiq_super_admin"
  ) as YiqRoleValue[];
}
