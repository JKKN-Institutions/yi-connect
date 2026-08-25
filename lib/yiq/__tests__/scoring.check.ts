/**
 * YIQ scoring checks.
 *
 * This repo has NO test runner installed (no vitest, no jest), so this is a
 * standalone script rather than a spec file:
 *
 *     npx tsx lib/yiq/__tests__/scoring.check.ts
 *
 * It exits non-zero on any failure, so it can be wired into CI as-is. Scoring
 * decides who reaches the National Grand Finale, so every rule here is one a
 * wrong answer would be visible for.
 */
import {
  gradeAttempt, rollUpTeam, rankTeams, bestIndividual, finalsTotal,
  MIN_MEMBERS_SAT, type MemberResult,
} from "../scoring";

let pass = 0, fail = 0;
function check(name: string, cond: boolean, detail = "") {
  if (cond) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; console.log(`  ✗ ${name} ${detail}`); }
}
function eq(name: string, a: unknown, b: unknown) {
  check(name, JSON.stringify(a) === JSON.stringify(b), `got ${JSON.stringify(a)} want ${JSON.stringify(b)}`);
}

console.log("\n── gradeAttempt ──");
const key = [
  { questionId: "q1", correctOption: "a" },
  { questionId: "q2", correctOption: "b" },
  { questionId: "q3", correctOption: "c" },
  { questionId: "q4", correctOption: "d" },
];
const r1 = gradeAttempt(key,
  [{ questionId: "q1", selectedOption: "a" }, { questionId: "q2", selectedOption: "a" }],
  { marksPerQuestion: 1, negativeMarks: 0 });
eq("1 correct 1 wrong 2 unreached -> score 1", r1.score, 1);
eq("  correctCount", r1.correctCount, 1);
eq("  wrongCount", r1.wrongCount, 1);
eq("  unansweredCount counts unreached", r1.unansweredCount, 2);

const r2 = gradeAttempt(key,
  [{ questionId: "q1", selectedOption: "b" }, { questionId: "q2", selectedOption: "a" }],
  { marksPerQuestion: 1, negativeMarks: 0.25 });
eq("negative marking applied, floored at 0", r2.score, 0);

const r3 = gradeAttempt(key,
  key.map(k => ({ questionId: k.questionId, selectedOption: k.correctOption })),
  { marksPerQuestion: 2, negativeMarks: 1 });
eq("all correct at 2 marks -> 8", r3.score, 8);

const r4 = gradeAttempt(key, [], { marksPerQuestion: 1, negativeMarks: 1 });
eq("blank paper -> 0 not negative", r4.score, 0);
eq("blank paper: nothing marked wrong", r4.wrongCount, 0);

const r5 = gradeAttempt(
  [{ questionId: "qX", correctOption: null }],
  [{ questionId: "qX", selectedOption: "a" }],
  { marksPerQuestion: 1, negativeMarks: 1 });
eq("keyless question cannot punish the student", r5.score, 0);
eq("  and is not counted wrong", r5.wrongCount, 0);

const r6 = gradeAttempt(key,
  [{ questionId: "q1", selectedOption: "A" }],
  { marksPerQuestion: 1, negativeMarks: 0 });
eq("answer key match is case-insensitive", r6.correctCount, 1);

const r7 = gradeAttempt(key,
  [{ questionId: "q1", selectedOption: "" }],
  { marksPerQuestion: 1, negativeMarks: 1 });
eq("empty string is unanswered, not wrong", r7.wrongCount, 0);

console.log("\n-- team rollup: AVERAGE of those who sat --");
const mk = (id: string, n: string, sc: number, t: number | null, a = true): MemberResult =>
  ({ studentId: id, studentName: n, score: sc, timeTakenSeconds: t, attempted: a });

const tA = rollUpTeam("A", "Alpha", "senior", [mk("1","Aarav",82,600), mk("2","Diya",76,700), mk("3","Karthik",91,500)]);
eq("3 sat: average not sum", tA.score, 83);          // 249/3, NOT 249
eq("  membersAttempted", tA.membersAttempted, 3);
eq("  eligible", tA.eligible, true);

const tB = rollUpTeam("B", "Bravo", "senior", [mk("4","X",88,400), mk("5","Y",0,null,false), mk("6","Z",90,400)]);
eq("2 of 3 sat: averages only the two", tB.score, 89);
eq("  absent member does NOT drag it down", tB.eligible, true);
eq("  absent member's time excluded", tB.totalTimeSeconds, 800);

// THE RULING THIS ENCODES: under the old sum, Bravo (178) lost to Alpha (249)
// despite both its students outscoring all three of Alpha's.
check("the ill-teammate injustice is gone: Bravo now beats Alpha", tB.score > tA.score,
      `Bravo ${tB.score} vs Alpha ${tA.score}`);

console.log("\n-- the floor of two --");
const solo = rollUpTeam("S", "Solo", "junior", [mk("1","Star",100,300), mk("2","Away",0,null,false), mk("3","Also",0,null,false)]);
eq("1 sat: ineligible however high the score", solo.eligible, false);
eq("  reason is machine-readable", solo.ineligibleReason, "insufficient_members");
const none = rollUpTeam("N", "None", "junior", [mk("1","A",0,null,false), mk("2","B",0,null,false)]);
eq("0 sat: ineligible", none.eligible, false);
eq("  score is 0, not NaN", none.score, 0);

console.log("\n-- ranking --");
const ranked = rankTeams([
  rollUpTeam("t1","One","senior",[mk("a","A",100,300), mk("b","B",100,300)]),
  rollUpTeam("t2","Two","senior",[mk("c","C",100,200), mk("d","D",100,200)]),  // same avg, faster
  rollUpTeam("t3","Three","senior",[mk("e","E",50,100), mk("f","F",50,100)]),
], 2);
eq("faster average time wins the tie", ranked[0].teamName, "Two");
eq("  slower is 2nd", ranked[1].teamName, "One");
eq("top 2 qualify", ranked.filter(t=>t.qualified).map(t=>t.teamName), ["Two","One"]);
eq("3rd does not", ranked[2].qualified, false);

// A one-member team scoring 100 must NOT outrank real teams.
const withSolo = rankTeams([
  rollUpTeam("r1","Real","junior",[mk("a","A",60,300), mk("b","B",60,300)]),
  rollUpTeam("r2","SoloStar","junior",[mk("c","C",100,100), mk("d","D",0,null,false)]),
], 5);
eq("a 1-member 100 ranks BELOW a real team on 60", withSolo[0].teamName, "Real");
eq("  and never qualifies", withSolo.find(t=>t.teamName==="SoloStar")?.qualified, false);
check("  even with slots to spare", withSolo.filter(t=>t.qualified).length === 1);

// The Director kept: a genuine dead heat at the cut carries everyone through.
const tied = rankTeams([
  rollUpTeam("x1","P","junior",[mk("a","A",100,300), mk("b","B",100,300)]),
  rollUpTeam("x2","Q","junior",[mk("c","C",50,200), mk("d","D",50,200)]),
  rollUpTeam("x3","R","junior",[mk("e","E",50,200), mk("f","F",50,200)]),   // identical to Q
], 2);
eq("a true tie at the cut carries all through", tied.filter(t=>t.qualified).length, 3);

// Average time, not total: a 3-member team must not lose for sitting one more paper.
const three = rollUpTeam("m3","Three","senior",[mk("a","A",80,300), mk("b","B",80,300), mk("c","C",80,300)]);
const two   = rollUpTeam("m2","Two","senior",  [mk("d","D",80,310), mk("e","E",80,310)]);
const byAvg = rankTeams([three, two], 1);
eq("tie-break uses AVERAGE time, so the 3-member team wins", byAvg[0].teamName, "Three");

eq("empty field does not crash", rankTeams([], 10).length, 0);
const only = rankTeams([rollUpTeam("s","S","junior",[mk("a","A",10,10), mk("b","B",10,10)])], 10);
eq("fewer teams than slots: all eligible qualify", only[0].qualified, true);
const allIneligible = rankTeams([rollUpTeam("z","Z","junior",[mk("a","A",99,10)])], 10);
eq("a field of only ineligible teams qualifies nobody", allIneligible.filter(t=>t.qualified).length, 0);

console.log("\n── best individual ──");
const best = bestIndividual([mk("1","Low",10,100), mk("2","High",99,900), mk("3","Tie",99,50)]);
eq("highest score wins, fastest breaks the tie", best?.studentName, "Tie");
eq("nobody sat -> null", bestIndividual([mk("1","X",0,null,false)]), null);
eq("empty -> null", bestIndividual([]), null);

console.log("\n── finals total ──");
eq("sums round points", finalsTotal([10,10,5,-5]), 20);
eq("empty -> 0", finalsTotal([]), 0);

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail === 0 ? 0 : 1);
