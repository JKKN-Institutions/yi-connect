/**
 * Election-outcome lib tests (tsx harness, same pattern as lib/yuva/__tests__).
 * Run: npx tsx lib/yip/__tests__/election-outcome.test.ts
 *
 * Covers the seat-designation rules (Director ruling 2026-06-11: top 1 =
 * Speaker, next 2 = Deputy Speakers; any seat-boundary tie goes to a
 * 60-second runoff among only the tied) and the runoff-seat helpers added by
 * the votes-session-scope fix. The session scoping itself (a runoff tally
 * excludes round-1 ballots; a round-1 voter may vote again in the runoff)
 * lives in the DB queries/unique index and is exercised by review + live QA,
 * not unit tests — there is no DB seam in this harness.
 */

import {
  computeElectionOutcome,
  computeDeputyRunoffOutcome,
  fillDeputiesFromParent,
  type VoteTally,
} from "../election-outcome";

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

const t = (vote_value: string, count: number): VoteTally => ({
  vote_value,
  count,
});

// ─── computeElectionOutcome ─────────────────────────────────────

test("speaker election: clean outcome — top 1 Speaker, next 2 Deputies", () => {
  const out = computeElectionOutcome("speaker_election", [
    t("A", 10),
    t("B", 8),
    t("C", 6),
    t("D", 4),
  ]);
  assert(out.speakerId === "A", "Speaker is the top candidate");
  assert(
    out.deputyIds.length === 2 && out.deputyIds[0] === "B" && out.deputyIds[1] === "C",
    "Deputies are ranks 2 and 3"
  );
  assert(out.tie === null, "no tie reported");
});

test("speaker election: tie for the Speaker seat blocks all designation", () => {
  const out = computeElectionOutcome("speaker_election", [
    t("A", 10),
    t("B", 10),
    t("C", 6),
  ]);
  assert(out.speakerId === null, "no Speaker while the seat is tied");
  assert(out.deputyIds.length === 0, "no deputies either");
  assert(out.tie?.seat === "speaker", "tie reported for the speaker seat");
  assert(
    out.tie?.tiedCandidateIds.join(",") === "A,B",
    "exactly the tied candidates go to the runoff"
  );
});

test("speaker election: tie for the 2nd Deputy seat awards the clear seats only", () => {
  const out = computeElectionOutcome("speaker_election", [
    t("A", 10),
    t("B", 8),
    t("C", 6),
    t("D", 6),
  ]);
  assert(out.speakerId === "A", "Speaker decided");
  assert(
    out.deputyIds.length === 1 && out.deputyIds[0] === "B",
    "only the clearly-ahead deputy is awarded"
  );
  assert(out.tie?.seat === "deputy", "tie reported for the deputy seat");
  assert(
    out.tie?.tiedCandidateIds.join(",") === "C,D",
    "the deputy runoff is between the tied pair"
  );
});

test("party leader: clean win and exact tie", () => {
  const win = computeElectionOutcome("party_leader", [t("A", 5), t("B", 3)]);
  assert(win.partyLeaderId === "A", "leader is the top candidate");
  assert(win.tie === null, "no tie on a clean win");

  const tie = computeElectionOutcome("party_leader", [t("A", 4), t("B", 4)]);
  assert(tie.partyLeaderId === null, "no leader while tied");
  assert(tie.tie?.seat === "party_leader", "tie reported for the leader seat");
});

test("bill vote: no seat designation", () => {
  const out = computeElectionOutcome("bill_vote", [t("aye", 9), t("nay", 9)]);
  assert(
    out.speakerId === null && out.deputyIds.length === 0 && out.tie === null,
    "bill tallies never designate seats or ties"
  );
});

// ─── computeDeputyRunoffOutcome ─────────────────────────────────

test("deputy runoff: winner takes the single open seat", () => {
  const out = computeDeputyRunoffOutcome([t("C", 7), t("D", 5)], 1);
  assert(
    out.deputyIds.length === 1 && out.deputyIds[0] === "C",
    "runoff winner takes the open deputy seat"
  );
  assert(out.tie === null, "no further tie");
});

test("deputy runoff: tied again — nothing awarded, re-runoff reported", () => {
  const out = computeDeputyRunoffOutcome([t("C", 6), t("D", 6)], 1);
  assert(out.deputyIds.length === 0, "no seat awarded while still tied");
  assert(
    out.tie?.seat === "deputy" && out.tie?.tiedCandidateIds.join(",") === "C,D",
    "the same pair goes to another runoff"
  );
});

test("deputy runoff: two open seats, boundary tie awards the clear winner only", () => {
  const out = computeDeputyRunoffOutcome([t("B", 8), t("C", 5), t("D", 5)], 2);
  assert(
    out.deputyIds.length === 1 && out.deputyIds[0] === "B",
    "clear winner takes one seat"
  );
  assert(
    out.tie?.tiedCandidateIds.join(",") === "C,D",
    "the boundary tie goes to another runoff"
  );
});

test("deputy runoff: candidates fit the open seats — all awarded", () => {
  const out = computeDeputyRunoffOutcome([t("C", 3), t("D", 1)], 2);
  assert(
    out.deputyIds.join(",") === "C,D",
    "uncontested fill awards every candidate"
  );
  assert(out.tie === null, "no tie");
});

// ─── fillDeputiesFromParent (speaker-seat runoff) ───────────────

test("speaker runoff: open deputy seat filled from round-1 standings", () => {
  // Round 1: A=B=10 (speaker tie), C=8, D=5. Runoff A beats B.
  const runoffOutcome = computeElectionOutcome("speaker_election", [
    t("A", 12),
    t("B", 9),
  ]);
  const filled = fillDeputiesFromParent(
    runoffOutcome,
    [t("A", 10), t("B", 10), t("C", 8), t("D", 5)],
    ["A", "B"]
  );
  assert(filled.speakerId === "A", "runoff winner is Speaker");
  assert(
    filled.deputyIds.join(",") === "B,C",
    "runoff loser + round-1 rank 3 take the deputy seats"
  );
  assert(filled.tie === null, "no tie");
});

test("speaker runoff: round-1 boundary tie on the fill is reported, not guessed", () => {
  // Round 1: A=B=10, C=8, D=8. Runoff A beats B → B is deputy 1; the second
  // deputy seat is tied between C and D in comparable round-1 counts.
  const runoffOutcome = computeElectionOutcome("speaker_election", [
    t("A", 11),
    t("B", 7),
  ]);
  const filled = fillDeputiesFromParent(
    runoffOutcome,
    [t("A", 10), t("B", 10), t("C", 8), t("D", 8)],
    ["A", "B"]
  );
  assert(filled.speakerId === "A", "Speaker decided");
  assert(filled.deputyIds.join(",") === "B", "only the clear deputy awarded");
  assert(
    filled.tie?.seat === "deputy" &&
      filled.tie?.tiedCandidateIds.join(",") === "C,D",
    "the round-1 tie goes to a deputy runoff"
  );
});

test("speaker runoff: no fill while the runoff itself is unresolved", () => {
  const stillTied = computeElectionOutcome("speaker_election", [
    t("A", 6),
    t("B", 6),
  ]);
  const filled = fillDeputiesFromParent(
    stillTied,
    [t("A", 10), t("B", 10), t("C", 8)],
    ["A", "B"]
  );
  assert(filled.speakerId === null, "no Speaker while the runoff is tied");
  assert(filled.deputyIds.length === 0, "no deputies filled");
  assert(filled.tie?.seat === "speaker", "the speaker tie is preserved");
});

test("speaker runoff: nothing to fill when both deputy seats are already taken", () => {
  // 3-way speaker tie: the runoff ranks all three — winner + 2 deputies.
  const runoffOutcome = computeElectionOutcome("speaker_election", [
    t("A", 9),
    t("B", 7),
    t("C", 4),
  ]);
  const filled = fillDeputiesFromParent(
    runoffOutcome,
    [t("A", 10), t("B", 10), t("C", 10), t("D", 6)],
    ["A", "B", "C"]
  );
  assert(filled.speakerId === "A", "Speaker decided");
  assert(
    filled.deputyIds.join(",") === "B,C",
    "deputies come from the runoff ranking; D is not pulled in"
  );
  assert(filled.tie === null, "no tie");
});

console.log("\nDone.");
