import type { Metadata } from "next";
import Link from "next/link";
import { after } from "next/server";
import { TopBar, SampleNote, Denied } from "../../../_ui";
import { getDelegateProfileByToken } from "@/lib/take-pride/directory";
import { latestJob, latestReadyJob, pingLiveTrigger, remainingToday } from "@/lib/take-pride/ai/queue";
import { ensureWhyMeetToday, getWhyMeet } from "@/lib/take-pride/ai/why-meet";
import { livePeople, resolveRadar } from "@/lib/take-pride/ai/views";
import type { RadarOutput } from "@/lib/take-pride/ai/schemas";
import { AutoRefresh, RadarRefresh } from "../plan/_client";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Opportunity radar" };

function istDate(iso: string): string {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}

export default async function RadarPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const me = await getDelegateProfileByToken(token);
  if (!me) {
    return <Denied title="Pass not found" text="This pass link is not valid. Ask the Take Pride desk for your link." />;
  }

  const [queued, last, ready, left, why] = await Promise.all([
    ensureWhyMeetToday(me.id),
    latestJob(me.id, "radar"),
    latestReadyJob(me.id, "radar"),
    remainingToday(me.id, "radar"),
    getWhyMeet(me.id),
  ]);
  if (queued) after(() => pingLiveTrigger());

  const waiting = last && (last.status === "pending" || last.status === "generating");
  const radar = ready?.output ? await resolveRadar(me, ready.output as RadarOutput) : null;
  const whyPeople = await livePeople(me, [...why.keys()]);
  const base = `/take-pride/pass/${token}`;

  return (
    <main className="tp-main">
      <TopBar right={<Link href={base} className="tp-btn ghost sm">My pass</Link>} />
      {me.is_sample && <SampleNote>This is a sample delegate for the demo.</SampleNote>}
      <header className="tp-stack" style={{ gap: 6 }}>
        <p className="tp-eyebrow" style={{ margin: 0 }}>{me.full_name}</p>
        <h1 className="tp-h2">Opportunity radar</h1>
        <p className="tp-mute" style={{ margin: 0 }}>
          Who needs what you offer, who offers what you need, and ideas to buy together. Built from the delegate
          directory and your profile.
        </p>
      </header>

      {me.needs.length + me.offers.length === 0 && (
        <p className="tp-alert" style={{ margin: 0 }}>
          Add what you need and offer on <Link href={`${base}/profile`}>your profile</Link> first, or the radar has
          little to go on.
        </p>
      )}

      {waiting && <AutoRefresh key={last!.created_at} since={last!.created_at} label="Your radar is being updated, usually 1–2 minutes." />}
      {last?.status === "failed" && (
        <p className="tp-mute" style={{ margin: 0 }} data-tp="radar-failed">
          We could not update your radar this time.
        </p>
      )}

      {radar ? (
        <section className="tp-card ok" aria-labelledby="tp-radar" data-tp="radar">
          <div className="tp-row">
            <h2 className="tp-h2" id="tp-radar">Your radar</h2>
            {ready?.completed_at && <span className="tp-small">{istDate(ready.completed_at)}</span>}
          </div>
          {radar.summary && <p style={{ margin: 0 }} data-tp="radar-summary">{radar.summary}</p>}
          {radar.deals.length > 0 && (
            <div className="tp-stack" style={{ gap: 6 }}>
              <h3 className="tp-eyebrow" style={{ margin: 0 }}>Deals to explore</h3>
              <div className="tp-list" data-tp="radar-deals">
                {radar.deals.map((d) => (
                  <article key={d.id} className="tp-stack" style={{ gap: 2 }}>
                    <b>{d.full_name}</b>
                    <span className="tp-small">{[d.business_name, d.chapter].filter(Boolean).join(" · ")}</span>
                    <span className="tp-small">{d.text}</span>
                  </article>
                ))}
              </div>
            </div>
          )}
          {radar.groupBuys.length > 0 && (
            <div className="tp-stack" style={{ gap: 6 }}>
              <h3 className="tp-eyebrow" style={{ margin: 0 }}>Buy together</h3>
              <div className="tp-list" data-tp="radar-groupbuys">
                {radar.groupBuys.map((g, i) => (
                  <article key={i} className="tp-stack" style={{ gap: 2 }}>
                    <span>{g.text}</span>
                    {g.people.length > 0 && <span className="tp-small">With {g.people.map((p) => p.full_name).join(", ")}</span>}
                  </article>
                ))}
              </div>
            </div>
          )}
          <Link href={`${base}/meet`} className="tp-small">Ask someone to meet &rarr;</Link>
        </section>
      ) : (
        !waiting && (
          <p className="tp-mute" style={{ margin: 0 }} data-tp="radar-empty">
            No radar yet. Request one below.
          </p>
        )
      )}

      <section className="tp-card" aria-label="Refresh radar">
        <RadarRefresh token={token} remaining={left} busy={!!waiting} />
      </section>

      {whyPeople.size > 0 && (
        <section className="tp-card" aria-labelledby="tp-why" data-tp="why-meet">
          <h2 className="tp-h2" id="tp-why">Why meet them</h2>
          <div className="tp-list">
            {[...why.entries()]
              .filter(([id]) => whyPeople.has(id))
              .map(([id, reason]) => {
                const p = whyPeople.get(id)!;
                return (
                  <article key={id} className="tp-stack" style={{ gap: 2 }}>
                    <b>{p.full_name}</b>
                    <span className="tp-small">{[p.role_title, p.business_name, p.chapter].filter(Boolean).join(" · ")}</span>
                    <span className="tp-small">{reason}</span>
                  </article>
                );
              })}
          </div>
        </section>
      )}

      <nav className="tp-row" style={{ justifyContent: "flex-start" }} aria-label="More AI help">
        <Link href={`${base}/plan`} className="tp-btn ghost sm">My summit plan</Link>
        <Link href={`${base}/ask`} className="tp-btn ghost sm">Ask the desk</Link>
      </nav>
    </main>
  );
}
