"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createServiceClient } from "@/lib/yi-future/supabase/server";
import { requireFutureNationalAdmin } from "@/lib/yi-future/auth/require-access";
import { getChapterContext } from "@/lib/yi-future/chapter-context";
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

// ─── UPDATE OWN CHAPTER (chapter-admin self-service) ────────────────
// The chapter Setup tab used to call the NATIONAL-gated updateChapter above,
// so every chapter admin who clicked "Save profile" bounced to
// /yi-future/forbidden — and the programme-duration / finale-date writes that
// followed never ran. This action is scoped to the caller's OWN chapter via
// getChapterContext (the client can't name a chapter id) and saves profile,
// duration, and finale dates in one place.
export async function updateOwnChapterProfile(
  formData: FormData
): Promise<ActionResult> {
  const ctx = await getChapterContext();
  if (!ctx) {
    return { ok: false, error: "Sign in as a chapter admin first." };
  }

  const name = String(formData.get("name") ?? "").trim();
  const city = String(formData.get("city") ?? "").trim();
  const state = String(formData.get("state") ?? "").trim() || null;
  const region = String(formData.get("region") ?? "").trim() || null;
  const logo_url = String(formData.get("logo_url") ?? "").trim() || null;

  if (!name) return { ok: false, error: "Name is required." };
  if (!city) return { ok: false, error: "City is required." };

  const finale_start_date =
    String(formData.get("finale_start_date") ?? "").trim() || null;
  const finale_end_date =
    String(formData.get("finale_end_date") ?? "").trim() || null;
  if (finale_start_date && finale_end_date && finale_end_date < finale_start_date) {
    return {
      ok: false,
      error: "Finale end date can't be before the start date.",
    };
  }

  const svc = await createServiceClient();
  const { error } = await svc
    .schema("yi")
    .from("chapters")
    .update({
      name,
      city,
      state,
      region,
      logo_url,
      finale_start_date,
      finale_end_date,
    } as never)
    .eq("id", ctx.chapterId);
  if (error) return { ok: false, error: error.message };

  // Programme duration (30/60/90) — locked once the first phase event exists.
  const raw = String(formData.get("programme_duration_days") ?? "").trim();
  const parsed =
    raw === "30" ? 30 : raw === "60" ? 60 : raw === "90" ? 90 : null;
  if (parsed !== null) {
    const { count } = await svc
      .schema("future")
      .from("phase_events")
      .select("id", { count: "exact", head: true })
      .eq("chapter_id", ctx.chapterId)
      .eq("edition_id", ctx.editionId);
    if ((count ?? 0) === 0) {
      const { error: durErr } = await svc
        .schema("yi")
        .from("chapters")
        .update({ programme_duration_days: parsed } as never)
        .eq("id", ctx.chapterId);
      if (durErr) return { ok: false, error: durErr.message };
    }
  }

  revalidatePath("/yi-future/chapter/setup");
  revalidatePath("/yi-future/chapter");
  return { ok: true, message: "Chapter profile saved." };
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
