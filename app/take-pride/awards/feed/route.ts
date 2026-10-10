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
    return NextResponse.json(feed, { headers: { "Cache-Control": "no-store, max-age=0" } });
  } catch {
    return NextResponse.json({ error: "Feed unavailable" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
