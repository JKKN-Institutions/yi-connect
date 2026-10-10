import type { Metadata } from "next";
import Link from "next/link";
import { after } from "next/server";
import { TopBar, SampleNote, Denied } from "../../../_ui";
import { getDelegateProfileByToken } from "@/lib/take-pride/directory";
import { latestJob, latestReadyJob, pingLiveTrigger, remainingToday } from "@/lib/take-pride/ai/queue";
import { ensureWhyMeetToday } from "@/lib/take-pride/ai/why-meet";
import { resolvePlan, type PlanView } from "@/lib/take-pride/ai/views";
import { ABOUT_MAX, GOAL_MAX, type ProfileHelperOutput, type SummitPlanOutput } from "@/lib/take-pride/ai/schemas";
import { AutoRefresh, GoalForm } from "./_client";
import { ProfileAiHelper, type HelperState } from "../profile/ai-helper";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "My summit plan" };

const DAY = (d: number) => (d === 1 ? "Day 1 · 18 Dec" : d === 2 ? "Day 2 · 19 Dec" : `Day ${d}`);

export default async function PlanPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const me = await getDelegateProfileByToken(token);
  if (!me) {
    return <Denied title="Pass not found" text="This pass link is not valid. Ask the Take Pride desk for your link." />;
  }

  const [queued, planJob, readyPlan, planLeft, helperJob, helperLeft] = await Promise.all([
    ensureWhyMeetToday(me.id),
    latestJob(me.id, "summit_plan"),
    latestReadyJob(me.id, "summit_plan"),
    remainingToday(me.id, "summit_plan"),
    latestJob(me.id, "profile_helper"),
    remainingToday(me.id, "profile_helper"),
  ]);
  if (queued) after(() => pingLiveTrigger());

  const planWaiting = planJob && (planJob.status === "pending" || planJob.status === "generating");
  const planFailed = planJob?.status === "failed";
  // Show the newest finished plan; a newer one being written shows above it.
  const plan: PlanView | null = readyPlan?.output ? await resolvePlan(me, readyPlan.output as SummitPlanOutput, readyPlan.allowed?.people ?? []) : null;

  let helper: HelperState = { status: "none" };
  if (helperJob) {
    if (helperJob.status === "pending" || helperJob.status === "generating") helper = { status: "waiting", since: helperJob.created_at };
    else if (helperJob.status === "failed") helper = { status: "failed" };
    else if (helperJob.output) {
      const s = helperJob.output as ProfileHelperOutput;
      helper = { status: "ready", suggestion: { jobId: helperJob.id, ...s } };
    }
  }

  const base = `/take-pride/pass/${token}`;

  return (
    <main className="tp-main">
      <TopBar right={<Link href={base} className="tp-btn ghost sm">My pass</Link>} />
      {me.is_sample && <SampleNote>This is a sample delegate for the demo.</SampleNote>}
      <header className="tp-stack" style={{ gap: 6 }}>
        <p className="tp-eyebrow" style={{ margin: 0 }}>{me.full_name}</p>
        <h1 className="tp-h2">My summit plan</h1>
        <p className="tp-mute" style={{ margin: 0 }}>
          Tell us what you want from the two days. You get the sessions, people, tables and partners worth your time.
        </p>
      </header>

      <section className="tp-card" aria-label="Ask for a plan">
        <GoalForm token={token} max={GOAL_MAX} remaining={planLeft} busy={!!planWaiting} />
      </section>

      {planWaiting && <AutoRefresh key={planJob!.created_at} since={planJob!.created_at} label="Your plan is being written, usually 1–2 minutes." />}
      {planFailed && (
        <p className="tp-mute" style={{ margin: 0 }} data-tp="plan-failed">
          We could not write your plan this time. Please try again.
        </p>
      )}

      {plan && (
        <section className="tp-card ok" aria-labelledby="tp-plan" data-tp="plan">
          <h2 className="tp-h2" id="tp-plan">Your plan</h2>
          {plan.summary && <p style={{ margin: 0 }} data-tp="plan-summary">{plan.summary}</p>}

          {plan.sessions.length > 0 && (
            <div className="tp-stack" style={{ gap: 6 }}>
              <h3 className="tp-eyebrow" style={{ margin: 0 }}>Sessions</h3>
              <div className="tp-list" data-tp="plan-sessions">
                {plan.sessions.map((s) => (
                  <div key={s.id} style={{ display: "grid", gridTemplateColumns: "64px minmax(0, 1fr)", gap: 10 }}>
                    <span className="tp-num tp-small" style={{ fontWeight: 700 }}>
                      {s.day === 1 ? "D1" : "D2"} {s.starts_at}
                    </span>
                    <div style={{ minWidth: 0 }}>
                      <div>{s.title}</div>
                      <div className="tp-small">{DAY(s.day)} · {s.hall}</div>
                      {s.reason && <div className="tp-small">{s.reason}</div>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {plan.people.length > 0 && (
            <div className="tp-stack" style={{ gap: 6 }}>
              <h3 className="tp-eyebrow" style={{ margin: 0 }}>People to meet</h3>
              <div className="tp-list" data-tp="plan-people">
                {plan.people.map((p) => (
                  <article key={p.id} className="tp-stack" style={{ gap: 4 }} data-person={p.id}>
                    <div className="tp-row" style={{ alignItems: "flex-start", flexWrap: "nowrap" }}>
                      <div style={{ minWidth: 0 }}>
                        <b>{p.full_name}</b>
                        <div className="tp-small">
                          {[p.role_title, p.business_name, p.chapter].filter(Boolean).join(" · ")}
                        </div>
                      </div>
                      {p.delegate_meetings_opt_in && (
                        <Link href={`${base}/meet`} className="tp-btn ghost sm" style={{ flex: "none" }} data-tp="plan-ask-meet">
                          Ask to meet
                        </Link>
                      )}
                    </div>
                    {p.reason && <p className="tp-small" style={{ margin: 0 }}>{p.reason}</p>}
                  </article>
                ))}
              </div>
            </div>
          )}

          {plan.tables.length > 0 && (
            <div className="tp-stack" style={{ gap: 6 }}>
              <h3 className="tp-eyebrow" style={{ margin: 0 }}>Topic tables</h3>
              <div className="tp-list" data-tp="plan-tables">
                {plan.tables.map((t) => (
                  <Link
                    key={t.id}
                    href={`${base}/tables`}
                    style={{ display: "block", textDecoration: "none", color: "inherit" }}
                  >
                    <b>{t.title}</b>
                    <div className="tp-small">{DAY(t.day)} · {t.starts_at} · {t.place}</div>
                    {t.reason && <div className="tp-small">{t.reason}</div>}
                  </Link>
                ))}
              </div>
            </div>
          )}

          {plan.partners.length > 0 && (
            <div className="tp-stack" style={{ gap: 6 }}>
              <h3 className="tp-eyebrow" style={{ margin: 0 }}>Catalyst Partners</h3>
              <div className="tp-list" data-tp="plan-partners">
                {plan.partners.map((p) => (
                  <div key={p.id}>
                    <b>{p.business_name}</b>
                    <div className="tp-small">{p.industry}</div>
                    {p.reason && <div className="tp-small">{p.reason}</div>}
                  </div>
                ))}
              </div>
            </div>
          )}
          <p className="tp-small" style={{ margin: 0 }}>
            Written by an AI helper from the agenda and the delegate directory. Check times on the agenda.
          </p>
        </section>
      )}

      <ProfileAiHelper token={token} state={helper} remaining={helperLeft} max={ABOUT_MAX} />

      <nav className="tp-row" style={{ justifyContent: "flex-start" }} aria-label="More AI help">
        <Link href={`${base}/radar`} className="tp-btn ghost sm" data-tp="go-radar">Opportunity radar</Link>
        <Link href={`${base}/ask`} className="tp-btn ghost sm" data-tp="go-ask">Ask the desk</Link>
      </nav>
    </main>
  );
}
