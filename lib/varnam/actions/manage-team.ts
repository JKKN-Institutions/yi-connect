"use server";

/**
 * Committee (team) management for Varnam Vizha — the chair adds/removes
 * committee members from the dashboard instead of developer SQL inserts.
 *
 * Identity lives in yi_directory.people; roles in yi_directory.role_assignments
 * with app='varnam' (same store getVarnamAccess reads). Every action RE-CHECKS
 * authorization server-side — hidden buttons are never trusted.
 *
 * IMPORTANT unique-index note: role_assignments is unique on
 * (person_id, app, role, COALESCE(yi_chapter,''), yi_year) — a COALESCE
 * expression index, so upsert/onConflict cannot target it. We check-then-insert
 * instead, and reactivate a matching inactive row rather than inserting a
 * duplicate tuple (which would violate the index).
 *
 * Login linkage: people.user_id is what login resolution uses
 * (getCurrentPersonRoles matches auth user → people.user_id). There is NO
 * automatic on-login linker in this repo — linkage happens via the platform
 * admin's directory invite flow (app/admin/directory → invite, which creates
 * the auth user and binds people.user_id by email) or the manual
 * linkPersonToUser() primitive (lib/yi/directory/resolve-person.ts). A member
 * added here with user_id null can NOT open the dashboard until that happens —
 * the UI surfaces this hint.
 */
import { revalidatePath } from "next/cache";
import { createAdminSupabaseClient } from "@/lib/supabase/server";
import { getVarnamAccess, VARNAM_ROLE } from "@/lib/varnam/auth/access";

export type TeamActionState = { ok: boolean; message: string };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Roles the chair may hand out from the dashboard. Chair itself and
// varnam_super_admin stay with the platform admin (directory invite flow).
const ADDABLE_ROLES = ["co_chair", "organizer", "forum_lead", "viewer"];

const VARNAM_YEAR = 2026;
const VARNAM_CHAPTER = "Erode";
const TEAM_PATH = "/varnam-vizha/dashboard/team";

/**
 * Server-side gate: festival admin OR chair/co-chair. Returns a denial state
 * (to surface inline) or null when allowed. `access.role` is the caller's
 * highest-priority role, so a chair who is also super admin passes via
 * canAdmin first.
 */
async function denyUnlessTeamAdmin(): Promise<TeamActionState | null> {
  const access = await getVarnamAccess();
  if (!access.canView) return { ok: false, message: access.reason };
  const allowed =
    access.canAdmin ||
    access.role === VARNAM_ROLE.chair ||
    access.role === VARNAM_ROLE.coChair;
  if (!allowed) {
    return {
      ok: false,
      message: "Only the festival chair or co-chair can manage the committee.",
    };
  }
  return null;
}

// Local row shapes (yi_directory isn't in the generated types).
type PersonRow = { id: string; email: string | null; user_id: string | null };
type AssignmentRow = {
  id: string;
  is_active: boolean | null;
  yi_chapter: string | null;
};

/** Add (or re-activate) a committee member by name + email + role. */
export async function addMember(
  _prev: TeamActionState,
  formData: FormData
): Promise<TeamActionState> {
  const denied = await denyUnlessTeamAdmin();
  if (denied) return denied;

  const fullName = String(formData.get("full_name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const role = String(formData.get("role") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim();

  if (!fullName) return { ok: false, message: "Please enter their name." };
  if (!EMAIL_RE.test(email))
    return { ok: false, message: "Please enter a valid email address." };
  if (!ADDABLE_ROLES.includes(role))
    return { ok: false, message: "Please pick a valid committee role." };

  const sb = createAdminSupabaseClient();

  // (a) Find the directory identity by email (case-insensitive), else create
  // one with no login attached (user_id null — see linkage note up top).
  const { data: foundRaw, error: findErr } = await sb
    .schema("yi_directory")
    .from("people")
    .select("id, email, user_id")
    .ilike("email", email)
    .maybeSingle();
  if (findErr) {
    return { ok: false, message: "Couldn't look up the directory — please try again." };
  }
  // ilike treats _ and % as wildcards, so verify the match is the SAME email
  // (guards against attaching the role to a near-miss person).
  let person =
    foundRaw && (foundRaw as PersonRow).email?.toLowerCase() === email
      ? (foundRaw as PersonRow)
      : null;

  if (!person) {
    const { data: created, error: insertErr } = await sb
      .schema("yi_directory")
      .from("people")
      .insert({
        full_name: fullName,
        email,
        is_active: true,
        user_id: null,
      })
      .select("id, email, user_id")
      .single();
    if (insertErr || !created) {
      return {
        ok: false,
        message: "Couldn't add them to the directory — please try again.",
      };
    }
    person = created as PersonRow;
  }

  // (b) Existing assignments for this exact (app, role, year) — an array read,
  // not .maybeSingle(), because 'Erode' and NULL-chapter rows can coexist under
  // the COALESCE unique index and two rows would make maybeSingle error out.
  const { data: existingRaw, error: existErr } = await sb
    .schema("yi_directory")
    .from("role_assignments")
    .select("id, is_active, yi_chapter")
    .eq("person_id", person.id)
    .eq("app", "varnam")
    .eq("role", role)
    .eq("yi_year", VARNAM_YEAR);
  if (existErr) {
    return { ok: false, message: "Couldn't check the committee list — please try again." };
  }
  const existing = (existingRaw ?? []) as AssignmentRow[];

  if (existing.some((a) => a.is_active)) {
    return { ok: true, message: `${fullName} is already on the committee.` };
  }

  const needsLinkHint = !person.user_id;
  const linkHint = needsLinkHint
    ? " They'll get dashboard access once their Yi Connect account is linked — ask the platform admin to send a directory invite."
    : "";

  // Re-activate a previously removed row with the same tuple instead of
  // inserting (insert would violate the unique index).
  const sameTuple = existing.find((a) => (a.yi_chapter ?? "") === VARNAM_CHAPTER);
  if (sameTuple) {
    const { data: updated, error: updErr } = await sb
      .schema("yi_directory")
      .from("role_assignments")
      .update({ is_active: true, title: title || null })
      .eq("id", sameTuple.id)
      .select("id");
    if (updErr || !updated || updated.length === 0) {
      return { ok: false, message: "Couldn't re-add them — please try again." };
    }
    revalidatePath(TEAM_PATH);
    return { ok: true, message: `${fullName} is back on the committee.${linkHint}` };
  }

  const { error: roleErr } = await sb
    .schema("yi_directory")
    .from("role_assignments")
    .insert({
      person_id: person.id,
      app: "varnam",
      role,
      yi_year: VARNAM_YEAR,
      yi_chapter: VARNAM_CHAPTER,
      title: title || null,
      is_active: true,
      is_primary: false,
    });
  if (roleErr) {
    return { ok: false, message: "Couldn't add the committee role — please try again." };
  }

  revalidatePath(TEAM_PATH);
  return { ok: true, message: `${fullName} added to the committee.${linkHint}` };
}

/** Deactivate a committee member's role assignment (soft remove). */
export async function deactivateMember(
  assignmentId: string
): Promise<TeamActionState> {
  const denied = await denyUnlessTeamAdmin();
  if (denied) return denied;

  const id = (assignmentId ?? "").trim();
  if (!id) return { ok: false, message: "Missing committee member." };

  const sb = createAdminSupabaseClient();

  // Load the target row — and pin app='varnam' so this action can never
  // deactivate another vertical's role by id.
  const { data: targetRaw, error: targetErr } = await sb
    .schema("yi_directory")
    .from("role_assignments")
    .select("id, role, yi_year, is_active")
    .eq("id", id)
    .eq("app", "varnam")
    .maybeSingle();
  if (targetErr) {
    return { ok: false, message: "Couldn't load that committee member — please try again." };
  }
  const target = targetRaw as {
    id: string;
    role: string;
    yi_year: number;
    is_active: boolean | null;
  } | null;
  if (!target) return { ok: false, message: "Committee member not found." };
  if (!target.is_active) {
    return { ok: true, message: "They've already been removed." };
  }

  // Super-admin rows are platform-managed — a chair must not remove them.
  if (target.role === VARNAM_ROLE.superAdmin) {
    const access = await getVarnamAccess();
    if (!access.canAdmin) {
      return {
        ok: false,
        message: "Festival admin roles are managed by the platform admin.",
      };
    }
  }

  // Never leave the festival chair-less: refuse to deactivate the LAST active
  // chair/co-chair of this year.
  if (target.role === VARNAM_ROLE.chair || target.role === VARNAM_ROLE.coChair) {
    const { count, error: countErr } = await sb
      .schema("yi_directory")
      .from("role_assignments")
      .select("id", { count: "exact", head: true })
      .eq("app", "varnam")
      .eq("yi_year", target.yi_year)
      .eq("is_active", true)
      .in("role", [VARNAM_ROLE.chair, VARNAM_ROLE.coChair]);
    if (countErr) {
      return { ok: false, message: "Couldn't verify the chair count — please try again." };
    }
    if ((count ?? 0) <= 1) {
      return { ok: false, message: "The festival must keep at least one chair." };
    }
  }

  // Update AND select the row back — surface silently-blocked writes.
  const { data: updated, error: updErr } = await sb
    .schema("yi_directory")
    .from("role_assignments")
    .update({ is_active: false })
    .eq("id", id)
    .select("id");
  if (updErr || !updated || updated.length === 0) {
    return { ok: false, message: "Couldn't remove them — please try again." };
  }

  revalidatePath(TEAM_PATH);
  return { ok: true, message: "Removed from the committee." };
}
