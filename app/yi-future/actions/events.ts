"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient, createServiceClient } from "@/lib/yi-future/supabase/server";
import type { Database } from "@/types/yi-future/database";
import type { ActionResult } from "./editions";
import {
  CHAPTER_FINAL_SECTIONS,
  CHAPTER_FINAL_SECTION_LABELS,
  NATIONAL_DAY1_SECTIONS,
  NATIONAL_DAY1_SECTION_LABELS,
  NATIONAL_DAY2_SECTIONS,
  NATIONAL_DAY2_SECTION_LABELS,
} from "@/lib/yi-future/constants";
import { requireFutureAdmin } from "@/lib/yi-future/auth/require-access";

type EventType = Database["future"]["Enums"]["event_type"];
type ChapterFinalSection =
  Database["future"]["Enums"]["chapter_final_section"];

async function requireAuth(): Promise<string> {
  const access = await requireFutureAdmin();
  return access.userId;
}

// ─── CREATE CHAPTER FINAL ───────────────────────────────────────────
export async function createChapterFinal(
  input: { chapterId: string; editionId: string },
  formData: FormData
): Promise<ActionResult> {
  const userId = await requireAuth();
  const name = String(formData.get("name") ?? "").trim();
  const tagline = String(formData.get("tagline") ?? "").trim() || null;
  const start_date = String(formData.get("start_date") ?? "").trim() || null;
  const end_date = String(formData.get("end_date") ?? "").trim() || null;
  const venue = String(formData.get("venue") ?? "").trim() || null;
  const venue_address =
    String(formData.get("venue_address") ?? "").trim() || null;
  const venue_maps_url =
    String(formData.get("venue_maps_url") ?? "").trim() || null;

  if (!name) return { ok: false, error: "Name is required." };

  const svc = await createServiceClient();
  const { data: inserted, error } = await svc
    .schema("future")
    .from("events")
    .insert({
      chapter_id: input.chapterId,
      edition_id: input.editionId,
      type: "chapter_final" as EventType,
      name,
      tagline,
      start_date,
      end_date,
      venue,
      venue_address,
      venue_maps_url,
      is_published: false,
      created_by: userId,
    })
    .select("id")
    .maybeSingle();
  if (error) return { ok: false, error: error.message };

  const eventId = (inserted as { id: string } | null)?.id;
  if (!eventId) {
    return { ok: false, error: "Insert returned no id." };
  }

  // Seed the 5 chapter_final_sections
  const sectionRows = CHAPTER_FINAL_SECTIONS.map((s) => ({
    event_id: eventId,
    section: s as ChapterFinalSection,
    title: CHAPTER_FINAL_SECTION_LABELS[s],
    is_active: false,
  }));
  await svc
    .schema("future")
    .from("chapter_final_sections")
    .insert(sectionRows);

  revalidatePath("/yi-future/chapter/final");
  redirect(`/chapter/final/${eventId}`);
}

// ─── CREATE REGIONAL FINALE ─────────────────────────────────────────
export async function createRegionalFinale(
  input: { chapterId: string; editionId: string },
  formData: FormData
): Promise<ActionResult> {
  const userId = await requireAuth();
  const name = String(formData.get("name") ?? "").trim();
  const tagline = String(formData.get("tagline") ?? "").trim() || null;
  const start_date = String(formData.get("start_date") ?? "").trim() || null;
  const end_date = String(formData.get("end_date") ?? "").trim() || null;
  const venue = String(formData.get("venue") ?? "").trim() || null;
  const venue_address =
    String(formData.get("venue_address") ?? "").trim() || null;
  const venue_maps_url =
    String(formData.get("venue_maps_url") ?? "").trim() || null;

  if (!name) return { ok: false, error: "Name is required." };

  const svc = await createServiceClient();
  const { data: inserted, error } = await svc
    .schema("future")
    .from("events")
    .insert({
      chapter_id: input.chapterId,
      edition_id: input.editionId,
      type: "regional_finale" as EventType,
      name,
      tagline,
      start_date,
      end_date,
      venue,
      venue_address,
      venue_maps_url,
      is_published: false,
      created_by: userId,
    })
    .select("id")
    .maybeSingle();
  if (error) return { ok: false, error: error.message };

  const eventId = (inserted as { id: string } | null)?.id;
  if (!eventId) {
    return { ok: false, error: "Insert returned no id." };
  }

  revalidatePath("/yi-future/host");
  revalidatePath("/yi-future/host/finale/live");
  redirect("/yi-future/host/finale/live");
}

// ─── CREATE NATIONAL FINALS ────────────────────────────────────────
export async function createNationalFinals(
  input: { editionId: string },
  formData: FormData
): Promise<ActionResult> {
  const userId = await requireAuth();
  const name = String(formData.get("name") ?? "").trim();
  const tagline = String(formData.get("tagline") ?? "").trim() || null;
  const start_date = String(formData.get("start_date") ?? "").trim() || null;
  const end_date = String(formData.get("end_date") ?? "").trim() || null;
  const venue = String(formData.get("venue") ?? "").trim() || null;
  const venue_address = String(formData.get("venue_address") ?? "").trim() || null;
  const venue_maps_url = String(formData.get("venue_maps_url") ?? "").trim() || null;
  const capacity_raw = String(formData.get("capacity") ?? "").trim();
  const capacity = capacity_raw ? Number(capacity_raw) : null;

  if (!name) return { ok: false, error: "Name is required." };

  const svc = await createServiceClient();
  const { data: inserted, error } = await svc
    .schema("future")
    .from("events")
    .insert({
      edition_id: input.editionId,
      chapter_id: null,
      type: "national_finals" as EventType,
      name,
      tagline,
      start_date,
      end_date,
      venue,
      venue_address,
      venue_maps_url,
      capacity,
      is_published: false,
      created_by: userId,
    } as never)
    .select("id")
    .maybeSingle();
  if (error) return { ok: false, error: error.message };

  const eventId = (inserted as { id: string } | null)?.id;
  if (eventId) {
    const d1Rows = NATIONAL_DAY1_SECTIONS.map((s) => ({
      event_id: eventId,
      section: s,
      title: NATIONAL_DAY1_SECTION_LABELS[s],
      is_active: false,
    }));
    await svc.schema("future").from("national_day1_sections").insert(d1Rows);

    const d2Rows = NATIONAL_DAY2_SECTIONS.map((s) => ({
      event_id: eventId,
      section: s,
      title: NATIONAL_DAY2_SECTION_LABELS[s],
      is_active: false,
    }));
    await svc.schema("future").from("national_day2_sections").insert(d2Rows);
  }

  revalidatePath("/yi-future/national/admin/finals");
  redirect("/yi-future/national/admin/finals/live");
}

// ─── UPDATE EVENT ───────────────────────────────────────────────────
export async function updateEvent(
  id: string,
  formData: FormData
): Promise<ActionResult> {
  await requireAuth();
  const name = String(formData.get("name") ?? "").trim();
  const tagline = String(formData.get("tagline") ?? "").trim() || null;
  const start_date = String(formData.get("start_date") ?? "").trim() || null;
  const end_date = String(formData.get("end_date") ?? "").trim() || null;
  const venue = String(formData.get("venue") ?? "").trim() || null;
  const venue_address =
    String(formData.get("venue_address") ?? "").trim() || null;
  const venue_maps_url =
    String(formData.get("venue_maps_url") ?? "").trim() || null;

  if (!name) return { ok: false, error: "Name is required." };

  const svc = await createServiceClient();
  const { error } = await svc
    .schema("future")
    .from("events")
    .update({
      name,
      tagline,
      start_date,
      end_date,
      venue,
      venue_address,
      venue_maps_url,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/yi-future/chapter/final");
  revalidatePath(`/yi-future/chapter/final/${id}`);
  return { ok: true, message: "Event updated." };
}

export async function setEventPublished(
  id: string,
  publish: boolean
): Promise<ActionResult> {
  await requireAuth();
  const svc = await createServiceClient();
  const { error } = await svc
    .schema("future")
    .from("events")
    .update({ is_published: publish })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/yi-future/chapter/final/${id}`);
  return { ok: true };
}

// ─── SECTION LIVE CONTROL ──────────────────────────────────────────
export async function activateSection(
  eventId: string,
  section: ChapterFinalSection
): Promise<ActionResult> {
  await requireAuth();
  const svc = await createServiceClient();

  const now = new Date().toISOString();

  // Deactivate all + close starts_at/ends_at on previous active
  await svc
    .schema("future")
    .from("chapter_final_sections")
    .update({ is_active: false, ends_at: now })
    .eq("event_id", eventId)
    .eq("is_active", true);

  // Activate target
  const { error } = await svc
    .schema("future")
    .from("chapter_final_sections")
    .update({
      is_active: true,
      starts_at: now,
      ends_at: null,
    })
    .eq("event_id", eventId)
    .eq("section", section);
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/yi-future/chapter/final/${eventId}`);
  revalidatePath(`/yi-future/chapter/final/${eventId}/live`);
  revalidatePath(`/event/${eventId}/display`);
  return { ok: true, message: `Section "${section}" is live.` };
}

export async function endAllSections(
  eventId: string
): Promise<ActionResult> {
  await requireAuth();
  const svc = await createServiceClient();
  const now = new Date().toISOString();
  const { error } = await svc
    .schema("future")
    .from("chapter_final_sections")
    .update({ is_active: false, ends_at: now })
    .eq("event_id", eventId)
    .eq("is_active", true);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/yi-future/chapter/final/${eventId}`);
  revalidatePath(`/yi-future/chapter/final/${eventId}/live`);
  revalidatePath(`/event/${eventId}/display`);
  return { ok: true, message: "Event paused / all sections closed." };
}

// ─── SECTION NOTES ─────────────────────────────────────────────────
export async function updateSectionNotes(
  eventId: string,
  section: ChapterFinalSection,
  notes: string | null
): Promise<ActionResult> {
  await requireAuth();
  const svc = await createServiceClient();
  const { error } = await svc
    .schema("future")
    .from("chapter_final_sections")
    .update({ notes })
    .eq("event_id", eventId)
    .eq("section", section);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/yi-future/chapter/final/${eventId}`);
  return { ok: true };
}
