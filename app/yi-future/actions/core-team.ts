"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient, createServiceClient } from "@/lib/yi-future/supabase/server";
import type { Database } from "@/types/yi-future/database";
import type { ActionResult } from "./editions";
import { CORE_TEAM_ROLES } from "@/lib/yi-future/constants";
import { generateAccessCode } from "@/lib/yi-future/access-code";
import { requireChapterAdmin } from "@/lib/yi-future/auth/require-access";

type CoreTeamRole = Database["future"]["Enums"]["user_role"];

/**
 * Chapter-scoped gate for core-team membership — the highest-privilege table in
 * Yi Future, because a row here IS what makes someone a chapter admin. Without
 * this, a chair of chapter A could grant themselves core-team on chapter B, or
 * remove chapter B's chair. Looks up the target row's chapter, then requires
 * admin of THAT chapter (or national). Fails closed: a row with no chapter
 * resolves to null → deny.
 */
async function requireCoreTeamChapterAdmin(id: string): Promise<void> {
  const svc = await createServiceClient();
  const { data } = await svc
    .schema("future")
    .from("chapter_core_team")
    .select("chapter_id")
    .eq("id", id)
    .maybeSingle();
  await requireChapterAdmin(
    (data as { chapter_id: string | null } | null)?.chapter_id ?? null
  );
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
  let user_id: string | null = null;
  let issuedPassword: string | null = null;

  if (email) {
    // Targeted lookup instead of a paged scan.
    const { data: foundId } = await svc.rpc(
      "yi_directory_auth_user_id_by_email" as never,
      { p_email: email } as never
    );
    user_id = (foundId as string | null) ?? null;

    if (!user_id) {
      // No account exists. Create one, rather than inserting a row that looks
      // fine and silently cannot log in.
      //
      // The credential is RETURNED to the chair rather than emailed: Resend is
      // over quota and ~98% of Yi-Future mail is failing, so an invite email
      // would simply never arrive. This mirrors how the platform already hands
      // out delegate and jury access codes — shown on screen, passed on by
      // WhatsApp. email_confirm is set because there is no working inbox to
      // confirm through.
      const temp = generateAccessCode() + generateAccessCode();
      const { data: created, error: authErr } = await svc.auth.admin.createUser({
        email,
        password: temp,
        email_confirm: true,
        user_metadata: { full_name, role },
      });
      if (authErr) {
        return {
          ok: false,
          error: `Could not create a sign-in account for ${email}: ${authErr.message}`,
        };
      }
      user_id = created?.user?.id ?? null;
      issuedPassword = temp;
    }
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
