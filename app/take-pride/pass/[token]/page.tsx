import type { Metadata } from "next";
import Link from "next/link";
import { TopBar, SampleNote, Denied } from "../../_ui";
import { TP_EVENT } from "@/lib/take-pride/constants";
import { getAgenda, getDelegateByToken, getDelegateMeetings } from "@/lib/take-pride/data";
import type { TpAgendaItem } from "@/lib/take-pride/types";
import { countIncomingPending } from "@/lib/take-pride/delegate-match";
import { getMyPledge } from "@/lib/take-pride/directory";
import { BadgeQr, MeetingRespond, OptInToggle } from "./_client";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "My pass" };

const DAY_LABEL: Record<number, string> = { 1: "Day 1 · 18 Dec", 2: "Day 2 · 19 Dec" };

function istTime(iso: string): string {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}

export default async function PassPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const delegate = await getDelegateByToken(token);
  if (!delegate) {
    return <Denied title="Pass not found" text="This pass link is not valid. Ask the Take Pride desk for your link." />;
  }

  const [meetings, agenda, delegatesWaiting, pledge] = await Promise.all([
    getDelegateMeetings(delegate.id),
    getAgenda(),
    countIncomingPending(delegate.id),
    getMyPledge(delegate.id),
  ]);
  const days = new Map<number, TpAgendaItem[]>();
  for (const a of agenda) days.set(a.day, [...(days.get(a.day) ?? []), a]);
  const agendaIsSample = agenda.some((a) => a.is_sample);
  const work = [delegate.role_title, delegate.business_name].filter(Boolean).join(" · ");

  return (
    <main className="tp-main">
      <TopBar right={<span className="tp-eyebrow">My pass</span>} />
      {delegate.is_sample && <SampleNote>This is a sample delegate for the demo.</SampleNote>}

      {/* Ticket */}
      <section className="tp-card ok tp-ticket" aria-label="Your Take Pride pass">
        <div className="tp-stack" style={{ gap: 4 }}>
          <p className="tp-eyebrow" style={{ margin: 0 }}>{TP_EVENT.name}</p>
          <h1 className="tp-h2">{delegate.full_name}</h1>
          {work && <p style={{ margin: 0 }}>{work}</p>}
          <p className="tp-small" style={{ margin: 0 }}>
            {delegate.chapter} · {delegate.zone}
          </p>
        </div>
        <BadgeQr code={delegate.badge_code} />
        <div className="tp-code tp-num">{delegate.badge_code}</div>
        {delegate.checked_in_at ? (
          <span className="tp-tag green">Checked in · {istTime(delegate.checked_in_at)}</span>
        ) : (
          <span className="tp-tag saffron">Show this at the gate</span>
        )}
        <p className="tp-small" style={{ margin: 0 }}>
          {TP_EVENT.dates} · {TP_EVENT.city}
        </p>
      </section>

      {/* Networking */}
      <section className="tp-card hi" aria-labelledby="tp-people" data-tp="meet-card">
        <div className="tp-row">
          <h2 className="tp-h2" id="tp-people">Networking</h2>
          {delegatesWaiting > 0 && (
            <span className="tp-tag saffron tp-num" data-tp="meet-waiting">
              {delegatesWaiting} asked to meet you
            </span>
          )}
        </div>
        {pledge ? (
          <p style={{ margin: 0 }} data-tp="my-pledge">
            <span className="tp-eyebrow">My 1% pledge</span>
            <br />
            {pledge}
          </p>
        ) : (
          <p className="tp-small" style={{ margin: 0 }}>
            Fellow delegates who need what you offer, or offer what you need.
          </p>
        )}
        <nav aria-label="Networking" className="tp-list" data-tp="networking">
          {[
            { href: "meet", label: "Who to meet", hint: "People who need what you offer, or offer what you need", tp: "go-meet" },
            { href: "people", label: "Delegate directory", hint: "Search everyone who chose to be listed", tp: "go-people" },
            { href: "schedule", label: "My schedule", hint: "Your meetings and sessions", tp: "go-schedule" },
            { href: "connect", label: "Scan to connect", hint: "Scan a badge to swap details", tp: "go-connect" },
            { href: "tables", label: "Topic tables", hint: "Join a table on a topic you care about", tp: "go-tables" },
            { href: "profile", label: "Edit my profile", hint: "Needs, offers, pledge and directory listing", tp: "go-profile" },
          ].map((l) => (
            <Link
              key={l.href}
              href={`/take-pride/pass/${token}/${l.href}`}
              data-tp={l.tp}
              style={{ display: "block", textDecoration: "none", color: "inherit" }}
            >
              <span className="tp-row" style={{ flexWrap: "nowrap" }}>
                <span style={{ minWidth: 0 }}>
                  <b>{l.label}</b>
                  <br />
                  <span className="tp-small">{l.hint}</span>
                </span>
                <span aria-hidden="true">&rarr;</span>
              </span>
            </Link>
          ))}
        </nav>
        <Link href={`/take-pride/pass/${token}/chapter`} className="tp-small" data-tp="go-chapter">
          Your chapter&rsquo;s Take Pride journey &rarr;
        </Link>
      </section>

      {/* AI helpers (written off-platform by the AI routine; the app only queues) */}
      <section className="tp-card" aria-labelledby="tp-ai" data-tp="ai-card">
        <h2 className="tp-h2" id="tp-ai">AI helpers</h2>
        <nav aria-label="AI helpers" className="tp-list">
          {[
            { href: "plan", label: "My summit plan", hint: "Tell us your goal, get sessions, people and tables", tp: "go-plan" },
            { href: "radar", label: "Opportunity radar", hint: "Who needs what you offer, and buy-together ideas", tp: "go-radar" },
            { href: "ask", label: "Ask the desk", hint: "Questions about the agenda and your schedule", tp: "go-ask" },
            { href: "coach", label: "My 1% coach", hint: "Check in on your pledge after the summit", tp: "go-coach" },
          ].map((l) => (
            <Link
              key={l.href}
              href={`/take-pride/pass/${token}/${l.href}`}
              data-tp={l.tp}
              style={{ display: "block", textDecoration: "none", color: "inherit" }}
            >
              <span className="tp-row" style={{ flexWrap: "nowrap" }}>
                <span style={{ minWidth: 0 }}>
                  <b>{l.label}</b>
                  <br />
                  <span className="tp-small">{l.hint}</span>
                </span>
                <span aria-hidden="true">&rarr;</span>
              </span>
            </Link>
          ))}
        </nav>
      </section>

      {/* Catalyst Partner meetings */}
      <section className="tp-card" aria-labelledby="tp-meet">
        <h2 className="tp-h2" id="tp-meet">Catalyst Partner meetings</h2>
        <p className="tp-small" style={{ margin: 0 }}>
          Catalyst Partners can ask to meet you. You accept or decline each request.
        </p>
        <OptInToggle token={token} optIn={delegate.partner_meetings_opt_in} />
        {meetings.length === 0 ? (
          <p className="tp-mute" style={{ margin: 0 }}>No partner has asked to meet you yet.</p>
        ) : (
          <div className="tp-list">
            {meetings.map((m) => (
              <article key={m.id} className="tp-stack" style={{ gap: 8 }}>
                <div className="tp-row" style={{ alignItems: "flex-start" }}>
                  <div style={{ minWidth: 0 }}>
                    <h3 className="tp-h3">{m.partner.business_name}</h3>
                    <p className="tp-small" style={{ margin: 0 }}>
                      {m.partner.member_name} · {m.partner.chapter} · {m.partner.industry}
                    </p>
                  </div>
                  {m.status === "accepted" && <span className="tp-tag green">Accepted</span>}
                  {m.status === "declined" && <span className="tp-tag">Declined</span>}
                </div>
                {m.partner.pitch && <p style={{ margin: 0 }}>{m.partner.pitch}</p>}
                {m.partner.offers?.length > 0 && (
                  <div className="tp-chips">
                    {m.partner.offers.map((o) => (
                      <span key={o} className="tp-chip">{o}</span>
                    ))}
                  </div>
                )}
                {m.status === "requested" && <MeetingRespond token={token} meetingId={m.id} />}
              </article>
            ))}
          </div>
        )}
      </section>

      {/* Needs */}
      <section className="tp-card" aria-labelledby="tp-needs">
        <h2 className="tp-h2" id="tp-needs">What you are looking for</h2>
        {delegate.needs.length === 0 ? (
          <p className="tp-mute" style={{ margin: 0 }}>Nothing listed yet.</p>
        ) : (
          <div className="tp-chips">
            {delegate.needs.map((n) => (
              <span key={n} className="tp-chip on">{n}</span>
            ))}
          </div>
        )}
      </section>

      {/* Agenda */}
      <section className="tp-card" aria-labelledby="tp-agenda">
        <div className="tp-row">
          <h2 className="tp-h2" id="tp-agenda">Agenda</h2>
          {agendaIsSample && <span className="tp-tag saffron">Sample agenda</span>}
        </div>
        {agenda.length === 0 ? (
          <p className="tp-mute" style={{ margin: 0 }}>The agenda will appear here soon.</p>
        ) : (
          [...days.entries()].map(([day, items]) => (
            <div key={day} className="tp-stack" style={{ gap: 4 }}>
              <h3 className="tp-eyebrow" style={{ margin: "6px 0 0" }}>{DAY_LABEL[day] ?? `Day ${day}`}</h3>
              <div className="tp-list">
                {items.map((a) => (
                  <div key={a.id} style={{ display: "grid", gridTemplateColumns: "56px minmax(0, 1fr)", gap: 10 }}>
                    <span className="tp-num" style={{ fontWeight: 700 }}>{a.starts_at}</span>
                    <div style={{ minWidth: 0 }}>
                      <div>{a.title}</div>
                      <div className="tp-small">{a.hall}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </section>
    </main>
  );
}
