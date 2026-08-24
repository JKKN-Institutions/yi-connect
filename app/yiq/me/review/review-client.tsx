"use client";

import { useState } from "react";
import Link from "next/link";
import type { Review } from "../../actions/review";

const INK = "#0a1633";
const PAPER = "#f7f4ed";
const PAPER_2 = "#ede8dc";
const SAFFRON = "#e8a33d";
const GREEN = "#14795a";
const VERMILION = "#c8452f";
const DIM = "#5a6480";
const DIM_ON_INK = "#9fb0d4";

/**
 * Walk one sat paper, question by question.
 *
 * The server decides whether the key travels at all — when `canReveal` is
 * false every item arrives with correctAnswer / isCorrect / marksAwarded /
 * explanation already null, so there is nothing here to hide. This component
 * only chooses how to SAY that, and it says it plainly rather than hiding the
 * screen: the student can still see their own answers and their own score.
 *
 * Built for a 390px phone first — nothing primary is behind a `sm:`.
 */
export function ReviewClient({ review }: { review: Review }) {
  const [index, setIndex] = useState(0);
  const total = review.items.length;
  const item = review.items[index];

  return (
    <div className="flex min-h-screen flex-col" style={{ background: PAPER }}>
      {/* ---- Sticky header: where you are + what you scored --------------- */}
      <header
        className="sticky top-0 z-10 border-b"
        style={{ background: INK, borderColor: "rgba(247,244,237,0.14)" }}
      >
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-3 px-4 py-3">
          <div className="min-w-0">
            {/* -my-1/py-1 keeps the small eyebrow type but gives the link a
                thumb-sized hit area on a phone. */}
            <Link
              href="/yiq/me/review"
              className="yiq-eyebrow -my-1 block truncate py-1"
              style={{ color: DIM_ON_INK }}
            >
              ← All my papers
            </Link>
            <p className="mt-0.5 truncate text-[0.9375rem] font-semibold" style={{ color: PAPER }}>
              {review.isMock ? "Practice" : review.paperName}
              {total > 0 ? (
                <span style={{ color: DIM_ON_INK }}>
                  {" "}
                  · Q{index + 1} of {total}
                </span>
              ) : null}
            </p>
          </div>
          <div className="flex-none text-right">
            <p className="yiq-data text-[1.375rem] font-bold" style={{ color: PAPER }}>
              {review.score}
            </p>
            <p className="yiq-eyebrow" style={{ color: DIM_ON_INK }}>
              Score
            </p>
          </div>
        </div>
      </header>

      <main id="yiq-main" className="mx-auto w-full max-w-2xl flex-1 px-4 py-5">
        {/* ---- Score summary — shown whether or not the key is open ------- */}
        <section
          className="rounded-2xl p-4"
          style={{ background: "#fff", border: "1px solid rgba(10,22,51,0.12)" }}
        >
          <p className="yiq-eyebrow" style={{ color: DIM }}>
            {review.isMock ? "Practice run" : "Final online round"}
          </p>
          <div className="mt-2 flex flex-wrap items-baseline gap-x-5 gap-y-1.5">
            <Stat label="Correct" value={review.correctCount} colour={GREEN} />
            <Stat label="Wrong" value={review.wrongCount} colour={VERMILION} />
            <Stat label="Blank" value={review.unansweredCount} colour={DIM} />
            <Stat label="Questions" value={review.totalQuestions} colour={INK} />
          </div>
          {review.timeTakenSeconds !== null ? (
            <p className="mt-2 text-[0.8125rem]" style={{ color: DIM }}>
              Finished in {formatDuration(review.timeTakenSeconds)}.
            </p>
          ) : null}
        </section>

        {/* ---- Why the key is shut, said plainly -------------------------- */}
        {!review.canReveal ? (
          <p
            className="mt-3 rounded-2xl p-4 text-[0.9375rem] leading-relaxed"
            style={{
              background: "rgba(232,163,61,0.14)",
              border: `1px solid ${SAFFRON}`,
              color: INK,
            }}
          >
            <strong>{review.reason ?? "Answers are not open yet."}</strong> Until
            then you can read back every question and the answer you gave — your
            score above is final either way.
          </p>
        ) : null}

        {total === 0 || !item ? (
          <p className="mt-6 text-[0.9375rem]" style={{ color: DIM }}>
            The questions from this paper are no longer available to read back.
          </p>
        ) : (
          <>
            {/* ---- The question ------------------------------------------ */}
            <article className="mt-5">
              <p className="yiq-eyebrow" style={{ color: DIM }}>
                Question {item.number}
                {item.topic ? ` · ${item.topic}` : ""}
              </p>
              <h1
                className="mt-2 text-[1.25rem] font-semibold leading-snug sm:text-[1.375rem]"
                style={{ color: INK }}
              >
                {item.questionText}
              </h1>

              {item.mediaUrl ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={item.mediaUrl}
                  alt=""
                  className="mt-4 w-full rounded-xl"
                  style={{ border: "1px solid rgba(10,22,51,0.12)" }}
                />
              ) : null}

              <div className="mt-5 grid gap-2.5">
                {item.options.map((o) => {
                  const yours = item.yourAnswer === o.key;
                  const right = review.canReveal && item.correctAnswer === o.key;
                  const yoursAndWrong =
                    review.canReveal && yours && item.correctAnswer !== null && !right;

                  return (
                    <div
                      key={o.key}
                      className="yiq-option"
                      data-selected={yours ? "true" : "false"}
                      style={{
                        // .yiq-option is a button style; this is a read-only
                        // row, so it must not offer a pointer.
                        cursor: "default",
                        ...(right
                          ? { borderColor: GREEN, boxShadow: `inset 0 0 0 1.5px ${GREEN}` }
                          : yoursAndWrong
                            ? {
                                borderColor: VERMILION,
                                boxShadow: `inset 0 0 0 1.5px ${VERMILION}`,
                              }
                            : {}),
                      }}
                    >
                      <span
                        className="yiq-option-key"
                        style={
                          right
                            ? { background: GREEN, color: PAPER }
                            : yoursAndWrong
                              ? { background: VERMILION, color: PAPER }
                              : undefined
                        }
                      >
                        {o.key}
                      </span>
                      <span className="pt-0.5">
                        {o.text}
                        {yours ? (
                          <Tag colour={yoursAndWrong ? VERMILION : INK}>Your answer</Tag>
                        ) : null}
                        {right && !yours ? <Tag colour={GREEN}>Correct answer</Tag> : null}
                        {right && yours ? <Tag colour={GREEN}>Correct</Tag> : null}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* ---- Verdict --------------------------------------------- */}
              <p className="mt-4 text-[0.9375rem] font-semibold" style={{ color: verdictColour(item) }}>
                {verdictText(item, review.canReveal)}
              </p>

              {item.explanation ? (
                <div
                  className="mt-4 rounded-xl p-4"
                  style={{ background: PAPER_2, color: INK }}
                >
                  <p className="yiq-eyebrow" style={{ color: DIM }}>
                    Why
                  </p>
                  <p className="mt-1.5 text-[0.9375rem] leading-relaxed">
                    {item.explanation}
                  </p>
                </div>
              ) : null}
            </article>

            {/* ---- Jump to any question ---------------------------------- */}
            <nav className="mt-7" aria-label="Questions">
              <p className="yiq-eyebrow mb-2" style={{ color: DIM }}>
                All {total} questions
              </p>
              <ul className="flex flex-wrap gap-1.5">
                {review.items.map((it, i) => {
                  const here = i === index;
                  const bg = review.canReveal
                    ? it.isCorrect === true
                      ? GREEN
                      : it.isCorrect === false
                        ? VERMILION
                        : "#fff"
                    : it.yourAnswer
                      ? INK
                      : "#fff";
                  const fg =
                    bg === "#fff" ? INK : PAPER;
                  return (
                    <li key={it.questionId}>
                      <button
                        type="button"
                        onClick={() => setIndex(i)}
                        aria-current={here ? "true" : undefined}
                        aria-label={`Question ${i + 1}${
                          review.canReveal
                            ? it.isCorrect === true
                              ? ", correct"
                              : it.isCorrect === false
                                ? ", wrong"
                                : ", not answered"
                            : it.yourAnswer
                              ? ", answered"
                              : ", not answered"
                        }`}
                        className="yiq-data h-9 w-9 rounded-lg text-[0.75rem] font-semibold"
                        style={{
                          background: bg,
                          color: fg,
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
          </>
        )}
      </main>

      {total > 0 ? (
        <footer
          className="sticky bottom-0 border-t"
          style={{ background: PAPER, borderColor: "rgba(10,22,51,0.12)" }}
        >
          <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-3">
            <button
              type="button"
              onClick={() => setIndex((i) => Math.max(0, i - 1))}
              disabled={index === 0}
              className="rounded-full border px-5 py-3 text-[0.875rem] font-semibold disabled:opacity-40"
              style={{ borderColor: "rgba(10,22,51,0.2)", color: INK }}
            >
              Back
            </button>
            {index < total - 1 ? (
              <button
                type="button"
                onClick={() => setIndex((i) => Math.min(total - 1, i + 1))}
                className="flex-1 rounded-full py-3 text-[0.9375rem] font-bold"
                style={{ background: INK, color: PAPER }}
              >
                Next question
              </button>
            ) : (
              <Link
                href="/yiq/me"
                className="flex-1 rounded-full py-3 text-center text-[0.9375rem] font-bold"
                style={{ background: SAFFRON, color: INK }}
              >
                Back to my YIQ
              </Link>
            )}
          </div>
        </footer>
      ) : null}
    </div>
  );
}

function Tag({ colour, children }: { colour: string; children: React.ReactNode }) {
  return (
    <span
      className="yiq-eyebrow ml-2 inline-block align-middle rounded-full px-2 py-0.5"
      style={{ background: colour, color: PAPER }}
    >
      {children}
    </span>
  );
}

function Stat({ label, value, colour }: { label: string; value: number; colour: string }) {
  return (
    <span className="flex items-baseline gap-1.5">
      <span className="yiq-data text-[1.25rem] font-bold" style={{ color: colour }}>
        {value}
      </span>
      <span className="text-[0.8125rem]" style={{ color: DIM }}>
        {label}
      </span>
    </span>
  );
}

type Item = Review["items"][number];

function verdictColour(item: Item): string {
  if (item.isCorrect === true) return GREEN;
  if (item.isCorrect === false) return VERMILION;
  return DIM;
}

function verdictText(item: Item, canReveal: boolean): string {
  if (!canReveal) {
    return item.yourAnswer
      ? `You answered ${item.yourAnswer.toUpperCase()}.`
      : "You left this one blank.";
  }
  if (item.yourAnswer === null) return "You left this one blank. No marks lost.";
  if (item.isCorrect === true) return `Correct. ${formatMarks(item.marksAwarded)}`;
  if (item.isCorrect === false) return `Wrong. ${formatMarks(item.marksAwarded)}`;
  return "This question was not marked.";
}

function formatMarks(marks: number | null): string {
  if (marks === null || marks === 0) return "No marks.";
  return marks > 0 ? `+${marks} marks.` : `${marks} marks.`;
}

function formatDuration(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  if (m === 0) return `${r} sec`;
  return `${m} min ${String(r).padStart(2, "0")} sec`;
}
