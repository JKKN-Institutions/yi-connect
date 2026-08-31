"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { displayLabelFor } from "@/lib/yiq/option-order";
import { useRouter } from "next/navigation";
import {
  saveAnswer,
  answerPracticeCard,
  submitAttempt,
  type SubmitResult,
} from "../actions/attempt";
import { QuestionCard } from "./question-card";
import { nextStreak, type CardFeedback } from "@/lib/yiq/practice-feedback";
import { formatClock, secondsRemaining, type OptionKey, type PresentedQuestion } from "@/lib/yiq/paper";

const INK = "#0a1633";
const PAPER = "#f7f4ed";
const SAFFRON = "#e8a33d";
const VERMILION = "#c8452f";
const GREEN = "#14795a";
const DIM = "#5a6480";

type Props = {
  attemptId: string;
  expiresAt: string;
  questions: PresentedQuestion[];
  initialAnswers: Record<string, OptionKey>;
  paperName: string;
  durationMinutes: number;
  isMock: boolean;
};

export function QuizClient({
  attemptId,
  expiresAt,
  questions,
  initialAnswers,
  paperName,
  durationMinutes,
  isMock,
}: Props) {
  const router = useRouter();
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, OptionKey>>(initialAnswers);
  const [saving, setSaving] = useState<string | null>(null);
  const [remaining, setRemaining] = useState(() => secondsRemaining(expiresAt));
  const [result, setResult] = useState<SubmitResult | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const submittedRef = useRef(false);

  // ── The practice deck ─────────────────────────────────────────────────
  //
  // `feedback` is keyed by question, so turning a card and coming back to it
  // shows the same verdict rather than re-asking the server. It is ONLY ever
  // populated on a practice paper — the server refuses to reveal anything on
  // a scored one (lib/yiq/practice-feedback.ts), so this stays empty there
  // no matter what the client does.
  const [feedback, setFeedback] = useState<Record<string, CardFeedback>>({});
  const [streak, setStreak] = useState(0);

  const total = questions.length;
  const answeredCount = useMemo(
    () => questions.filter((q) => answers[q.id]).length,
    [questions, answers]
  );

  const doSubmit = useCallback(
    async (auto: boolean) => {
      if (submittedRef.current) return;

      // GUARD: never auto-submit off derived state. Re-check the authoritative
      // server deadline first. A previous build of this pattern in YIP fired
      // its auto-submit on the first render after start — while `remaining`
      // was still its seeded 0 — and permanently recorded a blank paper.
      if (auto && Date.parse(expiresAt) > Date.now()) return;

      submittedRef.current = true;
      setSubmitting(true);
      const res = await submitAttempt(attemptId);
      setResult(res);
      setSubmitting(false);
      if (!res.success) submittedRef.current = false;
    },
    [attemptId, expiresAt]
  );

  // Countdown, driven from the authoritative deadline on every tick — never
  // decremented, so a backgrounded phone or a slept laptop cannot gain time.
  useEffect(() => {
    if (result) return;
    const id = window.setInterval(() => {
      const left = secondsRemaining(expiresAt);
      setRemaining(left);
      if (left <= 0) void doSubmit(true);
    }, 1000);
    return () => window.clearInterval(id);
  }, [expiresAt, doSubmit, result]);

  async function choose(questionId: string, option: OptionKey) {
    if (result || submitting) return;
    // A card that has already turned is settled. Re-answering it would let a
    // student who has just been shown the answer put the right one in.
    if (feedback[questionId]) return;

    const previous = answers[questionId];
    setAnswers((a) => ({ ...a, [questionId]: option }));
    setSaving(questionId);

    // On a PRACTICE paper, ask for the verdict in the same round trip that
    // saves the answer. On a scored paper this action saves exactly as
    // saveAnswer does and returns feedback: null — the refusal is the
    // server's, not a flag the client can flip.
    const res = isMock
      ? await answerPracticeCard(attemptId, questionId, option)
      : await saveAnswer(attemptId, questionId, option);
    setSaving(null);

    if (res.success && "feedback" in res && res.feedback) {
      const fb = res.feedback;
      setFeedback((f) => ({ ...f, [questionId]: fb }));
      setStreak((n) => nextStreak(n, fb.correct));
    }

    if (!res.success) {
      // Roll the optimistic choice back so the screen never claims an answer
      // the server refused.
      setAnswers((a) => {
        const next = { ...a };
        if (previous) next[questionId] = previous;
        else delete next[questionId];
        return next;
      });
      if ("expired" in res && res.expired) void doSubmit(true);
    }
  }

  // ---------------------------------------------------------------- result
  if (result) {
    if (!result.success) {
      return (
        <Shell>
          <p role="alert" className="text-[1rem] font-semibold" style={{ color: VERMILION }}>
            {result.error}
          </p>
          <button
            onClick={() => router.push("/yiq/me")}
            className="mt-6 rounded-full px-6 py-3 font-bold"
            style={{ background: INK, color: PAPER }}
          >
            Back to my YIQ
          </button>
        </Shell>
      );
    }
    const pct = result.totalQuestions
      ? Math.round((result.correctCount / result.totalQuestions) * 100)
      : 0;
    return (
      <Shell>
        <p className="yiq-eyebrow" style={{ color: DIM }}>
          {isMock ? "Practice complete" : "Submitted"}
        </p>
        <h1 className="yiq-display mt-2 text-[2.5rem]" style={{ color: INK }}>
          {isMock ? "Nice practice run" : "Your paper is in"}
        </h1>

        <div className="mt-7 flex items-center gap-6">
          <div
            className="yiq-ring h-[128px] w-[128px]"
            style={
              {
                "--yiq-ring-pct": pct,
                "--yiq-ring-col": GREEN,
                "--yiq-ring-bg": PAPER,
                "--yiq-ring-track": "rgba(10,22,51,0.10)",
                "--yiq-ring-w": "10px",
              } as React.CSSProperties
            }
          >
            <span className="yiq-data text-[1.75rem] font-bold" style={{ color: INK }}>
              {result.score}
            </span>
          </div>
          <dl className="grid gap-2 text-[0.9375rem]">
            <Row label="Correct" value={result.correctCount} colour={GREEN} />
            <Row label="Wrong" value={result.wrongCount} colour={VERMILION} />
            <Row label="Not answered" value={result.unansweredCount} colour={DIM} />
            <Row label="Questions" value={result.totalQuestions} colour={INK} />
          </dl>
        </div>

        <p className="mt-7 text-[0.9375rem] leading-relaxed" style={{ color: DIM }}>
          {isMock
            ? "Practice scores don't count. Take it as often as you like before the real round."
            : "Your team's score is the average of the members who sit, so a teammate who misses it will not drag you down. Rankings are published by your chapter after the round closes."}
        </p>

        <button
          onClick={() => router.push("/yiq/me")}
          className="mt-7 rounded-full px-6 py-3.5 font-bold"
          style={{ background: SAFFRON, color: INK }}
        >
          Back to my YIQ
        </button>
      </Shell>
    );
  }

  // ------------------------------------------------------------------ quiz
  const q = questions[index];
  // Fraction of the paper's own duration still on the clock.
  const totalSeconds = Math.max(1, durationMinutes * 60);
  const pctLeft = Math.max(0, Math.min(100, (remaining / totalSeconds) * 100));
  const urgent = remaining <= 60;

  return (
    <div className="flex min-h-screen flex-col" style={{ background: PAPER }}>
      {/* Sticky header: clock + progress. Sized for a phone first. */}
      <header
        className="sticky top-0 z-10 border-b"
        style={{ background: INK, borderColor: "rgba(247,244,237,0.14)" }}
      >
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-4 px-4 py-3">
          <div className="min-w-0">
            <p className="yiq-eyebrow truncate" style={{ color: "#9fb0d4" }}>
              {isMock ? "Practice" : paperName}
            </p>
            <p className="text-[0.9375rem] font-semibold" style={{ color: PAPER }}>
              Question {index + 1}
              <span style={{ color: "#9fb0d4" }}> of {total}</span>
            </p>
          </div>
          <div
            className="yiq-ring h-[58px] w-[58px] flex-none"
            style={
              {
                "--yiq-ring-pct": pctLeft,
                "--yiq-ring-col": urgent ? VERMILION : SAFFRON,
                "--yiq-ring-bg": INK,
                "--yiq-ring-w": "5px",
              } as React.CSSProperties
            }
            role="timer"
            aria-live="off"
            aria-label={`${formatClock(remaining)} remaining`}
          >
            <span
              className="yiq-data text-[0.8125rem] font-bold"
              style={{ color: urgent ? "#ffb4a6" : PAPER }}
            >
              {formatClock(remaining)}
            </span>
          </div>
        </div>
        <div className="h-[3px] w-full" style={{ background: "rgba(247,244,237,0.12)" }}>
          <div
            className="h-full transition-[width] duration-300"
            style={{
              width: `${(answeredCount / Math.max(1, total)) * 100}%`,
              background: SAFFRON,
            }}
          />
        </div>
      </header>

      <main id="yiq-main" className="mx-auto w-full max-w-2xl flex-1 px-4 py-6">
        <QuestionCard
          question={q}
          index={index}
          total={total}
          chosen={answers[q.id]}
          onChoose={(o) => void choose(q.id, o)}
          disabled={submitting || Boolean(feedback[q.id])}
          feedback={feedback[q.id] ?? null}
          streak={streak}
          secondsLeft={null}
          secondsPerQuestion={null}
          saving={saving === q.id}
        />

        {/* Question grid — jump anywhere, see what's left. */}
        <nav className="mt-6" aria-label="Questions">
          <p className="yiq-eyebrow mb-2" style={{ color: DIM }}>
            {answeredCount} of {total} answered
          </p>
          <ul className="flex flex-wrap gap-1.5">
            {questions.map((qq, i) => {
              const done = Boolean(answers[qq.id]);
              const here = i === index;
              return (
                <li key={qq.id}>
                  <button
                    onClick={() => setIndex(i)}
                    aria-current={here ? "true" : undefined}
                    aria-label={`Question ${i + 1}${done ? ", answered" : ""}`}
                    className="yiq-data h-8 w-8 rounded-lg text-[0.75rem] font-semibold"
                    style={{
                      background: done ? INK : "#fff",
                      color: done ? PAPER : INK,
                      border: here
                        ? `2px solid ${SAFFRON}`
                        : "1px solid rgba(10,22,51,0.14)",
                    }}
                  >
                    {i + 1}
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>
      </main>

      <footer
        className="sticky bottom-0 border-t"
        style={{ background: PAPER, borderColor: "rgba(10,22,51,0.12)" }}
      >
        <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-3">
          <button
            onClick={() => setIndex((i) => Math.max(0, i - 1))}
            disabled={index === 0}
            className="rounded-full border px-5 py-3 text-[0.875rem] font-semibold disabled:opacity-40"
            style={{ borderColor: "rgba(10,22,51,0.2)", color: INK }}
          >
            Back
          </button>
          {index < total - 1 ? (
            <button
              onClick={() => setIndex((i) => Math.min(total - 1, i + 1))}
              className="flex-1 rounded-full py-3 text-[0.9375rem] font-bold"
              style={{ background: INK, color: PAPER }}
            >
              Next
            </button>
          ) : (
            <button
              onClick={() => setConfirmOpen(true)}
              disabled={submitting}
              className="flex-1 rounded-full py-3 text-[0.9375rem] font-bold disabled:opacity-60"
              style={{ background: SAFFRON, color: INK }}
            >
              {submitting ? "Submitting…" : "Finish and submit"}
            </button>
          )}
        </div>
      </footer>

      {confirmOpen ? (
        <div
          className="fixed inset-0 z-20 flex items-end justify-center sm:items-center"
          style={{ background: "rgba(10,22,51,0.6)" }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="yiq-confirm-title"
        >
          <div
            className="w-full max-w-md rounded-t-2xl p-6 sm:rounded-2xl"
            style={{ background: PAPER }}
          >
            <h2 id="yiq-confirm-title" className="yiq-display text-[1.5rem]" style={{ color: INK }}>
              Submit your paper?
            </h2>
            <p className="mt-2 text-[0.9375rem]" style={{ color: DIM }}>
              {answeredCount === total
                ? "All questions answered."
                : `${total - answeredCount} question${total - answeredCount === 1 ? "" : "s"} left unanswered.`}{" "}
              {isMock ? "You can practise again after this." : "You can't come back to this paper."}
            </p>
            <div className="mt-5 flex gap-3">
              <button
                onClick={() => setConfirmOpen(false)}
                className="flex-1 rounded-full border py-3 text-[0.9375rem] font-semibold"
                style={{ borderColor: "rgba(10,22,51,0.2)", color: INK }}
              >
                Keep going
              </button>
              <button
                onClick={() => {
                  setConfirmOpen(false);
                  void doSubmit(false);
                }}
                className="flex-1 rounded-full py-3 text-[0.9375rem] font-bold"
                style={{ background: SAFFRON, color: INK }}
              >
                Submit
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Row({ label, value, colour }: { label: string; value: number; colour: string }) {
  return (
    <div className="flex items-baseline gap-3">
      <dt style={{ color: DIM }} className="w-32 text-[0.875rem]">
        {label}
      </dt>
      <dd className="yiq-data text-[1.125rem] font-bold" style={{ color: colour }}>
        {value}
      </dd>
    </div>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main
      id="yiq-main"
      className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center px-5 py-10"
      style={{ background: PAPER }}
    >
      {children}
    </main>
  );
}
