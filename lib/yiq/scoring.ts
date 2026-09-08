/**
 * YIQ scoring — pure functions, no I/O. Kept separate from the server
 * actions so the rules are testable and readable on their own.
 *
 * MODEL (Director decision 2026-08-24, REVISED by ruling 2026-08-25)
 *   Teams register upfront. Every member sits the online MCQ paper on their
 *   own. The TEAM's online score is the AVERAGE of the members who SAT —
 *   not the sum — with a FLOOR OF TWO: a team where fewer than two members
 *   sat is OUT, whatever that one member scored.
 *
 * WHY IT CHANGED. Under the sum, a member who was ill counted as a zero and
 * ended a strong team's run: a 2-member team scoring 88 and 90 lost to a
 * 3-member team averaging 83. Averaging fixes that, but a plain average opens
 * the reverse abuse — enter three students, sit only the strongest, win on one
 * score. The floor of two closes it without punishing bad luck.
 *
 * `membersAttempted` and `membersTotal` are carried on every rollup because an
 * average without its denominator is unreadable: 83 from two sitters and 83
 * from three are different achievements, and an organiser must see which.
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

/** Fewer than this many members sitting and the team is out (2026-08-25). */
export const MIN_MEMBERS_SAT = 2;

export type TeamRollup = {
  teamId: string;
  teamName: string;
  category: "junior" | "senior";
  /**
   * The team's AVERAGE across the members who sat, rounded to 2dp. Zero when
   * the team is ineligible — read `eligible` rather than inferring from this.
   */
  score: number;
  /** False when fewer than MIN_MEMBERS_SAT sat. Such a team never qualifies. */
  eligible: boolean;
  /** Machine-readable reason when `eligible` is false. */
  ineligibleReason: "insufficient_members" | null;
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
    score: attempted.length
      ? round2(attempted.reduce((s, m) => s + m.score, 0) / attempted.length)
      : 0,
    eligible: attempted.length >= MIN_MEMBERS_SAT,
    ineligibleReason:
      attempted.length >= MIN_MEMBERS_SAT ? null : "insufficient_members",
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
  // Ineligible teams (fewer than MIN_MEMBERS_SAT sat) sort BELOW every
  // eligible team no matter what their one member scored — otherwise a
  // single strong student would rank first and the floor would mean nothing.
  // They still receive a rank so an organiser can see them on the board and
  // understand why they are out.
  const sorted = [...teams].sort(
    (a, b) =>
      Number(b.eligible) - Number(a.eligible) ||
      b.score - a.score ||
      // Tie-break on AVERAGE time, not total. The score is an average, so a
      // total would punish a 3-member team for having sat one more paper —
      // the tie-break must not contradict the scoring model.
      avgTime(a) - avgTime(b) ||
      a.teamName.localeCompare(b.teamName)
  );

  sorted.forEach((t, i) => {
    t.rank = i + 1;
  });

  if (sorted.length === 0) return sorted;

  const eligible = sorted.filter((t) => t.eligible);
  if (eligible.length === 0) {
    for (const t of sorted) t.qualified = false;
    return sorted;
  }

  const cut = eligible[Math.min(qualifyingCount, eligible.length) - 1];

  for (const t of sorted) {
    if (!t.eligible) {
      t.qualified = false;
      continue;
    }
    t.qualified =
      (t.rank ?? Infinity) <= qualifyingCount ||
      // Director ruling 2026-08-25: a GENUINE dead heat at the cut-off —
      // level on both score and time — carries every tied team through
      // rather than dropping one on a coin-flip. A chapter may therefore
      // run its finals with 11 or 12 teams, and that is intended.
      (t.score === cut.score && avgTime(t) === avgTime(cut));
  }

  return sorted;
}

/**
 * Mean seconds per member who sat. Zero sitters yields Infinity so an empty
 * team never wins a tie-break by appearing infinitely fast.
 */
function avgTime(t: TeamRollup): number {
  return t.membersAttempted > 0
    ? t.totalTimeSeconds / t.membersAttempted
    : Number.POSITIVE_INFINITY;
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
