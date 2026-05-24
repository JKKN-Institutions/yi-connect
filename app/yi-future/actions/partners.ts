"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient, createServiceClient } from "@/lib/yi-future/supabase/server";
import { generateAccessCode } from "@/lib/yi-future/access-code";
import type { ActionResult } from "./editions";

async function requireAuth(): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/yi-future/login");
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
  await requireAuth();
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
  await requireAuth();
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
  await requireAuth();
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
  await requireAuth();
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
