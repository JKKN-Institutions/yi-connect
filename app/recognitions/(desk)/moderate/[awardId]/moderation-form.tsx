"use client";

import { useState, useTransition } from "react";
import { CATEGORIES, CATEGORY_LABEL, RANK_LABEL, WORDS, type Category } from "@/lib/recognitions/constants";
import { categoryRankingProblem, type RankingRuleRow } from "@/lib/recognitions/moderation-rules";
import { ConfirmDialog, ResultLine, WordField } from "@/app/recognitions/_ui/client";
import { saveModerationDraft, submitModeration } from "@/app/recognitions/actions/moderation";
import type { ModerationInput } from "@/app/recognitions/_parts/shared";
import { HomeNote, type HomeNotes } from "@/app/recognitions/_parts/home-note";
import { CategoryPanel } from "@/app/recognitions/_parts/category-tabs";
import { StandingsTable, type StandingRow } from "@/app/recognitions/_parts/standings-table";

/** One chapter on the form: the Stage 2 table row (scores, matrix rank and tie size). */
export type FormRow = StandingRow;
export type FormCategory = { category: Category; label: string; rows: FormRow[] };
export type FormInitial = {
  ranks: Record<string, string>;
  /** The NMT's reason per chapter (Piyush, 28 Oct 2026). */
  reasons: Record<string, string>;
  texts: Record<string, { rationale: string; citation: string }>;
};

/**
 * The NMT leader's final ranking, on the joint call with the Regional Mentors
 * (Piyush, 28 Oct 2026): no re-scoring. Per category, a sortable table shows
 * each chapter's Health Card (Part A), RM and NMT shares, total and
 * provisional rank (Piyush's sketch, 30 Oct); the leader picks the final rank
 * from a dropdown and writes why. A reason is required for final ranks 1-5
 * and wherever the rank moves (categoryRankingProblem, the rule the server
 * runs too). Podium cards follow the FINAL ranks: a
 * chapter gets a card the moment it alone holds rank 1, 2 or 3 in its
 * category. Texts belong to the chapter, so swapping two ranks carries
 * each chapter's text with it. The server re-derives the podium.
 */
export function ModerationForm({
  awardId,
  categories,
  weights,
  initial,
  mode,
  home,
}: {
  awardId: string;
  categories: FormCategory[];
  weights: { l1: number; l2: number; l3: number };
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

  /**
   * Every chapter needs a final rank before saving or submitting. On submit
   * the same rule as the server also applies: no rank twice, and a reason for
   * ranks 1-5 and every move.
   */
  function build(submit: boolean): ModerationInput | string {
    const rankings: ModerationInput["rankings"] = [];
    for (const cat of categories) {
      const ruleRows: RankingRuleRow[] = [];
      for (const r of cat.rows) {
        const k = (ranks[r.nominationId] ?? "").trim();
        const rank = k === "" ? null : Number(k);
        if (rank === null) return `${cat.label}: choose a final rank for ${r.chapterName}.`;
        if (!Number.isInteger(rank)) return `${cat.label}: final rank for ${r.chapterName} is not a whole number.`;
        const reason = reasons[r.nominationId] ?? "";
        ruleRows.push({ name: r.chapterName, finalRank: rank, reason, matrixRank: r.matrixRank, tieSize: r.tieSize });
        // The score is the matrix's weighted total; the server sets it.
        rankings.push({ nomination_id: r.nominationId, final_score: null, final_rank: rank, reason });
      }
      if (submit) {
        const problem = categoryRankingProblem(cat.label, ruleRows);
        if (problem) return problem;
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
    const input = build(submit);
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
      {CATEGORIES.filter((c) => !categories.some((x) => x.category === c)).map((c) => (
        <CategoryPanel key={c} category={c} tabsOnly>
          <p className="rx-mute">No {CATEGORY_LABEL[c]} chapter is in the race, so there is nothing to rank on this tab.</p>
        </CategoryPanel>
      ))}
      {categories.map((cat) => {
        const places = Math.min(3, cat.rows.length);
        return (
          <CategoryPanel key={cat.category} category={cat.category}>
          <section className="rx-stack" aria-label={`${cat.label} final ranking`}>
            <h3 className="rx-h2">{cat.label}</h3>
            <StandingsTable
              label={cat.label}
              weights={weights}
              rows={cat.rows}
              home={home}
              edit={{
                ranks,
                reasons,
                setRank: (id, v) => setRanks((x) => ({ ...x, [id]: v })),
                setReason: (id, v) => setReasons((x) => ({ ...x, [id]: v })),
              }}
            />
            <p className="rx-small rx-mute">
              Choose a final rank 1 to {cat.rows.length} for every chapter, each rank used once. Scores are not entered
              again: the total stands. Give a reason for every chapter ranked 1 to 5, and for any chapter whose rank moves;
              chapters tied on the total (shown as =) can be put in any order among themselves without that counting as a
              move. Tap a score heading to sort.
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
          <button
            type="button"
            className="rx-btn rx-btn-gilt"
            disabled={pending}
            onClick={() => {
              const input = build(true);
              if (typeof input === "string") setResult({ ok: false, text: input });
              else {
                setResult(null);
                setConfirm(true);
              }
            }}
          >
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
