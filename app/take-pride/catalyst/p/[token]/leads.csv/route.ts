import { isToken } from "@/lib/take-pride/auth";
import { PARTNER_LEADS_HEADERS, partnerLeadRows, slug, toCsv } from "@/lib/take-pride/csv";
import { getPartnerByToken, getPartnerLeads, getPartnerMeetings, listDelegates } from "@/lib/take-pride/data";

export const dynamic = "force-dynamic";

function text(status: number, body: string) {
  return new Response(body, {
    status,
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
  });
}

/**
 * A Catalyst Partner's own leads + accepted meetings as a CSV.
 * Gate: the secret link token (checked before any query), and the partner's
 * payment must be confirmed. No delegate phone or email is ever included.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!isToken(token)) return text(404, "Link not found.");
  const partner = await getPartnerByToken(token);
  if (!partner) return text(404, "Link not found.");
  if (partner.status !== "confirmed") {
    return text(403, "Your leads download opens once the Take Pride team confirms your payment.");
  }

  const [leads, meetings, delegates] = await Promise.all([
    getPartnerLeads(partner.id),
    getPartnerMeetings(partner.id),
    listDelegates(),
  ]);
  const byId = new Map(delegates.map((d) => [d.id, d]));
  const rows = partnerLeadRows(
    [...leads].reverse(),
    meetings
      .filter((m) => m.status === "accepted")
      .map((m) => ({ slot: m.slot, delegate: byId.get(m.delegate_id) ?? null }))
  );

  return new Response(toCsv(PARTNER_LEADS_HEADERS, rows), {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${slug(partner.business_name, "partner")}-take-pride-leads.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
