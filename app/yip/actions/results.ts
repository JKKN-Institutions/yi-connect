"use server";

import { createServiceClient } from "@/lib/yip/supabase/server";
import { getYipEventAccess } from "@/lib/yip/auth/event-access";
import { revalidatePath } from "next/cache";
import { parentScoreByKey } from "@/lib/yip/rubric";
import { getPositionBonusConfig } from "./positions";
import { getScoringSettings } from "./scoring-settings";
import { listSessionParameters } from "./session-parameters";

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
  agenda_item_id: string | null;
  total_score: number;
  criteria_scores: Record<string, number>;
  flag_no_confidence_brought: boolean;
  flag_walkout: boolean;
  flag_ruckus: boolean;
  flag_suspension: boolean;
};

// Disciplinary special-remarks flags (walkout / ruckus / suspension) are
// OBJECTIVE events. Under the Yi 2026 Evaluation Workbook they NO LONGER alter
// the additive /100 total — they only gate the "Exemplary Parliamentary
// Decorum" award. Returns true if ANY juror in ANY session raised a
// disciplinary flag for the participant.
function hasDisciplinaryFlag(scores: RawScore[]): boolean {
  return scores.some(
    (s) => s.flag_walkout || s.flag_ruckus || s.flag_suspension
  );
}

type ResultRow = {
  event_id: string;
  participant_id: string;
  avg_score: number;
  jury_count: number;
  score_breakdown: Record<string, number>;
  min_juror_score: number; // for MVP consistency
  // In-memory only (NOT persisted) — used by award logic below.
  baseScore: number; // additive component sum, EXCLUDING position points
  hasDisciplinary: boolean; // any walkout / ruckus / suspension flag
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
  // Organisers may compute + publish results (per the 2026-05-30 role model);
  // canManage is the gate. computeResults wipes + rebuilds this event's results.
  const access = await getYipEventAccess(eventId);
  if (!access.canManage) {
    return { success: false, error: "Not authorized to manage this event" };
  }
  const supabase = await createServiceClient();

  // 1. Submitted scores (including Special-Remarks flag columns — F4)
  const { data: scores, error: scoresError } = await supabase
    .from("scores")
    .select(
      "participant_id, jury_assignment_id, agenda_item_id, total_score, criteria_scores, status, flag_no_confidence_brought, flag_walkout, flag_ruckus, flag_suspension"
    )
    .eq("event_id", eventId)
    .eq("status", "submitted");

  if (scoresError) {
    return { success: false, error: scoresError.message };
  }
  if (!scores || scores.length === 0) {
    return { success: false, error: "No submitted scores found for this event" };
  }

  // 1c. Position points (Yi 2026 Workbook) — auto-awarded per role, applied
  // ONCE per participant and CAPPED at 10 (the Position Points component is
  // max 10 of the /100 total). Not a per-juror judgement.
  const positionConfig = await getPositionBonusConfig();
  const positionBonuses = positionConfig.bonuses;

  // 1d. Global scoring settings + per-session config — drive the aggregation
  // (all set by super-admin in the admin Scoring Rules / Session Scoring
  // screens; nothing hardcoded here).
  const settings = await getScoringSettings();

  // Build TWO config lookups from the global session catalog:
  //   • cfgBySessionKey — 1:1, the PRIMARY key. Each of the 11 handbook
  //     sessions has its own session_key, so this distinguishes the 3
  //     duplicated agenda_types (2 Speaker / 2 Opening / 2 Debate sessions).
  //   • cfgByType — FALLBACK only, for agenda items not yet tagged with a
  //     session_key. When several configs share an agenda_type we keep the one
  //     with the LOWEST display_order (iterate in ascending display_order and
  //     only set on first sight) so the fallback is deterministic.
  const sessionConfigs = await listSessionParameters();
  const cfgBySessionKey = new Map<
    string,
    { total_max: number; session_weight: number }
  >();
  const cfgByType = new Map<
    string,
    { total_max: number; session_weight: number }
  >();
  for (const c of [...sessionConfigs].sort(
    (a, b) => a.display_order - b.display_order
  )) {
    cfgBySessionKey.set(c.session_key, {
      total_max: c.total_max,
      session_weight: c.session_weight,
    });
    if (c.agenda_type && !cfgByType.has(c.agenda_type)) {
      cfgByType.set(c.agenda_type, {
        total_max: c.total_max,
        session_weight: c.session_weight,
      });
    }
  }

  const { data: agendaRows } = await supabase
    .from("agenda")
    .select("id, agenda_type, session_key")
    .eq("event_id", eventId);
  // Map agenda_item_id → { agenda_type, session_key } so per-session config can
  // be resolved by session_key FIRST (1:1), falling back to agenda_type.
  const agendaById = new Map<
    string,
    { agenda_type: string | null; session_key: string | null }
  >(
    (agendaRows ?? []).map((a) => [
      a.id,
      { agenda_type: a.agenda_type, session_key: a.session_key },
    ])
  );

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
    // Guard the JSONB shape: criteria_scores is `Json` (nullable) and a
    // malformed row (null / array / scalar) would crash Object.entries() below.
    // Coerce to a plain object here so per-criterion aggregation is always safe.
    const cs = s.criteria_scores;
    const safeCriteria: Record<string, number> =
      cs && typeof cs === "object" && !Array.isArray(cs)
        ? (cs as Record<string, number>)
        : {};
    arr.push({
      jury_assignment_id: s.jury_assignment_id,
      agenda_item_id: s.agenda_item_id,
      total_score: s.total_score,
      criteria_scores: safeCriteria,
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

    // Per-session aggregation, driven by the global scoring settings (admin
    // Scoring Rules screen — nothing hardcoded). Each scoreable agenda item
    // maps 1:1 to a scoring component (session_key); a participant's score for
    // a component = MEAN of that component's juror total_scores. When
    // normalize_per_session is false (Yi 2026 Workbook additive model) the raw
    // component means are used as-is. Components are then combined per the
    // chosen method. Position Points apply ONCE on top (capped at 10).
    const bySession = new Map<string, number[]>();
    for (const s of pScores) {
      const key = s.agenda_item_id ?? "__none__";
      const arr = bySession.get(key) ?? [];
      arr.push(s.total_score);
      bySession.set(key, arr);
    }
    const sessionEntries = Array.from(bySession.entries()).map(
      ([agendaItemId, vals]) => {
        const raw = vals.reduce((a, b) => a + b, 0) / vals.length;
        // Resolve this scored session's config 1:1: session_key FIRST (the
        // primary key — distinguishes the 3 repeated agenda_types), then fall
        // back to agenda_type for items not yet tagged with a session_key.
        // If neither resolves → no config (max=0 → no normalize, weight=1).
        const meta =
          agendaItemId === "__none__" ? null : agendaById.get(agendaItemId);
        let cfg: { total_max: number; session_weight: number } | undefined;
        if (meta) {
          if (meta.session_key && cfgBySessionKey.has(meta.session_key)) {
            cfg = cfgBySessionKey.get(meta.session_key);
          } else if (meta.agenda_type && cfgByType.has(meta.agenda_type)) {
            cfg = cfgByType.get(meta.agenda_type);
          }
        }
        const max = cfg && cfg.total_max > 0 ? cfg.total_max : 0;
        // Use RAW component totals unless normalize_per_session is enabled.
        const score =
          settings.normalize_per_session && max > 0 ? (raw / max) * 100 : raw;
        const weight = cfg ? cfg.session_weight : 1;
        return { score, weight };
      }
    );

    // `aggregation_method` is widened to string here so the additive 'sum'
    // model (Yi 2026 Workbook) can be matched without changing the shared
    // ScoringSettings type in scoring-settings.ts. Other events keep
    // average / weighted_average / best_n.
    const method = settings.aggregation_method as string;

    let baseScore = 0;
    let minSession = 0;
    if (sessionEntries.length > 0) {
      const arr = sessionEntries.map((e) => e.score);
      if (method === "sum") {
        // Yi 2026 Workbook: additive — final base = SUM of per-component means
        // (do NOT divide by count). Each component is already capped by its
        // configured max, so the six juror-scored components sum to 90.
        baseScore = arr.reduce((a, b) => a + b, 0);
        minSession = Math.min(...arr);
      } else if (method === "best_n") {
        const top = [...arr]
          .sort((a, b) => b - a)
          .slice(0, Math.max(1, settings.best_n));
        baseScore = top.reduce((a, b) => a + b, 0) / top.length;
        minSession = Math.min(...top);
      } else if (method === "average") {
        baseScore = arr.reduce((a, b) => a + b, 0) / arr.length;
        minSession = Math.min(...arr);
      } else {
        // weighted_average (default)
        const totalW = sessionEntries.reduce((a, e) => a + e.weight, 0);
        baseScore =
          totalW > 0
            ? sessionEntries.reduce((a, e) => a + e.score * e.weight, 0) / totalW
            : arr.reduce((a, b) => a + b, 0) / arr.length;
        minSession = Math.min(...arr);
      }
    }

    // jury_count = distinct jurors who scored this participant (across sessions).
    const juryCount = new Set(pScores.map((s) => s.jury_assignment_id)).size;
    // Position Points (auto) — applied once per participant, capped at 10.
    const positionPoints = Math.min(
      10,
      (participant.parliament_role &&
        positionBonuses[participant.parliament_role]) ||
        0
    );
    // Disciplinary flags no longer alter the total — award-gating only.
    const hasDisciplinary = hasDisciplinaryFlag(pScores);

    // Final additive total out of 100: 6 juror-scored components (sum 90) +
    // Position Points (max 10). Special remarks are NOT added.
    const avgScore = baseScore + positionPoints;
    const minJurorScore = minSession + positionPoints;

    const criteriaSum: Record<string, number> = {};
    const criteriaCount: Record<string, number> = {};

    for (const s of pScores) {
      for (const [key, value] of Object.entries(s.criteria_scores)) {
        const num = Number(value);
        if (!Number.isFinite(num)) continue; // skip malformed criterion values
        criteriaSum[key] = (criteriaSum[key] ?? 0) + num;
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
      baseScore: Math.round(baseScore * 100) / 100,
      hasDisciplinary,
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

  // ── 9 awards from the Yi 2026 Evaluation Workbook ──────────────
  // All awards roll up the NAMESPACED criterion keys "<comp>.<criterion>"
  // (comp ∈ {mupi,qh,zero,pol,cmte,bill}). parentScoreByKey() sums any key
  // equal to OR prefixed by the family, so parentScoreByKey(b,'pol') =
  // Political Acumen total and parentScoreByKey(b,'mupi.conduct') = the single
  // MuPI conduct criterion. sumKeys() adds an explicit list of criteria.

  const all = (_p: ParticipantLite) => true;

  // Sum an explicit set of namespaced criterion keys.
  const sumKeys =
    (keys: string[]) =>
    (r: ResultRow): number =>
      keys.reduce((sum, k) => sum + parentScoreByKey(r.score_breakdown, k), 0);

  // 1. Best Parliamentarian — top overall additive total.
  assignAward(
    resultRows,
    participantMap,
    "Best Parliamentarian",
    all,
    (r) => r.avg_score
  );
  // 2. Best Debater — Political Acumen + Question Hour.
  assignAward(resultRows, participantMap, "Best Debater", all, (r) =>
    parentScoreByKey(r.score_breakdown, "pol") +
    parentScoreByKey(r.score_breakdown, "qh")
  );
  // 3. Best Research & Presentation — research/knowledge across components.
  assignAward(
    resultRows,
    participantMap,
    "Best Research & Presentation",
    all,
    sumKeys([
      "mupi.research_constituency",
      "qh.subject_knowledge",
      "bill.understanding",
      "cmte.research_contribution",
    ])
  );
  // 4. Most Valuable Participant (MVP) — top base score (EXCLUDING position).
  assignAward(
    resultRows,
    participantMap,
    "Most Valuable Participant (MVP)",
    all,
    (r) => r.baseScore
  );
  // 5. Best Constituency Representative — MuPI + Question Hour + Zero Hour.
  assignAward(
    resultRows,
    participantMap,
    "Best Constituency Representative",
    all,
    (r) =>
      parentScoreByKey(r.score_breakdown, "mupi") +
      parentScoreByKey(r.score_breakdown, "qh") +
      parentScoreByKey(r.score_breakdown, "zero")
  );
  // 6. Exemplary Parliamentary Decorum — clean conduct only; sum conduct
  //    criteria. Eligible = no disciplinary flag raised by any juror.
  assignAward(
    resultRows,
    participantMap,
    "Exemplary Parliamentary Decorum",
    (_p, r) => !r.hasDisciplinary,
    sumKeys(["mupi.conduct", "zero.conduct", "bill.conduct"])
  );
  // 7. Team Spirit — committee collaboration + committee-level credit.
  assignAward(
    resultRows,
    participantMap,
    "Team Spirit",
    all,
    sumKeys([
      "cmte.team_collaboration",
      "cmte.committee_level",
      "bill.committee_level",
    ])
  );
  // 8. Innovative Ideas — Zero Hour creativity / problem-solving / policy.
  assignAward(
    resultRows,
    participantMap,
    "Innovative Ideas",
    all,
    sumKeys(["zero.creativity", "zero.problem_solving", "zero.policy_orientation"])
  );
  // 9. Community Impact — policy orientation + bill feasibility + constituency research.
  assignAward(
    resultRows,
    participantMap,
    "Community Impact",
    all,
    sumKeys([
      "zero.policy_orientation",
      "bill.feasibility",
      "mupi.research_constituency",
    ])
  );

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
  const access = await getYipEventAccess(eventId);
  if (!access.canManage) {
    return { success: false, error: "Not authorized to manage this event" };
  }
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
  const access = await getYipEventAccess(eventId);
  if (!access.canManage) {
    return { success: false, error: "Not authorized to manage this event" };
  }
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
  const access = await getYipEventAccess(eventId);
  if (!access.canManage) {
    return { success: false, error: "Not authorized to manage this event" };
  }
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
  const access = await getYipEventAccess(eventId);
  if (!access.canManage) {
    return { success: false, error: "Not authorized to manage this event" };
  }
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
