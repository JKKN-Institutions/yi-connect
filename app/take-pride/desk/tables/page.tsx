import Link from "next/link";
import type { Metadata } from "next";
import { hasReviewSession, requireTpOrganiser } from "@/lib/take-pride/auth";
import { Denied, TopBar } from "../../_ui";
import {
  ORGANISER_SEATS,
  TP_TABLE_PLACES,
  getNetworkingSlots,
  listCircles,
  slotKey,
  slotLabel,
  type TpCircleView,
} from "@/lib/take-pride/tables";
import { TablesDeskDenied } from "./_deny";
import { CancelTableButton, CreateTableForm } from "./_client";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Topic tables desk" };

export default async function TablesDeskPage() {
  const g = await requireTpOrganiser();
  if (!g.ok) {
    if (await hasReviewSession()) {
      return <Denied title="Not available in review mode" text="Topic tables are managed by the Take Pride team with a real organiser login. Delegates' topic tables can be tried from the sample delegate's pass." />;
    }
    return <TablesDeskDenied reason={g.reason} back="/take-pride/desk/tables" />;
  }

  const [slots, all] = await Promise.all([getNetworkingSlots(), listCircles({ onlyOpen: false })]);
  const open = all.filter((c) => c.status === "open");
  const cancelled = all.filter((c) => c.status === "cancelled");
  const seated = open.reduce((a, c) => a + c.members.length, 0);
  const seats = open.reduce((a, c) => a + c.seats, 0);

  const groups = new Map<string, { label: string; tables: TpCircleView[] }>();
  for (const s of slots) groups.set(s.key, { label: s.label, tables: [] });
  for (const c of open) {
    const k = slotKey(c.day, c.starts_at);
    if (!groups.has(k)) groups.set(k, { label: slotLabel(c.day, c.starts_at), tables: [] });
    groups.get(k)!.tables.push(c);
  }

  return (
    <main className="tp-main wide">
      <TopBar right={<Link className="tp-btn sm ghost" href="/take-pride/desk">Organiser desk</Link>} />
      <section className="tp-stack">
        <div className="tp-eyebrow">Topic tables</div>
        <h1 className="tp-h1">Tables at the breaks</h1>
        <p className="tp-lede">
          Small topic tables at the networking times. Delegates join from their pass; they can also start their own (up
          to 2 each).
        </p>
      </section>

      <section className="tp-grid2">
        <div className="tp-kpi"><b className="tp-num">{open.length}</b><span>open tables</span></div>
        <div className="tp-kpi"><b className="tp-num">{seated}/{seats}</b><span>seats taken</span></div>
        <div className="tp-kpi"><b className="tp-num">{open.filter((c) => c.host_delegate_id).length}</b><span>hosted by delegates</span></div>
        <div className="tp-kpi"><b className="tp-num">{cancelled.length}</b><span>cancelled</span></div>
      </section>

      {all.some((c) => c.is_sample) && (
        <p className="tp-sample">Tables marked Sample are demo tables. Cancel them before the event if they are not running.</p>
      )}

      {[...groups.entries()].map(([k, grp]) => (
        <section key={k} className="tp-card" aria-label={grp.label}>
          <h2 className="tp-h3">{grp.label}</h2>
          {grp.tables.length === 0 ? (
            <p className="tp-mute" style={{ margin: 0 }}>No tables at this time.</p>
          ) : (
            <div className="tp-list">
              {grp.tables.map((c) => (
                <div key={c.id} className="tp-stack" style={{ gap: 6 }} data-tp="desk-table">
                  <div className="tp-row" style={{ alignItems: "flex-start" }}>
                    <b style={{ minWidth: 0, flex: "1 1 200px" }}>{c.title}</b>
                    <span className="tp-row" style={{ gap: 6 }}>
                      {c.is_sample && <span className="tp-tag">Sample</span>}
                      <span className={`tp-tag tp-num ${c.members.length >= c.seats ? "bad" : "green"}`}>
                        {c.members.length}/{c.seats} seats
                      </span>
                    </span>
                  </div>
                  <span className="tp-small">
                    {c.place} · {c.host ? `Hosted by ${c.host.full_name} (${c.host.chapter})` : "Hosted by the Take Pride team"}
                  </span>
                  <div className="tp-row" style={{ justifyContent: "flex-start" }}>
                    <Link className="tp-btn ghost sm" href={`/take-pride/desk/tables/${c.id}`}>
                      Member list to print
                    </Link>
                    <CancelTableButton circleId={c.id} title={c.title} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      ))}

      <section className="tp-card">
        <h2 className="tp-h2">Add a table</h2>
        {slots.length === 0 ? (
          <p className="tp-mute" style={{ margin: 0 }}>
            The agenda has no networking times (sessions of type &ldquo;meetings&rdquo;), so tables cannot be placed yet.
          </p>
        ) : (
          <CreateTableForm
            slots={slots.map((s) => ({ key: s.key, label: s.label }))}
            places={TP_TABLE_PLACES}
            seats={ORGANISER_SEATS}
          />
        )}
      </section>

      {cancelled.length > 0 && (
        <section className="tp-card">
          <h2 className="tp-h2">Cancelled</h2>
          <div className="tp-list">
            {cancelled.map((c) => (
              <div key={c.id} className="tp-row">
                <span style={{ minWidth: 0 }}>
                  <b>{c.title}</b>
                  <br />
                  <span className="tp-small tp-num">
                    {slotLabel(c.day, c.starts_at)} · {c.place} · {c.members.length} had joined
                  </span>
                </span>
                <Link className="tp-small" href={`/take-pride/desk/tables/${c.id}`}>Member list</Link>
              </div>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
