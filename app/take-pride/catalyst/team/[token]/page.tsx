import type { Metadata } from "next";
import { Denied, TopBar } from "../../../_ui";
import { isToken } from "@/lib/take-pride/auth";
import { getPartnerById, getTeamMemberByToken, getTeamMemberLeads } from "@/lib/take-pride/catalyst";
import { LeadCapture } from "../../p/[token]/partner-client";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Lead scanner" };

/*
 * A Catalyst Partner's TEAM MEMBER. This page shows ONLY the lead scanner and
 * the leads this person scanned: no matches, no meetings, no payment, no other
 * team member's leads. The partner is resolved from the team token here, on
 * the server; the token is checked before any query.
 */
export default async function TeamScannerPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const notFound = <Denied title="Link not found" text="This scanner link is not valid. Ask the person who shared it for a new one." />;
  if (!isToken(token)) return notFound;
  const member = await getTeamMemberByToken(token);
  if (!member) return notFound;
  if (!member.active) {
    return <Denied title="This scanner link is switched off" text="The partner removed this link. Ask them for a new one if you still need it." />;
  }
  const partner = await getPartnerById(member.partner_id);
  if (!partner) return notFound;
  if (partner.cancelled_at) {
    return <Denied title="Lead scanning is closed" text="This company's Catalyst partnership was cancelled, so the scanner no longer works." />;
  }
  if (partner.status !== "confirmed") {
    return <Denied title="Not open yet" text="The lead scanner opens once the Take Pride team confirms this company's payment." />;
  }

  const leads = await getTeamMemberLeads(member.id);

  return (
    <main className="tp-main">
      <TopBar />
      <section className="tp-stack">
        <div className="tp-eyebrow">Lead scanner · {partner.business_name}</div>
        <h1 className="tp-h1">Hi {member.name}</h1>
        <p className="tp-mute" style={{ margin: 0 }}>
          Scan a delegate&rsquo;s badge to save them as a lead for {partner.business_name}. Keep this link to yourself.
        </p>
      </section>

      <section className="tp-card" data-tp="team-scanner">
        <h2 className="tp-h2">Scan a delegate&rsquo;s badge</h2>
        <LeadCapture token={token} />
      </section>

      <section className="tp-card" data-tp="team-leads">
        <h2 className="tp-h2">{leads.length} {leads.length === 1 ? "lead" : "leads"} you scanned</h2>
        {leads.length === 0 && <p className="tp-mute" style={{ margin: 0 }}>Leads you scan appear here.</p>}
        <div className="tp-list">
          {leads.map((l) =>
            l.delegate ? (
              <div key={l.id}>
                <div className="tp-row"><b>{l.delegate.full_name}</b><span className="tp-small">{l.delegate.chapter}</span></div>
                <span className="tp-small">{l.delegate.business_name ?? ""}{l.delegate.business_name ? " · " : ""}{l.delegate.industry}</span>
                {l.note && <p style={{ margin: "4px 0 0" }}>{l.note}</p>}
              </div>
            ) : null
          )}
        </div>
      </section>
    </main>
  );
}
