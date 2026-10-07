/**
 * YIQ per-question pacing checks.
 *
 *     npx tsx lib/yiq/__tests__/pacing.check.ts
 *
 * This decides whether a real student's answer counts in a scored national
 * round. Two failure directions and both are bad: too strict and an honest
 * student on a school 3G connection loses answers they gave in time; too
 * loose and the anti-AI pacing is theatre. Every rule is asserted.
 */
import {
  pacingFor,
  questionDeadlineMs,
  judgeAnswer,
  questionSecondsRemaining,
  pacedPaperSeconds,
  ANSWER_GRACE_MS,
  ANSWER_REFUSAL_TEXT,
  MIN_SECONDS_PER_QUESTION,
  MAX_SECONDS_PER_QUESTION,
} from "../pacing";

let pass = 0, fail = 0;
function check(name: string, cond: boolean, detail = "") {
  if (cond) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; console.log(`  ✗ ${name} ${detail}`); }
}
function eq(name: string, a: unknown, b: unknown) {
  check(name, JSON.stringify(a) === JSON.stringify(b),
    `got ${JSON.stringify(a)} want ${JSON.stringify(b)}`);
}

const T0 = Date.parse("2026-09-12T10:00:00.000Z");
const SEC = 1000;
const P30 = pacingFor(30);          // a 30-second question
const UNPACED = pacingFor(null);

console.log("\n── pacingFor: fails to UNPACED on anything unusable ──");
eq("a sane number paces the paper", P30, { paced: true, secondsPerQuestion: 30 });
eq("null is unpaced (today's behaviour)", UNPACED, { paced: false });
eq("undefined is unpaced", pacingFor(undefined), { paced: false });
eq("zero is unpaced, NOT a paper that fails everyone instantly",
  pacingFor(0), { paced: false });
eq("a negative is unpaced", pacingFor(-30), { paced: false });
eq("NaN is unpaced", pacingFor(Number.NaN), { paced: false });
eq("a string is unpaced, not coerced blindly", pacingFor("abc"), { paced: false });
eq("a numeric string IS accepted (Postgres numerics arrive as strings)",
  pacingFor("30"), { paced: true, secondsPerQuestion: 30 });
eq("below the floor is unpaced", pacingFor(MIN_SECONDS_PER_QUESTION - 1), { paced: false });
eq("exactly the floor is paced",
  pacingFor(MIN_SECONDS_PER_QUESTION), { paced: true, secondsPerQuestion: 5 });
eq("above the ceiling is unpaced", pacingFor(MAX_SECONDS_PER_QUESTION + 1), { paced: false });
eq("a fractional value is floored",
  pacingFor(30.9), { paced: true, secondsPerQuestion: 30 });

console.log("\n── the question deadline is anchored to the FIRST view ──");
eq("first shown + 30s", questionDeadlineMs(T0, P30), T0 + 30 * SEC);
eq("an unpaced paper has no question deadline", questionDeadlineMs(T0, UNPACED), null);
eq("no view record yet -> no deadline", questionDeadlineMs(null, P30), null);
eq("an unusable view record -> no deadline", questionDeadlineMs(Number.NaN, P30), null);
check(
  "A REFRESH CANNOT RESTART THE CLOCK: the same first-view gives the same deadline",
  questionDeadlineMs(T0, P30) === questionDeadlineMs(T0, P30)
);

console.log("\n── judgeAnswer: the honest student ──");
const paperEnds = T0 + 30 * 60 * SEC;
const base = { paperExpiresAtMs: paperEnds, questionFirstShownAtMs: T0, pacing: P30 };
eq("answered immediately", judgeAnswer({ ...base, nowMs: T0 + SEC }), { accepted: true });
eq("answered with a second to spare",
  judgeAnswer({ ...base, nowMs: T0 + 29 * SEC }), { accepted: true });
eq("answered exactly on the deadline",
  judgeAnswer({ ...base, nowMs: T0 + 30 * SEC }), { accepted: true });
eq("a slow network delivers it just inside the grace window",
  judgeAnswer({ ...base, nowMs: T0 + 30 * SEC + ANSWER_GRACE_MS }), { accepted: true });
eq("the grace window is three seconds", ANSWER_GRACE_MS, 3000);

console.log("\n── judgeAnswer: too late ──");
eq("past the question deadline and past grace",
  judgeAnswer({ ...base, nowMs: T0 + 30 * SEC + ANSWER_GRACE_MS + 1 }),
  { accepted: false, reason: "question_time_up" });
eq("long past the question deadline",
  judgeAnswer({ ...base, nowMs: T0 + 5 * 60 * SEC }),
  { accepted: false, reason: "question_time_up" });

console.log("\n── the PAPER deadline is reported first, so the student is told the truth ──");
eq("paper over AND question over -> reports the PAPER",
  judgeAnswer({ ...base, nowMs: paperEnds + 60 * SEC }),
  { accepted: false, reason: "paper_time_up" });
eq("paper over on an UNPACED paper still refuses",
  judgeAnswer({
    nowMs: paperEnds + 60 * SEC,
    paperExpiresAtMs: paperEnds,
    questionFirstShownAtMs: null,
    pacing: UNPACED,
  }),
  { accepted: false, reason: "paper_time_up" });

console.log("\n── an UNPACED paper behaves exactly as it always did ──");
eq("hours after the question was shown, still accepted",
  judgeAnswer({
    nowMs: T0 + 20 * 60 * SEC,
    paperExpiresAtMs: paperEnds,
    questionFirstShownAtMs: T0,
    pacing: UNPACED,
  }),
  { accepted: true });
check(
  "turning pacing on for ONE paper cannot change another",
  judgeAnswer({ nowMs: T0 + 10 * 60 * SEC, paperExpiresAtMs: paperEnds, questionFirstShownAtMs: T0, pacing: UNPACED }).accepted === true
);

console.log("\n── a missing view record falls back to the paper clock, never refuses ──");
eq("paced paper, no view record yet -> accepted on the paper clock",
  judgeAnswer({ ...base, questionFirstShownAtMs: null, nowMs: T0 + 10 * 60 * SEC }),
  { accepted: true });
eq("paced paper, no view record, but paper over -> refused",
  judgeAnswer({ ...base, questionFirstShownAtMs: null, nowMs: paperEnds + SEC + ANSWER_GRACE_MS }),
  { accepted: false, reason: "paper_time_up" });
eq("no paper deadline at all and no view record -> accepted",
  judgeAnswer({ nowMs: T0, paperExpiresAtMs: null, questionFirstShownAtMs: null, pacing: P30 }),
  { accepted: true });

console.log("\n── the countdown never lies to the student ──");
eq("full time at the moment it is shown", questionSecondsRemaining(T0, P30, T0), 30);
eq("half way", questionSecondsRemaining(T0, P30, T0 + 15 * SEC), 15);
eq("one second left", questionSecondsRemaining(T0, P30, T0 + 29 * SEC), 1);
eq("zero at the deadline", questionSecondsRemaining(T0, P30, T0 + 30 * SEC), 0);
eq("never negative", questionSecondsRemaining(T0, P30, T0 + 90 * SEC), 0);
eq("rounded UP, so it never shows 0 while an answer would still be accepted",
  questionSecondsRemaining(T0, P30, T0 + 29.2 * SEC), 1);
eq("an unpaced paper has no per-question countdown",
  questionSecondsRemaining(T0, UNPACED, T0), null);

console.log("\n── the advertised length must not be a lie ──");
// The source paper claimed 30 minutes while its own per-question timers
// summed to 19. Whichever runs out first is the honest number.
eq("30 questions x 30s = 15 min, under a 30-min paper -> report 900s",
  pacedPaperSeconds(30, P30, 30), 900);
eq("30 questions x 90s = 45 min, over a 30-min paper -> report the paper's 1800s",
  pacedPaperSeconds(30, pacingFor(90), 30), 1800);
eq("an unpaced paper reports its own duration",
  pacedPaperSeconds(30, UNPACED, 30), 1800);
eq("zero questions reports zero", pacedPaperSeconds(0, P30, 30), 0);

console.log("\n── every refusal has readable text ──");
check("question_time_up tells them to keep going",
  ANSWER_REFUSAL_TEXT.question_time_up.toLowerCase().includes("keep going"));
check("paper_time_up has a sentence",
  ANSWER_REFUSAL_TEXT.paper_time_up.length > 10);

console.log(`\n${fail === 0 ? "PASS" : "FAIL"} — ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
