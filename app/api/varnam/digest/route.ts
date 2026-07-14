/**
 * GET /api/varnam/digest — the future automation hook for the daily digest.
 *
 * WIRING PLAN (deliberately not done yet):
 *   1. Today: this endpoint returns the same WhatsApp-ready text the committee
 *      copies from /varnam-vizha/dashboard/digest. NO sender exists BY DESIGN —
 *      the committee has not yet decided how to connect WhatsApp (personal
 *      number vs Business API vs a group bot), and we refuse to guess with
 *      their group chat.
 *   2. Later, when the committee picks a connection: a scheduled job (Vercel
 *      cron or n8n) calls this endpoint each morning with the shared secret
 *      header, takes the plain-text body, and hands it to whatever sender the
 *      committee approved. The digest composition stays here; only the
 *      delivery leg gets added — no changes to this route needed beyond that.
 *
 * SECURITY: gated by VARNAM_DIGEST_SECRET (env). Unset → 503 (endpoint is
 * "not configured", so nothing leaks by default). Set → callers must present
 * the exact value in the `x-varnam-digest-secret` header, else 401. The
 * digest contains committee-internal data (overdue tasks, permission status),
 * so it must never be publicly readable.
 */
import { NextResponse } from "next/server";
import { buildDigest } from "@/lib/varnam/digest";

// Always compute fresh — a cached digest defeats the point of a daily digest.
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const secret = process.env.VARNAM_DIGEST_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "digest endpoint not configured" },
      { status: 503 }
    );
  }

  const provided = req.headers.get("x-varnam-digest-secret");
  if (provided !== secret) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const digest = await buildDigest();
    return new Response(digest.text, {
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  } catch (error) {
    console.error("[varnam-digest] failed to build digest:", error);
    return NextResponse.json(
      { error: "failed to build digest" },
      { status: 500 }
    );
  }
}
