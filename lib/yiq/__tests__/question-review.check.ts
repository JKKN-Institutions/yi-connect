/**
 * YIQ question-approval checks.
 *
 * No test runner in this repo, so this is a standalone script:
 *     npx tsx lib/yiq/__tests__/question-review.check.ts
 *
 * What is under test is the last gate before a question is put in front of
 * every student in the country. A question that slips through broken -- a
 * missing option, an answer key pointing nowhere, two identical choices --
 * cannot be marked fairly, and it damages every student who sits it. So
 * every refusal is asserted rather than assumed.
 */
import {
  canApprove,
  partitionForApproval,
  APPROVAL_REFUSAL_TEXT,
  type ReviewableQuestion,
  type ApprovalRefusal,
} from "../question-review";

let pass = 0, fail = 0;
function check(name: string, cond: boolean, detail = "") {
  if (cond) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; console.log(`  ✗ ${name} ${detail}`); }
}
function eq(name: string, a: unknown, b: unknown) {
  check(name, JSON.stringify(a) === JSON.stringify(b),
    `got ${JSON.stringify(a)} want ${JSON.stringify(b)}`);
}

/** A well-formed, drafted, never-reviewed MCQ sitting in the practice pool. */
function q(over: Partial<ReviewableQuestion> = {}): ReviewableQuestion {
  return {
    id: "q1",
    pool: "practice",
    isActive: true,
    isRetired: false,
    reviewedAt: null,
    questionType: "mcq",
    questionText: "If 4x+7 = 2x+19, then x equals:",
    optionA: "4", optionB: "6", optionC: "9", optionD: "13",
    correctOption: "b",
    answerExplanation: "2x = 12, so x = 6.",
    ...over,
  };
}

function refusal(name: string, over: Partial<ReviewableQuestion>, want: ApprovalRefusal) {
  const d = canApprove(q(over));
  check(name, d.ok === false && d.reason === want,
    d.ok ? "was APPROVED" : `reason ${d.reason} want ${want}`);
}

console.log("\n── the yes ──");
check("a complete, unreviewed practice MCQ may be approved", canApprove(q()).ok === true);
check("a non-MCQ with an explanation may be approved (finals types)",
  canApprove(q({ questionType: "visual", optionA: null, optionB: null, optionC: null, optionD: null, correctOption: null })).ok === true);
check("pool 'either' may still be approved", canApprove(q({ pool: "either" })).ok === true);

console.log("\n── refusals: state ──");
refusal("an already-reviewed question is refused", { reviewedAt: "2026-08-01T00:00:00Z" }, "already_reviewed");
refusal("a retired question is refused", { isRetired: true }, "retired");
refusal("an inactive question is refused", { isActive: false }, "inactive");
refusal("a question already in competition is refused", { pool: "competition" }, "already_competition");
check("retired beats every other reason",
  (() => { const d = canApprove(q({ isRetired: true, pool: "competition", reviewedAt: "x" })); return !d.ok && d.reason === "retired"; })());

console.log("\n── refusals: the question itself ──");
refusal("a missing option A is refused", { optionA: null }, "incomplete_mcq");
refusal("a missing option D is refused", { optionD: null }, "incomplete_mcq");
refusal("a whitespace-only option is refused", { optionC: "   " }, "incomplete_mcq");
refusal("empty question text is refused", { questionText: "" }, "incomplete_mcq");
refusal("a blank answer key is refused", { correctOption: "" }, "correct_option_blank");
refusal("a null answer key is refused", { correctOption: null }, "correct_option_blank");
refusal("an answer key of 'e' is refused", { correctOption: "e" }, "correct_option_invalid");
refusal("an answer key of '1' is refused", { correctOption: "1" }, "correct_option_invalid");
refusal("two identical options are refused", { optionB: "4" }, "duplicate_options");
refusal("options differing only by case are refused", { optionB: "FOUR", optionA: "four" }, "duplicate_options");
refusal("options differing only by padding are refused", { optionB: " 4 " }, "duplicate_options");
refusal("no explanation is refused", { answerExplanation: null }, "no_explanation");
refusal("a whitespace explanation is refused", { answerExplanation: "  " }, "no_explanation");

console.log("\n── the answer key is accepted in any letter case ──");
check("uppercase 'B' is accepted", canApprove(q({ correctOption: "B" })).ok === true);
check("padded ' b ' is accepted", canApprove(q({ correctOption: " b " })).ok === true);

console.log("\n── partitionForApproval ──");
const batch = [
  q({ id: "good1" }),
  q({ id: "good2", correctOption: "c" }),
  q({ id: "bad-dupe", optionB: "4" }),
  q({ id: "bad-retired", isRetired: true }),
  q({ id: "good3", questionType: "direct", optionA: null, optionB: null, optionC: null, optionD: null, correctOption: null }),
];
const part = partitionForApproval(batch);
eq("three good ones are approved", part.approve, ["good1", "good2", "good3"]);
eq("two bad ones are refused with their reasons",
  part.refuse, [{ id: "bad-dupe", reason: "duplicate_options" }, { id: "bad-retired", reason: "retired" }]);
check("one broken question does not block the good ones", part.approve.length === 3);
eq("an empty batch approves nothing and refuses nothing",
  partitionForApproval([]), { approve: [], refuse: [] });

console.log("\n── every refusal has readable text ──");
const REASONS: ApprovalRefusal[] = ["already_reviewed","retired","inactive","already_competition","incomplete_mcq","correct_option_invalid","correct_option_blank","no_explanation","duplicate_options"];
for (const r of REASONS) {
  check(`  ${r} has a sentence`, typeof APPROVAL_REFUSAL_TEXT[r] === "string" && APPROVAL_REFUSAL_TEXT[r].length > 10);
}

console.log(`\n${fail === 0 ? "PASS" : "FAIL"} — ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
