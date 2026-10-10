import { requireTpOrganiser } from "@/lib/take-pride/auth";
import { fullBadgeCode } from "@/lib/take-pride/badge";
import { toCsv } from "@/lib/take-pride/csv";
import { tpService } from "@/lib/take-pride/supabase";

export const dynamic = "force-dynamic";

function text(status: number, body: string) {
  return new Response(body, {
    status,
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
  });
}

const HEADERS = ["Full badge code (print + QR)", "Badge number", "Name", "Chapter", "Zone", "Business", "Role", "Sample"];

/**
 * Badge print list for the organiser desk. "Full badge code" is what goes on
 * the printed badge and inside its QR ("TP26-1234-K7QXM"): Catalyst Partners
 * and delegates need the 5-letter secret to scan a badge. Organisers only.
 * No pass links, phones or emails.
 */
export async function GET() {
  const g = await requireTpOrganiser();
  if (!g.ok) {
    return text(
      403,
      g.reason === "signed_out"
        ? "Sign in with your Yi account on the organiser desk first, then download again."
        : "No access. This download is for the Take Pride team."
    );
  }

  const { data, error } = await tpService()
    .from("tp_delegates")
    .select("badge_code, badge_secret, full_name, chapter, zone, business_name, role_title, is_sample")
    .order("badge_code", { ascending: true })
    .limit(5000);
  if (error) return text(500, "Could not build the file: " + error.message);

  type Row = {
    badge_code: string;
    badge_secret: string | null;
    full_name: string;
    chapter: string;
    zone: string | null;
    business_name: string | null;
    role_title: string | null;
    is_sample: boolean;
  };
  const rows = ((data ?? []) as Row[]).map((d) => [
    fullBadgeCode(d.badge_code, d.badge_secret),
    d.badge_code,
    d.full_name,
    d.chapter,
    d.zone,
    d.business_name,
    d.role_title,
    d.is_sample ? "yes" : "no",
  ]);
  const day = new Date().toISOString().slice(0, 10);
  return new Response(toCsv(HEADERS, rows), {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="take-pride-badges-${day}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
