"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { TrackIcon } from "@/components/yi-future/TrackIcon";
import { scoreQuiz, type QuizQuestion } from "@/lib/yi-future/problem-quiz";

export type QuizProblem = {
  id: string;
  title: string;
  shortDescription: string;
  trackSlug: string;
  trackName: string;
  trackIcon: string | null;
  trackColorHex: string;
};

type Props = {
  problems: QuizProblem[];
  questions: QuizQuestion[];
};

export function QuizClient({ problems, questions }: Props) {
  // questionId -> chosen optionId
  const [answers, setAnswers] = useState<Record<string, string>>({});
  // current step; === questions.length means "show results"
  const [step, setStep] = useState(0);

  const problemById = useMemo(
    () => new Map(problems.map((p) => [p.id, p])),
    [problems]
  );

  const showResults = step >= questions.length;
  const current = questions[step];
  const answeredCount = Object.keys(answers).length;
  const currentAnswered = current ? Boolean(answers[current.id]) : true;
  const progressPct = showResults
    ? 100
    : Math.round((step / questions.length) * 100);

  // Ranked results — only meaningful once we're on the results step.
  const ranked = useMemo(() => {
    if (!showResults) return [];
    const scored = scoreQuiz(
      answers,
      problems.map((p) => ({
        id: p.id,
        title: p.title,
        track_slug: p.trackSlug,
      }))
    );
    const maxScore = scored.reduce((m, s) => Math.max(m, s.score), 0) || 1;
    return scored
      .map((s) => ({ problem: problemById.get(s.problemId)!, score: s.score }))
      .filter((r) => r.problem)
      .map((r) => ({ ...r, pct: Math.round((r.score / maxScore) * 100) }));
  }, [showResults, answers, problems, problemById]);

  function choose(questionId: string, optionId: string) {
    setAnswers((prev) => ({ ...prev, [questionId]: optionId }));
  }

  function next() {
    if (!currentAnswered) return;
    setStep((s) => Math.min(s + 1, questions.length));
  }

  function back() {
    setStep((s) => Math.max(s - 1, 0));
  }

  function retake() {
    setAnswers({});
    setStep(0);
  }

  // ─── RESULTS VIEW ──────────────────────────────────────────────────
  if (showResults) {
    const top3 = ranked.slice(0, 3);
    const rest = ranked.slice(3);

    return (
      <div className="space-y-5">
        <div className="bg-yi-gold/10 border border-yi-gold/30 rounded-lg p-4 text-sm text-navy">
          <strong>These are suggestions, not a decision.</strong> Nothing was
          saved. Your top 3 below are the problems that best match your
          answers — but the final call is yours and your team&apos;s.
        </div>

        <section className="space-y-3">
          <h3 className="text-xs font-semibold tracking-widest text-navy/50 uppercase">
            Your best matches
          </h3>
          {top3.map((r, i) => (
            <div
              key={r.problem.id}
              className="bg-white border border-navy/10 rounded-lg p-4 border-l-4"
              style={{ borderLeftColor: r.problem.trackColorHex }}
            >
              <div className="flex items-start gap-3">
                <span className="shrink-0 inline-flex items-center justify-center w-7 h-7 rounded-full bg-yi-gold text-navy text-sm font-bold">
                  {i + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-navy/50">
                    <TrackIcon
                      icon={r.problem.trackIcon}
                      name={r.problem.trackName}
                      size={20}
                    />
                    <span>{r.problem.trackName}</span>
                  </div>
                  <div className="mt-1 font-bold text-navy">
                    {r.problem.title}
                  </div>
                  <div className="mt-1 text-xs text-navy/60">
                    {r.problem.shortDescription}
                  </div>
                  <div className="mt-3 h-1.5 w-full rounded-full bg-navy/10 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-yi-gold"
                      style={{ width: `${r.pct}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </section>

        {rest.length > 0 && (
          <section className="space-y-2">
            <h3 className="text-xs font-semibold tracking-widest text-navy/50 uppercase">
              Also worth a look
            </h3>
            {rest.map((r, i) => (
              <div
                key={r.problem.id}
                className="bg-white border border-navy/10 rounded-md p-3 flex items-center gap-3"
              >
                <span className="shrink-0 w-6 text-center text-xs font-semibold text-navy/40">
                  {i + 4}
                </span>
                <TrackIcon
                  icon={r.problem.trackIcon}
                  name={r.problem.trackName}
                  size={20}
                />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-navy truncate">
                    {r.problem.title}
                  </div>
                  <div className="text-[11px] text-navy/50 uppercase tracking-wide">
                    {r.problem.trackName}
                  </div>
                </div>
                <div className="w-16 shrink-0 h-1.5 rounded-full bg-navy/10 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-navy/30"
                    style={{ width: `${r.pct}%` }}
                  />
                </div>
              </div>
            ))}
          </section>
        )}

        <div className="sticky bottom-2 bg-white border border-navy/10 rounded-lg p-4 flex flex-col sm:flex-row items-stretch sm:items-center gap-3 shadow-sm">
          <button
            type="button"
            onClick={retake}
            className="min-h-[44px] px-4 py-2 rounded-md border border-navy/20 text-navy text-sm font-semibold hover:border-yi-gold/60 hover:bg-yi-gold/5"
          >
            Retake quiz
          </button>
          <Link
            href="/yi-future/me/team/preferences"
            className="flex-1 min-h-[44px] px-5 py-2 rounded-md bg-navy text-ivory text-sm font-semibold hover:bg-navy-dark inline-flex items-center justify-center text-center"
          >
            Go rank my top 3 →
          </Link>
        </div>
      </div>
    );
  }

  // ─── QUESTION VIEW (one at a time) ─────────────────────────────────
  return (
    <div className="space-y-5">
      {/* Progress */}
      <div>
        <div className="flex items-center justify-between text-xs font-semibold text-navy/50 mb-1">
          <span>
            Question {step + 1} of {questions.length}
          </span>
          <span>{answeredCount} answered</span>
        </div>
        <div className="h-1.5 w-full rounded-full bg-navy/10 overflow-hidden">
          <div
            className="h-full rounded-full bg-yi-gold transition-all"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      <section className="bg-white border border-navy/10 rounded-lg p-5">
        <h3 className="text-base font-bold text-navy">{current.prompt}</h3>
        <div className="mt-4 space-y-3">
          {current.options.map((opt) => {
            const selected = answers[current.id] === opt.id;
            return (
              <label
                key={opt.id}
                className={`block cursor-pointer rounded-md border p-3 transition-colors ${
                  selected
                    ? "border-yi-gold bg-yi-gold/10"
                    : "border-navy/15 hover:border-yi-gold/60 hover:bg-yi-gold/5"
                }`}
              >
                <div className="flex items-start gap-3">
                  <input
                    type="radio"
                    name={current.id}
                    value={opt.id}
                    checked={selected}
                    onChange={() => choose(current.id, opt.id)}
                    className="mt-1 accent-yi-gold"
                  />
                  <div className="flex-1">
                    <div className="text-sm font-semibold text-navy">
                      {opt.label}
                    </div>
                    {opt.hint && (
                      <div className="mt-0.5 text-xs text-navy/55">
                        {opt.hint}
                      </div>
                    )}
                  </div>
                </div>
              </label>
            );
          })}
        </div>
      </section>

      <div className="sticky bottom-2 bg-white border border-navy/10 rounded-lg p-4 flex items-center justify-between gap-3 shadow-sm">
        <button
          type="button"
          onClick={back}
          disabled={step === 0}
          className="min-h-[44px] px-4 py-2 rounded-md border border-navy/20 text-navy text-sm font-semibold hover:border-yi-gold/60 hover:bg-yi-gold/5 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          ← Back
        </button>
        <button
          type="button"
          onClick={next}
          disabled={!currentAnswered}
          className="min-h-[44px] px-5 py-2 rounded-md bg-navy text-ivory text-sm font-semibold hover:bg-navy-dark disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {step === questions.length - 1 ? "See my matches" : "Next →"}
        </button>
      </div>
    </div>
  );
}
