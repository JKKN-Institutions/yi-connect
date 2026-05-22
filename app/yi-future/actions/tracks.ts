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

// ─── CREATE ─────────────────────────────────────────────────────────
export async function createTrack(
  editionId: string,
  formData: FormData
): Promise<ActionResult> {
  await requireAdmin();
  await requirePlatformAdmin();
  const slug = String(formData.get("slug") ?? "").trim().toLowerCase();
  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim() || null;
  const color_hex = String(formData.get("color_hex") ?? "").trim() || null;
  const icon = String(formData.get("icon") ?? "").trim() || null;
  const display_order_raw = String(formData.get("display_order") ?? "").trim();
  const display_order = display_order_raw ? Number(display_order_raw) : null;

  if (!/^[a-z0-9_]+$/.test(slug)) {
    return {
      ok: false,
      error: "Slug must be lowercase letters, digits, underscores only.",
    };
  }
  if (!name) return { ok: false, error: "Name is required." };

  const svc = await createServiceClient();
  const { error } = await svc
    .schema("future")
    .from("tracks")
    .insert({
      edition_id: editionId,
      slug,
      name,
      description,
      color_hex,
      icon,
      display_order,
    });
  if (error) return { ok: false, error: error.message };

  revalidatePath("/national/admin/tracks");
  redirect(`/national/admin/tracks?edition=${editionId}`);
}

// ─── UPDATE ─────────────────────────────────────────────────────────
export async function updateTrack(
  id: string,
  editionId: string,
  formData: FormData
): Promise<ActionResult> {
  await requireAdmin();
  await requirePlatformAdmin();
  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim() || null;
  const color_hex = String(formData.get("color_hex") ?? "").trim() || null;
  const icon = String(formData.get("icon") ?? "").trim() || null;
  const display_order_raw = String(formData.get("display_order") ?? "").trim();
  const display_order = display_order_raw ? Number(display_order_raw) : null;

  if (!name) return { ok: false, error: "Name is required." };

  const svc = await createServiceClient();
  const { error } = await svc
    .schema("future")
    .from("tracks")
    .update({ name, description, color_hex, icon, display_order })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/national/admin/tracks");
  redirect(`/national/admin/tracks?edition=${editionId}`);
}

// ─── DELETE ─────────────────────────────────────────────────────────
export async function deleteTrack(
  id: string,
  editionId: string
): Promise<ActionResult> {
  await requireAdmin();
  await requirePlatformAdmin();
  const svc = await createServiceClient();

  // Guard: don't allow if any problems exist
  const { count } = await svc
    .schema("future")
    .from("problem_statements")
    .select("id", { count: "exact", head: true })
    .eq("track_id", id);

  if ((count ?? 0) > 0) {
    return {
      ok: false,
      error: `Cannot delete — track has ${count} problem statement(s). Remove them first.`,
    };
  }

  const { error } = await svc
    .schema("future")
    .from("tracks")
    .delete()
    .eq("id", id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/national/admin/tracks");
  return { ok: true, message: "Track deleted." };
}
