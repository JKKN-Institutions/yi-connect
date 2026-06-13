"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient, createServiceClient } from "@/lib/yi-future/supabase/server";
import type { ActionResult } from "./editions";
import { requireFutureAdmin } from "@/lib/yi-future/auth/require-access";

async function requireAuth(): Promise<void> {
  await requireFutureAdmin();
}

function parseNum(raw: string): number | null {
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? Math.round(n) : null;
}

export async function createInternship(
  partnerId: string,
  formData: FormData
): Promise<ActionResult> {
  await requireAuth();
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
  await requireAuth();
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
  await requireAuth();
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
  await requireAuth();
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
