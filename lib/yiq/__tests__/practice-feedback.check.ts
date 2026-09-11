/**
 * YIQ practice-feedback gate checks.
 *
 *     npx tsx lib/yiq/__tests__/practice-feedback.check.ts
 *
 * This gate decides whether the correct answer may be handed to a student
 * MID-PAPER. On a practice deck that is the whole point. On the scored
 * September round it would leak the answer key one tap at a time and destroy
 * the competition nationally — there is no partial version of that failure.
 *
 * So every way in is asserted, and every near-miss is asserted to DENY.
 */
import {
  canRevealNow,
  nextStreak,
  streakLabel,
  type FeedbackAttempt,
  type FeedbackRefusal,
} from "../practice-feedback";

let pass = 0, fail = 0;
function check(name: string, cond: boolean, detail = "") {
  if (cond) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; console.log(`  ✗ ${name} ${detail}`); }
}
function eq(name: string, a: unknown, b: unknown) {
  check(name, JSON.stringify(a) === JSON.stringify(b),
    `got ${JSON.stringify(a)} want ${JSON.stringify(b)}`);
}

const ME = "student-1";
function attempt(over: Partial<FeedbackAttempt> = {}): FeedbackAttempt {
  return { id: "a1", studentId: ME, isMock: true, status: "in_progress", ...over };
}
function denies(name: string, over: Partial<FeedbackAttempt>, want: FeedbackRefusal, viewer = ME) {
  const d = canRevealNow(attempt(over), viewer);
  check(name, d.ok === false && d.reason === want,
    d.ok ? "ALLOWED — this would leak the answer key" : `reason ${d.reason} want ${want}`);
}

console.log("\n── the one case that is allowed ──");
check("my own practice paper, still open", canRevealNow(attempt(), ME).ok === true);

console.log("\n── A SCORED PAPER IS NEVER REVEALED ──");
denies("is_mock false", { isMock: false }, "not_practice");
denies("is_mock null (a missing column reads like this)", { isMock: null }, "not_practice");
denies("is_mock undefined", { isMock: undefined }, "not_practice");
denies("is_mock the STRING 'true' — truthy, but not true", { isMock: "true" }, "not_practice");
denies("is_mock the string 'false' — truthy!", { isMock: "false" }, "not_practice");
denies("is_mock the number 1 — truthy", { isMock: 1 }, "not_practice");
denies("is_mock an empty object — truthy", { isMock: {} }, "not_practice");
check(
  "EXACTLY true is required, so every truthy near-miss above denies",
  canRevealNow(attempt({ isMock: "true" }), ME).ok === false &&
    canRevealNow(attempt({ isMock: 1 }), ME).ok === false
);

console.log("\n── somebody else's paper ──");
denies("a different student's practice paper", {}, "not_your_paper", "student-2");
denies("an empty viewer id", {}, "not_your_paper", "");
check(
  "not-practice is reported BEFORE not-yours, so a scored paper never even compares ids",
  (() => {
    const d = canRevealNow(attempt({ isMock: false }), "student-2");
    return !d.ok && d.reason === "not_practice";
  })()
);

console.log("\n── a finished paper goes through the audited review path ──");
denies("submitted", { status: "submitted" }, "not_in_progress");
denies("auto_submitted", { status: "auto_submitted" }, "not_in_progress");
denies("disqualified", { status: "disqualified" }, "not_in_progress");

console.log("\n── anything unrecognised denies ──");
denies("a status this file has never seen", { status: "abandoned" }, "unknown_status");
denies("a null status", { status: null }, "unknown_status");
denies("an undefined status", { status: undefined }, "unknown_status");
denies("an empty status", { status: "" }, "unknown_status");

console.log("\n── the streak ──");
eq("a correct answer adds one", nextStreak(4, true), 5);
eq("a wrong answer resets to zero", nextStreak(9, false), 0);
eq("from zero", nextStreak(0, true), 1);
eq("a negative current is treated as zero", nextStreak(-3, true), 1);
eq("a non-finite current is treated as zero", nextStreak(Number.NaN, true), 1);
eq("a fractional current is floored", nextStreak(4.9, true), 5);
eq("wrong from zero stays zero", nextStreak(0, false), 0);

console.log("\n── the streak line stays quiet until it means something ──");
eq("silent at zero", streakLabel(0), null);
eq("silent at one", streakLabel(1), null);
eq("silent at two — celebrating this would be embarrassing", streakLabel(2), null);
check("speaks at three", typeof streakLabel(3) === "string");
eq("three in a row", streakLabel(3), "3 in a row");
check("changes wording at five", streakLabel(5) !== streakLabel(4));
check("changes again at ten", streakLabel(10) !== streakLabel(9));
check("changes again at twenty", streakLabel(20) !== streakLabel(19));
eq("a non-finite streak says nothing", streakLabel(Number.NaN), null);

console.log(`\n${fail === 0 ? "PASS" : "FAIL"} — ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
