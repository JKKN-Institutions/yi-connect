"use server";

import { createServiceClient } from "@/lib/yip/supabase/server";
import { getYipEventAccess } from "@/lib/yip/auth/event-access";
import type { Tables, Json } from "@/types/yip/database";

type Bill = Tables<{ schema: "yip" }, "bills">;

type ActionResult<T = null> =
  | { success: true; data: T }
  | { success: false; error: string };

// ─── Save Bill Draft (upsert) ──────────────────────────────────

export async function saveBillDraft(
  eventId: string,
  partySide: "ruling" | "opposition",
  data: {
    title: string;
    objective?: string;
    problem_statement?: string;
    provisions?: string[];
    expected_impact?: string;
    implementation?: string;
  }
): Promise<ActionResult<{ billId: string }>> {
  // TODO(self-service): saveBillDraft may be participant-authored (a student
  // drafting their party's bill). It takes no participantId actor, so gate on
  // canManage as the safe baseline for now; verify participant session later.
  const access = await getYipEventAccess(eventId);
  if (!access.canManage) {
    return { success: false, error: "Not authorized to manage this event" };
  }

  const supabase = await createServiceClient();

  // Check if bill already exists for this party + event
  const { data: existing } = await supabase
    .from("bills")
    .select("id, status")
    .eq("event_id", eventId)
    .eq("party_side", partySide)
    .maybeSingle();

  // If already submitted/approved/etc, don't allow draft edits
  if (existing && existing.status !== "drafting") {
    return {
      success: false,
      error: "Bill has already been submitted and cannot be edited.",
    };
  }

  const billData = {
    title: data.title || "Untitled Bill",
    objective: data.objective || null,
    problem_statement: data.problem_statement || null,
    provisions: (data.provisions ?? []) as unknown as Json,
    expected_impact: data.expected_impact || null,
    implementation: data.implementation || null,
    updated_at: new Date().toISOString(),
  };

  if (existing) {
    // Update existing draft
    const { error } = await supabase
      .from("bills")
      .update(billData)
      .eq("id", existing.id);

    if (error) return { success: false, error: error.message };
    return { success: true, data: { billId: existing.id } };
  } else {
    // Create new bill
    const { data: newBill, error } = await supabase
      .from("bills")
      .insert({
        event_id: eventId,
        party_side: partySide,
        status: "drafting",
        ...billData,
      })
      .select("id")
      .single();

    if (error || !newBill) {
      return { success: false, error: error?.message ?? "Failed to create bill" };
    }
    return { success: true, data: { billId: newBill.id } };
  }
}

// ─── Submit Bill ───────────────────────────────────────────────

export async function submitBill(
  billId: string
): Promise<ActionResult> {
  const supabase = await createServiceClient();

  // Get the bill to validate
  const { data: bill } = await supabase
    .from("bills")
    .select("id, event_id, status, title, objective, provisions")
    .eq("id", billId)
    .single();

  if (!bill) {
    return { success: false, error: "Bill not found" };
  }

  // TODO(self-service): submitBill may be participant-authored. It takes only a
  // billId (no participantId actor), so gate on canManage as the safe baseline.
  const access = await getYipEventAccess(bill.event_id);
  if (!access.canManage) {
    return { success: false, error: "Not authorized to manage this event" };
  }

  if (bill.status !== "drafting") {
    return { success: false, error: "Bill has already been submitted" };
  }

  // Basic validation
  if (!bill.title || bill.title === "Untitled Bill") {
    return { success: false, error: "Bill must have a title" };
  }

  if (!bill.objective) {
    return { success: false, error: "Bill must have an objective" };
  }

  const { error } = await supabase
    .from("bills")
    .update({
      status: "submitted",
      updated_at: new Date().toISOString(),
    })
    .eq("id", billId);

  if (error) return { success: false, error: error.message };
  return { success: true, data: null };
}

// ─── Approve Bill ──────────────────────────────────────────────

export async function approveBill(
  billId: string
): Promise<ActionResult> {
  const supabase = await createServiceClient();

  const { data: bill } = await supabase
    .from("bills")
    .select("event_id")
    .eq("id", billId)
    .single();

  if (!bill) {
    return { success: false, error: "Bill not found" };
  }

  const access = await getYipEventAccess(bill.event_id);
  if (!access.canManage) {
    return { success: false, error: "Not authorized to manage this event" };
  }

  const { error } = await supabase
    .from("bills")
    .update({
      status: "approved",
      updated_at: new Date().toISOString(),
    })
    .eq("id", billId)
    .eq("status", "submitted");

  if (error) return { success: false, error: error.message };
  return { success: true, data: null };
}

// ─── Reject Bill ───────────────────────────────────────────────

export async function rejectBill(
  billId: string
): Promise<ActionResult> {
  const supabase = await createServiceClient();

  const { data: bill } = await supabase
    .from("bills")
    .select("event_id")
    .eq("id", billId)
    .single();

  if (!bill) {
    return { success: false, error: "Bill not found" };
  }

  const access = await getYipEventAccess(bill.event_id);
  if (!access.canManage) {
    return { success: false, error: "Not authorized to manage this event" };
  }

  const { error } = await supabase
    .from("bills")
    .update({
      status: "rejected",
      updated_at: new Date().toISOString(),
    })
    .eq("id", billId)
    .eq("status", "submitted");

  if (error) return { success: false, error: error.message };
  return { success: true, data: null };
}

// ─── Set Bill as Presented ─────────────────────────────────────

export async function setBillPresented(
  billId: string
): Promise<ActionResult> {
  const supabase = await createServiceClient();

  const { data: bill } = await supabase
    .from("bills")
    .select("event_id")
    .eq("id", billId)
    .single();

  if (!bill) {
    return { success: false, error: "Bill not found" };
  }

  const access = await getYipEventAccess(bill.event_id);
  if (!access.canManage) {
    return { success: false, error: "Not authorized to manage this event" };
  }

  const { error } = await supabase
    .from("bills")
    .update({
      status: "presented",
      updated_at: new Date().toISOString(),
    })
    .eq("id", billId)
    .in("status", ["approved", "submitted"]);

  if (error) return { success: false, error: error.message };
  return { success: true, data: null };
}

// ─── Get Both Bills for Event ──────────────────────────────────

export type BillWithMembers = Bill & {
  lead_drafter_name?: string | null;
  presenter_1_name?: string | null;
  presenter_2_name?: string | null;
  policy_researcher_name?: string | null;
};

export async function getBills(
  eventId: string
): Promise<BillWithMembers[]> {
  const supabase = await createServiceClient();

  const { data, error } = await supabase
    .from("bills")
    .select(
      `
      *,
      lead_drafter_participant:participants!bills_lead_drafter_fkey(full_name),
      presenter_1_participant:participants!bills_presenter_1_fkey(full_name),
      presenter_2_participant:participants!bills_presenter_2_fkey(full_name),
      policy_researcher_participant:participants!bills_policy_researcher_fkey(full_name)
    `
    )
    .eq("event_id", eventId)
    .order("party_side");

  if (error || !data) return [];

  return data.map((bill) => {
    const ld = bill.lead_drafter_participant as unknown as { full_name: string } | null;
    const p1 = bill.presenter_1_participant as unknown as { full_name: string } | null;
    const p2 = bill.presenter_2_participant as unknown as { full_name: string } | null;
    const pr = bill.policy_researcher_participant as unknown as { full_name: string } | null;

    return {
      ...bill,
      lead_drafter_name: ld?.full_name ?? null,
      presenter_1_name: p1?.full_name ?? null,
      presenter_2_name: p2?.full_name ?? null,
      policy_researcher_name: pr?.full_name ?? null,
      // Remove the joined relations from the final object
      lead_drafter_participant: undefined,
      presenter_1_participant: undefined,
      presenter_2_participant: undefined,
      policy_researcher_participant: undefined,
    } as BillWithMembers;
  });
}

// ─── Get Bill for Party ────────────────────────────────────────

export async function getBillForParty(
  eventId: string,
  partySide: "ruling" | "opposition"
): Promise<Bill | null> {
  const supabase = await createServiceClient();

  const { data, error } = await supabase
    .from("bills")
    .select("*")
    .eq("event_id", eventId)
    .eq("party_side", partySide)
    .maybeSingle();

  if (error || !data) return null;
  return data;
}

// ─── Get Bill Committee Members ────────────────────────────────

export interface BillCommitteeMember {
  id: string;
  full_name: string;
  parliament_role: string | null;
  party_side: string | null;
  school_name: string;
}

export async function getBillCommitteeMembers(
  eventId: string,
  partySide: "ruling" | "opposition"
): Promise<BillCommitteeMember[]> {
  const supabase = await createServiceClient();

  const { data, error } = await supabase
    .from("participants")
    .select("id, full_name, parliament_role, party_side, school_name")
    .eq("event_id", eventId)
    .eq("party_side", partySide)
    .eq("parliament_role", "bill_committee")
    .order("full_name");

  if (error || !data) return [];
  return data;
}

// ─── Assign Committee Roles to Bill ────────────────────────────

export async function assignBillCommitteeRoles(
  billId: string,
  roles: {
    lead_drafter?: string | null;
    presenter_1?: string | null;
    presenter_2?: string | null;
    policy_researcher?: string | null;
  }
): Promise<ActionResult> {
  const supabase = await createServiceClient();

  const { data: bill } = await supabase
    .from("bills")
    .select("event_id")
    .eq("id", billId)
    .single();

  if (!bill) {
    return { success: false, error: "Bill not found" };
  }

  const access = await getYipEventAccess(bill.event_id);
  if (!access.canManage) {
    return { success: false, error: "Not authorized to manage this event" };
  }

  const { error } = await supabase
    .from("bills")
    .update({
      lead_drafter: roles.lead_drafter ?? null,
      presenter_1: roles.presenter_1 ?? null,
      presenter_2: roles.presenter_2 ?? null,
      policy_researcher: roles.policy_researcher ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", billId);

  if (error) return { success: false, error: error.message };
  return { success: true, data: null };
}
