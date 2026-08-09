"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient, createServiceClient } from "@/lib/yi-future/supabase/server";
import type { ActionResult } from "./editions";
import { requireChapterAdmin } from "@/lib/yi-future/auth/require-access";

/**
 * Chapter-scoped gate. An internship slot hangs off a corporate partner, which
 * hangs off an event, whose `chapter_id` is the host chapter — so a chair of
 * chapter A must not edit chapter B's slots. Resolves that chain, then requires
 * admin of THAT chapter (or national). Fails closed: any broken link in the
 * chain resolves to null → deny.
 */
async function requirePartnerChapterAdmin(partnerId: string): Promise<void> {
  const svc = await createServiceClient();
  const { data: partner } = await svc
    .schema("future")
    .from("corporate_partners")
    .select("event_id")
    .eq("id", partnerId)
    .maybeSingle();
  const eventId =
    (partner as { event_id: string | null } | null)?.event_id ?? null;

  let chapterId: string | null = null;
  if (eventId) {
    const { data: ev } = await svc
      .schema("future")
      .from("events")
      .select("chapter_id")
      .eq("id", eventId)
      .maybeSingle();
    chapterId = (ev as { chapter_id: string | null } | null)?.chapter_id ?? null;
  }
  await requireChapterAdmin(chapterId);
}

/** Same gate, entered from an existing slot id. */
async function requireSlotChapterAdmin(id: string): Promise<void> {
  const svc = await createServiceClient();
  const { data } = await svc
    .schema("future")
    .from("internship_slots")
    .select("partner_id")
    .eq("id", id)
    .maybeSingle();
  const partnerId =
    (data as { partner_id: string | null } | null)?.partner_id ?? null;
  if (!partnerId) {
    await requireChapterAdmin(null); // fail closed — orphan slot
    return;
  }
  await requirePartnerChapterAdmin(partnerId);
}

function parseNum(raw: string): number | null {
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? Math.round(n) : null;
}

export async function createInternship(
  partnerId: string,
  formData: FormData
): Promise<ActionResult> {
  await requirePartnerChapterAdmin(partnerId);
  const title = String(formData.get("title") ?? "").trim();
  const description =
    String(formData.get("description") ?? "").trim() || null;
  const domain = String(formData.get("domain") ?? "").trim() || null;
  const duration = String(formData.get("duration") ?? "").trim() || null;
  const stipend = String(formData.get("stipend") ?? "").trim() || null;
  const location = String(formData.get("location") ?? "").trim() || null;
  const work_mode = String(formData.get("work_mode") ?? "").trim() || null;
  const requirements =
    String(formData.get("requirements") ?? "").trim() || null;
  const slots_available = parseNum(
    String(formData.get("slots_available") ?? "")
  );

  if (!title) return { ok: false, error: "Title is required." };

  const svc = await createServiceClient();
  const { error } = await svc
    .schema("future")
    .from("internship_slots")
    .insert({
      partner_id: partnerId,
      title,
      description,
      domain,
      duration,
      stipend,
      location,
      work_mode,
      requirements,
      slots_available,
      is_active: true,
    });
  if (error) return { ok: false, error: error.message };

  revalidatePath("/yi-future/host/internships");
  redirect("/yi-future/host/internships");
}

export async function updateInternship(
  id: string,
  formData: FormData
): Promise<ActionResult> {
  await requireSlotChapterAdmin(id);
  const title = String(formData.get("title") ?? "").trim();
  const description =
    String(formData.get("description") ?? "").trim() || null;
  const domain = String(formData.get("domain") ?? "").trim() || null;
  const duration = String(formData.get("duration") ?? "").trim() || null;
  const stipend = String(formData.get("stipend") ?? "").trim() || null;
  const location = String(formData.get("location") ?? "").trim() || null;
  const work_mode = String(formData.get("work_mode") ?? "").trim() || null;
  const requirements =
    String(formData.get("requirements") ?? "").trim() || null;
  const slots_available = parseNum(
    String(formData.get("slots_available") ?? "")
  );

  if (!title) return { ok: false, error: "Title is required." };

  const svc = await createServiceClient();
  const { error } = await svc
    .schema("future")
    .from("internship_slots")
    .update({
      title,
      description,
      domain,
      duration,
      stipend,
      location,
      work_mode,
      requirements,
      slots_available,
    })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/yi-future/host/internships");
  redirect("/yi-future/host/internships");
}

export async function toggleInternshipActive(
  id: string,
  next: boolean
): Promise<ActionResult> {
  await requireSlotChapterAdmin(id);
  const svc = await createServiceClient();
  const { error } = await svc
    .schema("future")
    .from("internship_slots")
    .update({ is_active: next })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/yi-future/host/internships");
  return { ok: true };
}

export async function deleteInternship(id: string): Promise<ActionResult> {
  await requireSlotChapterAdmin(id);
  const svc = await createServiceClient();
  const { error } = await svc
    .schema("future")
    .from("internship_slots")
    .delete()
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/yi-future/host/internships");
  return { ok: true, message: "Slot removed." };
}
