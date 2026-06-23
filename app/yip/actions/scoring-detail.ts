"use server";

import { createClient, createServiceClient } from "@/lib/yip/supabase/server";
import { getYipEventAccess } from "@/lib/yip/auth/event-access";

// Organizer drill-down for one participant's scoring: every juror's score
// (grouped by session once per-session scoring lands), plus the computed result
// if results have been run. Read-only; gated to event viewers.

export type ParticipantScoreRow = {
  id: string;
  jury_name: string;
  jury_assignment_id: string;
  occurrence: number;
  agenda_item_id: string | null;
  session_title: string | null;
  session_day: number | null;
  total_score: number;
  criteria_scores: Record<string, number>;
  comments: string | null;
  status: string | null;
  submitted_at: string | null;
  flags: {
    no_confidence_brought: boolean;
    walkout: boolean;
    ruckus: boolean;
    suspension: boolean;
  };
};

export type ParticipantScoringDetail = {
  participant: {
    id: string;
    full_name: string;
    school_name: string;
    parliament_role: string | null;
    party_side: string | null;
    party_number: number | null;
    constituency_name: string | null;
    ministry: string | null;
    serial_no: number | null;
    checked_in: boolean | null;
    checked_in_at: string | null;
  };
  scores: ParticipantScoreRow[];
  result: {
    avg_score: number;
    rank: number;
    jury_count: number;
    award_category: string | null;
    score_breakdown: Record<string, number>;
    qualifies_next: boolean | null;
    computed_at: string | null;
  } | null;
};

function asNumberRecord(v: unknown): Record<string, number> {
  return v && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, number>)
    : {};
}

export async function getParticipantScoringDetail(
  eventId: string,
  participantId: string
): Promise<ParticipantScoringDetail | null> {
  // Per-participant scoring drill-down (every juror's score + computed result)
  // is national/super-admin-only (2026-06-13) — same gate as the leaderboard.
  const access = await getYipEventAccess(eventId);
  if (!access.canViewScores) return null;

  const supabase = await createServiceClient();

  const { data: participant } = await supabase
    .from("participants")
    .select(
      "id, full_name, school_name, parliament_role, party_side, party_number, constituency_name, ministry, serial_no, checked_in, checked_in_at"
    )
    .eq("id", participantId)
    .eq("event_id", eventId)
    .maybeSingle();

  if (!participant) return null;

  const { data: rawScores } = await supabase
    .from("scores")
    .select(
      `
      id, total_score, criteria_scores, comments, status, submitted_at, agenda_item_id,
      occurrence, jury_assignment_id,
      flag_no_confidence_brought, flag_walkout, flag_ruckus, flag_suspension,
      jury:jury_assignments(jury_name),
      session:agenda(title, day, sequence_order)
    `
    )
    .eq("event_id", eventId)
    .eq("participant_id", participantId);

  type RawRow = {
    id: string;
    total_score: number;
    criteria_scores: unknown;
    comments: string | null;
    status: string | null;
    submitted_at: string | null;
    agenda_item_id: string | null;
    occurrence: number | null;
    jury_assignment_id: string;
    flag_no_confidence_brought: boolean | null;
    flag_walkout: boolean | null;
    flag_ruckus: boolean | null;
    flag_suspension: boolean | null;
    jury: { jury_name: string } | null;
    session: { title: string; day: number; sequence_order: number } | null;
  };

  const rows = (rawScores ?? []) as unknown as RawRow[];
  const scores: ParticipantScoreRow[] = rows.map((r) => ({
    id: r.id,
    jury_name: r.jury?.jury_name ?? "Unknown juror",
    jury_assignment_id: r.jury_assignment_id,
    occurrence: r.occurrence ?? 1,
    agenda_item_id: r.agenda_item_id,
    session_title: r.session?.title ?? null,
    session_day: r.session?.day ?? null,
    total_score: r.total_score,
    criteria_scores: asNumberRecord(r.criteria_scores),
    comments: r.comments,
    status: r.status,
    submitted_at: r.submitted_at,
    flags: {
      no_confidence_brought: Boolean(r.flag_no_confidence_brought),
      walkout: Boolean(r.flag_walkout),
      ruckus: Boolean(r.flag_ruckus),
      suspension: Boolean(r.flag_suspension),
    },
  }));

  scores.sort((a, b) => {
    const da = a.session_day ?? 99;
    const db = b.session_day ?? 99;
    if (da !== db) return da - db;
    const ta = (a.session_title ?? "").localeCompare(b.session_title ?? "");
    if (ta !== 0) return ta;
    return a.jury_name.localeCompare(b.jury_name);
  });

  const { data: resultRow } = await supabase
    .from("results")
    .select(
      "avg_score, rank, jury_count, award_category, score_breakdown, qualifies_next, computed_at"
    )
    .eq("event_id", eventId)
    .eq("participant_id", participantId)
    .maybeSingle();

  const result = resultRow
    ? {
        avg_score: resultRow.avg_score ?? 0,
        rank: resultRow.rank ?? 0,
        jury_count: resultRow.jury_count ?? 0,
        award_category: resultRow.award_category,
        score_breakdown: asNumberRecord(resultRow.score_breakdown),
        qualifies_next: resultRow.qualifies_next,
        computed_at: resultRow.computed_at,
      }
    : null;

  return {
    participant: participant as ParticipantScoringDetail["participant"],
    scores,
    result,
  };
}

// Event-wide score export (BUG-408). Every juror's per-criterion score across
// every participant and session, for off-app cross-referencing / dispute proof.
// national/super-admin-only (same gate as the leaderboard / per-participant drill-down).
export type ExportScoreRow = {
  serial_no: number | null;
  full_name: string;
  constituency_name: string | null;
  party_side: string | null;
  party_number: number | null;
  parliament_role: string | null;
  session_day: number | null;
  session_title: string | null;
  occurrence: number | null;
  jury_name: string;
  total_score: number;
  criteria_scores: Record<string, number>;
  flags: {
    no_confidence_brought: boolean;
    walkout: boolean;
    ruckus: boolean;
    suspension: boolean;
  };
  comments: string | null;
  submitted_at: string | null;
};

export async function getAllScoresForExport(
  eventId: string
): Promise<ExportScoreRow[] | null> {
  const access = await getYipEventAccess(eventId);
  if (!access.canViewScores) return null;

  const supabase = await createServiceClient();

  const { data: rawScores } = await supabase
    .from("scores")
    .select(
      `
      total_score, criteria_scores, comments, status, submitted_at, occurrence,
      flag_no_confidence_brought, flag_walkout, flag_ruckus, flag_suspension,
      participant:participants(serial_no, full_name, constituency_name, party_side, party_number, parliament_role),
      jury:jury_assignments(jury_name),
      session:agenda(title, day, sequence_order)
    `
    )
    .eq("event_id", eventId);

  type RawRow = {
    total_score: number;
    criteria_scores: unknown;
    comments: string | null;
    submitted_at: string | null;
    occurrence: number | null;
    flag_no_confidence_brought: boolean | null;
    flag_walkout: boolean | null;
    flag_ruckus: boolean | null;
    flag_suspension: boolean | null;
    participant: {
      serial_no: number | null;
      full_name: string;
      constituency_name: string | null;
      party_side: string | null;
      party_number: number | null;
      parliament_role: string | null;
    } | null;
    jury: { jury_name: string } | null;
    session: { title: string; day: number; sequence_order: number } | null;
  };

  const rows = ((rawScores ?? []) as unknown as RawRow[]).map((r) => ({
    serial_no: r.participant?.serial_no ?? null,
    full_name: r.participant?.full_name ?? "Unknown",
    constituency_name: r.participant?.constituency_name ?? null,
    party_side: r.participant?.party_side ?? null,
    party_number: r.participant?.party_number ?? null,
    parliament_role: r.participant?.parliament_role ?? null,
    session_day: r.session?.day ?? null,
    session_title: r.session?.title ?? null,
    occurrence: r.occurrence ?? null,
    jury_name: r.jury?.jury_name ?? "Unknown juror",
    total_score: r.total_score,
    criteria_scores: asNumberRecord(r.criteria_scores),
    flags: {
      no_confidence_brought: Boolean(r.flag_no_confidence_brought),
      walkout: Boolean(r.flag_walkout),
      ruckus: Boolean(r.flag_ruckus),
      suspension: Boolean(r.flag_suspension),
    },
    comments: r.comments,
    submitted_at: r.submitted_at,
  }));

  // Stable order: by participant serial, then session day/title, then juror.
  rows.sort((a, b) => {
    const sa = a.serial_no ?? 1e9;
    const sb = b.serial_no ?? 1e9;
    if (sa !== sb) return sa - sb;
    const da = a.session_day ?? 99;
    const db = b.session_day ?? 99;
    if (da !== db) return da - db;
    const ta = (a.session_title ?? "").localeCompare(b.session_title ?? "");
    if (ta !== 0) return ta;
    return a.jury_name.localeCompare(b.jury_name);
  });

  return rows;
}

// Chair-only correction of a juror's score, fully audited. Gated to canManage
// (the event chair / super-admin). Every change is written to yip.score_audit
// with the actor + old→new values. Allowed even when scores are locked — a
// chair correction is exactly the override case — and the audit records it.
export async function updateScoreAsOrganizer(
  eventId: string,
  scoreId: string,
  criteriaScores: Record<string, number>,
  comments: string
): Promise<{ success: true; total: number } | { success: false; error: string }> {
  const access = await getYipEventAccess(eventId);
  if (!access.canManage) {
    return { success: false, error: "Only the event chair can correct scores." };
  }

  // Who is making the correction (for the audit trail).
  const authClient = await createClient();
  const {
    data: { user },
  } = await authClient.auth.getUser();
  const actor = user?.email ?? user?.id ?? "organizer";

  const supabase = await createServiceClient();

  const { data: existing } = await supabase
    .from("scores")
    .select("id, criteria_scores, total_score")
    .eq("id", scoreId)
    .eq("event_id", eventId)
    .maybeSingle();
  if (!existing) {
    return { success: false, error: "Score not found for this event." };
  }

  // Sanitize: keep only finite, non-negative numbers; total = their sum.
  const clean: Record<string, number> = {};
  for (const [k, v] of Object.entries(criteriaScores)) {
    const n = Number(v);
    if (Number.isFinite(n)) clean[k] = Math.max(0, n);
  }
  const total = Object.values(clean).reduce((sum, v) => sum + v, 0);

  const { error: updErr } = await supabase
    .from("scores")
    .update({
      criteria_scores: clean,
      total_score: total,
      comments: comments || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", scoreId);
  if (updErr) return { success: false, error: updErr.message };

  await supabase.from("score_audit").insert({
    score_id: scoreId,
    previous_scores: existing.criteria_scores,
    previous_total: existing.total_score,
    new_scores: clean,
    new_total: total,
    changed_by: `organizer:${actor}`,
    reason: "Organizer correction",
  });

  return { success: true, total };
}
