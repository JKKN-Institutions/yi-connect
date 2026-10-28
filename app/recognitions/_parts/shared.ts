/**
 * Stage 2 / governance shared shapes and pure builders. No I/O, no
 * server-only imports: the builders run on the server, the types and the
 * validator are safe to import anywhere. Every view type is plain data
 * (arrays and records) so any lane can pass it straight into a component.
 */

import { CATEGORIES, CATEGORY_LABEL, RANK_LABEL, WORDS } from "@/lib/recognitions/constants";
import type { Category, Layer } from "@/lib/recognitions/constants";
import type {
  ChapterRow,
  CycleRow,
  DecisionRow,
  ModerationVersionRow,
  NominationRow,
  PredictionRow,
  RankingEntry,
  ScoreRow,
  Top3Entry,
} from "@/lib/recognitions/types";
import { computeMatrix, paramsTotal } from "@/lib/recognitions/scoring";
import { countWords } from "@/lib/recognitions/words";
import { ADDED_BY_LABEL, isAddedForChapter } from "@/lib/recognitions/check-rules";

// ---------------------------------------------------------------------------
// Combined matrix
// ---------------------------------------------------------------------------

export type EvalColumn = { evaluatorId: string; layer: Layer; label: string };

export type DossierView = {
  /** recognitions_04: the chapter's "why". Empty on a nomination filed on the old form. */
  justification: string;
  reasons: string[];
  flagship: string;
  hostedEvent: boolean;
  hostedName: string | null;
  hostedType: string | null;
  announcement: string;
  /**
   * The reason when someone else added a chapter that did not nominate:
   * National Leadership (recognitions_03), a Regional Mentor or the NMT
   * (recognitions_05). Null for a chapter's own nomination.
   */
  nlAddedReason: string | null;
  /** Who added it ("National Leadership", "a Regional Mentor", "an NMT member"), or null. */
  addedByLabel: string | null;
};

export type RationaleView = {
  label: string;
  layer: Layer;
  total: number;
  reasons: string[];
  comments: string | null;
};

export type MatrixViewRow = {
  nominationId: string;
  chapterName: string;
  region: string;
  l1: number | null;
  /** evaluatorId -> that evaluator's submitted total (/25). */
  perEvaluator: Record<string, number>;
  rmAvg: number | null;
  nmtAvg: number | null;
  total: number;
  rank: number;
  missing: string[];
  dossier: DossierView;
  rationales: RationaleView[];
};

export type MatrixCategoryView = {
  category: Category;
  label: string;
  rmColumns: EvalColumn[];
  nmtColumns: EvalColumn[];
  rows: MatrixViewRow[];
};

export type MatrixView = {
  weights: { l1: number; l2: number; l3: number };
  layer2Mode: "raw" | "percentile";
  categories: MatrixCategoryView[];
};

const MISSING_LABEL: Record<"layer1" | "layer2" | "layer3", string> = {
  layer1: "Health Card",
  layer2: "RM scores",
  layer3: "NMT scores",
};

export function chapterName(chapters: Map<string, ChapterRow>, id: string): string {
  return chapters.get(id)?.name ?? "Unknown chapter";
}

export function dossierOf(n: NominationRow): DossierView {
  return {
    justification: n.justification ?? "",
    reasons: (n.reasons ?? []).filter((r) => (r ?? "").trim() !== ""),
    flagship: n.flagship_event ?? "",
    hostedEvent: n.hosted_event,
    hostedName: n.hosted_event_name,
    hostedType: n.hosted_event_type,
    announcement: n.announcement_draft ?? "",
    nlAddedReason: isAddedForChapter(n) ? n.added_reason ?? "" : null,
    addedByLabel: n.origin && n.origin !== "chapter" ? ADDED_BY_LABEL[n.origin] : null,
  };
}

/**
 * Builds the "clubbed" matrix: every submitted score, per-evaluator columns,
 * layer averages, weighted total and provisional rank. Evaluators are
 * anonymised as "RM 1", "NMT 2"… numbered by a stable sort of their duty id,
 * so the same person keeps the same number in every row. Pass `names`
 * (evaluatorId -> name) only for oversight views.
 */
export function buildMatrixView(input: {
  cycle: Pick<CycleRow, "weight_layer1" | "weight_layer2" | "weight_layer3" | "layer2_mode">;
  nominations: NominationRow[];
  scores: ScoreRow[];
  layer1: Map<string, number>;
  chapters: Map<string, ChapterRow>;
  names?: Record<string, string>;
}): MatrixView {
  const { cycle, nominations, chapters, names } = input;
  const submitted = input.scores.filter((s) => s.status === "submitted");
  const matrix = computeMatrix({ cycle, nominations, scores: submitted, layer1: input.layer1 });
  const nomById = new Map(nominations.map((n) => [n.id, n]));

  const labels = new Map<string, EvalColumn>();
  for (const layer of ["rm", "nmt"] as const) {
    const ids = [...new Set(submitted.filter((s) => s.layer === layer).map((s) => s.evaluator_id))].sort();
    ids.forEach((id, i) => {
      labels.set(id, {
        evaluatorId: id,
        layer,
        label: names?.[id] ?? `${layer === "rm" ? "RM" : "NMT"} ${i + 1}`,
      });
    });
  }
  const order = (id: string) => [...labels.keys()].indexOf(id);

  const categories: MatrixCategoryView[] = CATEGORIES.map((category) => {
    const rows = matrix.filter((r) => r.category === category);
    const used = new Set(
      submitted.filter((s) => rows.some((r) => r.nomination_id === s.nomination_id)).map((s) => s.evaluator_id)
    );
    const cols = [...labels.values()].filter((c) => used.has(c.evaluatorId));
    return {
      category,
      label: CATEGORY_LABEL[category],
      rmColumns: cols.filter((c) => c.layer === "rm"),
      nmtColumns: cols.filter((c) => c.layer === "nmt"),
      rows: rows.map((r) => {
        const mine = submitted
          .filter((s) => s.nomination_id === r.nomination_id)
          .sort((a, b) => order(a.evaluator_id) - order(b.evaluator_id));
        const perEvaluator: Record<string, number> = {};
        for (const s of mine) perEvaluator[s.evaluator_id] = paramsTotal(s.params);
        const n = nomById.get(r.nomination_id)!;
        return {
          nominationId: r.nomination_id,
          chapterName: chapterName(chapters, r.chapter_id),
          region: r.region,
          l1: r.l1,
          perEvaluator,
          rmAvg: r.l2Avg,
          nmtAvg: r.l3Avg,
          total: r.total,
          rank: r.rank,
          missing: r.missing.map((m) => MISSING_LABEL[m]),
          dossier: dossierOf(n),
          rationales: mine.map((s) => ({
            label: labels.get(s.evaluator_id)?.label ?? (s.layer === "rm" ? "RM" : "NMT"),
            layer: s.layer,
            total: paramsTotal(s.params),
            reasons: (s.reasons ?? []).filter((x) => (x ?? "").trim() !== ""),
            comments: s.layer === "nmt" && (s.additional_comments ?? "").trim() !== "" ? s.additional_comments : null,
          })),
        };
      }),
    };
  });

  return {
    weights: { l1: cycle.weight_layer1, l2: cycle.weight_layer2, l3: cycle.weight_layer3 },
    layer2Mode: cycle.layer2_mode,
    categories,
  };
}

export type Provisional = {
  score: number;
  /** A UNIQUE starting rank for the form (ties ordered by chapter name); the final rank may not tie. */
  rank: number;
  /** The combined matrix's rank: tied chapters share it (1, 1, 3). This is the "before Stage 2" rank. */
  matrixRank: number;
  /** How many chapters of the category share matrixRank (1 = no tie). */
  tieSize: number;
};

/**
 * Prefill for the moderation form: the computed total, a unique starting
 * rank, and the matrix rank with its tie size.
 */
export function prefillFromMatrix(view: MatrixView): Record<string, Provisional> {
  const out: Record<string, Provisional> = {};
  for (const cat of view.categories) {
    const sorted = [...cat.rows].sort((a, b) => a.rank - b.rank || a.chapterName.localeCompare(b.chapterName));
    sorted.forEach((r, i) => {
      out[r.nominationId] = {
        score: r.total,
        rank: i + 1,
        matrixRank: r.rank,
        tieSize: cat.rows.filter((x) => x.rank === r.rank).length,
      };
    });
  }
  return out;
}

/**
 * Did the final rank move from the matrix rank? Chapters tied in the matrix
 * may take any place in their tie band [matrixRank, matrixRank + tieSize - 1]
 * without counting as a move, so ordering a tie needs no reason.
 */
export function rankMoved(finalRank: number, matrixRank: number, tieSize: number): boolean {
  return finalRank < matrixRank || finalRank > matrixRank + Math.max(1, tieSize) - 1;
}

/** "3", or "=1" when the chapter is tied in the matrix. */
export function matrixRankLabel(matrixRank: number, tieSize: number): string {
  return tieSize > 1 ? `=${matrixRank}` : String(matrixRank);
}

// ---------------------------------------------------------------------------
// Chapter sentiment & predictions
// ---------------------------------------------------------------------------

export type PredictionsView = Array<{
  category: Category;
  label: string;
  voters: number;
  entries: Array<{ chapterName: string; votes: number }>;
  /** Picks for a chapter that is not in this race (did not pass both checks). Not counted in entries. */
  offRace: number;
}>;

/**
 * Tally of the quiz picks. Only picks for a chapter whose nomination for this
 * award passed both checks count (recognitions_02); picks for anyone else are
 * reported as `offRace`, not hidden. `racing` = the award's checked nominations.
 */
export function buildPredictionsView(
  predictions: PredictionRow[],
  chapters: Map<string, ChapterRow>,
  racing: Array<Pick<NominationRow, "chapter_id" | "category">>
): PredictionsView {
  return CATEGORIES.map((category) => {
    const mine = predictions.filter((p) => p.category === category);
    const inRace = new Set(racing.filter((n) => n.category === category).map((n) => n.chapter_id));
    const counts = new Map<string, number>();
    let offRace = 0;
    for (const p of mine) {
      if (!inRace.has(p.predicted_chapter_id)) {
        offRace++;
        continue;
      }
      counts.set(p.predicted_chapter_id, (counts.get(p.predicted_chapter_id) ?? 0) + 1);
    }
    const entries = [...counts.entries()]
      .map(([id, votes]) => ({ chapterName: chapterName(chapters, id), votes }))
      .sort((a, b) => b.votes - a.votes || a.chapterName.localeCompare(b.chapterName));
    return { category, label: CATEGORY_LABEL[category], voters: mine.length, entries, offRace };
  });
}

// ---------------------------------------------------------------------------
// Final ranking (one moderation version) + version history
// ---------------------------------------------------------------------------

export type RankingView = Array<{
  category: Category;
  label: string;
  entries: Array<{
    nominationId: string;
    chapterName: string;
    region: string;
    finalScore: number | null;
    finalRank: number | null;
    /** Rank before Stage 2 (the combined matrix; ties share it), or null when unknown. */
    computedRank: number | null;
    /** How many chapters in this ranking share computedRank (1 = no tie). */
    computedTie: number;
    /** The NMT's reason for the final rank; empty when none was written. */
    reason: string;
  }>;
  podium: Array<{ rank: 1 | 2 | 3; placeLabel: string; chapterName: string; rationale: string; citation: string }>;
}>;

export function buildRankingView(
  version: Pick<ModerationVersionRow, "rankings" | "top3">,
  nominations: NominationRow[],
  chapters: Map<string, ChapterRow>,
  citationFor?: (category: Category, rank: number, fallback: string) => string,
  /** Provisional ranks from today's matrix, for versions saved before the rank was stored. */
  provisional?: Record<string, { matrixRank: number }>
): RankingView {
  const nomById = new Map(nominations.map((n) => [n.id, n]));
  const rankings = Array.isArray(version.rankings) ? version.rankings : [];
  const top3 = Array.isArray(version.top3) ? version.top3 : [];
  return CATEGORIES.map((category) => {
    const entries = rankings
      .map((r) => ({ r, n: nomById.get(r.nomination_id) }))
      .filter((x) => x.n && x.n.category === category)
      .map(({ r, n }) => ({
        nominationId: r.nomination_id,
        chapterName: chapterName(chapters, n!.chapter_id),
        region: n!.region,
        finalScore: r.final_score,
        finalRank: r.final_rank,
        computedRank: r.computed_rank ?? provisional?.[r.nomination_id]?.matrixRank ?? null,
        computedTie: 1,
        reason: (r.reason ?? "").trim(),
      }))
      .sort((a, b) => (a.finalRank ?? 999) - (b.finalRank ?? 999) || a.chapterName.localeCompare(b.chapterName));
    for (const e of entries) {
      if (e.computedRank !== null) e.computedTie = entries.filter((x) => x.computedRank === e.computedRank).length;
    }
    const podium = top3
      .filter((t) => t.category === category)
      .sort((a, b) => a.rank - b.rank)
      .map((t) => {
        const n = nomById.get(t.nomination_id);
        return {
          rank: t.rank,
          placeLabel: RANK_LABEL[t.rank],
          chapterName: n ? chapterName(chapters, n.chapter_id) : "Unknown chapter",
          rationale: t.rationale,
          citation: citationFor ? citationFor(category, t.rank, t.citation) : t.citation,
        };
      });
    return { category, label: CATEGORY_LABEL[category], entries, podium };
  }).filter((c) => c.entries.length > 0 || c.podium.length > 0);
}

export type HistoryView = Array<{
  id: string;
  version: number;
  status: "draft" | "submitted";
  createdAt: string;
  createdBy: string | null;
  submittedAt: string | null;
  submittedBy: string | null;
  respondsTo: { reason: string | null; decidedAt: string } | null;
  decisions: Array<{ decision: "approve" | "reevaluate"; reason: string | null; decidedAt: string; decidedBy: string | null }>;
  ranking: RankingView;
}>;

export function buildHistoryView(input: {
  versions: Array<ModerationVersionRow & { created_by?: string | null }>;
  decisions: DecisionRow[];
  nominations: NominationRow[];
  chapters: Map<string, ChapterRow>;
  people: Map<string, { full_name: string }>;
  /** Show who in National Leadership decided. */
  showDeciders: boolean;
}): HistoryView {
  const { decisions, people } = input;
  const nameOf = (id: string | null | undefined) => (id ? people.get(id)?.full_name ?? "Unknown person" : null);
  return [...input.versions]
    .sort((a, b) => b.version - a.version)
    .map((v) => {
      const responds = v.responds_to_decision_id
        ? decisions.find((d) => d.id === v.responds_to_decision_id) ?? null
        : null;
      return {
        id: v.id,
        version: v.version,
        status: v.status,
        createdAt: v.created_at,
        createdBy: nameOf(v.created_by ?? null),
        submittedAt: v.submitted_at,
        submittedBy: nameOf(v.submitted_by),
        respondsTo: responds ? { reason: responds.reason, decidedAt: responds.decided_at } : null,
        decisions: decisions
          .filter((d) => d.moderation_version_id === v.id)
          .sort((a, b) => Date.parse(b.decided_at) - Date.parse(a.decided_at))
          .map((d) => ({
            decision: d.decision,
            reason: d.reason,
            decidedAt: d.decided_at,
            decidedBy: input.showDeciders ? nameOf(d.decided_by) : null,
          })),
        ranking: buildRankingView(v, input.nominations, input.chapters),
      };
    });
}

// ---------------------------------------------------------------------------
// Moderation input + server-side validation
// ---------------------------------------------------------------------------

export type ModerationInput = {
  /**
   * final_score is ignored since 28 Oct (Piyush: the NMT does not re-score);
   * the server takes the combined matrix's weighted total. `reason` is the
   * NMT's justification for the chapter's rank.
   */
  rankings: Array<{ nomination_id: string; final_score: number | null; final_rank: number | null; reason?: string }>;
  /** Podium texts keyed by nomination. Which place they land on is derived from final ranks. */
  texts: Array<{ nomination_id: string; rationale: string; citation: string }>;
};

/** Hard character caps so one giant "word" can't slip past the word count. */
const MAX_RATIONALE_CHARS = 4000;
const MAX_CITATION_CHARS = 3500;
const MAX_RANK_REASON_CHARS = 1500;

export type ValidatedModeration =
  | { ok: true; rankings: RankingEntry[]; top3: Top3Entry[] }
  | { ok: false; error: string };

/**
 * strict=false (Save draft): numbers that are filled in must be valid and
 * texts must fit their limits, but blanks are allowed.
 * strict=true (Submit): every nomination needs a unique rank covering 1..n in
 * its category, a reason wherever the rank moves out of its matrix rank's tie band,
 * and every podium place needs both texts.
 *
 * `provisional` is the combined matrix (prefillFromMatrix): the final score is
 * always its weighted total (Piyush, 28 Oct 2026: the NMT re-ranks, it does
 * not re-score), and its matrix rank (ties shared) is stored as the "before Stage 2" rank.
 */
export function validateModeration(
  input: ModerationInput,
  submittedNominations: NominationRow[],
  chapters: Map<string, ChapterRow>,
  strict: boolean,
  provisional: Record<string, Provisional>
): ValidatedModeration {
  if (!input || !Array.isArray(input.rankings) || !Array.isArray(input.texts)) {
    return { ok: false, error: "The ranking form arrived empty. Reload the page and try again." };
  }
  const byId = new Map(submittedNominations.map((n) => [n.id, n]));
  const nameOf = (n: NominationRow) => chapterName(chapters, n.chapter_id);
  const perCategory = new Map<Category, number>();
  for (const n of submittedNominations) perCategory.set(n.category, (perCategory.get(n.category) ?? 0) + 1);

  const given = new Map<string, { final_rank: number | null; reason: string }>();
  for (const r of input.rankings) {
    if (!r || typeof r.nomination_id !== "string" || !byId.has(r.nomination_id) || given.has(r.nomination_id)) {
      return {
        ok: false,
        error: "One of the rows is not a submitted nomination for this recognition. Reload the page and try again.",
      };
    }
    given.set(r.nomination_id, { final_rank: r.final_rank, reason: String(r.reason ?? "").trim() });
  }

  const rankings: RankingEntry[] = [];
  for (const n of submittedNominations) {
    const g = given.get(n.id) ?? { final_rank: null, reason: "" };
    const prov = provisional[n.id] ?? null;
    const score = prov ? Math.round(prov.score * 100) / 100 : null;
    let rank: number | null = null;
    if (g.final_rank !== null && g.final_rank !== undefined && String(g.final_rank) !== "") {
      const k = Number(g.final_rank);
      const max = perCategory.get(n.category) ?? 0;
      if (!Number.isInteger(k) || k < 1 || k > max) {
        return {
          ok: false,
          error: `Final rank for ${nameOf(n)} must be a whole number from 1 to ${max} (${CATEGORY_LABEL[n.category]} has ${max} nomination${max === 1 ? "" : "s"}).`,
        };
      }
      rank = k;
    }
    const words = countWords(g.reason);
    if (words > WORDS.rankReason || g.reason.length > MAX_RANK_REASON_CHARS) {
      return {
        ok: false,
        error: `The reason for ${nameOf(n)}'s rank is ${words} words. Cut it to ${WORDS.rankReason} or fewer.`,
      };
    }
    if (strict && score === null) {
      return { ok: false, error: `${nameOf(n)} has no combined total yet, so it can't be ranked. Reload the page.` };
    }
    if (strict && rank === null) return { ok: false, error: `Enter a final rank for ${nameOf(n)}.` };
    if (strict && prov && rank !== null && rankMoved(rank, prov.matrixRank, prov.tieSize) && g.reason === "") {
      const from = prov.tieSize > 1 ? `tied rank ${prov.matrixRank}` : `rank ${prov.matrixRank}`;
      return {
        ok: false,
        error: `${nameOf(n)} moves from ${from} to ${rank}. Write the reason for the change.`,
      };
    }
    const entry: RankingEntry = {
      nomination_id: n.id,
      final_score: score,
      final_rank: rank,
      computed_rank: prov?.matrixRank ?? null,
    };
    if (g.reason !== "") entry.reason = g.reason;
    rankings.push(entry);
  }

  if (strict) {
    for (const category of CATEGORIES) {
      const ranks = rankings
        .filter((r) => byId.get(r.nomination_id)!.category === category)
        .map((r) => r.final_rank as number);
      const dup = ranks.find((k, i) => ranks.indexOf(k) !== i);
      if (dup !== undefined) {
        return {
          ok: false,
          error: `Two ${CATEGORY_LABEL[category]} chapters share final rank ${dup}. Each rank can be used once.`,
        };
      }
    }
  }

  const textBy = new Map<string, { rationale: string; citation: string }>();
  for (const t of input.texts) {
    if (!t || typeof t.nomination_id !== "string" || !byId.has(t.nomination_id)) continue;
    textBy.set(t.nomination_id, {
      rationale: String(t.rationale ?? "").trim(),
      citation: String(t.citation ?? "").trim(),
    });
  }

  // The podium is derived HERE from final ranks 1..3; only the texts come from the browser.
  const top3: Top3Entry[] = [];
  for (const category of CATEGORIES) {
    const n = perCategory.get(category) ?? 0;
    for (let place = 1; place <= Math.min(3, n); place++) {
      const holders = rankings.filter(
        (r) => r.final_rank === place && byId.get(r.nomination_id)!.category === category
      );
      if (holders.length !== 1) continue; // draft with a blank or shared rank: no podium card yet
      const rank = place as 1 | 2 | 3;
      const label = RANK_LABEL[rank];
      const where = `${CATEGORY_LABEL[category]} ${label.toLowerCase()} (${nameOf(byId.get(holders[0].nomination_id)!)})`;
      const t = textBy.get(holders[0].nomination_id) ?? { rationale: "", citation: "" };
      const rw = countWords(t.rationale);
      const cw = countWords(t.citation);
      if (strict && rw === 0) return { ok: false, error: `Write "Why this finalist?" for the ${where}.` };
      if (strict && cw === 0) return { ok: false, error: `Write the citation for the ${where}.` };
      if (rw > WORDS.top3Rationale || t.rationale.length > MAX_RATIONALE_CHARS) {
        return {
          ok: false,
          error: `"Why this finalist?" for the ${where} is ${rw} words. Cut it to ${WORDS.top3Rationale} or fewer.`,
        };
      }
      if (cw > WORDS.top3Citation || t.citation.length > MAX_CITATION_CHARS) {
        return {
          ok: false,
          error: `The citation for the ${where} is ${cw} words. Cut it to ${WORDS.top3Citation} or fewer.`,
        };
      }
      top3.push({ category, rank, nomination_id: holders[0].nomination_id, rationale: t.rationale, citation: t.citation });
    }
  }

  return { ok: true, rankings, top3 };
}
