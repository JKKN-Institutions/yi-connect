/**
 * Yi Recognitions scoring — pure functions, no I/O.
 *
 * Formula (Latest Evaluation Matrix doc):
 *   total = w1 * L1/100  +  w2 * L2  +  w3 * L3          (w1+w2+w3 = 100)
 *   L1  Health Card score, 0-100, uploaded from Yi National's Excel.
 *   L2  mean of the Regional Mentors' totals (/25), as a 0-1 fraction.
 *       layer2_mode 'raw'        -> mean/25
 *       layer2_mode 'percentile' -> percentile of the mean among the award's
 *                                   nominations in the SAME region (mail 3:
 *                                   "convert to percentile in every region").
 *   L3  mean of the NMT totals (/25), as a 0-1 fraction. Always raw: the
 *       matrix doc gives no percentile rule for Layer 3.
 * A missing layer counts as 0 and is flagged on the row, never hidden.
 */

import { MAX_LAYER_TOTAL, PARAM_KEYS } from "./constants";
import type { Category, Layer } from "./constants";
import type { CycleRow, EvaluatorRow, NominationRow, ScoreParams, ScoreRow } from "./types";

const norm = (s: string | null | undefined) => (s ?? "").trim().toLowerCase();

export function paramsTotal(params: ScoreParams): number {
  return PARAM_KEYS.reduce((sum, k) => sum + (Number(params[k]) || 0), 0);
}

export function paramsComplete(params: ScoreParams): boolean {
  return PARAM_KEYS.every((k) => {
    const v = params[k];
    return typeof v === "number" && Number.isInteger(v) && v >= 0 && v <= 5;
  });
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
  l1: number | null;
  rmTotals: number[];
  nmtTotals: number[];
  l2Avg: number | null;
  l2Fraction: number | null;
  l3Avg: number | null;
  l3Fraction: number | null;
  total: number;
  /** Rank within the category by total. Ties share a rank (1, 1, 3). */
  rank: number;
  missing: Array<"layer1" | "layer2" | "layer3">;
};

export function computeMatrix(input: {
  cycle: Pick<CycleRow, "weight_layer1" | "weight_layer2" | "weight_layer3" | "layer2_mode">;
  nominations: NominationRow[];
  scores: ScoreRow[];
  layer1: Map<string, number>;
}): MatrixRow[] {
  const { cycle, nominations, layer1 } = input;
  const submitted = input.scores.filter((s) => s.status === "submitted");

  const base = nominations
    .filter((n) => n.status === "submitted")
    .map((n) => {
      const mine = submitted.filter((s) => s.nomination_id === n.id);
      const rmTotals = mine.filter((s) => s.layer === "rm").map((s) => paramsTotal(s.params));
      const nmtTotals = mine.filter((s) => s.layer === "nmt").map((s) => paramsTotal(s.params));
      return {
        n,
        l1: layer1.has(n.chapter_id) ? layer1.get(n.chapter_id)! : null,
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
    const total =
      (cycle.weight_layer1 * (b.l1 ?? 0)) / 100 +
      cycle.weight_layer2 * (l2Fraction ?? 0) +
      cycle.weight_layer3 * (l3Fraction ?? 0);
    const missing: MatrixRow["missing"] = [];
    if (b.l1 === null) missing.push("layer1");
    if (b.l2Avg === null) missing.push("layer2");
    if (b.l3Avg === null) missing.push("layer3");
    return {
      nomination_id: b.n.id,
      chapter_id: b.n.chapter_id,
      category: b.n.category,
      region: b.n.region,
      l1: b.l1,
      rmTotals: b.rmTotals,
      nmtTotals: b.nmtTotals,
      l2Avg: b.l2Avg,
      l2Fraction,
      l3Avg: b.l3Avg,
      l3Fraction,
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
 *   - only submitted nominations
 *   - never a chapter they are linked to (conflict rule, mail 3)
 *   - an RM only sees their own region; a blank region denies
 */
export function dutySeesNomination(
  duty: Pick<EvaluatorRow, "layer" | "region">,
  nomination: Pick<NominationRow, "status" | "region" | "chapter_id">,
  conflicts: Set<string>
): boolean {
  if (nomination.status !== "submitted") return false;
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
 */
export function computeCompleteness(input: {
  nominations: NominationRow[];
  duties: EvaluatorRow[];
  conflictsByDuty: Map<string, Set<string>>;
  scores: ScoreRow[];
}): Completeness {
  const nominations = input.nominations.filter((n) => n.status === "submitted");
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
  if (nominations.length === 0) blockers.push("No chapter has submitted a nomination for this award.");
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
