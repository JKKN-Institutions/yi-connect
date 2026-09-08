/**
 * YIQ round-lifecycle checks.
 *
 * This repo has NO test runner installed (no vitest, no jest), so this is a
 * standalone script rather than a spec file:
 *
 *     npx tsx lib/yiq/__tests__/lifecycle.check.ts
 *
 * It exits non-zero on any failure, so it can be wired into CI as-is.
 *
 * These rules decide when 65 chapters open registration and, more sharply,
 * when a live paper stops accepting answers. A wrong "yes" here closes a round
 * under a student who is mid-question, so most of what follows is testing the
 * refusals: nothing fires early, nothing skips a step, nothing moves backwards,
 * nothing the calendar cannot read moves at all.
 */
import {
  dueTransition,
  groupTransitions,
  parseWindowTs,
  planEdition,
  planTransition,
  resolveWindow,
  type LifecycleEdition,
  type LifecycleEvent,
} from "../lifecycle";

let pass = 0, fail = 0;
function check(name: string, cond: boolean, detail = "") {
  if (cond) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; console.log(`  ✗ ${name} ${detail}`); }
}
function eq(name: string, a: unknown, b: unknown) {
  check(name, JSON.stringify(a) === JSON.stringify(b), `got ${JSON.stringify(a)} want ${JSON.stringify(b)}`);
}

// The live YIQ 2026-27 edition windows, read from production.
const EDITION: LifecycleEdition = {
  id: "ed-2026",
  registration_opens_at: "2026-06-30T18:30:00+00:00",
  registration_closes_at: "2026-09-15T18:29:59+00:00",
  online_round_opens_at: "2026-09-19T18:30:00+00:00",
  online_round_closes_at: "2026-10-31T18:29:59+00:00",
};

const REG_OPEN = Date.parse(EDITION.registration_opens_at!);
const REG_CLOSE = Date.parse(EDITION.registration_closes_at!);
const ROUND_OPEN = Date.parse(EDITION.online_round_opens_at!);
const ROUND_CLOSE = Date.parse(EDITION.online_round_closes_at!);

/** An event that inherits every window from the edition. */
function ev(status: string, over: Partial<LifecycleEvent> = {}): LifecycleEvent {
  return {
    id: over.id ?? "e1",
    chapter_name: over.chapter_name ?? "Erode",
    status,
    registration_opens_at: null,
    registration_closes_at: null,
    online_round_opens_at: null,
    online_round_closes_at: null,
    ...over,
  };
}

console.log("\n── parseWindowTs ──");
eq("ISO with offset parses", parseWindowTs("2026-09-19T18:30:00+00:00"), ROUND_OPEN);
eq("psql space form parses too", parseWindowTs("2026-09-19 18:30:00+00"), ROUND_OPEN);
eq("psql half-hour offset parses", parseWindowTs("2026-09-20 00:00:00+05:30"), ROUND_OPEN);
eq("a bare date is not mangled into an offset",
   parseWindowTs("2026-09-19"), Date.parse("2026-09-19"));
eq("null -> null", parseWindowTs(null), null);
eq("undefined -> null", parseWindowTs(undefined), null);
eq("blank -> null", parseWindowTs("   "), null);
eq("garbage -> null", parseWindowTs("not-a-date"), null);
eq("half a date -> null", parseWindowTs("2026-13-45T99:99:99Z"), null);
eq("a number is not a timestamp", parseWindowTs(1234 as unknown as string), null);

console.log("\n── resolveWindow ──");
eq("no override falls back to the edition",
   resolveWindow(ev("draft"), EDITION, "registration_closes_at"),
   { ms: REG_CLOSE, raw: EDITION.registration_closes_at, source: "edition" });

const overridden = ev("registration_open", {
  registration_closes_at: "2026-08-01T00:00:00+00:00",
});
eq("event override beats the edition",
   resolveWindow(overridden, EDITION, "registration_closes_at"),
   { ms: Date.parse("2026-08-01T00:00:00+00:00"), raw: "2026-08-01T00:00:00+00:00", source: "event" });

eq("no window anywhere -> null",
   resolveWindow(ev("draft"), { id: "bare" }, "online_round_closes_at"), null);
eq("no edition at all -> null",
   resolveWindow(ev("draft"), null, "registration_opens_at"), null);

// A malformed override must NOT quietly fall through to the edition: the
// organiser said something about this window and we cannot read it, so we
// refuse to apply a date they did not choose.
eq("malformed override does not fall back to the edition",
   resolveWindow(ev("registration_open", { registration_closes_at: "soon" }), EDITION, "registration_closes_at"),
   null);
eq("blank override is treated as 'inherit', not as malformed",
   resolveWindow(ev("registration_open", { registration_closes_at: "  " }), EDITION, "registration_closes_at")?.source,
   "edition");

console.log("\n── each rung fires exactly at its boundary ──");
eq("draft → registration_open at the instant it opens",
   dueTransition(ev("draft"), EDITION, REG_OPEN), "registration_open");
eq("registration_open → registration_closed at the instant it closes",
   dueTransition(ev("registration_open"), EDITION, REG_CLOSE), "registration_closed");
eq("registration_closed → online_round_live at the instant the round opens",
   dueTransition(ev("registration_closed"), EDITION, ROUND_OPEN), "online_round_live");
eq("online_round_live → online_round_closed at the instant the round closes",
   dueTransition(ev("online_round_live"), EDITION, ROUND_CLOSE), "online_round_closed");

console.log("\n── nothing fires one millisecond early ──");
eq("draft holds at opens_at - 1ms",
   dueTransition(ev("draft"), EDITION, REG_OPEN - 1), null);
eq("registration_open holds at closes_at - 1ms",
   dueTransition(ev("registration_open"), EDITION, REG_CLOSE - 1), null);
eq("registration_closed holds at round opens_at - 1ms",
   dueTransition(ev("registration_closed"), EDITION, ROUND_OPEN - 1), null);
eq("a LIVE round holds at closes_at - 1ms (nobody is cut off early)",
   dueTransition(ev("online_round_live"), EDITION, ROUND_CLOSE - 1), null);

console.log("\n── a rung is never skipped ──");
// The forgotten chapter: still 'draft' long after the whole calendar ran out.
const forgotten = ev("draft", { id: "forgotten", chapter_name: "Salem" });
const forgottenPlan = planTransition(forgotten, EDITION, ROUND_CLOSE + 60_000);
eq("a draft event whose round window has passed does NOT jump", forgottenPlan.kind, "attention");
eq("  ...and dueTransition returns nothing to write",
   dueTransition(forgotten, EDITION, ROUND_CLOSE + 60_000), null);
eq("  ...it is never moved to online_round_closed",
   forgottenPlan.kind === "attention" ? forgottenPlan.clockSays : null, "online_round_closed");
eq("  ...and reports how far behind it is",
   forgottenPlan.kind === "attention" ? forgottenPlan.rungsBehind : 0, 4);

// Two rungs due is already too many: registration would be opened after the
// date it was meant to close.
eq("two rungs due is refused, not applied one at a time",
   planTransition(ev("draft"), EDITION, REG_CLOSE).kind, "attention");
eq("exactly one rung due is applied",
   planTransition(ev("draft"), EDITION, REG_CLOSE - 1).kind, "transition");

console.log("\n── nothing ever moves backwards ──");
eq("a live round is not dragged back to registration",
   dueTransition(ev("online_round_live"), EDITION, REG_CLOSE + 1000), null);
eq("a closed round is not re-opened while the round window is still open",
   dueTransition(ev("online_round_closed"), EDITION, ROUND_OPEN + 1000), null);
eq("registration_closed is not re-opened after opens_at",
   dueTransition(ev("registration_closed"), EDITION, REG_OPEN + 1000), null);
eq("online_round_closed is terminal for the clock — finals are a human's call",
   dueTransition(ev("online_round_closed"), EDITION, ROUND_CLOSE + 86_400_000), null);

console.log("\n── finals stages are never touched ──");
for (const s of ["finals_scheduled", "finals_live", "finals_complete"]) {
  const p = planTransition(ev(s), EDITION, ROUND_CLOSE + 86_400_000);
  eq(`${s} is left alone`, p.kind, "none");
  eq(`  ${s} yields no status to write`, dueTransition(ev(s), EDITION, ROUND_CLOSE + 86_400_000), null);
}

console.log("\n── fail closed on unusable input ──");
eq("a null window never transitions",
   dueTransition(ev("registration_open"), { id: "bare" }, ROUND_CLOSE), null);
eq("a null window is reported, not guessed",
   planTransition(ev("registration_open"), { id: "bare" }, ROUND_CLOSE).kind, "none");
eq("no edition at all never transitions",
   dueTransition(ev("draft"), null, ROUND_CLOSE), null);
eq("a malformed EVENT window never transitions",
   dueTransition(ev("online_round_live", { online_round_closes_at: "31-10-2026" }), EDITION, ROUND_CLOSE + 86_400_000),
   null);
eq("a malformed EDITION window never transitions",
   dueTransition(ev("online_round_live"), { ...EDITION, online_round_closes_at: "whenever" }, ROUND_CLOSE + 86_400_000),
   null);
eq("an unreadable 'now' never transitions",
   dueTransition(ev("registration_open"), EDITION, Number.NaN), null);
eq("an unknown status is flagged, never moved",
   planTransition(ev("archived"), EDITION, ROUND_CLOSE).kind, "attention");
eq("  ...and yields no status to write",
   dueTransition(ev("archived"), EDITION, ROUND_CLOSE), null);

console.log("\n── the event override actually drives the decision ──");
// This chapter closes registration two weeks before everyone else.
const early = ev("registration_open", {
  id: "early",
  registration_closes_at: "2026-09-01T00:00:00+00:00",
});
const earlyMs = Date.parse("2026-09-01T00:00:00+00:00");
eq("closes on the event's own date, not the edition's",
   dueTransition(early, EDITION, earlyMs), "registration_closed");
eq("  ...and not a millisecond earlier", dueTransition(early, EDITION, earlyMs - 1), null);
eq("the plan records which row the window came from",
   (() => { const p = planTransition(early, EDITION, earlyMs); return p.kind === "transition" ? p.windowSource : null; })(),
   "event");
// The mirror case: an override that runs LATE keeps the round open past the
// edition's date. A shared calendar must not close someone else's paper.
const late = ev("online_round_live", {
  id: "late",
  online_round_closes_at: "2026-11-30T00:00:00+00:00",
});
eq("a later override keeps a live round open past the edition date",
   dueTransition(late, EDITION, ROUND_CLOSE + 1000), null);

console.log("\n── standings-ready flag ──");
const closing = planTransition(ev("online_round_live"), EDITION, ROUND_CLOSE);
eq("closing the round marks standings ready",
   closing.kind === "transition" ? closing.standingsReady : null, true);
const opening = planTransition(ev("registration_closed"), EDITION, ROUND_OPEN);
eq("opening the round does not",
   opening.kind === "transition" ? opening.standingsReady : null, false);

console.log("\n── planning a whole edition ──");
const fleet: LifecycleEvent[] = [
  ev("registration_open", { id: "a", chapter_name: "Erode" }),
  ev("registration_open", { id: "b", chapter_name: "Madurai" }),
  ev("draft", { id: "c", chapter_name: "Salem" }),           // behind → attention
  ev("finals_live", { id: "d", chapter_name: "Chennai" }),   // untouchable
  ev("registration_open", { id: "e", chapter_name: "Kochi", registration_closes_at: "2027-01-01T00:00:00+00:00" }), // not yet
];
const planned = planEdition(fleet, EDITION, REG_CLOSE);
eq("every event gets a plan", planned.length, 5);
eq("two chapters close registration",
   planned.filter(p => p.plan.kind === "transition").map(p => p.event.id), ["a", "b"]);
eq("the behind-schedule chapter is flagged",
   planned.filter(p => p.plan.kind === "attention").map(p => p.event.id), ["c"]);
eq("finals and not-yet-due chapters are left alone",
   planned.filter(p => p.plan.kind === "none").map(p => p.event.id), ["d", "e"]);

const groups = groupTransitions(planned);
eq("due transitions batch into one group per (from → to)", groups.length, 1);
eq("  the group carries both chapters", groups[0].eventIds, ["a", "b"]);
eq("  and its target status", groups[0].to, "registration_closed");
eq("nothing to do -> no groups",
   groupTransitions(planEdition(fleet, EDITION, REG_OPEN - 1000)).length, 0);
eq("an empty edition does not crash", planEdition([], EDITION, REG_CLOSE).length, 0);

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail === 0 ? 0 : 1);
