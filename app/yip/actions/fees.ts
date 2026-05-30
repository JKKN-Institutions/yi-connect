"use server";

import { createServiceClient } from "@/lib/yip/supabase/server";
import { getYipEventAccess } from "@/lib/yip/auth/event-access";
import { revalidatePath } from "next/cache";

type ActionResult<T = null> =
  | { success: true; data: T }
  | { success: false; error: string };

export type ParticipantFee = {
  id: string;
  participant_id: string;
  event_id: string;
  amount_inr: number;
  includes_gst: boolean;
  payment_link: string | null;
  transaction_ref: string | null;
  is_paid: boolean;
  paid_at: string | null;
  paid_via: string | null;
  note: string | null;
};

export async function setEventPaymentConfig(
  eventId: string,
  mycii_payment_link: string | null,
  mycii_event_registered: boolean,
  fee_per_participant_inr: number = 399
): Promise<ActionResult> {
  const access = await getYipEventAccess(eventId);
  if (!access.canManage) {
    return { success: false, error: "Not authorized to manage this event" };
  }

  const supabase = await createServiceClient();
  const { error } = await supabase
    .from("events")
    .update({ mycii_payment_link, mycii_event_registered, fee_per_participant_inr })
    .eq("id", eventId);

  if (error) return { success: false, error: error.message };
  revalidatePath(`/yip/dashboard/events/${eventId}`);
  return { success: true, data: null };
}

export async function listFees(eventId: string): Promise<ParticipantFee[]> {
  const supabase = await createServiceClient();
  const { data } = await supabase
    .from("fees")
    .select("*")
    .eq("event_id", eventId)
    .order("created_at", { ascending: false });
  return (data ?? []) as ParticipantFee[];
}

export async function markFeePaid(
  participantId: string,
  eventId: string,
  options?: {
    amount_inr?: number;
    transaction_ref?: string;
    paid_via?: "mycii" | "cash" | "upi" | "other";
    note?: string;
  }
): Promise<ActionResult<ParticipantFee>> {
  const access = await getYipEventAccess(eventId);
  if (!access.canManage) {
    return { success: false, error: "Not authorized to manage this event" };
  }

  const supabase = await createServiceClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from("fees")
    .upsert(
      {
        participant_id: participantId,
        event_id: eventId,
        amount_inr: options?.amount_inr ?? 399,
        transaction_ref: options?.transaction_ref ?? null,
        paid_via: options?.paid_via ?? "mycii",
        note: options?.note ?? null,
        is_paid: true,
        paid_at: new Date().toISOString(),
        recorded_by: user?.id ?? null,
      },
      { onConflict: "participant_id" }
    )
    .select()
    .single();

  if (error) return { success: false, error: error.message };
  revalidatePath(`/yip/dashboard/events/${eventId}/fees`);
  revalidatePath(`/yip/dashboard/events/${eventId}/participants`);
  return { success: true, data: data as ParticipantFee };
}

export async function markFeeUnpaid(
  participantId: string,
  eventId: string
): Promise<ActionResult> {
  const access = await getYipEventAccess(eventId);
  if (!access.canManage) {
    return { success: false, error: "Not authorized to manage this event" };
  }

  const supabase = await createServiceClient();
  const { error } = await supabase
    .from("fees")
    .update({ is_paid: false, paid_at: null, transaction_ref: null })
    .eq("participant_id", participantId);

  if (error) return { success: false, error: error.message };
  revalidatePath(`/yip/dashboard/events/${eventId}/fees`);
  return { success: true, data: null };
}

export async function getFeeStats(eventId: string): Promise<{
  total_participants: number;
  paid: number;
  unpaid: number;
  total_collected_inr: number;
  expected_inr: number;
}> {
  const supabase = await createServiceClient();

  const [participantsRes, feesRes, eventRes] = await Promise.all([
    supabase.from("participants").select("id", { count: "exact" }).eq("event_id", eventId),
    supabase
      .from("fees")
      .select("amount_inr, is_paid")
      .eq("event_id", eventId),
    supabase
      .from("events")
      .select("fee_per_participant_inr")
      .eq("id", eventId)
      .single(),
  ]);

  const feeDefault = eventRes.data?.fee_per_participant_inr ?? 399;
  const total = participantsRes.count ?? 0;
  const fees = feesRes.data ?? [];
  const paid = fees.filter((f) => f.is_paid).length;
  const collected = fees
    .filter((f) => f.is_paid)
    .reduce((sum, f) => sum + (f.amount_inr ?? 0), 0);

  return {
    total_participants: total,
    paid,
    unpaid: total - paid,
    total_collected_inr: collected,
    expected_inr: total * feeDefault,
  };
}
