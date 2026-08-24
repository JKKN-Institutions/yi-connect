"use server";

/**
 * YIQ national question-bank actions.
 *
 * ONE GATE ONLY: the question bank is PLATFORM master data — a change here
 * reaches every chapter in the country — so every export below is gated by
 * requireYiqSuperAdmin(). The event-scoped gate (getYiqEventAccess /
 * requireYiqEventManage) does NOT apply and must never be mixed in here.
 *
 * Reads and writes go through createServiceClient(): the `yiq` tables carry
 * RLS ENABLED with ZERO policies by design, so the gate above IS the security
 * boundary. Never call the service client without passing the gate first.
 *
 * A "use server" file may export only async functions — the types and the CSV
 * parser these actions speak live in lib/yiq/question-csv.ts.
 */

import { revalidatePath } from "next/cache";
import { createServiceClient } from "@/lib/yiq/supabase/server";
import { requireYiqSuperAdmin } from "@/lib/yiq/auth/require-super-admin";
import {
  parseQuestionCsv,
  validateQuestionInput,
  QUESTION_PAGE_SIZE_DEFAULT,
  QUESTION_PAGE_SIZE_MAX,
  type ImportPreview,
  type ImportSummary,
  type KnownTopic,
  type QuestionBankRow,
  type QuestionCsvError,
  type QuestionFilter,
  type QuestionInput,
  type QuestionWritePayload,
} from "@/lib/yiq/question-csv";

type Ok<T> = { success: true } & T;
type OkPlain = { success: true };
type Err = { success: false; error: string };

const ADMIN_PATH = "/yiq/admin/questions";

/**
 * PostgREST filter values are assembled into a URL grammar where `,` `(` `)`
 * and `"` are structural, and `*` / `%` are `like` wildcards. A search box is
 * free text, so strip those rather than let a stray comma turn into a second
 * filter term. Apostrophes are NOT structural and are kept — half the bank
 * says "India's".
 */
function sanitizeSearch(raw: string): string {
  return raw.replace(/[,()"\\*%]/g, " ").trim().slice(0, 120);
}

type TopicRow = { id: string; slug: string; name: string };

async function loadTopics(
  svc: Awaited<ReturnType<typeof createServiceClient>>
): Promise<TopicRow[]> {
  const { data } = await svc
    .from("topics")
    .select("id, slug, name")
    .eq("is_active", true)
    .order("display_order");
  return (data ?? []) as TopicRow[];
}

/* ------------------------------------------------------------------ *
 * Read
 * ------------------------------------------------------------------ */

export async function listQuestions(
  filter: QuestionFilter = {}
): Promise<
  Ok<{
    rows: QuestionBankRow[];
    total: number;
    page: number;
    pageSize: number;
  }> | Err
> {
  const gate = await requireYiqSuperAdmin();
  if (!gate.ok) return { success: false, error: gate.error };

  const pageSize = Math.min(
    Math.max(1, Math.trunc(filter.pageSize ?? QUESTION_PAGE_SIZE_DEFAULT)),
    QUESTION_PAGE_SIZE_MAX
  );
  const page = Math.max(1, Math.trunc(filter.page ?? 1));
  const from = (page - 1) * pageSize;

  const svc = await createServiceClient();

  let q = svc
    .from("questions")
    .select(
      "id, topic_id, category, question_type, question_text, option_a, option_b, option_c, option_d, correct_option, correct_answer_text, answer_explanation, difficulty, source, is_active, is_retired, times_used, topics(name, slug)",
      { count: "exact" }
    );

  if (filter.topicId) q = q.eq("topic_id", filter.topicId);
  if (filter.category) q = q.eq("category", filter.category);
  if (filter.difficulty) q = q.eq("difficulty", filter.difficulty);
  if (filter.questionType) q = q.eq("question_type", filter.questionType);
  if (typeof filter.isActive === "boolean") q = q.eq("is_active", filter.isActive);
  // Retired questions are hidden unless asked for — they are history, not bank.
  if (!filter.includeRetired) q = q.eq("is_retired", false);

  const search = filter.search ? sanitizeSearch(filter.search) : "";
  if (search) q = q.ilike("question_text", `%${search}%`);

  const { data, error, count } = await q
    .order("created_at", { ascending: false })
    .range(from, from + pageSize - 1);

  if (error) {
    console.error("[yiq] listQuestions failed", error);
    return { success: false, error: "Could not load the question bank." };
  }

  type Embedded = Omit<QuestionBankRow, "topic_name" | "topic_slug"> & {
    topics: { name: string | null; slug: string | null } | null;
  };

  const rows: QuestionBankRow[] = ((data ?? []) as unknown as Embedded[]).map(
    ({ topics, ...rest }) => ({
      ...rest,
      topic_name: topics?.name ?? null,
      topic_slug: topics?.slug ?? null,
    })
  );

  return { success: true, rows, total: count ?? rows.length, page, pageSize };
}

/* ------------------------------------------------------------------ *
 * Write — single question
 * ------------------------------------------------------------------ */

function normalize(v: string | null | undefined): string | null {
  const t = (v ?? "").trim();
  return t === "" ? null : t;
}

/** Shared shape for insert and update — validated, trimmed, DB-ready. */
async function toRowPayload(
  svc: Awaited<ReturnType<typeof createServiceClient>>,
  input: QuestionInput
): Promise<{ ok: true; payload: QuestionWritePayload } | Err> {
  const problems = validateQuestionInput(input);
  if (problems.length > 0) {
    return { success: false, error: problems.join(" ") };
  }

  // The topic must exist and be active — a client can post any uuid.
  const { data: topic } = await svc
    .from("topics")
    .select("id")
    .eq("id", input.topicId)
    .maybeSingle();
  if (!topic) {
    return { success: false, error: "That topic no longer exists." };
  }

  const isMcq = input.questionType === "mcq";

  return {
    ok: true,
    payload: {
      topic_id: input.topicId,
      category: input.category,
      question_type: input.questionType,
      question_text: input.questionText.trim(),
      option_a: normalize(input.optionA),
      option_b: normalize(input.optionB),
      option_c: normalize(input.optionC),
      option_d: normalize(input.optionD),
      // Only an MCQ carries a lettered key; anything else answers in free text,
      // and a stray letter would fail the DB's mcq-completeness CHECK sideways.
      correct_option: isMcq
        ? (input.correctOption ?? "").trim().toLowerCase()
        : null,
      correct_answer_text: normalize(input.correctAnswerText),
      answer_explanation: normalize(input.answerExplanation),
      difficulty: input.difficulty,
      source: normalize(input.source),
      is_active: input.isActive ?? true,
    },
  };
}

export async function createQuestion(
  input: QuestionInput
): Promise<Ok<{ id: string }> | Err> {
  const gate = await requireYiqSuperAdmin();
  if (!gate.ok) return { success: false, error: gate.error };

  const svc = await createServiceClient();
  const built = await toRowPayload(svc, input);
  if (!("ok" in built)) return built;

  // Same guard the importer uses: the bank must not carry the question twice.
  const text = input.questionText.trim();
  const { data: clash } = await svc
    .from("questions")
    .select("id")
    .eq("question_text", text)
    .limit(1)
    .maybeSingle();
  if (clash) {
    return {
      success: false,
      error: "That exact question is already in the bank.",
    };
  }

  const { data, error } = await svc
    .from("questions")
    .insert({ ...built.payload, created_by: gate.userId })
    .select("id")
    .single();

  if (error || !data) {
    console.error("[yiq] createQuestion failed", error);
    return { success: false, error: "Could not save the question." };
  }

  await svc.from("audit_log").insert({
    actor_user_id: gate.userId,
    actor_label: gate.email,
    action: "question_created",
    entity_type: "question",
    entity_id: data.id,
    detail: { topic_id: input.topicId, category: input.category },
  });

  revalidatePath(ADMIN_PATH);
  revalidatePath("/yiq/admin");
  return { success: true, id: data.id };
}

export async function updateQuestion(
  id: string,
  input: QuestionInput
): Promise<OkPlain | Err> {
  const gate = await requireYiqSuperAdmin();
  if (!gate.ok) return { success: false, error: gate.error };
  if (!id) return { success: false, error: "No question was named." };

  const svc = await createServiceClient();
  const built = await toRowPayload(svc, input);
  if (!("ok" in built)) return built;

  const { data: existing } = await svc
    .from("questions")
    .select("id, times_used")
    .eq("id", id)
    .maybeSingle();
  if (!existing) return { success: false, error: "That question no longer exists." };

  // Editing text INTO an existing question's text would put the same question
  // in the pool twice, and generatePaper() draws by id — so one paper could
  // show it twice. Same guard as create, minus this row.
  const { data: clash } = await svc
    .from("questions")
    .select("id")
    .eq("question_text", built.payload.question_text)
    .neq("id", id)
    .limit(1)
    .maybeSingle();
  if (clash) {
    return {
      success: false,
      error: "Another question in the bank already has exactly that text.",
    };
  }

  const { error } = await svc
    .from("questions")
    .update({ ...built.payload, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) {
    console.error("[yiq] updateQuestion failed", error);
    return { success: false, error: "Could not save the change." };
  }

  await svc.from("audit_log").insert({
    actor_user_id: gate.userId,
    actor_label: gate.email,
    action: "question_updated",
    entity_type: "question",
    entity_id: id,
    // Worth knowing at audit time: editing a question that has already been
    // sat changes how a past paper reads back.
    detail: { times_used: existing.times_used },
  });

  revalidatePath(ADMIN_PATH);
  revalidatePath("/yiq/admin");
  return { success: true };
}

/**
 * Retire a question — set the flag, NEVER delete the row.
 *
 * yiq.paper_questions.question_id references yiq.questions(id) ON DELETE
 * RESTRICT (supabase/migrations/yiq_00_schema_foundation.sql), so a question
 * that has ever been put on a paper cannot be deleted at all — Postgres would
 * refuse. That constraint exists on purpose: attempts are graded against the
 * paper's questions, so removing one would corrupt every past result that
 * referenced it. Retiring keeps the history intact and simply takes the
 * question out of the pool that generatePaper() draws from (that query filters
 * on is_active = true AND is_retired = false).
 *
 * Pass retired=false to put a question back into circulation.
 */
export async function retireQuestion(
  id: string,
  retired: boolean = true
): Promise<OkPlain | Err> {
  const gate = await requireYiqSuperAdmin();
  if (!gate.ok) return { success: false, error: gate.error };
  if (!id) return { success: false, error: "No question was named." };

  const svc = await createServiceClient();

  const { data: existing } = await svc
    .from("questions")
    .select("id, is_retired")
    .eq("id", id)
    .maybeSingle();
  if (!existing) return { success: false, error: "That question no longer exists." };

  const { error } = await svc
    .from("questions")
    .update({ is_retired: retired, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) {
    console.error("[yiq] retireQuestion failed", error);
    return {
      success: false,
      error: retired
        ? "Could not retire the question."
        : "Could not bring the question back.",
    };
  }

  await svc.from("audit_log").insert({
    actor_user_id: gate.userId,
    actor_label: gate.email,
    action: retired ? "question_retired" : "question_unretired",
    entity_type: "question",
    entity_id: id,
    detail: { was_retired: existing.is_retired },
  });

  revalidatePath(ADMIN_PATH);
  revalidatePath("/yiq/admin");
  return { success: true };
}

/* ------------------------------------------------------------------ *
 * Write — CSV import
 * ------------------------------------------------------------------ */

/**
 * Every question_text already in the bank.
 *
 * Read wholesale rather than with `.in("question_text", [...])`: PostgREST's
 * `in.(...)` list is a comma-separated grammar, and question text legitimately
 * carries commas and quotes, which would corrupt the filter. The bank is
 * admin-scale, and this runs only on an explicit import.
 */
async function fetchExistingQuestionTexts(
  svc: Awaited<ReturnType<typeof createServiceClient>>
): Promise<Set<string>> {
  const seen = new Set<string>();
  const chunk = 1000;
  for (let from = 0; from < 50_000; from += chunk) {
    const { data, error } = await svc
      .from("questions")
      .select("question_text")
      .range(from, from + chunk - 1);
    if (error || !data || data.length === 0) break;
    for (const r of data) seen.add(r.question_text);
    if (data.length < chunk) break;
  }
  return seen;
}

/**
 * Step 1 of the two-step import: parse and report, write NOTHING.
 * The admin sees the per-row errors before anything reaches the bank.
 */
export async function previewQuestionImport(
  csvText: string
): Promise<Ok<ImportPreview> | Err> {
  const gate = await requireYiqSuperAdmin();
  if (!gate.ok) return { success: false, error: gate.error };

  const svc = await createServiceClient();
  const topics = await loadTopics(svc);
  const { rows, errors } = parseQuestionCsv(csvText ?? "", topics as KnownTopic[]);

  const existing = rows.length > 0 ? await fetchExistingQuestionTexts(svc) : new Set<string>();
  const fresh = rows.filter((r) => !existing.has(r.questionText));

  return {
    success: true,
    ready: fresh.length,
    duplicates: rows.length - fresh.length,
    errorCount: errors.length,
    errors: errors.slice(0, 200),
    sample: fresh.slice(0, 5).map((r) => ({
      line: r.line,
      topicSlug: r.topicSlug,
      category: r.category,
      questionText: r.questionText,
      correctOption: r.correctOption,
    })),
  };
}

/**
 * Step 2: commit. Safe to run twice — a question whose exact `question_text`
 * is already in the bank is counted as skipped, not inserted, so re-running
 * the same file inserts nothing the second time.
 */
export async function importQuestions(
  csvText: string
): Promise<Ok<ImportSummary> | Err> {
  const gate = await requireYiqSuperAdmin();
  if (!gate.ok) return { success: false, error: gate.error };

  const svc = await createServiceClient();
  const topics = await loadTopics(svc);
  const { rows, errors } = parseQuestionCsv(csvText ?? "", topics as KnownTopic[]);

  if (rows.length === 0) {
    return { success: true, inserted: 0, skipped: 0, errors };
  }

  const existing = await fetchExistingQuestionTexts(svc);
  const fresh = rows.filter((r) => !existing.has(r.questionText));
  const skipped = rows.length - fresh.length;

  if (fresh.length === 0) {
    return { success: true, inserted: 0, skipped, errors };
  }

  const payload = fresh.map((r) => ({
    topic_id: r.topicId,
    category: r.category,
    question_type: "mcq",
    question_text: r.questionText,
    option_a: r.optionA,
    option_b: r.optionB,
    option_c: r.optionC,
    option_d: r.optionD,
    correct_option: r.correctOption,
    answer_explanation: r.explanation,
    difficulty: r.difficulty,
    source: r.source,
    created_by: gate.userId,
  }));

  let inserted = 0;
  const chunk = 100;
  const writeErrors: QuestionCsvError[] = [];

  for (let i = 0; i < payload.length; i += chunk) {
    const slice = payload.slice(i, i + chunk);
    const { data, error } = await svc
      .from("questions")
      .insert(slice)
      .select("id");

    if (error) {
      console.error("[yiq] importQuestions chunk failed", error);
      writeErrors.push({
        line: fresh[i]?.line ?? 1,
        column: "file",
        message: `Rows from line ${fresh[i]?.line ?? "?"} onwards could not be saved (${
          error.message
        }). Everything before them was saved — fix these and import again.`,
      });
      break;
    }
    inserted += data?.length ?? slice.length;
  }

  await svc.from("audit_log").insert({
    actor_user_id: gate.userId,
    actor_label: gate.email,
    action: "questions_imported",
    entity_type: "question_bank",
    detail: {
      parsed: rows.length,
      inserted,
      skipped_duplicates: skipped,
      parse_errors: errors.length,
    },
  });

  revalidatePath(ADMIN_PATH);
  revalidatePath("/yiq/admin");

  return {
    success: true,
    inserted,
    skipped,
    errors: [...errors, ...writeErrors],
  };
}
