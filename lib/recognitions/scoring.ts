/**
 * Yi Recognitions scoring — pure functions, no I/O.
 *
 * Formula (30 Oct 2026 model, Piyush):
 *   total = w1 * A  +  w2 * L2  +  w3 * L3          (w1+w2+w3 = 100)
 *   A   Part A, the Health Card activity score, as a 0-1 fraction. Every RM
 *       and NMT member marks the recognition's Health Card measures 0-10.
 *       One scorer's Part A = sum(weight * mark) / (10 * sum(weight)).
 *       RM side = mean over the RMs who marked it; NMT side likewise.
 *       A = mean of the two sides (each side counts half, however many
 *       scorers it has); one side only -> that side; none -> missing.
 *       The super admin's uploaded Health Card (old Layer 1) is reference
 *       only and no longer feeds the total.
 *   L2  Part B, mean of the Regional Mentors' totals (/50), as a 0-1 fraction.
 *       layer2_mode 'raw'        -> mean/50
 *       layer2_mode 'percentile' -> percentile of the mean among the award's
 *                                   nominations in the SAME region (mail 3:
 *                                   "convert to percentile in every region").
 *   L3  Part B, mean of the NMT totals (/50), as a 0-1 fraction. Always raw:
 *       the matrix doc gives no percentile rule for Layer 3.
 * A missing part counts as 0 and is flagged on the row, never hidden.
 */

import { CHECK_STEP_ENABLED, MAX_LAYER_TOTAL, MAX_PARAM, PARAM_KEYS, PART_A_MAX, PART_A_PREFIX } from "./constants";
import type { Category, Layer } from "./constants";
import type { CycleRow, EvaluatorRow, NominationRow, ScoreParams, ScoreRow } from "./types";
import { awaitingNmtApproval, inRace, isNlAdded, stillInCheck } from "./check-rules";

const norm = (s: string | null | undefined) => (s ?? "").trim().toLowerCase();

export function paramsTotal(params: ScoreParams): number {
  return PARAM_KEYS.reduce((sum, k) => sum + (Number(params[k]) || 0), 0);
}

export function paramsComplete(params: ScoreParams): boolean {
  return PARAM_KEYS.every((k) => {
    const v = params[k];
    return typeof v === "number" && Number.isInteger(v) && v >= 0 && v <= MAX_PARAM;
  });
}

/** One Part A question: a Health Card measure of the award's table. Plain data. */
export type PartAMeasure = { key: string; weight: number };

/** The params key a Part A mark is stored under. */
export function partAKey(measureKey: string): `a_${string}` {
  return `${PART_A_PREFIX}${measureKey}` as `a_${string}`;
}

/** True for a whole-number mark in 0..max. */
export function isMark(v: unknown, max: number): v is number {
  return typeof v === "number" && Number.isInteger(v) && v >= 0 && v <= max;
}

/**
 * One scorer's Part A as a 0-1 fraction: sum(weight * mark) / (10 * sum(weight)).
 * Null unless EVERY measure carries a valid mark, or when there are no
 * measures / the weights sum to 0.
 */
export function partAFraction(params: ScoreParams, measures: PartAMeasure[]): number | null {
  if (measures.length === 0) return null;
  let sumW = 0;
  let sum = 0;
  for (const m of measures) {
    const v = params[partAKey(m.key)];
    if (!isMark(v, PART_A_MAX)) return null;
    sumW += m.weight;
    sum += m.weight * v;
  }
  return sumW > 0 ? sum / (PART_A_MAX * sumW) : null;
}

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

/** Percentile rank of `value` among `peers` (which include it). Ties share. */
export function percentileRank(value: number, peers: number[]): number {
  if (peers.length <= 1) return 1;
  const below = peers.filter((p) => p < value).length;
  const equal = peers.filter((p) => p === value).length;
  return (below + 0.5 * (equal - 1)) / (peers.length - 1);
}

export type MatrixRow = {
  nomination_id: string;
  chapter_id: string;
  category: Category;
  region: string;
  /** Part A per side (0-1): mean of the RM scorers' and of the NMT scorers' Part A. */
  partARm: number | null;
  partANmt: number | null;
  /** Part A (0-1): mean of the two sides, or the one side that has marks. */
  partA: number | null;
  rmTotals: number[];
  nmtTotals: number[];
  l2Avg: number | null;
  l2Fraction: number | null;
  l3Avg: number | null;
  l3Fraction: number | null;
  /** Each part's share of the total, in points (weights 50 / 25 / 25 sum to 100). */
  partAPoints: number;
  rmPoints: number;
  nmtPoints: number;
  total: number;
  /** Rank within the category by total. Ties share a rank (1, 1, 3). */
  rank: number;
  missing: Array<"partA" | "layer2" | "layer3">;
};

export function computeMatrix(input: {
  cycle: Pick<CycleRow, "weight_layer1" | "weight_layer2" | "weight_layer3" | "layer2_mode">;
  nominations: NominationRow[];
  scores: ScoreRow[];
  /** The award's Health Card measures (Part A questions). */
  partAMeasures: PartAMeasure[];
}): MatrixRow[] {
  const { cycle, nominations, partAMeasures } = input;
  const submitted = input.scores.filter((s) => s.status === "submitted");

  // Only nominations in the race are ranked (check-rules inRace: in 2026 every submitted one).
  const base = nominations
    .filter(inRace)
    .map((n) => {
      const mine = submitted.filter((s) => s.nomination_id === n.id);
      const rmTotals = mine.filter((s) => s.layer === "rm").map((s) => paramsTotal(s.params));
      const nmtTotals = mine.filter((s) => s.layer === "nmt").map((s) => paramsTotal(s.params));
      const partASide = (layer: Layer) =>
        mean(
          mine
            .filter((s) => s.layer === layer)
            .map((s) => partAFraction(s.params, partAMeasures))
            .filter((x): x is number => x !== null)
        );
      const partARm = partASide("rm");
      const partANmt = partASide("nmt");
      const sides = [partARm, partANmt].filter((x): x is number => x !== null);
      return {
        n,
        partARm,
        partANmt,
        partA: mean(sides),
        rmTotals,
        nmtTotals,
        l2Avg: mean(rmTotals),
        l3Avg: mean(nmtTotals),
      };
    });

  const rows: MatrixRow[] = base.map((b) => {
    let l2Fraction: number | null = null;
    if (b.l2Avg !== null) {
      if (cycle.layer2_mode === "percentile") {
        const peers = base
          .filter((p) => p.l2Avg !== null && norm(p.n.region) === norm(b.n.region))
          .map((p) => p.l2Avg as number);
        l2Fraction = percentileRank(b.l2Avg, peers);
      } else {
        l2Fraction = b.l2Avg / MAX_LAYER_TOTAL;
      }
    }
    const l3Fraction = b.l3Avg === null ? null : b.l3Avg / MAX_LAYER_TOTAL;
    const partAPoints = cycle.weight_layer1 * (b.partA ?? 0);
    const rmPoints = cycle.weight_layer2 * (l2Fraction ?? 0);
    const nmtPoints = cycle.weight_layer3 * (l3Fraction ?? 0);
    const total = partAPoints + rmPoints + nmtPoints;
    const missing: MatrixRow["missing"] = [];
    if (b.partA === null) missing.push("partA");
    if (b.l2Avg === null) missing.push("layer2");
    if (b.l3Avg === null) missing.push("layer3");
    return {
      nomination_id: b.n.id,
      chapter_id: b.n.chapter_id,
      category: b.n.category,
      region: b.n.region,
      partARm: b.partARm,
      partANmt: b.partANmt,
      partA: b.partA,
      rmTotals: b.rmTotals,
      nmtTotals: b.nmtTotals,
      l2Avg: b.l2Avg,
      l2Fraction,
      l3Avg: b.l3Avg,
      l3Fraction,
      partAPoints: Math.round(partAPoints * 100) / 100,
      rmPoints: Math.round(rmPoints * 100) / 100,
      nmtPoints: Math.round(nmtPoints * 100) / 100,
      total: Math.round(total * 100) / 100,
      rank: 0,
      missing,
    };
  });

  for (const row of rows) {
    row.rank = 1 + rows.filter((r) => r.category === row.category && r.total > row.total).length;
  }
  return rows.sort((a, b) => (a.category === b.category ? a.rank - b.rank : a.category.localeCompare(b.category)));
}

// ---------------------------------------------------------------------------
// Visibility + Stage 2 completeness
// ---------------------------------------------------------------------------

/**
 * Can this evaluator duty see (and therefore score) this nomination?
 *   - only nominations in the race (check-rules inRace; 2026: every submitted one)
 *   - never a chapter they are linked to (conflict rule, mail 3)
 *   - an RM only sees their own region; a blank region denies
 */
export function dutySeesNomination(
  duty: Pick<EvaluatorRow, "layer" | "region">,
  nomination: Pick<NominationRow, "status" | "region" | "chapter_id">,
  conflicts: Set<string>
): boolean {
  if (!inRace(nomination)) return false;
  if (conflicts.has(nomination.chapter_id)) return false;
  if (duty.layer === "nmt") return true;
  return norm(duty.region) !== "" && norm(duty.region) === norm(nomination.region);
}

export type DutyProgress = {
  evaluatorId: string;
  layer: Layer;
  required: number;
  submitted: number;
};

export type Completeness = {
  perDuty: DutyProgress[];
  rm: { required: number; submitted: number };
  nmt: { required: number; submitted: number };
  /** Plain-English reasons Stage 2 cannot open yet beyond missing scores. */
  blockers: string[];
  complete: boolean;
};

/**
 * Mail 1, Phase 3: Stage 2 unlocks only at 100% RM AND 100% NMT submission.
 * The denominator is every (active duty x nomination it may see). Conflicted
 * pairs are excluded, otherwise a conflicted evaluator would hold Stage 2
 * shut for ever. A nomination that NO RM (or no NMT) can see is a blocker:
 * it would otherwise reach "100%" with a layer nobody scored.
 *
 * Same shape for the check step (recognitions_02): the denominator holds ONLY
 * nominations both checkers passed. A nomination that was sent back and not
 * fixed in time, or never checked before checks closed, is out of the race
 * and never counts — otherwise it would hold Stage 2 shut for ever. One that
 * is STILL being checked or fixed is a blocker, so Stage 2 can't open early
 * while it may yet enter the race.
 */
export function computeCompleteness(input: {
  cycle: Pick<CycleRow, "fix_deadline" | "check_deadline" | "reevaluation_deadline"> &
    Partial<Pick<CycleRow, "stage1_deadline">>;
  nominations: NominationRow[];
  duties: EvaluatorRow[];
  conflictsByDuty: Map<string, Set<string>>;
  scores: ScoreRow[];
  now?: Date;
}): Completeness {
  const nominations = input.nominations.filter(inRace);
  const moving = input.nominations.filter((n) => stillInCheck(n, input.cycle, input.now));
  // recognitions_05: a Regional Mentor's added chapter waiting for an NMT approval.
  const awaitingApproval = moving.filter(awaitingNmtApproval);
  const inCheck = moving.filter((n) => !awaitingNmtApproval(n));
  const duties = input.duties.filter((d) => d.is_active);
  const submittedKey = new Set(
    input.scores.filter((s) => s.status === "submitted").map((s) => `${s.evaluator_id}:${s.nomination_id}`)
  );

  const perDuty: DutyProgress[] = duties.map((d) => {
    const conflicts = input.conflictsByDuty.get(d.id) ?? new Set<string>();
    const visible = nominations.filter((n) => dutySeesNomination(d, n, conflicts));
    return {
      evaluatorId: d.id,
      layer: d.layer,
      required: visible.length,
      submitted: visible.filter((n) => submittedKey.has(`${d.id}:${n.id}`)).length,
    };
  });

  const blockers: string[] = [];
  if (inCheck.length > 0) {
    blockers.push(
      CHECK_STEP_ENABLED
        ? `${inCheck.length} nomination(s) are still being checked or fixed. They count once both checkers pass them, or drop out when the fix or check deadline passes.`
        : `${inCheck.length} nomination(s) were sent back and are still being fixed. They count once resubmitted, or drop out when the fix deadline passes.`
    );
  }
  if (nominations.length === 0) {
    blockers.push(
      CHECK_STEP_ENABLED
        ? "No nomination for this recognition has passed both checks yet."
        : "No chapter has submitted a nomination for this recognition."
    );
  }
  if (awaitingApproval.length > 0) {
    blockers.push(
      `${awaitingApproval.length} chapter(s) a Regional Mentor added are waiting for an NMT member to approve or decline them.`
    );
  }
  for (const layer of ["rm", "nmt"] as const) {
    const orphaned = nominations.filter(
      (n) =>
        !duties.some(
          (d) => d.layer === layer && dutySeesNomination(d, n, input.conflictsByDuty.get(d.id) ?? new Set())
        )
    );
    if (orphaned.length > 0) {
      const regions = [...new Set(orphaned.map((n) => n.region))].sort().join(", ");
      blockers.push(
        layer === "rm"
          ? `${orphaned.length} nomination(s) have no Regional Mentor who can score them (region ${regions}).`
          : `${orphaned.length} nomination(s) have no NMT evaluator who can score them.`
      );
    }
  }

  const sum = (layer: Layer) =>
    perDuty
      .filter((p) => p.layer === layer)
      .reduce(
        (acc, p) => ({ required: acc.required + p.required, submitted: acc.submitted + p.submitted }),
        { required: 0, submitted: 0 }
      );
  const rm = sum("rm");
  const nmt = sum("nmt");

  return {
    perDuty,
    rm,
    nmt,
    blockers,
    complete:
      blockers.length === 0 &&
      perDuty.every((p) => p.submitted >= p.required),
  };
}

/**
 * Re-evaluation with chapters National Leadership ADDED (recognitions_03).
 * The NMT leader may not submit a re-evaluated ranking while an added
 * nomination is still moving through the check, or has passed both checks
 * but is not yet fully scored: the re-evaluation exists to consider it.
 * Once it is out of the race (sent back and not resubmitted, or not checked,
 * before re-evaluation closes) it never blocks.
 *
 * The denominator is the same as Stage 2 completeness: every active duty
 * that may see the nomination (dutySeesNomination, conflicts excluded). An
 * added nomination nobody can score (no RM for its region, or no NMT) is a
 * blocker sentence, never a silent block.
 */
export function nlAddedBlockers(input: {
  cycle: Pick<CycleRow, "fix_deadline" | "check_deadline" | "reevaluation_deadline">;
  nominations: NominationRow[];
  duties: EvaluatorRow[];
  conflictsByDuty: Map<string, Set<string>>;
  scores: ScoreRow[];
  /** Chapter name for the sentences. */
  nameOf: (n: NominationRow) => string;
  now?: Date;
}): string[] {
  const added = input.nominations.filter(isNlAdded);
  const duties = input.duties.filter((d) => d.is_active);
  const submitted = new Set(
    input.scores.filter((s) => s.status === "submitted").map((s) => `${s.evaluator_id}:${s.nomination_id}`)
  );
  const out: string[] = [];
  for (const n of added) {
    const who = `${input.nameOf(n)} (added by National Leadership)`;
    if (stillInCheck(n, input.cycle, input.now)) {
      out.push(
        n.status === "returned"
          ? `${who} was sent back to National Leadership and hasn't been resubmitted yet.`
          : `${who} is still waiting for the Regional Chair and Regional Mentor checks.`
      );
      continue;
    }
    if (!inRace(n)) continue; // out of the race: never blocks
    const seeing = duties.filter((d) => dutySeesNomination(d, n, input.conflictsByDuty.get(d.id) ?? new Set()));
    for (const layer of ["rm", "nmt"] as const) {
      if (!seeing.some((d) => d.layer === layer)) {
        out.push(
          `${who} has no ${layer === "rm" ? `Regional Mentor for region ${n.region}` : "NMT evaluator"} who can score it. Ask the Recognitions super admin to assign one.`
        );
      }
    }
    const missing = seeing.filter((d) => !submitted.has(`${d.id}:${n.id}`)).length;
    if (missing > 0) {
      out.push(`${who} still needs ${missing} evaluator mark${missing === 1 ? "" : "s"}.`);
    }
  }
  return out;
}
