/**
 * YIQ question-pool checks.
 *
 * This repo has NO test runner installed (no vitest, no jest), so this is a
 * standalone script rather than a spec file:
 *
 *     npx tsx lib/yiq/__tests__/question-pools.check.ts
 *
 * It exits non-zero on any failure, so it can be wired into CI as-is.
 *
 * What is being defended: a scored paper must NEVER draw a question a
 * student could have met in practice. If that guard slips, the leak is
 * invisible — the paper still renders, still grades, still ranks — and it
 * decides who reaches the National Grand Finale.
 */
import {
  eligiblePools, assertPoolSafe, isPoolEligible, filterEligible,
  isScoredPaper, isPaperKind, isQuestionPool,
  PAPER_KINDS, QUESTION_POOLS,
  type PaperKind, type QuestionPool,
} from "../question-pools";

let pass = 0, fail = 0;
function check(name: string, cond: boolean, detail = "") {
  if (cond) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; console.log(`  ✗ ${name} ${detail}`); }
}
function eq(name: string, a: unknown, b: unknown) {
  check(name, JSON.stringify(a) === JSON.stringify(b), `got ${JSON.stringify(a)} want ${JSON.stringify(b)}`);
}

console.log("\n── eligiblePools ──");
eq("mock draws practice + either", eligiblePools("mock").sort(), ["either", "practice"]);
eq("online_round draws competition + either", eligiblePools("online_round").sort(), ["competition", "either"]);
eq("national_semifinal draws competition + either", eligiblePools("national_semifinal").sort(), ["competition", "either"]);

console.log("\n── a scored paper can NEVER draw practice questions ──");
const scored = PAPER_KINDS.filter(isScoredPaper);
check("there is at least one scored kind", scored.length > 0);
for (const kind of scored) {
  check(`${kind}: practice is not eligible`, !eligiblePools(kind).includes("practice"));
  check(`${kind}: isPoolEligible(practice) is false`, isPoolEligible(kind, "practice") === false);
  check(`${kind}: assertPoolSafe rejects a practice draw`,
    typeof assertPoolSafe(kind, ["practice"]) === "string");
  check(`${kind}: assertPoolSafe rejects practice smuggled in beside a legal pool`,
    typeof assertPoolSafe(kind, ["competition", "either", "practice"]) === "string");
  check(`${kind}: the refusal names the practice pool`,
    (assertPoolSafe(kind, ["practice"]) ?? "").includes("practice"));
}

console.log("\n── 'either' is usable by BOTH sides ──");
for (const kind of PAPER_KINDS) {
  check(`${kind} may use either`, isPoolEligible(kind, "either"));
  eq(`${kind}: assertPoolSafe(['either']) is clean`, assertPoolSafe(kind, ["either"]), null);
}
eq("mock: practice + either is clean", assertPoolSafe("mock", ["practice", "either"]), null);
eq("online_round: competition + either is clean", assertPoolSafe("online_round", ["competition", "either"]), null);

console.log("\n── the mock side of the wall holds too ──");
check("mock may use practice", isPoolEligible("mock", "practice"));
check("mock may NOT use competition", isPoolEligible("mock", "competition") === false);
check("mock: assertPoolSafe rejects a competition draw",
  typeof assertPoolSafe("mock", ["competition"]) === "string");
check("mock is not a scored paper", isScoredPaper("mock") === false);

console.log("\n── unknown kind fails CLOSED ──");
eq("unknown kind has no eligible pools", eligiblePools("final_round"), []);
eq("empty string kind has no eligible pools", eligiblePools(""), []);
eq("null kind has no eligible pools", eligiblePools(null), []);
eq("undefined kind has no eligible pools", eligiblePools(undefined), []);
check("unknown kind is refused by assertPoolSafe",
  typeof assertPoolSafe("final_round", ["either"]) === "string");
check("unknown kind is refused even for the safest pool list",
  typeof assertPoolSafe(undefined, ["competition"]) === "string");
check("unknown kind is treated as SCORED, not as practice-safe", isScoredPaper("final_round") === true);
check("isPoolEligible is false for every pool on an unknown kind",
  QUESTION_POOLS.every((p) => isPoolEligible("final_round", p) === false));

console.log("\n── unknown / missing pool values fail CLOSED ──");
check("an unrecognised pool value is refused",
  typeof assertPoolSafe("online_round", ["leaked"]) === "string");
check("an unrecognised pool is refused even beside a legal one",
  typeof assertPoolSafe("online_round", ["competition", "leaked"]) === "string");
check("null pool is not eligible anywhere", isPoolEligible("mock", null) === false);
check("an empty pool list is refused", typeof assertPoolSafe("online_round", []) === "string");
check("isPaperKind rejects a near-miss", isPaperKind("online-round") === false);
check("isQuestionPool rejects a near-miss", isQuestionPool("Practice") === false);

console.log("\n── filterEligible ──");
type Row = { id: string; pool?: unknown };
const bank: Row[] = [
  { id: "p1", pool: "practice" },
  { id: "p2", pool: "practice" },
  { id: "c1", pool: "competition" },
  { id: "e1", pool: "either" },
  { id: "x1", pool: "leaked" },
  { id: "n1", pool: null },
  { id: "m1" },                       // column not selected at all
];
eq("a real paper keeps only competition + either",
  filterEligible("online_round", bank).map(r => r.id), ["c1", "e1"]);
eq("a mock paper keeps only practice + either",
  filterEligible("mock", bank).map(r => r.id), ["p1", "p2", "e1"]);
eq("an unknown kind keeps nothing", filterEligible("final_round", bank).map(r => r.id), []);
check("no practice row survives a scored filter",
  scored.every(k => filterEligible(k, bank).every(r => r.pool !== "practice")));
eq("a row whose pool column was never selected is dropped",
  filterEligible("online_round", [{ id: "m1" }] as Row[]).length, 0);
eq("empty bank does not crash", filterEligible("online_round", []).length, 0);

console.log("\n── exhaustive kind × pool sweep ──");
let leaks = 0;
for (const kind of PAPER_KINDS as readonly PaperKind[]) {
  for (const pool of QUESTION_POOLS as readonly QuestionPool[]) {
    const allowed = isPoolEligible(kind, pool);
    const guardClean = assertPoolSafe(kind, [pool]) === null;
    if (allowed !== guardClean) {
      leaks++;
      console.log(`    mismatch ${kind}/${pool}: eligible=${allowed} guardClean=${guardClean}`);
    }
    if (isScoredPaper(kind) && pool === "practice" && (allowed || guardClean)) {
      leaks++;
      console.log(`    LEAK ${kind} would accept a practice question`);
    }
  }
}
eq("isPoolEligible and assertPoolSafe agree on every combination, and nothing leaks", leaks, 0);

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail === 0 ? 0 : 1);
