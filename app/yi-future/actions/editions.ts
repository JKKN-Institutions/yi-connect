"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient, createServiceClient } from "@/lib/yi-future/supabase/server";
import { requirePlatformAdmin } from "./national-admins";
import type { Database } from "@/types/yi-future/database";

type EditionStage = Database["future"]["Enums"]["edition_stage"];

export type ActionResult =
  | { ok: true; message?: string }
  | { ok: false; error: string };

async function requireAdmin(): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/yi-future/login");
}

// ─── CREATE ─────────────────────────────────────────────────────────
export async function createEdition(formData: FormData): Promise<ActionResult> {
  await requireAdmin();
  await requirePlatformAdmin();
  const slug = String(formData.get("slug") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const tagline = String(formData.get("tagline") ?? "").trim() || null;
  const kickoff_date =
    String(formData.get("kickoff_date") ?? "").trim() || null;

  if (!/^\d{4}$/.test(slug)) {
    return { ok: false, error: "Slug must be a 4-digit year (e.g. 2027)." };
  }
  if (!name) return { ok: false, error: "Name is required." };

  const svc = await createServiceClient();
  const { error } = await svc
    .schema("future")
    .from("editions")
    .insert({
      slug,
      name,
      tagline,
      kickoff_date,
      current_stage: "announcement" as EditionStage,
      is_active: false,
    });
  if (error) return { ok: false, error: error.message };

  revalidatePath("/national/admin/editions");
  redirect("/yi-future/national/admin/editions");
}

// ─── UPDATE ─────────────────────────────────────────────────────────
export async function updateEdition(
  id: string,
  formData: FormData
): Promise<ActionResult> {
  await requireAdmin();
  await requirePlatformAdmin();
  const name = String(formData.get("name") ?? "").trim();
  const tagline = String(formData.get("tagline") ?? "").trim() || null;
  const kickoff_date =
    String(formData.get("kickoff_date") ?? "").trim() || null;
  const chapter_final_window_start =
    String(formData.get("chapter_final_window_start") ?? "").trim() || null;
  const chapter_final_window_end =
    String(formData.get("chapter_final_window_end") ?? "").trim() || null;
  const national_finals_window_start =
    String(formData.get("national_finals_window_start") ?? "").trim() || null;
  const national_finals_window_end =
    String(formData.get("national_finals_window_end") ?? "").trim() || null;
  const finaleVisibilityRaw = String(
    formData.get("finale_visibility_cutoff") ?? ""
  ).trim();
  // datetime-local → ISO; empty string clears the field.
  const finale_visibility_cutoff = finaleVisibilityRaw
    ? new Date(finaleVisibilityRaw).toISOString()
    : null;

  if (!name) return { ok: false, error: "Name is required." };

  const svc = await createServiceClient();
  const { error } = await svc
    .schema("future")
    .from("editions")
    .update({
      name,
      tagline,
      kickoff_date,
      chapter_final_window_start,
      chapter_final_window_end,
      national_finals_window_start,
      national_finals_window_end,
      finale_visibility_cutoff,
      updated_at: new Date().toISOString(),
    } as never)
    .eq("id", id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/national/admin/editions");
  redirect("/yi-future/national/admin/editions");
}

// ─── SET ACTIVE (only one at a time) ────────────────────────────────
export async function setActiveEdition(id: string): Promise<ActionResult> {
  await requireAdmin();
  await requirePlatformAdmin();
  const svc = await createServiceClient();

  // Deactivate all then activate target
  const { error: e1 } = await svc
    .schema("future")
    .from("editions")
    .update({ is_active: false })
    .neq("id", "00000000-0000-0000-0000-000000000000");
  if (e1) return { ok: false, error: e1.message };

  const { error: e2 } = await svc
    .schema("future")
    .from("editions")
    .update({ is_active: true })
    .eq("id", id);
  if (e2) return { ok: false, error: e2.message };

  revalidatePath("/national/admin/editions");
  return { ok: true, message: "Edition activated." };
}

// ─── SET STAGE ──────────────────────────────────────────────────────
export async function setEditionStage(
  id: string,
  stage: EditionStage
): Promise<ActionResult> {
  await requireAdmin();
  await requirePlatformAdmin();
  const svc = await createServiceClient();
  const { error } = await svc
    .schema("future")
    .from("editions")
    .update({ current_stage: stage, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };

  // Write audit log row
  await svc
    .schema("future")
    .from("edition_stage_log")
    .insert({ edition_id: id, to_stage: stage });

  revalidatePath("/national/admin/editions");
  return { ok: true, message: `Stage set to ${stage}.` };
}
