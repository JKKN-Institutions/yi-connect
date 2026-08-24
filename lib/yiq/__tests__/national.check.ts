/**
 * YIQ national-ladder checks.
 *
 * This repo has NO test runner installed (no vitest, no jest), so this is a
 * standalone script rather than a spec file:
 *
 *     npx tsx lib/yiq/__tests__/national.check.ts
 *
 * It exits non-zero on any failure, so it can be wired into CI as-is. These
 * rules decide who gets to stand on the national stage and who goes home, so
 * every one of them is a rule a wrong answer would be visible for.
 */
import {
  DEFAULT_FINAL_FIELD_SIZE,
  clampFinalFieldSize,
  enteringStatuses,
  finalPlacements,
  ladderStep,
  nationalLadder,
  fellAtStage,
  stageField,
  stagePublished,
  nationalRoundPlan,
  nationalStandings,
  paperKindForStage,
  stageOutcomes,
  type NationalEntry,
  type NationalScoreRow,
  type NationalStage,
} from "../national";

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

/** Compact ladder shape: ["quarter:65->20","semi:20->6","final:6->1"]. */
const shape = (n: number, finalFieldSize = DEFAULT_FINAL_FIELD_SIZE) =>
  nationalLadder(n, { finalFieldSize }).map(
    (s) => `${s.stage.replace("national_", "")}:${s.entering}->${s.advancing}`
  );

const stages = (n: number, finalFieldSize = DEFAULT_FINAL_FIELD_SIZE) =>
  nationalLadder(n, { finalFieldSize }).map((s) =>
    s.stage.replace("national_", "")
  );

console.log("\n── ladder depth is DERIVED from the entrant count ──");
eq("nothing entered -> no ladder at all", shape(0), []);
eq("one entrant is champion by walkover", shape(1), ["final:1->1"]);
eq("4 teams go straight to the Final", shape(4), ["final:4->1"]);
eq("6 teams (exactly the Final field) skip every cut", shape(6), ["final:6->1"]);
eq("12 teams -> semi + final", shape(12), ["semifinal:12->6", "final:6->1"]);
eq("64 teams -> quarter + semi + final", stages(64), [
  "quarterfinal",
  "semifinal",
  "final",
]);
eq("64 teams narrow evenly, not in one brutal cut", shape(64), [
  "quarterfinal:64->20",
  "semifinal:20->6",
  "final:6->1",
]);
eq("65 chapters (the real ceiling) still runs three stages", shape(65), [
  "quarterfinal:65->20",
  "semifinal:20->6",
  "final:6->1",
]);

console.log("\n── the boundaries where a stage drops out of the ladder ──");
eq("5 -> final only", stages(5), ["final"]);
eq("6 -> final only (last field that needs no cut)", stages(6), ["final"]);
eq("7 -> a semi appears", stages(7), ["semifinal", "final"]);
eq("  and it really narrows", shape(7), ["semifinal:7->6", "final:6->1"]);
eq("18 -> still just a semi (last one-cut field)", stages(18), [
  "semifinal",
  "final",
]);
eq("19 -> a quarter appears", stages(19), [
  "quarterfinal",
  "semifinal",
  "final",
]);
eq("  and neither stage is a no-op", shape(19), [
  "quarterfinal:19->11",
  "semifinal:11->6",
  "final:6->1",
]);

console.log("\n── odd / non-power-of-two fields keep a whole bracket ──");
for (const n of [
  1, 2, 3, 5, 7, 9, 11, 13, 17, 19, 21, 23, 29, 31, 33, 37, 41, 47, 53, 59, 61,
  63, 65, 77, 99, 101, 127, 200,
]) {
  const l = nationalLadder(n);
  const label = `n=${n}`;
  check(`${label}: ladder is 1..3 stages`, l.length >= 1 && l.length <= 3);
  check(`${label}: takes in every entrant`, l[0].entering === n, `${l[0].entering}`);
  check(
    `${label}: ends at the Final`,
    l[l.length - 1].stage === "national_final"
  );
  check(
    `${label}: stages in ladder order, no repeats`,
    l.map((s) => s.stage).join(",") ===
      (
        ["national_quarterfinal", "national_semifinal", "national_final"] as const
      )
        .filter((s) => l.some((x) => x.stage === s))
        .join(",")
  );
  for (let i = 0; i + 1 < l.length; i++) {
    check(
      `${label}: ${l[i].stage} hands its survivors to ${l[i + 1].stage}`,
      l[i].advancing === l[i + 1].entering,
      `${l[i].advancing} vs ${l[i + 1].entering}`
    );
    check(
      `${label}: ${l[i].stage} strictly narrows`,
      l[i].advancing < l[i].entering,
      `${l[i].entering}->${l[i].advancing}`
    );
    check(`${label}: ${l[i].stage} leaves a real field`, l[i].advancing >= 1);
  }
  check(`${label}: the Final produces one champion`, l[l.length - 1].advancing === 1);
  check(
    `${label}: the Final seats exactly min(entrants, target)`,
    l[l.length - 1].entering === Math.min(n, DEFAULT_FINAL_FIELD_SIZE),
    `${l[l.length - 1].entering}`
  );
  check(`${label}: order numbers are 1..n`, l.every((s, i) => s.order === i + 1));
}

console.log("\n── ladder depth never shrinks as the field grows ──");
let prevLen = 0;
let monotone = true;
for (let n = 1; n <= 300; n++) {
  const len = nationalLadder(n).length;
  if (len < prevLen) monotone = false;
  prevLen = len;
}
check("a bigger field never runs fewer stages", monotone);

console.log("\n── the Final field size re-shapes the ladder ──");
eq("a Final of 2 makes 12 teams need two cuts", stages(12, 2), [
  "quarterfinal",
  "semifinal",
  "final",
]);
eq("a Final of 20 lets 20 teams go straight there", stages(20, 20), ["final"]);
eq("a Final of 20 lets 50 teams take one cut", shape(50, 20), [
  "semifinal:50->20",
  "final:20->1",
]);
eq("a silly Final size is clamped, not obeyed", clampFinalFieldSize(0), 2);
eq("  and so is a huge one", clampFinalFieldSize(9999), 50);
eq("  and a non-number falls back to the default", clampFinalFieldSize(NaN), 6);
check(
  "a clamped size still produces a valid ladder",
  nationalLadder(30, { finalFieldSize: -5 }).length >= 1
);

console.log("\n── entering statuses chain along the ladder ──");
const big = nationalLadder(65);
eq(
  "the quarter takes everyone who entered",
  enteringStatuses(big, "national_quarterfinal"),
  ["entered", "quarterfinal_qualified"]
);
eq(
  "the semi takes quarter survivors",
  enteringStatuses(big, "national_semifinal"),
  ["quarterfinal_qualified", "semifinal_qualified"]
);
eq(
  "the Final takes semi survivors plus its own placements",
  enteringStatuses(big, "national_final"),
  ["semifinal_qualified", "finalist", "runner_up", "national_champion"]
);
const small = nationalLadder(4);
eq(
  "with no cuts at all, the Final takes teams straight from 'entered'",
  enteringStatuses(small, "national_final"),
  ["entered", "finalist", "runner_up", "national_champion"]
);
eq(
  "a stage the ladder does not run has no field",
  enteringStatuses(small, "national_quarterfinal"),
  []
);
check("ladderStep finds a stage that runs", ladderStep(big, "national_semifinal") !== null);
check(
  "ladderStep refuses a stage that does not run",
  ladderStep(small, "national_quarterfinal") === null
);

/* ------------------------------------------------------------ standings */

const mk = (
  id: string,
  team: string,
  chapter: string,
  category: "junior" | "senior" = "junior",
  status: NationalEntry["status"] = "entered"
): NationalEntry => ({
  entryId: `e-${id}`,
  teamId: `t-${id}`,
  teamName: team,
  chapterName: chapter,
  category,
  semifinalScore: null,
  semifinalRank: null,
  finaleScore: null,
  finaleRank: null,
  status,
});

const sc = (id: string, points: number): NationalScoreRow => ({
  teamId: `t-${id}`,
  points,
});

console.log("\n── ranking ──");
const field = [
  mk("1", "Alpha", "Erode"),
  mk("2", "Bravo", "Chennai"),
  mk("3", "Charlie", "Mysuru"),
];
const ranked = nationalStandings(
  field,
  [sc("1", 40), sc("2", 90), sc("3", 65)],
  "junior",
  2
);
eq("highest score ranks first", ranked[0].teamName, "Bravo");
eq("  then the next", ranked[1].teamName, "Charlie");
eq("top 2 qualify", ranked.filter((r) => r.qualified).map((r) => r.teamName), [
  "Bravo",
  "Charlie",
]);
eq("3rd does not qualify", ranked[2].qualified, false);
eq("scores are summed across rows",
  nationalStandings(field, [sc("1", 10), sc("1", 5), sc("1", 2.5)], "junior")[0].liveTotal,
  17.5);

console.log("\n── a tie ON the cut line is carried through, never dropped ──");
const tied = nationalStandings(
  [
    mk("1", "Alpha", "Erode"),
    mk("2", "Bravo", "Chennai"),
    mk("3", "Charlie", "Mysuru"),
    mk("4", "Delta", "Pune"),
  ],
  [sc("1", 90), sc("2", 50), sc("3", 50), sc("4", 20)],
  "junior",
  2
);
eq("three teams go through when two tie on the line", tied.filter((r) => r.qualified).length, 3);
eq("  and the carried teams are flagged", tied.filter((r) => r.tiedAtCut).map((r) => r.teamName), ["Charlie"]);
eq("  the team below the tie is still out", tied[3].qualified, false);

const tripleTie = nationalStandings(
  [
    mk("1", "A", "Erode"),
    mk("2", "B", "Chennai"),
    mk("3", "C", "Mysuru"),
    mk("4", "D", "Pune"),
  ],
  [sc("1", 50), sc("2", 50), sc("3", 50), sc("4", 50)],
  "junior",
  2
);
eq("a four-way tie for two places carries all four", tripleTie.filter((r) => r.qualified).length, 4);

console.log("\n── a blank is not a zero ──");
const withBlank = nationalStandings(
  [mk("1", "Scored zero", "Erode"), mk("2", "Never scored", "Chennai")],
  [sc("1", 0)],
  "junior",
  1
);
eq("a real 0 outranks an unrecorded score", withBlank[0].teamName, "Scored zero");
eq("  the scored team is marked scored", withBlank[0].scored, true);
eq("  the blank team is not", withBlank[1].scored, false);
eq("  and a blank never ties its way through the cut", withBlank[1].qualified, false);

const bothBlank = nationalStandings(
  [mk("1", "A", "Erode"), mk("2", "B", "Chennai")],
  [],
  "junior",
  1
);
eq("two blanks do not tie each other through", bothBlank.filter((r) => r.qualified).length, 1);

console.log("\n── deterministic order, so a re-run never reshuffles ──");
const dup = [
  mk("1", "Same", "Zeta"),
  mk("2", "Same", "Alpha"),
  mk("3", "Aardvark", "Alpha"),
];
const runA = nationalStandings(dup, [sc("1", 10), sc("2", 10), sc("3", 10)], "junior");
const runB = nationalStandings([...dup].reverse(), [sc("3", 10), sc("2", 10), sc("1", 10)], "junior");
eq("input order does not change the result", runA.map((r) => r.entryId), runB.map((r) => r.entryId));
eq("  chapter breaks the tie before team name", runA.map((r) => r.chapterName), ["Alpha", "Alpha", "Zeta"]);
eq("  then team name", runA.map((r) => r.teamName), ["Aardvark", "Same", "Same"]);

console.log("\n── empty and single-team fields do not crash ──");
eq("empty field ranks to nothing", nationalStandings([], [], "junior", 6).length, 0);
eq("empty field with no cut", nationalStandings([], [], "junior").length, 0);
const lone = nationalStandings([mk("1", "Only", "Erode")], [sc("1", 5)], "junior", 6);
eq("fewer teams than places: everyone qualifies", lone[0].qualified, true);
eq("  and is ranked 1", lone[0].rank, 1);
eq(
  "an advancing count of 0 ranks without qualifying anyone",
  nationalStandings([mk("1", "Only", "Erode")], [sc("1", 5)], "junior", 0).filter((r) => r.qualified).length,
  0
);

console.log("\n── JUNIOR AND SENIOR NEVER MIX ──");
const mixed = [
  mk("j1", "Junior A", "Erode", "junior"),
  mk("j2", "Junior B", "Chennai", "junior"),
  mk("s1", "Senior A", "Erode", "senior"),
  mk("s2", "Senior B", "Chennai", "senior"),
];
const juniorBoard = nationalStandings(
  mixed,
  [sc("j1", 10), sc("j2", 20), sc("s1", 999), sc("s2", 998)],
  "junior",
  1
);
eq("a junior board holds only junior teams", juniorBoard.map((r) => r.teamName), ["Junior B", "Junior A"]);
eq("  a senior team's huge score cannot leak in", juniorBoard.every((r) => r.category === "junior"), true);
eq("  and cannot displace a junior qualifier", juniorBoard[0].teamName, "Junior B");

const seniorBoard = nationalStandings(
  mixed,
  [sc("j1", 10), sc("j2", 20), sc("s1", 5), sc("s2", 4)],
  "senior",
  1
);
eq("a senior board holds only senior teams", seniorBoard.map((r) => r.teamName), ["Senior A", "Senior B"]);
eq("  the two boards share no team",
  juniorBoard.some((j) => seniorBoard.some((s) => s.teamId === j.teamId)), false);
eq("a category with no entrants is simply empty",
  nationalStandings(mixed.filter((m) => m.category === "junior"), [], "senior").length, 0);

console.log("\n── a published stage keeps its whole field (re-publish is idempotent) ──");
// semifinal_rank is stamped only by the semi, so it tells the two narrowing
// stages apart without a new column.
const threeStage = nationalLadder(65);
const qOut = { ...mk("q", "Quarter casualty", "Erode"), status: "eliminated" as const };
const sOut = { ...mk("s", "Semi casualty", "Chennai"), status: "eliminated" as const, semifinalRank: 9 };
check("no semi rank -> fell at the quarter", fellAtStage(qOut, "national_quarterfinal", threeStage));
check("  and not at the semi", !fellAtStage(qOut, "national_semifinal", threeStage));
check("a semi rank -> fell at the semi", fellAtStage(sOut, "national_semifinal", threeStage));
check("  and not at the quarter", !fellAtStage(sOut, "national_quarterfinal", threeStage));
check("nobody is ever eliminated at the Final", !fellAtStage(sOut, "national_final", threeStage));
check("a team still standing never counts as fallen",
  !fellAtStage(mk("ok", "Alive", "Erode"), "national_quarterfinal", threeStage));

const twoStage = nationalLadder(12);
check("with one narrowing stage, every elimination belongs to it",
  fellAtStage({ ...qOut }, "national_semifinal", twoStage));
check("  and a stage the ladder does not run claims nobody",
  !fellAtStage({ ...qOut }, "national_quarterfinal", twoStage));
check("with no narrowing stage at all, nobody fell anywhere",
  !fellAtStage({ ...qOut }, "national_final", nationalLadder(4)));

const published = [
  { ...mk("a", "Through", "Erode"), status: "semifinal_qualified" as const, semifinalRank: 1 },
  { ...mk("b", "Knocked out", "Chennai"), status: "eliminated" as const, semifinalRank: 2 },
];
eq("a published semi still lists the team it eliminated",
  stageField(published, twoStage, "national_semifinal").map((e) => e.teamName),
  ["Through", "Knocked out"]);
eq("  but the Final lists only who is actually on stage",
  stageField(published, twoStage, "national_final").map((e) => e.teamName), ["Through"]);
eq("re-ranking that same field reproduces the same cut",
  nationalStandings(stageField(published, twoStage, "national_semifinal"),
    [sc("a", 90), sc("b", 10)], "junior", 1).filter((r) => r.qualified).map((r) => r.teamName),
  ["Through"]);

console.log("\n── a stage stays published once the field moves past it ──");
const semiLadder = nationalLadder(12);
const midRun = [
  { ...mk("a", "Through", "Erode"), status: "semifinal_qualified" as const, semifinalRank: 1 },
  { ...mk("b", "Out", "Chennai"), status: "eliminated" as const, semifinalRank: 2 },
];
check("the semi reads as published once its cut is applied",
  stagePublished(midRun, semiLadder, "national_semifinal"));
check("  and the Final does not, until a champion exists",
  !stagePublished(midRun, semiLadder, "national_final"));

const crowned = [
  { ...mk("a", "Champion", "Erode"), status: "national_champion" as const, semifinalRank: 1 },
  { ...mk("b", "Out", "Chennai"), status: "eliminated" as const, semifinalRank: 2 },
];
check("crowning does NOT flip the semi back to unpublished",
  stagePublished(crowned, semiLadder, "national_semifinal"));
check("  and the Final now reads as published",
  stagePublished(crowned, semiLadder, "national_final"));
check("an untouched field has published nothing",
  !stagePublished([mk("a", "New", "Erode")], semiLadder, "national_semifinal"));
check("a stage the ladder does not run is never 'published'",
  !stagePublished(crowned, semiLadder, "national_quarterfinal"));

const threeStageCrowned = [
  { ...mk("a", "Champion", "Erode"), status: "national_champion" as const, semifinalRank: 1 },
];
check("in a three-stage ladder the quarter also stays published after the crown",
  stagePublished(threeStageCrowned, nationalLadder(65), "national_quarterfinal"));

console.log("\n── stage outcomes ──");
const step = ladderStep(nationalLadder(12), "national_semifinal")!;
const semiStanding = nationalStandings(
  [
    mk("1", "A", "Erode"),
    mk("2", "B", "Chennai"),
    mk("3", "C", "Mysuru"),
  ],
  [sc("1", 90), sc("2", 80), sc("3", 10)],
  "junior",
  2
);
const outcomes = stageOutcomes(semiStanding, step);
eq("survivors carry the stage's own qualified status",
  outcomes.filter((o) => o.status === "semifinal_qualified").map((o) => o.teamName), ["A", "B"]);
eq("the rest are eliminated", outcomes.filter((o) => o.status === "eliminated").map((o) => o.teamName), ["C"]);

const qStep = ladderStep(nationalLadder(65), "national_quarterfinal")!;
eq("a quarter-final survivor becomes quarterfinal_qualified", qStep.survivorStatus, "quarterfinal_qualified");
eq("  and the semi's survivor becomes semifinal_qualified",
  ladderStep(nationalLadder(65), "national_semifinal")!.survivorStatus, "semifinal_qualified");

console.log("\n── Final placement ──");
const finalField = nationalStandings(
  [
    mk("1", "Alpha", "Erode", "junior", "semifinal_qualified"),
    mk("2", "Bravo", "Chennai", "junior", "semifinal_qualified"),
    mk("3", "Charlie", "Mysuru", "junior", "semifinal_qualified"),
  ],
  [sc("1", 70), sc("2", 90), sc("3", 40)],
  "junior"
);
const placed = finalPlacements(finalField, "t-1")!;
eq("the crowned team is champion even when not top-scoring",
  placed.find((p) => p.teamId === "t-1")?.status, "national_champion");
eq("the best remaining team is runner-up", placed.find((p) => p.teamId === "t-2")?.status, "runner_up");
eq("everyone else who stood on stage is a finalist",
  placed.find((p) => p.teamId === "t-3")?.status, "finalist");
eq("nobody on the Final stage is ever 'eliminated'",
  placed.some((p) => p.status === "eliminated"), false);

const tiedSecond = finalPlacements(
  nationalStandings(
    [
      mk("1", "Alpha", "Erode", "junior", "semifinal_qualified"),
      mk("2", "Bravo", "Chennai", "junior", "semifinal_qualified"),
      mk("3", "Charlie", "Mysuru", "junior", "semifinal_qualified"),
    ],
    [sc("1", 90), sc("2", 50), sc("3", 50)],
    "junior"
  ),
  "t-1"
)!;
eq("a genuine tie for second gives TWO runners-up",
  tiedSecond.filter((p) => p.status === "runner_up").length, 2);
eq("  and no finalist is invented below them",
  tiedSecond.filter((p) => p.status === "finalist").length, 0);

const soloFinal = finalPlacements(
  nationalStandings([mk("1", "Only", "Erode", "junior", "entered")], [sc("1", 10)], "junior"),
  "t-1"
)!;
eq("a one-team Final crowns it with no runner-up", soloFinal.map((p) => p.status), ["national_champion"]);

check("crowning a team that is not in the field is refused",
  finalPlacements(finalField, "t-999") === null);
check("crowning in an empty field is refused",
  finalPlacements([], "t-1") === null);

console.log("\n── round plans + paper kinds, per stage ──");
eq("the Final is the six-round BQC structure", nationalRoundPlan("national_final").length, 6);
eq("  in deck order", nationalRoundPlan("national_final").map((r) => r.roundType), [
  "direct", "pass_on", "visual", "audio", "rapid_fire", "india_challenge",
]);
eq("the semi is one written paper", nationalRoundPlan("national_semifinal").length, 1);
eq("the quarter is one written paper", nationalRoundPlan("national_quarterfinal").length, 1);
eq("  and they are named apart, so each carries its own question set",
  [nationalRoundPlan("national_quarterfinal")[0].name, nationalRoundPlan("national_semifinal")[0].name],
  ["National Quarter-Final paper", "National Semi-Final paper"]);
for (const s of [
  "national_quarterfinal", "national_semifinal", "national_final",
] as NationalStage[]) {
  const plan = nationalRoundPlan(s);
  check(`${s}: round numbers are 1..n`, plan.every((p, i) => p.roundNumber === i + 1));
  eq(`${s}: paper_kind matches the stage name`, paperKindForStage(s), s);
}

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail === 0 ? 0 : 1);
