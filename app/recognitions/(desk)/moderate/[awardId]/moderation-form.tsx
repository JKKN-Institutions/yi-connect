"use client";

import { useState, useTransition } from "react";
import { RANK_LABEL, WORDS, type Category } from "@/lib/recognitions/constants";
import { ConfirmDialog, ResultLine, WordField } from "@/app/recognitions/_ui/client";
import { saveModerationDraft, submitModeration } from "@/app/recognitions/actions/moderation";
import type { ModerationInput } from "@/app/recognitions/_parts/shared";
import { HomeNote, type HomeNotes } from "@/app/recognitions/_parts/home-note";
import { CategoryPanel } from "@/app/recognitions/_parts/category-tabs";

export type FormRow = {
  nominationId: string;
  chapterName: string;
  region: string;
  computedTotal: number;
  computedRank: number;
};
export type FormCategory = { category: Category; label: string; rows: FormRow[] };
export type FormInitial = {
  ranks: Record<string, string>;
  /** The NMT's reason per chapter (Piyush, 28 Oct 2026). */
  reasons: Record<string, string>;
  texts: Record<string, { rationale: string; citation: string }>;
};

/**
 * The NMT leader's final ranking, on the joint call with the Regional Mentors
 * (Piyush, 28 Oct 2026): no re-scoring. Each chapter shows its weighted total
 * and provisional rank; the leader sets the final rank and writes why. A
 * reason is required wherever the rank moves. Podium cards follow the FINAL ranks: a
 * chapter gets a card the moment it alone holds rank 1, 2 or 3 in its
 * category. Texts belong to the chapter, so swapping two ranks carries
 * each chapter's text with it. The server re-derives the podium.
 */
export function ModerationForm({
  awardId,
  categories,
  initial,
  mode,
  home,
}: {
  awardId: string;
  categories: FormCategory[];
  initial: FormInitial;
  mode: "stage2" | "reevaluation";
  home?: HomeNotes;
}) {
  const [ranks, setRanks] = useState(initial.ranks);
  const [reasons, setReasons] = useState(initial.reasons);
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
        const k = (ranks[r.nominationId] ?? "").trim();
        const rank = k === "" ? null : Number(k);
        if (rank !== null && !Number.isFinite(rank)) return `Final rank for ${r.chapterName} is not a number.`;
        // The score is the matrix's weighted total; the server sets it.
        rankings.push({ nomination_id: r.nominationId, final_score: null, final_rank: rank, reason: reasons[r.nominationId] ?? "" });
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
          <CategoryPanel key={cat.category} category={cat.category}>
          <section className="rx-stack" aria-label={`${cat.label} final ranking`}>
            <h3 className="rx-h2">{cat.label}</h3>
            <ol className="rx-rank-list">
              {cat.rows.map((r) => {
                const k = (ranks[r.nominationId] ?? "").trim();
                const moved = k !== "" && Number(k) !== r.computedRank;
                return (
                  <li key={r.nominationId} className="rx-rank-card" data-moved={moved ? "true" : undefined}>
                    <div className="rx-rank-head">
                      <div style={{ minWidth: 0 }}>
                        <strong style={{ overflowWrap: "anywhere" }}>{r.chapterName}</strong>
                        <span className="rx-small rx-mute"> · {r.region}</span>
                        <HomeNote names={home?.[r.chapterName]} />
                      </div>
                      {moved ? (
                        <span className="rx-small rx-rank-move">
                          Rank {r.computedRank} to {k}
                        </span>
                      ) : null}
                    </div>
                    <div className="rx-rank-figs">
                      <div className="rx-rank-fig">
                        <span>Weighted total</span>
                        <span className="rx-num">{r.computedTotal.toFixed(2)}</span>
                      </div>
                      <div className="rx-rank-fig">
                        <span>Provisional rank</span>
                        <span className="rx-num">{r.computedRank}</span>
                      </div>
                      <label className="rx-rank-fig">
                        <span>Final rank</span>
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
                      </label>
                    </div>
                    <WordField
                      label={`Why this rank for ${r.chapterName}?`}
                      value={reasons[r.nominationId] ?? ""}
                      onChange={(v) => setReasons((s) => ({ ...s, [r.nominationId]: v }))}
                      limit={WORDS.rankReason}
                      rows={3}
                      help={moved ? "Required: the rank changed from the provisional rank." : "Optional while the rank stays as it is."}
                    />
                  </li>
                );
              })}
            </ol>
            <p className="rx-small rx-mute">
              Final rank 1 to {cat.rows.length}, each rank used once. Scores are not entered again: the weighted total
              stands.
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
                          ? `Give one chapter final rank ${place} to write its rationale and citation.`
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
                      <HomeNote names={home?.[h.chapterName]} />
                    </div>
                    <WordField
                      label="Why this finalist?"
                      value={t.rationale}
                      onChange={(v) => setText(h.nominationId, "rationale", v)}
                      limit={WORDS.top3Rationale}
                      rows={6}
                      help="Required. The strong rationale for this place, based on the team meeting."
                    />
                    <WordField
                      label="Citation"
                      value={t.citation}
                      onChange={(v) => setText(h.nominationId, "citation", v)}
                      limit={WORDS.top3Citation}
                      rows={6}
                      help="Required. The announcement text: what the chapter did and why it is being recognised."
                    />
                  </article>
                );
              })}
            </div>
          </section>
          </CategoryPanel>
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
          The final ranks, the reasons and the finalists&apos; texts go to National Leadership for approval. Once submitted this version
          cannot be edited; if National Leadership sends it back, you will start a new version.
        </p>
      </ConfirmDialog>
    </div>
  );
}
