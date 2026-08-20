"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient, createServiceClient } from "@/lib/yi-future/supabase/server";
import type { ActionResult } from "./editions";
import { requireChapterAdmin } from "@/lib/yi-future/auth/require-access";
import { safeError } from "@/lib/yi-future/db-error";

/**
 * Chapter-scoped gate. Media coverage hangs off an event, whose `chapter_id`
 * is the host chapter — a chair of chapter A must not log or delete coverage
 * against chapter B's event. Fails closed: an event with no chapter (or a
 * missing event) resolves to null → deny.
 */
async function requireEventChapterAdmin(eventId: string): Promise<void> {
  const svc = await createServiceClient();
  const { data } = await svc
    .schema("future")
    .from("events")
    .select("chapter_id")
    .eq("id", eventId)
    .maybeSingle();
  await requireChapterAdmin(
    (data as { chapter_id: string | null } | null)?.chapter_id ?? null
  );
}

/** Same gate, entered from an existing coverage row id. */
async function requireCoverageChapterAdmin(id: string): Promise<void> {
  const svc = await createServiceClient();
  const { data } = await svc
    .schema("future")
    .from("media_coverage")
    .select("event_id")
    .eq("id", id)
    .maybeSingle();
  const eventId = (data as { event_id: string | null } | null)?.event_id ?? null;
  if (!eventId) {
    await requireChapterAdmin(null); // fail closed — orphan row
    return;
  }
  await requireEventChapterAdmin(eventId);
}

export async function createMediaCoverage(
  eventId: string,
  formData: FormData
): Promise<ActionResult> {
  await requireEventChapterAdmin(eventId);
  const outlet = String(formData.get("outlet") ?? "").trim() || null;
  const headline = String(formData.get("headline") ?? "").trim() || null;
  const url = String(formData.get("url") ?? "").trim() || null;
  const media_type = String(formData.get("media_type") ?? "").trim() || null;
  const publication_date =
    String(formData.get("publication_date") ?? "").trim() || null;
  const reach_raw = String(formData.get("reach_estimate") ?? "").trim();
  const reach_estimate = reach_raw ? Number(reach_raw) : null;
  const notes = String(formData.get("notes") ?? "").trim() || null;

  if (!headline && !url && !outlet) {
    return {
      ok: false,
      error: "Provide at least one of outlet, headline, or URL.",
    };
  }

  const svc = await createServiceClient();
  const { error } = await svc
    .schema("future")
    .from("media_coverage")
    .insert({
      event_id: eventId,
      outlet,
      headline,
      url,
      media_type,
      publication_date,
      reach_estimate,
      notes,
    });
  if (error) return { ok: false, error: safeError(error.message, "media.createMediaCoverage") };

  revalidatePath("/yi-future/host/media");
  return { ok: true, message: "Coverage logged." };
}

export async function deleteMediaCoverage(id: string): Promise<ActionResult> {
  await requireCoverageChapterAdmin(id);
  const svc = await createServiceClient();
  const { error } = await svc
    .schema("future")
    .from("media_coverage")
    .delete()
    .eq("id", id);
  if (error) return { ok: false, error: safeError(error.message, "media.deleteMediaCoverage") };
  revalidatePath("/yi-future/host/media");
  return { ok: true };
}
