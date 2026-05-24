"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient, createServiceClient } from "@/lib/yi-future/supabase/server";
import type { Database } from "@/types/yi-future/database";
import type { ActionResult } from "./editions";
import { sendPushToSubject } from "@/app/yi-future/actions/push";

type InterviewOutcome = Database["future"]["Enums"]["interview_outcome"];

async function requireAuth(): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/yi-future/login");
}

export async function scheduleInterview(
  input: { eventId: string },
  formData: FormData
): Promise<ActionResult> {
  await requireAuth();
  const delegate_id = String(formData.get("delegate_id") ?? "").trim();
  const partner_id = String(formData.get("partner_id") ?? "").trim();
  const internship_slot_id =
    String(formData.get("internship_slot_id") ?? "").trim() || null;
  const scheduled_at =
    String(formData.get("scheduled_at") ?? "").trim();
  const duration_raw = String(formData.get("duration_minutes") ?? "").trim();
  const duration_minutes = duration_raw ? Number(duration_raw) : null;
  const room = String(formData.get("room") ?? "").trim() || null;

  if (!delegate_id) return { ok: false, error: "Pick a delegate." };
  if (!partner_id) return { ok: false, error: "Pick a partner." };
  if (!scheduled_at) return { ok: false, error: "Pick a time." };

  const svc = await createServiceClient();

  // Prevent double-booking a delegate or partner at the same time
  const { data: clash } = await svc
    .schema("future")
    .from("interview_slots")
    .select("id, delegate_id, partner_id")
    .eq("event_id", input.eventId)
    .eq("scheduled_at", scheduled_at);
  const clashes = (clash as unknown as {
    id: string;
    delegate_id: string;
    partner_id: string;
  }[]) ?? [];
  for (const c of clashes) {
    if (c.delegate_id === delegate_id) {
      return {
        ok: false,
        error: "This delegate already has an interview at that time.",
      };
    }
    if (c.partner_id === partner_id) {
      return {
        ok: false,
        error: "This partner already has an interview at that time.",
      };
    }
  }

  const { error } = await svc
    .schema("future")
    .from("interview_slots")
    .insert({
      event_id: input.eventId,
      delegate_id,
      partner_id,
      internship_slot_id,
      scheduled_at,
      duration_minutes,
      room,
    });
  if (error) return { ok: false, error: error.message };

  revalidatePath("/yi-future/host/interviews");

  // Fire-and-forget push to the delegate
  try {
    const { data: partner } = await (svc as any)
      .schema("future")
      .from("corporate_partners")
      .select("organization")
      .eq("id", partner_id)
      .maybeSingle();
    const org =
      (partner as { organization: string | null } | null)?.organization ??
      "A partner";
    const when = new Date(scheduled_at).toLocaleString("en-IN", {
      dateStyle: "medium",
      timeStyle: "short",
    });
    await sendPushToSubject("delegate", delegate_id, {
      title: "Interview scheduled",
      body: `${org} · ${when}`,
      url: "/me/interviews",
    });
  } catch (err) {
    console.error("[push] scheduleInterview notify delegate failed:", err);
  }

  redirect("/yi-future/host/interviews");
}

export async function setInterviewOutcome(
  id: string,
  outcome: InterviewOutcome | null,
  partnerNotes: string | null
): Promise<ActionResult> {
  await requireAuth();
  const svc = await createServiceClient();
  const { error } = await svc
    .schema("future")
    .from("interview_slots")
    .update({
      outcome,
      partner_notes: partnerNotes,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/yi-future/host/interviews");
  revalidatePath("/partner");
  return { ok: true };
}

export async function deleteInterview(id: string): Promise<ActionResult> {
  await requireAuth();
  const svc = await createServiceClient();
  const { error } = await svc
    .schema("future")
    .from("interview_slots")
    .delete()
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/yi-future/host/interviews");
  return { ok: true, message: "Interview removed." };
}
