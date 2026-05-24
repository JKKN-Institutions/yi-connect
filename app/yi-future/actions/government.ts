"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient, createServiceClient } from "@/lib/yi-future/supabase/server";
import type { ActionResult } from "./editions";

async function requireAuth(): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/yi-future/login");
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
  await requireAuth();
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
  if (error) return { ok: false, error: error.message };

  revalidatePath("/yi-future/host/government");
  redirect("/yi-future/host/government");
}

export async function updateGovEngagement(
  id: string,
  formData: FormData
): Promise<ActionResult> {
  await requireAuth();
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
  if (error) return { ok: false, error: error.message };

  revalidatePath("/yi-future/host/government");
  redirect("/yi-future/host/government");
}

export async function deleteGovEngagement(id: string): Promise<ActionResult> {
  await requireAuth();
  const svc = await createServiceClient();
  const { error } = await svc
    .schema("future")
    .from("government_engagements")
    .delete()
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/yi-future/host/government");
  return { ok: true, message: "Engagement removed." };
}
