import type { Metadata } from "next";
import Link from "next/link";
import { TopBar, SampleNote, Denied } from "../../../_ui";
import { getDelegateByToken } from "@/lib/take-pride/data";
import {
  DELEGATE_SEATS,
  HOST_CAP,
  TP_TABLE_PLACES,
  getMyCircleIds,
  getNetworkingSlots,
  listCircles,
  slotKey,
  slotLabel,
  type TpCircleView,
} from "@/lib/take-pride/tables";
import { StartTableForm, TableAction } from "./_client";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Topic tables" };

function HostLine({ c }: { c: TpCircleView }) {
  if (c.host) {
    return (
      <>
        Hosted by {c.host.full_name} · {c.host.chapter}
      </>
    );
  }
  return <>Hosted by the Take Pride team</>;
}

/** Names and chapters only: no contact details, no badge codes. */
function Members({ c }: { c: TpCircleView }) {
  if (c.members.length === 0) return <p className="tp-small" style={{ margin: 0 }}>No one has joined yet.</p>;
  return (
    <details data-tp="members">
      <summary className="tp-small" style={{ cursor: "pointer" }}>
        Who is at this table ({c.members.length})
      </summary>
      <ul style={{ margin: "6px 0 0", paddingLeft: 18 }} className="tp-small">
        {c.members.map((m) => (
          <li key={m.delegate_id}>
            {m.full_name} · {m.chapter}
          </li>
        ))}
      </ul>
    </details>
  );
}

function TableItem({
  c,
  token,
  meId,
  isIn,
  busyWith,
}: {
  c: TpCircleView;
  token: string;
  meId: string;
  isIn: boolean;
  busyWith: TpCircleView | undefined;
}) {
  const left = Math.max(0, c.seats - c.members.length);
  const isHost = c.host_delegate_id === meId;
  return (
    <article className="tp-stack" style={{ gap: 6 }} data-tp="table" data-title={c.title}>
      <div className="tp-row" style={{ alignItems: "flex-start" }}>
        <h3 className="tp-h3" style={{ minWidth: 0, flex: "1 1 180px" }}>{c.title}</h3>
        {isHost ? (
          <span className="tp-tag saffron">You host</span>
        ) : isIn ? (
          <span className="tp-tag green">You are in</span>
        ) : left === 0 ? (
          <span className="tp-tag bad">Full</span>
        ) : (
          <span className="tp-tag tp-num" data-tp="seats-left">
            {left} {left === 1 ? "seat" : "seats"} left
          </span>
        )}
      </div>
      {c.about && <p style={{ margin: 0 }}>{c.about}</p>}
      <p className="tp-small tp-num" style={{ margin: 0 }}>
        {slotLabel(c.day, c.starts_at)} · {c.place} · {c.members.length}/{c.seats} seats taken
      </p>
      <p className="tp-small" style={{ margin: 0 }}>
        <HostLine c={c} />
      </p>
      <Members c={c} />
      {isHost ? (
        <TableAction token={token} circleId={c.id} mode="host" />
      ) : isIn ? (
        <TableAction token={token} circleId={c.id} mode="leave" />
      ) : left === 0 ? (
        <p className="tp-small" data-tp="full-note" style={{ margin: 0 }}>
          This table is full. Try another table at this time.
        </p>
      ) : busyWith ? (
        <p className="tp-small" data-tp="busy" style={{ margin: 0 }}>
          You are at &ldquo;{busyWith.title}&rdquo; at this time. Leave it to join this one.
        </p>
      ) : (
        <TableAction token={token} circleId={c.id} mode="join" />
      )}
    </article>
  );
}

export default async function TablesPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const me = await getDelegateByToken(token);
  if (!me) {
    return <Denied title="Pass not found" text="This pass link is not valid. Ask the Take Pride desk for your link." />;
  }

  const [slots, open, myIds] = await Promise.all([
    getNetworkingSlots(),
    // A pass sees only its own kind: sample tables for sample passes, real for real.
    listCircles({ onlyOpen: true }).then((all) => all.filter((c) => c.is_sample === me.is_sample)),
    getMyCircleIds(me.id),
  ]);
  const mine = new Set(myIds);
  const cancelledMine = (await listCircles({ onlyOpen: false, ids: myIds })).filter((c) => c.status === "cancelled");
  const myOpen = open.filter((c) => mine.has(c.id));
  const hosting = open.filter((c) => c.host_delegate_id === me.id).length;
  const mySlotTable = new Map(myOpen.map((c) => [slotKey(c.day, c.starts_at), c]));

  // Group open tables by time slot, agenda order first, then any other time.
  const groups = new Map<string, { label: string; tables: TpCircleView[] }>();
  for (const s of slots) groups.set(s.key, { label: s.label, tables: [] });
  for (const c of open) {
    const k = slotKey(c.day, c.starts_at);
    if (!groups.has(k)) groups.set(k, { label: slotLabel(c.day, c.starts_at), tables: [] });
    groups.get(k)!.tables.push(c);
  }

  return (
    <main className="tp-main">
      <TopBar right={<Link href={`/take-pride/pass/${token}`} className="tp-btn ghost sm">My pass</Link>} />
      {me.is_sample && <SampleNote>Sample delegates and sample tables for the demo. The real list replaces them before the event.</SampleNote>}

      <header className="tp-stack" style={{ gap: 6 }}>
        <p className="tp-eyebrow" style={{ margin: 0 }}>Topic tables</p>
        <h1 className="tp-h2">Pull up a chair</h1>
        <p className="tp-mute" style={{ margin: 0 }}>
          Small tables around one topic, during the lunch and morning networking breaks. Join one table per break, or
          start your own. Others see your name and chapter only.
        </p>
      </header>

      <section className="tp-card hi" aria-labelledby="tt-mine" data-tp="my-tables">
        <h2 className="tp-h2" id="tt-mine">My tables</h2>
        {myOpen.length === 0 && cancelledMine.length === 0 ? (
          <p className="tp-mute" style={{ margin: 0 }}>You have not joined a table yet.</p>
        ) : (
          <div className="tp-list">
            {myOpen.map((c) => (
              <div key={c.id} className="tp-row" data-tp="my-row">
                <span style={{ minWidth: 0 }}>
                  <b>{c.title}</b>
                  <br />
                  <span className="tp-small tp-num">
                    {slotLabel(c.day, c.starts_at)} · {c.place}
                  </span>
                </span>
                <span className={`tp-tag ${c.host_delegate_id === me.id ? "saffron" : "green"}`}>
                  {c.host_delegate_id === me.id ? "You host" : "Joined"}
                </span>
              </div>
            ))}
            {cancelledMine.map((c) => (
              <div key={c.id} className="tp-row" data-tp="my-cancelled">
                <span style={{ minWidth: 0 }}>
                  <b>{c.title}</b>
                  <br />
                  <span className="tp-small tp-num">
                    {slotLabel(c.day, c.starts_at)} · {c.place}
                  </span>
                </span>
                <span className="tp-tag bad">Cancelled</span>
              </div>
            ))}
          </div>
        )}
      </section>

      {[...groups.entries()].map(([k, g]) => (
        <section key={k} className="tp-card" aria-label={g.label} data-tp="slot">
          <h2 className="tp-h3">{g.label}</h2>
          {g.tables.length === 0 ? (
            <p className="tp-mute" style={{ margin: 0 }}>No tables at this time yet. Start one below.</p>
          ) : (
            <div className="tp-list">
              {g.tables.map((c) => (
                <TableItem
                  key={c.id}
                  c={c}
                  token={token}
                  meId={me.id}
                  isIn={mine.has(c.id)}
                  busyWith={mySlotTable.get(slotKey(c.day, c.starts_at))}
                />
              ))}
            </div>
          )}
        </section>
      ))}

      <section className="tp-card" aria-labelledby="tt-start" data-tp="start">
        <h2 className="tp-h2" id="tt-start">Host a table</h2>
        {slots.length === 0 ? (
          <p className="tp-mute" style={{ margin: 0 }}>The networking times are not set yet. Check back soon.</p>
        ) : hosting >= HOST_CAP ? (
          <p className="tp-mute" data-tp="host-cap" style={{ margin: 0 }}>
            You already host {HOST_CAP} tables, the most one delegate can host.
          </p>
        ) : (
          <>
            <p className="tp-small" style={{ margin: 0 }}>
              Pick a topic you care about. You can host up to {HOST_CAP} tables, and you take one of the seats.
            </p>
            <StartTableForm
              token={token}
              slots={slots.map((s) => ({ key: s.key, label: s.label }))}
              places={TP_TABLE_PLACES}
              seats={DELEGATE_SEATS}
            />
          </>
        )}
      </section>
    </main>
  );
}
