"use server";

import { revalidatePath } from "next/cache";
import { randomUUID } from "node:crypto";
import { createServiceClient } from "@/lib/yip/supabase/server";
import { getYipEventAccess } from "@/lib/yip/auth/event-access";
import { requireParticipantSession } from "@/lib/yip/auth/yip-session";
import { isCommitteeEligible } from "@/lib/yip/committee-assignment";
import {
  isGovernmentMinister,
  canMovePrivateMemberBill,
  isMissingBillSourceError,
  type BillSource,
} from "@/lib/yip/bill-sources";
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

  // Per-event early-unlock: organisers can open bill drafting BEFORE the report
  // is submitted (e.g. so large committees pre-draft a few days ahead). The
  // column defaults false, so the report gate stands unless explicitly opened.
  const { data: ev } = await supabase
    .from("events")
    .select("allow_bill_before_report")
    .eq("id", eventId)
    .maybeSingle();
  if (ev?.allow_bill_before_report) return null;

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
//
// Regional Round (2026): also creates GOVERNMENT bills (Cabinet-prepared,
// moved by their concerned Minister) and PRIVATE MEMBERS' bills (moved by a
// non-minister Member). Both carry committee_name NULL (no drafting committee)
// and record the mover in mover_participant_id. The mover is ALSO mirrored
// into presenter_1 so every existing presenter consumer — projector display
// join, jury scoring flow — resolves the mover with zero changes.
export async function adminCreateBill(
  eventId: string,
  data: {
    committeeName: string;
    title: string;
    objective?: string;
    problemStatement?: string;
    provisions?: string[];
    approved?: boolean;
    /**
     * Admin-only "extra bill": add an ADDITIONAL bill for a committee that
     * already has one, for putting multiple bills to a floor vote. To stay safe
     * on the live 1:1 committee↔bill model (a DB unique constraint + ~10
     * single-row committee lookups incl. the student "My Bill" card), an extra
     * bill is stored with committee_name = NULL (so it never collides with the
     * constraint or the student's own bill) and the committee is embedded in the
     * title instead. It is fully presentable/votable (present + vote go by id).
     */
    extra?: boolean;
    /**
     * Bill origin (default "committee" — the pre-Regional-Round behaviour).
     * "government" / "private_member" require moverParticipantId and ignore
     * committeeName (these bills have no drafting committee).
     */
    source?: BillSource;
    /** The Minister (government) or Member (private_member) who moves the bill. */
    moverParticipantId?: string;
  }
): Promise<ActionResult<{ billId: string; degraded?: boolean }>> {
  const access = await getYipEventAccess(eventId);
  if (!access.canManage) {
    return {
      success: false,
      error: "You don't have permission to add bills for this event.",
    };
  }

  const source: BillSource =
    data.source === "government" || data.source === "private_member"
      ? data.source
      : "committee";

  let title = data.title?.trim();
  const committeeName = data.committeeName?.trim();
  if (!title) return { success: false, error: "Bill title is required." };
  if (source === "committee" && !committeeName)
    return { success: false, error: "Pick a committee for the bill." };

  const supabase = await createServiceClient();

  // Government / Private Member's bill: validate the mover, then insert a
  // committee-unlinked bill (same shape as an "extra" bill) with the new
  // source columns + presenter_1 = mover. Falls back without the new columns
  // when the bill-sources migration hasn't been applied yet.
  if (source !== "committee") {
    const moverId = data.moverParticipantId?.trim();
    if (!moverId) {
      return {
        success: false,
        error:
          source === "government"
            ? "Pick the Minister who moves this Government Bill."
            : "Pick the Member who moves this Private Member's Bill.",
      };
    }

    // The mover must belong to THIS event and hold an eligible role (the UI
    // only offers eligible people, but this action is the only real guard).
    const { data: mover } = await supabase
      .from("participants")
      .select("id, parliament_role")
      .eq("id", moverId)
      .eq("event_id", eventId)
      .maybeSingle();
    if (!mover) {
      return { success: false, error: "Mover not found in this event." };
    }
    if (source === "government" && !isGovernmentMinister(mover.parliament_role)) {
      return {
        success: false,
        error: "A Government Bill must be moved by a Cabinet Minister (PM, Deputy PM or a Minister).",
      };
    }
    if (source === "private_member" && !canMovePrivateMemberBill(mover.parliament_role)) {
      return {
        success: false,
        error: "A Private Member's Bill must be moved by a Member who is NOT a government minister.",
      };
    }

    const provisions = (data.provisions ?? [])
      .map((p) => p.trim())
      .filter(Boolean)
      .map((text) => ({ id: randomUUID(), text }));

    const basePayload = {
      event_id: eventId,
      committee_name: null, // no drafting committee — never collides with the 1:1 committee↔bill constraint
      title,
      objective: data.objective?.trim() || null,
      problem_statement: data.problemStatement?.trim() || null,
      provisions: provisions as unknown as Json,
      status: data.approved ? "approved" : "submitted",
      // Mirror the mover into presenter_1: the projector display and the jury
      // scoring flow already resolve presenter_1 as "who presents this bill".
      presenter_1: moverId,
      updated_at: new Date().toISOString(),
    };

    // Attempt with the new columns first (post-migration path).
    const attempt = await supabase
      .from("bills")
      .insert({
        ...basePayload,
        source,
        mover_participant_id: moverId,
      } as never)
      .select("id")
      .single();

    if (!attempt.error && attempt.data) {
      revalidatePath(`/yip/dashboard/events/${eventId}/bills`);
      return { success: true, data: { billId: attempt.data.id } };
    }

    // Migration not applied yet → retry WITHOUT source/mover columns. The bill
    // still works end-to-end (mover = presenter_1); it just shows as a generic
    // committee-unlinked bill until the migration lands.
    if (isMissingBillSourceError(attempt.error)) {
      const { data: fallback, error: fallbackError } = await supabase
        .from("bills")
        .insert(basePayload as never)
        .select("id")
        .single();
      if (fallbackError || !fallback) {
        return {
          success: false,
          error: fallbackError?.message ?? "Failed to add bill",
        };
      }
      revalidatePath(`/yip/dashboard/events/${eventId}/bills`);
      return { success: true, data: { billId: fallback.id, degraded: true } };
    }

    return {
      success: false,
      error: attempt.error?.message ?? "Failed to add bill",
    };
  }

  if (!committeeName)
    return { success: false, error: "Pick a committee for the bill." };

  // Normal add is strictly one bill per committee (matches the drafting flow +
  // DB constraint). An admin "extra" bill intentionally skips this and is stored
  // committee-unlinked (committee_name NULL) so it can't collide.
  if (!data.extra) {
    const { data: existing } = await supabase
      .from("bills")
      .select("id")
      .eq("event_id", eventId)
      .eq("committee_name" as never, committeeName as never)
      .maybeSingle();
    if (existing) {
      return {
        success: false,
        error: `A bill already exists for ${committeeName}. Add it as an extra bill, or delete the existing one first.`,
      };
    }
  } else {
    // Keep the committee visible on the (committee-unlinked) extra bill by
    // embedding it in the title, unless the admin already did.
    if (!title.toLowerCase().startsWith(committeeName.toLowerCase())) {
      title = `${committeeName} — ${title}`;
    }
  }

  // Store the new stable {id,text}[] clause shape (matches the Committee Room).
  const provisions = (data.provisions ?? [])
    .map((p) => p.trim())
    .filter(Boolean)
    .map((text) => ({ id: randomUUID(), text }));

  const { data: newBill, error } = await supabase
    .from("bills")
    .insert({
      event_id: eventId,
      // Extra bills are committee-unlinked (NULL) to dodge the unique constraint
      // and never shadow the committee's real (student-drafted) bill.
      committee_name: data.extra ? null : committeeName,
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
  billId: string,
  // Organiser override: when true, present a bill in ANY status (incl. a still
  // "drafting" or "rejected" bill) so it can be put to a floor vote. Absent/false
  // keeps the normal gate (only approved/submitted bills may be presented).
  force = false
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

  let update = supabase
    .from("bills")
    .update({
      status: "presented",
      updated_at: new Date().toISOString(),
    })
    .eq("id", billId);
  if (!force) update = update.in("status", ["approved", "submitted"]);
  const { error } = await update;

  if (error) return { success: false, error: error.message };
  return { success: true, data: null };
}

// ─── Get Both Bills for Event ──────────────────────────────────

export type BillWithMembers = Bill & {
  lead_drafter_name?: string | null;
  presenter_1_name?: string | null;
  presenter_2_name?: string | null;
  policy_researcher_name?: string | null;
  // Regional Round bill sources — absent until the bill-sources migration is
  // applied (select("*") simply doesn't return the columns), so every consumer
  // must treat undefined as "committee" (lib/yip/bill-sources billSourceOf).
  source?: string | null;
  mover_participant_id?: string | null;
  mover_name?: string | null;
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

  // Resolve mover names in ONE extra query. mover_participant_id has no FK
  // (house style), so PostgREST can't join it — and pre-migration the column
  // isn't returned by select("*") at all, leaving this a no-op.
  const moverIds = [
    ...new Set(
      data
        .map(
          (b) =>
            (b as { mover_participant_id?: string | null })
              .mover_participant_id ?? null
        )
        .filter((id): id is string => !!id)
    ),
  ];
  const moverNameById = new Map<string, string>();
  if (moverIds.length > 0) {
    const { data: movers } = await supabase
      .from("participants")
      .select("id, full_name")
      .in("id", moverIds);
    for (const m of movers ?? []) moverNameById.set(m.id, m.full_name);
  }

  return data.map((bill) => {
    const ld = bill.lead_drafter_participant as unknown as { full_name: string } | null;
    const p1 = bill.presenter_1_participant as unknown as { full_name: string } | null;
    const p2 = bill.presenter_2_participant as unknown as { full_name: string } | null;
    const pr = bill.policy_researcher_participant as unknown as { full_name: string } | null;
    const moverId =
      (bill as { mover_participant_id?: string | null }).mover_participant_id ??
      null;

    return {
      ...bill,
      lead_drafter_name: ld?.full_name ?? null,
      presenter_1_name: p1?.full_name ?? null,
      presenter_2_name: p2?.full_name ?? null,
      policy_researcher_name: pr?.full_name ?? null,
      mover_name: moverId ? moverNameById.get(moverId) ?? null : null,
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
  },
  participantId: string
): Promise<ActionResult> {
  const supabase = await createServiceClient();

  const { data: billRow } = await supabase
    .from("bills")
    .select("event_id, committee_name, status")
    .eq("id", billId)
    .single();

  if (!billRow) {
    return { success: false, error: "Bill not found" };
  }

  const bill = billRow as unknown as {
    event_id: string;
    committee_name: string | null;
    status: string | null;
  };

  if (!bill.committee_name) {
    return { success: false, error: "This bill has no committee." };
  }

  // Only THIS committee's members may assign its roles — same gate as
  // saveBillDraft / submitBill. The yip.* tables have public INSERT/UPDATE
  // policies, so this server check is the only authorization layer.
  const gate = await assertCommitteeMember(
    supabase,
    participantId,
    bill.event_id,
    bill.committee_name
  );
  if (!gate.ok) return { success: false, error: gate.error };

  // Roles lock once the bill leaves drafting (mirrors the form lock).
  if (bill.status !== "drafting") {
    return {
      success: false,
      error: "The bill has been submitted — committee roles are locked.",
    };
  }

  // Integrity: every assigned person must be a member of THIS committee, so a
  // foreign/bad id can't be written as a role. The UI only offers committee
  // members, but the action is the only real guard (public write policy).
  const assignedIds = [
    roles.lead_drafter,
    roles.presenter_1,
    roles.presenter_2,
    roles.policy_researcher,
  ].filter((v): v is string => !!v);

  if (assignedIds.length > 0) {
    const { data: valid } = await supabase
      .from("participants")
      .select("id")
      .eq("event_id", bill.event_id)
      .eq("committee_name", bill.committee_name)
      .in("id", assignedIds);
    const validIds = new Set((valid ?? []).map((p) => p.id));
    if (assignedIds.some((id) => !validIds.has(id))) {
      return {
        success: false,
        error: "One of the selected people isn't on this committee.",
      };
    }
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
  revalidatePath(`/yip/dashboard/events/${bill.event_id}/bills`);
  return { success: true, data: null };
}

// ─── Per-event early-unlock toggle ─────────────────────────────
// Opens bill drafting BEFORE the Committee Report is submitted, so large
// committees can pre-draft a few days ahead. Event-scoped (gated by canManage);
// saves immediately, independent of the event Save button. Default false keeps
// the report gate in place.
export async function setBillEarlyUnlock(
  eventId: string,
  allow: boolean
): Promise<ActionResult> {
  const access = await getYipEventAccess(eventId);
  if (!access.canManage) {
    return { success: false, error: "Not authorized to manage this event" };
  }

  const supabase = await createServiceClient();
  const { error } = await supabase
    .from("events")
    .update({ allow_bill_before_report: allow })
    .eq("id", eventId);

  if (error) return { success: false, error: error.message };
  revalidatePath(`/yip/dashboard/events/${eventId}/edit`);
  return { success: true, data: null };
}

// ═══════════════════════════════════════════════════════════════════════
// STUDENT-SUBMITTED PRIVATE MEMBERS' BILLS
//
// Until now a Private Member's Bill could only be typed in by an organiser on
// the bills dashboard, which meant a student who wrote one had to hand the text
// over off-platform and hope it was entered before the session. The Regional
// Round has a "Private Members' Bills" agenda item, so that gap is felt on the
// day.
//
// These three actions let the Member draft and hand in their own, and produce a
// row IDENTICAL to the one adminCreateBill writes — same source, same null
// committee_name, same {id,text} provisions, same presenter_1 mirror. Nothing
// downstream needs to know a student typed it: the organiser board, the
// projector join and the jury flow all already read that shape.
//
// Deliberately NO new window mechanism. Approval is the gate — a bill sits at
// `submitted` until an organiser approves it on the board they already use, and
// only an approved bill reaches the floor. Inventing a second window system
// beside self_nomination_windows and questionnaire_windows would be a third
// place to forget to open.
// ═══════════════════════════════════════════════════════════════════════

/** One Private Member's Bill per Member — theirs, and only while eligible. */
async function assertCanMoveOwnPrivateBill(
  supabase: Awaited<ReturnType<typeof createServiceClient>>,
  participantId: string,
  eventId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const sess = await requireParticipantSession(participantId, eventId);
  if (!sess.ok) return { ok: false, error: sess.error };
  const { data: p } = await supabase
    .from("participants")
    .select("id, parliament_role")
    .eq("id", participantId)
    .eq("event_id", eventId)
    .maybeSingle();
  if (!p) return { ok: false, error: "Participant not found for this event." };
  // Same rule the organiser's own form enforces: a Private Member's Bill is
  // moved by an ordinary Member, never by a government minister, a presiding
  // officer, or anyone on official duty.
  if (!canMovePrivateMemberBill(p.parliament_role)) {
    return {
      ok: false,
      error:
        "A Private Member's Bill is moved by an ordinary Member. Ministers, the Speaker and Deputy Speaker cannot move one.",
    };
  }
  return { ok: true };
}

/** The caller's own Private Member's Bill, or null if they have not started one. */
export async function getMyPrivateMemberBill(
  eventId: string,
  participantId: string
): Promise<
  ActionResult<{
    bill: {
      id: string;
      title: string;
      objective: string | null;
      problemStatement: string | null;
      provisions: string[];
      status: string;
    } | null;
    canSubmit: boolean;
  }>
> {
  const supabase = await createServiceClient();
  const gate = await assertCanMoveOwnPrivateBill(supabase, participantId, eventId);
  if (!gate.ok) return { success: false, error: gate.error };

  const { data: row } = await supabase
    .from("bills")
    .select("id, title, objective, problem_statement, provisions, status")
    .eq("event_id", eventId)
    .eq("source", "private_member")
    .eq("mover_participant_id", participantId)
    .maybeSingle();

  if (!row) return { success: true, data: { bill: null, canSubmit: true } };

  const provisions = Array.isArray(row.provisions)
    ? (row.provisions as { text?: unknown }[])
        .map((p) => (typeof p?.text === "string" ? p.text : ""))
        .filter(Boolean)
    : [];

  return {
    success: true,
    data: {
      bill: {
        id: row.id as string,
        title: (row.title as string) ?? "",
        objective: (row.objective as string | null) ?? null,
        problemStatement: (row.problem_statement as string | null) ?? null,
        provisions,
        status: (row.status as string) ?? "drafting",
      },
      canSubmit: true,
    },
  };
}

/**
 * Save the caller's own Private Member's Bill as a DRAFT.
 *
 * Creates it on first save and updates it thereafter — one per Member, keyed on
 * (event, source, mover). Editing stops once it has been handed in: a bill an
 * organiser may already have read and approved must not change underneath them.
 */
export async function saveMyPrivateMemberBillDraft(
  eventId: string,
  participantId: string,
  data: {
    title: string;
    objective?: string;
    problemStatement?: string;
    provisions?: string[];
  }
): Promise<ActionResult<{ billId: string }>> {
  const supabase = await createServiceClient();
  const gate = await assertCanMoveOwnPrivateBill(supabase, participantId, eventId);
  if (!gate.ok) return { success: false, error: gate.error };

  const title = data.title?.trim();
  if (!title) return { success: false, error: "Give your bill a title." };

  const provisions = (data.provisions ?? [])
    .map((p) => p.trim())
    .filter(Boolean)
    .map((text) => ({ id: randomUUID(), text }));

  const { data: existing } = await supabase
    .from("bills")
    .select("id, status")
    .eq("event_id", eventId)
    .eq("source", "private_member")
    .eq("mover_participant_id", participantId)
    .maybeSingle();

  if (existing && existing.status !== "drafting") {
    return {
      success: false,
      error:
        "You have already handed this bill in — ask an organiser if you need it changed.",
    };
  }

  const payload = {
    event_id: eventId,
    committee_name: null,
    title,
    objective: data.objective?.trim() || null,
    problem_statement: data.problemStatement?.trim() || null,
    provisions: provisions as unknown as Json,
    source: "private_member" as BillSource,
    mover_participant_id: participantId,
    // Mirror the mover into presenter_1, exactly as adminCreateBill does — the
    // projector display and the jury scoring flow both resolve presenter_1 as
    // "who presents this bill".
    presenter_1: participantId,
    status: "drafting",
    updated_at: new Date().toISOString(),
  };

  if (existing) {
    const { error } = await supabase
      .from("bills")
      .update(payload as never)
      .eq("id", existing.id);
    if (error) return { success: false, error: error.message };
    revalidatePath("/yip/me/private-bill");
    return { success: true, data: { billId: existing.id as string } };
  }

  const { data: created, error } = await supabase
    .from("bills")
    .insert(payload as never)
    .select("id")
    .single();
  if (error || !created) {
    return { success: false, error: error?.message ?? "Could not save your bill." };
  }
  revalidatePath("/yip/me/private-bill");
  return { success: true, data: { billId: created.id as string } };
}

/**
 * Hand the bill in. Moves it to `submitted`, which is exactly where an
 * organiser-typed one lands — so it appears on the bills board with the same
 * Approve / Reject controls and needs no special handling there.
 */
export async function submitMyPrivateMemberBill(
  eventId: string,
  participantId: string
): Promise<ActionResult<{ status: string }>> {
  const supabase = await createServiceClient();
  const gate = await assertCanMoveOwnPrivateBill(supabase, participantId, eventId);
  if (!gate.ok) return { success: false, error: gate.error };

  const { data: bill } = await supabase
    .from("bills")
    .select("id, status, title")
    .eq("event_id", eventId)
    .eq("source", "private_member")
    .eq("mover_participant_id", participantId)
    .maybeSingle();
  if (!bill) return { success: false, error: "Write your bill first." };
  if (bill.status !== "drafting") {
    return { success: false, error: "This bill has already been handed in." };
  }
  if (!((bill.title as string) ?? "").trim()) {
    return { success: false, error: "Give your bill a title before handing it in." };
  }

  const { error } = await supabase
    .from("bills")
    .update({ status: "submitted", updated_at: new Date().toISOString() })
    .eq("id", bill.id)
    .eq("status", "drafting"); // no-op if something else moved it first
  if (error) return { success: false, error: error.message };

  revalidatePath("/yip/me/private-bill");
  revalidatePath(`/yip/dashboard/events/${eventId}/bills`);
  return { success: true, data: { status: "submitted" } };
}
