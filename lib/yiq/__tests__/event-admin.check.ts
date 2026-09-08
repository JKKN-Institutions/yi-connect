/**
 * YIQ event-admin checks.
 *
 * This repo has NO test runner installed (no vitest, no jest), so this is a
 * standalone script rather than a spec file:
 *
 *     npx tsx lib/yiq/__tests__/event-admin.check.ts
 *
 * It exits non-zero on any failure. The two rules under test decide who
 * qualifies for a chapter final and who is thrown out of one, so every branch
 * is exercised — including the ones that must DENY.
 */
import {
  canEditQualifyingCount,
  validateQualifyingCount,
  validateDisqualifyReason,
  reinstatementStatus,
  isChapterEventStatus,
  QUALIFYING_COUNT_MIN,
  QUALIFYING_COUNT_MAX,
  DISQUALIFY_REASON_MIN,
  DISQUALIFY_REASON_MAX,
} from "../event-admin";
import { CHAPTER_EVENT_STATUSES } from "../constants";

let pass = 0,
  fail = 0;
function check(name: string, cond: boolean, detail = "") {
  if (cond) {
    pass++;
    console.log(`  ✓ ${name}`);
  } else {
    fail++;
    console.log(`  ✗ ${name} ${detail}`);
  }
}
function eq(name: string, a: unknown, b: unknown) {
  check(
    name,
    JSON.stringify(a) === JSON.stringify(b),
    `got ${JSON.stringify(a)} want ${JSON.stringify(b)}`
  );
}

const ORGANISER = false;
const NATIONAL = true;

console.log("\n── qualifying count: the organiser, before the round opens ──");
for (const s of ["draft", "registration_open", "registration_closed"]) {
  const lock = canEditQualifyingCount(s, ORGANISER);
  eq(`organiser CAN edit in ${s}`, lock.allowed, true);
  eq(`  reason in ${s}`, lock.reason, "before_online_round");
}

console.log("\n── qualifying count: the organiser, once the round is live ──");
for (const s of [
  "online_round_live",
  "online_round_closed",
  "finals_scheduled",
  "finals_live",
  "finals_complete",
]) {
  const lock = canEditQualifyingCount(s, ORGANISER);
  eq(`organiser CANNOT edit in ${s}`, lock.allowed, false);
  eq(`  reason in ${s}`, lock.reason, "round_already_open");
  check(
    `  ${s} denial names the stage`,
    lock.message.length > 20 && /national/i.test(lock.message)
  );
}

console.log("\n── qualifying count: national overrides at every stage ──");
// Enumerated from the constant itself, so a new status can never quietly
// escape this test.
eq("all eight ladder statuses are covered", CHAPTER_EVENT_STATUSES.length, 8);
for (const s of CHAPTER_EVENT_STATUSES) {
  const lock = canEditQualifyingCount(s, NATIONAL);
  eq(`national CAN edit in ${s}`, lock.allowed, true);
  eq(`  reason in ${s}`, lock.reason, "national_override");
}

console.log("\n── qualifying count: fail closed on a status we do not know ──");
for (const bad of ["", "  ", "ONLINE_ROUND_LIVE", "archived", "null"]) {
  eq(
    `organiser denied on "${bad}"`,
    canEditQualifyingCount(bad, ORGANISER).allowed,
    false
  );
  eq(
    `national denied on "${bad}"`,
    canEditQualifyingCount(bad, NATIONAL).allowed,
    false
  );
  eq(
    `  reason on "${bad}"`,
    canEditQualifyingCount(bad, NATIONAL).reason,
    "unknown_status"
  );
}
eq(
  "an unknown status never reads as national_override",
  canEditQualifyingCount("whatever", NATIONAL).reason === "national_override",
  false
);

console.log("\n── isChapterEventStatus ──");
eq("draft is a status", isChapterEventStatus("draft"), true);
eq("a number is not", isChapterEventStatus(3), false);
eq("null is not", isChapterEventStatus(null), false);
eq("undefined is not", isChapterEventStatus(undefined), false);

console.log("\n── validateQualifyingCount: the DB CHECK is 2..50 ──");
eq("min is 2", QUALIFYING_COUNT_MIN, 2);
eq("max is 50", QUALIFYING_COUNT_MAX, 50);
eq("1 is rejected", validateQualifyingCount(1).ok, false);
eq("2 is accepted", validateQualifyingCount(2), { ok: true, value: 2 });
eq("10 (the default) is accepted", validateQualifyingCount(10), {
  ok: true,
  value: 10,
});
eq("50 is accepted", validateQualifyingCount(50), { ok: true, value: 50 });
eq("51 is rejected", validateQualifyingCount(51).ok, false);
eq("0 is rejected", validateQualifyingCount(0).ok, false);
eq("-1 is rejected", validateQualifyingCount(-1).ok, false);
eq("NaN is rejected", validateQualifyingCount(NaN).ok, false);
eq("Infinity is rejected", validateQualifyingCount(Infinity).ok, false);
eq("2.5 is rejected", validateQualifyingCount(2.5).ok, false);
eq("9.999 is rejected", validateQualifyingCount(9.999).ok, false);
eq("null is rejected", validateQualifyingCount(null).ok, false);
eq("undefined is rejected", validateQualifyingCount(undefined).ok, false);
eq("an empty string is rejected", validateQualifyingCount("").ok, false);
eq("'abc' is rejected", validateQualifyingCount("abc").ok, false);
eq("a form's '12' is read as 12", validateQualifyingCount("12"), {
  ok: true,
  value: 12,
});
eq("a form's ' 7 ' is read as 7", validateQualifyingCount(" 7 "), {
  ok: true,
  value: 7,
});
eq("'7.5' from a form is rejected", validateQualifyingCount("7.5").ok, false);
check(
  "the out-of-range error names the range",
  validateQualifyingCount(99).ok === false &&
    /2 and 50/.test(
      (validateQualifyingCount(99) as { ok: false; error: string }).error
    )
);

console.log("\n── validateDisqualifyReason: a reason, not a keystroke ──");
eq("min length is 6", DISQUALIFY_REASON_MIN, 6);
eq("an empty reason is rejected", validateDisqualifyReason("").ok, false);
eq("whitespace only is rejected", validateDisqualifyReason("   ").ok, false);
eq("a tab/newline only is rejected", validateDisqualifyReason("\t\n ").ok, false);
eq("one character is rejected", validateDisqualifyReason("x").ok, false);
eq("one character padded is rejected", validateDisqualifyReason("  x  ").ok, false);
eq("five characters is rejected", validateDisqualifyReason("cheat").ok, false);
eq("null is rejected", validateDisqualifyReason(null).ok, false);
eq("a number is rejected", validateDisqualifyReason(42).ok, false);
eq("six characters is accepted", validateDisqualifyReason("cheats"), {
  ok: true,
  value: "cheats",
});
eq(
  "a real reason is accepted and trimmed",
  validateDisqualifyReason("  Two students used a second device.  "),
  { ok: true, value: "Two students used a second device." }
);
eq(
  "a reason longer than the cap is rejected",
  validateDisqualifyReason("x".repeat(DISQUALIFY_REASON_MAX + 1)).ok,
  false
);
eq(
  "a reason exactly at the cap is accepted",
  validateDisqualifyReason("y".repeat(DISQUALIFY_REASON_MAX)).ok,
  true
);

console.log("\n── reinstatementStatus: an undo restores what was there ──");
eq("a qualified team goes back to qualified", reinstatementStatus("qualified"), "qualified");
eq("an eliminated team goes back to eliminated", reinstatementStatus("eliminated"), "eliminated");
eq("a confirmed team goes back to confirmed", reinstatementStatus("confirmed"), "confirmed");
eq("a withdrawn team stays withdrawn, not un-withdrawn", reinstatementStatus("withdrawn"), "withdrawn");
eq("a champion goes back to champion", reinstatementStatus("champion"), "champion");
eq("nothing recorded falls back to registered", reinstatementStatus(null), "registered");
eq("undefined falls back to registered", reinstatementStatus(undefined), "registered");
eq("garbage falls back to registered", reinstatementStatus("banana"), "registered");
eq(
  "an undo can never restore 'disqualified'",
  reinstatementStatus("disqualified"),
  "registered"
);

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail === 0 ? 0 : 1);
