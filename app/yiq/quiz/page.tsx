import Link from "next/link";
import { redirect } from "next/navigation";
import { getYiqSession } from "@/lib/yiq/auth/yiq-session";
import { startAttempt } from "../actions/attempt";
import { QuizClient } from "./quiz-client";

export const dynamic = "force-dynamic";
export const metadata = { title: "Quiz" };

const INK = "#0a1633";
const PAPER = "#f7f4ed";

export default async function QuizPage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string }>;
}) {
  const session = await getYiqSession();
  if (!session || session.type !== "student") redirect("/yiq/login");

  const { mode } = await searchParams;
  const kind = mode === "round" ? "online_round" : "mock";

  const res = await startAttempt(kind);

  if (!res.success) {
    return (
      <main
        id="yiq-main"
        className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-5"
        style={{ background: PAPER }}
      >
        <h1 className="yiq-display text-[2rem]" style={{ color: INK }}>
          {res.alreadyDone ? "Already done" : "Not available"}
        </h1>
        <p className="mt-3 text-[0.9375rem] leading-relaxed" style={{ color: "#5a6480" }}>
          {res.error}
        </p>
        <Link
          href="/yiq/me"
          className="mt-7 self-start rounded-full px-6 py-3.5 text-[0.9375rem] font-bold"
          style={{ background: "#e8a33d", color: INK }}
        >
          Back to my YIQ
        </Link>
      </main>
    );
  }

  return (
    <QuizClient
      attemptId={res.attemptId}
      expiresAt={res.expiresAt}
      questions={res.questions}
      initialAnswers={res.answers}
      paperName={res.paperName}
      durationMinutes={res.durationMinutes}
      isMock={kind === "mock"}
    />
  );
}
