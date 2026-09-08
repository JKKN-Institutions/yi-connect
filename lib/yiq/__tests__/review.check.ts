/**
 * YIQ review-gate checks.
 *
 * This repo has NO test runner installed (no vitest, no jest), so this is a
 * standalone script in the same shape as scoring.check.ts:
 *
 *     npx tsx lib/yiq/__tests__/review.check.ts
 *
 * It exits non-zero on any failure, so it can be wired into CI as-is.
 *
 * WHY EVERY BRANCH IS HERE: this gate is the only thing standing between a
 * student sitting the paper on one phone and the answer key open on another.
 * A single wrong branch compromises the whole chapter round, so each one is
 * asserted rather than assumed.
 */
import {
  canRevealAnswers,
  reviewGate,
  buildReview,
  normaliseOptionKey,
  type RevealInput,
  type ReviewQuestionSource,
  type ReviewAnswerSource,
} from "../review";

let pass = 0, fail = 0;
function check(name: string, cond: boolean, detail = "") {
  if (cond) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; console.log(`  ✗ ${name} ${detail}`); }
}
function eq(name: string, a: unknown, b: unknown) {
  check(name, JSON.stringify(a) === JSON.stringify(b), `got ${JSON.stringify(a)} want ${JSON.stringify(b)}`);
}

const ME = "student-1";
const OTHER = "student-2";

/** A finished, real (non-mock) attempt owned by ME, unless overridden. */
function input(over: Partial<{
  viewer: string | null;
  studentId: string;
  status: string;
  isMock: boolean;
  event: { status: string | null; resultsPublishedAt: string | null } | null;
}> = {}): RevealInput {
  return {
    viewerStudentId: "viewer" in over ? over.viewer : ME,
    attempt: {
      studentId: over.studentId ?? ME,
      status: over.status ?? "submitted",
      isMock: over.isMock ?? false,
    },
    event:
      "event" in over
        ? over.event
        : { status: "online_round_closed", resultsPublishedAt: null },
  };
}

console.log("\n── canRevealAnswers: ownership ──");
eq("no session -> closed", canRevealAnswers(input({ viewer: null })), false);
eq("another student's attempt -> closed",
   canRevealAnswers(input({ studentId: OTHER })), false);
eq("no attempt row -> closed",
   canRevealAnswers({ viewerStudentId: ME, attempt: null, event: null }), false);
eq("owner + closed round -> open", canRevealAnswers(input()), true);

console.log("\n── canRevealAnswers: attempt status ──");
eq("in_progress -> closed (this IS the live paper)",
   canRevealAnswers(input({ status: "in_progress" })), false);
eq("in_progress mock -> closed too",
   canRevealAnswers(input({ status: "in_progress", isMock: true })), false);
eq("auto_submitted -> open", canRevealAnswers(input({ status: "auto_submitted" })), true);
eq("disqualified -> closed", canRevealAnswers(input({ status: "disqualified" })), false);
eq("unknown attempt status -> closed",
   canRevealAnswers(input({ status: "banana" })), false);
eq("empty attempt status -> closed", canRevealAnswers(input({ status: "" })), false);

console.log("\n── canRevealAnswers: the round must be over ──");
for (const s of ["draft", "registration_open", "registration_closed", "online_round_live"]) {
  eq(`event '${s}' -> closed`,
     canRevealAnswers(input({ event: { status: s, resultsPublishedAt: null } })), false);
}
for (const s of ["online_round_closed", "finals_scheduled", "finals_live", "finals_complete"]) {
  eq(`event '${s}' -> open`,
     canRevealAnswers(input({ event: { status: s, resultsPublishedAt: null } })), true);
}
eq("results published while the round still reads live -> open",
   canRevealAnswers(input({
     event: { status: "online_round_live", resultsPublishedAt: "2026-08-24T10:00:00Z" },
   })), true);
eq("missing chapter event -> closed (fail closed)",
   canRevealAnswers(input({ event: null })), false);
eq("null event status -> closed",
   canRevealAnswers(input({ event: { status: null, resultsPublishedAt: null } })), false);
eq("unknown event status -> closed",
   canRevealAnswers(input({ event: { status: "some_new_stage", resultsPublishedAt: null } })), false);
eq("empty results_published_at is not 'published'",
   canRevealAnswers(input({ event: { status: "online_round_live", resultsPublishedAt: "" } })), false);

console.log("\n── canRevealAnswers: practice papers ──");
eq("mock during a LIVE round -> open (that is the point of practice)",
   canRevealAnswers(input({
     isMock: true,
     event: { status: "online_round_live", resultsPublishedAt: null },
   })), true);
eq("mock with no chapter event at all -> open",
   canRevealAnswers(input({ isMock: true, event: null })), true);
eq("mock owned by ANOTHER student -> still closed",
   canRevealAnswers(input({ isMock: true, studentId: OTHER })), false);

console.log("\n── reviewGate: what the student is told ──");
const gLive = reviewGate(input({ event: { status: "online_round_live", resultsPublishedAt: null } }));
eq("live round: may view the summary", gLive.canView, true);
eq("live round: may NOT see the key", gLive.canReveal, false);
eq("live round: says why", gLive.reason, "Answers open after your chapter closes the round.");

const gOpen = reviewGate(input());
eq("closed round: canReveal", gOpen.canReveal, true);
eq("closed round: no reason needed", gOpen.reason, null);

const gProgress = reviewGate(input({ status: "in_progress" }));
eq("in_progress: cannot even view", gProgress.canView, false);
eq("in_progress: cannot reveal", gProgress.canReveal, false);

const gForeign = reviewGate(input({ studentId: OTHER }));
eq("foreign attempt: cannot view", gForeign.canView, false);
eq("foreign attempt: told it is not theirs",
   gForeign.reason, "That paper belongs to a different student.");

const gNoSession = reviewGate(input({ viewer: null }));
eq("no session: cannot view", gNoSession.canView, false);

const gDq = reviewGate(input({ status: "disqualified" }));
eq("disqualified: cannot view", gDq.canView, false);
eq("disqualified: cannot reveal", gDq.canReveal, false);

console.log("\n── normaliseOptionKey ──");
eq("uppercase key normalises", normaliseOptionKey("B"), "b");
eq("padded key normalises", normaliseOptionKey(" c "), "c");
eq("empty -> null", normaliseOptionKey(""), null);
eq("null -> null", normaliseOptionKey(null), null);
eq("garbage -> null", normaliseOptionKey("e"), null);

console.log("\n── buildReview ──");
const opts = [
  { key: "a" as const, text: "Alpha" },
  { key: "b" as const, text: "Bravo" },
  { key: "c" as const, text: "Charlie" },
  { key: "d" as const, text: "Delta" },
];
const questions: ReviewQuestionSource[] = [
  { id: "q1", topic: "History", questionText: "Q one?", mediaUrl: null, options: opts,
    correctOption: "a", explanation: "Because A." },
  { id: "q2", topic: "Science", questionText: "Q two?", mediaUrl: null, options: opts,
    correctOption: "B", explanation: "Because B." },
  { id: "q3", topic: null, questionText: "Q three?", mediaUrl: null, options: opts,
    correctOption: "c", explanation: null },
];
const answers: ReviewAnswerSource[] = [
  { questionId: "q1", selectedOption: "a", isCorrect: true, marksAwarded: 2 },
  { questionId: "q2", selectedOption: "d", isCorrect: false, marksAwarded: -0.5 },
  // q3 never answered
];
// The order this student SAT the paper — deliberately not 1,2,3.
const order = ["q2", "q3", "q1"];

const revealed = buildReview(order, questions, answers, true);
eq("walks the student's own question order",
   revealed.map((i) => i.questionId), ["q2", "q3", "q1"]);
eq("numbers follow that order", revealed.map((i) => i.number), [1, 2, 3]);
eq("q2 your answer", revealed[0].yourAnswer, "d");
eq("q2 correct answer normalised from 'B'", revealed[0].correctAnswer, "b");
eq("q2 marked wrong", revealed[0].isCorrect, false);
eq("q2 carries the negative mark", revealed[0].marksAwarded, -0.5);
eq("q2 explanation shown", revealed[0].explanation, "Because B.");
eq("q3 unanswered -> yourAnswer null", revealed[1].yourAnswer, null);
eq("q3 unanswered is neither right nor wrong", revealed[1].isCorrect, null);
eq("q3 unanswered scores 0", revealed[1].marksAwarded, 0);
eq("q3 still shows its key", revealed[1].correctAnswer, "c");
eq("q1 marked correct", revealed[2].isCorrect, true);

console.log("\n── buildReview: NOT permitted must carry no key ──");
const hidden = buildReview(order, questions, answers, false);
eq("no correct answers leak", hidden.map((i) => i.correctAnswer), [null, null, null]);
eq("no explanations leak", hidden.map((i) => i.explanation), [null, null, null]);
eq("no per-question verdict leaks", hidden.map((i) => i.isCorrect), [null, null, null]);
eq("no per-question marks leak", hidden.map((i) => i.marksAwarded), [null, null, null]);
check("the student still sees their OWN answers",
  hidden[0].yourAnswer === "d" && hidden[2].yourAnswer === "a");
check("the student still sees the question text",
  hidden[0].questionText === "Q two?" && hidden[0].options.length === 4);

// Defence in depth: even if a caller hands over rows that still carry the key,
// buildReview must not pass it through when reveal is false.
const stillHidden = buildReview(
  ["q1"],
  [{ id: "q1", topic: null, questionText: "Q?", mediaUrl: null, options: opts,
     correctOption: "a", explanation: "leak me" }],
  [{ questionId: "q1", selectedOption: "a", isCorrect: true, marksAwarded: 5 }],
  false
);
eq("a key handed in anyway is still stripped", stillHidden[0].correctAnswer, null);
eq("an explanation handed in anyway is still stripped", stillHidden[0].explanation, null);
eq("a stored verdict handed in anyway is still stripped", stillHidden[0].isCorrect, null);
eq("stored marks handed in anyway are still stripped", stillHidden[0].marksAwarded, null);

console.log("\n── buildReview: edges ──");
eq("empty order -> empty review", buildReview([], questions, answers, true).length, 0);
const missing = buildReview(["q1", "gone", "q3"], questions, answers, true);
eq("a question deleted since the sitting drops out",
   missing.map((i) => i.questionId), ["q1", "q3"]);
eq("  and numbering stays contiguous", missing.map((i) => i.number), [1, 2]);

const keyless = buildReview(
  ["qX"],
  [{ id: "qX", topic: null, questionText: "No key?", mediaUrl: null, options: opts,
     correctOption: null, explanation: null }],
  [{ questionId: "qX", selectedOption: "a", isCorrect: null, marksAwarded: 0 }],
  true
);
eq("a keyless question shows no correct answer", keyless[0].correctAnswer, null);
eq("  and is not called wrong", keyless[0].isCorrect, null);

const garbageAnswer = buildReview(
  ["q1"],
  questions,
  [{ questionId: "q1", selectedOption: "zz", isCorrect: true, marksAwarded: 2 }],
  true
);
eq("an unrecognised stored option reads as unanswered", garbageAnswer[0].yourAnswer, null);
eq("  and cannot be scored correct", garbageAnswer[0].isCorrect, null);

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail === 0 ? 0 : 1);
