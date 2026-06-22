"use server";

import { createServiceClient } from "@/lib/yip/supabase/server";
import { requireLeadershipRole } from "@/lib/yip/auth/leadership";
import { revalidatePath } from "next/cache";

/**
 * Prime Minister / Deputy Prime Minister "leadership desk" — the GOVERNMENT side.
 *
 * Two halves of the PM's parliamentary job:
 *   1. Present government bills. A ruling-side bill that the organiser has
 *      approved (or that has at least been submitted) is PRESENTED to the House
 *      by the Government. This mirrors the organiser's setBillPresented
 *      field-write (status -> 'presented') EXACTLY, but gated to the PM/DPM and
 *      restricted to ruling-side bills. No new columns: the act of presenting is
 *      the existing status transition.
 *   2. Answer questions / respond to motions across ALL ministries. That logic
 *      already lives in app/yip/actions/ministry.ts (getMinistryDesk /
 *      ministerAnswerQuestion / ministerRespondToMotion already grant
 *      prime_minister + deputy_prime_minister cross-ministry "all" scope). The
 *      PM screen reuses those directly — this file does NOT duplicate the
 *      question/motion answer field-writes (single source of truth).
 *
 * Both the PM AND the organiser can act on a bill; the organiser overrules
 * (last-write-wins). Every action is gated by requireLeadershipRole — the UI
 * hiding a screen is NOT the authorization layer — and re-verifies the bill
 * belongs to this event (no cross-event IDOR). Fail closed on null/unknown.
 */

type ActionResult<T = null> =
  | { success: true; data: T }
  | { success: false; error: string };

const PM_ROLES = ["prime_minister", "deputy_prime_minister"] as const;

export type GovernmentBill = {
  id: string;
  title: string;
  objective: string | null;
  status: string | null;
  party_side: string | null;
  committee_name: string | null;
  votes_for: number | null;
  votes_against: number | null;
  votes_abstain: number | null;
  opposition_response: string | null;
  opposition_response_at: string | null;
};

/**
 * The Government's bills (ruling-side) for this event, for the PM's desk.
 * Participant-session + PM/DPM role gated. Read-only listing; the PM acts via
 * pmPresentBill. Shows the Opposition response so the PM sees the counter.
 */
export async function getPmGovernmentBills(
  eventId: string,
  participantId: string
): Promise<ActionResult<GovernmentBill[]>> {
  const gate = await requireLeadershipRole(participantId, eventId, PM_ROLES);
  if (!gate.ok) return { success: false, error: gate.error };

  const supabase = await createServiceClient();
  const { data, error } = await supabase
    .from("bills")
    .select(
      "id, title, objective, status, party_side, committee_name, votes_for, votes_against, votes_abstain, opposition_response, opposition_response_at"
    )
    .eq("event_id", eventId)
    .eq("party_side", "ruling")
    .order("created_at", { ascending: false });

  if (error) return { success: false, error: error.message };
  // `bills.committee_name` exists in the live DB but the generated Supabase
  // types lag (known drift; tsc — not the DB — is stale here), so the select is
  // typed as a SelectQueryError. Cast via unknown; the column is real at runtime.
  return { success: true, data: (data ?? []) as unknown as GovernmentBill[] };
}

/**
 * Present a government bill to the House. Flips a ruling-side bill that is
 * 'approved' (or 'submitted') to 'presented' — the same field-write the
 * organiser's setBillPresented performs, gated to the PM/DPM and restricted to
 * ruling-side bills in THIS event.
 *
 * Server-side re-fetch of party_side + status (never trusted from the client);
 * the `.in("status", ["approved","submitted"])` guard makes the update a no-op
 * if the bill was already presented/rejected (guards double-processing).
 */
export async function pmPresentBill(
  eventId: string,
  participantId: string,
  billId: string
): Promise<ActionResult> {
  const gate = await requireLeadershipRole(participantId, eventId, PM_ROLES);
  if (!gate.ok) return { success: false, error: gate.error };

  const supabase = await createServiceClient();

  // A government bill may only be presented if it is ruling-side and in this
  // event. Re-fetch server-side — never trust party_side/status from the client.
  const { data: bill } = await supabase
    .from("bills")
    .select("id, party_side, status")
    .eq("id", billId)
    .eq("event_id", eventId) // no cross-event IDOR
    .maybeSingle();
  if (!bill) return { success: false, error: "Bill not found for this event." };
  if (bill.party_side !== "ruling") {
    return { success: false, error: "Only a government bill can be presented by the PM." };
  }
  if (!bill.status || !["approved", "submitted"].includes(bill.status)) {
    return {
      success: false,
      error:
        bill.status === "presented"
          ? "This bill has already been presented."
          : "This bill isn't ready to present yet (it must be approved first).",
    };
  }

  const { error } = await supabase
    .from("bills")
    .update({ status: "presented", updated_at: new Date().toISOString() })
    .eq("id", billId)
    .eq("event_id", eventId)
    .in("status", ["approved", "submitted"]);
  if (error) return { success: false, error: error.message };

  revalidatePath(`/yip/me/pm`);
  revalidatePath(`/yip/me/bill`);
  revalidatePath(`/yip/dashboard/events/${eventId}/bills`);
  return { success: true, data: null };
}
