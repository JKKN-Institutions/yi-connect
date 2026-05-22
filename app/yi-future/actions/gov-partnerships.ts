"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient, createServiceClient } from "@/lib/yi-future/supabase/server";
import type { ActionResult } from "./editions";

// ─── auth ───────────────────────────────────────────────────────────
async function requireUser(): Promise<string> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/yi-future/login");
  return user.id;
}

// ─── helpers ────────────────────────────────────────────────────────
// New tables not yet in generated Database types — cast service client.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = any;

const ORG_TYPES = new Set([
  "central_ministry",
  "state_govt",
  "psu",
  "regulatory",
  "other",
]);

const STATUSES = new Set([
  "initial",
  "in_discussion",
  "mou_drafted",
  "mou_signed",
  "active",
  "dormant",
]);

const CONTACT_TYPES = new Set([
  "meeting",
  "call",
  "email",
  "letter",
  "event",
]);

function pickEnum(raw: string, allowed: Set<string>): string | null {
  const v = raw.trim();
  return v && allowed.has(v) ? v : null;
}

// ─── PARTNERSHIPS ───────────────────────────────────────────────────

export async function createPartnership(
  formData: FormData
): Promise<ActionResult> {
  await requireUser();

  const org_name = String(formData.get("org_name") ?? "").trim();
  const org_type = pickEnum(String(formData.get("org_type") ?? ""), ORG_TYPES);
  const official_name =
    String(formData.get("official_name") ?? "").trim() || null;
  const official_title =
    String(formData.get("official_title") ?? "").trim() || null;
  const official_email =
    String(formData.get("official_email") ?? "").trim() || null;
  const official_phone =
    String(formData.get("official_phone") ?? "").trim() || null;
  const mou_signed = formData.get("mou_signed") === "on";
  const mou_url = String(formData.get("mou_url") ?? "").trim() || null;
  const mou_signed_date =
    String(formData.get("mou_signed_date") ?? "").trim() || null;
  const status =
    pickEnum(String(formData.get("status") ?? ""), STATUSES) ?? "initial";
  const notes = String(formData.get("notes") ?? "").trim() || null;

  if (!org_name) {
    return { ok: false, error: "Organisation name is required." };
  }

  const svc = (await createServiceClient()) as AnyClient;
  const { data, error } = await svc
    .schema("yi")
    .from("government_partnerships")
    .insert({
      org_name,
      org_type,
      official_name,
      official_title,
      official_email,
      official_phone,
      mou_signed,
      mou_url,
      mou_signed_date,
      status,
      notes,
    })
    .select("id")
    .single();

  if (error) return { ok: false, error: error.message };

  revalidatePath("/national/admin/government");
  if (data?.id) redirect(`/national/admin/government/${data.id}`);
  redirect("/yi-future/national/admin/government");
}

export async function updatePartnership(
  id: string,
  formData: FormData
): Promise<ActionResult> {
  await requireUser();

  const org_name = String(formData.get("org_name") ?? "").trim();
  const org_type = pickEnum(String(formData.get("org_type") ?? ""), ORG_TYPES);
  const official_name =
    String(formData.get("official_name") ?? "").trim() || null;
  const official_title =
    String(formData.get("official_title") ?? "").trim() || null;
  const official_email =
    String(formData.get("official_email") ?? "").trim() || null;
  const official_phone =
    String(formData.get("official_phone") ?? "").trim() || null;
  const mou_signed = formData.get("mou_signed") === "on";
  const mou_url = String(formData.get("mou_url") ?? "").trim() || null;
  const mou_signed_date =
    String(formData.get("mou_signed_date") ?? "").trim() || null;
  const status =
    pickEnum(String(formData.get("status") ?? ""), STATUSES) ?? "initial";
  const notes = String(formData.get("notes") ?? "").trim() || null;

  if (!org_name) {
    return { ok: false, error: "Organisation name is required." };
  }

  const svc = (await createServiceClient()) as AnyClient;
  const { error } = await svc
    .schema("yi")
    .from("government_partnerships")
    .update({
      org_name,
      org_type,
      official_name,
      official_title,
      official_email,
      official_phone,
      mou_signed,
      mou_url,
      mou_signed_date,
      status,
      notes,
    })
    .eq("id", id);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/national/admin/government");
  revalidatePath(`/national/admin/government/${id}`);
  redirect(`/national/admin/government/${id}`);
}

export async function deletePartnership(
  id: string
): Promise<ActionResult> {
  await requireUser();
  const svc = (await createServiceClient()) as AnyClient;
  const { error } = await svc
    .schema("yi")
    .from("government_partnerships")
    .delete()
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/national/admin/government");
  redirect("/yi-future/national/admin/government");
}

// ─── CONTACT LOG ────────────────────────────────────────────────────

export async function logContact(
  partnershipId: string,
  formData: FormData
): Promise<ActionResult> {
  const userId = await requireUser();

  const contact_date = String(formData.get("contact_date") ?? "").trim();
  const contact_type = pickEnum(
    String(formData.get("contact_type") ?? ""),
    CONTACT_TYPES
  );
  const summary = String(formData.get("summary") ?? "").trim();
  const next_step = String(formData.get("next_step") ?? "").trim() || null;

  if (!contact_date) {
    return { ok: false, error: "Contact date is required." };
  }
  if (!summary) {
    return { ok: false, error: "Summary is required." };
  }

  const svc = (await createServiceClient()) as AnyClient;
  const { error } = await svc
    .schema("yi")
    .from("government_contact_log")
    .insert({
      partnership_id: partnershipId,
      contact_date,
      contact_type,
      summary,
      next_step,
      logged_by: userId,
    });

  if (error) return { ok: false, error: error.message };

  revalidatePath(`/national/admin/government/${partnershipId}`);
  redirect(`/national/admin/government/${partnershipId}`);
}

export async function deleteContactLog(
  id: string,
  partnershipId: string
): Promise<ActionResult> {
  await requireUser();
  const svc = (await createServiceClient()) as AnyClient;
  const { error } = await svc
    .schema("yi")
    .from("government_contact_log")
    .delete()
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/national/admin/government/${partnershipId}`);
  return { ok: true, message: "Contact log entry removed." };
}
