import Link from "next/link";
import { redirect } from "next/navigation";
import { getYiqSession } from "@/lib/yiq/auth/yiq-session";
import { getReview, listMyAttempts } from "../../actions/review";
import { ReviewClient } from "./review-client";

export const dynamic = "force-dynamic";
export const metadata = { title: "Review" };

const INK = "#0a1633";
const PAPER = "#f7f4ed";
const SAFFRON = "#e8a33d";
// On the ink ground the paper-side green (#14795a) and vermilion (#c8452f)
// fail contrast, so these are their on-ink counterparts.
const GREEN_ON_INK = "#5fd3a8";
const VERMILION_ON_INK = "#ff9d8b";
const DIM = "#9fb0d4";
const RULE = "rgba(247,244,237,0.14)";

/**
 * The student's own papers, after the fact.
 *
 * `?attempt=<id>` opens one paper question by question; without it this is the
 * list. Both views are gated by the server action, which decides — from the
 * signed session, the attempt's status and the chapter's status — whether the
 * answer key may be read at all. This page never makes that call itself.
 */
export default async function ReviewPage({
  searchParams,
}: {
  searchParams: Promise<{ attempt?: string }>;
}) {
  const session = await getYiqSession();
  if (!session || session.type !== "student") redirect("/yiq/login");

  const { attempt: attemptId } = await searchParams;

  if (attemptId) {
    const res = await getReview(attemptId);
    if (!res.success) {
      return (
        <Shell>
          <p className="yiq-eyebrow" style={{ color: SAFFRON }}>
            Review
          </p>
          <h1 className="yiq-display mt-2 text-[2rem]">Not available</h1>
          <p className="mt-3 text-[0.9375rem] leading-relaxed" style={{ color: DIM }}>
            {res.error}
          </p>
          <Link
            href="/yiq/me/review"
            className="mt-7 inline-block rounded-full px-6 py-3.5 text-[0.9375rem] font-bold"
            style={{ background: SAFFRON, color: INK }}
          >
            All my papers
          </Link>
        </Shell>
      );
    }
    return <ReviewClient review={res.review} />;
  }

  const list = await listMyAttempts();
  if (!list.success) {
    return (
      <Shell>
        <h1 className="yiq-display text-[2rem]">Not available</h1>
        <p className="mt-3 text-[0.9375rem]" style={{ color: DIM }}>
          {list.error}
        </p>
        <Link
          href="/yiq/login"
          className="mt-7 inline-block rounded-full px-6 py-3.5 text-[0.9375rem] font-bold"
          style={{ background: SAFFRON, color: INK }}
        >
          Sign in
        </Link>
      </Shell>
    );
  }

  const { attempts } = list;

  return (
    <main id="yiq-main" style={{ background: INK, minHeight: "100vh", color: PAPER }}>
      <header className="border-b" style={{ borderColor: RULE }}>
        <div className="mx-auto flex max-w-2xl items-center justify-between px-5 py-4">
          <Link href="/yiq" className="yiq-display text-[1.375rem]">
            YIQ
          </Link>
          <Link href="/yiq/me" className="text-[0.8125rem] underline" style={{ color: DIM }}>
            My YIQ
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-2xl px-5 py-8">
        <p className="yiq-eyebrow" style={{ color: SAFFRON }}>
          {list.chapterName ?? "Your chapter"}
        </p>
        <h1 className="yiq-display mt-2 text-[2.5rem]">Your papers</h1>
        <p className="mt-2 text-[0.9375rem]" style={{ color: DIM }}>
          Every paper you have sat. Open one to walk your answers question by
          question.
        </p>

        {attempts.length === 0 ? (
          <div
            className="mt-8 rounded-2xl p-6"
            style={{ background: "rgba(247,244,237,0.05)", border: `1px solid ${RULE}` }}
          >
            <h2 className="yiq-display text-[1.5rem]">Nothing to review yet</h2>
            <p className="mt-2 text-[0.9375rem]" style={{ color: DIM }}>
              Sit a practice paper and it will show up here straight away, with
              the answers and the reasoning.
            </p>
            <Link
              href="/yiq/quiz?mode=mock"
              className="mt-5 inline-block rounded-full px-5 py-3 text-[0.875rem] font-bold"
              style={{ background: SAFFRON, color: INK }}
            >
              Start practising
            </Link>
          </div>
        ) : (
          <ul className="mt-8 grid gap-2.5">
            {attempts.map((a) => {
              const card = (
                <>
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="yiq-eyebrow" style={{ color: a.isMock ? DIM : SAFFRON }}>
                        {a.isMock ? "Practice" : "Final online round"}
                      </p>
                      <h2 className="yiq-display mt-1.5 text-[1.25rem]">{a.paperName}</h2>
                      <p className="mt-1 text-[0.8125rem]" style={{ color: DIM }}>
                        {a.canReview
                          ? formatWhen(a.submittedAt)
                          : "Still open — finish and submit it"}
                      </p>
                    </div>
                    <div className="flex-none text-right">
                      <p className="yiq-data text-[1.75rem] font-bold">{a.score}</p>
                      <p className="yiq-eyebrow" style={{ color: DIM }}>
                        of {a.totalQuestions}
                      </p>
                    </div>
                  </div>

                  {a.canReview ? (
                    <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-[0.8125rem]">
                      <Tally label="Correct" value={a.correctCount} colour={GREEN_ON_INK} />
                      <Tally label="Wrong" value={a.wrongCount} colour={VERMILION_ON_INK} />
                      <Tally label="Blank" value={a.unansweredCount} colour={DIM} />
                    </div>
                  ) : null}

                  <p
                    className="mt-3 text-[0.8125rem] leading-relaxed"
                    style={{ color: a.canReveal ? GREEN_ON_INK : DIM }}
                  >
                    {a.canReveal
                      ? "Answers open — see what was right and why."
                      : (a.reason ?? "Answers are not open yet.")}
                  </p>
                </>
              );

              return (
                <li key={a.attemptId}>
                  {a.canReview ? (
                    <Link
                      href={`/yiq/me/review?attempt=${a.attemptId}`}
                      className="block rounded-2xl p-5"
                      style={{ background: "#12224a", border: `1px solid ${RULE}` }}
                    >
                      {card}
                    </Link>
                  ) : (
                    <div
                      className="block rounded-2xl p-5"
                      style={{
                        background: "rgba(247,244,237,0.05)",
                        border: `1px solid ${RULE}`,
                      }}
                    >
                      {card}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </main>
  );
}

function Tally({
  label,
  value,
  colour,
}: {
  label: string;
  value: number;
  colour: string;
}) {
  return (
    <span className="flex items-baseline gap-1.5">
      <span className="yiq-data text-[1rem] font-bold" style={{ color: colour }}>
        {value}
      </span>
      <span style={{ color: DIM }}>{label}</span>
    </span>
  );
}

function formatWhen(iso: string | null): string {
  if (!iso) return "Submitted";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "Submitted";
  return d.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main
      id="yiq-main"
      className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center px-5 py-10"
      style={{ background: INK, color: PAPER }}
    >
      {children}
    </main>
  );
}
