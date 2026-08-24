"use client";

import { useEffect, useState } from "react";

export type ShowcaseQuestion = {
  id: string;
  topic: string;
  text: string;
  options: { key: string; text: string }[];
  correct: string;
};

/**
 * The hero. Not a value proposition — an actual question from the live bank,
 * played the way a student will see it. The product IS the question, so the
 * hero shows one.
 *
 * Cycles: pose -> reveal -> next. Pauses on hover/focus and honours
 * prefers-reduced-motion by holding on a single question.
 */
export function QuestionShowcase({
  questions,
}: {
  questions: ShowcaseQuestion[];
}) {
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (questions.length === 0) return;
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce || paused) return;

    const t = window.setTimeout(
      () => {
        if (revealed) {
          setRevealed(false);
          setIndex((i) => (i + 1) % questions.length);
        } else {
          setRevealed(true);
        }
      },
      revealed ? 2200 : 4200
    );
    return () => window.clearTimeout(t);
  }, [revealed, paused, questions.length]);

  if (questions.length === 0) return null;
  const q = questions[index];

  return (
    <div
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
      className="rounded-[1.25rem] bg-[#f7f4ed] p-5 shadow-[0_24px_70px_-20px_rgba(0,0,0,0.55)] sm:p-6"
      style={{ border: "1px solid rgba(10,22,51,0.10)" }}
      aria-live="polite"
    >
      <div className="flex items-center justify-between gap-3">
        <span
          className="yiq-eyebrow"
          style={{ color: "#5a6480" }}
        >
          {q.topic}
        </span>
        <span
          className="yiq-data text-[0.6875rem]"
          style={{ color: "#5a6480" }}
        >
          {String(index + 1).padStart(2, "0")} / {String(questions.length).padStart(2, "0")}
        </span>
      </div>

      <p
        className="mt-3 text-[1.0625rem] font-semibold leading-snug sm:text-lg"
        style={{ color: "#0a1633" }}
      >
        {q.text}
      </p>

      <ul className="mt-4 grid gap-2">
        {q.options.map((o) => {
          const isAnswer = revealed && o.key === q.correct;
          return (
            <li key={o.key}>
              <div
                className="yiq-option"
                data-selected={isAnswer ? "true" : "false"}
                style={
                  isAnswer
                    ? {
                        borderColor: "#14795a",
                        boxShadow: "inset 0 0 0 1.5px #14795a",
                      }
                    : undefined
                }
              >
                <span
                  className="yiq-option-key"
                  style={
                    isAnswer
                      ? { background: "#14795a", color: "#f7f4ed" }
                      : undefined
                  }
                >
                  {o.key}
                </span>
                <span className="pt-0.5">{o.text}</span>
              </div>
            </li>
          );
        })}
      </ul>

      <div
        className="mt-4 h-[3px] w-full overflow-hidden rounded-full"
        style={{ background: "rgba(10,22,51,0.10)" }}
      >
        <div
          className="h-full rounded-full transition-all duration-[4200ms] ease-linear"
          style={{
            width: revealed ? "100%" : "8%",
            background: revealed ? "#14795a" : "#e8a33d",
          }}
        />
      </div>
    </div>
  );
}
