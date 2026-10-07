"use client";

import { useState, useTransition } from "react";
import { RANK_LABEL, WORDS, type Category } from "@/lib/recognitions/constants";
import { ConfirmDialog, ResultLine, WordField } from "@/app/recognitions/_ui/client";
import { saveModerationDraft, submitModeration } from "@/app/recognitions/actions/moderation";
import type { ModerationInput } from "@/app/recognitions/_parts/shared";

export type FormRow = {
  nominationId: string;
  chapterName: string;
  region: string;
  computedTotal: number;
  computedRank: number;
};
export type FormCategory = { category: Category; label: string; rows: FormRow[] };
export type FormInitial = {
  scores: Record<string, string>;
  ranks: Record<string, string>;
  texts: Record<string, { rationale: string; citation: string }>;
};

/**
 * The NMT leader's final ranking. Podium cards follow the FINAL ranks: a
 * chapter gets a card the moment it alone holds rank 1, 2 or 3 in its
 * category. Texts belong to the chapter, so swapping two ranks carries
 * each chapter's text with it. The server re-derives the podium.
 */
export function ModerationForm({
  awardId,
  categories,
  initial,
  mode,
}: {
  awardId: string;
  categories: FormCategory[];
  initial: FormInitial;
  mode: "stage2" | "reevaluation";
}) {
  const [scores, setScores] = useState(initial.scores);
  const [ranks, setRanks] = useState(initial.ranks);
  const [texts, setTexts] = useState(initial.texts);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [pending, start] = useTransition();

  const textOf = (id: string) => texts[id] ?? { rationale: "", citation: "" };
  const setText = (id: string, field: "rationale" | "citation", v: string) =>
    setTexts((t) => ({ ...t, [id]: { ...(t[id] ?? { rationale: "", citation: "" }), [field]: v } }));

  function build(): ModerationInput | string {
    const rankings: ModerationInput["rankings"] = [];
    for (const cat of categories) {
      for (const r of cat.rows) {
        const s = (scores[r.nominationId] ?? "").trim();
        const k = (ranks[r.nominationId] ?? "").trim();
        const score = s === "" ? null : Number(s);
        const rank = k === "" ? null : Number(k);
        if (score !== null && !Number.isFinite(score)) return `Final score for ${r.chapterName} is not a number.`;
        if (rank !== null && !Number.isFinite(rank)) return `Final rank for ${r.chapterName} is not a number.`;
        rankings.push({ nomination_id: r.nominationId, final_score: score, final_rank: rank });
      }
    }
    const textsOut = Object.entries(texts).map(([nomination_id, t]) => ({
      nomination_id,
      rationale: t.rationale,
      citation: t.citation,
    }));
    return { rankings, texts: textsOut };
  }

  function run(submit: boolean) {
    const input = build();
    if (typeof input === "string") {
      setResult({ ok: false, text: input });
      setConfirm(false);
      return;
    }
    setResult(null);
    start(async () => {
      const res = submit ? await submitModeration(awardId, input) : await saveModerationDraft(awardId, input);
      setConfirm(false);
      setResult(res.success ? { ok: true, text: res.message ?? "Saved." } : { ok: false, text: res.error });
    });
  }

  return (
    <div className="rx-stack-lg">
      {categories.map((cat) => {
        const places = Math.min(3, cat.rows.length);
        return (
          <section key={cat.category} className="rx-stack" aria-label={`${cat.label} final ranking`}>
            <h3 className="rx-h2">{cat.label}</h3>
            <div className="rx-ledger-wrap">
              <table className="rx-ledger">
                <thead>
                  <tr>
                    <th>Chapter</th>
                    <th>Region</th>
                    <th className="rx-num">Weighted total</th>
                    <th className="rx-num">Provisional rank</th>
                    <th className="rx-num">Final score</th>
                    <th className="rx-num">Final rank</th>
                  </tr>
                </thead>
                <tbody>
                  {cat.rows.map((r) => (
                    <tr key={r.nominationId}>
                      <td>{r.chapterName}</td>
                      <td>{r.region}</td>
                      <td className="rx-num">{r.computedTotal.toFixed(2)}</td>
                      <td className="rx-num">{r.computedRank}</td>
                      <td className="rx-num">
                        <input
                          className="rx-input rx-p-num-input"
                          type="number"
                          inputMode="decimal"
                          min={0}
                          max={100}
                          step={0.01}
                          aria-label={`Final score for ${r.chapterName}`}
                          value={scores[r.nominationId] ?? ""}
                          onChange={(e) => setScores((s) => ({ ...s, [r.nominationId]: e.target.value }))}
                        />
                      </td>
                      <td className="rx-num">
                        <input
                          className="rx-input rx-p-num-input"
                          type="number"
                          inputMode="numeric"
                          min={1}
                          max={cat.rows.length}
                          step={1}
                          aria-label={`Final rank for ${r.chapterName}`}
                          value={ranks[r.nominationId] ?? ""}
                          onChange={(e) => setRanks((s) => ({ ...s, [r.nominationId]: e.target.value }))}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="rx-small rx-mute">
              Final score 0 to 100 (two decimals). Final rank 1 to {cat.rows.length}, each rank used once.
            </p>
            <div className="rx-podium">
              {Array.from({ length: places }, (_, i) => (i + 1) as 1 | 2 | 3).map((place) => {
                const label = RANK_LABEL[place];
                const holders = cat.rows.filter((r) => Number((ranks[r.nominationId] ?? "").trim()) === place);
                if (holders.length !== 1) {
                  return (
                    <article key={place} className="rx-plate rx-place rx-stack" data-rank={place}>
                      <div className="rx-eyebrow">{label}</div>
                      <p className="rx-small rx-mute">
                        {holders.length === 0
                          ? `Give one chapter final rank ${place} to write its ${label.toLowerCase()} rationale and citation.`
                          : `${holders.length} chapters have final rank ${place}. Only one can.`}
                      </p>
                    </article>
                  );
                }
                const h = holders[0];
                const t = textOf(h.nominationId);
                return (
                  <article key={place} className="rx-plate rx-place rx-stack" data-rank={place}>
                    <div>
                      <div className="rx-eyebrow">{label}</div>
                      <div className="rx-h2">{h.chapterName}</div>
                    </div>
                    <WordField
                      label={`Why ${label}?`}
                      value={t.rationale}
                      onChange={(v) => setText(h.nominationId, "rationale", v)}
                      limit={WORDS.top3Rationale}
                      rows={6}
                      help="Required. The strong rationale for this place, based on the team meeting."
                    />
                    <WordField
                      label={`${label} citation`}
                      value={t.citation}
                      onChange={(v) => setText(h.nominationId, "citation", v)}
                      limit={WORDS.top3Citation}
                      rows={6}
                      help="Required. The award announcement text: what the chapter did and why it is being awarded."
                    />
                  </article>
                );
              })}
            </div>
          </section>
        );
      })}

      <div className="rx-p-sticky-actions rx-stack" style={{ gap: 8 }}>
        <ResultLine result={result} />
        <div className="rx-row">
          <button type="button" className="rx-btn rx-btn-quiet" disabled={pending} onClick={() => run(false)}>
            {pending && !confirm ? "Saving…" : "Save draft"}
          </button>
          <button type="button" className="rx-btn rx-btn-gilt" disabled={pending} onClick={() => setConfirm(true)}>
            {mode === "reevaluation" ? "Submit revised moderation" : "Submit moderation"}
          </button>
        </div>
      </div>

      <ConfirmDialog
        open={confirm}
        title={mode === "reevaluation" ? "Submit the revised moderation?" : "Submit the moderation?"}
        confirmLabel={mode === "reevaluation" ? "Submit revised moderation" : "Submit moderation"}
        tone="gilt"
        busy={pending}
        onConfirm={() => run(true)}
        onClose={() => setConfirm(false)}
      >
        <p>
          The final scores, ranks and podium texts go to National Leadership for approval. Once submitted this version
          cannot be edited; if National Leadership sends it back, you will start a new version.
        </p>
      </ConfirmDialog>
    </div>
  );
}
