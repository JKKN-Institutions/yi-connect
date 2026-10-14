import { getConnectMe } from "@/lib/take-pride/connections";
import { getCardContact } from "@/lib/take-pride/cards/queue";
import { isCardId } from "@/lib/take-pride/cards/schemas";
import { buildCardVcard, vcardFileName } from "@/lib/take-pride/cards/vcard";
import { TP_EVENT } from "@/lib/take-pride/constants";

export const dynamic = "force-dynamic";

/*
 * vCard 3.0 of ONE contact read off a business card I scanned. Gated by the
 * pass token, and the contact must be mine (filtered by my delegate id).
 */

function text(body: string, status: number) {
  return new Response(body, {
    status,
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store", "X-Robots-Tag": "noindex" },
  });
}

export async function GET(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const me = await getConnectMe(token);
  if (!me) return text("This pass link is not valid. Ask the Take Pride desk for your link.", 404);
  const id = new URL(req.url).searchParams.get("id");
  if (!isCardId(id)) return text("Contact not found.", 404);
  const c = await getCardContact(me.id, id);
  if (!c) return text("Contact not found.", 404);
  return new Response(buildCardVcard(c, TP_EVENT.name), {
    status: 200,
    headers: {
      "Content-Type": "text/vcard; charset=utf-8",
      "Content-Disposition": `attachment; filename="${vcardFileName(c)}"`,
      "Cache-Control": "no-store",
      "X-Robots-Tag": "noindex",
    },
  });
}
