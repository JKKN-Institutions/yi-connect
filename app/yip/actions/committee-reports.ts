"use server";

import { createServiceClient } from "@/lib/yip/supabase/server";
import { requireParticipantSession } from "@/lib/yip/auth/yip-session";
import { getYipEventAccess } from "@/lib/yip/auth/event-access";
import { isCommitteeEligible } from "@/lib/yip/committee-assignment";
import type { Tables } from "@/types/yip/database";

export type CommitteeReport = Tables<{ schema: "yip" }, "committee_reports">;

type ActionResult<T = null> =
  | { success: true; data: T }
  | { success: false; error: string };

// ─── Report access gate ────────────────────────────────────────
// Reports are per-COMMITTEE, like bills. Two callers may draft/submit a
// committee's report:
//   • a committee MEMBER (participantId provided + assigned to THIS committee), or
//   • an ORGANISER / chapter admin (canManage) acting on the committee's behalf
//     (director decision 2026-06-28 — admins can run the workflow without
//     waiting for a member to file the report).
// yip.committee_reports is service-role-only (RLS on, no policies), so this
// server check is the only auth layer — same pattern as bills.ts / committee-room.

async function assertReportAccess(
  supabase: Awaited<ReturnType<typeof createServiceClient>>,
  eventId: string,
  committeeName: string,
  participantId?: string | null
): Promise<{ ok: true } | { ok: false; error: string }> {
  // Member path — a committee participant writing their own committee's report.
  if (participantId) {
    const sess = await requireParticipantSession(participantId, eventId);
    if (!sess.ok) return { ok: false, error: sess.error };
    const { data: p } = await supabase
      .from("participants")
      .select("parliament_role, committee_name")
      .eq("id", participantId)
      .maybeSingle();
    if (!p) return { ok: false, error: "Participant not found." };
    if (!isCommitteeEligible(p.parliament_role) || p.committee_name !== committeeName) {
      return { ok: false, error: "Only this committee's members can write its report." };
    }
    return { ok: true };
  }
  // Manager path — organiser / chapter admin (canManage) on the committee's behalf.
  const access = await getYipEventAccess(eventId);
  if (access.canManage) return { ok: true };
  return { ok: false, error: "Not authorized for this committee's report." };
}

export interface CommitteeReportFields {
  background?: string;
  current_challenges?: string;
  findings?: string;
  recommendations?: string;
  proposed_solutions?: string;
}

// ─── Save Report Draft (upsert) ────────────────────────────────

export async function saveReportDraft(
  eventId: string,
  committeeName: string,
  participantId: string | null,
  data: CommitteeReportFields
): Promise<ActionResult<{ reportId: string }>> {
  const supabase = await createServiceClient();

  const gate = await assertReportAccess(
    supabase,
    eventId,
    committeeName,
    participantId
  );
  if (!gate.ok) return { success: false, error: gate.error };

  const { data: existing } = await supabase
    .from("committee_reports")
    .select("id, status")
    .eq("event_id", eventId)
    .eq("committee_name", committeeName)
    .maybeSingle();

  // Once submitted, the report is locked from edits (mirrors bills).
  if (existing && existing.status === "submitted") {
    return {
      success: false,
      error: "Report has already been submitted and cannot be edited.",
    };
  }

  const fields = {
    background: data.background?.trim() || null,
    current_challenges: data.current_challenges?.trim() || null,
    findings: data.findings?.trim() || null,
    recommendations: data.recommendations?.trim() || null,
    proposed_solutions: data.proposed_solutions?.trim() || null,
    updated_at: new Date().toISOString(),
  };

  if (existing) {
    const { error } = await supabase
      .from("committee_reports")
      .update(fields)
      .eq("id", existing.id);
    if (error) return { success: false, error: error.message };
    return { success: true, data: { reportId: existing.id } };
  }

  const { data: created, error } = await supabase
    .from("committee_reports")
    .insert({
      event_id: eventId,
      committee_name: committeeName,
      status: "draft",
      ...fields,
    })
    .select("id")
    .single();

  if (error || !created) {
    return { success: false, error: error?.message ?? "Failed to create report" };
  }
  return { success: true, data: { reportId: created.id } };
}

// ─── Submit Report (unlocks the Bill) ──────────────────────────

export async function submitReport(
  reportId: string,
  participantId: string
): Promise<ActionResult> {
  const supabase = await createServiceClient();

  const { data: report } = await supabase
    .from("committee_reports")
    .select(
      "id, event_id, committee_name, status, findings, recommendations"
    )
    .eq("id", reportId)
    .maybeSingle();

  if (!report) return { success: false, error: "Report not found." };

  const gate = await assertCommitteeMember(
    supabase,
    participantId,
    report.event_id,
    report.committee_name
  );
  if (!gate.ok) return { success: false, error: gate.error };

  if (report.status === "submitted") {
    return { success: false, error: "Report has already been submitted." };
  }

  // Require the substantive outputs before unlocking the bill — the bill is
  // built from the committee's findings + recommendations.
  if (!report.findings || report.findings.trim().length === 0) {
    return { success: false, error: "Add your committee's findings before submitting." };
  }
  if (!report.recommendations || report.recommendations.trim().length === 0) {
    return { success: false, error: "Add your committee's recommendations before submitting." };
  }

  const { error } = await supabase
    .from("committee_reports")
    .update({ status: "submitted", updated_at: new Date().toISOString() })
    .eq("id", reportId);

  if (error) return { success: false, error: error.message };
  return { success: true, data: null };
}

// ─── Read helpers ──────────────────────────────────────────────

export async function getReportForCommittee(
  eventId: string,
  committeeName: string
): Promise<CommitteeReport | null> {
  const supabase = await createServiceClient();
  const { data } = await supabase
    .from("committee_reports")
    .select("*")
    .eq("event_id", eventId)
    .eq("committee_name", committeeName)
    .maybeSingle();
  return data ?? null;
}

/** TRUE only when this committee has a submitted report — used to gate the bill. */
export async function isCommitteeReportSubmitted(
  eventId: string,
  committeeName: string
): Promise<boolean> {
  const supabase = await createServiceClient();
  const { data } = await supabase
    .from("committee_reports")
    .select("status")
    .eq("event_id", eventId)
    .eq("committee_name", committeeName)
    .maybeSingle();
  return data?.status === "submitted";
}
