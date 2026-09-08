import { NextResponse, type NextRequest } from "next/server";
import { createServiceClient } from "@/lib/yiq/supabase/server";
import { finaliseAttempt } from "@/app/yiq/actions/attempt";
import { LATE_WRITE_GRACE_MS } from "@/lib/yiq/paper";

/**
 * Vercel-Cron entry point for the abandoned-paper sweeper.
 *
 * WHY A SECOND ROUTE. /yiq/api/sweep-attempts already does this work, but it
 * only accepts POST with an `X-Cron-Secret` header and its own secret — and
 * **Vercel Cron sends a GET with `Authorization: Bearer <CRON_SECRET>`**, so it
 * could never have driven it. This route follows the pattern the four crons
 * already in vercel.json use (see app/yi-future/api/cron/lock-teams): GET,
 * either header accepted, and the SHARED `CRON_SECRET` that is already
 * configured in production — so scheduling this needs no new env var.
 *
 * WHAT IT FIXES. An attempt is otherwise only finalised when the student comes
 * back or submits. A dead phone or a closed tab strands it `in_progress`
 * forever, and computeChapterStandings counts only submitted/auto_submitted —
 * so the questions that student DID answer score zero and their team silently
 * loses those points.
 *
 * Fails CLOSED when CRON_SECRET is unset.
 */
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const CONCURRENCY = 4;
const BATCH = 200;

async function mapPool<T, R>(items: T[], limit: number, fn: (x: T) => Promise<R>) {
  const out: R[] = new Array(items.length);
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (i < items.length) {
        const idx = i++;
        out[idx] = await fn(items[idx]);
      }
    })
  );
  return out;
}

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const incoming = request.headers.get("x-cron-secret");
  const bearer = request.headers.get("authorization");
  const authorised =
    Boolean(cronSecret) &&
    (incoming === cronSecret || bearer === `Bearer ${cronSecret}`);

  if (!authorised) {
    console.log(
      JSON.stringify({
        tag: "yiq_sweep_cron",
        verdict: "deny",
        reason: cronSecret ? "bad_secret" : "secret_unset",
      })
    );
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const svc = await createServiceClient();
  const cutoff = new Date(Date.now() - LATE_WRITE_GRACE_MS).toISOString();

  const { data: stale, error } = await svc
    .from("attempts")
    .select("id")
    .eq("status", "in_progress")
    .lt("expires_at", cutoff)
    .order("expires_at")
    .limit(BATCH);

  if (error) {
    console.error("[yiq] sweep cron query failed", error);
    return NextResponse.json({ error: "query failed" }, { status: 500 });
  }
  if (!stale?.length) {
    return NextResponse.json({ swept: 0, remaining: 0 });
  }

  // finaliseAttempt is idempotent and status-guarded, so a sweep racing a
  // student's own submit cannot double-write or change a recorded score.
  const results = await mapPool(stale, CONCURRENCY, async (a) => {
    try {
      return Boolean(await finaliseAttempt(a.id, "auto_submitted"));
    } catch (e) {
      console.error("[yiq] sweep cron failed for", a.id, e);
      return false;
    }
  });

  const swept = results.filter(Boolean).length;
  const { count: remaining } = await svc
    .from("attempts")
    .select("id", { count: "exact", head: true })
    .eq("status", "in_progress")
    .lt("expires_at", cutoff);

  console.log(
    JSON.stringify({
      tag: "yiq_sweep_cron",
      verdict: "ran",
      swept,
      failed: results.length - swept,
      remaining: remaining ?? 0,
    })
  );
  return NextResponse.json({ swept, failed: results.length - swept, remaining: remaining ?? 0 });
}
