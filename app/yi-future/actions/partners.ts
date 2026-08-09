"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient, createServiceClient } from "@/lib/yi-future/supabase/server";
import { generateAccessCode } from "@/lib/yi-future/access-code";
import type { ActionResult } from "./editions";
import { requireChapterAdmin } from "@/lib/yi-future/auth/require-access";

/**
 * Partners hang off an EVENT, and the event carries the chapter — so the gate
 * for every partner mutation is "admin of the event's chapter (or national)".
 * Fails closed: an unknown or chapter-less event resolves to null → deny.
 */
async function eventChapterId(
  svc: Awaited<ReturnType<typeof createServiceClient>>,
  eventId: string
): Promise<string | null> {
  const { data } = await svc
    .schema("future")
    .from("events")
    .select("chapter_id")
    .eq("id", eventId)
    .maybeSingle();
  return (data as { chapter_id: string | null } | null)?.chapter_id ?? null;
}

async function requireEventChapterAdmin(eventId: string): Promise<void> {
  const svc = await createServiceClient();
  await requireChapterAdmin(await eventChapterId(svc, eventId));
}

/**
 * Chapter-scoped gate for takeover-grade partner actions (regenerate access
 * code, update, delete) — a chair of chapter A must not act on chapter B's
 * partner. Resolves partner → event → chapter.
 */
async function requirePartnerChapterAdmin(id: string): Promise<void> {
  const svc = await createServiceClient();
  const { data } = await svc
    .schema("future")
    .from("corporate_partners")
    .select("event_id")
    .eq("id", id)
    .maybeSingle();
  const eventId = (data as { event_id: string | null } | null)?.event_id ?? null;
  await requireChapterAdmin(
    eventId ? await eventChapterId(svc, eventId) : null
  );
}

async function uniqueAccessCode(
  svc: Awaited<ReturnType<typeof createServiceClient>>
): Promise<string> {
  for (let i = 0; i < 25; i++) {
    const code = generateAccessCode();
    const { data } = await svc
      .schema("future")
      .from("corporate_partners")
      .select("id")
      .eq("access_code", code)
      .maybeSingle();
    if (!data) return code;
  }
  throw new Error("Could not allocate unique partner access code.");
}

export async function createPartner(
  eventId: string,
  formData: FormData
): Promise<ActionResult> {
  // Scope to the chapter that owns the event this partner is being added to.
  await requireEventChapterAdmin(eventId);
  const organization =
    String(formData.get("organization") ?? "").trim();
  const contact_name =
    String(formData.get("contact_name") ?? "").trim() || null;
  const contact_email =
    String(formData.get("contact_email") ?? "").trim() || null;
  const contact_phone =
    String(formData.get("contact_phone") ?? "").trim() || null;
  const website_url =
    String(formData.get("website_url") ?? "").trim() || null;
  const notes = String(formData.get("notes") ?? "").trim() || null;
  const is_sponsor = formData.get("is_sponsor") === "on";
  const is_internship_provider =
    formData.get("is_internship_provider") === "on";
  const is_jury = formData.get("is_jury") === "on";

  if (!organization)
    return { ok: false, error: "Organization is required." };

  const svc = await createServiceClient();
  const access_code = await uniqueAccessCode(svc);

  const { error } = await svc
    .schema("future")
    .from("corporate_partners")
    .insert({
      event_id: eventId,
      organization,
      contact_name,
      contact_email,
      contact_phone,
      website_url,
      notes,
      is_sponsor,
      is_internship_provider,
      is_jury,
      access_code,
    });
  if (error) return { ok: false, error: error.message };

  revalidatePath("/yi-future/host/partners");
  redirect("/yi-future/host/partners");
}

export async function updatePartner(
  id: string,
  formData: FormData
): Promise<ActionResult> {
  // Scope to the partner's OWN event's chapter.
  await requirePartnerChapterAdmin(id);
  const organization =
    String(formData.get("organization") ?? "").trim();
  const contact_name =
    String(formData.get("contact_name") ?? "").trim() || null;
  const contact_email =
    String(formData.get("contact_email") ?? "").trim() || null;
  const contact_phone =
    String(formData.get("contact_phone") ?? "").trim() || null;
  const website_url =
    String(formData.get("website_url") ?? "").trim() || null;
  const notes = String(formData.get("notes") ?? "").trim() || null;
  const is_sponsor = formData.get("is_sponsor") === "on";
  const is_internship_provider =
    formData.get("is_internship_provider") === "on";
  const is_jury = formData.get("is_jury") === "on";

  if (!organization)
    return { ok: false, error: "Organization is required." };

  const svc = await createServiceClient();
  const { error } = await svc
    .schema("future")
    .from("corporate_partners")
    .update({
      organization,
      contact_name,
      contact_email,
      contact_phone,
      website_url,
      notes,
      is_sponsor,
      is_internship_provider,
      is_jury,
    })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/yi-future/host/partners");
  redirect("/yi-future/host/partners");
}

export async function regeneratePartnerCode(id: string): Promise<ActionResult> {
  // Takeover-grade: rotating this code locks the partner out. Own chapter only.
  await requirePartnerChapterAdmin(id);
  const svc = await createServiceClient();
  const access_code = await uniqueAccessCode(svc);
  const { error } = await svc
    .schema("future")
    .from("corporate_partners")
    .update({ access_code })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/yi-future/host/partners");
  return { ok: true, message: `New code: ${access_code}` };
}

export async function deletePartner(id: string): Promise<ActionResult> {
  // Scope to the partner's OWN event's chapter (cascades internship_slots).
  await requirePartnerChapterAdmin(id);
  const svc = await createServiceClient();
  // Cascade: delete internship_slots for this partner first
  await svc
    .schema("future")
    .from("internship_slots")
    .delete()
    .eq("partner_id", id);
  const { error } = await svc
    .schema("future")
    .from("corporate_partners")
    .delete()
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/yi-future/host/partners");
  return { ok: true, message: "Partner removed." };
}
