/**
 * YIQ Level 2 — the National ladder: Quarter-Finals, Semi-Finals, Final.
 * Pure functions, no I/O, so the rules that decide a national champion are
 * readable and testable on their own. The server actions in
 * app/yiq/actions/national.ts do the reading and writing.
 *
 * MODEL (from the source deck; Level 1 already ships)
 *   Level 1 crowns ONE champion team per category per chapter and writes a
 *   row into yiq.national_entries. Level 2 narrows that field.
 *
 *   THE LADDER IS DERIVED, NEVER HARDCODED. How many national stages run
 *   depends on how many chapter champions actually entered. With 65 chapters
 *   a category can field ~65 teams and needs all three stages; a handful of
 *   teams goes straight to the Final. nationalLadder() is the single source
 *   of truth for stage depth and for how many teams come out of each stage —
 *   the actions and the console both read it, neither assumes it.
 *
 *   Status ladder. `<stage>_qualified` means CAME THROUGH that stage:
 *
 *     entered
 *       -> quarterfinal_qualified   survived the National Quarter-Final
 *       -> semifinal_qualified      survived the National Semi-Final
 *       -> finalist                 stood in the National Final
 *       -> runner_up / national_champion
 *       -> eliminated               fell at a narrowing stage
 *
 *   Junior (Classes 9-10) and Senior (Classes 11-12) are SEPARATE
 *   championships. Every function here takes a category and filters to it
 *   internally rather than trusting the caller, so a junior row can never
 *   reach a senior ranking even if a query is written wrongly upstream.
 *
 * TIES. This mirrors rankTeams() in ./scoring.ts: a team level with the last
 * qualifier is carried THROUGH the cut, never silently dropped to hit a round
 * number, so a stage's qualifying set may legitimately be larger than the
 * ladder asked for. `tiedAtCut` flags those rows so the console can say so.
 *
 * BLANKS ARE NOT ZEROS. A team with no score row for a stage has not been
 * scored; it sorts below every scored team and never ties its way through a
 * cut. `scored` carries that distinction, since a total of 0 is a real score.
 */

import { FINALS_ROUND_FORMATS, type YiqCategory } from "./constants";

export type NationalStage =
  | "national_quarterfinal"
  | "national_semifinal"
  | "national_final";

export type NationalEntryStatus =
  | "entered"
  | "quarterfinal_qualified"
  | "semifinal_qualified"
  | "finalist"
  | "runner_up"
  | "national_champion"
  | "eliminated";

/** Ladder order. Any stage list is sorted against this, never against a name. */
export const NATIONAL_STAGES: NationalStage[] = [
  "national_quarterfinal",
  "national_semifinal",
  "national_final",
];

export const STAGE_LABELS: Record<NationalStage, string> = {
  national_quarterfinal: "National Quarter-Final",
  national_semifinal: "National Semi-Final",
  national_final: "National Final",
};

/** What a team that comes THROUGH each stage becomes. */
export const SURVIVOR_STATUS: Record<NationalStage, NationalEntryStatus> = {
  national_quarterfinal: "quarterfinal_qualified",
  national_semifinal: "semifinal_qualified",
  national_final: "national_champion",
};

/**
 * Teams on the National Final stage. The Final is live and on-stage with a
 * celebrity quizmaster, so the field is small by design. Overridable per
 * publish; this is only the default the console starts from.
 */
export const DEFAULT_FINAL_FIELD_SIZE = 6;

/**
 * The most a single stage may cut the field by. A stage that would have to
 * cut harder than this gets another stage inserted ahead of it — which is
 * what turns a 65-team field into quarter -> semi -> final instead of one
 * brutal semi-final. Only two narrowing stages exist, so a very large field
 * simply narrows a little harder than this at each step.
 */
export const MAX_NARROWING_PER_STAGE = 3;

export const MIN_FINAL_FIELD_SIZE = 2;
export const MAX_FINAL_FIELD_SIZE = 50;

/** One chapter champion team standing in the national competition. */
export type NationalEntry = {
  entryId: string;
  teamId: string;
  teamName: string;
  chapterName: string;
  category: YiqCategory;
  semifinalScore: number | null;
  semifinalRank: number | null;
  finaleScore: number | null;
  finaleRank: number | null;
  status: NationalEntryStatus;
};

export type LadderStep = {
  stage: NationalStage;
  /** 1-based position in the ladder. */
  order: number;
  /** Teams that start this stage. */
  entering: number;
  /** Teams that come out of it. For the Final this is 1 — the champion. */
  advancing: number;
  /** What a survivor's national_entries.status becomes. */
  survivorStatus: NationalEntryStatus;
};

export type NationalScoreRow = { teamId: string; points: number };

export type NationalStanding = NationalEntry & {
  /** Sum of the finals_scores rows handed in for this team on this stage. */
  liveTotal: number;
  /** False when NO score row exists — a blank, which is not a zero. */
  scored: boolean;
  rank: number;
  qualified: boolean;
  /** Inside the cut ONLY because it tied with the last qualifier. */
  tiedAtCut: boolean;
};

/** What one entry's row should become once a stage is decided. */
export type NationalOutcome = {
  entryId: string;
  teamId: string;
  teamName: string;
  chapterName: string;
  rank: number;
  score: number;
  scored: boolean;
  status: NationalEntryStatus;
  tiedAtCut: boolean;
};

/* --------------------------------------------------------------- ladder */

/**
 * Derive the national stage ladder for a field of `entrantCount` teams.
 *
 * The rule:
 *   1. A field that already fits the Final runs the Final alone.
 *   2. Otherwise count the NARROWING stages needed, where one stage may cut
 *      the field by at most MAX_NARROWING_PER_STAGE. Only two exist
 *      (Quarter-Final, Semi-Final), so the count is capped at two and a huge
 *      field narrows a little harder rather than growing a fourth stage.
 *   3. Spread the cut EVENLY across those stages — each divides the field by
 *      the same ratio — so no stage does almost nothing while another does
 *      everything. Every boundary is rounded UP, so an odd or non-power-of-two
 *      field never loses a team and never produces an empty stage.
 *
 * Worked examples at the default Final field of 6:
 *   0  -> []                                 (nothing to run)
 *   1  -> Final(1->1)                        (a lone entrant is champion)
 *   4  -> Final(4->1)
 *   6  -> Final(6->1)
 *   7  -> Semi(7->6),   Final(6->1)
 *   12 -> Semi(12->6),  Final(6->1)
 *   13 -> Semi(13->6),  Final(6->1)
 *   18 -> Semi(18->6),  Final(6->1)          (last field a single stage takes)
 *   19 -> Quarter(19->11), Semi(11->6), Final(6->1)
 *   33 -> Quarter(33->15), Semi(15->6), Final(6->1)
 *   64 -> Quarter(64->20), Semi(20->6), Final(6->1)
 *   65 -> Quarter(65->20), Semi(20->6), Final(6->1)
 *
 * Invariants this guarantees, all covered in the check script:
 *   - the first step takes in exactly `entrantCount` — nobody is lost at the door
 *   - each step's `entering` equals the previous step's `advancing`
 *   - every narrowing stage strictly narrows (advancing < entering)
 *   - the last step is always the Final
 *   - stages always appear in ladder order and never repeat
 */
export function nationalLadder(
  entrantCount: number,
  opts: { finalFieldSize?: number } = {}
): LadderStep[] {
  const finalField = clampInt(
    opts.finalFieldSize ?? DEFAULT_FINAL_FIELD_SIZE,
    MIN_FINAL_FIELD_SIZE,
    MAX_FINAL_FIELD_SIZE
  );
  const total = Math.max(0, Math.floor(entrantCount));
  if (total < 1) return [];

  let narrowing = 0;
  while (
    narrowing < 2 &&
    finalField * Math.pow(MAX_NARROWING_PER_STAGE, narrowing) < total
  ) {
    narrowing++;
  }

  const steps: LadderStep[] = [];
  let entering = total;

  if (narrowing > 0) {
    const stages: NationalStage[] =
      narrowing === 2
        ? ["national_quarterfinal", "national_semifinal"]
        : ["national_semifinal"];

    // The same ratio at every step: field_i = total / ratio^i.
    const ratio = Math.pow(total / finalField, 1 / narrowing);

    stages.forEach((stage, i) => {
      const isLastNarrowing = i === stages.length - 1;
      const target = isLastNarrowing
        ? finalField
        : // Never hand the next stage a field it cannot narrow.
          Math.max(finalField + 1, Math.ceil(total / Math.pow(ratio, i + 1)));
      const advancing = Math.min(target, entering - 1);

      steps.push({
        stage,
        order: steps.length + 1,
        entering,
        advancing,
        survivorStatus: SURVIVOR_STATUS[stage],
      });
      entering = advancing;
    });
  }

  steps.push({
    stage: "national_final",
    order: steps.length + 1,
    entering,
    advancing: 1,
    survivorStatus: SURVIVOR_STATUS.national_final,
  });

  return steps;
}

/** Normalise a Final field size coming from a URL, a form, or a caller. */
export function clampFinalFieldSize(n: number): number {
  if (!Number.isFinite(n)) return DEFAULT_FINAL_FIELD_SIZE;
  return clampInt(n, MIN_FINAL_FIELD_SIZE, MAX_FINAL_FIELD_SIZE);
}

export function ladderStep(
  ladder: LadderStep[],
  stage: NationalStage
): LadderStep | null {
  return ladder.find((s) => s.stage === stage) ?? null;
}

/**
 * The statuses a team must carry to be standing at `stage`.
 *
 * Includes the stage's OWN survivor status so re-publishing a stage is
 * idempotent — the teams it already promoted are still in the field it ranks.
 * A team eliminated at a stage is out: `eliminated` does not record WHICH
 * stage ended a run, so it cannot be safely re-admitted here.
 */
export function enteringStatuses(
  ladder: LadderStep[],
  stage: NationalStage
): NationalEntryStatus[] {
  const i = ladder.findIndex((s) => s.stage === stage);
  if (i < 0) return [];

  const prior: NationalEntryStatus =
    i === 0 ? "entered" : ladder[i - 1].survivorStatus;

  if (stage === "national_final") {
    // Once the Final is placed the same teams carry placement statuses.
    return [prior, "finalist", "runner_up", "national_champion"];
  }
  return [prior, SURVIVOR_STATUS[stage]];
}

/**
 * Did this entry's run end at `stage`?
 *
 * `eliminated` does not say WHICH stage ended a run — but semifinal_rank
 * does, because it is stamped only when the Semi-Final publishes. So an
 * eliminated team carrying a semi-final rank fell at the semi, and one
 * without it fell at the only earlier stage there can be, the quarter-final.
 * That holds for every ladder this competition can produce.
 *
 * It matters for two reasons: a published stage keeps showing who went out,
 * instead of quietly rendering only the survivors; and re-publishing a stage
 * ranks the SAME field it ranked the first time rather than a shrunken one.
 */
export function fellAtStage(
  entry: NationalEntry,
  stage: NationalStage,
  ladder: LadderStep[]
): boolean {
  if (entry.status !== "eliminated") return false;
  if (stage === "national_final") return false;
  if (!ladder.some((s) => s.stage === stage)) return false;

  const narrowing = ladder.filter((s) => s.stage !== "national_final");
  if (narrowing.length === 0) return false;
  if (narrowing.length === 1) return narrowing[0].stage === stage;

  return stage === "national_semifinal"
    ? entry.semifinalRank !== null
    : entry.semifinalRank === null;
}

/**
 * How far along the ladder a status sits. `eliminated` is off the scale: it
 * is a terminal state, not a rung, and is handled by fellAtStage().
 */
const STATUS_PROGRESS: Record<NationalEntryStatus, number> = {
  entered: 0,
  quarterfinal_qualified: 1,
  semifinal_qualified: 2,
  finalist: 3,
  runner_up: 4,
  national_champion: 5,
  eliminated: -1,
};

/**
 * Has this stage's result been published?
 *
 * Asks "has anyone got PAST this stage", not "does anyone hold exactly this
 * stage's status" — otherwise crowning a champion would flip every earlier
 * stage back to looking unpublished, because its survivors have moved on.
 */
export function stagePublished(
  entries: NationalEntry[],
  ladder: LadderStep[],
  stage: NationalStage
): boolean {
  const step = ladder.find((s) => s.stage === stage);
  if (!step) return false;
  if (stage === "national_final") {
    return entries.some((e) => e.status === "national_champion");
  }
  const bar = STATUS_PROGRESS[step.survivorStatus];
  return entries.some(
    (e) => fellAtStage(e, stage, ladder) || STATUS_PROGRESS[e.status] >= bar
  );
}

/** Every entry standing in — or knocked out at — `stage`. */
export function stageField(
  entries: NationalEntry[],
  ladder: LadderStep[],
  stage: NationalStage
): NationalEntry[] {
  const allowed = enteringStatuses(ladder, stage);
  return entries.filter(
    (e) => allowed.includes(e.status) || fellAtStage(e, stage, ladder)
  );
}

/* ------------------------------------------------------------ standings */

/**
 * Merge the entries of ONE category with their score rows for ONE stage, and
 * apply the cut. Score rows for a team outside the category are dropped, so
 * the junior and senior boards can never contaminate each other.
 *
 * `advancing` of 0 ranks the field without qualifying anybody — that is how
 * the Final reads its board, since the Final is placed, not cut.
 */
export function nationalStandings(
  entries: NationalEntry[],
  scores: NationalScoreRow[],
  category: YiqCategory,
  advancing = 0
): NationalStanding[] {
  const inCategory = entries.filter((e) => e.category === category);
  const teamIds = new Set(inCategory.map((e) => e.teamId));

  const totals = new Map<string, number>();
  for (const s of scores) {
    if (!teamIds.has(s.teamId)) continue;
    totals.set(s.teamId, (totals.get(s.teamId) ?? 0) + Number(s.points));
  }

  const rows: NationalStanding[] = inCategory
    .map((e) => ({
      ...e,
      liveTotal: round2(totals.get(e.teamId) ?? 0),
      scored: totals.has(e.teamId),
      rank: 0,
      qualified: false,
      tiedAtCut: false,
    }))
    .sort(compareStandings);

  rows.forEach((r, i) => {
    r.rank = i + 1;
  });

  if (rows.length === 0 || advancing < 1) return rows;

  const cut = rows[Math.min(advancing, rows.length) - 1];

  for (const r of rows) {
    // A true tie with the last qualifier is carried through. Two blanks are
    // NOT a tie — an unrecorded score cannot earn anyone a place.
    const tiedWithCut = cut.scored && r.scored && r.liveTotal === cut.liveTotal;
    r.qualified = r.rank <= advancing || tiedWithCut;
    r.tiedAtCut = r.qualified && r.rank > advancing;
  }

  return rows;
}

/**
 * Result of one NARROWING stage: the cut carries that stage's survivor
 * status, everyone else is eliminated.
 */
export function stageOutcomes(
  standings: NationalStanding[],
  step: LadderStep
): NationalOutcome[] {
  return standings.map((s) => ({
    entryId: s.entryId,
    teamId: s.teamId,
    teamName: s.teamName,
    chapterName: s.chapterName,
    rank: s.rank,
    score: s.liveTotal,
    scored: s.scored,
    status: s.qualified ? step.survivorStatus : "eliminated",
    tiedAtCut: s.tiedAtCut,
  }));
}

/**
 * National Final placement. The champion is CHOSEN by the quizmaster's call
 * on stage, not derived, so it is passed in; everyone else is placed around
 * it by their Final score.
 *
 * The best non-champion is `runner_up`, and so is anyone level with them on
 * score — a genuine tie for second gives two runners-up rather than an
 * arbitrary alphabetical winner. The rest of the field is `finalist`: they
 * stood on the national stage, which is the record worth keeping.
 *
 * Returns null when the field is empty or the crowned team is not standing in
 * it — the caller must fail closed rather than crown a stranger.
 */
export function finalPlacements(
  standings: NationalStanding[],
  championTeamId: string
): NationalOutcome[] | null {
  if (standings.length === 0) return null;
  if (!standings.some((s) => s.teamId === championTeamId)) return null;

  const rest = standings.filter((s) => s.teamId !== championTeamId);
  const runnerUpIds = new Set<string>();
  if (rest.length > 0) {
    const best = rest[0];
    runnerUpIds.add(best.entryId);
    for (const s of rest.slice(1)) {
      if (s.scored && best.scored && s.liveTotal === best.liveTotal) {
        runnerUpIds.add(s.entryId);
      }
    }
  }

  return standings.map((s) => ({
    entryId: s.entryId,
    teamId: s.teamId,
    teamName: s.teamName,
    chapterName: s.chapterName,
    rank: s.rank,
    score: s.liveTotal,
    scored: s.scored,
    status:
      s.teamId === championTeamId
        ? "national_champion"
        : runnerUpIds.has(s.entryId)
          ? "runner_up"
          : "finalist",
    tiedAtCut: runnerUpIds.size > 1 && runnerUpIds.has(s.entryId),
  }));
}

/* --------------------------------------------------------------- rounds */

export type NationalRoundPlan = {
  roundNumber: number;
  roundType: string;
  name: string;
  pointsCorrect: number;
  pointsPassBonus: number;
  timeLimitSeconds: number | null;
  questionsPerTeam: number;
};

/**
 * The rounds each national stage is made of.
 *
 * The Final is the same six-round BQC structure the chapter finals use —
 * celebrity quizmaster, live audience, same shape. The Quarter-Final and
 * Semi-Final are written/online narrowing papers, so each gets ONE container
 * round: the stage's score is entered as a single total against it, and the
 * round exists so the stage is visible on the board and can carry its own
 * question set.
 */
export function nationalRoundPlan(stage: NationalStage): NationalRoundPlan[] {
  if (stage === "national_final") {
    return FINALS_ROUND_FORMATS.map((f, i) => ({
      roundNumber: i + 1,
      roundType: f.type,
      name: f.name,
      pointsCorrect: f.pointsCorrect,
      pointsPassBonus: f.pointsPassBonus,
      timeLimitSeconds: "timeLimitSeconds" in f ? f.timeLimitSeconds : null,
      questionsPerTeam: "questionsPerTeam" in f ? f.questionsPerTeam : 1,
    }));
  }

  return [
    {
      roundNumber: 1,
      roundType: "direct",
      name: `${STAGE_LABELS[stage]} paper`,
      pointsCorrect: 1,
      pointsPassBonus: 0,
      timeLimitSeconds: null,
      questionsPerTeam: 1,
    },
  ];
}

/** The paper_kind that carries a stage's question set. */
export function paperKindForStage(stage: NationalStage): string {
  return stage;
}

/**
 * sequence_no on a finals_scores row that holds a whole-stage total typed in
 * by an admin, as opposed to a live on-stage tap. Live taps are appended from
 * 1 upward by the finals console, so 0 is free and a re-typed total replaces
 * only the previous typed total.
 */
export const STAGE_TOTAL_SEQUENCE_NO = 0;

/* -------------------------------------------------------------- helpers */

function compareStandings(a: NationalStanding, b: NationalStanding): number {
  // A blank is not a zero — an unrecorded score sits below every recorded one.
  if (a.scored !== b.scored) return a.scored ? -1 : 1;
  return (
    b.liveTotal - a.liveTotal ||
    a.chapterName.localeCompare(b.chapterName) ||
    a.teamName.localeCompare(b.teamName)
  );
}

function clampInt(n: number, lo: number, hi: number): number {
  if (!Number.isFinite(n)) return lo;
  return Math.min(hi, Math.max(lo, Math.floor(n)));
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
