/*
 * No "use client" directive on purpose. This is imported ONLY by
 * quiz-client.tsx, which is already a client component, so it joins the
 * client bundle by inheritance. Marking it as an entry point makes Next
 * treat every prop as a server-boundary prop and reject the onChoose
 * callback, which is not what is happening here.
 */

import { useEffect, useRef, useState } from "react";
import { displayLabelFor } from "@/lib/yiq/option-order";
import { streakLabel } from "@/lib/yiq/practice-feedback";
import type { CardFeedback } from "@/lib/yiq/practice-feedback";
import type { OptionKey, PresentedQuestion } from "@/lib/yiq/paper";

/**
 * One card in the deck.
 *
 * THE FLIP IS THE POINT, and it is practice-only. The back of the card is
 * the explanation, not decoration: in a reasoning quiz the working IS the
 * value, and a bare tick teaches a student nothing. A flashcard has always
 * worked this way; this does it on a phone.
 *
 * FAIRNESS ON A SCORED PAPER — the reason this is tap-only. The Director
 * asked for interactive formats in the scored round as well as in practice,
 * knowing it introduces a risk: a student on a cracked old phone doing a
 * drag-and-drop is being measured partly on their device, not their
 * thinking. So the interaction here is deliberately the plainest one that
 * still feels like a deck:
 *
 *   - every option is a real <button>, reachable by keyboard and by screen
 *     reader, with a target well over the 44px minimum;
 *   - NOTHING requires a swipe, a drag, a long-press or a gesture;
 *   - the interaction is never the difficulty — the question is.
 *
 * That keeps the format engaging without making dexterity part of the
 * score.
 */
export function QuestionCard({
  question,
  index,
  total,
  chosen,
  onChoose,
  disabled,
  feedback,
  streak,
  secondsLeft,
  secondsPerQuestion,
  saving,
}: {
  question: PresentedQuestion;
  index: number;
  total: number;
  chosen: OptionKey | undefined;
  onChoose: (option: OptionKey) => void;
  disabled: boolean;
  /** Practice only. Null on a scored paper, always. */
  feedback: CardFeedback | null;
  /** Practice only. Ignored when feedback is null. */
  streak: number;
  /** Per-question clock. Null when the paper is not paced. */
  secondsLeft: number | null;
  secondsPerQuestion: number | null;
  saving: boolean;
}) {
  const remaining = Math.max(0, total - index - 1);

  /*
   * THE TURN. The card rotates to edge-on, the content is swapped while it
   * is invisible, and it rotates back. `shown` therefore lags `feedback` by
   * exactly one half-turn — which is what makes the swap unseeable.
   *
   * Driven by a timer rather than a transitionend event on purpose: a
   * backgrounded tab does not fire transitionend, and a card stuck edge-on
   * with the student's answer behind it would be unrecoverable.
   */
  const [shown, setShown] = useState<CardFeedback | null>(feedback);
  const [turning, setTurning] = useState(false);
  const timers = useRef<number[]>([]);

  useEffect(() => {
    if (feedback === shown) return;
    setTurning(true);
    timers.current.push(
      window.setTimeout(() => {
        setShown(feedback);
        setTurning(false);
      }, 200)
    );
    return () => {
      timers.current.forEach(window.clearTimeout);
      timers.current = [];
    };
    // `shown` is deliberately not a dependency: it is what this effect sets,
    // and including it would re-run the turn on its own result.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [feedback]);

  const ringPct =
    secondsLeft !== null && secondsPerQuestion
      ? Math.max(0, Math.min(100, (secondsLeft / secondsPerQuestion) * 100))
      : null;

  const streakText = streakLabel(streak);

  return (
    <div className="yiq-stack">
      {/* The cards still to come. Presentational only — a screen reader
          should hear the question, not the furniture. */}
      {remaining >= 1 ? <div className="yiq-stack-behind" data-depth="1" aria-hidden="true" /> : null}
      {remaining >= 2 ? <div className="yiq-stack-behind" data-depth="2" aria-hidden="true" /> : null}

      <div className="yiq-card-3d">
        <div
          className="yiq-card-faces"
          data-turning={turning ? "true" : "false"}
          data-turned={shown ? "true" : "false"}
        >
          {/* ─────────────── FRONT: the question ─────────────── */}
          {/* One face at a time. The old two-face version forced the
              explanation to inherit the height of a four-option question,
              leaving a card two-thirds empty under two lines of text. */}
          {shown ? null : (
          <div
            className="yiq-card-face"
            /* Blocking selection is the other half of the anti-AI measures:
               a student who cannot copy the question has to retype it, which
               takes longer than the clock allows. */
            onCopy={(e) => e.preventDefault()}
            onCut={(e) => e.preventDefault()}
            onContextMenu={(e) => e.preventDefault()}
            style={{
              userSelect: "none",
              WebkitUserSelect: "none",
              WebkitTouchCallout: "none",
            }}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="yiq-eyebrow" style={{ color: "var(--yiq-on-paper-dim)" }}>
                  {question.topic || "Question"}
                </p>
                <p
                  className="yiq-data mt-0.5 text-[0.75rem]"
                  style={{ color: "var(--yiq-on-paper-dim)" }}
                >
                  {index + 1} of {total}
                </p>
              </div>

              {ringPct !== null && secondsLeft !== null ? (
                <div
                  className="yiq-ring shrink-0"
                  style={
                    {
                      "--yiq-ring-pct": ringPct,
                      "--yiq-ring-colour":
                        secondsLeft <= 5
                          ? "var(--yiq-vermilion)"
                          : "var(--yiq-ink)",
                    } as React.CSSProperties
                  }
                  role="timer"
                  aria-label={`${secondsLeft} seconds left on this question`}
                >
                  <span>{secondsLeft}</span>
                </div>
              ) : null}
            </div>

            <h1
              className="yiq-display mt-3 text-[1.25rem] leading-snug sm:text-[1.4375rem]"
              style={{ color: "var(--yiq-on-paper)" }}
            >
              {question.text}
            </h1>

            {question.mediaUrl ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={question.mediaUrl}
                alt=""
                className="mt-3 w-full rounded-xl"
                style={{ border: "1px solid var(--yiq-rule-paper)" }}
              />
            ) : null}

            <div className="mt-4 grid gap-2.5">
              {question.options.map((o, oi) => (
                <button
                  key={o.key}
                  type="button"
                  className="yiq-option"
                  data-selected={chosen === o.key ? "true" : "false"}
                  onClick={() => onChoose(o.key)}
                  disabled={disabled}
                  aria-pressed={chosen === o.key}
                >
                  {/* Labelled by POSITION. The server may hand these back in
                      a per-student order, and printing the canonical key
                      would read as "c, a, d, b". */}
                  <span className="yiq-option-key">{displayLabelFor(oi)}</span>
                  <span className="pt-0.5">{o.text}</span>
                </button>
              ))}
            </div>

            <p
              className="mt-3 h-4 text-[0.75rem]"
              style={{ color: "var(--yiq-on-paper-dim)" }}
            >
              {saving ? "Saving…" : chosen ? "Answer saved" : ""}
            </p>
          </div>
          )}

          {/* ─────────────── BACK: why ─────────────── */}
          {/* Rendered only when there is something to say, so a scored paper
              never has an answer-shaped element in its DOM at all. */}
          {shown ? (
            <div
              className="yiq-card-face"
              data-correct={shown.correct ? "true" : "false"}
              role="status"
              aria-live="polite"
            >
              <div className="flex items-center justify-between gap-3">
                <p
                  className="yiq-display text-[1.25rem]"
                  style={{
                    color: shown.correct
                      ? "var(--yiq-green)"
                      : "var(--yiq-vermilion)",
                  }}
                >
                  {shown.correct ? "Right" : "Not this time"}
                </p>

                {streakText ? (
                  <div className="flex items-center gap-2">
                    <span
                      className="yiq-streak"
                      aria-hidden="true"
                    >
                      {Array.from({ length: Math.min(streak, 5) }).map((_, i) => (
                        <i key={i} />
                      ))}
                    </span>
                    <span
                      className="yiq-data text-[0.75rem]"
                      style={{ color: "var(--yiq-on-paper-dim)" }}
                    >
                      {streakText}
                    </span>
                  </div>
                ) : null}
              </div>

              {!shown.correct ? (
                <p
                  className="mt-2 text-[0.875rem]"
                  style={{ color: "var(--yiq-on-paper-dim)" }}
                >
                  The answer was{" "}
                  <strong style={{ color: "var(--yiq-on-paper)" }}>
                    {(() => {
                      const at = question.options.findIndex(
                        (o) => o.key === shown.correctOption
                      );
                      return at >= 0
                        ? `${displayLabelFor(at).toUpperCase()} — ${question.options[at].text}`
                        : shown.correctOption.toUpperCase();
                    })()}
                  </strong>
                  .
                </p>
              ) : null}

              <p
                className="mt-3 text-[0.9375rem] leading-relaxed"
                style={{ color: "var(--yiq-on-paper)" }}
              >
                {shown.explanation ??
                  "No explanation was written for this question."}
              </p>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
