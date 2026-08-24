/**
 * YIQ question-bank CSV parsing + shared question-bank shapes.
 *
 * PURE MODULE — no I/O, no Supabase, no React. It is imported by BOTH the
 * server action (app/yiq/actions/admin-questions.ts) and the client UI, so it
 * must stay free of `server-only` and of anything that touches the network.
 *
 * It also carries the question-bank TYPES for the same reason constants.ts
 * does: a "use server" file may export ONLY async functions, so the input and
 * row shapes its actions speak cannot live beside them.
 *
 * Parsing rule: NEVER throw. A national admin pasting a broken export must
 * get a per-line report, not a 500. Every failure comes back in `errors`,
 * every error names the 1-indexed CSV line it came from.
 */

/* ------------------------------------------------------------------ *
 * Shared question-bank shapes
 * ------------------------------------------------------------------ */

export const QUESTION_CATEGORIES = ["junior", "senior", "both"] as const;
export type QuestionCategory = (typeof QUESTION_CATEGORIES)[number];

export const QUESTION_TYPES = [
  "mcq",
  "visual",
  "audio",
  "direct",
  "pass_on",
  "rapid_fire",
] as const;
export type QuestionType = (typeof QUESTION_TYPES)[number];

export const QUESTION_DIFFICULTIES = ["easy", "medium", "hard"] as const;
export type QuestionDifficulty = (typeof QUESTION_DIFFICULTIES)[number];

export const OPTION_LETTERS = ["a", "b", "c", "d"] as const;
export type OptionLetter = (typeof OPTION_LETTERS)[number];

/** Minimum body length. Below this it is a typo, not a question. */
export const MIN_QUESTION_LENGTH = 10;

/** Page-size ceiling for the bank list — the server clamps to this. */
export const QUESTION_PAGE_SIZE_MAX = 50;
export const QUESTION_PAGE_SIZE_DEFAULT = 25;

/** Most rows one CSV may carry, so a bad paste cannot run away with a write. */
export const QUESTION_IMPORT_ROW_CAP = 1000;

export type KnownTopic = { id: string; slug: string; name?: string | null };

/** One row as the admin list renders it. */
export type QuestionBankRow = {
  id: string;
  topic_id: string;
  topic_name: string | null;
  topic_slug: string | null;
  category: string;
  question_type: string;
  question_text: string;
  option_a: string | null;
  option_b: string | null;
  option_c: string | null;
  option_d: string | null;
  correct_option: string | null;
  correct_answer_text: string | null;
  answer_explanation: string | null;
  difficulty: string;
  source: string | null;
  is_active: boolean;
  is_retired: boolean;
  times_used: number;
};

/** What create/update accept. Validated server-side; never trust the client. */
export type QuestionInput = {
  topicId: string;
  category: QuestionCategory;
  questionType: QuestionType;
  questionText: string;
  optionA?: string | null;
  optionB?: string | null;
  optionC?: string | null;
  optionD?: string | null;
  correctOption?: string | null;
  correctAnswerText?: string | null;
  answerExplanation?: string | null;
  difficulty: QuestionDifficulty;
  source?: string | null;
  isActive?: boolean;
};

export type QuestionFilter = {
  topicId?: string | null;
  category?: string | null;
  difficulty?: string | null;
  questionType?: string | null;
  search?: string | null;
  isActive?: boolean | null;
  includeRetired?: boolean;
  page?: number;
  pageSize?: number;
};

export type ImportSummary = {
  inserted: number;
  skipped: number;
  errors: QuestionCsvError[];
};

/** What step 1 of the two-step import reports back, before anything is written. */
export type ImportPreview = {
  ready: number;
  duplicates: number;
  errorCount: number;
  errors: QuestionCsvError[];
  /** First few rows, so the admin can eyeball what is about to land. */
  sample: {
    line: number;
    topicSlug: string;
    category: string;
    questionText: string;
    correctOption: string;
  }[];
};

/** Trimmed, validated, DB-column-shaped payload for an insert or update. */
export type QuestionWritePayload = {
  topic_id: string;
  category: QuestionCategory;
  question_type: QuestionType;
  question_text: string;
  option_a: string | null;
  option_b: string | null;
  option_c: string | null;
  option_d: string | null;
  correct_option: string | null;
  correct_answer_text: string | null;
  answer_explanation: string | null;
  difficulty: QuestionDifficulty;
  source: string | null;
  is_active: boolean;
};

/* ------------------------------------------------------------------ *
 * CSV tokenizer (RFC-4180-ish, deliberately forgiving)
 * ------------------------------------------------------------------ */

export type CsvRecord = {
  /** 1-indexed line in the ORIGINAL file where this record began. A quoted
   *  field may contain newlines, so record N is not always line N. */
  line: number;
  fields: string[];
};

export type TokenizeResult = {
  records: CsvRecord[];
  /** Line where a quote was opened and never closed, or null. */
  unterminatedQuoteLine: number | null;
};

/**
 * Split CSV text into records. Handles: a UTF-8 BOM, CRLF / LF / lone CR,
 * quoted fields carrying commas and newlines, and "" as an escaped quote.
 * A bare quote in the middle of an unquoted field is kept as a literal
 * character rather than treated as an error — spreadsheets emit those.
 */
export function tokenizeCsv(text: string): TokenizeResult {
  const src = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;

  const records: CsvRecord[] = [];
  let fields: string[] = [];
  let field = "";
  let inQuotes = false;
  let quoteOpenedAt: number | null = null;
  let line = 1;
  let recordLine = 1;
  let started = false;

  const endRecord = () => {
    fields.push(field);
    records.push({ line: recordLine, fields });
    fields = [];
    field = "";
    started = false;
  };

  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (!started) {
      recordLine = line;
      started = true;
    }

    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
          quoteOpenedAt = null;
        }
      } else {
        if (ch === "\n") line++;
        field += ch;
      }
      continue;
    }

    if (ch === '"' && field === "") {
      inQuotes = true;
      quoteOpenedAt = line;
      continue;
    }
    if (ch === ",") {
      fields.push(field);
      field = "";
      continue;
    }
    if (ch === "\r") {
      if (src[i + 1] === "\n") i++;
      line++;
      endRecord();
      continue;
    }
    if (ch === "\n") {
      line++;
      endRecord();
      continue;
    }
    field += ch;
  }

  if (started || field !== "" || fields.length > 0) endRecord();

  return { records, unterminatedQuoteLine: inQuotes ? quoteOpenedAt : null };
}

/* ------------------------------------------------------------------ *
 * Header mapping
 * ------------------------------------------------------------------ */

export const QUESTION_CSV_HEADERS = [
  "topic",
  "category",
  "question",
  "option_a",
  "option_b",
  "option_c",
  "option_d",
  "correct",
  "difficulty",
  "explanation",
  "source",
] as const;
export type CsvColumn = (typeof QUESTION_CSV_HEADERS)[number];

const REQUIRED_COLUMNS: CsvColumn[] = [
  "topic",
  "category",
  "question",
  "option_a",
  "option_b",
  "option_c",
  "option_d",
  "correct",
];

/** Case-, space-, underscore- and hyphen-insensitive header lookup. */
function normalizeHeader(raw: string): string {
  return raw.trim().toLowerCase().replace(/[\s_\-.]+/g, "");
}

const HEADER_ALIASES: Record<string, CsvColumn> = {
  topic: "topic",
  topicslug: "topic",
  topicname: "topic",
  subject: "topic",

  category: "category",
  cat: "category",
  group: "category",
  section: "category",

  question: "question",
  questiontext: "question",
  q: "question",
  prompt: "question",

  optiona: "option_a",
  opta: "option_a",
  a: "option_a",
  choicea: "option_a",
  answera: "option_a",

  optionb: "option_b",
  optb: "option_b",
  b: "option_b",
  choiceb: "option_b",
  answerb: "option_b",

  optionc: "option_c",
  optc: "option_c",
  c: "option_c",
  choicec: "option_c",
  answerc: "option_c",

  optiond: "option_d",
  optd: "option_d",
  d: "option_d",
  choiced: "option_d",
  answerd: "option_d",

  correct: "correct",
  correctoption: "correct",
  correctanswer: "correct",
  answer: "correct",
  key: "correct",
  ans: "correct",

  difficulty: "difficulty",
  level: "difficulty",
  diff: "difficulty",

  explanation: "explanation",
  answerexplanation: "explanation",
  why: "explanation",
  reason: "explanation",
  notes: "explanation",

  source: "source",
  ref: "source",
  reference: "source",
  credit: "source",
};

const CATEGORY_ALIASES: Record<string, QuestionCategory> = {
  junior: "junior",
  jr: "junior",
  j: "junior",
  senior: "senior",
  sr: "senior",
  s: "senior",
  both: "both",
  all: "both",
  any: "both",
};

/* ------------------------------------------------------------------ *
 * Parse + validate
 * ------------------------------------------------------------------ */

export type QuestionCsvError = {
  /** 1-indexed line in the CSV file. Line 1 is the header. */
  line: number;
  column?: CsvColumn | "file";
  message: string;
};

/** A row that passed every check and is ready to insert. */
export type QuestionDraft = {
  line: number;
  topicId: string;
  topicSlug: string;
  category: QuestionCategory;
  questionText: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  correctOption: OptionLetter;
  difficulty: QuestionDifficulty;
  explanation: string | null;
  source: string | null;
};

export type QuestionCsvResult = {
  rows: QuestionDraft[];
  errors: QuestionCsvError[];
};

/** Collapse whitespace + case for duplicate detection only. */
function dedupeKey(text: string): string {
  return text.trim().replace(/\s+/g, " ").toLowerCase();
}

function slugify(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * Parse a question CSV against the live topic list.
 *
 * Returns every row that is safe to insert plus one error per problem found.
 * A row with ANY error is excluded from `rows` — the import is fail-closed, so
 * a half-understood row never reaches the national bank.
 */
export function parseQuestionCsv(
  text: string,
  topics: KnownTopic[]
): QuestionCsvResult {
  const errors: QuestionCsvError[] = [];
  const rows: QuestionDraft[] = [];

  try {
    if (typeof text !== "string" || text.trim() === "") {
      return {
        rows,
        errors: [{ line: 1, column: "file", message: "The file is empty." }],
      };
    }

    const bySlug = new Map<string, KnownTopic>();
    const byName = new Map<string, KnownTopic>();
    for (const t of topics) {
      if (t?.slug) bySlug.set(t.slug.toLowerCase(), t);
      if (t?.name) byName.set(t.name.trim().toLowerCase(), t);
    }
    const knownSlugs = [...bySlug.keys()].sort();

    const { records, unterminatedQuoteLine } = tokenizeCsv(text);
    if (unterminatedQuoteLine !== null) {
      errors.push({
        line: unterminatedQuoteLine,
        column: "file",
        message:
          'A quote (") is opened here and never closed — everything after it was read as one field.',
      });
    }

    const nonBlank = records.filter((r) =>
      r.fields.some((f) => f.trim() !== "")
    );
    if (nonBlank.length === 0) {
      return {
        rows,
        errors: [
          ...errors,
          { line: 1, column: "file", message: "The file has no rows." },
        ],
      };
    }

    // ---- header ----
    const headerRecord = nonBlank[0];
    const columnAt: (CsvColumn | null)[] = [];
    const seenColumns = new Map<CsvColumn, number>();

    headerRecord.fields.forEach((raw, idx) => {
      const key = normalizeHeader(raw);
      const col = HEADER_ALIASES[key] ?? null;
      if (col && seenColumns.has(col)) {
        errors.push({
          line: headerRecord.line,
          column: col,
          message: `The column "${col}" appears twice (positions ${
            (seenColumns.get(col) ?? 0) + 1
          } and ${idx + 1}). The first one is used.`,
        });
        columnAt.push(null);
        return;
      }
      if (col) seenColumns.set(col, idx);
      columnAt.push(col);
    });

    const missing = REQUIRED_COLUMNS.filter((c) => !seenColumns.has(c));
    if (missing.length > 0) {
      errors.push({
        line: headerRecord.line,
        column: "file",
        message: `Missing required column${
          missing.length > 1 ? "s" : ""
        }: ${missing.join(", ")}. Expected header: ${QUESTION_CSV_HEADERS.join(
          ", "
        )}`,
      });
      return { rows, errors };
    }

    const headerCount = headerRecord.fields.length;
    const dataRecords = nonBlank.slice(1);

    if (dataRecords.length === 0) {
      errors.push({
        line: headerRecord.line,
        column: "file",
        message: "The file has a header but no question rows.",
      });
      return { rows, errors };
    }

    if (dataRecords.length > QUESTION_IMPORT_ROW_CAP) {
      errors.push({
        line: headerRecord.line,
        column: "file",
        message: `This file has ${dataRecords.length} rows. Import at most ${QUESTION_IMPORT_ROW_CAP} at a time — split it and run the import again.`,
      });
      return { rows, errors };
    }

    const seenQuestions = new Map<string, number>();

    for (const rec of dataRecords) {
      const line = rec.line;

      if (rec.fields.length > headerCount) {
        errors.push({
          line,
          column: "file",
          message: `This row has ${rec.fields.length} values but the header has ${headerCount} columns — check for a stray comma or an unescaped quote.`,
        });
        continue;
      }

      const get = (col: CsvColumn): string => {
        const idx = seenColumns.get(col);
        if (idx === undefined) return "";
        return (rec.fields[idx] ?? "").trim();
      };

      const rowErrors: QuestionCsvError[] = [];
      const err = (column: CsvColumn, message: string) =>
        rowErrors.push({ line, column, message });

      // topic
      const topicRaw = get("topic");
      let topic: KnownTopic | undefined;
      if (topicRaw === "") {
        err("topic", "topic is empty.");
      } else {
        topic =
          bySlug.get(topicRaw.toLowerCase()) ??
          bySlug.get(slugify(topicRaw)) ??
          byName.get(topicRaw.toLowerCase());
        if (!topic) {
          err(
            "topic",
            `unknown topic "${topicRaw}" — expected one of: ${knownSlugs.join(
              ", "
            )}`
          );
        }
      }

      // category
      const categoryRaw = get("category");
      let category: QuestionCategory | undefined;
      if (categoryRaw === "") {
        err("category", "category is empty — use junior, senior or both.");
      } else {
        category = CATEGORY_ALIASES[categoryRaw.toLowerCase()];
        if (!category) {
          err(
            "category",
            `category "${categoryRaw}" is not valid — use junior, senior or both.`
          );
        }
      }

      // question
      const questionText = get("question");
      if (questionText === "") {
        err("question", "question is empty.");
      } else if (questionText.length < MIN_QUESTION_LENGTH) {
        err(
          "question",
          `question is too short (${questionText.length} characters) — needs at least ${MIN_QUESTION_LENGTH}.`
        );
      }

      // options
      const optionA = get("option_a");
      const optionB = get("option_b");
      const optionC = get("option_c");
      const optionD = get("option_d");
      const optionCols: [CsvColumn, string][] = [
        ["option_a", optionA],
        ["option_b", optionB],
        ["option_c", optionC],
        ["option_d", optionD],
      ];
      for (const [col, val] of optionCols) {
        if (val === "") {
          err(col, `${col} is empty — a multiple-choice question needs all four options.`);
        }
      }

      // correct
      const correctRaw = get("correct");
      let correctOption: OptionLetter | undefined;
      if (correctRaw === "") {
        err("correct", "correct is empty — put a, b, c or d.");
      } else {
        const c = correctRaw.toLowerCase();
        if ((OPTION_LETTERS as readonly string[]).includes(c)) {
          correctOption = c as OptionLetter;
        } else {
          err(
            "correct",
            `correct is "${correctRaw}" — it must be a, b, c or d.`
          );
        }
      }

      // difficulty (optional)
      const difficultyRaw = get("difficulty");
      let difficulty: QuestionDifficulty = "medium";
      if (difficultyRaw !== "") {
        const d = difficultyRaw.toLowerCase();
        if ((QUESTION_DIFFICULTIES as readonly string[]).includes(d)) {
          difficulty = d as QuestionDifficulty;
        } else {
          err(
            "difficulty",
            `difficulty "${difficultyRaw}" is not valid — use easy, medium or hard.`
          );
        }
      }

      const explanation = get("explanation") || null;
      const source = get("source") || null;

      if (rowErrors.length > 0) {
        errors.push(...rowErrors);
        continue;
      }

      // duplicate inside this file — checked only against rows that were
      // otherwise valid, so a broken row never shadows a good one.
      const key = dedupeKey(questionText);
      const firstLine = seenQuestions.get(key);
      if (firstLine !== undefined) {
        errors.push({
          line,
          column: "question",
          message: `duplicate — the same question is already on line ${firstLine} of this file.`,
        });
        continue;
      }
      seenQuestions.set(key, line);

      rows.push({
        line,
        topicId: topic!.id,
        topicSlug: topic!.slug,
        category: category!,
        questionText,
        optionA,
        optionB,
        optionC,
        optionD,
        correctOption: correctOption!,
        difficulty,
        explanation,
        source,
      });
    }

    return { rows, errors };
  } catch (e) {
    // Fail closed: a parser crash must never become a 500 on an admin page.
    return {
      rows: [],
      errors: [
        {
          line: 1,
          column: "file",
          message: `Could not read this file: ${
            e instanceof Error ? e.message : String(e)
          }`,
        },
      ],
    };
  }
}

/* ------------------------------------------------------------------ *
 * Server-side validation for the single-question form
 * ------------------------------------------------------------------ */

/**
 * Validate a create/update payload. Mirrors the database CHECK constraints
 * (yiq_questions_mcq_complete and the enum-ish checks) so an admin gets a
 * sentence instead of a Postgres 23514.
 *
 * Returns [] when the input is good.
 */
export function validateQuestionInput(input: QuestionInput): string[] {
  const problems: string[] = [];

  if (!input.topicId || input.topicId.trim() === "") {
    problems.push("Choose a topic.");
  }
  if (!(QUESTION_CATEGORIES as readonly string[]).includes(input.category)) {
    problems.push("Category must be junior, senior or both.");
  }
  if (!(QUESTION_TYPES as readonly string[]).includes(input.questionType)) {
    problems.push("That question type is not one YIQ uses.");
  }
  if (!(QUESTION_DIFFICULTIES as readonly string[]).includes(input.difficulty)) {
    problems.push("Difficulty must be easy, medium or hard.");
  }

  const text = (input.questionText ?? "").trim();
  if (text.length < MIN_QUESTION_LENGTH) {
    problems.push(
      `The question needs at least ${MIN_QUESTION_LENGTH} characters.`
    );
  }

  if (input.questionType === "mcq") {
    const opts: [string, string | null | undefined][] = [
      ["Option A", input.optionA],
      ["Option B", input.optionB],
      ["Option C", input.optionC],
      ["Option D", input.optionD],
    ];
    for (const [label, val] of opts) {
      if (!val || val.trim() === "") {
        problems.push(`${label} is empty — a multiple-choice question needs all four.`);
      }
    }
    const c = (input.correctOption ?? "").trim().toLowerCase();
    if (!(OPTION_LETTERS as readonly string[]).includes(c)) {
      problems.push("Mark which option is correct (a, b, c or d).");
    }
  }

  return problems;
}

/** A ready-to-fill CSV, shown in the import panel so nobody guesses headers. */
export const QUESTION_CSV_TEMPLATE = [
  QUESTION_CSV_HEADERS.join(","),
  'india,both,"Which Article of the Constitution abolishes untouchability?",Article 14,Article 15,Article 21,Article 17,d,medium,"Part III, Fundamental Rights",YIQ handbook',
  "science-technology,senior,Which organisation launched Chandrayaan-3?,DRDO,ISRO,NASA,HAL,b,easy,,YIQ handbook",
].join("\n");
