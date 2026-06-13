"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient, createServiceClient } from "@/lib/yi-future/supabase/server";
import type { ActionResult } from "./editions";
import { requireFutureAdmin } from "@/lib/yi-future/auth/require-access";

async function requireAuth(): Promise<void> {
  await requireFutureAdmin();
}

function parseExpertise(raw: string): string[] {
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export async function createExpert(
  editionId: string,
  formData: FormData
): Promise<ActionResult> {
  await requireAuth();
  const full_name = String(formData.get("full_name") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim() || null;
  const organization =
    String(formData.get("organization") ?? "").trim() || null;
  const email = String(formData.get("email") ?? "").trim() || null;
  const phone = String(formData.get("phone") ?? "").trim() || null;
  const bio = String(formData.get("bio") ?? "").trim() || null;
  const expertise_raw = String(formData.get("expertise_areas") ?? "").trim();
  const expertise_areas = expertise_raw ? parseExpertise(expertise_raw) : null;

  if (!full_name) return { ok: false, error: "Full name is required." };

  const svc = await createServiceClient();
  const { error } = await svc
    .schema("future")
    .from("experts")
    .insert({
      edition_id: editionId,
      full_name,
      title,
      organization,
      email,
      phone,
      bio,
      expertise_areas,
    });
  if (error) return { ok: false, error: error.message };

  revalidatePath("/yi-future/chapter/experts");
  redirect("/yi-future/chapter/experts");
}

export async function updateExpert(
  id: string,
  formData: FormData
): Promise<ActionResult> {
  await requireAuth();
  const full_name = String(formData.get("full_name") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim() || null;
  const organization =
    String(formData.get("organization") ?? "").trim() || null;
  const email = String(formData.get("email") ?? "").trim() || null;
  const phone = String(formData.get("phone") ?? "").trim() || null;
  const bio = String(formData.get("bio") ?? "").trim() || null;
  const expertise_raw = String(formData.get("expertise_areas") ?? "").trim();
  const expertise_areas = expertise_raw ? parseExpertise(expertise_raw) : null;

  if (!full_name) return { ok: false, error: "Full name is required." };

  const svc = await createServiceClient();
  const { error } = await svc
    .schema("future")
    .from("experts")
    .update({
      full_name,
      title,
      organization,
      email,
      phone,
      bio,
      expertise_areas,
    })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/yi-future/chapter/experts");
  redirect("/yi-future/chapter/experts");
}

export async function deleteExpert(id: string): Promise<ActionResult> {
  await requireAuth();
  const svc = await createServiceClient();
  const { error } = await svc
    .schema("future")
    .from("experts")
    .delete()
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/yi-future/chapter/experts");
  return { ok: true, message: "Expert removed." };
}
