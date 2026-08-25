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
  type MemberResult,
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

console.log("\n── team rollup ──");
const mk = (id: string, n: string, s: number, t: number | null, a = true): MemberResult =>
  ({ studentId: id, studentName: n, score: s, timeTakenSeconds: t, attempted: a });

const tA = rollUpTeam("A", "Alpha", "senior", [mk("1","Aarav",82,600), mk("2","Diya",76,700), mk("3","Karthik",91,500)]);
eq("team total is the SUM of members", tA.totalScore, 249);
eq("membersAttempted", tA.membersAttempted, 3);

const tB = rollUpTeam("B", "Bravo", "senior", [mk("4","X",90,400), mk("5","Y",0,null,false), mk("6","Z",90,400)]);
eq("absent member contributes 0", tB.totalScore, 180);
eq("absent member not counted as attempted", tB.membersAttempted, 2);
eq("absent member's time excluded", tB.totalTimeSeconds, 800);

console.log("\n── ranking ──");
const teams = [
  rollUpTeam("t1","One","senior",[mk("a","A",100,300)]),
  rollUpTeam("t2","Two","senior",[mk("b","B",100,200)]),   // same score, faster
  rollUpTeam("t3","Three","senior",[mk("c","C",50,100)]),
];
const ranked = rankTeams(teams, 2);
eq("faster team wins the tie", ranked[0].teamName, "Two");
eq("  slower is 2nd", ranked[1].teamName, "One");
eq("top 2 qualify", ranked.filter(t=>t.qualified).map(t=>t.teamName), ["Two","One"]);
eq("3rd does not qualify", ranked[2].qualified, false);

// True tie ACROSS the cut line must not be silently dropped.
const tied = [
  rollUpTeam("x1","P","junior",[mk("a","A",100,300)]),
  rollUpTeam("x2","Q","junior",[mk("b","B",50,200)]),
  rollUpTeam("x3","R","junior",[mk("c","C",50,200)]),   // identical to Q
];
const rankedTied = rankTeams(tied, 2);
eq("a genuine tie on the cut line is carried through",
   rankedTied.filter(t=>t.qualified).length, 3);

eq("empty field does not crash", rankTeams([], 10).length, 0);
const single = rankTeams([rollUpTeam("s","S","junior",[mk("a","A",10,10)])], 10);
eq("fewer teams than slots: all qualify", single[0].qualified, true);

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
