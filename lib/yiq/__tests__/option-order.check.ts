/**
 * YIQ per-student option-order checks.
 *
 *     npx tsx lib/yiq/__tests__/option-order.check.ts
 *
 * Two things must both hold or this feature is worse than not having it:
 * the order must be STABLE for a given student (or options jump under them
 * mid-paper, and a resumed attempt after a dead phone looks like a different
 * paper), and it must be WELL SPREAD across students (or it does not fix the
 * answer-key bias it exists to fix).
 */
import {
  optionOrderFor,
  applyOptionOrder,
  displayLabelFor,
} from "../option-order";
import { OPTION_KEYS, type OptionKey } from "../paper";

let pass = 0, fail = 0;
function check(name: string, cond: boolean, detail = "") {
  if (cond) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; console.log(`  ✗ ${name} ${detail}`); }
}
function eq(name: string, a: unknown, b: unknown) {
  check(name, JSON.stringify(a) === JSON.stringify(b),
    `got ${JSON.stringify(a)} want ${JSON.stringify(b)}`);
}

const A1 = "11111111-1111-4111-8111-111111111111";
const Q1 = "22222222-2222-4222-8222-222222222222";

console.log("\n── it is a permutation, always ──");
let allFour = true, ok1000 = true;
for (let i = 0; i < 1000; i++) {
  const o = optionOrderFor(`attempt-${i}`, `question-${i % 37}`);
  if (o.length !== 4) ok1000 = false;
  if (new Set(o).size !== 4) allFour = false;
  if (!o.every((k) => (OPTION_KEYS as string[]).includes(k))) allFour = false;
}
check("1000 different inputs all return 4 keys", ok1000);
check("every one contains a, b, c and d exactly once", allFour);

console.log("\n── stability: the same student sees the same order ──");
const first = optionOrderFor(A1, Q1);
let stable = true;
for (let i = 0; i < 500; i++) {
  if (JSON.stringify(optionOrderFor(A1, Q1)) !== JSON.stringify(first)) stable = false;
}
check("500 repeat calls give an identical order", stable);
check("a reload mid-paper cannot move the options", stable);

console.log("\n── different students, different orders ──");
const orders = new Set<string>();
for (let i = 0; i < 400; i++) orders.add(optionOrderFor(`attempt-${i}`, Q1).join(""));
check(`400 students produce many distinct orders (${orders.size} seen)`, orders.size >= 12);
check("all 24 permutations are reachable", orders.size === 24, `saw ${orders.size}`);

console.log("\n── different questions in ONE attempt differ ──");
const perQ = new Set<string>();
for (let i = 0; i < 200; i++) perQ.add(optionOrderFor(A1, `question-${i}`).join(""));
check(`one student's 200 questions are not all in the same order (${perQ.size})`, perQ.size >= 12);

console.log("\n── THE POINT: a lopsided answer key stops mattering ──");
// Every question's correct answer is 'b' -- the worst realistic case, and
// close to what the reasoning bank looked like before it was rebalanced.
const landed: Record<string, number> = { a: 0, b: 0, c: 0, d: 0 };
const N = 4000;
for (let i = 0; i < N; i++) {
  const order = optionOrderFor(`attempt-${i}`, "same-question");
  landed[OPTION_KEYS[order.indexOf("b" as OptionKey)]]++;
}
const expected = N / 4;
const worst = Math.max(...Object.values(landed).map((v) => Math.abs(v - expected)));
check(
  `an all-'b' key lands in each POSITION about a quarter of the time (${JSON.stringify(landed)})`,
  worst < expected * 0.25,
  `worst deviation ${worst} of expected ${expected}`
);
check("so 'always answer B' is no longer a strategy", worst < expected * 0.25);

console.log("\n── applyOptionOrder ──");
const opts = [
  { key: "a" as OptionKey, text: "Alpha" },
  { key: "b" as OptionKey, text: "Bravo" },
  { key: "c" as OptionKey, text: "Charlie" },
  { key: "d" as OptionKey, text: "Delta" },
];
eq("shuffle off returns the authored order untouched",
  applyOptionOrder(opts, A1, Q1, false).map((o) => o.key), ["a", "b", "c", "d"]);

const shuffled = applyOptionOrder(opts, A1, Q1, true);
eq("shuffle on follows optionOrderFor", shuffled.map((o) => o.key), optionOrderFor(A1, Q1));
check("every option survives the permutation", shuffled.length === 4);
check("each key still carries its OWN text — this is what keeps scoring valid",
  shuffled.every((o) => o.text === opts.find((x) => x.key === o.key)!.text));

const short = [
  { key: "a" as OptionKey, text: "Alpha" },
  { key: "b" as OptionKey, text: "Bravo" },
];
check("a malformed row with only two options loses neither",
  applyOptionOrder(short, A1, Q1, true).length === 2);

console.log("\n── fail soft, never throw ──");
eq("a missing attemptId returns the authored order", optionOrderFor(null, Q1), ["a", "b", "c", "d"]);
eq("a missing questionId returns the authored order", optionOrderFor(A1, null), ["a", "b", "c", "d"]);
eq("both missing returns the authored order", optionOrderFor("", ""), ["a", "b", "c", "d"]);
eq("applyOptionOrder with no ids keeps the authored order",
  applyOptionOrder(opts, null, null, true).map((o) => o.key), ["a", "b", "c", "d"]);

console.log("\n── display labels are POSITIONAL ──");
eq("position 0 is labelled a", displayLabelFor(0), "a");
eq("position 3 is labelled d", displayLabelFor(3), "d");
check("an out-of-range position still returns something printable",
  typeof displayLabelFor(9) === "string" && displayLabelFor(9).length > 0);

console.log(`\n${fail === 0 ? "PASS" : "FAIL"} — ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
