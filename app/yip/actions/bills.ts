"use server";

import { revalidatePath } from "next/cache";
import { createServiceClient } from "@/lib/yip/supabase/server";
import { getYipEventAccess } from "@/lib/yip/auth/event-access";
import { requireParticipantSession } from "@/lib/yip/auth/yip-session";
import { isCommitteeEligible } from "@/lib/yip/committee-assignment";
import type { Tables, Json } from "@/types/yip/database";

type Bill = Tables<{ schema: "yip" }, "bills">;

type ActionResult<T = null> =
  | { success: true; data: T }
  | { success: false; error: string };

// ─── Committee membership gate ─────────────────────────────────
// Bills are now per-COMMITTEE. Only ordinary MPs (parliament_role === "mp")
// assigned to THIS committee may draft/submit its bill. The yip.* tables have
// public INSERT/UPDATE policies, so this server check is the only auth layer.

async function assertCommitteeMember(
  supabase: Awaited<ReturnType<typeof createServiceClient>>,
  participantId: string,
  eventId: string,
  committeeName: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const sess = await requireParticipantSession(participantId, eventId);
  if (!sess.ok) return { ok: false, error: sess.error };
  const { data: p } = await supabase
    .from("participants")
    .select("parliament_role, committee_name")
    .eq("id", participantId)
    .maybeSingle();
  if (!p) return { ok: false, error: "Participant not found." };
  if (!isCommitteeEligible(p.parliament_role) || p.committee_name !== committeeName) {
    return { ok: false, error: "Only this committee's members can draft its bill." };
  }
  return { ok: true };
}

// ─── Committee Report gate ─────────────────────────────────────
// A committee must submit its Committee Report (findings + recommendations)
// BEFORE it can draft its bill — the bill is built from the report. Returns an
// error message when the report is missing/unsubmitted, else null.
async function assertReportSubmitted(
  supabase: Awaited<ReturnType<typeof createServiceClient>>,
  eventId: string,
  committeeName: string
): Promise<string | null> {
  const { data } = await supabase
    .from("committee_reports")
    .select("status")
    .eq("event_id", eventId)
    .eq("committee_name", committeeName)
    .maybeSingle();
  if (data?.status === "submitted") return null;
  return "Submit your Committee Report first — the bill unlocks once the report is in.";
}

// ─── Save Bill Draft (upsert) ──────────────────────────────────

export async function saveBillDraft(
  eventId: string,
  committeeName: string,
  participantId: string,
  data: {
    title: string;
    objective?: string;
    problem_statement?: string;
    provisions?: string[];
    expected_impact?: string;
    implementation?: string;
  }
): Promise<ActionResult<{ billId: string }>> {
  const supabase = await createServiceClient();

  const gate = await assertCommitteeMember(
    supabase,
    participantId,
    eventId,
    committeeName
  );
  if (!gate.ok) return { success: false, error: gate.error };

  // Bill is locked until the committee submits its Committee Report.
  const reportGate = await assertReportSubmitted(supabase, eventId, committeeName);
  if (reportGate) return { success: false, error: reportGate };

  // Check if bill already exists for this committee + event
  const { data: existing } = await supabase
    .from("bills")
    .select("id, status")
    .eq("event_id", eventId)
    .eq("committee_name" as never, committeeName as never)
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
        committee_name: committeeName,
        status: "drafting",
        ...billData,
      } as never)
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
  billId: string,
  participantId: string
): Promise<ActionResult> {
  const supabase = await createServiceClient();

  // Get the bill to validate
  const { data: billRow } = await supabase
    .from("bills")
    .select("id, event_id, committee_name, status, title, objective")
    .eq("id", billId)
    .single();

  if (!billRow) {
    return { success: false, error: "Bill not found" };
  }

  const bill = billRow as unknown as {
    id: string;
    event_id: string;
    committee_name: string | null;
    status: string | null;
    title: string | null;
    objective: string | null;
  };

  if (!bill.committee_name) {
    return { success: false, error: "This bill has no committee." };
  }

  // Only this committee's members may submit its bill.
  const gate = await assertCommitteeMember(
    supabase,
    participantId,
    bill.event_id,
    bill.committee_name
  );
  if (!gate.ok) return { success: false, error: gate.error };

  // Bill is locked until the committee submits its Committee Report.
  const reportGate = await assertReportSubmitted(
    supabase,
    bill.event_id,
    bill.committee_name
  );
  if (reportGate) return { success: false, error: reportGate };

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

// ─── Admin Add Bill (manual — bypasses the committee draft→report→submit flow) ──
// Lets an organiser/chair enter a bill straight from the dashboard Bills page so
// the House can still vote when committees drafted on paper or ran out of time.
// Inserts as "approved" (ready to present) or "submitted" so it immediately
// appears in the Control panel's Bill Presentation session. Event-scoped:
// gated by canManage (chair + organiser), like the other dashboard mutations.
export async function adminCreateBill(
  eventId: string,
  data: {
    committeeName: string;
    title: string;
    objective?: string;
    problemStatement?: string;
    provisions?: string[];
    approved?: boolean;
  }
): Promise<ActionResult<{ billId: string }>> {
  const access = await getYipEventAccess(eventId);
  if (!access.canManage) {
    return {
      success: false,
      error: "You don't have permission to add bills for this event.",
    };
  }

  const title = data.title?.trim();
  const committeeName = data.committeeName?.trim();
  if (!title) return { success: false, error: "Bill title is required." };
  if (!committeeName)
    return { success: false, error: "Pick a committee for the bill." };

  const supabase = await createServiceClient();

  // One bill per committee per event (matches the drafting flow's assumption).
  const { data: existing } = await supabase
    .from("bills")
    .select("id")
    .eq("event_id", eventId)
    .eq("committee_name" as never, committeeName as never)
    .maybeSingle();
  if (existing) {
    return {
      success: false,
      error: `A bill already exists for ${committeeName}. Delete it first to re-add.`,
    };
  }

  const provisions = (data.provisions ?? [])
    .map((p) => p.trim())
    .filter(Boolean);

  const { data: newBill, error } = await supabase
    .from("bills")
    .insert({
      event_id: eventId,
      committee_name: committeeName,
      title,
      objective: data.objective?.trim() || null,
      problem_statement: data.problemStatement?.trim() || null,
      provisions: provisions as unknown as Json,
      status: data.approved ? "approved" : "submitted",
      updated_at: new Date().toISOString(),
    } as never)
    .select("id")
    .single();

  if (error || !newBill) {
    return { success: false, error: error?.message ?? "Failed to add bill" };
  }

  revalidatePath(`/yip/dashboard/events/${eventId}/bills`);
  return { success: true, data: { billId: newBill.id } };
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
    .order("committee_name" as never);

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

// ─── Get Bill for Committee ────────────────────────────────────

export async function getBillForCommittee(
  eventId: string,
  committeeName: string
): Promise<Bill | null> {
  const supabase = await createServiceClient();

  const { data, error } = await supabase
    .from("bills")
    .select("*")
    .eq("event_id", eventId)
    .eq("committee_name" as never, committeeName as never)
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
  committeeName: string
): Promise<BillCommitteeMember[]> {
  const supabase = await createServiceClient();

  const { data, error } = await supabase
    .from("participants")
    .select("id, full_name, parliament_role, party_side, school_name")
    .eq("event_id", eventId)
    .eq("committee_name", committeeName)
    .eq("parliament_role", "mp")
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
