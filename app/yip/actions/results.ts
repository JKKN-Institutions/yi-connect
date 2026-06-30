"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceClient } from "@/lib/yip/supabase/server";
import { getYipEventAccess } from "@/lib/yip/auth/event-access";
import { revalidatePath } from "next/cache";
import { parentScoreByKey } from "@/lib/yip/rubric";
import { getPositionBonusConfigAdmin } from "./positions";
import { getScoringSettings } from "./scoring-settings";
import { listSessionParameters } from "./session-parameters";
import { listScoringBuckets } from "./scoring-buckets";
import { getScoringFlagsConfig } from "./scoring-flags";
import { getSessionScoringParams } from "./scoring";

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
  // A deposed PM / Deputy PM stays on the ruling bench.
  "ex_prime_minister",
  "ex_deputy_prime_minister",
]);

const OPPOSITION_ROLES = new Set([
  "leader_of_opposition",
  "shadow_minister",
  "mp",
  "bill_committee",
  // A deposed Leader of Opposition stays on the opposition bench.
  "ex_leader_of_opposition",
]);

const LEADERSHIP_ROLES = new Set([
  "speaker",
  "deputy_speaker",
  "prime_minister",
  "deputy_prime_minister",
  "leader_of_opposition",
  "party_leader",
  "coalition_leader",
  "cabinet_minister",
  "shadow_minister",
  "committee_chair",
  // "Ex-" deposed leaders keep their leadership standing (and points). Note:
  // role-SPECIFIC awards (e.g. "Best Prime Minister") key off the exact role
  // string, so those still resolve to the CURRENT holder, not the Ex-.
  "ex_prime_minister",
  "ex_deputy_prime_minister",
  "ex_leader_of_opposition",
  "ex_speaker",
  "ex_deputy_speaker",
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
  // Day-presence signals (Director ruling 2026-06-25). Treated as "not checked
  // in" unless strictly === true (the columns are NOT NULL booleans today, but
  // the strict check is defensive against any future nullable backfill).
  checked_in_day1: boolean | null;
  checked_in_day2: boolean | null;
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
  committeeLevel: number; // Team Spirit award — committee's AVG member committee-session score (re-based 2026-06-25; committee-LEVEL machinery removed)
  // Day-presence eligibility (Director ruling 2026-06-25). dayComplete=false ⇒
  // the participant attended only one day of a two-day event: excluded from the
  // overall rank (rank=null) and EVERY award, but still written WITH their
  // scores plus a surfaced reason. true for everyone at a one-day event.
  dayComplete: boolean;
  notRankedReason: string | null; // e.g. "Not ranked — absent Day 2"
  rank: number | null; // null = not ranked (incomplete attendance)
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

// NOTE: the former per-award assignAward() helper (independent assignment, a
// student could stack awards) was REPLACED 2026-06-25 by the single cap-aware,
// scarce-first pass in computeResults() (ONE award per student). Its gate +
// tiebreak live there now. appendAward / removeAward remain the only mutators.

// Per-school award cap (Director ruling 2026-06-28): at most this many INDIVIDUAL
// awards per school. Team awards (Team Spirit) are a single collective committee
// prize and are EXEMPT. Blank/unknown school is exempt too (each blank is its own
// unknown school — grouping distinct unknown-school students would be wrong).
const SCHOOL_AWARD_CAP = 3;

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
  // MUST use the service-role (Admin) reader: position_bonus_config has RLS on
  // with no authenticated policy, so the anon/auth getPositionBonusConfig() reads
  // 0 rows and silently falls back to handbook DEFAULTS — which omit every ex_*
  // role (ex-leaders → 0 pts) and use lower base values than the configured ones.
  // The Admin reader bypasses RLS and returns the real scoring-console values.
  const positionConfig = await getPositionBonusConfigAdmin();
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
    .select("id, agenda_type, session_key, is_scoreable, day, exclude_from_final")
    .eq("event_id", eventId);
  // Map agenda_item_id → { agenda_type, session_key, is_scoreable, exclude_from_final }
  // so per-session config can be resolved by session_key FIRST (1:1), falling back
  // to agenda_type; non-scoreable sessions are excluded from aggregation (Bug A);
  // and exclude_from_final sessions stay jury-scoreable but are dropped from the
  // /90 academic total (Director 2026-06-25: e.g. speech sessions = leadership-only).
  const agendaById = new Map<
    string,
    {
      agenda_type: string | null;
      session_key: string | null;
      is_scoreable: boolean;
      exclude_from_final: boolean;
    }
  >(
    (agendaRows ?? []).map((a) => [
      a.id,
      {
        agenda_type: a.agenda_type,
        session_key: a.session_key,
        is_scoreable: a.is_scoreable === true,
        exclude_from_final:
          (a as { exclude_from_final?: boolean | null }).exclude_from_final ===
          true,
      },
    ])
  );

  // ── Two-day detection (Director ruling 2026-06-25) ──────────────────
  // For a genuinely TWO-DAY event, a participant must be checked in on BOTH
  // days to be ranked / award-eligible; a one-day attendee is "marked
  // incomplete — NOT ranked" (excluded from rank + every award, but still
  // shown with their scores and a clear reason).
  //
  // SIGNAL CHOICE: an event counts as two-day iff it has >= 1 SCOREABLE day-2
  // agenda item. We deliberately do NOT key off yip.events.day2_date — that
  // column is NOT NULL on every event (the create-event form auto-fills
  // day2 = day1 + 1), so "day2_date IS NOT NULL" is true for 100% of events
  // and cannot distinguish one-day from two-day. The agenda template also
  // seeds 11 (non-scoreable) day-2 placeholder items on every event, so
  // "has any day-2 item" is likewise always true. The presence of a
  // *scoreable* day-2 session is the only signal that day 2 actually ran as a
  // scored part of the event — and it reuses the exact is_scoreable + day
  // metadata the engine already trusts for aggregation (Bug A). It is also
  // self-consistent: a participant can only earn day-2 scores when scoreable
  // day-2 sessions exist, so the gate activates precisely when day-2 presence
  // is meaningful. Events with no scoreable day-2 session ⇒ NOT two-day ⇒
  // every participant is dayComplete ⇒ zero behaviour change.
  const isTwoDayEvent = (agendaRows ?? []).some(
    (a) => a.day === 2 && a.is_scoreable === true
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

  // NOTE (Director ruling 2026-06-25): the committee-LEVEL (shared /60) scoring
  // machinery has been REMOVED. yip.committee_scores + yip.jury_committee_assignments
  // were 0 rows platform-wide and the model was cut. Each juror's raw committee-
  // session criterion now stands as-is (exactly the legacy no-committee-score
  // behaviour). Team Spirit is re-based below: a committee's Team Spirit score is
  // the AVERAGE, across its members, of each member's individual committee-session
  // contribution (committee_bill_drafting + bill_presentation_voting), computed
  // AFTER the per-participant loop.

  // 2. Participants (with constituency for Best Constituency Rep / Community Impact)
  const { data: participants, error: pError } = await supabase
    .from("participants")
    .select("id, full_name, parliament_role, party_side, school_name, constituency_name, committee_name, checked_in_day1, checked_in_day2")
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
  // Team Spirit re-base (Director ruling 2026-06-25): each participant's INDIVIDUAL
  // contribution across the two committee sessions ('committee_bill_drafting' +
  // 'bill_presentation_voting'), summed from sessionEntries raw. Averaged per
  // committee AFTER the loop to set committeeLevel on every member's row.
  const COMMITTEE_SESSION_KEYS = new Set([
    "committee_bill_drafting",
    "bill_presentation_voting",
  ]);
  const committeeContribByParticipant = new Map<string, number>();

  for (const participant of participants) {
    // Bug A fix (rehearsal 2026-06-14): only is_scoreable sessions count toward
    // results — matches the jury UI, which exposes only is_scoreable sessions
    // (jury-sessions.ts). Excludes stray/leftover/test scores on non-scoreable
    // sessions (and null-agenda rows) that would otherwise inflate the additive
    // 'sum' total and silently mis-rank a participant. Proven at 140-scale: a
    // single stray 100-max score pinned a mid-rank participant at the /100 clamp,
    // jumping them from rank 69 to rank 1.
    const pScores = (scoresByParticipant.get(participant.id) ?? []).filter(
      (s) => {
        if (s.agenda_item_id == null) return false;
        const meta = agendaById.get(s.agenda_item_id);
        // Scoreable AND not flagged leadership-only: exclude_from_final sessions
        // stay jury-scoreable but never enter the /90 academic total.
        return meta?.is_scoreable === true && meta.exclude_from_final !== true;
      }
    );
    if (pScores.length === 0) continue;

    // Per-session aggregation, driven by the global scoring settings (admin
    // Scoring Rules screen — nothing hardcoded). Each scoreable agenda item
    // maps 1:1 to a scoring component (session_key); a participant's score for
    // a component = MEAN of that component's juror total_scores. When
    // normalize_per_session is false (Yi 2026 Workbook additive model) the raw
    // component means are used as-is. Components are then combined per the
    // chosen method. Position Points apply ONCE on top (capped at 10).
    // #4 two-level averaging: group each session's scores BY JUROR. A juror's
    // turns (occurrences) average into one per-juror mark, then the session mark
    // is the mean of those per-juror marks — every juror counts equally no
    // matter how many turns they scored. Backward-compatible: with one row per
    // juror (the pre-#4 norm) each juror's mean is just that row, so the session
    // mean is identical to the old "mean across jurors".
    const bySessionJuror = new Map<string, Map<string, number[]>>();
    for (const s of pScores) {
      const key = s.agenda_item_id ?? "__none__";
      // Each juror's raw total_score stands as-is. The committee-LEVEL (shared
      // /60) swap was removed 2026-06-25 — the two committee sessions are now
      // scored purely on each juror's individual marks.
      const value = s.total_score;
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

    // Team Spirit basis (Director ruling 2026-06-25): this participant's individual
    // contribution in the two committee sessions = Σ raw over the committee
    // session_keys (0 when not scored in them). Averaged per committee after the
    // loop to derive each committee's Team Spirit score.
    const committeeContribution = sessionEntries.reduce(
      (sum, e) =>
        e.sessionKey && COMMITTEE_SESSION_KEYS.has(e.sessionKey)
          ? sum + e.raw
          : sum,
      0
    );
    committeeContribByParticipant.set(participant.id, committeeContribution);

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
        } else if (method === "weighted_pct_90") {
          // Uniform model (Director 2026-06-25): every session is scored on its
          // own rubric (all shown /100 in the jury UI), each normalised to a 0–1
          // fraction of its OWN max, then weighted by the session's configured
          // session_weight (the weightage table — NOT the rubric size). So a
          // /100, /20 or /15 rubric carries exactly the weight the Director set,
          // and "score out of 100 → apply weightage → /90" holds literally.
          // base = Σ(frac × weight) ÷ Σ(weight) × 90; Position Points (≤10) on top.
          let sumWF = 0;
          let sumW = 0;
          for (const e of sessionEntries) {
            if (e.max <= 0 || e.weight <= 0) continue;
            sumWF += (e.raw / e.max) * e.weight;
            sumW += e.weight;
          }
          baseScore = sumW > 0 ? (sumWF / sumW) * 90 : 0;
          // Consistency floor (MVP award): weakest single component on the /90 scale.
          const ratios = sessionEntries
            .filter((e) => e.max > 0)
            .map((e) => (e.raw / e.max) * 90);
          minSession = ratios.length > 0 ? Math.min(...ratios) : 0;
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

    // Day-presence gate (Director ruling 2026-06-25). At a two-day event a
    // participant is dayComplete only when checked in on BOTH days (strict
    // === true; NULL/false ⇒ not checked in). At a one-day event everyone is
    // dayComplete, so this is inert there. Day numbers in the reason follow the
    // signal: it's always Day 2 that's missing or partial, but we phrase the
    // reason precisely from the actual flags so it never mislabels.
    const ciDay1 = participant.checked_in_day1 === true;
    const ciDay2 = participant.checked_in_day2 === true;
    const dayComplete = !isTwoDayEvent || (ciDay1 && ciDay2);
    let notRankedReason: string | null = null;
    if (!dayComplete) {
      // Two-day event + missing at least one day. Name the missing day(s).
      if (!ciDay1 && !ciDay2) {
        notRankedReason = "Not ranked — absent both days";
      } else if (!ciDay2) {
        notRankedReason = "Not ranked — absent Day 2";
      } else {
        notRankedReason = "Not ranked — absent Day 1";
      }
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
      // Team Spirit basis (re-based 2026-06-25): set to 0 here, then overwritten
      // after the loop with this committee's AVERAGE member committee-session
      // contribution, so the whole top committee co-wins (allTied award).
      committeeLevel: 0,
      dayComplete,
      notRankedReason,
      rank: null,
      award_category: null,
      computed_at: new Date().toISOString(),
    });
  }

  // 5. Sort + rank. ONLY dayComplete participants receive an overall rank
  //    (Director ruling 2026-06-25). One-day attendees of a two-day event keep
  //    rank=null and are excluded from the ordinal placement entirely — they do
  //    not occupy or shift a rank number. Their result row is still written
  //    (below) with their scores + notRankedReason so they're visibly flagged,
  //    never silently dropped. At a one-day event every row is dayComplete, so
  //    this reproduces the original full-field ranking exactly.
  const rankableRows = resultRows.filter((r) => r.dayComplete);
  rankableRows.sort((a, b) => b.avg_score - a.avg_score);
  let currentRank = 1;
  for (let i = 0; i < rankableRows.length; i++) {
    if (i > 0 && rankableRows[i].avg_score < rankableRows[i - 1].avg_score) {
      currentRank = i + 1;
    }
    rankableRows[i].rank = currentRank;
  }

  // 5b. Team Spirit re-base (Director ruling 2026-06-25): a committee's Team
  //     Spirit score = the AVERAGE, across that committee's members, of each
  //     member's individual committee-session contribution (Σ raw over
  //     'committee_bill_drafting' + 'bill_presentation_voting'). Group the
  //     result rows by committee_name, average the contributions, and write that
  //     committee average onto every member's committeeLevel. Members with no
  //     committee_name keep committeeLevel 0 (they cannot win a team award).
  const committeeNameById = new Map<string, string | null>(
    participants.map((p) => [p.id, p.committee_name])
  );
  const committeeMemberRows = new Map<string, ResultRow[]>();
  for (const r of resultRows) {
    const cname = committeeNameById.get(r.participant_id);
    if (!cname) continue;
    const arr = committeeMemberRows.get(cname) ?? [];
    arr.push(r);
    committeeMemberRows.set(cname, arr);
  }
  for (const rows of committeeMemberRows.values()) {
    const avg =
      rows.reduce(
        (sum, r) => sum + (committeeContribByParticipant.get(r.participant_id) ?? 0),
        0
      ) / rows.length;
    for (const r of rows) r.committeeLevel = avg;
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
    // committeeLevel = the committee's AVERAGE member committee-session score
    // (re-based 2026-06-25; the shared /60 committee-LEVEL model was removed).
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

  // Load award definitions + this event's overrides; build the ACTIVE award
  // specs (config-driven via buildSpec when rank_mode is set — seeded for all 15
  // — else the in-code AWARD_REGISTRY so no award ever silently disappears), with
  // each award's effective recipient count (override ?? default). Untyped client
  // view — the formula columns are newer than the generated types.
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

  // ── Cap-aware, scarce-first award assignment (Director ruling 2026-06-25) ──
  // ONE award per student. Previously each award was assigned independently, so a
  // strong student could stack several. Now:
  //   1. Build every ACTIVE award's RANKED ELIGIBLE candidate list (the SAME
  //      gate assignAward used: r.dayComplete && eligible(p,r) && rankBy(r) > 0,
  //      sorted rankBy desc → avg_score desc → participant_id), and record its
  //      pool size.
  //   2. Order the awards SCARCE-FIRST (smallest eligible pool first, then by
  //      display_order) so role-locked awards (Best Speaker has a pool of 1) are
  //      assigned before the open-to-all merit awards and can never go empty
  //      because a generalist grabbed the only eligible student. Team Spirit (a
  //      large team pool) naturally lands last.
  //   3. Assign with a global `awarded` Set: each award goes to its highest-ranked
  //      candidate(s) NOT already holding an award; once awarded, a student is
  //      skipped by every later award. Each student ends with AT MOST ONE award.
  type ActiveAward = {
    awardKey: string;
    label: string;
    isTeam: boolean;
    recipients: number;
    displayOrder: number;
    /** The award's ranking metric — used to record each candidate's score. */
    rankBy: (r: ResultRow) => number;
    /** Ranked eligible candidate rows (best first), pre-cap. */
    candidates: ResultRow[];
    poolSize: number;
  };

  const activeAwards: ActiveAward[] = [];
  for (const def of (awardDefs ?? []) as AwardConfigRow[]) {
    const spec = def.rank_mode ? buildSpec(def) : AWARD_REGISTRY[def.award_key];
    if (!spec) continue; // unknown key (future-proof) — skip
    const ov = awardOverrideByKey.get(def.award_key);
    const active = ov?.is_active ?? def.is_active;
    if (!active) continue;
    const recipients = Math.max(1, ov?.recipients ?? def.default_recipients);

    // Ranked eligible candidate list — identical gate + tiebreak to assignAward:
    // day-presence + the award's eligibility predicate + a positive rankBy
    // signal (never fabricate a winner from an all-zero field), sorted rankBy
    // desc, then overall avg_score desc, then a stable participant_id.
    const candidates = resultRows
      .filter((r) => {
        const p = participantMap.get(r.participant_id);
        return Boolean(
          p && r.dayComplete && spec.eligible(p, r) && spec.rankBy(r) > 0
        );
      })
      .sort(
        (a, b) =>
          spec.rankBy(b) - spec.rankBy(a) ||
          b.avg_score - a.avg_score ||
          (a.participant_id < b.participant_id ? -1 : 1)
      );

    activeAwards.push({
      awardKey: def.award_key,
      label: def.label,
      isTeam: spec.isTeam ?? false,
      recipients,
      displayOrder: def.display_order,
      rankBy: spec.rankBy,
      candidates,
      poolSize: candidates.length,
    });
  }

  // Scarce-first ordering: rarest eligible pool first; prestige (display_order)
  // breaks ties. This is the assignment order; the on-screen / candidate-table
  // order stays display_order (handled at write time + in the UI).
  const assignmentOrder = [...activeAwards].sort(
    (a, b) => a.poolSize - b.poolSize || a.displayOrder - b.displayOrder
  );

  const awarded = new Set<string>(); // participant_ids that already hold an award
  // Per-school INDIVIDUAL-award count (Director ruling 2026-06-28). Team awards
  // don't touch this; blank/unknown school is uncapped.
  const schoolAwardCount = new Map<string, number>();
  const schoolOf = (pid: string) =>
    (participantMap.get(pid)?.school_name ?? "").trim();

  for (const aw of assignmentOrder) {
    if (aw.isTeam) {
      // Team award (Team Spirit): the winning committee is the candidates tied at
      // the top committeeLevel (every member of a committee shares the same
      // committeeLevel, so "tied at the top" == the best committee). Award its
      // members who are NOT already awarded. If the very top committee has NO
      // un-awarded member, CASCADE to the next committee (next-lower
      // committeeLevel group) with ≥1 un-awarded member. So Team Spirit still
      // lands on a strong committee even when the top one's members already won
      // individual awards.
      let i = 0;
      while (i < aw.candidates.length) {
        const level = aw.candidates[i].committeeLevel;
        // Collect this committeeLevel group (candidates are sorted by
        // committeeLevel desc, so equal-level rows are contiguous).
        let j = i;
        const group: ResultRow[] = [];
        while (j < aw.candidates.length && aw.candidates[j].committeeLevel === level) {
          group.push(aw.candidates[j]);
          j++;
        }
        const winners = group.filter((r) => !awarded.has(r.participant_id));
        if (winners.length > 0) {
          for (const r of winners) {
            appendAward(r, aw.label);
            awarded.add(r.participant_id);
          }
          break; // this committee won — done (no cascade past the first that wins)
        }
        i = j; // whole committee already awarded → cascade to the next one
      }
    } else {
      // Non-team award: walk the ranked list and give it to the first
      // `recipients` candidates NOT already holding an award AND whose school is
      // under the per-school cap.
      let given = 0;
      for (const r of aw.candidates) {
        if (given >= aw.recipients) break;
        if (awarded.has(r.participant_id)) continue;
        // Per-school cap: skip a candidate whose school already holds the max
        // individual awards (blank/unknown school is exempt → never capped).
        const school = schoolOf(r.participant_id);
        if (school && (schoolAwardCount.get(school) ?? 0) >= SCHOOL_AWARD_CAP) {
          continue;
        }
        appendAward(r, aw.label);
        awarded.add(r.participant_id);
        if (school) {
          schoolAwardCount.set(school, (schoolAwardCount.get(school) ?? 0) + 1);
        }
        given++;
      }
    }
  }

  // ── Manual award overrides (chair's final say) — final pass ───────
  // A chair can pin THE winner for any award (yip.award_overrides). Applied
  // last so it always beats the auto-computed holder, and re-read on every
  // recompute so it survives. If the chair's pick has no result row (not
  // scored), the auto-winner is left intact rather than the award vanishing.
  //
  // ONE-AWARD RULE under chair override (Director ruling 2026-06-25): pinning
  // student X to award A must keep the one-award-per-student invariant. So we:
  //   (a) strip award A from whoever auto-won it, then
  //   (b) strip any OTHER award X already holds (X now holds A and only A), then
  //   (c) give A to X.
  // Note: stripping X's previous award B leaves B with one fewer holder — we do
  // NOT auto-cascade B to its next contender (the chair is making a deliberate,
  // final call; reshuffling other awards behind their back would surprise them).
  // The top-5 candidate table still shows B's full shortlist so the next-best
  // contender is visible if the chair wants to pin B too.
  const { data: overrides } = await supabase
    .from("award_overrides")
    .select("award_label, participant_id")
    .eq("event_id", eventId);
  // The per-school cap also binds chair overrides (Director ruling 2026-06-28:
  // overrides RESPECT the cap). Team-award labels are exempt. Build the team-label
  // set + a live per-school INDIVIDUAL-award count from the post-auto state (each
  // row holds ≤1 award here, so award_category is a single label or null).
  const teamLabels = new Set(
    activeAwards.filter((a) => a.isTeam).map((a) => a.label)
  );
  const isCappedAward = (label: string | null) =>
    Boolean(label) && !teamLabels.has(label as string);
  // award_category is a comma-joined field; read it as a list so the count stays
  // correct even if a row ever carries more than one label. "Holds an individual
  // award" = at least one of its labels is a (non-team) capped award.
  const holdsCappedAward = (cat: string | null) =>
    (cat ?? "").split(", ").some((l) => isCappedAward(l));
  const countIndividualBySchool = () => {
    const m = new Map<string, number>();
    for (const r of resultRows) {
      if (holdsCappedAward(r.award_category)) {
        const s = schoolOf(r.participant_id);
        if (s) m.set(s, (m.get(s) ?? 0) + 1);
      }
    }
    return m;
  };
  let schoolCount = countIndividualBySchool();

  for (const ov of overrides ?? []) {
    const target = resultRows.find(
      (r) => r.participant_id === ov.participant_id
    );
    if (!target) continue;
    // Day-presence gate also applies to chair overrides (Director ruling
    // 2026-06-25: excluded from EVERY award). A one-day attendee of a two-day
    // event cannot be pinned an award; leave the auto-winner intact rather than
    // awarding an unranked student.
    if (!target.dayComplete) continue;
    const A = ov.award_label;

    // Cap check for INDIVIDUAL awards: would pinning A to X push X's school past
    // the cap? Account for the strips this pin performs — X drops any award it
    // holds, and A's current same-school holders drop A. If it would still
    // breach, leave the auto-winner intact (the override is ignored this
    // recompute; setAwardWinner surfaces the reason to the chair).
    const tSchool = schoolOf(target.participant_id);
    if (isCappedAward(A) && tSchool) {
      let projected = schoolCount.get(tSchool) ?? 0;
      if (holdsCappedAward(target.award_category)) projected -= 1; // X swaps its award for A
      for (const r of resultRows) {
        if (
          r.participant_id !== target.participant_id &&
          (r.award_category ?? "").split(", ").includes(A) &&
          schoolOf(r.participant_id) === tSchool
        ) {
          projected -= 1; // a same-school current holder of A loses it
        }
      }
      projected += 1; // X gains A
      if (projected > SCHOOL_AWARD_CAP) continue; // respect the cap
    }

    // (a) take award A away from its current auto-winner(s).
    for (const r of resultRows) removeAward(r, A);
    // (b) take away any OTHER award X currently holds, so X ends with only A.
    target.award_category = null;
    // (c) award A to X.
    appendAward(target, A);
    // Refresh the per-school count so later overrides see this change.
    schoolCount = countIndividualBySchool();
  }

  // ── Surface the "not ranked" reason (Director ruling 2026-06-25) ──────
  // A day-incomplete participant is written WITH their scores but must be
  // VISIBLY flagged, never silently dropped. We reuse award_category (already
  // rendered as badges in the leaderboard and exported in the CSV "Remarks"
  // column) to carry the reason. Done as a final pass so the reason text is
  // never mistaken for an award label by the override add/remove logic above.
  // By construction these rows hold no awards (the central gate excluded them),
  // so award_category is null here and the reason stands alone.
  for (const r of resultRows) {
    if (!r.dayComplete && r.notRankedReason) {
      r.award_category = r.notRankedReason;
    }
  }

  // ── Top-5 candidate shortlist per award (Director ruling 2026-06-25) ──────
  // For each ACTIVE award, store its top 5 ranked candidates (the pre-cap
  // contenders, in display_order awards × rankBy order), each with the rankBy
  // score and is_winner = whether they ACTUALLY received the award AFTER the cap
  // + chair overrides (i.e. their final award_category carries this label). The
  // results page renders this so reviewers see who the contenders were and who
  // the cap/override actually landed it on. Each row holds ≤1 award, so the
  // label-membership check is exact (and team awards correctly flag every
  // co-winning committee member).
  const computedAt = new Date().toISOString();
  const candidateRecords = activeAwards.flatMap((aw) =>
    aw.candidates.slice(0, 5).map((r, idx) => {
      const labels = r.award_category ? r.award_category.split(", ") : [];
      return {
        event_id: eventId,
        award_key: aw.awardKey,
        award_label: aw.label,
        rank: idx + 1,
        participant_id: r.participant_id,
        // The metric this award ranks on, for THIS candidate (same rankBy that
        // ordered the list).
        score: Math.round(aw.rankBy(r) * 100) / 100,
        // After the cap + chair overrides each row holds ≤1 award, so a simple
        // label-membership check is exact (team awards flag every co-winner).
        is_winner: labels.includes(aw.label),
        computed_at: computedAt,
      };
    })
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

  // Replace this event's top-5 candidate shortlist (same delete+insert pattern
  // as results). Untyped client view — award_candidates is newer than the
  // generated types. Non-fatal: a failure here doesn't roll back the results.
  await (supabase as unknown as SupabaseClient)
    .from("award_candidates")
    .delete()
    .eq("event_id", eventId);
  if (candidateRecords.length > 0) {
    await (supabase as unknown as SupabaseClient)
      .from("award_candidates")
      .insert(candidateRecords);
  }

  const awardsAssigned = resultRows.filter((r) => r.award_category !== null).length;

  revalidatePath(`/yip/dashboard/events/${eventId}/results`);
  revalidatePath(`/yip/dashboard/events/${eventId}/scoring`);

  return {
    success: true,
    data: { computed: resultRows.length, awards_assigned: awardsAssigned },
  };
}

// ─── Day-2 check-in warning (interim-recompute guardrail) ────────
// On a TWO-DAY event (>= 1 scoreable day-2 agenda item — the SAME signal
// computeResults uses), computing results BEFORE Day-2 check-in marks every
// student "Not ranked — absent Day 2" (Director ruling 2026-06-25). That is an
// interim artifact — recomputing after check-in fixes it — but an all-unranked
// leaderboard is alarming, so we surface the state on the results page. We warn
// ONLY in the unambiguous case: a two-day event with ZERO Day-2 check-ins.
// Partial check-in is normal mid-event and must never false-alarm.
export async function getDay2CheckinWarning(
  eventId: string
): Promise<{
  isTwoDay: boolean;
  day2CheckedIn: number;
  total: number;
  shouldWarn: boolean;
}> {
  const none = {
    isTwoDay: false,
    day2CheckedIn: 0,
    total: 0,
    shouldWarn: false,
  };
  const access = await getYipEventAccess(eventId);
  if (!access.canViewScores) return none;
  const supabase = await createServiceClient();

  const { data: day2Items } = await supabase
    .from("agenda")
    .select("id")
    .eq("event_id", eventId)
    .eq("day", 2)
    .eq("is_scoreable", true)
    .limit(1);
  if (!day2Items || day2Items.length === 0) return none;

  const { count: day2CheckedIn } = await supabase
    .from("participants")
    .select("id", { count: "exact", head: true })
    .eq("event_id", eventId)
    .eq("checked_in_day2", true)
    .not("parliament_role", "is", null);
  const { count: total } = await supabase
    .from("participants")
    .select("id", { count: "exact", head: true })
    .eq("event_id", eventId)
    .not("parliament_role", "is", null);

  const checkedIn = day2CheckedIn ?? 0;
  return {
    isTwoDay: true,
    day2CheckedIn: checkedIn,
    total: total ?? 0,
    shouldWarn: checkedIn === 0,
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

// ─── Get Award Candidates (top-5 per award) ──────────────────────

export type AwardCandidate = {
  award_key: string;
  award_label: string;
  rank: number;
  participant_id: string;
  participant_name: string | null;
  score: number;
  is_winner: boolean;
};

export type AwardCandidateGroup = {
  award_key: string;
  award_label: string;
  candidates: AwardCandidate[]; // ordered rank 1..5
};

/**
 * Top-5 contender shortlist per award for this event (computed by
 * computeResults). Gated to the SAME audience as the leaderboard
 * (canViewScores → national/super-admin), so the contender view only renders
 * where the results do. Returns awards grouped + each group's candidates
 * ordered by rank (1 = best on that award's metric); the winner row(s) carry
 * is_winner=true.
 */
export async function getAwardCandidates(
  eventId: string
): Promise<AwardCandidateGroup[]> {
  const access = await getYipEventAccess(eventId);
  if (!access.canViewScores) return [];

  const supabase = await createServiceClient();

  // Untyped client view — award_candidates is newer than the generated types.
  const { data, error } = await (supabase as unknown as SupabaseClient)
    .from("award_candidates")
    .select(
      "award_key, award_label, rank, participant_id, score, is_winner, participant:participants(full_name)"
    )
    .eq("event_id", eventId)
    .order("award_key", { ascending: true })
    .order("rank", { ascending: true });

  if (error || !data) return [];

  type Row = {
    award_key: string;
    award_label: string;
    rank: number;
    participant_id: string;
    score: number;
    is_winner: boolean;
    participant: { full_name: string } | { full_name: string }[] | null;
  };

  // Group by award_key, preserving the rank order within each group.
  const groups = new Map<string, AwardCandidateGroup>();
  for (const r of data as unknown as Row[]) {
    const participant = Array.isArray(r.participant)
      ? r.participant[0]
      : r.participant;
    const candidate: AwardCandidate = {
      award_key: r.award_key,
      award_label: r.award_label,
      rank: r.rank,
      participant_id: r.participant_id,
      participant_name: participant?.full_name ?? null,
      score: r.score,
      is_winner: r.is_winner,
    };
    const g = groups.get(r.award_key);
    if (g) {
      g.candidates.push(candidate);
    } else {
      groups.set(r.award_key, {
        award_key: r.award_key,
        award_label: r.award_label,
        candidates: [candidate],
      });
    }
  }
  return Array.from(groups.values());
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
    // Distinct PARTICIPANTS this jury has scored (the X in "X / total") — a
    // jury scoring one person across 4 sessions is 1 participant, not 4.
    participantsScored: number;
    // Total score ROWS (one per session × turn) — the genuine "entries" count
    // that sums to the "Total Scores Submitted" headline.
    entriesSubmitted: number;
    // Distinct sessions this jury has scored in.
    sessionsCovered: number;
    draftsNotSubmitted: number;
    lastActivity: string | null;
    // The actual unsubmitted drafts (so an organiser can find WHERE the draft
    // is and submit it on the juror's behalf — drafts never count until
    // submitted). Empty when draftsNotSubmitted === 0.
    drafts: Array<{
      scoreId: string;
      participantId: string;
      participantName: string;
      constituencyNumber: number | null;
      agendaItemId: string | null;
      sessionTitle: string | null;
      totalScore: number;
      updatedAt: string | null;
    }>;
  }>;
  participantProgress: Array<{
    id: string;
    full_name: string;
    parliament_role: string | null;
    party_side: string | null;
    party_number: number | null;
    constituency_number: number | null;
    constituency_name: string | null;
    committee_number: number | null;
    committee_name: string | null;
    // Distinct JURIES that have scored this person (the X in "X / totalJuries")
    // — counted once per jury no matter how many sessions/turns. Never > total.
    juriesScored: number;
    // Distinct sessions this person has been scored in (any jury).
    sessionsScored: number;
    totalJuries: number;
    // Strict completeness (Director ruling 2026-06-26): true only when EVERY
    // session this person has any score in has been scored by ALL active juries
    // — i.e. the (juries × their sessions) grid is full. Drives "fully scored".
    fullyScored: boolean;
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
    .select("id, full_name, parliament_role, party_side, party_number, constituency_number, constituency_name, committee_number, committee_name")
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
    .select("id, participant_id, jury_assignment_id, agenda_item_id, total_score, status, submitted_at, updated_at")
    .eq("event_id", eventId)
    .eq("status", "submitted");

  // Drafts: saved but NOT yet submitted. Surfaced per-juror — WITH the
  // participant + session + saved total — so an organiser can find exactly
  // where each stuck draft is and submit it on the juror's behalf. Drafts never
  // enter any total until they're promoted to 'submitted'.
  const { data: draftScores } = await supabase
    .from("scores")
    .select("id, participant_id, jury_assignment_id, agenda_item_id, total_score, updated_at")
    .eq("event_id", eventId)
    .eq("status", "draft");

  const participantList = participants ?? [];
  const juryList = juries ?? [];
  const scoreList = scores ?? [];
  const draftList = draftScores ?? [];
  const totalJuries = juryList.length;

  // Session titles for the drafts (one fetch, only the ids in play).
  const draftAgendaIds = Array.from(
    new Set(draftList.map((d) => d.agenda_item_id).filter(Boolean))
  ) as string[];
  const agendaTitleById = new Map<string, string>();
  if (draftAgendaIds.length > 0) {
    const { data: ag } = await supabase
      .from("agenda")
      .select("id, title")
      .in("id", draftAgendaIds);
    for (const a of ag ?? []) agendaTitleById.set(a.id, a.title);
  }
  // Name + seat lookup (drafts are always for scoreable role-holders).
  const pById = new Map(participantList.map((p) => [p.id, p]));

  const juryProgress = juryList.map((j) => {
    const juryScores = scoreList.filter(
      (s) => s.jury_assignment_id === j.id
    );
    const lastScore = juryScores.sort(
      (a, b) =>
        new Date(b.submitted_at ?? b.updated_at ?? "").getTime() -
        new Date(a.submitted_at ?? a.updated_at ?? "").getTime()
    )[0];

    const drafts = draftList
      .filter((d) => d.jury_assignment_id === j.id)
      .map((d) => {
        const p = pById.get(d.participant_id);
        return {
          scoreId: d.id,
          participantId: d.participant_id,
          participantName: p?.full_name ?? "Unknown participant",
          constituencyNumber: p?.constituency_number ?? null,
          agendaItemId: d.agenda_item_id,
          sessionTitle: d.agenda_item_id
            ? agendaTitleById.get(d.agenda_item_id) ?? null
            : null,
          totalScore: Number(d.total_score) || 0,
          updatedAt: d.updated_at,
        };
      })
      .sort((a, b) => (b.updatedAt ?? "").localeCompare(a.updatedAt ?? ""));

    return {
      id: j.id,
      jury_name: j.jury_name,
      // Coverage by DISTINCT participants/sessions, not raw rows — a jury that
      // scored 20 people across 4 sessions is "20 participants · 80 entries · 4
      // sessions", not "80 / 144".
      participantsScored: new Set(juryScores.map((s) => s.participant_id)).size,
      entriesSubmitted: juryScores.length,
      sessionsCovered: new Set(
        juryScores.map((s) => s.agenda_item_id).filter(Boolean)
      ).size,
      draftsNotSubmitted: drafts.length,
      lastActivity: lastScore?.submitted_at ?? lastScore?.updated_at ?? null,
      drafts,
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

    // Distinct juries + sessions (count each once — multi-session/turn no longer
    // inflates the number; that was the "9 / 3" bug).
    const juriesScored = new Set(pScores.map((s) => s.jury_assignment_id)).size;
    const sessionsScored = new Set(
      pScores.map((s) => s.agenda_item_id).filter(Boolean)
    ).size;

    // Strict "fully scored": group this person's scores BY session, then require
    // EVERY session in play to carry all active juries. The (juries × sessions)
    // grid must be full. A session no jury has touched yet is unknowable, so it
    // can't be required — completeness is measured over sessions actually in play.
    const juriesBySession = new Map<string, Set<string>>();
    for (const s of pScores) {
      const key = s.agenda_item_id ?? "∅";
      let set = juriesBySession.get(key);
      if (!set) {
        set = new Set();
        juriesBySession.set(key, set);
      }
      set.add(s.jury_assignment_id);
    }
    const fullyScored =
      totalJuries > 0 &&
      juriesBySession.size > 0 &&
      Array.from(juriesBySession.values()).every(
        (set) => set.size >= totalJuries
      );

    return {
      id: p.id,
      full_name: p.full_name,
      parliament_role: p.parliament_role,
      party_side: p.party_side,
      party_number: p.party_number,
      constituency_number: p.constituency_number,
      constituency_name: p.constituency_name,
      committee_number: p.committee_number,
      committee_name: p.committee_name,
      juriesScored,
      sessionsScored,
      totalJuries,
      fullyScored,
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

// ─── Submit a juror's stuck draft ON THEIR BEHALF ────────────────
//
// A juror who taps "Save draft" but never "Submit" leaves a score that counts
// NOWHERE (every total reads status='submitted' only). During a live event the
// organiser/national admin needs to recover those — find the draft, sanity-check
// the saved total, and promote it to 'submitted'. This is an ADMIN action
// (canManage), distinct from the juror self-service submitScore (cookie-gated):
// the scoring overview is national/super-admin-only, and they carry canManage.

/**
 * Promote one draft score to 'submitted'. Re-validates the saved values against
 * the session's live parameters (open write RLS on yip.scores means a stored
 * draft could be out of range) so a bad draft can never be promoted into the
 * leaderboard. Idempotent: an already-submitted/locked row returns ok with no
 * change. Internal helper — the exported actions wrap it with the auth gate.
 */
async function promoteDraftToSubmitted(
  supabase: Awaited<ReturnType<typeof createServiceClient>>,
  eventId: string,
  scoreId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { data: row } = await supabase
    .from("scores")
    .select(
      "id, event_id, status, agenda_item_id, criteria_scores, total_score, jury_assignment_id"
    )
    .eq("id", scoreId)
    .maybeSingle();

  if (!row) return { ok: false, error: "That draft no longer exists." };
  if (row.event_id !== eventId)
    return { ok: false, error: "That draft belongs to a different event." };
  // Already counting → nothing to do (treat as success so bulk submit is clean).
  if (row.status === "submitted" || row.status === "locked") return { ok: true };
  if (row.status !== "draft")
    return { ok: false, error: `Can't submit a score with status "${row.status}".` };

  // Range guard — mirrors submitScore. Protects the leaderboard from a draft
  // saved with out-of-range values (or against a since-changed session sheet).
  const cs = row.criteria_scores;
  const criteria: Record<string, number> =
    cs && typeof cs === "object" && !Array.isArray(cs)
      ? (cs as Record<string, number>)
      : {};
  const entries = Object.entries(criteria);
  const total = Number(row.total_score);
  let bad =
    !Number.isFinite(total) ||
    total < 0 ||
    entries.some(([, v]) => typeof v !== "number" || !Number.isFinite(v) || v < 0);
  if (!bad && row.agenda_item_id) {
    const params = await getSessionScoringParams(row.agenda_item_id);
    if (params && params.criteria.length > 0) {
      const maxByKey = new Map(params.criteria.map((c) => [c.key, c.max_score]));
      bad =
        total > params.total_max ||
        entries.some(([k]) => !maxByKey.has(k)) ||
        entries.some(([k, v]) => v > (maxByKey.get(k) ?? Infinity));
    }
  }
  if (bad) {
    return {
      ok: false,
      error:
        "This draft has scores outside the allowed range — the juror needs to re-open and re-score it before it can count.",
    };
  }

  const nowIso = new Date().toISOString();
  const { error: upErr } = await supabase
    .from("scores")
    .update({ status: "submitted", submitted_at: nowIso, updated_at: nowIso })
    .eq("id", scoreId)
    .eq("status", "draft"); // concurrency guard: only flip a still-draft row
  if (upErr) return { ok: false, error: upErr.message };

  // Audit trail — record WHO finalised it (organiser on behalf of the juror).
  await supabase.from("score_audit").insert({
    score_id: scoreId,
    previous_scores: criteria,
    previous_total: total,
    new_scores: criteria,
    new_total: total,
    changed_by: row.jury_assignment_id,
    reason: "Draft submitted on behalf by organiser",
  });

  return { ok: true };
}

/** Submit ONE juror's stuck draft on their behalf (admin / national only). */
export async function submitDraftOnBehalf(
  eventId: string,
  scoreId: string
): Promise<ActionResult<{ id: string }>> {
  const access = await getYipEventAccess(eventId);
  if (!access.canManage) {
    return {
      success: false,
      error: "You don't have permission to submit scores for this event.",
    };
  }
  const supabase = await createServiceClient();
  const res = await promoteDraftToSubmitted(supabase, eventId, scoreId);
  if (!res.ok) return { success: false, error: res.error };
  revalidatePath(`/yip/dashboard/events/${eventId}/scoring`);
  return { success: true, data: { id: scoreId } };
}

/**
 * Submit ALL of a juror's stuck drafts in one go. Each is validated
 * independently; out-of-range drafts are skipped (and counted) rather than
 * failing the batch, so one bad draft can't block the rest.
 */
export async function submitAllDraftsForJury(
  eventId: string,
  juryAssignmentId: string
): Promise<ActionResult<{ submitted: number; skipped: number }>> {
  const access = await getYipEventAccess(eventId);
  if (!access.canManage) {
    return {
      success: false,
      error: "You don't have permission to submit scores for this event.",
    };
  }
  const supabase = await createServiceClient();
  const { data: drafts } = await supabase
    .from("scores")
    .select("id")
    .eq("event_id", eventId)
    .eq("jury_assignment_id", juryAssignmentId)
    .eq("status", "draft");

  let submitted = 0;
  let skipped = 0;
  for (const d of drafts ?? []) {
    const res = await promoteDraftToSubmitted(supabase, eventId, d.id);
    if (res.ok) submitted++;
    else skipped++;
  }
  revalidatePath(`/yip/dashboard/events/${eventId}/scoring`);
  return { success: true, data: { submitted, skipped } };
}
