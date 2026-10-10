import Link from "next/link";
import type { Metadata } from "next";
import { Denied, SampleNote, TopBar } from "../../../_ui";
import { TP_PARTNER_STATUS_LABEL, inr } from "@/lib/take-pride/constants";
import { getPartnerByToken, getPartnerLeads, getPartnerMeetings, getSettings, listDelegates } from "@/lib/take-pride/data";
import { matchDelegates } from "@/lib/take-pride/match";
import { CopyLink, LeadCapture, PaymentForm, RequestMeetingButton } from "./partner-client";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Your Catalyst page" };

const TABS = [
  { key: "matches", label: "Matches" },
  { key: "leads", label: "Scan leads" },
  { key: "results", label: "Results" },
] as const;

export default async function PartnerPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ tab?: string; new?: string }>;
}) {
  const { token } = await params;
  const sp = await searchParams;
  const partner = await getPartnerByToken(token);
  if (!partner) return <Denied title="Link not found" text="This Catalyst Partner link is not valid. Check the link you saved, or ask the Take Pride desk." />;

  const tab = TABS.some((t) => t.key === sp.tab) ? sp.tab! : "matches";
  const [s, delegates, meetings, leads] = await Promise.all([
    getSettings(),
    listDelegates(),
    getPartnerMeetings(partner.id),
    getPartnerLeads(partner.id),
  ]);
  const confirmed = partner.status === "confirmed";
  const matches = matchDelegates(partner, delegates);
  const byDelegate = new Map(meetings.map((m) => [m.delegate_id, m]));
  const used = meetings.filter((m) => m.status !== "declined").length;
  const accepted = meetings.filter((m) => m.status === "accepted");
  const nameOf = new Map(delegates.map((d) => [d.id, d]));
  const base = `/take-pride/catalyst/p/${token}`;

  return (
    <main className="tp-main">
      <TopBar />

      <section className="tp-stack">
        <div className="tp-eyebrow">Catalyst Partner · {partner.chapter}</div>
        <h1 className="tp-h1">{partner.business_name}</h1>
        <p className="tp-mute" style={{ margin: 0 }}>{partner.member_name} · {partner.industry}</p>
      </section>

      {sp.new === "1" && partner.status === "applied" && (
        <p className="tp-alert ok">Saved. Keep this page&rsquo;s link: it is how you come back. One step left: payment.</p>
      )}

      <section className={`tp-card ${confirmed ? "ok" : "hi"}`}>
        <div className="tp-row">
          <h2 className="tp-h2">{TP_PARTNER_STATUS_LABEL[partner.status]}</h2>
          <span className={`tp-tag ${confirmed ? "green" : partner.status === "rejected" ? "bad" : "saffron"}`}>
            {confirmed ? "Active" : partner.status === "payment_submitted" ? "Checking" : partner.status === "rejected" ? "Action needed" : "Step 2 of 2"}
          </span>
        </div>
        {confirmed ? (
          <p style={{ margin: 0 }}>Your seat is confirmed. Request meetings below and scan leads at the event.</p>
        ) : (
          <>
            {partner.status === "rejected" && partner.reject_reason && (
              <p className="tp-alert bad" style={{ margin: 0 }}>The team could not confirm your payment: {partner.reject_reason}</p>
            )}
            {partner.status === "payment_submitted" ? (
              <p style={{ margin: 0 }}>
                Reference <b className="tp-num">{partner.payment_reference}</b> received. The Take Pride team confirms it the same day.
                Your matches are ready below; names unlock once confirmed.
              </p>
            ) : (
              <>
                <p style={{ margin: 0 }}>
                  Pay <b className="tp-num">{inr(partner.amount_due_inr)}</b> (Yi member fee {inr(s.member_fee_inr)} + {s.gst_pct}% GST).
                </p>
                <div className="tp-alert warn" style={{ whiteSpace: "pre-wrap" }}>
                  {s.payment_instructions ?? "The Take Pride team will send you the UPI ID and bank details on WhatsApp. Once you pay, enter the reference number here."}
                </div>
              </>
            )}
            <PaymentForm token={token} current={partner.payment_reference} />
          </>
        )}
        <CopyLink />
      </section>

      <nav className="tp-tabs" aria-label="Sections">
        {TABS.map((t) => (
          <Link key={t.key} href={`${base}?tab=${t.key}`} aria-current={tab === t.key ? "page" : undefined} scroll={false}>
            {t.label}
          </Link>
        ))}
      </nav>

      {tab === "matches" && (
        <section className="tp-card">
          <div className="tp-row">
            <h2 className="tp-h2">{matches.length} delegates match you</h2>
            <span className="tp-small tp-num">{used} of {s.meeting_cap} requests used</span>
          </div>
          {delegates.some((d) => d.is_sample) && <SampleNote />}
          {!confirmed && <p className="tp-small" style={{ margin: 0 }}>Names and meeting requests unlock when your payment is confirmed.</p>}
          {matches.length === 0 && <p className="tp-mute">No delegate needs what you listed yet. More delegates register every day.</p>}
          <div className="tp-list">
            {matches.slice(0, 40).map((m) => {
              const d = m.delegate;
              const mt = byDelegate.get(d.id);
              return (
                <div key={d.id} className="tp-stack" style={{ gap: 6 }}>
                  <div className="tp-row">
                    <b>{confirmed ? d.full_name : `${d.role_title ?? "Delegate"}, ${d.industry.toLowerCase()}`}</b>
                    <span className="tp-small">{d.chapter} · {d.zone}</span>
                  </div>
                  {confirmed && <span className="tp-small">{d.role_title}{d.business_name ? `, ${d.business_name}` : ""} · {d.industry}</span>}
                  <span style={{ fontSize: 14 }}>{m.reason}</span>
                  <div className="tp-row">
                    <div className="tp-chips">{m.shared.map((t) => <span key={t} className="tp-chip on">{t}</span>)}</div>
                    {mt ? (
                      <span className={`tp-tag ${mt.status === "accepted" ? "green" : mt.status === "declined" ? "bad" : "saffron"}`}>
                        {mt.status === "accepted" ? "Accepted" : mt.status === "declined" ? "Declined" : "Requested"}
                      </span>
                    ) : (
                      <RequestMeetingButton token={token} delegateId={d.id} disabled={!confirmed || used >= s.meeting_cap} />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {tab === "leads" && (
        <section className="tp-card">
          <h2 className="tp-h2">Scan a delegate&rsquo;s badge</h2>
          {confirmed ? (
            <LeadCapture token={token} />
          ) : (
            <p className="tp-mute" style={{ margin: 0 }}>The lead scanner opens once your payment is confirmed.</p>
          )}
          <h3 className="tp-h3" style={{ marginTop: 8 }}>{leads.length} {leads.length === 1 ? "lead" : "leads"} saved</h3>
          <div className="tp-list">
            {leads.map((l) => (
              <div key={l.id}>
                <div className="tp-row"><b>{l.delegate.full_name}</b><span className="tp-small">{l.delegate.chapter}</span></div>
                <span className="tp-small">{l.delegate.business_name} · {l.delegate.industry}</span>
                {l.note && <p style={{ margin: "4px 0 0" }}>{l.note}</p>}
              </div>
            ))}
          </div>
        </section>
      )}

      {tab === "results" && (
        <section className="tp-stack">
          <div className="tp-grid2">
            <div className="tp-kpi"><b>{meetings.length}</b><span>meeting requests sent</span></div>
            <div className="tp-kpi"><b>{accepted.length}</b><span>accepted</span></div>
            <div className="tp-kpi"><b>{leads.length}</b><span>leads scanned</span></div>
            <div className="tp-kpi"><b>{matches.length}</b><span>matched delegates</span></div>
          </div>
          <div className="tp-card">
            <div className="tp-row">
              <h2 className="tp-h2">Follow up</h2>
              {confirmed && (
                <a className="tp-btn ghost sm" href={`${base}/leads.csv`} download>
                  Download my leads (CSV)
                </a>
              )}
            </div>
            {accepted.length + leads.length === 0 && <p className="tp-mute" style={{ margin: 0 }}>Accepted meetings and scanned leads appear here.</p>}
            <div className="tp-list">
              {accepted.map((m) => {
                const d = nameOf.get(m.delegate_id);
                return d ? (
                  <div key={m.id}><div className="tp-row"><b>{d.full_name}</b><span className="tp-tag green">Meeting accepted</span></div><span className="tp-small">{d.business_name} · {d.chapter}</span></div>
                ) : null;
              })}
              {leads.map((l) => (
                <div key={l.id}><div className="tp-row"><b>{l.delegate.full_name}</b><span className="tp-tag">Lead</span></div><span className="tp-small">{l.delegate.business_name} · {l.delegate.chapter}{l.note ? ` · ${l.note}` : ""}</span></div>
              ))}
            </div>
          </div>
        </section>
      )}
    </main>
  );
}
