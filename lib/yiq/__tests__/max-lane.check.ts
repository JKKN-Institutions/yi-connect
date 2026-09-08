/**
 * Max-lane reply parsing. Run: npx tsx lib/yiq/__tests__/max-lane.check.ts
 *
 * The runner does NOT validate model output - the strict JSON we ask for
 * arrives as raw text, sometimes fenced, sometimes with prose around it. Every
 * shape below has been seen in this org's existing readers, and a parse
 * failure must be a failure, never a silent empty result.
 */
import { parseStrictJson, PAYLOAD_CEILING_BYTES } from "../ai/parse";

let pass = 0, fail = 0;
const OK = String.fromCharCode(10004), NO = String.fromCharCode(10008);
const check = (n: string, c: boolean, d = "") =>
  c ? (pass++, console.log(`  ${OK} ${n}`)) : (fail++, console.log(`  ${NO} ${n} ${d}`));
const eq = (n: string, a: unknown, b: unknown) =>
  check(n, JSON.stringify(a) === JSON.stringify(b), `got ${JSON.stringify(a)}`);

console.log("\n-- parseStrictJson --");
eq("bare object", parseStrictJson('{"a":1}'), { a: 1 });
eq("bare array", parseStrictJson('[{"a":1}]'), [{ a: 1 }]);
eq("json fence", parseStrictJson('```json\n{"a":1}\n```'), { a: 1 });
eq("bare fence", parseStrictJson('```\n{"a":1}\n```'), { a: 1 });
eq("prose before", parseStrictJson('Here you go:\n{"a":1}'), { a: 1 });
eq("prose after", parseStrictJson('{"a":1}\nHope that helps!'), { a: 1 });
eq("prose both sides", parseStrictJson('Sure -\n{"a":1}\nlet me know.'), { a: 1 });
eq("array wrapped in prose", parseStrictJson('Result:\n[1,2]\ndone'), [1, 2]);
eq("nested braces survive", parseStrictJson('{"a":{"b":[1,2]}}'), { a: { b: [1, 2] } });
eq("whitespace only is null", parseStrictJson("   "), null);
eq("empty is null", parseStrictJson(""), null);
eq("plain prose is null", parseStrictJson("I could not do that."), null);
eq("truncated json is null", parseStrictJson('{"a":1'), null);
eq("fence with junk inside is null", parseStrictJson("```json\nnot json\n```"), null);
check("never throws on hostile input",
  [null, undefined, "{{{{", "]]]]", " ", "```", '{"a":'].every((x) => {
    try { parseStrictJson(x as string); return true; } catch { return false; }
  }));

console.log("\n-- payload ceiling --");
check("ceiling is the door's documented 32768", PAYLOAD_CEILING_BYTES === 32768);
check("a realistic practice payload fits",
  Buffer.byteLength(JSON.stringify({
    task: "yiq.practice_questions",
    payload: { topics: ["india","sports"], weak: ["sports"],
               seen: Array.from({length: 60}, (_, i) => `q${i}`) },
    dedupe_key: "00000000-0000-0000-0000-000000000000",
  })) < PAYLOAD_CEILING_BYTES);

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail === 0 ? 0 : 1);
