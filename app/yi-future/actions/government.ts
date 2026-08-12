"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient, createServiceClient } from "@/lib/yi-future/supabase/server";
import type { ActionResult } from "./editions";
import { requireChapterAdmin } from "@/lib/yi-future/auth/require-access";
import { safeError } from "@/lib/yi-future/db-error";

/**
 * Chapter-scoped gate. A government engagement hangs off an event, whose
 * `chapter_id` is the host chapter — a chair of chapter A must not touch
 * chapter B's engagements. Fails closed: an event with no chapter (or a
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

/** Same gate, entered from an existing engagement id. */
async function requireGovChapterAdmin(id: string): Promise<void> {
  const svc = await createServiceClient();
  const { data } = await svc
    .schema("future")
    .from("government_engagements")
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

function parseUrls(raw: string): string[] | null {
  if (!raw) return null;
  return raw
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
}

export async function createGovEngagement(
  eventId: string,
  formData: FormData
): Promise<ActionResult> {
  await requireEventChapterAdmin(eventId);
  const official_name =
    String(formData.get("official_name") ?? "").trim();
  const official_designation =
    String(formData.get("official_designation") ?? "").trim() || null;
  const ministry_or_dept =
    String(formData.get("ministry_or_dept") ?? "").trim() || null;
  const engagement_type =
    String(formData.get("engagement_type") ?? "").trim() || null;
  const scheduled_at =
    String(formData.get("scheduled_at") ?? "").trim() || null;
  const bio = String(formData.get("bio") ?? "").trim() || null;
  const summary = String(formData.get("summary") ?? "").trim() || null;
  const whitepaper_accepted =
    formData.get("whitepaper_accepted") === "on";
  const media_coverage_urls = parseUrls(
    String(formData.get("media_coverage_urls") ?? "")
  );

  if (!official_name)
    return { ok: false, error: "Official name is required." };

  const svc = await createServiceClient();
  const { error } = await svc
    .schema("future")
    .from("government_engagements")
    .insert({
      event_id: eventId,
      official_name,
      official_designation,
      ministry_or_dept,
      engagement_type,
      scheduled_at,
      bio,
      summary,
      whitepaper_accepted,
      media_coverage_urls,
    });
  if (error) return { ok: false, error: safeError(error.message, "government.createGovEngagement") };

  revalidatePath("/yi-future/host/government");
  redirect("/yi-future/host/government");
}

export async function updateGovEngagement(
  id: string,
  formData: FormData
): Promise<ActionResult> {
  await requireGovChapterAdmin(id);
  const official_name =
    String(formData.get("official_name") ?? "").trim();
  const official_designation =
    String(formData.get("official_designation") ?? "").trim() || null;
  const ministry_or_dept =
    String(formData.get("ministry_or_dept") ?? "").trim() || null;
  const engagement_type =
    String(formData.get("engagement_type") ?? "").trim() || null;
  const scheduled_at =
    String(formData.get("scheduled_at") ?? "").trim() || null;
  const bio = String(formData.get("bio") ?? "").trim() || null;
  const summary = String(formData.get("summary") ?? "").trim() || null;
  const whitepaper_accepted =
    formData.get("whitepaper_accepted") === "on";
  const media_coverage_urls = parseUrls(
    String(formData.get("media_coverage_urls") ?? "")
  );

  if (!official_name)
    return { ok: false, error: "Official name is required." };

  const svc = await createServiceClient();
  const { error } = await svc
    .schema("future")
    .from("government_engagements")
    .update({
      official_name,
      official_designation,
      ministry_or_dept,
      engagement_type,
      scheduled_at,
      bio,
      summary,
      whitepaper_accepted,
      media_coverage_urls,
    })
    .eq("id", id);
  if (error) return { ok: false, error: safeError(error.message, "government.updateGovEngagement") };

  revalidatePath("/yi-future/host/government");
  redirect("/yi-future/host/government");
}

export async function deleteGovEngagement(id: string): Promise<ActionResult> {
  await requireGovChapterAdmin(id);
  const svc = await createServiceClient();
  const { error } = await svc
    .schema("future")
    .from("government_engagements")
    .delete()
    .eq("id", id);
  if (error) return { ok: false, error: safeError(error.message, "government.deleteGovEngagement") };
  revalidatePath("/yi-future/host/government");
  return { ok: true, message: "Engagement removed." };
}
