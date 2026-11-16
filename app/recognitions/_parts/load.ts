import "server-only";

import {
  chapterMap,
  countScores,
  getPartAMeasures,
  getPeople,
  listEvaluators,
  listPredictionsForAward,
  listScoresForAward,
  type AwardState,
} from "@/lib/recognitions/data";
import type { ChapterRow, ScoreRow } from "@/lib/recognitions/types";
import type { CountedScoreRow } from "@/lib/recognitions/scoring";
import {
  buildHistoryView,
  buildMatrixView,
  buildPredictionsView,
  type HistoryView,
  type MatrixView,
  type PredictionsView,
} from "./shared";

/**
 * Everything a Stage 2 view needs, read in one go. NO permission check here:
 * call it only after the page's gate passed AND (for an NMT) only once the
 * award is at stage2 or later — it reads every evaluator's scores.
 */
export async function loadStage2(
  state: AwardState,
  opts: { withNames: boolean }
): Promise<{
  chapters: Map<string, ChapterRow>;
  /** Every score as stored (a reopened Mentor sheet is a draft). For the sheet-status ledger only. */
  scores: ScoreRow[];
  /** The marks that count (Director, 16 Nov): an earlier submitted Mentor mark stands in for a reopened draft. */
  counted: CountedScoreRow[];
  /** The award's Part A questions (Health Card measures). */
  partAMeasures: Array<{ key: string; weight: number }>;
  matrix: MatrixView;
  predictions: PredictionsView;
  history: HistoryView;
  evaluatorNames: Record<string, string>;
}> {
  const awardId = state.award.id;
  const [chapters, scores, partAMeasures, predictions, allDuties] = await Promise.all([
    chapterMap(),
    listScoresForAward(awardId),
    getPartAMeasures(awardId),
    listPredictionsForAward(awardId),
    opts.withNames ? listEvaluators(awardId, true) : Promise.resolve([]),
  ]);
  const counted = await countScores(awardId, scores);

  const versionPeople = state.versions.flatMap((v) => {
    const extra = v as typeof v & { created_by?: string | null };
    return [extra.created_by ?? null, v.submitted_by];
  });
  const people = await getPeople(
    [
      ...versionPeople,
      ...(opts.withNames ? state.decisions.map((d) => d.decided_by) : []),
      ...allDuties.map((d) => d.person_id),
    ].filter((x): x is string => !!x)
  );

  const evaluatorNames: Record<string, string> = {};
  for (const d of allDuties) {
    evaluatorNames[d.id] = people.get(d.person_id)?.full_name ?? "Unknown evaluator";
  }

  return {
    chapters,
    scores,
    counted,
    partAMeasures,
    matrix: buildMatrixView({
      cycle: state.cycle,
      nominations: state.nominations,
      scores: counted,
      partAMeasures,
      chapters,
      names: opts.withNames ? evaluatorNames : undefined,
    }),
    predictions: buildPredictionsView(predictions, chapters, state.checkedNominations),
    history: buildHistoryView({
      versions: state.versions,
      decisions: state.decisions,
      nominations: state.nominations,
      chapters,
      people,
      showDeciders: opts.withNames,
    }),
    evaluatorNames,
  };
}
