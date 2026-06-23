"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceClient } from "@/lib/yip/supabase/server";
import { getYipEventAccess } from "@/lib/yip/auth/event-access";
import { revalidatePath } from "next/cache";
import { parentScoreByKey } from "@/lib/yip/rubric";
import { getPositionBonusConfig } from "./positions";
import { getScoringSettings } from "./scoring-settings";
import { listSessionParameters } from "./session-parameters";
import { listScoringBuckets } from "./scoring-buckets";
import { getScoringFlagsConfig } from "./scoring-flags";
import { getCommitteeDimensionsConfig } from "./committee-dimensions";
import {
  deriveCommitteeLevels,
  averageDimensions,
  CMTE_LEVEL_CRITERION,
  BILL_LEVEL_CRITERION,
  type CommitteeDimensions,
} from "@/lib/yip/committee-score";

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
  committee_name: string | null;
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
  positionPoints: number; // role position points (capped 10) — Leadership award.
  // NOTE: avg_score = base + position + special-remarks delta (clamped /100)
  // since #308, so (avg − base) is NOT position points anymore — use this.
  hasDisciplinary: boolean; // any walkout / ruckus / suspension flag
  consistencyFloor: number; // MVP: weakest session as a 0–1 fraction of its max
  consistencySessionCount: number; // # scored sessions (MVP min-participation gate)
  committeeLevel: number; // shared committee level (cmte+bill, /10) — Team Spirit award
  rank: number;
  award_category: string | null;
  computed_at: string;
};

/**
 * Award one prize to all participants tied at the max eligible score.
 * Mutates resultRows in place by appending to award_category.
 * Skips silently when no participant qualifies (handbook intent: don't fabricate).
 */
function appendAward(r: ResultRow, awardLabel: string): void {
  r.award_category = r.award_category
    ? `${r.award_category}, ${awardLabel}`
    : awardLabel;
}

/**
 * Strip one award label from a row's comma-joined award_category (the inverse of
 * appendAward). Used by the manual-override final pass to take an award away from
 * its auto-computed winner before re-awarding it to the chair's pick.
 */
function removeAward(r: ResultRow, awardLabel: string): void {
  if (!r.award_category) return;
  const kept = r.award_category.split(", ").filter((a) => a !== awardLabel);
  r.award_category = kept.length ? kept.join(", ") : null;
}

function assignAward(
  rows: ResultRow[],
  participants: Map<string, ParticipantLite>,
  awardLabel: string,
  eligible: (p: ParticipantLite, r: ResultRow) => boolean,
  rankBy: (r: ResultRow) => number,
  opts: { allTied?: boolean; recipients?: number } = {}
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

  // No eligible participant, OR no real signal (everyone tied at 0 — e.g. an
  // award keyed to a family/session that wasn't scored at this event). Award
  // no one rather than the whole field (handbook intent: don't fabricate).
  if (!anyEligible || topScore <= 0) return;

  if (opts.allTied) {
    // Team award (Director ruling): every participant at the top score co-wins
    // — e.g. the whole top committee shares Team Spirit.
    for (const r of rows) {
      const p = participants.get(r.participant_id);
      if (!p || !eligible(p, r)) continue;
      if (rankBy(r) === topScore) appendAward(r, awardLabel);
    }
    return;
  }

  // Top-N winners. recipients defaults to 1, reproducing the original single
  // winner exactly: among eligible participants with a positive score, take the
  // highest N by rankBy, breaking ties by overall avg_score then a stable
  // participant_id. Only positive scorers win, so N=3 with only 2 positive
  // scores awards 2 — never fabricates a winner.
  const recipients = Math.max(1, opts.recipients ?? 1);
  const ranked = rows
    .filter((r) => {
      const p = participants.get(r.participant_id);
      return Boolean(p && eligible(p, r) && rankBy(r) > 0);
    })
    .sort(
      (a, b) =>
        rankBy(b) - rankBy(a) ||
        b.avg_score - a.avg_score ||
        (a.participant_id < b.participant_id ? -1 : 1)
    );
  for (const r of ranked.slice(0, recipients)) appendAward(r, awardLabel);
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

  // 1e. Special-remarks point deltas (admin-configurable, global singleton).
  // Director decision 2026-06-03: each raised remark now adjusts the
  // participant's FINAL /100 total — applied ONCE at full value if ANY juror
  // in ANY session raised it (not averaged across jurors). Disciplinary flags
  // ALSO still gate the Decorum award (kept). Falls back to seeded defaults.
  const flagsCfgRes = await getScoringFlagsConfig();
  const flagDeltas = flagsCfgRes.success
    ? flagsCfgRes.data.deltas
    : { no_confidence_brought: 3, walkout: -5, ruckus: -3, suspension: -10 };

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
    .select("id, agenda_type, session_key, is_scoreable")
    .eq("event_id", eventId);
  // Map agenda_item_id → { agenda_type, session_key, is_scoreable } so per-session
  // config can be resolved by session_key FIRST (1:1), falling back to agenda_type,
  // and so non-scoreable sessions can be excluded from aggregation (Bug A).
  const agendaById = new Map<
    string,
    { agenda_type: string | null; session_key: string | null; is_scoreable: boolean }
  >(
    (agendaRows ?? []).map((a) => [
      a.id,
      {
        agenda_type: a.agenda_type,
        session_key: a.session_key,
        is_scoreable: a.is_scoreable === true,
      },
    ])
  );

  // Bucket model (cutover-gated by settings.use_bucket_model). When enabled,
  // scored sessions roll up into the configurable yip.scoring_buckets (/100).
  // Build session_key → bucket and agenda_type → bucket (the latter via each
  // bucket's session configs, so legacy items without a session_key still map).
  type BucketAgg = {
    bucket_key: string;
    weightage: number;
    merit_max: number;
    jury_max: number;
  };
  const useBuckets = settings.use_bucket_model === true;
  const activeBuckets: BucketAgg[] = [];
  const keyToBucket = new Map<string, BucketAgg>();
  const typeToBucket = new Map<string, BucketAgg>();
  if (useBuckets) {
    for (const b of await listScoringBuckets()) {
      if (!b.is_active) continue;
      const agg: BucketAgg = {
        bucket_key: b.bucket_key,
        weightage: b.weightage,
        merit_max: b.merit_max,
        jury_max: b.jury_max,
      };
      activeBuckets.push(agg);
      for (const sk of b.session_keys) {
        if (!keyToBucket.has(sk)) keyToBucket.set(sk, agg);
        const sc = sessionConfigs.find((c) => c.session_key === sk);
        if (sc?.agenda_type && !typeToBucket.has(sc.agenda_type)) {
          typeToBucket.set(sc.agenda_type, agg);
        }
      }
    }
  }

  // Committee-once scoring (Phase 3): a committee is scored ONCE on the /60
  // sheet; the derived committee-level points (cmte + bill, each 0–5) replace
  // every member's per-individual committee_level criterion. When NO committee
  // score exists (e.g. legacy events / Mizoram), nothing changes — the juror's
  // own committee_level stays in their session total. So this is legacy-safe
  // with no method gate: the presence of a committee_scores row is the switch.
  // Each committee can now be scored by MULTIPLE judges (one row per judge).
  // Group the rows by committee and average the judges' marks before deriving
  // the two committee-level points — so the committee's level reflects the
  // panel's average, not whichever row happened to be last.
  const { data: committeeScoreRows } = await supabase
    .from("committee_scores")
    .select(
      "committee_name, bill_draft_quality, policy_relevance, innovation, feasibility, team_collaboration, presentation_defence"
    )
    .eq("event_id", eventId);
  const dimsByCommittee = new Map<string, CommitteeDimensions[]>();
  for (const c of committeeScoreRows ?? []) {
    const arr = dimsByCommittee.get(c.committee_name) ?? [];
    arr.push({
      bill_draft_quality: c.bill_draft_quality,
      policy_relevance: c.policy_relevance,
      innovation: c.innovation,
      feasibility: c.feasibility,
      team_collaboration: c.team_collaboration,
      presentation_defence: c.presentation_defence,
    });
    dimsByCommittee.set(c.committee_name, arr);
  }
  // Admin-configurable committee-level divisors (default 10 / 2).
  const cmteDimsCfg = await getCommitteeDimensionsConfig();
  const cmteDivisors = {
    draftingDivisor: cmteDimsCfg.draftingDivisor,
    presentationDivisor: cmteDimsCfg.presentationDivisor,
  };
  const committeeLevelByName = new Map<string, { cmte: number; bill: number }>(
    [...dimsByCommittee.entries()].map(([name, dimsList]) => {
      const { cmteLevel, billLevel } = deriveCommitteeLevels(
        averageDimensions(dimsList),
        cmteDivisors
      );
      return [name, { cmte: cmteLevel, bill: billLevel }];
    })
  );

  // 2. Participants (with constituency for Best Constituency Rep / Community Impact)
  const { data: participants, error: pError } = await supabase
    .from("participants")
    .select("id, full_name, parliament_role, party_side, school_name, constituency_name, committee_name")
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
    // Bug A fix (rehearsal 2026-06-14): only is_scoreable sessions count toward
    // results — matches the jury UI, which exposes only is_scoreable sessions
    // (jury-sessions.ts). Excludes stray/leftover/test scores on non-scoreable
    // sessions (and null-agenda rows) that would otherwise inflate the additive
    // 'sum' total and silently mis-rank a participant. Proven at 140-scale: a
    // single stray 100-max score pinned a mid-rank participant at the /100 clamp,
    // jumping them from rank 69 to rank 1.
    const pScores = (scoresByParticipant.get(participant.id) ?? []).filter(
      (s) =>
        s.agenda_item_id != null &&
        agendaById.get(s.agenda_item_id)?.is_scoreable === true
    );
    if (pScores.length === 0) continue;

    // Per-session aggregation, driven by the global scoring settings (admin
    // Scoring Rules screen — nothing hardcoded). Each scoreable agenda item
    // maps 1:1 to a scoring component (session_key); a participant's score for
    // a component = MEAN of that component's juror total_scores. When
    // normalize_per_session is false (Yi 2026 Workbook additive model) the raw
    // component means are used as-is. Components are then combined per the
    // chosen method. Position Points apply ONCE on top (capped at 10).
    // Committee-once override lookup for this participant's committee (if scored).
    const cl = participant.committee_name
      ? committeeLevelByName.get(participant.committee_name)
      : undefined;
    // #4 two-level averaging: group each session's scores BY JUROR. A juror's
    // turns (occurrences) average into one per-juror mark, then the session mark
    // is the mean of those per-juror marks — every juror counts equally no
    // matter how many turns they scored. Backward-compatible: with one row per
    // juror (the pre-#4 norm) each juror's mean is just that row, so the session
    // mean is identical to the old "mean across jurors".
    const bySessionJuror = new Map<string, Map<string, number[]>>();
    for (const s of pScores) {
      const key = s.agenda_item_id ?? "__none__";
      let value = s.total_score;
      // For the two committee-scored components, swap the juror's per-individual
      // committee-level mark for the committee's shared value (same for every
      // member). Guards:
      //   (a) the committee has a /60 score (cl), AND
      //   (b) this score row actually carries the committee-level criterion —
      //       so we never ADD a shared mark to a session whose config has no
      //       committee-level slot (that would inflate it with nothing to net
      //       against), and
      //   (c) the swapped total is clamped to the component's [0, max], so the
      //       swap can never push a session above its configured cap (which
      //       would let avg_score exceed 100 and mis-rank) or below 0.
      if (cl && s.agenda_item_id) {
        const sk = agendaById.get(s.agenda_item_id)?.session_key;
        const sessionMax = sk ? cfgBySessionKey.get(sk)?.total_max ?? 0 : 0;
        let swapped = false;
        if (
          sk === "committee_bill_drafting" &&
          CMTE_LEVEL_CRITERION in s.criteria_scores
        ) {
          value = value - s.criteria_scores[CMTE_LEVEL_CRITERION] + cl.cmte;
          swapped = true;
        } else if (
          sk === "bill_presentation_voting" &&
          BILL_LEVEL_CRITERION in s.criteria_scores
        ) {
          value = value - s.criteria_scores[BILL_LEVEL_CRITERION] + cl.bill;
          swapped = true;
        }
        if (swapped && sessionMax > 0) {
          value = Math.max(0, Math.min(sessionMax, value));
        }
      }
      let jurorMap = bySessionJuror.get(key);
      if (!jurorMap) {
        jurorMap = new Map();
        bySessionJuror.set(key, jurorMap);
      }
      const arr = jurorMap.get(s.jury_assignment_id) ?? [];
      arr.push(value);
      jurorMap.set(s.jury_assignment_id, arr);
    }
    const sessionEntries = Array.from(bySessionJuror.entries()).map(
      ([agendaItemId, jurorMap]) => {
        // Average each juror's turns first, then average across jurors.
        const perJurorMeans = Array.from(jurorMap.values()).map(
          (vals) => vals.reduce((a, b) => a + b, 0) / vals.length
        );
        const raw =
          perJurorMeans.reduce((a, b) => a + b, 0) / perJurorMeans.length;
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
        return {
          score,
          weight,
          raw,
          max,
          sessionKey: meta?.session_key ?? null,
          agendaType: meta?.agenda_type ?? null,
        };
      }
    );

    // `aggregation_method` is widened to string here so the additive 'sum'
    // model (Yi 2026 Workbook) can be matched without changing the shared
    // ScoringSettings type in scoring-settings.ts. Other events keep
    // average / weighted_average / best_n.
    const method = settings.aggregation_method as string;
    const roleBonus =
      (participant.parliament_role &&
        positionBonuses[participant.parliament_role]) ||
      0;

    let baseScore = 0;
    let minSession = 0;
    let positionPoints = 0;

    if (useBuckets) {
      // ── Configurable bucket model (/100) ──
      // Each scored session resolves to a bucket (session_key first, agenda_type
      // fallback). Per bucket:
      //   jury  = (Σ scored raw ÷ Σ scored max) × jury_max   (0 when unscored)
      //   merit = min(merit_max, role bonus)                 (Leadership only)
      //   value = clamp(merit + jury, 0, weightage)
      // base = Σ (value − merit)  (excludes position);  position = Σ merit.
      const byBucket = new Map<string, { sumRaw: number; sumMax: number }>();
      for (const e of sessionEntries) {
        const agg =
          (e.sessionKey ? keyToBucket.get(e.sessionKey) : undefined) ??
          (e.agendaType ? typeToBucket.get(e.agendaType) : undefined);
        if (!agg) continue; // unbucketed session → excluded from /100
        const cur = byBucket.get(agg.bucket_key) ?? { sumRaw: 0, sumMax: 0 };
        cur.sumRaw += e.raw;
        cur.sumMax += e.max;
        byBucket.set(agg.bucket_key, cur);
      }
      const engagedJury: number[] = [];
      for (const agg of activeBuckets) {
        const acc = byBucket.get(agg.bucket_key);
        const jury =
          acc && acc.sumMax > 0 ? (acc.sumRaw / acc.sumMax) * agg.jury_max : 0;
        const merit = agg.merit_max > 0 ? Math.min(agg.merit_max, roleBonus) : 0;
        const value = Math.max(0, Math.min(agg.weightage, merit + jury));
        baseScore += value - merit;
        positionPoints += merit;
        if (acc || merit > 0) engagedJury.push(value - merit);
      }
      minSession = engagedJury.length > 0 ? Math.min(...engagedJury) : 0;
    } else {
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
        } else if (method === "weighted_90") {
          // Yi 2026 Workbook (weighted average → /90): score the student only on
          // the components they were scored in. base = (Σ component means ÷ Σ
          // component maxes) × 90, so 3 sessions at 80% ≈ 72/90 — same ceiling as
          // 6 sessions. Position Points (max 10) add on top → /100. Uses raw means
          // + maxes directly, independent of normalize_per_session.
          const sumRaw = sessionEntries.reduce((a, e) => a + e.raw, 0);
          const sumMax = sessionEntries.reduce((a, e) => a + e.max, 0);
          baseScore = sumMax > 0 ? (sumRaw / sumMax) * 90 : 0;
          // Consistency floor (for the MVP award): the weakest single component,
          // expressed on the same /90 scale.
          const ratios = sessionEntries
            .filter((e) => e.max > 0)
            .map((e) => (e.raw / e.max) * 90);
          minSession = ratios.length > 0 ? Math.min(...ratios) : 0;
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
      // Position Points (legacy: auto, capped at 10, added on top).
      positionPoints = Math.min(10, roleBonus);
    }

    // MVP basis (Director ruling: "even across sessions") — the weakest single
    // session expressed as a 0–1 fraction of its OWN max, so sessions of
    // different sizes (10–20) compare fairly. 0 when no scored session has a max.
    const consistencyRatios = sessionEntries
      .filter((e) => e.max > 0)
      .map((e) => e.raw / e.max);
    const consistencyFloor =
      consistencyRatios.length > 0 ? Math.min(...consistencyRatios) : 0;
    const consistencySessionCount = consistencyRatios.length;

    // jury_count = distinct jurors who scored this participant (across sessions).
    const juryCount = new Set(pScores.map((s) => s.jury_assignment_id)).size;
    // positionPoints computed above (bucket: Σ Leadership merit; legacy: min(10, role bonus)).
    // Disciplinary flags still gate the Decorum award (kept).
    const hasDisciplinary = hasDisciplinaryFlag(pScores);

    // Special remarks (Director decision 2026-06-03): each raised remark
    // adjusts the final total ONCE at full value if ANY juror in ANY session
    // raised it for this participant — not averaged. Net of all raised flags.
    const specialRemarksDelta =
      (pScores.some((s) => s.flag_no_confidence_brought)
        ? flagDeltas.no_confidence_brought
        : 0) +
      (pScores.some((s) => s.flag_walkout) ? flagDeltas.walkout : 0) +
      (pScores.some((s) => s.flag_ruckus) ? flagDeltas.ruckus : 0) +
      (pScores.some((s) => s.flag_suspension) ? flagDeltas.suspension : 0);

    // Final additive total out of 100: 6 juror-scored components (sum 90) +
    // Position Points (max 10) + special remarks, clamped to [0, 100].
    // The 100-cap assumes the configured per-component maxes total <= 90 for
    // the active aggregation (true for the Yi 2026 Workbook 'sum' / 'weighted_90'
    // models, both /100). If a future event uses 'best_n' with a single session
    // max > 90, revisit the cap so a legitimate total isn't silently clipped.
    const avgScore = Math.max(
      0,
      Math.min(100, baseScore + positionPoints + specialRemarksDelta)
    );
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
      positionPoints,
      hasDisciplinary,
      consistencyFloor: Math.round(consistencyFloor * 1000) / 1000,
      consistencySessionCount,
      // Shared committee level (same for every member of a committee) — Team
      // Spirit ranks on this so the whole top committee co-wins, matching the
      // leaderboard's committee value (interview 2026-06-14, Bug C).
      committeeLevel: cl ? cl.cmte + cl.bill : 0,
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

  // ── 15 awards from the Yi 2026 Evaluation Workbook ─────────────
  // All awards roll up the NAMESPACED criterion keys "<comp>.<criterion>"
  // (comp ∈ {mupi,qh,zero,pol,cmte,bill}). parentScoreByKey() sums any key
  // equal to OR prefixed by the family, so parentScoreByKey(b,'pol') =
  // Political Acumen total and parentScoreByKey(b,'mupi.conduct') = the single
  // MuPI conduct criterion. sumKeys() adds an explicit list of criteria OR whole
  // families — pass a family key like "pol" to sum every pol.* criterion.
  // Awards 1–9 are open to all; the final 6 add role/side eligibility per the
  // official Yi 2026 Awards & Recognition matrix (matrix #s noted inline).

  const all = (_p: ParticipantLite) => true;

  // Sum a set of namespaced criterion keys OR whole families.
  const sumKeys =
    (keys: string[]) =>
    (r: ResultRow): number =>
      keys.reduce((sum, k) => sum + parentScoreByKey(r.score_breakdown, k), 0);

  // Role/side eligibility for the 6 matrix awards.
  const isSpeaker = (p: ParticipantLite) => p.parliament_role === "speaker";
  const isLeadership = (p: ParticipantLite) =>
    !!p.parliament_role && LEADERSHIP_ROLES.has(p.parliament_role);
  const isRuling = (p: ParticipantLite) =>
    isRulingMP(p.parliament_role, p.party_side);
  const isOpposition = (p: ParticipantLite) =>
    isOppositionMP(p.parliament_role, p.party_side);
  const isIndependent = (p: ParticipantLite) =>
    p.parliament_role === "independent_mp";

  // MVP min-participation gate (Director ruling "at least half"): a participant
  // must be scored in ≥ half as many sessions as the most-scored participant
  // (a proxy for the event's scored-session count) to be MVP-eligible — blocks a
  // one-session near-perfect score from beating a consistent all-rounder.
  const maxScoredSessions = resultRows.reduce(
    (m, r) => Math.max(m, r.consistencySessionCount),
    0
  );
  const mvpMinSessions = Math.max(1, Math.ceil(maxScoredSessions / 2));

  // The award MATH (eligibility + ranking) lives in this registry keyed by
  // award_key; the workbook formulas are fixed, so they stay in code. The
  // yip.award_definitions table owns label / recipient count / on-off / order
  // (admin-editable, with per-event overrides in yip.event_award_config). Seeded
  // defaults reproduce the original hardcoded 15 exactly.
  type AwardSpec = {
    eligible: (p: ParticipantLite, r: ResultRow) => boolean;
    rankBy: (r: ResultRow) => number;
    isTeam?: boolean;
  };
  const AWARD_REGISTRY: Record<string, AwardSpec> = {
    best_parliamentarian: { eligible: all, rankBy: (r) => r.avg_score },
    best_debater: {
      eligible: all,
      rankBy: (r) =>
        parentScoreByKey(r.score_breakdown, "pol") +
        parentScoreByKey(r.score_breakdown, "qh"),
    },
    best_research_presentation: {
      eligible: all,
      rankBy: sumKeys([
        "mupi.research_constituency",
        "qh.subject_knowledge",
        "bill.understanding",
        "cmte.research_contribution",
      ]),
    },
    mvp: {
      eligible: (_p, r) => r.consistencySessionCount >= mvpMinSessions,
      rankBy: (r) => r.consistencyFloor,
    },
    best_constituency_rep: {
      eligible: all,
      rankBy: (r) =>
        parentScoreByKey(r.score_breakdown, "mupi") +
        parentScoreByKey(r.score_breakdown, "qh") +
        parentScoreByKey(r.score_breakdown, "zero"),
    },
    exemplary_decorum: {
      eligible: (_p, r) => !r.hasDisciplinary,
      rankBy: sumKeys(["mupi.conduct", "zero.conduct", "bill.conduct"]),
    },
    // Team award: allTied → every member of the top committee co-wins. Ranks on
    // the shared committee level (cmte+bill, from the /60 committee score).
    team_spirit: { eligible: all, rankBy: (r) => r.committeeLevel, isTeam: true },
    innovative_ideas: {
      eligible: all,
      rankBy: sumKeys([
        "zero.creativity",
        "zero.problem_solving",
        "zero.policy_orientation",
      ]),
    },
    community_impact: {
      eligible: all,
      rankBy: sumKeys([
        "zero.policy_orientation",
        "bill.feasibility",
        "mupi.research_constituency",
      ]),
    },
    best_speaker: { eligible: isSpeaker, rankBy: (r) => r.avg_score },
    leadership_excellence: {
      eligible: isLeadership,
      // 50% Leadership (position points /10) + 50% Participation (base /90).
      // Real positionPoints — NOT (avg − base), which carries the special-
      // remarks delta and would distort the leadership half.
      rankBy: (r) =>
        0.5 * Math.min(1, Math.max(0, r.positionPoints) / 10) +
        0.5 * Math.min(1, r.baseScore / 90),
    },
    best_member_ruling: {
      eligible: isRuling,
      rankBy: sumKeys(["pol", "qh", "bill"]),
    },
    best_member_opposition: {
      eligible: isOpposition,
      rankBy: sumKeys(["qh", "zero", "pol"]),
    },
    most_persuasive: { eligible: all, rankBy: sumKeys(["pol", "bill"]) },
    independent_voice: {
      eligible: isIndependent,
      rankBy: sumKeys(["pol", "zero", "qh"]),
    },
  };

  // ── Config-driven award formulas ──────────────────────────────────────
  // Each award's eligibility + rank rule is now editable in the DB
  // (yip.award_definitions.eligibility / rank_mode / rank_keys). buildSpec()
  // reconstructs the same { eligible, rankBy } the AWARD_REGISTRY above
  // produced; the seed reproduces the registry exactly, and any row missing
  // rank_mode falls back to the in-code registry so behaviour is never lost.
  type AwardConfigRow = {
    award_key: string;
    label: string;
    default_recipients: number;
    is_active: boolean;
    display_order: number;
    eligibility: string | null;
    rank_mode: string | null;
    rank_keys: string[] | null;
    is_team: boolean | null;
  };
  function eligibilityFn(e: string): (p: ParticipantLite, r: ResultRow) => boolean {
    switch (e) {
      case "speaker":
        return isSpeaker;
      case "leadership":
        return isLeadership;
      case "ruling":
        return isRuling;
      case "opposition":
        return isOpposition;
      case "independent":
        return isIndependent;
      case "no_disciplinary":
        return (_p, r) => !r.hasDisciplinary;
      default:
        return all;
    }
  }
  function rankByFn(mode: string, keys: string[]): (r: ResultRow) => number {
    switch (mode) {
      case "overall_total":
        return (r) => r.avg_score;
      case "base_score":
        return (r) => r.baseScore;
      case "consistency":
        return (r) => r.consistencyFloor;
      case "committee_level":
        return (r) => r.committeeLevel;
      case "leadership_blend":
        return (r) =>
          0.5 * Math.min(1, Math.max(0, r.positionPoints) / 10) +
          0.5 * Math.min(1, r.baseScore / 90);
      default:
        return sumKeys(keys);
    }
  }
  function buildSpec(row: AwardConfigRow): AwardSpec {
    const baseElig = eligibilityFn(row.eligibility ?? "all");
    const rankBy = rankByFn(row.rank_mode ?? "family_sum", row.rank_keys ?? []);
    // 'consistency' (MVP) carries the min-participation gate, like the registry.
    const eligible =
      row.rank_mode === "consistency"
        ? (p: ParticipantLite, r: ResultRow) =>
            baseElig(p, r) && r.consistencySessionCount >= mvpMinSessions
        : baseElig;
    return { eligible, rankBy, isTeam: row.is_team ?? false };
  }

  // Load award definitions + this event's overrides; award each ACTIVE one its
  // effective recipient count (override ?? default), in display order. Untyped
  // client view — the formula columns are newer than the generated types.
  const { data: awardDefs } = await (supabase as unknown as SupabaseClient)
    .from("award_definitions")
    .select(
      "award_key, label, default_recipients, is_active, display_order, eligibility, rank_mode, rank_keys, is_team"
    )
    .order("display_order");
  const { data: awardCfgRows } = await supabase
    .from("event_award_config")
    .select("award_key, recipients, is_active")
    .eq("event_id", eventId);
  const awardOverrideByKey = new Map(
    (awardCfgRows ?? []).map((o) => [o.award_key, o])
  );
  for (const def of (awardDefs ?? []) as AwardConfigRow[]) {
    // Config-driven when rank_mode is set (seeded for all 15); else fall back to
    // the in-code registry so no award ever silently disappears.
    const spec = def.rank_mode ? buildSpec(def) : AWARD_REGISTRY[def.award_key];
    if (!spec) continue; // unknown key (future-proof) — skip
    const ov = awardOverrideByKey.get(def.award_key);
    const active = ov?.is_active ?? def.is_active;
    if (!active) continue;
    const recipients = ov?.recipients ?? def.default_recipients;
    assignAward(
      resultRows,
      participantMap,
      def.label,
      spec.eligible,
      spec.rankBy,
      { allTied: spec.isTeam, recipients }
    );
  }

  // ── Manual award overrides (chair's final say) — final pass ───────
  // A chair can pin THE winner for any award (yip.award_overrides). Applied
  // last so it always beats the auto-computed holder, and re-read on every
  // recompute so it survives. If the chair's pick has no result row (not
  // scored), the auto-winner is left intact rather than the award vanishing.
  const { data: overrides } = await supabase
    .from("award_overrides")
    .select("award_label, participant_id")
    .eq("event_id", eventId);
  for (const ov of overrides ?? []) {
    const target = resultRows.find(
      (r) => r.participant_id === ov.participant_id
    );
    if (!target) continue;
    for (const r of resultRows) removeAward(r, ov.award_label);
    appendAward(target, ov.award_label);
  }

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

  // NOTE: Names persist on results & certificates. Publishing results no longer
  // auto-anonymizes PII. The manual "Remove personal data" tool in the People
  // admin (anonymizeEventPII) remains the only, intentional way to strip names.

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
    party_number: number | null;
    ministry: string | null;
    constituency_name: string | null;
    constituency_number: number | null;
    committee_name: string | null;
    committee_number: number | null;
  };
};

export async function getResults(
  eventId: string
): Promise<ResultWithParticipant[]> {
  // Scores / leaderboard / metrics are national/super-admin-only (2026-06-13).
  // Organisers may RUN scoring (canManage) but NOT read the results.
  const access = await getYipEventAccess(eventId);
  if (!access.canViewScores) return [];

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
        party_number,
        ministry,
        constituency_name,
        constituency_number,
        committee_name,
        committee_number
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
  // Scores / leaderboard / metrics are national/super-admin-only (2026-06-13).
  const access = await getYipEventAccess(eventId);
  if (!access.canViewScores) return null;

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
