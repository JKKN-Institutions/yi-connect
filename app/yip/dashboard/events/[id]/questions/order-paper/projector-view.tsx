"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Printer } from "lucide-react";

export type ProjectorQuestion = {
  id: string;
  ministry: string;
  text: string;
  memberName: string;
  constituency: string | null;
};

const PER_SCREEN = 4;

/**
 * The Order Paper on the big screen — the approved questions that never
 * reached the floor, sized to be read from the back of a hall.
 *
 * The printable A4 list beside this one serves the Chair's chapter report;
 * neither is readable on a projector at 11pt. On the SRTN regional round 135
 * questions were approved and Question Hour had only just begun to run, so all
 * but a handful were researched, written and then never heard. Putting them on
 * the screen between items is the cheapest way to give that work an audience.
 *
 * QUESTIONS ONLY — the member's name and constituency (their own authored
 * content) and nothing else. No marks, no positions, no ordering that could be
 * read as a ranking: the sequence is the House's call order.
 *
 * Paged rather than scrolled, because nobody scrolls a projector: ← / → or
 * space, and the on-screen arrows for a touch panel.
 */
export function OrderPaperProjector({
  eventName,
  questions,
  backHref,
}: {
  eventName: string;
  questions: ProjectorQuestion[];
  backHref: string;
}) {
  const pageCount = Math.max(1, Math.ceil(questions.length / PER_SCREEN));
  const [page, setPage] = useState(0);

  const next = useCallback(
    () => setPage((p) => Math.min(pageCount - 1, p + 1)),
    [pageCount]
  );
  const prev = useCallback(() => setPage((p) => Math.max(0, p - 1)), []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowRight" || e.key === " " || e.key === "PageDown") {
        e.preventDefault();
        next();
      } else if (e.key === "ArrowLeft" || e.key === "PageUp") {
        e.preventDefault();
        prev();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [next, prev]);

  const start = page * PER_SCREEN;
  const shown = questions.slice(start, start + PER_SCREEN);

  return (
    <div className="flex min-h-screen flex-col bg-gray-950 text-white">
      {/* Header */}
      <header className="flex items-start justify-between gap-6 border-b border-white/10 px-10 py-6">
        <div className="min-w-0">
          <p className="text-sm font-bold uppercase tracking-[0.22em] text-[#FF9933]">
            Questions Tabled but Not Yet Put
          </p>
          <h1 className="mt-1 truncate text-4xl font-bold">{eventName}</h1>
          <p className="mt-1 text-lg text-white/50">
            {questions.length} approved question
            {questions.length === 1 ? "" : "s"} awaiting the floor
          </p>
        </div>
        <Link
          href={backHref}
          className="shrink-0 rounded-lg border border-white/15 px-3 py-2 text-sm text-white/60 transition-colors hover:bg-white/5 hover:text-white"
        >
          <span className="flex items-center gap-1.5">
            <Printer className="size-4" />
            Printable list
          </span>
        </Link>
      </header>

      {/* Questions */}
      <main className="flex flex-1 flex-col justify-center gap-6 px-10 py-8">
        {shown.length === 0 ? (
          <p className="text-center text-2xl text-white/40">
            No approved questions are waiting. Approve questions on the Question
            Hour page and they will appear here.
          </p>
        ) : (
          shown.map((q, i) => (
            <article
              key={q.id}
              className="border-l-4 border-[#FF9933] pl-6"
            >
              <p className="text-sm font-bold uppercase tracking-[0.18em] text-[#FF9933]/80">
                {start + i + 1}. {q.ministry}
              </p>
              <p className="mt-1.5 text-[26px] leading-snug xl:text-[30px]">
                {q.text}
              </p>
              <p className="mt-1.5 text-lg text-white/45">
                {q.memberName}
                {q.constituency ? ` · ${q.constituency}` : ""}
              </p>
            </article>
          ))
        )}
      </main>

      {/* Pager */}
      <footer className="flex items-center justify-between border-t border-white/10 px-10 py-5">
        <button
          type="button"
          onClick={prev}
          disabled={page === 0}
          className="flex items-center gap-1.5 rounded-lg border border-white/15 px-4 py-2.5 text-base text-white/70 transition-colors hover:bg-white/5 disabled:opacity-25"
          aria-label="Previous questions"
        >
          <ChevronLeft className="size-5" />
          Back
        </button>

        <p className="text-lg text-white/40">
          Screen {page + 1} of {pageCount}
          <span className="ml-3 hidden text-sm text-white/25 sm:inline">
            ← → or space
          </span>
        </p>

        <button
          type="button"
          onClick={next}
          disabled={page >= pageCount - 1}
          className="flex items-center gap-1.5 rounded-lg border border-white/15 px-4 py-2.5 text-base text-white/70 transition-colors hover:bg-white/5 disabled:opacity-25"
          aria-label="Next questions"
        >
          Next
          <ChevronRight className="size-5" />
        </button>
      </footer>
    </div>
  );
}
