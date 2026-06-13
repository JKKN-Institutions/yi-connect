"use server";

import { createServiceClient } from "@/lib/yip/supabase/server";
import { requireLeadershipRole } from "@/lib/yip/auth/leadership";
import { revalidatePath } from "next/cache";

/**
 * Leader of Opposition desk: move a No-Confidence Motion against the Government
 * and review government (ruling-side) bills.
 *
 * Note: there is no bill-"response" column in yip.bills, so responding to a bill
 * in-app is deferred (would need a migration). The supported opposition power is
 * the No-Confidence Motion (a real motion the Speaker then rules on) + visibility
 * of government bills. Gated to leader_of_opposition.
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
    .select("id, title, objective, status, party_side, votes_for, votes_against, votes_abstain")
    .eq("event_id", eventId)
    .eq("party_side", "ruling")
    .order("created_at", { ascending: false });

  if (error) return { success: false, error: error.message };
  return { success: true, data: (data ?? []) as GovBill[] };
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
