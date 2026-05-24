"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient, createServiceClient } from "@/lib/yi-future/supabase/server";
import type { Database } from "@/types/yi-future/database";
import type { ActionResult } from "./editions";
import { CORE_TEAM_ROLES } from "@/lib/yi-future/constants";

type CoreTeamRole = Database["future"]["Enums"]["user_role"];

async function requireAuth(): Promise<string> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/yi-future/login");
  return user.id;
}

function isCoreRole(x: string): x is CoreTeamRole {
  return (CORE_TEAM_ROLES as readonly string[]).includes(x);
}

// ─── ADD MEMBER ─────────────────────────────────────────────────────
export async function addCoreTeamMember(
  input: { chapterId: string; editionId: string },
  formData: FormData
): Promise<ActionResult> {
  await requireAuth();
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

  // Optional: link to auth user if email matches
  let user_id: string | null = null;
  if (email) {
    const { data: existing } = await svc.auth.admin.listUsers();
    const match = existing.users.find((u) => u.email === email);
    user_id = match?.id ?? null;
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
  return { ok: true, message: "Core team member added." };
}

// ─── UPDATE MEMBER ──────────────────────────────────────────────────
export async function updateCoreTeamMember(
  id: string,
  formData: FormData
): Promise<ActionResult> {
  await requireAuth();
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
  await requireAuth();
  const svc = await createServiceClient();
  const { error } = await svc
    .schema("future")
    .from("chapter_core_team")
    .delete()
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/yi-future/chapter/setup");
  return { ok: true, message: "Removed." };
}
