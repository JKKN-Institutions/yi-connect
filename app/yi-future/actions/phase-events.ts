"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient, createServiceClient } from "@/lib/yi-future/supabase/server";
import type { Database } from "@/types/yi-future/database";
import type { ActionResult } from "./editions";
import {
  PHASE_EVENT_TYPES_BY_PHASE,
  type Phase,
} from "@/lib/yi-future/constants";

type PhaseEventType = Database["future"]["Enums"]["phase_event_type"];

async function requireAuth(): Promise<string> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/yi-future/login");
  return user.id;
}

function parseDuration(raw: string): number | null {
  const n = Number(raw);
  if (!raw || Number.isNaN(n) || n <= 0) return null;
  return Math.round(n);
}

// ─── CREATE ─────────────────────────────────────────────────────────
export async function createPhaseEvent(
  input: { chapterId: string; editionId: string },
  formData: FormData
): Promise<ActionResult> {
  const userId = await requireAuth();
  const phase = String(formData.get("phase") ?? "").trim() as Phase;
  const type = String(formData.get("type") ?? "").trim() as PhaseEventType;
  const title = String(formData.get("title") ?? "").trim();
  const description =
    String(formData.get("description") ?? "").trim() || null;
  const scheduled_at = String(formData.get("scheduled_at") ?? "").trim();
  const duration_minutes = parseDuration(
    String(formData.get("duration_minutes") ?? "")
  );
  const venue = String(formData.get("venue") ?? "").trim() || null;
  const mode = String(formData.get("mode") ?? "").trim() || null;
  const meeting_url = String(formData.get("meeting_url") ?? "").trim() || null;
  const capacity_raw = String(formData.get("capacity") ?? "").trim();
  const capacity = capacity_raw ? Number(capacity_raw) : null;

  if (!title) return { ok: false, error: "Title is required." };
  if (!scheduled_at) {
    return { ok: false, error: "Scheduled date/time is required." };
  }
  if (!(["phase_a", "phase_b", "phase_c"] as const).includes(phase)) {
    return { ok: false, error: "Pick a valid phase." };
  }
  // Type must belong to this phase
  const allowed = PHASE_EVENT_TYPES_BY_PHASE[phase] as readonly string[];
  if (!allowed.includes(type)) {
    return {
      ok: false,
      error: `Event type "${type}" isn't valid for ${phase}.`,
    };
  }

  const svc = await createServiceClient();
  const { data: inserted, error } = await svc
    .schema("future")
    .from("phase_events")
    .insert({
      chapter_id: input.chapterId,
      edition_id: input.editionId,
      phase,
      type,
      title,
      description,
      scheduled_at,
      duration_minutes,
      venue,
      mode,
      meeting_url,
      capacity,
      created_by: userId,
      completed: false,
    })
    .select("id")
    .maybeSingle();
  if (error) return { ok: false, error: error.message };

  revalidatePath("/chapter/journey");
  const newId = (inserted as { id: string } | null)?.id;
  if (newId) redirect(`/chapter/journey/${newId}`);
  redirect("/yi-future/chapter/journey");
}

// ─── UPDATE ─────────────────────────────────────────────────────────
export async function updatePhaseEvent(
  id: string,
  formData: FormData
): Promise<ActionResult> {
  await requireAuth();
  const title = String(formData.get("title") ?? "").trim();
  const description =
    String(formData.get("description") ?? "").trim() || null;
  const scheduled_at = String(formData.get("scheduled_at") ?? "").trim();
  const duration_minutes = parseDuration(
    String(formData.get("duration_minutes") ?? "")
  );
  const venue = String(formData.get("venue") ?? "").trim() || null;
  const mode = String(formData.get("mode") ?? "").trim() || null;
  const meeting_url = String(formData.get("meeting_url") ?? "").trim() || null;
  const capacity_raw = String(formData.get("capacity") ?? "").trim();
  const capacity = capacity_raw ? Number(capacity_raw) : null;

  if (!title) return { ok: false, error: "Title is required." };

  const svc = await createServiceClient();
  const { error } = await svc
    .schema("future")
    .from("phase_events")
    .update({
      title,
      description,
      scheduled_at,
      duration_minutes,
      venue,
      mode,
      meeting_url,
      capacity,
    })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/chapter/journey/${id}`);
  revalidatePath("/chapter/journey");
  return { ok: true, message: "Event updated." };
}

// ─── MARK COMPLETE / UNCOMPLETE ────────────────────────────────────
export async function setEventComplete(
  id: string,
  complete: boolean
): Promise<ActionResult> {
  const userId = await requireAuth();
  const svc = await createServiceClient();
  const { error } = await svc
    .schema("future")
    .from("phase_events")
    .update({
      completed: complete,
      completed_at: complete ? new Date().toISOString() : null,
      completed_by: complete ? userId : null,
    })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/chapter/journey/${id}`);
  revalidatePath("/chapter/journey");
  return {
    ok: true,
    message: complete ? "Event marked complete." : "Marked incomplete.",
  };
}

// ─── DELETE ─────────────────────────────────────────────────────────
export async function deletePhaseEvent(id: string): Promise<ActionResult> {
  await requireAuth();
  const svc = await createServiceClient();
  // Also clear attendance
  await svc
    .schema("future")
    .from("phase_event_attendance")
    .delete()
    .eq("phase_event_id", id);

  const { error } = await svc
    .schema("future")
    .from("phase_events")
    .delete()
    .eq("id", id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/chapter/journey");
  return { ok: true, message: "Event deleted." };
}
