"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient, createServiceClient } from "@/lib/yi-future/supabase/server";
import type { Database } from "@/types/yi-future/database";
import type { ActionResult } from "./editions";
import { requireFutureAdmin } from "@/lib/yi-future/auth/require-access";

type EventType = Database["future"]["Enums"]["event_type"];

async function requireAuth(): Promise<string> {
  const access = await requireFutureAdmin();
  return access.userId;
}

// ─── CREATE NATIONAL TRACK FINAL ────────────────────────────────────
export async function createNationalEvent(
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
  const track_id = String(formData.get("track_id") ?? "").trim() || null;

  if (!name) return { ok: false, error: "Name is required." };
  if (!track_id) return { ok: false, error: "Pick a track for this national event." };

  const svc = await createServiceClient();
  const { error } = await svc
    .schema("future")
    .from("events")
    .insert({
      chapter_id: input.chapterId,
      edition_id: input.editionId,
      track_id,
      type: "national_track_final" as EventType,
      name,
      tagline,
      start_date,
      end_date,
      venue,
      venue_address,
      is_published: false,
      created_by: userId,
    });
  if (error) return { ok: false, error: error.message };

  revalidatePath("/yi-future/host");
  redirect("/yi-future/host");
}

export async function updateNationalEvent(
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
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/yi-future/host");
  return { ok: true, message: "Event updated." };
}

export async function publishNationalEvent(
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
  revalidatePath("/yi-future/host");
  return { ok: true };
}
