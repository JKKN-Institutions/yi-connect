import type { Metadata } from "next";
import Link from "next/link";
import { TopBar, SampleNote, Denied } from "../../../_ui";
import { getAgenda } from "@/lib/take-pride/data";
import { getDelegateMeByToken } from "@/lib/take-pride/delegate-match";
import {
  DAY_LABEL,
  choicesFor,
  dKey,
  getMyAcceptedMeetings,
  loadBookings,
  whenWhere,
  computeSlots,
  type MyMeeting,
} from "@/lib/take-pride/slots";
import { DelegatePickTime } from "./_client";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "My schedule" };

type Line =
  | { type: "agenda"; time: string; title: string; hall: string; id: string }
  | { type: "meeting"; time: string; end: string; m: MyMeeting };

export default async function SchedulePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const me = await getDelegateMeByToken(token);
  if (!me) {
    return <Denied title="Pass not found" text="This pass link is not valid. Ask the Take Pride desk for your link." />;
  }

  const [agenda, meetings, bookings] = await Promise.all([getAgenda(), getMyAcceptedMeetings(me.id), loadBookings()]);
  const slots = computeSlots(agenda);
  const slotOf = new Map(slots.map((s) => [s.key, s]));
  const meKey = dKey(me.id);

  const timed = meetings.filter((m) => m.slot_key && m.table_no && slotOf.has(m.slot_key));
  const untimed = meetings.filter((m) => !timed.includes(m));
  const days = [...new Set([...agenda.map((a) => a.day), ...slots.map((s) => s.day)])].sort((a, b) => a - b);

  const linesFor = (day: number): Line[] => {
    const lines: Line[] = [
      ...agenda
        .filter((a) => a.day === day)
        .map((a): Line => ({ type: "agenda", time: a.starts_at, title: a.title, hall: a.hall, id: a.id })),
      ...timed
        .filter((m) => slotOf.get(m.slot_key!)!.day === day)
        .map((m): Line => {
          const s = slotOf.get(m.slot_key!)!;
          return { type: "meeting", time: s.start, end: s.end, m };
        }),
    ];
    // Zero-padded "HH:MM" sorts as text. An agenda item comes before a
    // meeting that starts at the same minute (the block, then my slot in it).
    return lines.sort((a, b) => a.time.localeCompare(b.time) || (a.type === b.type ? 0 : a.type === "agenda" ? -1 : 1));
  };

  const pick = (m: MyMeeting) => (
    <DelegatePickTime
      token={token}
      kind={m.kind}
      meetingId={m.id}
      when={whenWhere(slots, m.slot_key, m.table_no)}
      currentKey={m.slot_key}
      choices={choicesFor(slots, bookings, [meKey, m.other], { kind: m.kind, id: m.id })}
    />
  );

  return (
    <main className="tp-main">
      <TopBar right={<Link href={`/take-pride/pass/${token}`} className="tp-btn ghost sm">My pass</Link>} />
      {me.is_sample && <SampleNote>Sample delegate and sample agenda for the demo.</SampleNote>}

      <header className="tp-stack" style={{ gap: 6 }}>
        <p className="tp-eyebrow" style={{ margin: 0 }}>{me.full_name}</p>
        <h1 className="tp-h2">My schedule</h1>
        <p className="tp-mute" style={{ margin: 0 }}>
          The agenda with your meetings in it. Meetings are 15 minutes, at a numbered table in the Partner lounge.
        </p>
        <div className="tp-row" style={{ justifyContent: "flex-start" }}>
          <Link href={`/take-pride/pass/${token}/meet`} className="tp-btn ghost sm" data-tp="go-meet">
            People to meet
          </Link>
        </div>
      </header>

      {untimed.length > 0 && (
        <section className="tp-card hi" aria-labelledby="tp-unset" data-tp="untimed">
          <div className="tp-row">
            <h2 className="tp-h2" id="tp-unset">Time not set</h2>
            <span className="tp-tag saffron tp-num">{untimed.length}</span>
          </div>
          <p className="tp-small" style={{ margin: 0 }}>Accepted meetings without a time yet. Pick one so you both know when and where.</p>
          <div className="tp-list">
            {untimed.map((m) => (
              <article key={`${m.kind}-${m.id}`} className="tp-stack" style={{ gap: 6 }} data-tp="untimed-row">
                <div style={{ minWidth: 0 }}>
                  <h3 className="tp-h3">{m.title}</h3>
                  <p className="tp-small" style={{ margin: 0 }}>{m.detail}</p>
                </div>
                {pick(m)}
              </article>
            ))}
          </div>
        </section>
      )}

      {days.length === 0 ? (
        <section className="tp-card">
          <p className="tp-mute" style={{ margin: 0 }}>The agenda will appear here soon.</p>
        </section>
      ) : (
        days.map((day) => (
          <section key={day} className="tp-card" aria-label={DAY_LABEL[day] ?? `Day ${day}`} data-tp={`day-${day}`}>
            <h2 className="tp-eyebrow" style={{ margin: 0 }}>{DAY_LABEL[day] ?? `Day ${day}`}</h2>
            <div className="tp-list">
              {linesFor(day).map((l) =>
                l.type === "agenda" ? (
                  <div key={l.id} data-tp="line-agenda" style={{ display: "grid", gridTemplateColumns: "56px minmax(0, 1fr)", gap: 10 }}>
                    <span className="tp-num" style={{ fontWeight: 700 }}>{l.time}</span>
                    <div style={{ minWidth: 0 }}>
                      <div>{l.title}</div>
                      <div className="tp-small">{l.hall}</div>
                    </div>
                  </div>
                ) : (
                  <div
                    key={`${l.m.kind}-${l.m.id}`}
                    data-tp="line-meeting"
                    style={{
                      display: "grid",
                      gridTemplateColumns: "56px minmax(0, 1fr)",
                      gap: 10,
                      background: "var(--tp-green-wash)",
                      borderRadius: 10,
                      padding: "10px 8px",
                      borderBottom: 0,
                      margin: "4px 0",
                    }}
                  >
                    <span className="tp-num" style={{ fontWeight: 700, color: "var(--tp-green)" }}>{l.time}</span>
                    <div className="tp-stack" style={{ gap: 4, minWidth: 0 }}>
                      <div>
                        <b>Meeting: {l.m.title}</b>
                        <div className="tp-small">{l.m.detail}</div>
                      </div>
                      {pick(l.m)}
                    </div>
                  </div>
                )
              )}
            </div>
          </section>
        ))
      )}

      {meetings.length === 0 && (
        <p className="tp-mute" style={{ margin: 0 }} data-tp="no-meetings">
          No accepted meetings yet. When a meeting is accepted, it shows here so you can pick a time.
        </p>
      )}
    </main>
  );
}
