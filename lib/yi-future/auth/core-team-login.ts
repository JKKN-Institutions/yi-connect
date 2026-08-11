/**
 * Sign-in account resolution for Yi Future core-team members.
 *
 * WHY THIS FILE EXISTS
 * --------------------
 * A row in `future.chapter_core_team` is what makes someone a chapter admin, and
 * every chapter gate matches that row BY `user_id`. A row with `user_id` NULL is
 * therefore a person who is visibly on the roster and cannot open a single
 * chapter screen — no error, no clue, just /forbidden.
 *
 * `addCoreTeamMember` was fixed to create the account at the moment a member is
 * added. But nothing could repair a row that ALREADY existed, so the only
 * remedy for an already-broken member was a hand-run script. This module holds
 * the account-resolution logic so the add path and the repair path share ONE
 * implementation — a second, divergent account-creation path is exactly how the
 * original bug (a paged `listUsers()` scan that silently never matched) survived
 * as long as it did.
 *
 * It is a plain module, NOT a `"use server"` file: a `"use server"` file may
 * export only async functions, so the types below would break the build there.
 *
 * NOTHING HERE TOUCHES A MEMBER'S ROLE. Repairing access must never change a
 * person's standing — the add-member form can only express the 4 operational
 * roles, so "remove and re-add" silently demotes a chapter chair. That is the
 * trap this module exists to avoid.
 */
import type { createServiceClient } from "@/lib/yi-future/supabase/server";
import { generateAccessCode } from "@/lib/yi-future/access-code";

/** The RLS-bypassing service client used by every Yi Future admin action. */
export type FutureServiceClient = Awaited<ReturnType<typeof createServiceClient>>;

/**
 * Outcome of resolving a sign-in account for an email address.
 *
 * `linked` means an auth account for that email ALREADY existed and must be
 * re-used — creating a second account for the same human is the failure mode
 * this distinction exists to prevent. No password is issued on that path,
 * because the account may be in daily use and silently resetting a working
 * password would lock the person out of every other Yi vertical.
 */
export type SignInAccount =
  | { outcome: "linked"; userId: string }
  | { outcome: "created"; userId: string; tempPassword: string }
  | { outcome: "failed"; error: string };

/** Result of the per-member "create login" repair action. */
export type CreateLoginResult =
  | {
      ok: true;
      kind: "created" | "reset";
      message: string;
      email: string;
      /** Shown ON SCREEN once. Never emailed, never logged, never in a URL. */
      tempPassword: string;
    }
  | { ok: true; kind: "linked" | "already"; message: string; email: string }
  | { ok: false; kind: "no_email" | "error"; error: string };

/**
 * 12 characters from a 32-symbol alphabet with the ambiguous glyphs (0/O/1/I)
 * already removed — it gets read aloud and retyped on a phone.
 */
function newTemporaryPassword(): string {
  return generateAccessCode() + generateAccessCode();
}

/** Auth emails are case-insensitive; the directory sync trigger matches exactly. */
export function normaliseEmail(value: string | null | undefined): string {
  return String(value ?? "").trim().toLowerCase();
}

/**
 * Find the auth account for an email, or create one.
 *
 * Lookup is a targeted RPC (`future.yi_directory_auth_user_id_by_email`, a
 * case-insensitive `select id from auth.users`), NOT `auth.admin.listUsers()`.
 * listUsers() returns page one — 50 users — against ~52,000, so the original
 * scan essentially never matched and rows went in unlinked.
 *
 * The credential is RETURNED to the caller to display rather than emailed:
 * transactional mail for this platform is over quota and almost all of it fails,
 * so an invite email would simply never arrive. `email_confirm` is set for the
 * same reason — there is no working inbox to confirm through.
 */
export async function resolveOrCreateSignInAccount(
  svc: FutureServiceClient,
  input: { email: string; fullName: string; role: string }
): Promise<SignInAccount> {
  const email = normaliseEmail(input.email);
  if (!email) {
    return {
      outcome: "failed",
      error: "An email address is required to create a sign-in account.",
    };
  }

  const existing = await findAuthUserIdByEmail(svc, email);
  if (existing.error) {
    return {
      outcome: "failed",
      error: `Could not check whether ${email} already has an account: ${existing.error}`,
    };
  }
  // An account already exists — LINK it. Never mint a duplicate for the same
  // human, and never touch the password on this path.
  if (existing.userId) return { outcome: "linked", userId: existing.userId };

  const tempPassword = newTemporaryPassword();
  const { data: created, error: authErr } = await svc.auth.admin.createUser({
    email,
    password: tempPassword,
    email_confirm: true,
    user_metadata: { full_name: input.fullName, role: input.role },
  });

  if (authErr) {
    // RETRY SAFETY. The most likely cause is that a PREVIOUS attempt created
    // the account and then failed before linking it (or two admins clicked at
    // once), so auth now rejects the duplicate email. Re-check and fall through
    // to LINK instead of dead-ending on "already been registered", which reads
    // as a hard failure to an admin who has no idea an orphan account exists.
    const recovered = await findAuthUserIdByEmail(svc, email);
    if (recovered.userId) return { outcome: "linked", userId: recovered.userId };
    return {
      outcome: "failed",
      error: `Could not create a sign-in account for ${email}: ${authErr.message}`,
    };
  }

  const userId = created?.user?.id ?? null;
  if (!userId) {
    return {
      outcome: "failed",
      error: `Auth accepted the new account for ${email} but returned no user id. Try again — an existing account will be re-used, not duplicated.`,
    };
  }
  return { outcome: "created", userId, tempPassword };
}

/**
 * Replace an existing account's password with a fresh one-time password.
 *
 * Deliberately NOT part of the link path: an account found by email may be in
 * daily use across other Yi verticals. Only an admin who explicitly asks for a
 * new credential gets one. This is also the recovery step after a half-failure
 * where an account was created but the roster link did not land — the original
 * password was never stored anywhere, so it is gone.
 */
export async function resetSignInPassword(
  svc: FutureServiceClient,
  userId: string
): Promise<{ ok: true; tempPassword: string } | { ok: false; error: string }> {
  const tempPassword = newTemporaryPassword();
  const { error } = await svc.auth.admin.updateUserById(userId, {
    password: tempPassword,
    email_confirm: true,
  });
  if (error) {
    return { ok: false, error: `Could not set a new password: ${error.message}` };
  }
  return { ok: true, tempPassword };
}

async function findAuthUserIdByEmail(
  svc: FutureServiceClient,
  email: string
): Promise<{ userId: string | null; error: string | null }> {
  const { data, error } = await svc.rpc(
    "yi_directory_auth_user_id_by_email" as never,
    { p_email: email } as never
  );
  if (error) return { userId: null, error: error.message };
  return { userId: (data as string | null) ?? null, error: null };
}
