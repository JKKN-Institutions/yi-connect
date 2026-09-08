/**
 * YIQ question-bank CSV checks.
 *
 * This repo has NO test runner installed (no vitest, no jest), so this is a
 * standalone script rather than a spec file:
 *
 *     npx tsx lib/yiq/__tests__/question-csv.check.ts
 *
 * It exits non-zero on any failure, so it can be wired into CI as-is.
 *
 * What is being defended: an admin pastes a spreadsheet export into the
 * national question bank. A row this parser waves through reaches every
 * chapter's paper, and a row it silently drops is a question the admin thinks
 * they imported. So every case below is either "must be rejected with the
 * right line number" or "must survive intact".
 */
import {
  tokenizeCsv,
  parseQuestionCsv,
  validateQuestionInput,
  QUESTION_CSV_TEMPLATE,
  QUESTION_IMPORT_ROW_CAP,
  type KnownTopic,
  type QuestionInput,
} from "../question-csv";

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

const TOPICS: KnownTopic[] = [
  { id: "t-india", slug: "india", name: "India" },
  { id: "t-sci", slug: "science-technology", name: "Science & Technology" },
  { id: "t-sport", slug: "sports", name: "Sports" },
];

const HEAD = "topic,category,question,option_a,option_b,option_c,option_d,correct,difficulty,explanation,source";
const GOOD = "india,both,Who was the first Deputy Prime Minister of India?,Patel,Nehru,Prasad,Azad,a,easy,,deck";

/** Every message an error carries, joined — for substring assertions. */
const msgs = (errs: { message: string }[]) => errs.map((e) => e.message).join(" | ");

console.log("\n── tokenizer ──");
{
  const t = tokenizeCsv("a,b,c\n1,2,3");
  eq("splits a simple grid", t.records.map((r) => r.fields), [
    ["a", "b", "c"],
    ["1", "2", "3"],
  ]);
  eq("no unterminated quote", t.unterminatedQuoteLine, null);
}
{
  const t = tokenizeCsv('a,"b,with,commas",c');
  eq("a quoted field keeps its commas", t.records[0].fields, [
    "a",
    "b,with,commas",
    "c",
  ]);
}
{
  const t = tokenizeCsv('a,"he said ""hi""",c');
  eq('"" becomes one literal quote', t.records[0].fields, ['a', 'he said "hi"', "c"]);
}
{
  const t = tokenizeCsv("a,b\r\n1,2\r\n");
  eq("CRLF line endings", t.records.map((r) => r.fields), [
    ["a", "b"],
    ["1", "2"],
  ]);
  eq("a trailing CRLF makes no phantom record", t.records.length, 2);
}
{
  const t = tokenizeCsv("﻿a,b\n1,2");
  eq("a UTF-8 BOM is stripped from the first header", t.records[0].fields[0], "a");
}
{
  const t = tokenizeCsv('a,"line one\nline two",c\nx,y,z');
  eq("a newline inside quotes stays in the field", t.records[0].fields[1], "line one\nline two");
  eq("  and the NEXT record's line number accounts for it", t.records[1].line, 3);
}
{
  const t = tokenizeCsv('a,"never closed,b');
  check("an unterminated quote is reported", t.unterminatedQuoteLine === 1);
}
{
  const t = tokenizeCsv("a,b\n\n\n1,2\n\n");
  const nonBlank = t.records.filter((r) => r.fields.some((f) => f.trim() !== ""));
  eq("blank lines survive tokenizing but are separable", nonBlank.length, 2);
  eq("  and the data row keeps its true line number", nonBlank[1].line, 4);
}
{
  const t = tokenizeCsv("a,b\r1,2");
  eq("a lone CR also ends a record", t.records.length, 2);
}

console.log("\n── headers ──");
{
  const { rows, errors } = parseQuestionCsv(`${HEAD}\n${GOOD}`, TOPICS);
  eq("the canonical header parses one row", rows.length, 1);
  eq("  with no errors", errors.length, 0);
}
{
  const alias =
    "Topic , CATEGORY,Question Text,Option A,option-b,OPTION_C,Option  D,Correct Answer,Level,Why,Reference";
  const { rows, errors } = parseQuestionCsv(`${alias}\n${GOOD}`, TOPICS);
  eq("headers match case/space/underscore-insensitively", rows.length, 1);
  eq("  with no errors", errors.length, 0);
}
{
  const { rows, errors } = parseQuestionCsv(
    `topic,category,question,option_a,option_b,option_c\n${GOOD}`,
    TOPICS
  );
  eq("missing required columns rejects the whole file", rows.length, 0);
  check("  and names them", /option_d/.test(msgs(errors)) && /correct/.test(msgs(errors)));
  eq("  the complaint is on the header line", errors[0].line, 1);
}
{
  const { errors } = parseQuestionCsv(
    `topic,category,question,option_a,option_b,option_c,option_d,correct,answer\n${GOOD}`,
    TOPICS
  );
  check("a repeated column is flagged", /appears twice/.test(msgs(errors)));
}
{
  const { rows, errors } = parseQuestionCsv(HEAD, TOPICS);
  eq("header with no data rows -> nothing", rows.length, 0);
  check("  and says so", /no question rows/.test(msgs(errors)));
}

console.log("\n── row validation (each must be REJECTED) ──");
const badRows: [string, string, RegExp][] = [
  ["missing option_c", "india,both,Who was the first Deputy PM of India?,Patel,Nehru,,Azad,a,,,", /option_c is empty/],
  ["correct is 'e'", "india,both,Who was the first Deputy PM of India?,Patel,Nehru,Prasad,Azad,e,,,", /must be a, b, c or d/],
  ["correct is the answer text", "india,both,Who was the first Deputy PM of India?,Patel,Nehru,Prasad,Azad,Patel,,,", /must be a, b, c or d/],
  ["unknown topic", "quantum,both,Who was the first Deputy PM of India?,Patel,Nehru,Prasad,Azad,a,,,", /unknown topic/],
  ["question under 10 chars", "india,both,Who? ,Patel,Nehru,Prasad,Azad,a,,,", /too short/],
  ["empty question", "india,both,,Patel,Nehru,Prasad,Azad,a,,,", /question is empty/],
  ["empty category", "india,,Who was the first Deputy PM of India?,Patel,Nehru,Prasad,Azad,a,,,", /category is empty/],
  ["nonsense category", "india,middle,Who was the first Deputy PM of India?,Patel,Nehru,Prasad,Azad,a,,,", /not valid/],
  ["nonsense difficulty", "india,both,Who was the first Deputy PM of India?,Patel,Nehru,Prasad,Azad,a,brutal,,", /difficulty "brutal"/],
  ["empty topic", ",both,Who was the first Deputy PM of India?,Patel,Nehru,Prasad,Azad,a,,,", /topic is empty/],
];
for (const [label, row, pattern] of badRows) {
  const { rows, errors } = parseQuestionCsv(`${HEAD}\n${row}`, TOPICS);
  check(
    `${label} -> rejected`,
    rows.length === 0 && pattern.test(msgs(errors)),
    `rows=${rows.length} errs=${msgs(errors)}`
  );
  check(`  ${label} -> blamed on line 2`, errors.every((e) => e.line === 2));
}

console.log("\n── row validation (each must be ACCEPTED) ──");
{
  const { rows, errors } = parseQuestionCsv(
    `${HEAD}\nIndia,BOTH,Who was the first Deputy PM of India?,Patel,Nehru,Prasad,Azad,D,HARD,,`,
    TOPICS
  );
  eq("topic by display NAME, and everything upper-case", rows.length, 1);
  eq("  correct is lower-cased", rows[0]?.correctOption, "d");
  eq("  difficulty is lower-cased", rows[0]?.difficulty, "hard");
  eq("  category is lower-cased", rows[0]?.category, "both");
  eq("  no errors", errors.length, 0);
}
{
  const { rows } = parseQuestionCsv(
    `${HEAD}\nindia,jr,Who was the first Deputy PM of India?,Patel,Nehru,Prasad,Azad,a,,,`,
    TOPICS
  );
  eq("'jr' means junior", rows[0]?.category, "junior");
}
{
  const { rows } = parseQuestionCsv(
    `${HEAD}\nScience & Technology,senior,Which body launched Chandrayaan-3?,DRDO,ISRO,NASA,HAL,b,,,`,
    TOPICS
  );
  eq("a topic name with punctuation still resolves", rows[0]?.topicId, "t-sci");
}
{
  const { rows, errors } = parseQuestionCsv(
    `${HEAD}\nindia,both,Who was the first Deputy PM of India?,Patel,Nehru,Prasad,Azad,a`,
    TOPICS
  );
  eq("omitted trailing OPTIONAL columns are fine", rows.length, 1);
  eq("  difficulty falls back to medium", rows[0]?.difficulty, "medium");
  eq("  explanation is null not empty string", rows[0]?.explanation, null);
  eq("  no errors", errors.length, 0);
}
{
  const { rows } = parseQuestionCsv(`${HEAD}\n${GOOD}`, TOPICS);
  eq("a blank optional cell becomes null", rows[0]?.explanation, null);
  eq("  a filled one survives", rows[0]?.source, "deck");
}

console.log("\n── the nasty CSV cases ──");
{
  const csv =
    `﻿${HEAD}\r\n` +
    `india,both,"Which river is known as ""Dakshin Ganga"", the Ganges of the South?",Krishna,Godavari,Kaveri,Narmada,b,medium,"Part I, Rivers",deck\r\n` +
    `\r\n` +
    `\r\n`;
  const { rows, errors } = parseQuestionCsv(csv, TOPICS);
  eq("BOM + CRLF + escaped quotes + commas + blank trailing lines", rows.length, 1);
  eq("  no errors", errors.length, 0);
  eq(
    "  the question text is intact",
    rows[0]?.questionText,
    'Which river is known as "Dakshin Ganga", the Ganges of the South?'
  );
  eq("  the comma inside a quoted optional field survives", rows[0]?.explanation, "Part I, Rivers");
}
{
  const csv = `${HEAD}\nindia,both,Who was the first Deputy PM of India?,Patel,Nehru,Prasad,Azad,a,,,,EXTRA`;
  const { rows, errors } = parseQuestionCsv(csv, TOPICS);
  eq("a stray comma (too many values) rejects the row", rows.length, 0);
  check("  and says why", /more/.test(msgs(errors)) || /stray comma/.test(msgs(errors)));
}
{
  const csv = `${HEAD}\n${GOOD}\n${GOOD}`;
  const { rows, errors } = parseQuestionCsv(csv, TOPICS);
  eq("an exact duplicate inside the file keeps only the first", rows.length, 1);
  check("  and points at the first line", /already on line 2/.test(msgs(errors)));
  eq("  the duplicate is blamed on line 3", errors[0].line, 3);
}
{
  const csv =
    `${HEAD}\n` +
    `india,both,  Who   was the   first Deputy PM of India?  ,Patel,Nehru,Prasad,Azad,a,,,\n` +
    `india,senior,Who was the first Deputy PM of India?,Patel,Nehru,Prasad,Azad,a,,,`;
  const { rows, errors } = parseQuestionCsv(csv, TOPICS);
  eq("a duplicate that differs only in spacing/case is caught", rows.length, 1);
  check("  and is reported", /duplicate/.test(msgs(errors)));
}
{
  // A row that is invalid for its own reason must not shadow a later good copy.
  const csv =
    `${HEAD}\n` +
    `quantum,both,Who was the first Deputy PM of India?,Patel,Nehru,Prasad,Azad,a,,,\n` +
    `${GOOD}`;
  const { rows, errors } = parseQuestionCsv(csv, TOPICS);
  eq("a broken row does not claim the question text", rows.length, 1);
  eq("  the good copy is the one kept", rows[0]?.line, 3);
  check("  only the topic error is reported", /unknown topic/.test(msgs(errors)));
  check("  and no duplicate error", !/duplicate/.test(msgs(errors)));
}
{
  const csv =
    `${HEAD}\n` +
    `india,both,"An unclosed quote swallows the rest,Patel,Nehru,Prasad,Azad,a,,,\n` +
    `${GOOD}`;
  const { rows, errors } = parseQuestionCsv(csv, TOPICS);
  check("an unterminated quote is reported, not thrown", errors.length > 0);
  check("  and nothing half-understood is imported", rows.length === 0);
}
{
  const csv =
    `${HEAD}\n` +
    `india,both,"A question that spans\ntwo lines in the file?",Patel,Nehru,Prasad,Azad,a,,,\n` +
    `sports,both,Who won the 1983 Cricket World Cup?,India,WI,Aus,Eng,a,,,`;
  const { rows, errors } = parseQuestionCsv(csv, TOPICS);
  eq("a multi-line quoted question parses", rows.length, 2);
  eq("  no errors", errors.length, 0);
  eq("  the SECOND row's line number skips the wrapped line", rows[1]?.line, 4);
}
{
  // Line numbers must stay honest once a wrapped field is followed by a bad row.
  const csv =
    `${HEAD}\n` +
    `india,both,"Wrapped\nquestion here?",Patel,Nehru,Prasad,Azad,a,,,\n` +
    `india,both,Who was the first Deputy PM of India?,Patel,Nehru,Prasad,Azad,z,,,`;
  const { errors } = parseQuestionCsv(csv, TOPICS);
  eq("the bad row after a wrapped field is line 4", errors[0]?.line, 4);
}

console.log("\n── never throws ──");
const junk = [
  "",
  "   ",
  ",,,,,,,,,,",
  '"',
  '""""""',
  "\u0000\u0001",
  "\n\n\n",
  "topic\n\n",
  "🎉,🎈\n🎊",
];
for (const j of junk) {
  let threw = false;
  let out: { rows: unknown[]; errors: unknown[] } = { rows: [], errors: [] };
  try {
    out = parseQuestionCsv(j, TOPICS);
  } catch {
    threw = true;
  }
  check(
    `junk ${JSON.stringify(j.slice(0, 12))} -> errors, never a throw`,
    !threw && out.rows.length === 0 && out.errors.length > 0
  );
}
{
  // Deliberately wrong at runtime — a server action can be handed anything.
  let threw = false;
  let a: ReturnType<typeof parseQuestionCsv> | null = null;
  let b: ReturnType<typeof parseQuestionCsv> | null = null;
  try {
    a = parseQuestionCsv(undefined as unknown as string, TOPICS);
    b = parseQuestionCsv(`${HEAD}\n${GOOD}`, null as unknown as KnownTopic[]);
  } catch {
    threw = true;
  }
  check("a non-string body does not throw", !threw && a !== null && a.rows.length === 0);
  check("  and reports an error instead", (a?.errors.length ?? 0) > 0);
  check("a null topic list does not throw", !threw && b !== null && b.rows.length === 0);
  check("  and rejects every row rather than importing blind", (b?.errors.length ?? 0) > 0);
}

console.log("\n── volume guard ──");
{
  const many = [HEAD];
  for (let i = 0; i < QUESTION_IMPORT_ROW_CAP + 1; i++) {
    many.push(`india,both,Question number ${i} about India?,Patel,Nehru,Prasad,Azad,a,,,`);
  }
  const { rows, errors } = parseQuestionCsv(many.join("\n"), TOPICS);
  eq("over the row cap nothing is imported", rows.length, 0);
  check("  and the cap is explained", /at most/.test(msgs(errors)));
}
{
  const many = [HEAD];
  for (let i = 0; i < 300; i++) {
    many.push(`india,both,Question number ${i} about India?,Patel,Nehru,Prasad,Azad,a,,,`);
  }
  const { rows, errors } = parseQuestionCsv(many.join("\n"), TOPICS);
  eq("300 distinct rows all parse", rows.length, 300);
  eq("  no errors", errors.length, 0);
}

console.log("\n── the shipped template ──");
{
  const { rows, errors } = parseQuestionCsv(QUESTION_CSV_TEMPLATE, TOPICS);
  eq("the sample offered in the UI actually imports", rows.length, 2);
  eq("  with no errors", errors.length, 0);
  eq("  quoted commas in the sample survive", rows[0]?.explanation, "Part III, Fundamental Rights");
}

console.log("\n── validateQuestionInput (the single-question form) ──");
const base: QuestionInput = {
  topicId: "t-india",
  category: "both",
  questionType: "mcq",
  questionText: "Who was the first Deputy Prime Minister of India?",
  optionA: "Patel",
  optionB: "Nehru",
  optionC: "Prasad",
  optionD: "Azad",
  correctOption: "a",
  difficulty: "medium",
};
eq("a complete MCQ passes", validateQuestionInput(base), []);
check(
  "an MCQ missing option D is rejected",
  validateQuestionInput({ ...base, optionD: "" }).some((m) => /Option D/.test(m))
);
check(
  "an MCQ with no key is rejected",
  validateQuestionInput({ ...base, correctOption: "" }).some((m) => /correct/i.test(m))
);
check(
  "an MCQ keyed 'e' is rejected",
  validateQuestionInput({ ...base, correctOption: "e" }).length > 0
);
check(
  "a short question is rejected",
  validateQuestionInput({ ...base, questionText: "Who?" }).some((m) => /at least/.test(m))
);
check(
  "no topic is rejected",
  validateQuestionInput({ ...base, topicId: "" }).some((m) => /topic/i.test(m))
);
check(
  "a bogus category is rejected",
  validateQuestionInput({
    ...base,
    category: "middle" as unknown as QuestionInput["category"],
  }).length > 0
);
check(
  "a bogus question type is rejected",
  validateQuestionInput({
    ...base,
    questionType: "essay" as unknown as QuestionInput["questionType"],
  }).length > 0
);
eq(
  "a non-MCQ needs no options",
  validateQuestionInput({
    ...base,
    questionType: "direct",
    optionA: "",
    optionB: "",
    optionC: "",
    optionD: "",
    correctOption: "",
    correctAnswerText: "Sardar Vallabhbhai Patel",
  }),
  []
);

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail === 0 ? 0 : 1);
