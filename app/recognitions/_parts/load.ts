import "server-only";

import {
  chapterMap,
  getLayer1,
  getPeople,
  listEvaluators,
  listPredictionsForAward,
  listScoresForAward,
  type AwardState,
} from "@/lib/recognitions/data";
import type { ChapterRow, ScoreRow } from "@/lib/recognitions/types";
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
  scores: ScoreRow[];
  matrix: MatrixView;
  predictions: PredictionsView;
  history: HistoryView;
  evaluatorNames: Record<string, string>;
}> {
  const awardId = state.award.id;
  const [chapters, scores, layer1, predictions, allDuties] = await Promise.all([
    chapterMap(),
    listScoresForAward(awardId),
    getLayer1(awardId),
    listPredictionsForAward(awardId),
    opts.withNames ? listEvaluators(awardId, true) : Promise.resolve([]),
  ]);

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
    matrix: buildMatrixView({
      cycle: state.cycle,
      nominations: state.nominations,
      scores,
      layer1,
      chapters,
      names: opts.withNames ? evaluatorNames : undefined,
    }),
    predictions: buildPredictionsView(predictions, chapters),
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
