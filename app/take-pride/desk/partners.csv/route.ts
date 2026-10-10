import { hasReviewSession, requireTpOrganiser } from "@/lib/take-pride/auth";
import { DESK_PARTNERS_HEADERS, deskPartnerRows, toCsv, type CsvPartner } from "@/lib/take-pride/csv";
import { tpService } from "@/lib/take-pride/supabase";

export const dynamic = "force-dynamic";

function text(status: number, body: string) {
  return new Response(body, {
    status,
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
  });
}

/** Every Catalyst Partner with payment status and activity, for the organiser desk. */
export async function GET() {
  // Real organisers only: review mode (sample data) never downloads partner contacts.
  const g = await requireTpOrganiser();
  if (!g.ok) {
    if (await hasReviewSession()) return text(403, "Not available in review mode.");
    return text(
      403,
      g.reason === "signed_out"
        ? "Sign in with your Yi account on the organiser desk first, then download again."
        : "No access. This download is for the Take Pride team."
    );
  }

  const db = tpService();
  const [p, m, l] = await Promise.all([
    db
      .from("tp_partners")
      .select(
        "id, business_name, member_name, chapter, zone, phone, email, status, amount_due_inr, payment_reference, payment_submitted_at, confirmed_at, is_sample, created_at"
      )
      .order("created_at", { ascending: true })
      .limit(5000),
    db.from("tp_meetings").select("partner_id, status").limit(50000),
    db.from("tp_leads").select("partner_id").limit(50000),
  ]);
  const err = p.error ?? m.error ?? l.error;
  if (err) return text(500, "Could not build the file: " + err.message);

  const rows = deskPartnerRows(
    (p.data ?? []) as CsvPartner[],
    (m.data ?? []) as { partner_id: string; status: string }[],
    (l.data ?? []) as { partner_id: string }[]
  );
  const day = new Date().toISOString().slice(0, 10);
  return new Response(toCsv(DESK_PARTNERS_HEADERS, rows), {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="take-pride-catalyst-partners-${day}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
