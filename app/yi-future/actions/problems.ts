"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient, createServiceClient } from "@/lib/yi-future/supabase/server";
import { requirePlatformAdmin } from "./national-admins";
import type { ActionResult } from "./editions";

async function requireAdmin(): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/yi-future/login");
}

function parseSdg(raw: string): string[] {
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => (s.startsWith("SDG") ? s : `SDG ${s}`));
}

// ─── CREATE ─────────────────────────────────────────────────────────
export async function createProblem(
  trackId: string,
  formData: FormData
): Promise<ActionResult> {
  await requireAdmin();
  await requirePlatformAdmin();
  const title = String(formData.get("title") ?? "").trim();
  const short_description = String(
    formData.get("short_description") ?? ""
  ).trim();
  const full_description =
    String(formData.get("full_description") ?? "").trim() || null;
  const national_priority_context =
    String(formData.get("national_priority_context") ?? "").trim() || null;
  const sdg_raw = String(formData.get("sdg_alignment") ?? "").trim();
  const sdg_alignment = sdg_raw ? parseSdg(sdg_raw) : null;
  const display_order_raw = String(formData.get("display_order") ?? "").trim();
  const display_order = display_order_raw ? Number(display_order_raw) : null;

  if (!title) return { ok: false, error: "Title is required." };
  if (!short_description)
    return { ok: false, error: "Short description is required." };

  const svc = await createServiceClient();
  const { error } = await svc
    .schema("future")
    .from("problem_statements")
    .insert({
      track_id: trackId,
      title,
      short_description,
      full_description,
      national_priority_context,
      sdg_alignment,
      display_order,
      is_active: true,
    });
  if (error) return { ok: false, error: error.message };

  revalidatePath("/national/admin/problems");
  redirect(`/national/admin/problems?track=${trackId}`);
}

// ─── UPDATE ─────────────────────────────────────────────────────────
export async function updateProblem(
  id: string,
  trackId: string,
  formData: FormData
): Promise<ActionResult> {
  await requireAdmin();
  await requirePlatformAdmin();
  const title = String(formData.get("title") ?? "").trim();
  const short_description = String(
    formData.get("short_description") ?? ""
  ).trim();
  const full_description =
    String(formData.get("full_description") ?? "").trim() || null;
  const national_priority_context =
    String(formData.get("national_priority_context") ?? "").trim() || null;
  const sdg_raw = String(formData.get("sdg_alignment") ?? "").trim();
  const sdg_alignment = sdg_raw ? parseSdg(sdg_raw) : null;
  const display_order_raw = String(formData.get("display_order") ?? "").trim();
  const display_order = display_order_raw ? Number(display_order_raw) : null;

  if (!title) return { ok: false, error: "Title is required." };
  if (!short_description)
    return { ok: false, error: "Short description is required." };

  const svc = await createServiceClient();
  const { error } = await svc
    .schema("future")
    .from("problem_statements")
    .update({
      title,
      short_description,
      full_description,
      national_priority_context,
      sdg_alignment,
      display_order,
    })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/national/admin/problems");
  redirect(`/national/admin/problems?track=${trackId}`);
}

// ─── TOGGLE ACTIVE ──────────────────────────────────────────────────
export async function toggleProblemActive(
  id: string,
  nextActive: boolean
): Promise<ActionResult> {
  await requireAdmin();
  await requirePlatformAdmin();
  const svc = await createServiceClient();
  const { error } = await svc
    .schema("future")
    .from("problem_statements")
    .update({ is_active: nextActive })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/national/admin/problems");
  return { ok: true };
}

// ─── DELETE ─────────────────────────────────────────────────────────
export async function deleteProblem(id: string): Promise<ActionResult> {
  await requireAdmin();
  await requirePlatformAdmin();
  const svc = await createServiceClient();

  // Guard: don't allow if any teams picked this problem
  const { count } = await svc
    .schema("future")
    .from("teams")
    .select("id", { count: "exact", head: true })
    .eq("problem_statement_id", id);

  if ((count ?? 0) > 0) {
    return {
      ok: false,
      error: `Cannot delete — ${count} team(s) have picked this problem.`,
    };
  }

  const { error } = await svc
    .schema("future")
    .from("problem_statements")
    .delete()
    .eq("id", id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/national/admin/problems");
  return { ok: true, message: "Problem deleted." };
}
