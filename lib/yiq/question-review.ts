/**
 * The human sign-off that lets a drafted question into a scored round.
 *
 * WHY THIS EXISTS. Director rule 7 (2026-08-25): "the bank grows by AI
 * draft + HUMAN approval." The draft half is the Max lane; this is the
 * approval half, and until 2026-08-27 it did not exist in any form —
 * `pool` was not editable through the admin console, so a drafted
 * question could never legitimately reach a competition paper.
 *
 * The database already refuses the illegitimate route:
 * `yiq_questions_ai_needs_review` rejects any row that is AI-generated
 * AND in the competition pool AND has no `reviewed_at`. This module is
 * the only sanctioned way to satisfy that constraint, and it records WHO
 * satisfied it.
 *
 * PURE DECISION LOGIC ONLY. No database, no auth — those live in
 * app/yiq/actions/admin-questions.ts. Everything here is a decision that
 * a wrong answer would be arguable about afterwards, so each one is
 * separately testable.
 */

/** The fields an approval decision is allowed to look at. */
export type ReviewableQuestion = {
  id: string;
  pool: string | null | undefined;
  isActive: boolean | null | undefined;
  isRetired: boolean | null | undefined;
  reviewedAt: string | null | undefined;
  questionType: string | null | undefined;
  questionText: string | null | undefined;
  optionA: string | null | undefined;
  optionB: string | null | undefined;
  optionC: string | null | undefined;
  optionD: string | null | undefined;
  correctOption: string | null | undefined;
  answerExplanation: string | null | undefined;
};

export type ApprovalRefusal =
  | "already_reviewed"
  | "retired"
  | "inactive"
  | "already_competition"
  | "incomplete_mcq"
  | "correct_option_invalid"
  | "correct_option_blank"
  | "no_explanation"
  | "duplicate_options";

export type ApprovalDecision =
  | { ok: true }
  | { ok: false; reason: ApprovalRefusal };

const VALID_KEYS = new Set(["a", "b", "c", "d"]);

function blank(v: string | null | undefined): boolean {
  return typeof v !== "string" || v.trim() === "";
}

/**
 * May this question be promoted into the competition pool?
 *
 * FAILS CLOSED on every ambiguity. A question that reaches a scored
 * national round with a missing option, a correct_option pointing at an
 * empty slot, or two identical options is not a hard question — it is a
 * broken one, and it damages every student who sits it. The reviewer is
 * a person in a hurry; this is the check that does not get tired.
 */
export function canApprove(q: ReviewableQuestion): ApprovalDecision {
  if (q.isRetired === true) return { ok: false, reason: "retired" };
  if (q.isActive === false) return { ok: false, reason: "inactive" };
  if (!blank(q.reviewedAt)) return { ok: false, reason: "already_reviewed" };
  if (q.pool === "competition") return { ok: false, reason: "already_competition" };

  // Only multiple-choice questions are sat in the online round. Other
  // types belong to the live finals and are not promoted through here.
  if (q.questionType === "mcq") {
    if (blank(q.questionText)) return { ok: false, reason: "incomplete_mcq" };
    const opts = [q.optionA, q.optionB, q.optionC, q.optionD];
    if (opts.some(blank)) return { ok: false, reason: "incomplete_mcq" };

    const key = (q.correctOption ?? "").trim().toLowerCase();
    if (key === "") return { ok: false, reason: "correct_option_blank" };
    if (!VALID_KEYS.has(key)) return { ok: false, reason: "correct_option_invalid" };

    // Two identical options mean two correct answers, or a distractor
    // that is indistinguishable from the answer. Either way it cannot be
    // marked fairly.
    const seen = new Set(opts.map((o) => (o ?? "").trim().toLowerCase()));
    if (seen.size !== 4) return { ok: false, reason: "duplicate_options" };
  }

  // The explanation is what the student sees on the review screen and
  // what the NEXT reviewer checks the answer against. A question with no
  // explanation is unauditable once it is live.
  if (blank(q.answerExplanation)) return { ok: false, reason: "no_explanation" };

  return { ok: true };
}

/** Plain-English refusals for the reviewer's screen. */
export const APPROVAL_REFUSAL_TEXT: Record<ApprovalRefusal, string> = {
  already_reviewed: "Someone has already signed this question off.",
  retired: "This question is retired and cannot be brought back this way.",
  inactive: "This question is switched off. Turn it on before approving it.",
  already_competition: "This question is already in the competition pool.",
  incomplete_mcq: "This question is missing its text or one of its four options.",
  correct_option_invalid: "The recorded answer is not one of A, B, C or D.",
  correct_option_blank: "This question has no recorded answer.",
  no_explanation:
    "This question has no explanation, so nobody can check the answer later.",
  duplicate_options: "Two of the four options are identical, so it cannot be marked fairly.",
};

/**
 * Split a batch into the ones that may be promoted and the ones that may
 * not, keeping each refusal with its question. The caller writes ONLY the
 * approved ids — a batch is never all-or-nothing, because one broken
 * question must not block 199 good ones.
 */
export function partitionForApproval(questions: ReviewableQuestion[]): {
  approve: string[];
  refuse: { id: string; reason: ApprovalRefusal }[];
} {
  const approve: string[] = [];
  const refuse: { id: string; reason: ApprovalRefusal }[] = [];
  for (const q of questions) {
    const d = canApprove(q);
    if (d.ok) approve.push(q.id);
    else refuse.push({ id: q.id, reason: d.reason });
  }
  return { approve, refuse };
}
