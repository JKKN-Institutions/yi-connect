import { NextResponse } from "next/server";
import { getRevealFeed } from "@/lib/take-pride/recognitions-bridge";

/**
 * Public Awards Night feed for the hall screen. Returns ONLY what has been
 * revealed (see getRevealFeed): award, category, winner chapter, citation.
 * Rehearsal reveals carry the placeholder winner. Nothing unrevealed, no ids
 * of chapters, no scores or ranks.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const feed = await getRevealFeed();
    // Browsers always re-ask; a shared edge cache may hold it for 3 s.
    return NextResponse.json(feed, { headers: { "Cache-Control": "public, max-age=0, s-maxage=3" } });
  } catch {
    return NextResponse.json({ error: "Feed unavailable" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
