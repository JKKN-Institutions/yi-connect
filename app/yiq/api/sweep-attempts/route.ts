import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/yiq/supabase/server";
import { finaliseAttempt } from "@/app/yiq/actions/attempt";
import { LATE_WRITE_GRACE_MS } from "@/lib/yiq/paper";

/**
 * Close attempts whose time ran out and whose student never came back.
 *
 * WHY THIS EXISTS. Before this route, the ONLY things that finalised an
 * attempt were the student returning (startAttempt closes an expired one) or
 * the student submitting. A phone that dies mid-paper, a closed tab, a lost
 * network — the row stays `in_progress` forever. And computeChapterStandings
 * counts only `submitted` / `auto_submitted`, so every question that student
 * DID answer scores zero, and their team silently loses those points.
 *
 * In a competition that decides who reaches the National Grand Finale, that is
 * a wrong result, not an edge case. It is the same shape as YIP's papers stuck
 * in `scoring` with nothing to requeue them.
 *
 * Auth: shared secret in `X-Cron-Secret`, compared to YIQ_SWEEP_SECRET.
 * FAILS CLOSED when the secret is unset — an unconfigured deploy must not
 * expose a way to force-submit other people's papers.
 */
export const dynamic = "force-dynamic";
export const maxDuration = 300;

// Grade in bounded parallel: enough to clear a chapter quickly, not enough to
// exhaust the connection pool during a live round.
const CONCURRENCY = 4;
// A single sweep never touches more than this. A stuck backlog drains over
// several runs rather than one 300s request that times out halfway.
const BATCH = 200;

async function mapPool<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
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

export async function POST(request: Request) {
  const secret = process.env.YIQ_SWEEP_SECRET;
  if (!secret) {
    console.log(JSON.stringify({ tag: "yiq_sweep", verdict: "deny", reason: "secret_unset" }));
    return NextResponse.json({ error: "sweeper not configured" }, { status: 503 });
  }
  if (request.headers.get("x-cron-secret") !== secret) {
    console.log(JSON.stringify({ tag: "yiq_sweep", verdict: "deny", reason: "bad_secret" }));
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const svc = await createServiceClient();
  const cutoff = new Date(Date.now() - LATE_WRITE_GRACE_MS).toISOString();

  const { data: stale, error } = await svc
    .from("attempts")
    .select("id, student_id, is_mock, expires_at")
    .eq("status", "in_progress")
    .lt("expires_at", cutoff)
    .order("expires_at")
    .limit(BATCH);

  if (error) {
    console.error("[yiq] sweep query failed", error);
    return NextResponse.json({ error: "query failed" }, { status: 500 });
  }
  if (!stale || stale.length === 0) {
    return NextResponse.json({ swept: 0, remaining: 0 });
  }

  // finaliseAttempt is itself idempotent and status-guarded, so a sweep racing
  // a student's own submit cannot double-write or change a recorded score.
  const results = await mapPool(stale, CONCURRENCY, async (a) => {
    try {
      const g = await finaliseAttempt(a.id, "auto_submitted");
      return { id: a.id, ok: Boolean(g), score: g?.score ?? null };
    } catch (e) {
      console.error("[yiq] sweep failed for attempt", a.id, e);
      return { id: a.id, ok: false, score: null };
    }
  });

  const swept = results.filter((r) => r.ok).length;
  const failed = results.length - swept;

  const { count: remaining } = await svc
    .from("attempts")
    .select("id", { count: "exact", head: true })
    .eq("status", "in_progress")
    .lt("expires_at", cutoff);

  console.log(
    JSON.stringify({ tag: "yiq_sweep", verdict: "ran", swept, failed, remaining: remaining ?? 0 })
  );
  return NextResponse.json({ swept, failed, remaining: remaining ?? 0 });
}

/**
 * Read-only health probe. Deliberately does NOT claim or close anything —
 * poking a GET that mutates is how YIP converted 25 healthy pending papers
 * into permanently stuck ones.
 */
export async function GET(request: Request) {
  const secret = process.env.YIQ_SWEEP_SECRET;
  if (!secret || request.headers.get("x-cron-secret") !== secret) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const svc = await createServiceClient();
  const cutoff = new Date(Date.now() - LATE_WRITE_GRACE_MS).toISOString();
  const { count } = await svc
    .from("attempts")
    .select("id", { count: "exact", head: true })
    .eq("status", "in_progress")
    .lt("expires_at", cutoff);
  return NextResponse.json({ awaiting_sweep: count ?? 0, mutates: false });
}
