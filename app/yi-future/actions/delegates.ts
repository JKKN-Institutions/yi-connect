"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient, createServiceClient } from "@/lib/yi-future/supabase/server";
import { generateAccessCode } from "@/lib/yi-future/access-code";
import type { ActionResult } from "./editions";

async function requireAuth(): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/yi-future/login");
}

async function uniqueAccessCode(
  svc: Awaited<ReturnType<typeof createServiceClient>>
): Promise<string> {
  for (let i = 0; i < 25; i++) {
    const code = generateAccessCode();
    const { data } = await svc
      .schema("future")
      .from("delegates")
      .select("id")
      .eq("access_code", code)
      .maybeSingle();
    if (!data) return code;
  }
  throw new Error("Could not allocate a unique access code after 25 tries.");
}

// ─── CREATE DELEGATE ────────────────────────────────────────────────
export async function createDelegate(
  input: { chapterId: string; editionId: string },
  formData: FormData
): Promise<ActionResult> {
  await requireAuth();
  const full_name = String(formData.get("full_name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim() || null;
  const phone = String(formData.get("phone") ?? "").trim() || null;
  const age_raw = String(formData.get("age") ?? "").trim();
  const age = age_raw ? Number(age_raw) : null;
  const course = String(formData.get("course") ?? "").trim() || null;
  const year_raw = String(formData.get("year_of_study") ?? "").trim();
  const year_of_study = year_raw ? Number(year_raw) : null;
  const college_id = String(formData.get("college_id") ?? "").trim() || null;
  const home_state = String(formData.get("home_state") ?? "").trim() || null;

  if (!full_name) return { ok: false, error: "Full name is required." };

  const svc = await createServiceClient();
  const access_code = await uniqueAccessCode(svc);

  const { error } = await svc
    .schema("future")
    .from("delegates")
    .insert({
      chapter_id: input.chapterId,
      edition_id: input.editionId,
      full_name,
      email,
      phone,
      age,
      course,
      year_of_study,
      college_id,
      home_state,
      access_code,
      is_active: true,
    });
  if (error) return { ok: false, error: error.message };

  // Create Supabase Auth account (email-only, no password — admin can set later)
  if (email) {
    const { data: authData } = await svc.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: { full_name, role: "delegate" },
    });
    // Ignore errors — auth account is optional for admin-created delegates

    // Upsert yi_directory.people — cross-app identity bridge
    await svc
      .schema("yi_directory")
      .from("people")
      .upsert(
        {
          user_id: authData?.user?.id ?? null,
          full_name,
          email,
          phone: phone || null,
          is_active: true,
        } as never,
        { onConflict: "email" }
      );
  }

  revalidatePath("/yi-future/chapter/delegates");
  revalidatePath("/yi-future/chapter/teams");
  redirect("/yi-future/chapter/delegates");
}

// ─── UPDATE DELEGATE ────────────────────────────────────────────────
export async function updateDelegate(
  id: string,
  formData: FormData
): Promise<ActionResult> {
  await requireAuth();
  const full_name = String(formData.get("full_name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim() || null;
  const phone = String(formData.get("phone") ?? "").trim() || null;
  const age_raw = String(formData.get("age") ?? "").trim();
  const age = age_raw ? Number(age_raw) : null;
  const course = String(formData.get("course") ?? "").trim() || null;
  const year_raw = String(formData.get("year_of_study") ?? "").trim();
  const year_of_study = year_raw ? Number(year_raw) : null;
  const college_id = String(formData.get("college_id") ?? "").trim() || null;
  const home_state = String(formData.get("home_state") ?? "").trim() || null;

  if (!full_name) return { ok: false, error: "Full name is required." };

  const svc = await createServiceClient();
  const { error } = await svc
    .schema("future")
    .from("delegates")
    .update({
      full_name,
      email,
      phone,
      age,
      course,
      year_of_study,
      college_id,
      home_state,
    })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/yi-future/chapter/delegates");
  redirect("/yi-future/chapter/delegates");
}

// ─── REGENERATE ACCESS CODE ─────────────────────────────────────────
export async function regenerateAccessCode(id: string): Promise<ActionResult> {
  await requireAuth();
  const svc = await createServiceClient();
  const access_code = await uniqueAccessCode(svc);
  const { error } = await svc
    .schema("future")
    .from("delegates")
    .update({ access_code })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/yi-future/chapter/delegates");
  return { ok: true, message: `New code: ${access_code}` };
}

// ─── DELETE DELEGATE ────────────────────────────────────────────────
export async function deleteDelegate(id: string): Promise<ActionResult> {
  await requireAuth();
  const svc = await createServiceClient();
  // Guard: don't delete if on a team (FK has cascade but we'd rather ask the admin to remove first)
  const { count } = await svc
    .schema("future")
    .from("team_members")
    .select("delegate_id", { count: "exact", head: true })
    .eq("delegate_id", id);
  if ((count ?? 0) > 0) {
    return {
      ok: false,
      error: "This delegate is on a team. Remove them from the team first.",
    };
  }
  const { error } = await svc
    .schema("future")
    .from("delegates")
    .delete()
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/yi-future/chapter/delegates");
  return { ok: true, message: "Delegate removed." };
}
