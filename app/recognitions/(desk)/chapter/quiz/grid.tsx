"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Category, Vertical } from "@/lib/recognitions/constants";
import { ConfirmDialog, ResultLine } from "../../../_ui/client";
import { Ribbon } from "../../../_ui/ribbon";
import { submitPredictions } from "../../../actions/chapter";

export type QuizAward = { id: string; title: string; vertical: Vertical };
export type QuizColumn = { category: Category; label: string; chapters: Array<{ id: string; name: string }> };

export function PredictionGrid({
  chapterId,
  awards,
  columns,
}: {
  chapterId: string;
  awards: QuizAward[];
  columns: QuizColumn[];
}) {
  const router = useRouter();
  const uid = useId();
  const [picks, setPicks] = useState<Record<string, string>>({});
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);

  const filled = Object.values(picks).filter((v) => v !== "").length;
  const total = awards.length * columns.filter((c) => c.chapters.length > 0).length;

  function submit() {
    startTransition(async () => {
      const list = Object.entries(picks)
        .filter(([, v]) => v !== "")
        .map(([key, predictedChapterId]) => {
          const [awardId, category] = key.split("|");
          return { awardId, category, predictedChapterId };
        });
      const res = await submitPredictions(chapterId, list);
      setOpen(false);
      if (res.success) {
        setResult({ ok: true, text: res.message ?? "Predictions locked in." });
        router.refresh();
      } else {
        setResult({ ok: false, text: res.error });
      }
    });
  }

  return (
    <div className="rx-stack">
      {awards.map((a) => (
        <article key={a.id} className="rx-plate rx-plate-tight rx-stack">
          <div className="rx-row" style={{ gap: 10 }}>
            <Ribbon vertical={a.vertical} />
            <h2 className="rx-h3">{a.title}</h2>
          </div>
          <div className="rx-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
            {columns.map((c) => {
              const key = `${a.id}|${c.category}`;
              const id = `${uid}-${a.id}-${c.category}`;
              return (
                <div key={c.category}>
                  <label className="rx-label" htmlFor={id}>{c.label}</label>
                  <select
                    id={id}
                    className="rx-select"
                    value={picks[key] ?? ""}
                    disabled={pending || c.chapters.length === 0}
                    onChange={(e) => setPicks((p) => ({ ...p, [key]: e.target.value }))}
                  >
                    <option value="">
                      {c.chapters.length === 0 ? "No chapters in this category" : "Choose a chapter"}
                    </option>
                    {c.chapters.map((ch) => (
                      <option key={ch.id} value={ch.id}>{ch.name}</option>
                    ))}
                  </select>
                </div>
              );
            })}
          </div>
        </article>
      ))}

      <ResultLine result={result} />
      <div className="rx-spread">
        <span className="rx-small rx-mute rx-num">
          {filled} of {total} picked
        </span>
        <button
          type="button"
          className="rx-btn rx-btn-gilt"
          disabled={pending || filled === 0}
          onClick={() => setOpen(true)}
        >
          Submit predictions
        </button>
      </div>

      <ConfirmDialog
        open={open}
        title="Lock in your predictions?"
        confirmLabel="Submit predictions"
        tone="gilt"
        busy={pending}
        onClose={() => setOpen(false)}
        onConfirm={submit}
      >
        <p>
          Predictions lock once submitted. You have picked {filled} of {total}; empty picks stay empty.
        </p>
      </ConfirmDialog>
    </div>
  );
}
