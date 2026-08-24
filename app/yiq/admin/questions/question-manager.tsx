"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  QUESTION_CSV_HEADERS,
  QUESTION_CSV_TEMPLATE,
  QUESTION_DIFFICULTIES,
  QUESTION_TYPES,
  type ImportPreview,
  type QuestionBankRow,
  type QuestionCategory,
  type QuestionDifficulty,
  type QuestionInput,
  type QuestionType,
} from "@/lib/yiq/question-csv";
import {
  createQuestion,
  importQuestions,
  listQuestions,
  previewQuestionImport,
  retireQuestion,
  updateQuestion,
} from "../../actions/admin-questions";

const INK = "#0a1633";
const PAPER = "#f7f4ed";
const SAFFRON = "#e8a33d";
const GREEN = "#14795a";
const VERMILION = "#c8452f";
const DIM = "#9fb0d4";
const RULE = "rgba(247,244,237,0.14)";

type Topic = { id: string; slug: string; name: string };

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "0.625rem 0.75rem",
  borderRadius: "0.5rem",
  border: `1.5px solid ${RULE}`,
  background: "rgba(247,244,237,0.06)",
  color: PAPER,
  fontSize: "0.875rem",
};

function Label({ children }: { children: React.ReactNode }) {
  return (
    <span className="yiq-eyebrow" style={{ color: DIM }}>
      {children}
    </span>
  );
}

const emptyDraft = (topicId: string): QuestionInput => ({
  topicId,
  category: "both",
  questionType: "mcq",
  questionText: "",
  optionA: "",
  optionB: "",
  optionC: "",
  optionD: "",
  correctOption: "a",
  correctAnswerText: "",
  answerExplanation: "",
  difficulty: "medium",
  source: "",
  isActive: true,
});

function rowToDraft(r: QuestionBankRow): QuestionInput {
  return {
    topicId: r.topic_id,
    category: (r.category as QuestionCategory) ?? "both",
    questionType: (r.question_type as QuestionType) ?? "mcq",
    questionText: r.question_text,
    optionA: r.option_a ?? "",
    optionB: r.option_b ?? "",
    optionC: r.option_c ?? "",
    optionD: r.option_d ?? "",
    correctOption: r.correct_option ?? "a",
    correctAnswerText: r.correct_answer_text ?? "",
    answerExplanation: r.answer_explanation ?? "",
    difficulty: (r.difficulty as QuestionDifficulty) ?? "medium",
    source: r.source ?? "",
    isActive: r.is_active,
  };
}

export function QuestionManager({
  topics,
  initialRows,
  initialTotal,
  pageSize,
  retiredCount,
  loadError,
}: {
  topics: Topic[];
  initialRows: QuestionBankRow[];
  initialTotal: number;
  pageSize: number;
  retiredCount: number;
  loadError: string | null;
}) {
  const [rows, setRows] = useState<QuestionBankRow[]>(initialRows);
  const [total, setTotal] = useState(initialTotal);
  const [page, setPage] = useState(1);
  const [pending, start] = useTransition();

  // filters
  const [topicId, setTopicId] = useState("");
  const [category, setCategory] = useState("");
  const [difficulty, setDifficulty] = useState("");
  const [activeOnly, setActiveOnly] = useState(false);
  const [includeRetired, setIncludeRetired] = useState(false);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  // panels
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<QuestionInput>(() =>
    emptyDraft(topics[0]?.id ?? "")
  );
  const [importOpen, setImportOpen] = useState(false);
  const [csvText, setCsvText] = useState("");
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const formRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const refresh = useCallback(
    (nextPage: number) => {
      start(async () => {
        const res = await listQuestions({
          topicId: topicId || null,
          category: category || null,
          difficulty: difficulty || null,
          search: debouncedSearch || null,
          isActive: activeOnly ? true : null,
          includeRetired,
          page: nextPage,
        });
        if (!res.success) {
          toast.error(res.error);
          return;
        }
        setRows(res.rows);
        setTotal(res.total);
        setPage(res.page);
      });
    },
    [topicId, category, difficulty, debouncedSearch, activeOnly, includeRetired]
  );

  // Skip the first run — the server already rendered page 1.
  const mounted = useRef(false);
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    refresh(1);
  }, [refresh]);

  function openNew() {
    setEditingId(null);
    setDraft(emptyDraft(topics[0]?.id ?? ""));
    setFormOpen(true);
    setImportOpen(false);
    requestAnimationFrame(() =>
      formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
    );
  }

  function openEdit(r: QuestionBankRow) {
    setEditingId(r.id);
    setDraft(rowToDraft(r));
    setFormOpen(true);
    setImportOpen(false);
    requestAnimationFrame(() =>
      formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
    );
  }

  function save(e: React.FormEvent) {
    e.preventDefault();
    start(async () => {
      const res = editingId
        ? await updateQuestion(editingId, draft)
        : await createQuestion(draft);
      if (!res.success) {
        toast.error(res.error);
        return;
      }
      toast.success(editingId ? "Question updated" : "Question added");
      setFormOpen(false);
      setEditingId(null);
      refresh(page);
    });
  }

  function toggleRetire(r: QuestionBankRow) {
    const next = !r.is_retired;
    if (next && r.times_used > 0) {
      const ok = window.confirm(
        `This question has been used on ${r.times_used} paper${
          r.times_used === 1 ? "" : "s"
        }. Retiring keeps every past result intact and only takes it out of future papers. Retire it?`
      );
      if (!ok) return;
    }
    start(async () => {
      const res = await retireQuestion(r.id, next);
      if (!res.success) {
        toast.error(res.error);
        return;
      }
      toast.success(next ? "Question retired" : "Question back in the bank");
      refresh(page);
    });
  }

  function runPreview() {
    if (csvText.trim() === "") {
      toast.error("Paste a CSV or choose a file first.");
      return;
    }
    start(async () => {
      const res = await previewQuestionImport(csvText);
      if (!res.success) {
        toast.error(res.error);
        return;
      }
      setPreview(res);
      if (res.errorCount > 0) {
        toast.error(
          `${res.errorCount} problem${res.errorCount === 1 ? "" : "s"} found — nothing imported yet.`
        );
      } else {
        toast.success(`${res.ready} question${res.ready === 1 ? "" : "s"} ready to import.`);
      }
    });
  }

  function commitImport() {
    start(async () => {
      const res = await importQuestions(csvText);
      if (!res.success) {
        toast.error(res.error);
        return;
      }
      toast.success(
        `Imported ${res.inserted}${res.skipped > 0 ? ` · ${res.skipped} already in the bank` : ""}`
      );
      setPreview(null);
      setCsvText("");
      setImportOpen(false);
      refresh(1);
    });
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      setCsvText(text);
      setPreview(null);
      toast.success(`${file.name} loaded — check it before importing.`);
    } catch {
      toast.error("Could not read that file.");
    }
  }

  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const isMcq = draft.questionType === "mcq";

  return (
    <div className="mt-7">
      {loadError ? (
        <p
          className="rounded-xl px-4 py-3 text-[0.875rem]"
          style={{ background: `${VERMILION}22`, color: "#f0a396" }}
        >
          {loadError}
        </p>
      ) : null}

      {/* Counts + primary actions. Kept full-width and visible at 390px — the
          product owner reviews this on a phone. */}
      <div className="flex flex-wrap items-center gap-2">
        <span
          className="yiq-data rounded-full px-3 py-1.5 text-[0.8125rem]"
          style={{ background: "rgba(247,244,237,0.07)", color: PAPER }}
        >
          {total} in bank
        </span>
        <span
          className="yiq-data rounded-full px-3 py-1.5 text-[0.8125rem]"
          style={{ background: "rgba(247,244,237,0.07)", color: DIM }}
        >
          {retiredCount} retired
        </span>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={openNew}
          className="min-w-[9rem] flex-1 rounded-full px-5 py-3 text-[0.875rem] font-bold"
          style={{ background: SAFFRON, color: INK }}
        >
          Add a question
        </button>
        <button
          type="button"
          onClick={() => {
            setImportOpen((o) => !o);
            setFormOpen(false);
          }}
          className="min-w-[9rem] flex-1 rounded-full border px-5 py-3 text-[0.875rem] font-bold"
          style={{ borderColor: RULE, color: PAPER }}
        >
          {importOpen ? "Close import" : "Import a CSV"}
        </button>
      </div>

      {/* ---------------- CSV import: two steps, preview then commit -------- */}
      {importOpen ? (
        <section
          className="mt-4 rounded-2xl border p-4 sm:p-5"
          style={{ borderColor: RULE }}
        >
          <h2 className="yiq-display text-[1.25rem]">Import questions</h2>
          <p className="mt-1.5 text-[0.8125rem] leading-relaxed" style={{ color: DIM }}>
            Nothing is written until you press Import. Header row:{" "}
            <span className="yiq-data">{QUESTION_CSV_HEADERS.join(", ")}</span>.
            The last three are optional.
          </p>

          <div className="mt-3 flex flex-wrap gap-2">
            <input
              type="file"
              accept=".csv,text/csv,text/plain"
              onChange={onFile}
              className="max-w-full text-[0.8125rem]"
              style={{ color: DIM }}
              aria-label="Choose a CSV file"
            />
            <button
              type="button"
              onClick={() => {
                setCsvText(QUESTION_CSV_TEMPLATE);
                setPreview(null);
              }}
              className="rounded-full border px-4 py-2 text-[0.8125rem]"
              style={{ borderColor: RULE, color: DIM }}
            >
              Load a sample
            </button>
          </div>

          <label className="mt-3 block">
            <Label>Or paste the CSV</Label>
            <textarea
              value={csvText}
              onChange={(e) => {
                setCsvText(e.target.value);
                setPreview(null);
              }}
              rows={6}
              spellCheck={false}
              className="yiq-data mt-1.5"
              style={{ ...inputStyle, fontSize: "0.75rem", lineHeight: 1.6 }}
              placeholder={QUESTION_CSV_HEADERS.join(",")}
            />
          </label>

          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={runPreview}
              disabled={pending}
              className="min-w-[9rem] flex-1 rounded-full px-5 py-3 text-[0.875rem] font-bold disabled:opacity-60"
              style={{ background: "rgba(247,244,237,0.12)", color: PAPER }}
            >
              {pending ? "Checking…" : "1 · Check the file"}
            </button>
            <button
              type="button"
              onClick={commitImport}
              disabled={pending || !preview || preview.ready === 0}
              className="min-w-[9rem] flex-1 rounded-full px-5 py-3 text-[0.875rem] font-bold disabled:opacity-40"
              style={{ background: SAFFRON, color: INK }}
            >
              {preview
                ? `2 · Import ${preview.ready}`
                : "2 · Import"}
            </button>
          </div>

          {preview ? (
            <div className="mt-4" aria-live="polite">
              <div className="flex flex-wrap gap-2">
                {[
                  { l: "ready", v: preview.ready, c: GREEN },
                  { l: "already in bank", v: preview.duplicates, c: "#5a6480" },
                  { l: "problems", v: preview.errorCount, c: VERMILION },
                ].map((s) => (
                  <span
                    key={s.l}
                    className="yiq-data rounded-full px-3 py-1.5 text-[0.8125rem] font-bold"
                    style={{ background: `${s.c}33`, color: PAPER }}
                  >
                    {s.v} {s.l}
                  </span>
                ))}
              </div>

              {preview.errors.length > 0 ? (
                <ul className="mt-3 grid gap-1.5">
                  {preview.errors.map((er, i) => (
                    <li
                      key={`${er.line}-${i}`}
                      className="rounded-lg px-3 py-2 text-[0.8125rem] leading-snug"
                      style={{ background: `${VERMILION}1f` }}
                    >
                      <span className="yiq-data" style={{ color: SAFFRON }}>
                        line {er.line}
                        {er.column && er.column !== "file" ? ` · ${er.column}` : ""}
                      </span>
                      <span className="ml-2" style={{ color: PAPER }}>
                        {er.message}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : null}

              {preview.sample.length > 0 ? (
                <ul className="mt-3 grid gap-1.5">
                  {preview.sample.map((s) => (
                    <li
                      key={s.line}
                      className="rounded-lg px-3 py-2 text-[0.8125rem] leading-snug"
                      style={{ background: "rgba(247,244,237,0.05)" }}
                    >
                      <span className="yiq-data" style={{ color: DIM }}>
                        {s.topicSlug} · {s.category} · answer {s.correctOption}
                      </span>
                      <span className="mt-0.5 block">{s.questionText}</span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}
        </section>
      ) : null}

      {/* ---------------- Add / edit form ---------------------------------- */}
      <div ref={formRef}>
        {formOpen ? (
          <form
            onSubmit={save}
            className="mt-4 grid gap-3 rounded-2xl border p-4 sm:grid-cols-2 sm:p-5"
            style={{ borderColor: RULE }}
          >
            <h2 className="yiq-display text-[1.25rem] sm:col-span-2">
              {editingId ? "Edit question" : "New question"}
            </h2>

            <label>
              <Label>Topic</Label>
              <select
                value={draft.topicId}
                onChange={(e) => setDraft({ ...draft, topicId: e.target.value })}
                style={inputStyle}
                className="mt-1.5"
                required
              >
                {topics.map((t) => (
                  <option key={t.id} value={t.id} style={{ color: INK }}>
                    {t.name}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <Label>Category</Label>
              <select
                value={draft.category}
                onChange={(e) =>
                  setDraft({ ...draft, category: e.target.value as QuestionCategory })
                }
                style={inputStyle}
                className="mt-1.5"
              >
                <option value="both" style={{ color: INK }}>Both</option>
                <option value="junior" style={{ color: INK }}>Junior · Cl 9–10</option>
                <option value="senior" style={{ color: INK }}>Senior · Cl 11–12</option>
              </select>
            </label>

            <label>
              <Label>Kind</Label>
              <select
                value={draft.questionType}
                onChange={(e) =>
                  setDraft({ ...draft, questionType: e.target.value as QuestionType })
                }
                style={inputStyle}
                className="mt-1.5"
              >
                {QUESTION_TYPES.map((t) => (
                  <option key={t} value={t} style={{ color: INK }}>
                    {t === "mcq" ? "Multiple choice" : t.replace("_", " ")}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <Label>Difficulty</Label>
              <select
                value={draft.difficulty}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    difficulty: e.target.value as QuestionDifficulty,
                  })
                }
                style={inputStyle}
                className="mt-1.5"
              >
                {QUESTION_DIFFICULTIES.map((d) => (
                  <option key={d} value={d} style={{ color: INK }}>
                    {d}
                  </option>
                ))}
              </select>
            </label>

            <label className="sm:col-span-2">
              <Label>Question</Label>
              <textarea
                value={draft.questionText}
                onChange={(e) => setDraft({ ...draft, questionText: e.target.value })}
                rows={3}
                required
                style={inputStyle}
                className="mt-1.5"
              />
            </label>

            {isMcq ? (
              <>
                {(["a", "b", "c", "d"] as const).map((k) => {
                  const field = (
                    { a: "optionA", b: "optionB", c: "optionC", d: "optionD" } as const
                  )[k];
                  return (
                    <label key={k}>
                      <Label>Option {k.toUpperCase()}</Label>
                      <input
                        value={(draft[field] as string) ?? ""}
                        onChange={(e) => setDraft({ ...draft, [field]: e.target.value })}
                        style={inputStyle}
                        className="mt-1.5"
                      />
                    </label>
                  );
                })}
                <label>
                  <Label>Correct option</Label>
                  <select
                    value={draft.correctOption ?? "a"}
                    onChange={(e) =>
                      setDraft({ ...draft, correctOption: e.target.value })
                    }
                    style={inputStyle}
                    className="mt-1.5"
                  >
                    {(["a", "b", "c", "d"] as const).map((k) => (
                      <option key={k} value={k} style={{ color: INK }}>
                        {k.toUpperCase()}
                      </option>
                    ))}
                  </select>
                </label>
              </>
            ) : (
              <label className="sm:col-span-2">
                <Label>Answer (free text)</Label>
                <input
                  value={draft.correctAnswerText ?? ""}
                  onChange={(e) =>
                    setDraft({ ...draft, correctAnswerText: e.target.value })
                  }
                  style={inputStyle}
                  className="mt-1.5"
                />
              </label>
            )}

            <label className="sm:col-span-2">
              <Label>Explanation (optional)</Label>
              <textarea
                value={draft.answerExplanation ?? ""}
                onChange={(e) =>
                  setDraft({ ...draft, answerExplanation: e.target.value })
                }
                rows={2}
                style={inputStyle}
                className="mt-1.5"
              />
            </label>

            <label>
              <Label>Source (optional)</Label>
              <input
                value={draft.source ?? ""}
                onChange={(e) => setDraft({ ...draft, source: e.target.value })}
                style={inputStyle}
                className="mt-1.5"
              />
            </label>

            <label className="flex items-end gap-2 pb-2">
              <input
                type="checkbox"
                checked={draft.isActive ?? true}
                onChange={(e) => setDraft({ ...draft, isActive: e.target.checked })}
              />
              <span className="text-[0.875rem]">In circulation</span>
            </label>

            <div className="flex flex-wrap gap-2 sm:col-span-2">
              <button
                type="submit"
                disabled={pending}
                className="min-w-[9rem] flex-1 rounded-full px-5 py-3 text-[0.875rem] font-bold disabled:opacity-60"
                style={{ background: SAFFRON, color: INK }}
              >
                {pending ? "Saving…" : editingId ? "Save changes" : "Add to the bank"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setFormOpen(false);
                  setEditingId(null);
                }}
                className="min-w-[9rem] flex-1 rounded-full border px-5 py-3 text-[0.875rem] font-bold"
                style={{ borderColor: RULE, color: DIM }}
              >
                Cancel
              </button>
            </div>
          </form>
        ) : null}
      </div>

      {/* ---------------- Filters ------------------------------------------ */}
      <section className="mt-6">
        <label className="block">
          <Label>Search the bank</Label>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Words from the question"
            style={inputStyle}
            className="mt-1.5"
          />
        </label>

        <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
          <select
            value={topicId}
            onChange={(e) => setTopicId(e.target.value)}
            style={inputStyle}
            aria-label="Filter by topic"
          >
            <option value="" style={{ color: INK }}>All topics</option>
            {topics.map((t) => (
              <option key={t.id} value={t.id} style={{ color: INK }}>
                {t.name}
              </option>
            ))}
          </select>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            style={inputStyle}
            aria-label="Filter by category"
          >
            <option value="" style={{ color: INK }}>All categories</option>
            <option value="junior" style={{ color: INK }}>Junior</option>
            <option value="senior" style={{ color: INK }}>Senior</option>
            <option value="both" style={{ color: INK }}>Both</option>
          </select>
          <select
            value={difficulty}
            onChange={(e) => setDifficulty(e.target.value)}
            style={inputStyle}
            aria-label="Filter by difficulty"
          >
            <option value="" style={{ color: INK }}>Any difficulty</option>
            {QUESTION_DIFFICULTIES.map((d) => (
              <option key={d} value={d} style={{ color: INK }}>
                {d}
              </option>
            ))}
          </select>
        </div>

        <div className="mt-2 flex flex-wrap gap-4">
          <label className="flex items-center gap-2 text-[0.8125rem]">
            <input
              type="checkbox"
              checked={activeOnly}
              onChange={(e) => setActiveOnly(e.target.checked)}
            />
            In circulation only
          </label>
          <label className="flex items-center gap-2 text-[0.8125rem]">
            <input
              type="checkbox"
              checked={includeRetired}
              onChange={(e) => setIncludeRetired(e.target.checked)}
            />
            Show retired
          </label>
        </div>
      </section>

      {/* ---------------- The list ----------------------------------------- */}
      <ul className="mt-4 grid gap-2.5" aria-busy={pending}>
        {rows.length === 0 ? (
          <li
            className="rounded-xl px-4 py-6 text-center text-[0.875rem]"
            style={{ background: "rgba(247,244,237,0.05)", color: DIM }}
          >
            No questions match those filters.
          </li>
        ) : null}

        {rows.map((r) => (
          <li
            key={r.id}
            className="rounded-xl border p-4"
            style={{
              borderColor: RULE,
              opacity: r.is_retired ? 0.62 : 1,
            }}
          >
            <p className="yiq-eyebrow" style={{ color: DIM }}>
              {r.topic_name ?? "—"} · {r.category} · {r.difficulty}
              {r.times_used > 0 ? ` · used ${r.times_used}×` : ""}
              {r.is_retired ? " · RETIRED" : ""}
              {!r.is_active ? " · PAUSED" : ""}
            </p>
            <p className="mt-1.5 text-[0.9375rem] leading-snug font-semibold">
              {r.question_text}
            </p>

            {r.question_type === "mcq" ? (
              <ul className="mt-2 grid gap-1">
                {(
                  [
                    ["a", r.option_a],
                    ["b", r.option_b],
                    ["c", r.option_c],
                    ["d", r.option_d],
                  ] as const
                ).map(([k, v]) => {
                  const right = r.correct_option === k;
                  return (
                    <li
                      key={k}
                      className="flex items-start gap-2 text-[0.8125rem] leading-snug"
                      style={{ color: right ? "#7fd4b0" : DIM }}
                    >
                      <span className="yiq-data font-bold">{k.toUpperCase()}</span>
                      <span>{v ?? "—"}</span>
                    </li>
                  );
                })}
              </ul>
            ) : r.correct_answer_text ? (
              <p className="mt-2 text-[0.8125rem]" style={{ color: "#7fd4b0" }}>
                Answer: {r.correct_answer_text}
              </p>
            ) : null}

            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => openEdit(r)}
                disabled={pending}
                className="min-w-[7rem] flex-1 rounded-full px-4 py-2.5 text-[0.8125rem] font-bold disabled:opacity-60"
                style={{ background: "rgba(247,244,237,0.1)", color: PAPER }}
              >
                Edit
              </button>
              <button
                type="button"
                onClick={() => toggleRetire(r)}
                disabled={pending}
                className="min-w-[7rem] flex-1 rounded-full px-4 py-2.5 text-[0.8125rem] font-bold disabled:opacity-60"
                style={
                  r.is_retired
                    ? { background: `${GREEN}33`, color: "#7fd4b0" }
                    : { background: `${VERMILION}2b`, color: "#f0a396" }
                }
              >
                {r.is_retired ? "Bring back" : "Retire"}
              </button>
            </div>
          </li>
        ))}
      </ul>

      {/* ---------------- Pagination --------------------------------------- */}
      {total > pageSize ? (
        <div className="mt-5 flex flex-wrap items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => refresh(page - 1)}
            disabled={pending || page <= 1}
            className="rounded-full border px-5 py-2.5 text-[0.8125rem] font-bold disabled:opacity-40"
            style={{ borderColor: RULE, color: PAPER }}
          >
            ← Previous
          </button>
          <span className="yiq-data text-[0.8125rem]" style={{ color: DIM }}>
            {page} / {pageCount}
          </span>
          <button
            type="button"
            onClick={() => refresh(page + 1)}
            disabled={pending || page >= pageCount}
            className="rounded-full border px-5 py-2.5 text-[0.8125rem] font-bold disabled:opacity-40"
            style={{ borderColor: RULE, color: PAPER }}
          >
            Next →
          </button>
        </div>
      ) : null}
    </div>
  );
}
