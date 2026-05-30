"use server";

import { createServiceClient } from "@/lib/yip/supabase/server";
import { revalidatePath } from "next/cache";
import { parentScoreByKey } from "@/lib/yip/rubric";
import { getScoringFlagsConfig, type FlagDeltas } from "./scoring-flags";
import { getPositionBonusConfig } from "./positions";

type ActionResult<T = null> =
  | { success: true; data: T }
  | { success: false; error: string };

// ─── Role classification helpers ─────────────────────────────────

const RULING_ROLES = new Set([
  "prime_minister",
  "deputy_prime_minister",
  "cabinet_minister",
  "mp",
  "bill_committee",
]);

const OPPOSITION_ROLES = new Set([
  "leader_of_opposition",
  "shadow_minister",
  "mp",
  "bill_committee",
]);

const LEADERSHIP_ROLES = new Set([
  "speaker",
  "deputy_speaker",
  "prime_minister",
  "deputy_prime_minister",
  "leader_of_opposition",
  "party_leader",
  "cabinet_minister",
  "shadow_minister",
]);

function isRulingMP(role: string | null, side: string | null): boolean {
  if (!role || !side) return false;
  if (side !== "ruling") return false;
  return RULING_ROLES.has(role);
}

function isOppositionMP(role: string | null, side: string | null): boolean {
  if (!role || !side) return false;
  if (side !== "opposition") return false;
  return OPPOSITION_ROLES.has(role);
}

// ─── Compute Results ─────────────────────────────────────────────

type ParticipantLite = {
  id: string;
  full_name: string;
  parliament_role: string | null;
  party_side: string | null;
  school_name: string;
  constituency_name: string | null;
};

type RawScore = {
  jury_assignment_id: string;
  total_score: number;
  criteria_scores: Record<string, number>;
  flag_no_confidence_brought: boolean;
  flag_walkout: boolean;
  flag_ruckus: boolean;
  flag_suspension: boolean;
};

function flagDeltaForScore(s: RawScore, deltas: FlagDeltas): number {
  let d = 0;
  if (s.flag_no_confidence_brought) d += deltas.no_confidence_brought;
  if (s.flag_walkout) d += deltas.walkout;
  if (s.flag_ruckus) d += deltas.ruckus;
  if (s.flag_suspension) d += deltas.suspension;
  return d;
}

type ResultRow = {
  event_id: string;
  participant_id: string;
  avg_score: number;
  jury_count: number;
  score_breakdown: Record<string, number>;
  min_juror_score: number; // for MVP consistency
  rank: number;
  award_category: string | null;
  computed_at: string;
};

/**
 * Award one prize to all participants tied at the max eligible score.
 * Mutates resultRows in place by appending to award_category.
 * Skips silently when no participant qualifies (handbook intent: don't fabricate).
 */
function assignAward(
  rows: ResultRow[],
  participants: Map<string, ParticipantLite>,
  awardLabel: string,
  eligible: (p: ParticipantLite, r: ResultRow) => boolean,
  rankBy: (r: ResultRow) => number
): void {
  let topScore = -Infinity;
  let anyEligible = false;

  for (const r of rows) {
    const p = participants.get(r.participant_id);
    if (!p || !eligible(p, r)) continue;
    anyEligible = true;
    const s = rankBy(r);
    if (s > topScore) topScore = s;
  }

  if (!anyEligible || topScore === -Infinity) return;

  for (const r of rows) {
    const p = participants.get(r.participant_id);
    if (!p || !eligible(p, r)) continue;
    if (rankBy(r) === topScore) {
      r.award_category = r.award_category
        ? `${r.award_category}, ${awardLabel}`
        : awardLabel;
    }
  }
}

export async function computeResults(
  eventId: string
): Promise<ActionResult<{ computed: number; awards_assigned: number }>> {
  const supabase = await createServiceClient();

  // 1. Submitted scores (including Special-Remarks flag columns — F4)
  const { data: scores, error: scoresError } = await supabase
    .from("scores")
    .select(
      "participant_id, jury_assignment_id, total_score, criteria_scores, status, flag_no_confidence_brought, flag_walkout, flag_ruckus, flag_suspension"
    )
    .eq("event_id", eventId)
    .eq("status", "submitted");

  if (scoresError) {
    return { success: false, error: scoresError.message };
  }
  if (!scores || scores.length === 0) {
    return { success: false, error: "No submitted scores found for this event" };
  }

  // 1b. Flag deltas config — applied per juror row, before averaging.
  const flagsConfig = await getScoringFlagsConfig();
  const flagDeltas: FlagDeltas = flagsConfig.success
    ? flagsConfig.data.deltas
    : { no_confidence_brought: 3, walkout: -5, ruckus: -3, suspension: -10 };

  // 1c. Position bonuses (F3) — applied ONCE per participant to avg/min, NOT
  // per juror (bonus is a role attribute, not a per-juror judgement).
  const positionConfig = await getPositionBonusConfig();
  const positionBonuses = positionConfig.bonuses;

  // 2. Participants (with constituency for Best Constituency Rep / Community Impact)
  const { data: participants, error: pError } = await supabase
    .from("participants")
    .select("id, full_name, parliament_role, party_side, school_name, constituency_name")
    .eq("event_id", eventId)
    .not("parliament_role", "is", null);

  if (pError || !participants) {
    return { success: false, error: pError?.message ?? "Failed to fetch participants" };
  }

  // 3. Group scores by participant
  const scoresByParticipant = new Map<string, RawScore[]>();
  for (const s of scores) {
    const arr = scoresByParticipant.get(s.participant_id) ?? [];
    arr.push({
      jury_assignment_id: s.jury_assignment_id,
      total_score: s.total_score,
      criteria_scores: s.criteria_scores as Record<string, number>,
      flag_no_confidence_brought: Boolean(s.flag_no_confidence_brought),
      flag_walkout: Boolean(s.flag_walkout),
      flag_ruckus: Boolean(s.flag_ruckus),
      flag_suspension: Boolean(s.flag_suspension),
    });
    scoresByParticipant.set(s.participant_id, arr);
  }

  // 4. Compute per-participant averages + per-criterion averages + min juror score
  const resultRows: ResultRow[] = [];

  for (const participant of participants) {
    const pScores = scoresByParticipant.get(participant.id);
    if (!pScores || pScores.length === 0) continue;

    const juryCount = pScores.length;
    // F4: each juror's contribution includes Special-Remarks flag deltas
    // applied at that juror's row. The deltas come from
    // yip.scoring_flags_config; min/avg use the flag-adjusted value so
    // both the leaderboard and the MVP award reflect remarks consistently.
    const adjusted = pScores.map(
      (s) => s.total_score + flagDeltaForScore(s, flagDeltas)
    );
    // F3: role-based position bonus applied once per participant.
    const roleBonus =
      (participant.parliament_role && positionBonuses[participant.parliament_role]) || 0;
    const avgScore =
      adjusted.reduce((sum, v) => sum + v, 0) / juryCount + roleBonus;
    const minJurorScore =
      adjusted.reduce((min, v) => (v < min ? v : min), Infinity) + roleBonus;

    const criteriaSum: Record<string, number> = {};
    const criteriaCount: Record<string, number> = {};

    for (const s of pScores) {
      for (const [key, value] of Object.entries(s.criteria_scores)) {
        criteriaSum[key] = (criteriaSum[key] ?? 0) + (value as number);
        criteriaCount[key] = (criteriaCount[key] ?? 0) + 1;
      }
    }

    const scoreBreakdown: Record<string, number> = {};
    for (const key of Object.keys(criteriaSum)) {
      scoreBreakdown[key] =
        Math.round((criteriaSum[key] / criteriaCount[key]) * 100) / 100;
    }

    resultRows.push({
      event_id: eventId,
      participant_id: participant.id,
      avg_score: Math.round(avgScore * 100) / 100,
      jury_count: juryCount,
      score_breakdown: scoreBreakdown,
      min_juror_score: minJurorScore === Infinity ? 0 : Math.round(minJurorScore * 100) / 100,
      rank: 0,
      award_category: null,
      computed_at: new Date().toISOString(),
    });
  }

  // 5. Sort + rank
  resultRows.sort((a, b) => b.avg_score - a.avg_score);
  let currentRank = 1;
  for (let i = 0; i < resultRows.length; i++) {
    if (i > 0 && resultRows[i].avg_score < resultRows[i - 1].avg_score) {
      currentRank = i + 1;
    }
    resultRows[i].rank = currentRank;
  }

  // 6. Build participant lookup for award assignment
  const participantMap = new Map<string, ParticipantLite>(
    participants.map((p) => [p.id, p as ParticipantLite])
  );

  // ── 15 awards from YIP 2026 Handbook page 21 ───────────────────
  // Each derivation is documented inline so the National team can audit it.

  const all = (_p: ParticipantLite) => true;
  const isSpeaker = (p: ParticipantLite) => p.parliament_role === "speaker";
  const isIndependent = (p: ParticipantLite) => p.parliament_role === "independent_mp";
  const isLeadership = (p: ParticipantLite) =>
    p.parliament_role !== null && LEADERSHIP_ROLES.has(p.parliament_role);
  const isRuling = (p: ParticipantLite) => isRulingMP(p.parliament_role, p.party_side);
  const isOpposition = (p: ParticipantLite) => isOppositionMP(p.parliament_role, p.party_side);
  const hasConstituency = (p: ParticipantLite) =>
    p.constituency_name !== null && p.constituency_name.trim().length > 0;
  const isConstituencyMP = (p: ParticipantLite) =>
    hasConstituency(p) && (p.parliament_role === "mp" || p.parliament_role === "independent_mp");

  const byAvg = (r: ResultRow) => r.avg_score;
  // Parent-aware criterion lookup: works with legacy flat rubrics
  // ({"content": 20}) AND the new nested rubrics
  // ({"content.relevance": 8, "content.originality": 7, "content.research": 5}).
  // Handbook p.20 awards are defined at the parent-criterion level, so we
  // always roll children up.
  const byCriterion = (key: string) => (r: ResultRow) =>
    parentScoreByKey(r.score_breakdown, key);
  const byContentPlusArgumentation = (r: ResultRow) =>
    parentScoreByKey(r.score_breakdown, "content") +
    parentScoreByKey(r.score_breakdown, "argumentation");
  const byMinJuror = (r: ResultRow) => r.min_juror_score;

  // 1. Best Parliamentarian — top overall
  assignAward(resultRows, participantMap, "Best Parliamentarian", all, byAvg);
  // 2. Best Speaker — top among role=speaker
  assignAward(resultRows, participantMap, "Best Speaker", isSpeaker, byAvg);
  // 3. Leadership Excellence — top across all leadership roles
  assignAward(resultRows, participantMap, "Leadership Excellence", isLeadership, byAvg);
  // 4. Best Member — Ruling Bench
  assignAward(resultRows, participantMap, "Best Member — Ruling Bench", isRuling, byAvg);
  // 5. Best Member — Opposition Bench
  assignAward(resultRows, participantMap, "Best Member — Opposition Bench", isOpposition, byAvg);
  // 6. Best Debater — top argumentation criterion
  assignAward(resultRows, participantMap, "Best Debater", all, byCriterion("argumentation"));
  // 7. Most Persuasive Policy Advocate — content + argumentation combined
  assignAward(resultRows, participantMap, "Most Persuasive Policy Advocate", all, byContentPlusArgumentation);
  // 8. Best Research & Presentation — top content criterion
  assignAward(resultRows, participantMap, "Best Research & Presentation", all, byCriterion("content"));
  // 9. Innovative Ideas — top content (proxy for originality sub-criterion)
  assignAward(resultRows, participantMap, "Innovative Ideas", all, byCriterion("content"));
  // 10. Community Impact — top among constituency-bearing participants
  assignAward(resultRows, participantMap, "Community Impact", hasConstituency, byContentPlusArgumentation);
  // 11. MVP — most consistent excellence (highest minimum juror score)
  assignAward(resultRows, participantMap, "Most Valuable Participant (MVP)", all, byMinJuror);
  // 12. Team Spirit — top teamwork criterion
  assignAward(resultRows, participantMap, "Team Spirit", all, byCriterion("teamwork"));
  // 13. Exemplary Parliamentary Decorum — top conduct criterion
  assignAward(resultRows, participantMap, "Exemplary Parliamentary Decorum", all, byCriterion("conduct"));
  // 14. Independent Voice of the House — top among independent_mp role (skipped if none)
  assignAward(resultRows, participantMap, "Independent Voice of the House", isIndependent, byAvg);
  // 15. Best Constituency Representative — top MP/Independent with assigned constituency
  assignAward(resultRows, participantMap, "Best Constituency Representative", isConstituencyMP, byAvg);

  // 7. Replace and persist
  await supabase.from("results").delete().eq("event_id", eventId);

  const { error: insertError } = await supabase.from("results").insert(
    resultRows.map((r) => ({
      event_id: r.event_id,
      participant_id: r.participant_id,
      avg_score: r.avg_score,
      jury_count: r.jury_count,
      score_breakdown: r.score_breakdown,
      rank: r.rank,
      award_category: r.award_category,
      computed_at: r.computed_at,
      // qualifies_next intentionally left null here — promotion logic is
      // handled by the separate promotions workflow (app/yip/actions/pipeline.ts).
      // If you need to auto-set top-N qualification at compute time, derive it
      // from r.rank here and add qualifies_next to the ResultRow type.
      qualifies_next: null,
    }))
  );

  if (insertError) {
    return { success: false, error: insertError.message };
  }

  const awardsAssigned = resultRows.filter((r) => r.award_category !== null).length;

  revalidatePath(`/yip/dashboard/events/${eventId}/results`);
  revalidatePath(`/yip/dashboard/events/${eventId}/scoring`);

  return {
    success: true,
    data: { computed: resultRows.length, awards_assigned: awardsAssigned },
  };
}

// ─── Publish Results ─────────────────────────────────────────────

export async function publishResults(
  eventId: string
): Promise<ActionResult> {
  const supabase = await createServiceClient();

  const { error } = await supabase
    .from("events")
    .update({ results_published_at: new Date().toISOString() })
    .eq("id", eventId);

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath(`/yip/dashboard/events/${eventId}/results`);
  revalidatePath(`/me`);
  return { success: true, data: null };
}

// ─── Unpublish Results ───────────────────────────────────────────

export async function unpublishResults(
  eventId: string
): Promise<ActionResult> {
  const supabase = await createServiceClient();

  const { error } = await supabase
    .from("events")
    .update({ results_published_at: null })
    .eq("id", eventId);

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath(`/yip/dashboard/events/${eventId}/results`);
  revalidatePath(`/me`);
  return { success: true, data: null };
}

// ─── Lock Scores ─────────────────────────────────────────────────

export async function lockScores(
  eventId: string
): Promise<ActionResult> {
  const supabase = await createServiceClient();

  const { error } = await supabase
    .from("events")
    .update({ scores_locked: true })
    .eq("id", eventId);

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath(`/yip/dashboard/events/${eventId}/scoring`);
  return { success: true, data: null };
}

// ─── Unlock Scores ───────────────────────────────────────────────

export async function unlockScores(
  eventId: string
): Promise<ActionResult> {
  const supabase = await createServiceClient();

  const { error } = await supabase
    .from("events")
    .update({ scores_locked: false })
    .eq("id", eventId);

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath(`/yip/dashboard/events/${eventId}/scoring`);
  return { success: true, data: null };
}

// ─── Get Results ─────────────────────────────────────────────────

export type ResultWithParticipant = {
  id: string;
  event_id: string;
  participant_id: string;
  avg_score: number | null;
  jury_count: number | null;
  rank: number | null;
  award_category: string | null;
  score_breakdown: Record<string, number> | null;
  computed_at: string | null;
  participant: {
    id: string;
    full_name: string;
    school_name: string;
    class: number;
    parliament_role: string | null;
    party_side: string | null;
    ministry: string | null;
    constituency_name: string | null;
    committee_name: string | null;
  };
};

export async function getResults(
  eventId: string
): Promise<ResultWithParticipant[]> {
  const supabase = await createServiceClient();

  const { data, error } = await supabase
    .from("results")
    .select(
      `
      *,
      participant:participants(
        id,
        full_name,
        school_name,
        class,
        parliament_role,
        party_side,
        ministry,
        constituency_name,
        committee_name
      )
    `
    )
    .eq("event_id", eventId)
    .order("rank", { ascending: true })
    .order("avg_score", { ascending: false });

  if (error || !data) return [];

  return data as unknown as ResultWithParticipant[];
}

// ─── Get Scoring Progress ────────────────────────────────────────

export type ScoringProgressData = {
  event: {
    id: string;
    scores_locked: boolean;
    results_published_at: string | null;
  };
  totalParticipants: number;
  participantsScored: number;
  juryProgress: Array<{
    id: string;
    jury_name: string;
    scoresSubmitted: number;
    lastActivity: string | null;
  }>;
  participantProgress: Array<{
    id: string;
    full_name: string;
    parliament_role: string | null;
    party_side: string | null;
    school_name: string;
    juriesScored: number;
    totalJuries: number;
    avgScoreSoFar: number | null;
  }>;
};

export async function getScoringProgress(
  eventId: string
): Promise<ScoringProgressData | null> {
  const supabase = await createServiceClient();

  const { data: event } = await supabase
    .from("events")
    .select("id, scores_locked, results_published_at")
    .eq("id", eventId)
    .single();

  if (!event) return null;

  const { data: participants } = await supabase
    .from("participants")
    .select("id, full_name, parliament_role, party_side, school_name")
    .eq("event_id", eventId)
    .not("parliament_role", "is", null)
    .order("full_name");

  const { data: juries } = await supabase
    .from("jury_assignments")
    .select("id, jury_name")
    .eq("event_id", eventId)
    .eq("is_active", true)
    .order("created_at");

  const { data: scores } = await supabase
    .from("scores")
    .select("id, participant_id, jury_assignment_id, total_score, status, submitted_at, updated_at")
    .eq("event_id", eventId)
    .eq("status", "submitted");

  const participantList = participants ?? [];
  const juryList = juries ?? [];
  const scoreList = scores ?? [];
  const totalJuries = juryList.length;

  const juryProgress = juryList.map((j) => {
    const juryScores = scoreList.filter(
      (s) => s.jury_assignment_id === j.id
    );
    const lastScore = juryScores.sort(
      (a, b) =>
        new Date(b.submitted_at ?? b.updated_at ?? "").getTime() -
        new Date(a.submitted_at ?? a.updated_at ?? "").getTime()
    )[0];

    return {
      id: j.id,
      jury_name: j.jury_name,
      scoresSubmitted: juryScores.length,
      lastActivity: lastScore?.submitted_at ?? lastScore?.updated_at ?? null,
    };
  });

  const participantProgress = participantList.map((p) => {
    const pScores = scoreList.filter((s) => s.participant_id === p.id);
    const avgScoreSoFar =
      pScores.length > 0
        ? Math.round(
            (pScores.reduce((sum, s) => sum + s.total_score, 0) /
              pScores.length) *
              100
          ) / 100
        : null;

    return {
      id: p.id,
      full_name: p.full_name,
      parliament_role: p.parliament_role,
      party_side: p.party_side,
      school_name: p.school_name,
      juriesScored: pScores.length,
      totalJuries,
      avgScoreSoFar,
    };
  });

  const participantsScored = participantProgress.filter(
    (p) => p.juriesScored > 0
  ).length;

  return {
    event: {
      id: event.id,
      scores_locked: event.scores_locked ?? false,
      results_published_at: event.results_published_at,
    },
    totalParticipants: participantList.length,
    participantsScored,
    juryProgress,
    participantProgress,
  };
}
