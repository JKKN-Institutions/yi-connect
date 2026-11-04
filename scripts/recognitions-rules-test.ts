// Recognitions scoring + Stage 2 reason rules. Run: node_modules/.bin/jiti scripts/recognitions-rules-test.ts
import { computeMatrix } from "../lib/recognitions/scoring";
import { reasonRequired } from "../lib/recognitions/moderation-rules";
let fails = 0;
const eq = (name: string, got: unknown, want: unknown) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) fails++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}  got=${JSON.stringify(got)} want=${JSON.stringify(want)}`);
};
const cycle = { weight_layer1: 50, weight_layer2: 25, weight_layer3: 25, layer2_mode: "raw" as const };
const measures = [{ key: "m1", weight: 1 }];
const nom = (id: string, region: string) => ({ id, chapter_id: "c" + id, category: "pioneers", region, status: "submitted", origin: "chapter" }) as any;
const sc = (nid: string, layer: "rm" | "nmt", p: number, a: number, status = "submitted") =>
  ({ nomination_id: nid, layer, status, evaluator_id: layer + nid, params: { p1: p, p2: p, p3: p, p4: p, p5: p, a_m1: a } }) as any;

// A: RM and NMT both scored. B: no RM at all. C: RM only saved a draft (missed the deadline). D: nobody scored Part B.
const rows = computeMatrix({
  cycle,
  partAMeasures: measures,
  nominations: [nom("A", "ER"), nom("B", "ER"), nom("C", "NR"), nom("D", "WR")],
  scores: [
    sc("A", "rm", 6, 8), sc("A", "nmt", 8, 6),
    sc("B", "nmt", 8, 6),
    sc("C", "rm", 10, 10, "draft"), sc("C", "nmt", 4, 4),
  ],
});
const by = Object.fromEntries(rows.map((r) => [r.nomination_id, r]));
// A: Part A = mean(0.8, 0.6) = 0.7 -> 35; RM 30/50 -> 15; NMT 40/50 -> 20; total 70.
eq("both scored: total", by.A.total, 70);
eq("both scored: no stand-in", by.A.rmFromNmt, false);
// B: Part A = NMT side 0.6 -> 30; RM missing so NMT 0.8 fills it -> 20 + 20; total 70.
eq("no RM: RM share = NMT share", [by.B.rmPoints, by.B.nmtPoints], [20, 20]);
eq("no RM: total = Health Card 50% + NMT 50%", by.B.total, 70);
eq("no RM: flagged", [by.B.rmFromNmt, by.B.missing], [true, ["layer2"]]);
// C: RM draft not counted. Part A 0.4 -> 20; NMT 0.4 -> 10 + 10; total 40.
eq("RM missed deadline (draft only): NMT stands in", [by.C.rmFromNmt, by.C.total], [true, 40]);
// D: nothing scored -> zero, flagged on all three, no stand-in.
eq("nobody scored: zero, all flagged", [by.D.total, by.D.rmFromNmt, by.D.missing], [0, false, ["partA", "layer2", "layer3"]]);
// Reason rule (Piyush 18:58 "Yes. Wherever the rank changes."): ranks 1-5 always, any moved rank below 5.
eq("reason: rank 3 unmoved", reasonRequired(3, 3, 1), true);
eq("reason: rank 8 moved from 6", reasonRequired(8, 6, 1), true);
eq("reason: rank 8 unmoved", reasonRequired(8, 8, 1), false);
console.log(fails === 0 ? "ALL PASS" : `${fails} FAILED`);
process.exit(fails ? 1 : 0);
