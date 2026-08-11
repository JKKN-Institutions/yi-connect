/**
 * Self-test for the team-invitation error contract.
 * Run ad-hoc: npx tsx lib/yi-future/__tests__/invite-error-codes.test.ts
 * (Same ad-hoc harness style as allocation.test.ts — no runner is installed.)
 *
 * WHAT THIS EXISTS TO CATCH, and why it is not testing the obvious:
 *
 * `respondInvite` now returns a `code` alongside its sentence, but the shipped
 * consumer — components/yi-future/team/PendingInviteActions.tsx — still branches
 * on the SENTENCE, via isTeamFullError() in lib/yi-future/invite-options.ts.
 * That consumer lives outside this change and was deliberately left untouched.
 * So the sentences are now a compatibility surface, and the two failure modes
 * worth a test are:
 *
 *   1. Someone rewords the "team is full" sentence. isTeamFullError() stops
 *      matching, and a student who loses the race for the last seat gets a flat
 *      red error instead of "here are your other invitations". Silent, and only
 *      visible under load. → covered below.
 *   2. Someone routes a database error back into a sentence slot and raw
 *      Postgres text reaches a 17-year-old again — the defect this change fixed.
 *      → covered below, for every message, including after humanise().
 *
 * Deliberately NOT tested here: respondInvite / unfreezeTeam themselves. They
 * need a live delegate session and a live database, and the failure paths cannot
 * be rehearsed against production without risking a real student being joined to
 * a team. The pure contract is what is testable, so the contract is what lives
 * in a pure module.
 */

import {
  humanise,
  isTeamFullError,
  looksLikeDatabaseText,
} from "../invite-options";
import {
  RESPOND_INVITE_MESSAGES,
  UNFREEZE_TEAM_MESSAGES,
  isDuplicateMembershipError,
  respondInviteError,
  unfreezeTeamError,
  type RespondInviteErrorCode,
  type UnfreezeTeamErrorCode,
} from "../invite-error-codes";

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(`ASSERT FAILED: ${msg}`);
  console.log(`  ✓ ${msg}`);
}

function test(name: string, fn: () => void) {
  console.log(`\n▶ ${name}`);
  try {
    fn();
    console.log(`  PASS`);
  } catch (e) {
    console.error(`  FAIL: ${(e as Error).message}`);
    process.exitCode = 1;
  }
}

/** Exactly what the database used to hand back to the browser. */
const RAW_DUPLICATE_TEXT =
  'duplicate key value violates unique constraint "uniq_delegate_per_edition"';
const RAW_OTHER_DB_TEXT =
  'null value in column "team_id" of relation "team_members" violates not-null constraint';

const RESPOND_CODES = Object.keys(
  RESPOND_INVITE_MESSAGES
) as RespondInviteErrorCode[];
const UNFREEZE_CODES = Object.keys(
  UNFREEZE_TEAM_MESSAGES
) as UnfreezeTeamErrorCode[];

// ── 1. The prose-matching consumer must keep working ─────────────────
test("the shipped isTeamFullError() consumer still recognises team_full", () => {
  assert(
    isTeamFullError(RESPOND_INVITE_MESSAGES.team_full),
    "isTeamFullError matches the team_full sentence (the 'here are your other options' flow still fires)"
  );

  // Prove this test can actually fail: a plausible reword goes unmatched.
  assert(
    !isTeamFullError("That team has no seats left."),
    "a reworded team-full sentence would NOT match — so test 1 is load-bearing, not decorative"
  );

  for (const code of RESPOND_CODES) {
    if (code === "team_full") continue;
    assert(
      !isTeamFullError(RESPOND_INVITE_MESSAGES[code]),
      `${code} does NOT trigger the team-full flow`
    );
  }
});

// ── 2. No student may ever see database text ─────────────────────────
test("no message is database-shaped, before or after humanise()", () => {
  for (const code of RESPOND_CODES) {
    const msg = RESPOND_INVITE_MESSAGES[code];
    assert(msg.length > 0, `${code} has a sentence`);
    assert(
      !looksLikeDatabaseText(msg),
      `${code} sentence is not database-shaped`
    );
    assert(
      !looksLikeDatabaseText(humanise(msg)),
      `${code} is still not database-shaped after humanise()`
    );
  }
  for (const code of UNFREEZE_CODES) {
    const msg = UNFREEZE_TEAM_MESSAGES[code];
    assert(msg.length > 0, `unfreeze ${code} has a sentence`);
    assert(
      !looksLikeDatabaseText(msg),
      `unfreeze ${code} sentence is not database-shaped`
    );
  }

  // The two strings that used to be returned verbatim ARE caught by the
  // detector — confirming the detector is what makes the checks above mean
  // something.
  assert(
    looksLikeDatabaseText(RAW_DUPLICATE_TEXT),
    "the old duplicate-key text IS recognised as database text"
  );
  assert(
    looksLikeDatabaseText(RAW_OTHER_DB_TEXT),
    "the old not-null-violation text IS recognised as database text"
  );
});

// ── 3. What the student reads has not changed ────────────────────────
test("the replacement sentences match what humanise() already produced", () => {
  assert(
    RESPOND_INVITE_MESSAGES.already_on_team === humanise(RAW_DUPLICATE_TEXT),
    "already_on_team is byte-identical to humanise(old raw duplicate-key text)"
  );
  assert(
    RESPOND_INVITE_MESSAGES.unexpected === humanise(RAW_OTHER_DB_TEXT),
    "unexpected is byte-identical to humanise(old raw database text)"
  );
});

// ── 4. humanise() is stable on the new sentences ─────────────────────
test("humanise() is idempotent on every message", () => {
  for (const code of RESPOND_CODES) {
    const once = humanise(RESPOND_INVITE_MESSAGES[code]);
    assert(
      humanise(once) === once,
      `${code} survives a second humanise() unchanged`
    );
    assert(once.length > 0, `${code} never humanises to an empty string`);
  }
});

// ── 5. Code and sentence cannot desync ───────────────────────────────
test("the builders pair each code with its own sentence", () => {
  for (const code of RESPOND_CODES) {
    const r = respondInviteError(code);
    assert(r.ok === false, `respondInviteError(${code}) is a failure`);
    assert(r.code === code, `respondInviteError(${code}) carries code ${code}`);
    assert(
      r.error === RESPOND_INVITE_MESSAGES[code],
      `respondInviteError(${code}) carries the matching sentence`
    );
  }
  for (const code of UNFREEZE_CODES) {
    const r = unfreezeTeamError(code);
    assert(r.ok === false, `unfreezeTeamError(${code}) is a failure`);
    assert(r.code === code, `unfreezeTeamError(${code}) carries code ${code}`);
    assert(
      r.error === UNFREEZE_TEAM_MESSAGES[code],
      `unfreezeTeamError(${code}) carries the matching sentence`
    );
  }
});

// ── 6. The branch that picks already_on_team vs unexpected ───────────
test("isDuplicateMembershipError separates 'already on a team' from 'broke'", () => {
  assert(
    isDuplicateMembershipError({ code: "23505", message: "whatever" }),
    "SQLSTATE 23505 (unique_violation) is a duplicate membership"
  );
  assert(
    isDuplicateMembershipError({ message: RAW_DUPLICATE_TEXT }),
    "the constraint name alone is enough when no code is supplied"
  );
  assert(
    isDuplicateMembershipError({ code: null, message: "duplicate key value" }),
    "a null code with duplicate-key wording still counts"
  );
  assert(
    !isDuplicateMembershipError({ code: "23502", message: RAW_OTHER_DB_TEXT }),
    "a not-null violation is NOT a duplicate membership"
  );
  assert(!isDuplicateMembershipError(null), "null is not a duplicate");
  assert(
    !isDuplicateMembershipError(undefined),
    "undefined is not a duplicate"
  );
  assert(
    !isDuplicateMembershipError("duplicate key"),
    "a bare string is not treated as an error object"
  );
});

// ── 7. Every code the union declares has a sentence ──────────────────
test("no code is missing a sentence", () => {
  const expectedRespond: RespondInviteErrorCode[] = [
    "not_signed_in",
    "invite_not_found",
    "not_your_invite",
    "invite_not_pending",
    "invite_expired",
    "team_not_found",
    "team_frozen",
    "team_full",
    "already_on_team",
    "partially_applied",
    "unexpected",
  ];
  for (const code of expectedRespond) {
    assert(
      typeof RESPOND_INVITE_MESSAGES[code] === "string",
      `respondInvite code "${code}" is present`
    );
  }
  assert(
    RESPOND_CODES.length === expectedRespond.length,
    `respondInvite exposes exactly ${expectedRespond.length} codes (found ${RESPOND_CODES.length})`
  );

  const expectedUnfreeze: UnfreezeTeamErrorCode[] = [
    "team_not_found",
    "team_chapter_unknown",
    "not_frozen",
    "unexpected",
  ];
  for (const code of expectedUnfreeze) {
    assert(
      typeof UNFREEZE_TEAM_MESSAGES[code] === "string",
      `unfreezeTeam code "${code}" is present`
    );
  }
  assert(
    UNFREEZE_CODES.length === expectedUnfreeze.length,
    `unfreezeTeam exposes exactly ${expectedUnfreeze.length} codes (found ${UNFREEZE_CODES.length})`
  );
});
