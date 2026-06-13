/**
 * GET /youth-academy/guide/pdf?lane=<lane>
 *
 * Streams the persona guide as a downloadable PDF (same content as the in-app
 * /youth-academy/guide page). Lane access mirrors the page: managers
 * (national / chapter / coordinator) may download any lane to share with their
 * team; everyone else is served their own lane regardless of ?lane=. There is
 * no sensitive data here (instructions only), so an unknown viewer simply gets
 * the public "applicant" guide.
 *
 * Donor: app/yi-future/api/finalists/[eventId]/pdf/route.tsx (Node runtime,
 * @react-pdf buffer → NextResponse).
 */
import { NextResponse, type NextRequest } from "next/server";
import {
  isGuideLane,
  guidePdfFilename,
  type GuideLane,
} from "@/lib/yuva/guide/content";
import { detectGuideLane } from "@/lib/yuva/guide/detect-lane";
import { renderGuidePdfBuffer } from "@/lib/yuva/guide/guide-pdf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const requestedRaw = request.nextUrl.searchParams.get("lane");
  const { lane: ownLane, canViewOtherLanes } = await detectGuideLane();

  const requested = isGuideLane(requestedRaw) ? requestedRaw : null;
  const lane: GuideLane =
    requested && (canViewOtherLanes || requested === ownLane)
      ? requested
      : ownLane;

  const buffer = await renderGuidePdfBuffer(lane);

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${guidePdfFilename(lane)}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
