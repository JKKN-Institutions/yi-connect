import type { Metadata } from "next";
import Link from "next/link";
import { TopBar, SampleNote, Denied } from "../../../_ui";
import { getDelegateProfileByToken } from "@/lib/take-pride/directory";
import { livePeople } from "@/lib/take-pride/ai/views";
import { listMyCheckins, type CoachCheckin } from "@/lib/take-pride/coach/queue";
import {
  COACH_STEPS,
  MOOD_LABEL,
  canCheckIn,
  coachNotStarted,
  dueLabel,
  isStepDue,
  type CoachStep,
} from "@/lib/take-pride/coach/schemas";
import { AutoRefresh } from "../plan/_client";
import { CheckinForm } from "./_client";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "My 1% coach" };

const STEP_TITLE: Record<CoachStep, string> = {
  7: "One week on",
  30: "One month on",
  60: "Two months on",
  90: "Three months on",
};

export default async function CoachPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const me = await getDelegateProfileByToken(token);
  if (!me) {
    return <Denied title="Pass not found" text="This pass link is not valid. Ask the Take Pride desk for your link." />;
  }

  const base = `/take-pride/pass/${token}`;
  const pledge = me.pledge?.trim() || null;
  const loaded = await listMyCheckins(me.id);
  const rows = new Map<number, CoachCheckin>((loaded.ok ? loaded.rows : []).map((r) => [r.step, r]));

  // People the coach suggested, looked up live: shown only while still listed and in the same world.
  const pingIds = [...rows.values()].flatMap((r) => (r.status === "ready" ? r.coach_note?.ping.map((p) => p.id) ?? [] : []));
  const people = await livePeople(me, pingIds);

  const notStarted = coachNotStarted();
  const waiting = [...rows.values()]
    .filter((r) => r.status === "pending" || r.status === "generating")
    .sort((a, b) => (b.submitted_at ?? "").localeCompare(a.submitted_at ?? ""))[0];

  return (
    <main className="tp-main">
      <TopBar right={<Link href={base} className="tp-btn ghost sm">My pass</Link>} />
      {me.is_sample && <SampleNote>This is a sample delegate for the demo.</SampleNote>}
      <header className="tp-stack" style={{ gap: 6 }}>
        <p className="tp-eyebrow" style={{ margin: 0 }}>{me.full_name}</p>
        <h1 className="tp-h2">My 1% coach</h1>
        <p className="tp-mute" style={{ margin: 0 }}>
          Four short check-ins after Take Pride on the pledge you made. Tell us what you did, and get one small next
          step and people to ping.
        </p>
      </header>

      <section className={`tp-card ${pledge ? "ok" : ""}`} aria-labelledby="tp-pledge" data-tp="coach-pledge">
        <h2 className="tp-h3" id="tp-pledge">My 1% pledge</h2>
        {pledge ? (
          <p style={{ margin: 0 }} data-tp="coach-pledge-text">{pledge}</p>
        ) : (
          <>
            <p className="tp-mute" style={{ margin: 0 }} data-tp="coach-no-pledge">
              You have not set a pledge yet. Your coach needs one to work with.
            </p>
            <Link href={`${base}/profile`} className="tp-btn saffron sm" data-tp="coach-set-pledge" style={{ justifySelf: "start" }}>
              Set my pledge
            </Link>
          </>
        )}
      </section>

      {!me.is_sample && notStarted && (
        <p className="tp-alert warn" style={{ margin: 0 }} data-tp="coach-not-started">
          Your coach starts on 26 December, one week after Take Pride.
        </p>
      )}

      {!loaded.ok && (
        <p className="tp-small" style={{ margin: 0 }} data-tp="coach-load-failed">
          Your earlier check-ins could not be loaded right now. Reload the page in a minute.
        </p>
      )}

      {waiting && <AutoRefresh key={waiting.submitted_at ?? waiting.id} since={waiting.submitted_at ?? waiting.created_at} label="Your coach is writing back, usually within a few hours." />}

      <section className="tp-stack" aria-label="Check-ins" data-tp="coach-steps">
        {COACH_STEPS.map((step) => {
          const r = rows.get(step);
          const due = isStepDue(step);
          const allowed = !!pledge && canCheckIn(step, me.is_sample);
          const sent = r && r.status !== "open" && r.status !== "failed";
          return (
            <article key={step} className="tp-card" data-tp={`coach-step-${step}`}>
              <div className="tp-row">
                <h2 className="tp-h3" style={{ margin: 0 }}>{STEP_TITLE[step]}</h2>
                <span className={`tp-tag tp-num ${r?.status === "ready" ? "green" : due ? "saffron" : ""}`}>
                  {r?.status === "ready" ? "Done" : due ? `Due ${dueLabel(step)}` : `Opens ${dueLabel(step)}`}
                </span>
              </div>

              {sent && r ? (
                <div className="tp-stack" style={{ gap: 6 }}>
                  <p className="tp-small" style={{ margin: 0 }}>
                    <b>You wrote</b>
                    {r.mood ? ` · ${MOOD_LABEL[r.mood]}` : ""}
                  </p>
                  <p style={{ margin: 0 }} data-tp="coach-my-update">{r.update_text}</p>
                  {r.status === "ready" && r.coach_note ? (
                    <div className="tp-stack" style={{ gap: 6 }} data-tp="coach-note">
                      <p style={{ margin: 0 }}>{r.coach_note.reflection}</p>
                      <p style={{ margin: 0 }}>
                        <span className="tp-eyebrow">Your next small step</span>
                        <br />
                        {r.coach_note.next_step}
                      </p>
                      {r.coach_note.ping.some((p) => people.has(p.id)) && (
                        <div className="tp-stack" style={{ gap: 4 }}>
                          <span className="tp-eyebrow">People to ping</span>
                          <div className="tp-list" data-tp="coach-ping">
                            {r.coach_note.ping
                              .filter((p) => people.has(p.id))
                              .map((p) => {
                                const x = people.get(p.id)!;
                                return (
                                  <article key={p.id} className="tp-stack" style={{ gap: 2 }}>
                                    <b>{x.full_name}</b>
                                    <span className="tp-small">{[x.role_title, x.business_name, x.chapter].filter(Boolean).join(" · ")}</span>
                                    {p.reason && <span className="tp-small">{p.reason}</span>}
                                  </article>
                                );
                              })}
                          </div>
                          <Link href={`${base}/people-saved`} className="tp-small">My people &rarr;</Link>
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="tp-small" style={{ margin: 0 }} data-tp="coach-waiting">Your coach note is on its way.</p>
                  )}
                </div>
              ) : allowed ? (
                <>
                  {r?.status === "failed" && (
                    <p className="tp-mute" style={{ margin: 0 }} data-tp="coach-failed">
                      We could not write your coach note this time. Send your check-in again.
                    </p>
                  )}
                  <CheckinForm token={token} step={step} tryNow={me.is_sample && !due} />
                </>
              ) : (
                <p className="tp-small" style={{ margin: 0 }}>
                  {pledge ? `Opens on ${dueLabel(step)}.` : "Set your pledge first."}
                </p>
              )}
            </article>
          );
        })}
      </section>
    </main>
  );
}
