import type { Metadata } from "next";
import Link from "next/link";
import { TopBar, SampleNote, Denied } from "../../../_ui";
import { getDelegateProfileByToken } from "@/lib/take-pride/directory";
import { listJobs, remainingToday } from "@/lib/take-pride/ai/queue";
import { QUESTION_MAX, type AskOutput } from "@/lib/take-pride/ai/schemas";
import { AskForm, AutoRefresh } from "../plan/_client";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Ask the desk" };

export default async function AskPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const me = await getDelegateProfileByToken(token);
  if (!me) {
    return <Denied title="Pass not found" text="This pass link is not valid. Ask the Take Pride desk for your link." />;
  }

  const [jobs, left] = await Promise.all([listJobs(me.id, "ask", 20), remainingToday(me.id, "ask")]);
  const waiting = jobs.filter((j) => j.status === "pending" || j.status === "generating");
  // Poll for 5 minutes from the NEWEST waiting question (jobs are newest first).
  const newestWaiting = waiting.length ? waiting[0].created_at : null;
  const base = `/take-pride/pass/${token}`;

  return (
    <main className="tp-main">
      <TopBar right={<Link href={base} className="tp-btn ghost sm">My pass</Link>} />
      {me.is_sample && <SampleNote>This is a sample delegate for the demo.</SampleNote>}
      <header className="tp-stack" style={{ gap: 6 }}>
        <p className="tp-eyebrow" style={{ margin: 0 }}>{me.full_name}</p>
        <h1 className="tp-h2">Ask the desk</h1>
        <p className="tp-mute" style={{ margin: 0 }}>
          Questions about the agenda, tables, meetings or your own schedule. An AI helper answers from the event
          details. For anything urgent, go to the help desk at the venue.
        </p>
      </header>

      <section className="tp-card" aria-label="Ask a question">
        <AskForm token={token} max={QUESTION_MAX} remaining={left} />
      </section>

      {newestWaiting && <AutoRefresh key={newestWaiting} since={newestWaiting} label="Your question is being answered, usually 1–2 minutes." />}

      <section className="tp-card" aria-labelledby="tp-my-q" data-tp="ask-list">
        <h2 className="tp-h2" id="tp-my-q">My questions</h2>
        {jobs.length === 0 ? (
          <p className="tp-mute" style={{ margin: 0 }}>You have not asked anything yet.</p>
        ) : (
          <div className="tp-list">
            {jobs.map((j) => {
              const question = typeof j.input?.question === "string" ? j.input.question : "";
              const answer = j.status === "ready" ? (j.output as AskOutput | null)?.answer : null;
              return (
                <article key={j.id} className="tp-stack" style={{ gap: 4 }} data-tp="ask-item" data-status={j.status}>
                  <b>{question}</b>
                  {answer ? (
                    <p style={{ margin: 0, whiteSpace: "pre-wrap" }}>{answer}</p>
                  ) : j.status === "failed" ? (
                    <span className="tp-small">We could not answer this one. Please ask at the help desk.</span>
                  ) : (
                    <span className="tp-tag saffron" style={{ alignSelf: "flex-start" }}>Being answered</span>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </section>

      <nav className="tp-row" style={{ justifyContent: "flex-start" }} aria-label="More AI help">
        <Link href={`${base}/plan`} className="tp-btn ghost sm">My summit plan</Link>
        <Link href={`${base}/radar`} className="tp-btn ghost sm">Opportunity radar</Link>
      </nav>
    </main>
  );
}
