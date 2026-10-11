/**
 * Take Pride business-card drain, for the OUT-OF-BAND claude.ai routine.
 *
 * The production app NEVER calls an LLM and holds no AI key. Delegates
 * photograph cards (tp_card_scans, photo stored as base64 JPEG); the routine:
 *   GET  -> claims up to 5 pending scans (pending -> generating) and receives
 *           each as { scan_id, image_jpeg_b64 }. No delegate data at all.
 *   POST -> { scan_id, contact: {...} } stores the checked contact (-> ready)
 *           and DELETES the photo, or { scan_id, error } marks the scan failed
 *           and deletes the photo.
 *
 * Auth: header X-Cron-Secret must equal process.env.YIP_AI_ROUTINE_SECRET
 * (timing-safe). FAIL CLOSED: an unset secret denies every call.
 * Routine instructions: docs/take-pride-ai-cards.md.
 */
import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import {
  claimScans,
  completeScan,
  expireOldScans,
  failScan,
  getScanForRoutine,
  purgeFinishedPhotos,
  resetStaleScans,
} from "@/lib/take-pride/cards/queue";
import { isCardId, validateContact } from "@/lib/take-pride/cards/schemas";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

function isAuthorized(request: NextRequest): boolean {
  const secret = process.env.YIP_AI_ROUTINE_SECRET;
  if (!secret) return false; // fail closed when unconfigured
  const given = request.headers.get("x-cron-secret");
  if (!given) return false;
  // Compare fixed-length digests so neither length nor content leaks by timing.
  const a = createHash("sha256").update(given).digest();
  const b = createHash("sha256").update(secret).digest();
  return timingSafeEqual(a, b);
}

const unauthorized = () => NextResponse.json({ error: "Unauthorized" }, { status: 401 });
const NO_STORE = { "Cache-Control": "no-store" };

export async function GET(request: NextRequest): Promise<NextResponse> {
  if (!isAuthorized(request)) return unauthorized();

  // Housekeeping first; none of it may block the drain.
  let expired = 0;
  let purged = 0;
  let reset = 0;
  try {
    expired = await expireOldScans();
  } catch {}
  try {
    purged = await purgeFinishedPhotos();
  } catch {}
  try {
    reset = await resetStaleScans();
  } catch {}

  let claimed: Awaited<ReturnType<typeof claimScans>> = { scans: [], released: 0 };
  try {
    claimed = await claimScans();
  } catch {}

  const scans = claimed.scans.map((s) => ({ scan_id: s.id, image_jpeg_b64: s.image_jpeg_b64 }));
  return NextResponse.json(
    {
      count: scans.length,
      scans,
      more_waiting: claimed.released > 0,
      expired_unread: expired,
      photos_purged: purged,
      reset_stale: reset,
    },
    { headers: NO_STORE }
  );
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  if (!isAuthorized(request)) return unauthorized();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body must be JSON" }, { status: 400 });
  }
  const b = (body ?? {}) as { scan_id?: unknown; contact?: unknown; error?: unknown };
  if (!isCardId(b.scan_id)) return NextResponse.json({ error: "scan_id must be a scan id" }, { status: 400 });

  const scan = await getScanForRoutine(b.scan_id);
  if (!scan) return NextResponse.json({ error: "Scan not found" }, { status: 404 });
  if (scan.status !== "generating") {
    return NextResponse.json({ error: `Scan is ${scan.status}, not claimed. GET again for fresh work.` }, { status: 409 });
  }

  if (b.contact === undefined || b.contact === null) {
    const reason = typeof b.error === "string" && b.error.trim() ? b.error.trim() : "Routine gave up";
    const ok = await failScan(scan.id, `Routine: ${reason}`);
    return ok
      ? NextResponse.json({ ok: true, status: "failed" })
      : NextResponse.json({ error: "Scan changed while saving" }, { status: 409 });
  }

  const v = validateContact(b.contact, "routine");
  if (!v.ok) {
    await failScan(scan.id, v.error);
    return NextResponse.json({ error: v.error, status: "failed" }, { status: 422 });
  }
  const saved = await completeScan(scan.id, v.contact);
  if (!saved.ok) {
    return saved.reason === "not_claimed"
      ? NextResponse.json({ error: "Scan changed while saving" }, { status: 409 })
      : NextResponse.json({ error: "Contact could not be saved", status: "failed" }, { status: 500 });
  }
  return NextResponse.json({ ok: true, status: "ready", dropped: v.dropped });
}
