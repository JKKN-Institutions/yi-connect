"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient, createServiceClient } from "@/lib/yi-future/supabase/server";
import type { ActionResult } from "./editions";
import { requireFutureAdmin } from "@/lib/yi-future/auth/require-access";

async function requireAuth(): Promise<void> {
  await requireFutureAdmin();
}

export async function createMediaCoverage(
  eventId: string,
  formData: FormData
): Promise<ActionResult> {
  await requireAuth();
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
  if (error) return { ok: false, error: error.message };

  revalidatePath("/yi-future/host/media");
  return { ok: true, message: "Coverage logged." };
}

export async function deleteMediaCoverage(id: string): Promise<ActionResult> {
  await requireAuth();
  const svc = await createServiceClient();
  const { error } = await svc
    .schema("future")
    .from("media_coverage")
    .delete()
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/yi-future/host/media");
  return { ok: true };
}
