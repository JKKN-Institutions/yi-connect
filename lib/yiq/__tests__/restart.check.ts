/**
 * YIQ restart checks.
 *
 * This repo has NO test runner installed (no vitest, no jest), so this is a
 * standalone script rather than a spec file:
 *
 *     npx tsx lib/yiq/__tests__/restart.check.ts
 *
 * It exits non-zero on any failure. What is under test decides whether a
 * student in a scored national competition gets a second sitting and how much
 * time they get, so every rule here is one a wrong answer would be arguable
 * about afterwards.
 */
import {
  canRestart,
  clampGrantedMs,
  computeDurationMs,
  computeRemainingMs,
  formatDuration,
  restartTimestamps,
  validateReason,
  MAX_RESTART_MS,
  type RestartAttempt,
} from "../restart";

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

const MIN = 60 * 1000;
const T0 = Date.parse("2026-09-12T10:00:00.000Z");
const iso = (ms: number) => new Date(ms).toISOString();

/**
 * A 30-minute paper whose student stopped answering 12 minutes in.
 *
 * NOTE THE DEFAULT `submittedAt`: it is the DEADLINE, not the stop point.
 * That is what really happens — `auto_submitted` is only ever stamped at or
 * after `expires_at`, by the sweeper or by the late-start guard. Building
 * the fixture any other way would hide the exact bug this suite now guards.
 */
function attempt(over: Partial<RestartAttempt> = {}): RestartAttempt {
  return {
    id: "a1",
    isMock: false,
    status: "auto_submitted",
    startedAt: iso(T0),
    expiresAt: iso(T0 + 30 * MIN),
    submittedAt: iso(T0 + 30 * MIN),
    lastAnsweredAt: iso(T0 + 12 * MIN),
    ...over,
  };
}

const ok = { alreadyRestarted: false };

console.log("\n── computeRemainingMs ──");
eq("30-min paper, last answer at 12 min -> 18 min left", computeRemainingMs(attempt()), 18 * MIN);
eq(
  "last answer on the deadline -> 0",
  computeRemainingMs(attempt({ lastAnsweredAt: iso(T0 + 30 * MIN) })),
  0
);
eq(
  "an answer recorded AFTER the deadline -> 0, never negative",
  computeRemainingMs(attempt({ lastAnsweredAt: iso(T0 + 47 * MIN) })),
  0
);
eq(
  "last answer one second in -> the rest of the paper",
  computeRemainingMs(attempt({ lastAnsweredAt: iso(T0 + 1000) })),
  30 * MIN - 1000
);
eq(
  "sub-second precision is floored to whole seconds",
  computeRemainingMs(attempt({ lastAnsweredAt: iso(T0 + 12 * MIN + 400) })),
  18 * MIN - 1000
);
eq(
  "answered NOTHING -> the whole paper is owed, measured from the start",
  computeRemainingMs(attempt({ lastAnsweredAt: null })),
  30 * MIN
);

console.log("\n── THE REGRESSION: submitted_at must not be the clock ──");
// This is the bug that made the entire feature dead on arrival. Every
// auto_submitted row has submitted_at >= expires_at, so a computation based
// on it returned 0 for EVERY student, including the dead phone this feature
// exists for. If any of these three go back to 0, the feature is dead again.
eq(
  "phone dies at 12 min, sweeper stamps 35 min later -> still 18 min owed",
  computeRemainingMs(
    attempt({ submittedAt: iso(T0 + 65 * MIN), lastAnsweredAt: iso(T0 + 12 * MIN) })
  ),
  18 * MIN
);
eq(
  "phone dies at 2 min, sweeper stamps at the deadline -> 28 min owed",
  computeRemainingMs(
    attempt({ submittedAt: iso(T0 + 30 * MIN), lastAnsweredAt: iso(T0 + 2 * MIN) })
  ),
  28 * MIN
);
check(
  "a dead-phone paper is ALLOWED, not refused as no_time_left",
  canRestart(
    attempt({ submittedAt: iso(T0 + 65 * MIN), lastAnsweredAt: iso(T0 + 12 * MIN) }),
    ok
  ).ok === true
);
eq("full paper length", computeDurationMs(attempt()), 30 * MIN);

console.log("\n── computeRemainingMs: fail closed ──");
eq("missing submitted_at -> null, not a full paper", computeRemainingMs(attempt({ submittedAt: null })), null);
eq("undefined submitted_at -> null", computeRemainingMs(attempt({ submittedAt: undefined })), null);
eq("empty-string submitted_at -> null", computeRemainingMs(attempt({ submittedAt: "   " })), null);
eq("unparseable submitted_at -> null", computeRemainingMs(attempt({ submittedAt: "yesterday" })), null);
eq("missing started_at -> null", computeRemainingMs(attempt({ startedAt: null })), null);
eq("missing expires_at -> null", computeRemainingMs(attempt({ expiresAt: null })), null);
eq(
  "deadline before the start -> null",
  computeRemainingMs(attempt({ expiresAt: iso(T0 - MIN) })),
  null
);
eq(
  "deadline equal to the start -> null",
  computeRemainingMs(attempt({ expiresAt: iso(T0) })),
  null
);
eq(
  "an answer recorded before the paper started -> null, not a full paper",
  computeRemainingMs(attempt({ lastAnsweredAt: iso(T0 - MIN) })),
  null
);
eq(
  "an unparseable last answer falls back to the start, not to NaN",
  computeRemainingMs(attempt({ lastAnsweredAt: "yesterday" })),
  30 * MIN
);
eq("no wall-clock input: repeat reads are identical", computeRemainingMs(attempt()), computeRemainingMs(attempt()));

console.log("\n── the clamp ──");
eq("ordinary case passes through", clampGrantedMs(18 * MIN, 30 * MIN), 18 * MIN);
eq("never more than the paper itself", clampGrantedMs(90 * MIN, 30 * MIN), 30 * MIN);
eq("never more than the platform ceiling", clampGrantedMs(999 * MIN, 999 * MIN), MAX_RESTART_MS);
eq("ceiling is 240 minutes", MAX_RESTART_MS, 240 * MIN);
eq("zero stays zero", clampGrantedMs(0, 30 * MIN), 0);
eq("negative is floored to zero, never handed back", clampGrantedMs(-5 * MIN, 30 * MIN), 0);
eq("fractions of a second are dropped", clampGrantedMs(1500, 30 * MIN), 1000);

console.log("\n── canRestart: the yes ──");
const yes = canRestart(attempt(), ok);
eq("an auto_submitted paper with time left is restartable", yes.ok, true);
if (yes.ok) {
  eq("  grants exactly the time that was left", yes.grantedMs, 18 * MIN);
  eq("  and records the time actually used", yes.usedMs, 12 * MIN);
  eq("  and the original paper length", yes.durationMs, 30 * MIN);
}

console.log("\n── canRestart: the refusals ──");
function refusal(name: string, a: RestartAttempt, opts = ok, want?: string) {
  const d = canRestart(a, opts);
  check(
    name,
    d.ok === false && (want === undefined || d.reason === want),
    d.ok ? "was ALLOWED" : `reason ${d.reason} want ${want}`
  );
}
refusal(
  "a student who answered right up to the deadline is refused",
  attempt({ lastAnsweredAt: iso(T0 + 30 * MIN) }),
  ok,
  "no_time_left"
);
refusal(
  "an answer timestamped after the deadline is refused",
  attempt({ lastAnsweredAt: iso(T0 + 44 * MIN) }),
  ok,
  "no_time_left"
);
refusal("a SUBMITTED paper is never resurrected", attempt({ status: "submitted" }), ok, "submitted_deliberately");
refusal("an IN_PROGRESS paper is refused", attempt({ status: "in_progress" }), ok, "not_finished");
refusal(
  "an in_progress paper past its deadline is STILL refused",
  attempt({ status: "in_progress", submittedAt: null }),
  ok,
  "not_finished"
);
refusal("a disqualified paper is refused", attempt({ status: "disqualified" }), ok, "disqualified");
refusal("an unrecognised status is refused", attempt({ status: "abandoned" }), ok, "unknown_status");
refusal("a practice paper is refused", attempt({ isMock: true }), ok, "mock_attempt");
refusal(
  "a SECOND restart is refused",
  attempt(),
  { alreadyRestarted: true },
  "already_restarted"
);
refusal(
  "already-restarted beats every other yes",
  attempt({ lastAnsweredAt: iso(T0 + 1000) }),
  { alreadyRestarted: true },
  "already_restarted"
);
refusal("missing timestamps refuse", attempt({ submittedAt: null }), ok, "malformed_timestamps");
refusal("malformed timestamps refuse", attempt({ expiresAt: "not-a-date" }), ok, "malformed_timestamps");
refusal(
  "an answer before the start refuses rather than granting a whole paper",
  attempt({ lastAnsweredAt: iso(T0 - 1) }),
  ok,
  "malformed_timestamps"
);
refusal(
  "a paper with less than a second left is refused",
  attempt({ lastAnsweredAt: iso(T0 + 30 * MIN - 400) }),
  ok,
  "no_time_left"
);

console.log("\n── restartTimestamps ──");
const RESUME = Date.parse("2026-09-12T18:30:00.000Z"); // hours later, charger found
const d = canRestart(attempt(), ok);
if (!d.ok) {
  check("decision was ok", false, d.reason);
} else {
  const t = restartTimestamps(d, RESUME);
  eq("new deadline is NOW + the time that was left", t.expiresAt, iso(RESUME + 18 * MIN));
  eq("start is shifted forward by the time already used", t.startedAt, iso(RESUME - 12 * MIN));
  eq(
    "so the paper is still exactly 30 minutes long",
    Date.parse(t.expiresAt) - Date.parse(t.startedAt),
    30 * MIN
  );
  check(
    "the dead-phone hours are NOT counted as answering time (tie-break stays honest)",
    Date.parse(t.startedAt) > T0 + 12 * MIN,
    "started_at was not shifted"
  );
}

console.log("\n── reason text ──");
eq("empty reason is rejected", validateReason("") === null, false);
eq("a one-word reason is rejected", validateReason("phone") === null, false);
eq("whitespace padding does not buy length", validateReason("   phone     ") === null, false);
eq(
  "a real sentence is accepted",
  validateReason("Phone battery died at 12 minutes, verified by the invigilator."),
  null
);
eq("an essay is rejected", validateReason("x".repeat(501)) === null, false);
eq("exactly 500 characters is accepted", validateReason("x".repeat(500)), null);

console.log("\n── formatDuration ──");
eq("minutes and seconds", formatDuration(18 * MIN + 20_000), "18 min 20 sec");
eq("whole minutes", formatDuration(18 * MIN), "18 min");
eq("under a minute", formatDuration(45_000), "45 sec");
eq("zero", formatDuration(0), "0 sec");
eq("negative never prints a minus", formatDuration(-5000), "0 sec");

console.log(`\n${fail === 0 ? "PASS" : "FAIL"} — ${pass} passed, ${fail} failed\n`);
process.exit(fail === 0 ? 0 : 1);
