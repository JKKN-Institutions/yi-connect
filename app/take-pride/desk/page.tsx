import Link from "next/link";
import type { Metadata } from "next";
import { Denied, TopBar } from "../_ui";
import { requireTpDesk } from "@/lib/take-pride/auth";
import { TP_PARTNER_STATUS_LABEL, inr } from "@/lib/take-pride/constants";
import { getDeskOverview, getSettings } from "@/lib/take-pride/data";
import { PartnerActions, PaymentInstructionsForm } from "./desk-client";
import { NotInReview, ReviewBanner } from "../review/_banner";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Organiser desk" };

const ORDER: Record<string, number> = { payment_submitted: 0, applied: 1, confirmed: 2, rejected: 3 };

export default async function DeskPage() {
  const g = await requireTpDesk();
  if (!g.ok) {
    if (g.reason === "signed_out") {
      return (
        <main className="tp-main">
          <TopBar />
          <div className="tp-card">
            <h1 className="tp-h2">Sign in needed</h1>
            <p className="tp-mute" style={{ margin: 0 }}>The organiser desk is for the Take Pride team. Sign in with your Yi account.</p>
            <Link className="tp-btn" href="/login?redirectTo=/take-pride/desk">Sign in</Link>
          </div>
        </main>
      );
    }
    return <Denied title="No access" text="The organiser desk is for the Take Pride team. Ask the national team to add you as a Take Pride admin." />;
  }

  // Review mode (outside reviewers): every number and list is sample rows only.
  const review = g.mode === "review";
  const [o, s] = await Promise.all([getDeskOverview({ sampleOnly: review }), getSettings()]);
  const count = (st: string) => o.partners.filter((p) => p.status === st).length;
  // Sample (demo) partners never hold a real seat; in review mode the sample seats are the whole picture.
  const seatHolders = o.partners.filter(
    (p) => (review || !p.is_sample) && (p.status === "confirmed" || p.status === "payment_submitted")
  ).length;
  const confirmedValue = o.partners.filter((p) => p.status === "confirmed").reduce((a, p) => a + p.amount_due_inr, 0);
  const waitingValue = o.partners.filter((p) => p.status === "payment_submitted").reduce((a, p) => a + p.amount_due_inr, 0);
  const partners = [...o.partners].sort((a, b) => ORDER[a.status] - ORDER[b.status] || b.created_at.localeCompare(a.created_at));

  return (
    <main className="tp-main wide">
      <TopBar right={<Link className="tp-btn sm" href="/take-pride/desk/gate">Gate scanner</Link>} />
      {review && <ReviewBanner />}
      <section className="tp-stack">
        <div className="tp-eyebrow">Organiser desk</div>
        <h1 className="tp-h1">Take Pride 2026</h1>
      </section>

      <nav className="tp-tabs" aria-label="Desk sections">
        <Link href="/take-pride/desk/gate">Gate scanner</Link>
        <Link href="/take-pride/desk/delegates">Delegates</Link>
        <Link href="/take-pride/desk/awards">Awards Night</Link>
        <Link href="/take-pride/desk/tables">Topic tables</Link>
        <Link href="/take-pride/awards">Hall screen</Link>
      </nav>

      <section className="tp-grid2">
        <div className="tp-kpi"><b className="tp-num">{count("confirmed")}</b><span>Catalyst Partners confirmed · {inr(confirmedValue)}</span></div>
        <div className="tp-kpi"><b className="tp-num">{count("payment_submitted")}</b><span>payments to confirm · {inr(waitingValue)}</span></div>
        <div className="tp-kpi"><b className="tp-num">{count("applied")}</b><span>signed up, not paid yet</span></div>
        <div className="tp-kpi"><b className="tp-num">{Math.max(0, s.catalyst_seats - seatHolders)}</b><span>of {s.catalyst_seats} seats left</span></div>
        <div className="tp-kpi"><b className="tp-num">{o.checkedIn}/{o.delegates}</b><span>delegates checked in</span></div>
        <div className="tp-kpi"><b className="tp-num">{o.meetings.accepted}/{o.meetings.requested + o.meetings.accepted + o.meetings.declined}</b><span>meetings accepted / requested</span></div>
        <div className="tp-kpi"><b className="tp-num">{o.leads}</b><span>leads scanned by partners</span></div>
      </section>

      <section className="tp-card">
        <div className="tp-row">
          <h2 className="tp-h2">Catalyst Partners</h2>
          {!review && (
            <a className="tp-btn ghost sm" href="/take-pride/desk/partners.csv" download>
              Download partners (CSV)
            </a>
          )}
        </div>
        {partners.length === 0 && <p className="tp-mute" style={{ margin: 0 }}>No sign-ups yet. Share the Catalyst page: /take-pride/catalyst</p>}
        <div className="tp-list">
          {partners.map((p) => (
            <div key={p.id} className="tp-stack" style={{ gap: 6 }}>
              <div className="tp-row">
                <b>{p.business_name}</b>
                <span className={`tp-tag ${p.status === "confirmed" ? "green" : p.status === "rejected" ? "bad" : "saffron"}`}>{TP_PARTNER_STATUS_LABEL[p.status]}</span>
              </div>
              <span className="tp-small">
                {p.member_name} · {p.chapter} · {p.phone} · {p.email}
              </span>
              <span className="tp-small tp-num">
                {inr(p.amount_due_inr)} incl. GST{p.payment_reference ? ` · reference ${p.payment_reference}` : ""}
                {p.reject_reason ? ` · not confirmed: ${p.reject_reason}` : ""}
              </span>
              <div className="tp-row" style={{ justifyContent: "flex-start" }}>
                {p.status === "payment_submitted" && <PartnerActions partnerId={p.id} review={review} />}
                <Link className="tp-small" href={`/take-pride/catalyst/p/${p.token}`}>Open their page</Link>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="tp-card">
        <h2 className="tp-h2">Payment details shown to partners</h2>
        <p className="tp-small" style={{ margin: 0 }}>
          The UPI ID or bank account that collects Catalyst fees. Until this is filled, partners are told the team will send it on WhatsApp.
        </p>
        {review ? <NotInReview what="Changing payment details" /> : <PaymentInstructionsForm current={s.payment_instructions ?? ""} />}
      </section>

      <section className="tp-card">
        <h2 className="tp-h2">Delegates</h2>
        <p className="tp-small" style={{ margin: 0 }}>
          {o.delegates} delegates loaded. These are sample delegates until the myCII registration list is imported.
        </p>
        {o.sampleDelegateToken && (
          <Link className="tp-btn ghost sm" href={`/take-pride/pass/${o.sampleDelegateToken}`}>Open a sample delegate pass</Link>
        )}
      </section>
    </main>
  );
}
