"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient, createServiceClient } from "@/lib/yi-future/supabase/server";
import type { Database } from "@/types/yi-future/database";
import type { ActionResult } from "./editions";
import { CORE_TEAM_ROLES } from "@/lib/yi-future/constants";
import { requireChapterAdmin } from "@/lib/yi-future/auth/require-access";
import {
  normaliseEmail,
  resetSignInPassword,
  resolveOrCreateSignInAccount,
} from "@/lib/yi-future/auth/core-team-login";
import type { CreateLoginResult } from "@/lib/yi-future/auth/core-team-login";

type CoreTeamRole = Database["future"]["Enums"]["user_role"];

/**
 * Minimal shape for reading `yi_directory` through the future-typed client.
 * That schema isn't in the generated Database type, so a structural cast is the
 * established pattern here (see feedback_yi_directory_typed_vs_loose_cast) — this
 * keeps it narrow instead of widening the whole client to `any`.
 */
type LooseSchemaClient = {
  schema: (name: string) => {
    from: (table: string) => {
      select: (columns: string) => {
        eq: (
          column: string,
          value: string
        ) => { maybeSingle: () => Promise<{ data: unknown }> };
      };
      update: (values: Record<string, unknown>) => {
        eq: (
          column: string,
          value: string
        ) => Promise<{ error: { message: string } | null }>;
      };
    };
  };
};

type CoreTeamRow = {
  id: string;
  chapter_id: string | null;
  full_name: string | null;
  email: string | null;
  role: string | null;
  user_id: string | null;
  person_id: string | null;
};

/**
 * Load a core-team row AND gate the caller on that row's OWN chapter.
 *
 * This is the highest-privilege table in Yi Future — a row here IS what makes
 * someone a chapter admin. Without a row-scoped gate, a chair of chapter A could
 * grant themselves core-team on chapter B, or remove chapter B's chair.
 *
 * Fails CLOSED: an unknown id, or a row with no chapter, resolves to null →
 * `requireChapterAdmin(null)` denies. Denial is EXPLICIT (requireChapterAdmin
 * redirects to /yi-future/forbidden, a real 403 page) — never a silent bounce to
 * a landing page, which produces a loop the admin cannot diagnose.
 */
async function loadCoreTeamRowForAdmin(id: string): Promise<CoreTeamRow | null> {
  const svc = await createServiceClient();
  const { data } = await svc
    .schema("future")
    .from("chapter_core_team")
    .select("id, chapter_id, full_name, email, role, user_id, person_id")
    .eq("id", id)
    .maybeSingle();
  const row = (data as unknown as CoreTeamRow | null) ?? null;
  await requireChapterAdmin(row?.chapter_id ?? null);
  // Unreachable for a missing row (the gate above already denied) — kept so the
  // callers below are type-safe rather than relying on that invariant.
  return row;
}

/** Back-compat wrapper: gate only, for callers that don't need the row. */
async function requireCoreTeamChapterAdmin(id: string): Promise<void> {
  await loadCoreTeamRowForAdmin(id);
}

function isCoreRole(x: string): x is CoreTeamRole {
  return (CORE_TEAM_ROLES as readonly string[]).includes(x);
}

// ─── ADD MEMBER ─────────────────────────────────────────────────────
export async function addCoreTeamMember(
  input: { chapterId: string; editionId: string },
  formData: FormData
): Promise<ActionResult> {
  // Scope to the chapter the member is being added to — granting core-team is
  // granting chapter-admin rights, so a chair of chapter A must not do it on B.
  await requireChapterAdmin(input.chapterId);
  const full_name = String(formData.get("full_name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim() || null;
  const phone = String(formData.get("phone") ?? "").trim() || null;
  const role = String(formData.get("role") ?? "").trim();

  if (!full_name) return { ok: false, error: "Full name is required." };
  if (!isCoreRole(role)) {
    return {
      ok: false,
      error: "Pick one of the 4 core-team roles.",
    };
  }

  const svc = await createServiceClient();

  // ─── Resolve (or create) the sign-in account ──────────────────────────
  //
  // This used to call svc.auth.admin.listUsers() and scan the result for a
  // matching email. listUsers() returns PAGE ONE — 50 users — and this project
  // has 51,993, so the match essentially never succeeded and the row went in
  // with user_id NULL. getChapterContext() matches core-team rows BY user_id,
  // so that person could never open a single chapter screen — while the chair
  // saw "Core team member added." and a row in the list.
  //
  // Measured before this fix: 74 of 147 active core-team members across 33 of
  // 65 chapters could not sign in. 12 of them had an account that was simply
  // never linked; the rest never had one created, because adding a member
  // never created one.
  //
  // Account resolution lives in lib/yi-future/auth/core-team-login.ts so the
  // repair path (createCoreTeamMemberLogin, below) uses the SAME code. Two
  // divergent account-creation paths is how the listUsers() bug survived.
  let user_id: string | null = null;
  let issuedPassword: string | null = null;

  if (email) {
    const account = await resolveOrCreateSignInAccount(svc, {
      email,
      fullName: full_name,
      role,
    });
    if (account.outcome === "failed") {
      return { ok: false, error: account.error };
    }
    user_id = account.userId;
    if (account.outcome === "created") issuedPassword = account.tempPassword;
  }

  const { error } = await svc
    .schema("future")
    .from("chapter_core_team")
    .insert({
      chapter_id: input.chapterId,
      edition_id: input.editionId,
      full_name,
      email,
      phone,
      role: role as CoreTeamRole,
      user_id,
      is_active: true,
    });
  if (error) return { ok: false, error: error.message };

  revalidatePath("/yi-future/chapter/setup");

  // Say plainly whether this person can actually sign in. The old blanket
  // "Core team member added." was true about the row and wrong about the human.
  if (issuedPassword) {
    return {
      ok: true,
      message: `${full_name} added. Sign-in: ${email} · temporary password ${issuedPassword} — send it to them (email delivery is down) and ask them to change it after first sign-in. This is shown once.`,
    };
  }
  if (user_id) {
    return { ok: true, message: `${full_name} added and linked to their existing ${email} sign-in.` };
  }
  return {
    ok: true,
    message: `${full_name} added, but with no email they cannot be given a sign-in. Add an email to let them use the platform.`,
  };
}

// ─── UPDATE MEMBER ──────────────────────────────────────────────────
export async function updateCoreTeamMember(
  id: string,
  formData: FormData
): Promise<ActionResult> {
  // Scope to the member's OWN chapter — protects chapter B's roster from edits
  // (incl. role escalation) by chapter A's chair.
  await requireCoreTeamChapterAdmin(id);
  const full_name = String(formData.get("full_name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim() || null;
  const phone = String(formData.get("phone") ?? "").trim() || null;
  const role = String(formData.get("role") ?? "").trim();

  if (!full_name) return { ok: false, error: "Full name is required." };
  if (!isCoreRole(role)) {
    return { ok: false, error: "Pick one of the 4 core-team roles." };
  }

  const svc = await createServiceClient();
  const { error } = await svc
    .schema("future")
    .from("chapter_core_team")
    .update({ full_name, email, phone, role: role as CoreTeamRole })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/yi-future/chapter/setup");
  return { ok: true, message: "Updated." };
}

// ─── REMOVE MEMBER ──────────────────────────────────────────────────
export async function removeCoreTeamMember(
  id: string
): Promise<ActionResult> {
  // Scope to the member's OWN chapter — stops a chair of chapter A removing
  // chapter B's core team (the chair-removal guard below is a second layer).
  await requireCoreTeamChapterAdmin(id);
  const svc = await createServiceClient();

  // GUARD (2026-06-20, ref #500): a chapter_chair / chapter_co_chair is a
  // canonical, chapter-wide role synced into yi_directory and shared across
  // every Yi vertical. Removing the chapter_core_team row here orphans that
  // canonical role (and before the DB-trigger fix, cascade-deleted it → a
  // cross-vertical self-lockout). Only the Directory may remove a chair.
  // Refuse explicitly rather than silently "Removing".
  const { data: row } = await svc
    .schema("future")
    .from("chapter_core_team")
    .select("role")
    .eq("id", id)
    .maybeSingle();
  // Cast: the generated `user_role` enum type lags the live DB, which carries
  // chapter_chair / chapter_co_chair on this table (see yi_directory sync).
  const role = (row?.role ?? "") as string;
  if (role === "chapter_chair" || role === "chapter_co_chair") {
    return {
      ok: false,
      error:
        "Chapter chairs are managed in the Directory and can't be removed from the team screen.",
    };
  }

  const { error } = await svc
    .schema("future")
    .from("chapter_core_team")
    .delete()
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/yi-future/chapter/setup");
  return { ok: true, message: "Removed." };
}

// ─── CREATE / REPAIR A MEMBER'S SIGN-IN ─────────────────────────────
/**
 * Give an EXISTING core-team member a way to sign in, without changing anything
 * else about them.
 *
 * The gap this closes: `addCoreTeamMember` creates an account for members added
 * from now on, but there was no path at all to repair a row that already exists
 * with `user_id` NULL. Every chapter gate matches core-team rows BY `user_id`,
 * so such a person is on the roster and cannot open a single chapter screen. The
 * only remedy was a hand-run script — which is what actually happened, the day
 * before one chapter's finale.
 *
 * "Remove and re-add" is NOT a substitute: the add-member form can only express
 * the 4 operational roles, so re-adding a chapter chair silently DEMOTES them.
 * This action therefore never writes `role`.
 *
 * Three outcomes, all idempotent and safe to retry:
 *   - an account already exists for the email → LINK it (no new account, no
 *     password change: the account may be in daily use in another vertical);
 *   - no account → create one and return a one-time password to display;
 *   - no email anywhere → change NOTHING and say so.
 */
export async function createCoreTeamMemberLogin(input: {
  id: string;
  /** Only used when the row has no email on file. Never overwrites one. */
  email?: string | null;
  /** Explicit opt-in: replace the account's password with a fresh one. */
  resetPassword?: boolean;
}): Promise<CreateLoginResult> {
  const id = String(input?.id ?? "").trim();
  if (!id) {
    return { ok: false, kind: "error", error: "No member specified." };
  }

  // AUTHZ FIRST, scoped to the member's OWN chapter. Granting a sign-in that
  // resolves to a core-team row is granting chapter-admin rights, so a chair of
  // chapter A must not be able to mint one on chapter B. Fails closed (unknown
  // row → null chapter → deny) and denies explicitly via /yi-future/forbidden.
  const row = await loadCoreTeamRowForAdmin(id);
  if (!row) {
    return {
      ok: false,
      kind: "error",
      error: "That core-team member no longer exists. Reload the page.",
    };
  }

  const svc = await createServiceClient();
  const fullName = (row.full_name ?? "").trim() || "This member";

  // ─── 1. Establish an email address ──────────────────────────────────
  // Roster row first, then the canonical directory (the setup screen displays
  // the directory value when there is one, so ignoring it would make the "no
  // email" message contradict what the admin is looking at), then whatever the
  // admin just typed.
  const rosterEmail = normaliseEmail(row.email);
  const directoryHasEmail = !rosterEmail && row.person_id
    ? normaliseEmail(await directoryEmail(svc, row.person_id))
    : "";
  const email =
    rosterEmail || directoryHasEmail || normaliseEmail(input?.email);

  // ─── 2. Already linked? ─────────────────────────────────────────────
  // Handled BEFORE the email requirement below: replacing the password of an
  // account that already exists needs only its user id. This is the designated
  // recovery step after a half-failure, so it must not be blocked by a missing
  // address on the roster row.
  if (row.user_id) {
    const forEmail = email ? ` (${email})` : "";
    if (!input?.resetPassword) {
      return {
        ok: true,
        kind: "already",
        email,
        message: `${fullName} is already linked to a sign-in${forEmail} — nothing to repair. Use "Issue a new password" if they cannot get in.`,
      };
    }
    const reset = await resetSignInPassword(svc, row.user_id);
    if (!reset.ok) {
      return { ok: false, kind: "error", error: reset.error };
    }
    return {
      ok: true,
      kind: "reset",
      email,
      tempPassword: reset.tempPassword,
      message: `New temporary password for ${fullName}${forEmail} — their previous password no longer works. Send this to them and ask them to change it after signing in. Shown once; it cannot be retrieved.`,
    };
  }

  if (!email) {
    // Requirement: do NOTHING and explain. An auth account cannot exist without
    // an email address, and inventing one would create an account nobody can
    // ever receive a reset for.
    return {
      ok: false,
      kind: "no_email",
      error: `${fullName} has no email address on record, so there is nothing to create a sign-in from — an account needs an email. Collect their email, type it in the box above and press Create login again. Nothing has been changed, and their role is not affected.`,
    };
  }

  // ─── 3. Make sure the ROSTER ROW carries that address ────────────────
  // Not cosmetic. The directory sync trigger below resolves the person with
  // `SELECT id FROM yi_directory.people WHERE email = NEW.email`; if the roster
  // row's email is NULL that lookup misses, the fallback lookup by user_id also
  // misses (the auth account is brand new), and the trigger INSERTS A SECOND
  // person for the same human and repoints the row at it — orphaning the
  // original directory identity. Writing the directory FIRST (it is the mother
  // source) makes that lookup hit the person who already exists.
  let emailJustSaved = false;
  if (!rosterEmail) {
    if (row.person_id && !directoryHasEmail) {
      // `yi_directory.people.email` is UNIQUE. If the address already belongs to
      // a directory person, leave it there and let the trigger link this row to
      // them — that is the correct merge, and copying it would violate the
      // constraint anyway.
      const owner = await directoryPersonIdByEmail(svc, email);
      if (!owner) {
        const dirErr = await setDirectoryEmail(svc, row.person_id, email);
        if (dirErr) {
          return {
            ok: false,
            kind: "error",
            error: `Could not record ${email} in the central Yi directory: ${dirErr}. Nothing else was changed — check the address is not already in use by someone else.`,
          };
        }
      }
    }

    // Writes `email` ONLY. `role` is deliberately absent from this patch so a
    // repair can never demote a chair.
    const { error } = await svc
      .schema("future")
      .from("chapter_core_team")
      .update({ email })
      .eq("id", id);
    if (error) {
      return {
        ok: false,
        kind: "error",
        error: `Could not save that email address: ${error.message}. Nothing else was changed.`,
      };
    }
    emailJustSaved = true;
  }

  // ─── 4. Resolve or create the account (shared with addCoreTeamMember) ──
  const account = await resolveOrCreateSignInAccount(svc, {
    email,
    fullName,
    role: String(row.role ?? ""),
  });
  if (account.outcome === "failed") {
    // Partial progress, stated plainly: the email we were handed IS saved, so a
    // retry needs no re-typing and cannot double up.
    const saved = emailJustSaved
      ? ` The email ${email} has been saved against them, so pressing Create login again retries just the account step.`
      : "";
    return { ok: false, kind: "error", error: `${account.error}${saved}` };
  }

  // ─── 5. Link the roster row. `user_id` ONLY — never role/is_active ────
  const { error: linkErr } = await svc
    .schema("future")
    .from("chapter_core_team")
    .update({ user_id: account.userId })
    .eq("id", id);

  if (linkErr) {
    // THE WORST CASE, named explicitly: an account now exists (possibly created
    // a moment ago) but the roster row is still unlinked, so the person still
    // cannot get in. A retry is SAFE and is the fix — the shared resolver looks
    // the account up by email first and takes the LINK branch, so no duplicate
    // account can be created. The freshly generated password is deliberately
    // NOT shown here: it opens an account that reaches nothing until the link
    // lands, and handing it over now would just produce a second confused
    // person. Link first, then issue a password.
    return {
      ok: false,
      kind: "error",
      error: `A sign-in account for ${email} is ready, but linking it to the roster failed: ${linkErr.message}. Press Create login again — it re-uses that same account instead of creating a second one — then use "Issue a new password" to get a credential you can send.`,
    };
  }

  // ─── 6. VERIFY the directory link rather than assuming it ─────────────
  // A BEFORE INSERT/UPDATE trigger (yi_directory.sync_from_chapter_core_team)
  // mirrors this row into the canonical directory: it resolves the person by
  // email then by user_id, stamps `chapter_core_team.person_id`, copies
  // `user_id` onto `yi_directory.people`, and re-upserts the role assignment
  // with the row's UNCHANGED role. Verify that actually happened instead of
  // trusting it, and report a mismatch rather than declaring success.
  const verified = await verifyDirectoryLink(svc, id, account.userId);

  revalidatePath("/yi-future/chapter/setup");

  const warning = verified
    ? ""
    : ` Note: they can sign in, but the central Yi directory did not pick up the link — tell the Yi Future national team so it can be reconciled.`;

  if (account.outcome === "created") {
    return {
      ok: true,
      kind: "created",
      email,
      tempPassword: account.tempPassword,
      message: `Sign-in created for ${fullName}. Username ${email}. Send them the password below — email delivery is unreliable, so pass it on directly — and ask them to change it after signing in. Shown once; it cannot be retrieved.${warning}`,
    };
  }
  return {
    ok: true,
    kind: "linked",
    email,
    message: `${fullName} already had an account for ${email}; it is now linked to this chapter. No new account was created and their password was NOT changed — they sign in with the password they already use. If they don't know it, use "Issue a new password".${warning}`,
  };
}

/** Canonical email from yi_directory.people — the schema isn't in the generated types. */
async function directoryEmail(
  svc: Awaited<ReturnType<typeof createServiceClient>>,
  personId: string
): Promise<string | null> {
  const dir = svc as unknown as LooseSchemaClient;
  const { data } = await dir
    .schema("yi_directory")
    .from("people")
    .select("email")
    .eq("id", personId)
    .maybeSingle();
  return (data as { email: string | null } | null)?.email ?? null;
}

/** Who, if anyone, already owns this address in the directory (email is UNIQUE). */
async function directoryPersonIdByEmail(
  svc: Awaited<ReturnType<typeof createServiceClient>>,
  email: string
): Promise<string | null> {
  const dir = svc as unknown as LooseSchemaClient;
  const { data } = await dir
    .schema("yi_directory")
    .from("people")
    .select("id")
    .eq("email", email)
    .maybeSingle();
  return (data as { id: string } | null)?.id ?? null;
}

/** Record an address on an existing directory person. Returns an error message, or null. */
async function setDirectoryEmail(
  svc: Awaited<ReturnType<typeof createServiceClient>>,
  personId: string,
  email: string
): Promise<string | null> {
  const dir = svc as unknown as LooseSchemaClient;
  const { error } = await dir
    .schema("yi_directory")
    .from("people")
    .update({ email })
    .eq("id", personId);
  return error?.message ?? null;
}

/**
 * Read back what the directory sync trigger actually did with our write: the
 * roster row should now carry a person_id, and that person should carry our
 * user_id. Never throws — a verification failure downgrades the success message,
 * it does not undo a link that works.
 */
async function verifyDirectoryLink(
  svc: Awaited<ReturnType<typeof createServiceClient>>,
  rowId: string,
  userId: string
): Promise<boolean> {
  try {
    const { data: after } = await svc
      .schema("future")
      .from("chapter_core_team")
      .select("person_id, user_id")
      .eq("id", rowId)
      .maybeSingle();
    const state = (after as unknown as {
      person_id: string | null;
      user_id: string | null;
    } | null) ?? null;
    if (state?.user_id !== userId) return false;
    if (!state?.person_id) return false;

    const dir = svc as unknown as LooseSchemaClient;
    const { data: person } = await dir
      .schema("yi_directory")
      .from("people")
      .select("user_id")
      .eq("id", state.person_id)
      .maybeSingle();
    return (person as { user_id: string | null } | null)?.user_id === userId;
  } catch {
    return false;
  }
}
