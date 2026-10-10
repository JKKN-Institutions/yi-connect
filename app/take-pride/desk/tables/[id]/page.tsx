import Link from "next/link";
import type { Metadata } from "next";
import { Denied, TopBar } from "../../../_ui";
import { requireTpOrganiser } from "@/lib/take-pride/auth";
import { listCircles, slotLabel } from "@/lib/take-pride/tables";
import { TablesDeskDenied } from "../_deny";
import { PrintButton } from "../_client";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Table member list" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/* Printing: drop the page chrome, keep the list. */
const PRINT_CSS = `@media print {
  .tp-noprint, .tp-strip { display: none !important; }
  .tp-root { background: #fff; }
  .tp-card { border: 0; padding: 0; animation: none; }
}`;

export default async function TableMembersPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const g = await requireTpOrganiser();
  if (!g.ok) return <TablesDeskDenied reason={g.reason} back={`/take-pride/desk/tables/${UUID.test(id) ? id : ""}`} />;

  const [c] = UUID.test(id) ? await listCircles({ onlyOpen: false, ids: [id] }) : [];
  if (!c) return <Denied title="Table not found" text="This table does not exist. Go back to the topic tables desk." />;

  return (
    <main className="tp-main">
      <style>{PRINT_CSS}</style>
      <div className="tp-noprint">
        <TopBar right={<Link className="tp-btn sm ghost" href="/take-pride/desk/tables">All tables</Link>} />
      </div>
      <section className="tp-card" data-tp="print-list">
        <div className="tp-row">
          <div className="tp-eyebrow">Take Pride 2026 · Topic table</div>
          <PrintButton />
        </div>
        <h1 className="tp-h2">{c.title}</h1>
        {c.status === "cancelled" && <p className="tp-alert bad" style={{ margin: 0 }}>This table is cancelled.</p>}
        <p className="tp-small tp-num" style={{ margin: 0 }}>
          {slotLabel(c.day, c.starts_at)} · {c.place} · {c.members.length}/{c.seats} seats ·{" "}
          {c.host ? `Host: ${c.host.full_name} (${c.host.chapter})` : "Hosted by the Take Pride team"}
        </p>
        {c.about && <p style={{ margin: 0 }}>{c.about}</p>}
        {c.members.length === 0 ? (
          <p className="tp-mute" style={{ margin: 0 }}>No one has joined yet.</p>
        ) : (
          <table className="tp-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Name</th>
                <th>Chapter</th>
                <th>Badge</th>
                <th>Present</th>
              </tr>
            </thead>
            <tbody>
              {c.members.map((m, i) => (
                <tr key={m.delegate_id}>
                  <td className="tp-num">{i + 1}</td>
                  <td>
                    {m.full_name}
                    {m.delegate_id === c.host_delegate_id ? " (host)" : ""}
                  </td>
                  <td>{m.chapter}</td>
                  <td className="tp-num">{m.badge_code}</td>
                  <td aria-label="tick if present">☐</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </main>
  );
}
