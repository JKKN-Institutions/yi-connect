"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createServiceClient } from "@/lib/yi-future/supabase/server";
import { requireFutureNationalAdmin } from "@/lib/yi-future/auth/require-access";
import type { ActionResult } from "./editions";

// National-only: the chapter list is national config. createChapter,
// updateChapter and setChapterActive all write yi.chapters via the service
// client, so they must be gated to national admins (a delegate could
// otherwise inject chapters or archive any chapter = DoS). Fails CLOSED.
async function requireAdmin(): Promise<void> {
  await requireFutureNationalAdmin();
}

// ─── CREATE (national admin) ────────────────────────────────────────
export async function createChapter(
  formData: FormData
): Promise<ActionResult> {
  await requireAdmin();
  const name = String(formData.get("name") ?? "").trim();
  const city = String(formData.get("city") ?? "").trim();
  const state = String(formData.get("state") ?? "").trim() || null;
  const region = String(formData.get("region") ?? "").trim() || null;

  if (!name) return { ok: false, error: "Name is required." };
  if (!city) return { ok: false, error: "City is required." };

  const svc = await createServiceClient();
  const { error } = await svc
    .schema("yi")
    .from("chapters")
    .insert({ name, city, state, region, is_active: true });
  if (error) return { ok: false, error: error.message };

  revalidatePath("/national/admin/chapters");
  redirect("/yi-future/national/admin/chapters");
}

// ─── UPDATE (national admin or chapter admin) ───────────────────────
export async function updateChapter(
  id: string,
  formData: FormData
): Promise<ActionResult> {
  await requireAdmin();
  const name = String(formData.get("name") ?? "").trim();
  const city = String(formData.get("city") ?? "").trim();
  const state = String(formData.get("state") ?? "").trim() || null;
  const region = String(formData.get("region") ?? "").trim() || null;
  const logo_url = String(formData.get("logo_url") ?? "").trim() || null;

  if (!name) return { ok: false, error: "Name is required." };
  if (!city) return { ok: false, error: "City is required." };

  const svc = await createServiceClient();
  const { error } = await svc
    .schema("yi")
    .from("chapters")
    .update({ name, city, state, region, logo_url })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/national/admin/chapters");
  revalidatePath("/yi-future/chapter/setup");
  return { ok: true, message: "Chapter updated." };
}

// ─── SET ACTIVE / ARCHIVE ───────────────────────────────────────────
export async function setChapterActive(
  id: string,
  nextActive: boolean
): Promise<ActionResult> {
  await requireAdmin();
  const svc = await createServiceClient();
  const { error } = await svc
    .schema("yi")
    .from("chapters")
    .update({ is_active: nextActive })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/national/admin/chapters");
  return { ok: true };
}
