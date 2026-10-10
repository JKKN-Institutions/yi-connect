import type { Metadata } from "next";
import Link from "next/link";
import { TopBar, SampleNote, Denied } from "../../../_ui";
import {
  DELEGATE_MEET_CAP,
  getDelegateMeByToken,
  getDelegateMeetBoard,
  type DelegateMeetRow,
} from "@/lib/take-pride/delegate-match";
import { AnswerMeet, AskToMeet } from "./_client";
import { getAgenda } from "@/lib/take-pride/data";
import { choicesFor, computeSlots, dKey, getMyAcceptedMeetings, loadBookings, whenWhere } from "@/lib/take-pride/slots";
import { DelegatePickTime } from "../schedule/_client";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "People to meet" };

function StatusTag({ status }: { status: DelegateMeetRow["status"] }) {
  if (status === "accepted") return <span className="tp-tag green">Meeting on</span>;
  if (status === "declined") return <span className="tp-tag">Declined</span>;
  return <span className="tp-tag saffron">Waiting</span>;
}

function OtherLine({ row }: { row: DelegateMeetRow }) {
  if (row.status !== "accepted") return null;
  const bits = [row.other.business_name, row.other.chapter].filter(Boolean).join(" · ");
  return bits ? (
    <p className="tp-small" data-tp="other-detail" style={{ margin: 0 }}>
      {bits}
    </p>
  ) : null;
}

export default async function MeetPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const me = await getDelegateMeByToken(token);
  if (!me) {
    return <Denied title="Pass not found" text="This pass link is not valid. Ask the Take Pride desk for your link." />;
  }
  const [board, agenda, mine, bookings] = await Promise.all([
    getDelegateMeetBoard(me),
    getAgenda(),
    getMyAcceptedMeetings(me.id),
    loadBookings(),
  ]);
  const slots = computeSlots(agenda);
  const timeOf = new Map(mine.filter((m) => m.kind === "delegate").map((m) => [m.id, m]));
  const pickTime = (r: DelegateMeetRow) => {
    const m = r.status === "accepted" ? timeOf.get(r.id) : undefined;
    if (!m) return null;
    return (
      <DelegatePickTime
        token={token}
        kind="delegate"
        meetingId={m.id}
        when={whenWhere(slots, m.slot_key, m.table_no)}
        currentKey={m.slot_key}
        choices={choicesFor(slots, bookings, [dKey(me.id), m.other], { kind: "delegate", id: m.id })}
      />
    );
  };
  const waitingForMe = board.incoming.filter((r) => r.status === "requested");
  const answered = board.incoming.filter((r) => r.status !== "requested");
  const noTags = me.needs.length === 0 && me.offers.length === 0;

  return (
    <main className="tp-main">
      <TopBar right={<Link href={`/take-pride/pass/${token}`} className="tp-btn ghost sm">My pass</Link>} />
      {me.is_sample && <SampleNote>Sample delegates for the demo. The real list replaces them before the event.</SampleNote>}

      <header className="tp-stack" style={{ gap: 6 }}>
        <p className="tp-eyebrow" style={{ margin: 0 }}>Delegate meetings</p>
        <h1 className="tp-h2">People to meet</h1>
        <p className="tp-mute" style={{ margin: 0 }}>
          Fellow delegates who can help you, or whom you can help. You see their business and chapter once they
          accept. Phone numbers and emails are never shown.
        </p>
        <div className="tp-row" style={{ justifyContent: "flex-start" }}>
          <Link href={`/take-pride/pass/${token}/schedule`} className="tp-btn ghost sm" data-tp="go-schedule">
            My schedule
          </Link>
        </div>
      </header>

      {!me.delegate_meetings_opt_in && (
        <p className="tp-alert warn" style={{ margin: 0 }}>
          You are not taking delegate meetings, so others cannot find you.{" "}
          <Link href={`/take-pride/pass/${token}/profile`}>Turn it on in your profile</Link>.
        </p>
      )}

      {/* Requests to me */}
      <section className="tp-card hi" aria-labelledby="tp-in" data-tp="incoming">
        <div className="tp-row">
          <h2 className="tp-h2" id="tp-in">Asked to meet you</h2>
          {waitingForMe.length > 0 && <span className="tp-tag saffron tp-num">{waitingForMe.length} waiting</span>}
        </div>
        {board.incoming.length === 0 ? (
          <p className="tp-mute" style={{ margin: 0 }}>No one has asked yet.</p>
        ) : (
          <div className="tp-list">
            {[...waitingForMe, ...answered].map((r) => (
              <article key={r.id} className="tp-stack" style={{ gap: 6 }} data-tp="in-row">
                <div className="tp-row" style={{ alignItems: "flex-start" }}>
                  <div style={{ minWidth: 0 }}>
                    <h3 className="tp-h3">{r.other.full_name}</h3>
                    <OtherLine row={r} />
                  </div>
                  <StatusTag status={r.status} />
                </div>
                {r.note && <p style={{ margin: 0 }}>&ldquo;{r.note}&rdquo;</p>}
                {r.status === "requested" && <AnswerMeet token={token} meetingId={r.id} />}
                {pickTime(r)}
              </article>
            ))}
          </div>
        )}
      </section>

      {/* Suggestions */}
      <section className="tp-card" aria-labelledby="tp-sug" data-tp="suggestions">
        <h2 className="tp-h2" id="tp-sug">Suggested for you</h2>
        {noTags ? (
          <p className="tp-mute" style={{ margin: 0 }}>
            Tell us what you need and offer, and we will suggest people.{" "}
            <Link href={`/take-pride/pass/${token}/profile`}>Edit my profile</Link>
          </p>
        ) : board.suggestions.length === 0 ? (
          <p className="tp-mute" style={{ margin: 0 }}>
            No new matches right now. Try adding more to what you need or offer in{" "}
            <Link href={`/take-pride/pass/${token}/profile`}>your profile</Link>.
          </p>
        ) : (
          <div className="tp-list">
            {board.suggestions.map((s) => (
              <article key={s.id} className="tp-stack" style={{ gap: 6 }} data-tp="sug-row">
                <h3 className="tp-h3">{s.full_name}</h3>
                <p className="tp-small" style={{ margin: 0 }}>{s.reason}</p>
                {me.delegate_meetings_opt_in && <AskToMeet token={token} toId={s.id} name={s.full_name} />}
              </article>
            ))}
          </div>
        )}
      </section>

      {/* My requests */}
      <section className="tp-card" aria-labelledby="tp-out" data-tp="outgoing">
        <div className="tp-row">
          <h2 className="tp-h2" id="tp-out">You asked</h2>
          <span className="tp-small tp-num">
            {board.openOutgoing} of {DELEGATE_MEET_CAP} waiting
          </span>
        </div>
        {board.outgoing.length === 0 ? (
          <p className="tp-mute" style={{ margin: 0 }}>You have not asked anyone yet.</p>
        ) : (
          <div className="tp-list">
            {board.outgoing.map((r) => (
              <article key={r.id} className="tp-stack" style={{ gap: 6 }} data-tp="out-row">
                <div className="tp-row" style={{ alignItems: "flex-start" }}>
                  <div style={{ minWidth: 0 }}>
                    <h3 className="tp-h3">{r.other.full_name}</h3>
                    <OtherLine row={r} />
                  </div>
                  <StatusTag status={r.status} />
                </div>
                {r.note && <p className="tp-small" style={{ margin: 0 }}>Your note: &ldquo;{r.note}&rdquo;</p>}
                {pickTime(r)}
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
