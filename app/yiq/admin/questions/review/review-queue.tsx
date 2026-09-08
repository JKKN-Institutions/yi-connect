"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { approveQuestions } from "../../../actions/admin-questions";

const PAPER = "#f7f4ed";
const SAFFRON = "#e8a33d";
const DIM = "#9fb0d4";
const RULE = "rgba(247,244,237,0.14)";
const GREEN = "#7bbf8a";

export type ReviewRow = {
  id: string;
  question_text: string | null;
  option_a: string | null;
  option_b: string | null;
  option_c: string | null;
  option_d: string | null;
  correct_option: string | null;
  answer_explanation: string | null;
  difficulty: string | null;
  category: string | null;
  source: string | null;
  /**
   * NOT `topics` — listQuestions() FLATTENS the PostgREST embed into
   * topic_name/topic_slug and drops the nested object entirely. Declaring the
   * nested shape here as optional made TypeScript accept it silently and it
   * was `undefined` on every row in production, so every question rendered as
   * "No topic". Required, not optional, so a future shape change fails tsc
   * instead of failing quietly on screen.
   */
  topic_name: string | null;
};

const KEYS = ["a", "b", "c", "d"] as const;

/**
 * The reviewer's screen.
 *
 * DELIBERATELY SHOWS THE ANSWER AND THE EXPLANATION TOGETHER. The whole
 * point of the review is checking that the explanation actually justifies
 * the recorded answer; hiding either would make the click meaningless.
 *
 * Nothing is selected when the page loads. A reviewer has to tick each
 * question they have actually read - there is no "select all", because
 * approving 200 questions in one unread click is exactly the outcome
 * Director rule 7 exists to prevent.
 */
export function ReviewQueue({
  initialQuestions,
  initialTotal,
  loadError,
}: {
  initialQuestions: ReviewRow[];
  initialTotal: number;
  loadError: string | null;
}) {
  const router = useRouter();
  const [rows, setRows] = useState<ReviewRow[]>(initialQuestions);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [pending, start] = useTransition();

  if (loadError) {
    return (
      <p className="p-6 text-[0.9375rem]" style={{ color: "#e88" }}>
        {loadError}
      </p>
    );
  }

  if (rows.length === 0) {
    return (
      <p className="p-6 text-[0.9375rem]" style={{ color: DIM }}>
        Nothing is waiting for review. Every drafted question has been read.
      </p>
    );
  }

  const toggle = (id: string) =>
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const submit = () => {
    const ids = [...picked];
    if (ids.length === 0) {
      toast.error("Tick the questions you have read first.");
      return;
    }
    start(async () => {
      const res = await approveQuestions(ids);
      if (!res.success) {
        toast.error(res.error);
        return;
      }
      if (res.approved > 0) {
        toast.success(
          `${res.approved} question${res.approved === 1 ? "" : "s"} moved into the competition pool.`
        );
      }
      for (const r of res.refused.slice(0, 4)) toast.error(r.reason);
      if (res.refused.length > 4) {
        toast.error(`${res.refused.length - 4} more could not be approved.`);
      }
      const done = new Set(ids);
      setRows((prev) => prev.filter((q) => !done.has(q.id) || res.refused.some((r) => r.id === q.id)));
      setPicked(new Set());
      router.refresh();
    });
  };

  return (
    <div>
      <div
        className="sticky top-0 z-10 flex flex-wrap items-center gap-3 border-b px-4 py-3"
        style={{ borderColor: RULE, background: "rgba(10,22,51,0.96)" }}
      >
        <span className="text-[0.875rem]" style={{ color: DIM }}>
          {initialTotal} awaiting review · {picked.size} ticked
        </span>
        <button
          type="button"
          onClick={submit}
          disabled={pending || picked.size === 0}
          className="ml-auto rounded-full px-4 py-2 text-[0.875rem] font-medium disabled:opacity-40"
          style={{ background: SAFFRON, color: "#0a1633" }}
        >
          {pending ? "Approving…" : `Approve ${picked.size || ""}`.trim()}
        </button>
      </div>

      <ol className="divide-y" style={{ borderColor: RULE }}>
        {rows.map((q) => {
          const on = picked.has(q.id);
          const key = (q.correct_option ?? "").trim().toLowerCase();
          return (
            <li key={q.id} className="px-4 py-5" style={{ borderColor: RULE }}>
              <label className="flex cursor-pointer items-start gap-3">
                <input
                  type="checkbox"
                  checked={on}
                  onChange={() => toggle(q.id)}
                  className="mt-1 h-4 w-4 shrink-0"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-[0.75rem] uppercase tracking-wide" style={{ color: DIM }}>
                    {q.topic_name ?? "No topic"} · {q.difficulty ?? "?"} ·{" "}
                    {q.category ?? "?"}
                    {q.source ? ` · ${q.source}` : ""}
                  </p>

                  <p className="mt-2 text-[1rem]" style={{ color: PAPER }}>
                    {q.question_text}
                  </p>

                  <ul className="mt-3 space-y-1">
                    {KEYS.map((k) => {
                      const text = q[`option_${k}` as keyof ReviewRow] as string | null;
                      if (!text) return null;
                      const right = k === key;
                      return (
                        <li
                          key={k}
                          className="text-[0.9375rem]"
                          style={{ color: right ? GREEN : DIM }}
                        >
                          <span className="uppercase">{k}.</span> {text}
                          {right ? " ← recorded answer" : ""}
                        </li>
                      );
                    })}
                  </ul>

                  <p
                    className="mt-3 border-l-2 pl-3 text-[0.875rem]"
                    style={{ borderColor: RULE, color: DIM }}
                  >
                    {q.answer_explanation || "No explanation — this cannot be approved."}
                  </p>
                </div>
              </label>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
