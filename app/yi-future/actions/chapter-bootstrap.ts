"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient, createServiceClient } from "@/lib/yi-future/supabase/server";
import { requireFutureNationalAdmin } from "@/lib/yi-future/auth/require-access";
import { CORE_TEAM_ROLES } from "@/lib/yi-future/constants";
import type { Database } from "@/types/yi-future/database";
import type { ActionResult } from "./editions";

type CoreTeamRole = Database["future"]["Enums"]["user_role"];

function isCoreRole(x: string): x is CoreTeamRole {
  return (CORE_TEAM_ROLES as readonly string[]).includes(x);
}

/**
 * Self-link the currently signed-in Supabase Auth user to a chapter on the
 * active edition's chapter_core_team. Bootstrap helper so that a new Yi
 * National / super-admin can get out of the "no chapter assigned" dead-end
 * without manual SQL.
 */
export async function linkSelfToChapter(input: {
  chapterId: string;
  role: CoreTeamRole;
}): Promise<ActionResult> {
  // 1. NATIONAL-ONLY. This self-inserts the caller into chapter_core_team —
  // i.e. it GRANTS chapter-admin rights. Login-only here was a privilege
  // escalation: any delegate could make themselves a chapter_chair and then
  // pass every other Future admin gate. Only national admins may bootstrap.
  await requireFutureNationalAdmin();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/yi-future/login");

  if (!input.chapterId) {
    return { ok: false, error: "Pick a chapter." };
  }
  if (!isCoreRole(input.role)) {
    return { ok: false, error: "Pick one of the 4 core-team roles." };
  }

  const svc = await createServiceClient();

  // 2. Resolve the active edition
  const { data: edition, error: edErr } = await svc
    .schema("future")
    .from("editions")
    .select("id")
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();
  if (edErr) return { ok: false, error: edErr.message };
  if (!edition) {
    return {
      ok: false,
      error:
        "No active edition. Ask a Yi National admin to activate an edition first.",
    };
  }
  const editionId = (edition as unknown as { id: string }).id;

  // 3. Already linked? idempotent success.
  const { data: existing } = await svc
    .schema("future")
    .from("chapter_core_team")
    .select("id, is_active")
    .eq("user_id", user.id)
    .eq("chapter_id", input.chapterId)
    .eq("edition_id", editionId)
    .limit(1)
    .maybeSingle();

  if (existing) {
    const row = existing as unknown as { id: string; is_active: boolean };
    // If row exists but is deactivated, reactivate it with the new role.
    if (!row.is_active) {
      const { error: upErr } = await svc
        .schema("future")
        .from("chapter_core_team")
        .update({ is_active: true, role: input.role })
        .eq("id", row.id);
      if (upErr) return { ok: false, error: upErr.message };
    }
    revalidatePath("/yi-future/chapter");
    return { ok: true, message: "Already linked." };
  }

  // 4. Insert new core-team membership
  const { error: insErr } = await svc
    .schema("future")
    .from("chapter_core_team")
    .insert({
      chapter_id: input.chapterId,
      edition_id: editionId,
      user_id: user.id,
      role: input.role,
      full_name: user.email ?? "Yi National Admin",
      email: user.email ?? null,
      is_active: true,
    });
  if (insErr) return { ok: false, error: insErr.message };

  revalidatePath("/yi-future/chapter");
  return { ok: true, message: "Linked. Refreshing…" };
}
