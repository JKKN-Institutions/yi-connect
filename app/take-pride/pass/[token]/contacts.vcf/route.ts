import { buildVcards, getConnectMe, getMyPeople } from "@/lib/take-pride/connections";
import { TP_EVENT } from "@/lib/take-pride/constants";

export const dynamic = "force-dynamic";

/*
 * vCard 3.0 of the people in "My people" who swapped contact details with
 * me (both share_contact = true). Gated by the pass token; the people list
 * and the both-share filter are built on the server (lib/take-pride/connections).
 */

function text(body: string, status: number) {
  return new Response(body, {
    status,
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store", "X-Robots-Tag": "noindex" },
  });
}

export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const me = await getConnectMe(token);
  if (!me) return text("This pass link is not valid. Ask the Take Pride desk for your link.", 404);
  if (!me.share_contact) return text("Turn on contact sharing in My people first.", 403);
  let people;
  try {
    people = (await getMyPeople(me)).filter((p) => p.they_share === true);
  } catch {
    return text("Could not build your contacts. Please try again.", 500);
  }
  if (people.length === 0) return text("Nobody in My people shares contact details with you yet.", 404);
  return new Response(buildVcards(people, TP_EVENT.name), {
    status: 200,
    headers: {
      "Content-Type": "text/vcard; charset=utf-8",
      "Content-Disposition": 'attachment; filename="take-pride-2026-contacts.vcf"',
      "Cache-Control": "no-store",
      "X-Robots-Tag": "noindex",
    },
  });
}
