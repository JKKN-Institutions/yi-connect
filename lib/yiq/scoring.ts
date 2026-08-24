/**
 * YIQ scoring — pure functions, no I/O. Kept separate from the server
 * actions so the rules are testable and readable on their own.
 *
 * MODEL (Director decision, 2026-08-24)
 *   Teams register upfront. Every member sits the online MCQ paper on their
 *   own. The TEAM's online score is the SUM of its members' scores. Teams are
 *   ranked within (chapter_event, category); the top N advance to the Chapter
 *   Finals. Individual scores are retained separately for the Best Individual
 *   Quizzer award.
 *
 * Deliberate consequence: a team that fields fewer members scores lower. That
 * is intended — the deck's unit of competition is the team, and a full team is
 * part of what is being tested. `membersAttempted` is carried on the rollup so
 * an organiser can always see WHY a team ranked low.
 */

export type AnswerKey = { questionId: string; correctOption: string | null };

export type SubmittedAnswer = {
  questionId: string;
  selectedOption: string | null;
};

export type PaperRules = {
  marksPerQuestion: number;
  negativeMarks: number;
};

export type GradedAnswer = {
  questionId: string;
  selectedOption: string | null;
  isCorrect: boolean | null;
  marksAwarded: number;
};

export type GradedAttempt = {
  answers: GradedAnswer[];
  score: number;
  correctCount: number;
  wrongCount: number;
  unansweredCount: number;
};

/**
 * Grade one attempt against the paper's answer key.
 *
 * Every question on the paper is graded, whether or not the student reached
 * it — an unreached question counts as unanswered (0), never as wrong, so
 * negative marking can only ever be applied to a deliberate wrong answer.
 */
export function gradeAttempt(
  key: AnswerKey[],
  submitted: SubmittedAnswer[],
  rules: PaperRules
): GradedAttempt {
  const chosen = new Map(
    submitted.map((a) => [a.questionId, a.selectedOption ?? null])
  );

  const answers: GradedAnswer[] = [];
  let score = 0;
  let correctCount = 0;
  let wrongCount = 0;
  let unansweredCount = 0;

  for (const q of key) {
    const selected = chosen.get(q.questionId) ?? null;

    if (selected === null || selected === "") {
      unansweredCount++;
      answers.push({
        questionId: q.questionId,
        selectedOption: null,
        isCorrect: null,
        marksAwarded: 0,
      });
      continue;
    }

    // A question with no key cannot be marked wrong against the student.
    if (!q.correctOption) {
      unansweredCount++;
      answers.push({
        questionId: q.questionId,
        selectedOption: selected,
        isCorrect: null,
        marksAwarded: 0,
      });
      continue;
    }

    const isCorrect =
      selected.toLowerCase() === q.correctOption.toLowerCase();
    const marks = isCorrect ? rules.marksPerQuestion : -rules.negativeMarks;

    if (isCorrect) correctCount++;
    else wrongCount++;

    score += marks;
    answers.push({
      questionId: q.questionId,
      selectedOption: selected,
      isCorrect,
      marksAwarded: marks,
    });
  }

  // A paper never returns a negative total — negative marking penalises
  // guessing within the paper, it does not put a student in debt.
  score = Math.max(0, score);

  return { answers, score, correctCount, wrongCount, unansweredCount };
}

export type MemberResult = {
  studentId: string;
  studentName: string;
  score: number;
  timeTakenSeconds: number | null;
  attempted: boolean;
};

export type TeamRollup = {
  teamId: string;
  teamName: string;
  category: "junior" | "senior";
  totalScore: number;
  membersAttempted: number;
  membersTotal: number;
  /** Sum of members' time — the tie-break. Faster team wins a tie. */
  totalTimeSeconds: number;
  members: MemberResult[];
  rank?: number;
  qualified?: boolean;
};

/** Sum a team's member scores into its online rollup. */
export function rollUpTeam(
  teamId: string,
  teamName: string,
  category: "junior" | "senior",
  members: MemberResult[]
): TeamRollup {
  const attempted = members.filter((m) => m.attempted);
  return {
    teamId,
    teamName,
    category,
    totalScore: round2(attempted.reduce((s, m) => s + m.score, 0)),
    membersAttempted: attempted.length,
    membersTotal: members.length,
    totalTimeSeconds: attempted.reduce(
      (s, m) => s + (m.timeTakenSeconds ?? 0),
      0
    ),
    members,
  };
}

/**
 * Rank teams within one category and mark the top N as qualified.
 *
 * Ordering: score DESC, then total time ASC (faster wins), then team name so
 * the result is fully deterministic and a re-run never reshuffles equal rows.
 *
 * Ties ACROSS the cut-off line are NOT broken silently: every team level with
 * the Nth team is returned as qualified, so the qualifying set may exceed N.
 * The organiser is shown this and decides — the platform must never drop a
 * genuinely tied team to hit a round number.
 */
export function rankTeams(
  teams: TeamRollup[],
  qualifyingCount: number
): TeamRollup[] {
  const sorted = [...teams].sort(
    (a, b) =>
      b.totalScore - a.totalScore ||
      a.totalTimeSeconds - b.totalTimeSeconds ||
      a.teamName.localeCompare(b.teamName)
  );

  sorted.forEach((t, i) => {
    t.rank = i + 1;
  });

  if (sorted.length === 0) return sorted;

  const cutIndex = Math.min(qualifyingCount, sorted.length) - 1;
  const cut = sorted[cutIndex];

  for (const t of sorted) {
    t.qualified =
      (t.rank ?? Infinity) <= qualifyingCount ||
      // Level with the last qualifier on BOTH score and time — a true tie.
      (t.totalScore === cut.totalScore &&
        t.totalTimeSeconds === cut.totalTimeSeconds);
  }

  return sorted;
}

/**
 * Best Individual Quizzer for a category: highest single attempt score,
 * fastest on a tie. Returns null when nobody sat the paper.
 */
export function bestIndividual(
  members: MemberResult[]
): MemberResult | null {
  const attempted = members.filter((m) => m.attempted);
  if (attempted.length === 0) return null;
  return [...attempted].sort(
    (a, b) =>
      b.score - a.score ||
      (a.timeTakenSeconds ?? Infinity) - (b.timeTakenSeconds ?? Infinity) ||
      a.studentName.localeCompare(b.studentName)
  )[0];
}

/** Live-finals running total for one team across all recorded round scores. */
export function finalsTotal(points: number[]): number {
  return round2(points.reduce((s, p) => s + p, 0));
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
