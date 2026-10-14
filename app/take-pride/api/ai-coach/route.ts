/**
 * Take Pride "My 1% coach" drain endpoint, for the OUT-OF-BAND claude.ai routine.
 *
 * The production app NEVER calls an LLM and holds no AI key. Delegates send
 * pledge check-ins (tp_coach_checkins); the routine:
 *   GET  -> claims up to 20 pending check-ins (pending -> generating) and
 *           receives each with the grounding it needs, and nothing more.
 *   POST -> { checkin_id, output } stores a checked, clamped coach note
 *           (-> ready), or { checkin_id, error } marks it failed.
 *
 * Auth: header X-Cron-Secret must equal process.env.YIP_AI_ROUTINE_SECRET
 * (timing-safe). FAIL CLOSED: an unset secret denies every call.
 * Routine instructions: docs/take-pride-ai-coach.md.
 */
import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { buildCoachGrounding } from "@/lib/take-pride/coach/grounding";
import {
  claimCheckins,
  completeCheckin,
  failCheckin,
  getCheckinForRoutine,
  pinCheckinAllowed,
  resetStaleCheckins,
} from "@/lib/take-pride/coach/queue";
import { validateCoachNote } from "@/lib/take-pride/coach/schemas";
import { isUuid } from "@/lib/take-pride/ai/schemas";

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

export async function GET(request: NextRequest): Promise<NextResponse> {
  if (!isAuthorized(request)) return unauthorized();

  let reset = 0;
  try {
    reset = await resetStaleCheckins();
  } catch {}

  const claimed = await claimCheckins();
  const checkins: { checkin_id: string; kind: "coach"; grounding: Record<string, unknown> }[] = [];
  for (const c of claimed) {
    try {
      const built = await buildCoachGrounding(c);
      if (!built) {
        await failCheckin(c.id, "Delegate not found");
        continue;
      }
      if (!(await pinCheckinAllowed(c.id, built.allowed))) {
        // Without pinned ids every person would be dropped on POST, so do not hand it out.
        await failCheckin(c.id, "Could not pin grounding ids");
        continue;
      }
      checkins.push({ checkin_id: c.id, kind: "coach", grounding: built.grounding });
    } catch {
      await failCheckin(c.id, "Grounding could not be built");
    }
  }

  return NextResponse.json(
    { count: checkins.length, checkins, reset_stale: reset },
    { headers: { "Cache-Control": "no-store" } }
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
  const b = (body ?? {}) as { checkin_id?: unknown; output?: unknown; error?: unknown };
  if (!isUuid(b.checkin_id)) return NextResponse.json({ error: "checkin_id must be a check-in id" }, { status: 400 });

  const c = await getCheckinForRoutine(b.checkin_id);
  if (!c) return NextResponse.json({ error: "Check-in not found" }, { status: 404 });
  if (c.status !== "generating") {
    return NextResponse.json({ error: `Check-in is ${c.status}, not claimed. GET again for fresh work.` }, { status: 409 });
  }

  if (b.output === undefined) {
    const reason = typeof b.error === "string" && b.error.trim() ? b.error.trim() : "Routine gave up";
    const ok = await failCheckin(c.id, `Routine: ${reason}`);
    return ok
      ? NextResponse.json({ ok: true, status: "failed" })
      : NextResponse.json({ error: "Check-in changed while saving" }, { status: 409 });
  }

  const v = validateCoachNote(b.output, c.allowed);
  if (!v.ok) {
    await failCheckin(c.id, v.error);
    return NextResponse.json({ error: v.error, status: "failed" }, { status: 422 });
  }
  const saved = await completeCheckin(c.id, v.output);
  if (!saved) return NextResponse.json({ error: "Check-in changed while saving" }, { status: 409 });
  return NextResponse.json({ ok: true, status: "ready", dropped: v.dropped });
}
