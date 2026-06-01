"use server";

import { createServiceClient } from "@/lib/yip/supabase/server";
import { getYipEventAccess } from "@/lib/yip/auth/event-access";

// Organizer drill-down for one participant's scoring: every juror's score
// (grouped by session once per-session scoring lands), plus the computed result
// if results have been run. Read-only; gated to event viewers.

export type ParticipantScoreRow = {
  id: string;
  jury_name: string;
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
    constituency_name: string | null;
    ministry: string | null;
    serial_no: number | null;
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
  const access = await getYipEventAccess(eventId);
  if (!access.canView) return null;

  const supabase = await createServiceClient();

  const { data: participant } = await supabase
    .from("participants")
    .select(
      "id, full_name, school_name, parliament_role, party_side, constituency_name, ministry, serial_no"
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
