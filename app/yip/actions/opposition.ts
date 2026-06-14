"use server";

import { createServiceClient } from "@/lib/yip/supabase/server";
import { requireLeadershipRole } from "@/lib/yip/auth/leadership";
import { revalidatePath } from "next/cache";

/**
 * Leader of Opposition desk: move a No-Confidence Motion against the Government,
 * review government (ruling-side) bills, and record the official Opposition
 * response to a government bill.
 *
 * The Opposition response writes yip.bills.opposition_response (+ _at) — mirrors
 * the way a minister writes motions.minister_response. Both the LoP AND the
 * organiser can act; the organiser overrules (last-write-wins). All gated to
 * leader_of_opposition via requireLeadershipRole.
 */

type ActionResult<T = null> =
  | { success: true; data: T }
  | { success: false; error: string };

const OPPOSITION_ROLES = ["leader_of_opposition"] as const;

export type GovBill = {
  id: string;
  title: string;
  objective: string | null;
  status: string;
  party_side: string | null;
  votes_for: number;
  votes_against: number;
  votes_abstain: number;
  opposition_response: string | null;
  opposition_response_at: string | null;
};

export async function getGovernmentBills(
  eventId: string,
  participantId: string
): Promise<ActionResult<GovBill[]>> {
  const gate = await requireLeadershipRole(participantId, eventId, OPPOSITION_ROLES);
  if (!gate.ok) return { success: false, error: gate.error };

  const supabase = await createServiceClient();
  const { data, error } = await supabase
    .from("bills")
    .select(
      "id, title, objective, status, party_side, votes_for, votes_against, votes_abstain, opposition_response, opposition_response_at"
    )
    .eq("event_id", eventId)
    .eq("party_side", "ruling")
    .order("created_at", { ascending: false });

  if (error) return { success: false, error: error.message };
  return { success: true, data: (data ?? []) as GovBill[] };
}

/**
 * Record (or update) the Opposition's official response to a government bill.
 * Gated to the Leader of Opposition; the bill must be a ruling-side bill in the
 * same event. Last-write-wins (the LoP can revise; the organiser can overrule).
 */
export async function oppositionRespondToBill(
  eventId: string,
  participantId: string,
  billId: string,
  response: string
): Promise<ActionResult> {
  const gate = await requireLeadershipRole(participantId, eventId, OPPOSITION_ROLES);
  if (!gate.ok) return { success: false, error: gate.error };

  const text = response.trim();
  if (text.length < 10) return { success: false, error: "Response must be at least 10 characters." };
  if (text.length > 2000)
    return { success: false, error: "Response is too long (max 2000 characters)." };

  const supabase = await createServiceClient();

  // The response may only attach to a GOVERNMENT (ruling-side) bill in THIS event.
  // Re-fetch server-side — never trust party_side from the client.
  const { data: bill } = await supabase
    .from("bills")
    .select("id, party_side")
    .eq("id", billId)
    .eq("event_id", eventId)
    .maybeSingle();
  if (!bill) return { success: false, error: "Bill not found for this event." };
  if (bill.party_side !== "ruling") {
    return { success: false, error: "You can only respond to a government bill." };
  }

  const { error } = await supabase
    .from("bills")
    .update({ opposition_response: text, opposition_response_at: new Date().toISOString() })
    .eq("id", billId)
    .eq("event_id", eventId);
  if (error) return { success: false, error: error.message };

  revalidatePath(`/yip/me/opposition`);
  revalidatePath(`/yip/me/bill`);
  revalidatePath(`/yip/dashboard/events/${eventId}/bills`);
  return { success: true, data: null };
}

/** Move a No-Confidence Motion. Mirrors raiseMotion's insert, gated to the LoP. */
export async function moveNoConfidence(
  eventId: string,
  participantId: string,
  subject: string,
  details: string
): Promise<ActionResult<{ id: string }>> {
  const gate = await requireLeadershipRole(participantId, eventId, OPPOSITION_ROLES);
  if (!gate.ok) return { success: false, error: gate.error };

  const s = subject.trim();
  const d = details.trim();
  if (s.length < 5) return { success: false, error: "Subject must be at least 5 characters" };
  if (d.length < 20) return { success: false, error: "Details must be at least 20 characters" };

  const supabase = await createServiceClient();
  const p = gate.participant;

  // One active No-Confidence Motion per LoP — don't let it flood the Speaker's queue.
  const { data: existing } = await supabase
    .from("motions")
    .select("status")
    .eq("event_id", eventId)
    .eq("raised_by_id", p.id)
    .eq("motion_type", "no_confidence");
  const active = (existing ?? []).filter(
    (x) => !["resolved", "rejected"].includes((x as { status: string }).status)
  ).length;
  if (active >= 1) {
    return { success: false, error: "You already have a No-Confidence Motion before the House." };
  }

  const { data, error } = await supabase
    .from("motions")
    .insert({
      event_id: eventId,
      motion_type: "no_confidence",
      subject: s,
      details: d,
      directed_to_ministry: null,
      raised_by_id: p.id,
      raised_by_name: p.full_name,
      raised_by_role: p.parliament_role,
      status: "submitted",
    })
    .select("id")
    .single();

  if (error || !data) {
    return { success: false, error: error?.message ?? "Failed to move the motion" };
  }

  revalidatePath(`/yip/dashboard/events/${eventId}/motions`);
  revalidatePath(`/yip/me/opposition`);
  return { success: true, data: { id: data.id } };
}
