import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/yip/supabase/server";
import { getEvent, getEventSetupProgress } from "@/app/yip/actions/events";
import { getYipEventAccess } from "@/lib/yip/auth/event-access";
import { getCurrentPersonRoles } from "@/lib/yi/auth/yi-directory-roles";

// TEMPORARY read-only perf probe. Attributes the ~2.3s authenticated-page
// baseline: how slow is one Supabase round-trip from this function's region,
// vs how much is auth vs the layout helpers. Excluded from middleware (top-level
// /api). Uses the service client for the DB-latency numbers so it works on a
// preview WITHOUT an app session. Delete after diagnosis.
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function timed<T>(fn: () => Promise<T>) {
  const t0 = Date.now();
  try {
    const r = await fn();
    const note = r == null ? "null" : Array.isArray(r) ? `arr:${r.length}` : typeof r;
    return { ms: Date.now() - t0, ok: true, note };
  } catch (e) {
    return { ms: Date.now() - t0, ok: false, note: String(e).slice(0, 140) };
  }
}

export async function GET(req: NextRequest) {
  const eventId =
    req.nextUrl.searchParams.get("eventId") ??
    "170c8e79-5e27-4831-ace2-cea1782a971f";
  const out: Record<string, unknown> = { eventId, region: process.env.VERCEL_REGION ?? null };

  // Client creation cost
  let t = Date.now();
  const svc = await createServiceClient();
  out.createServiceClient_ms = Date.now() - t;
  t = Date.now();
  const app = await createClient();
  out.createClient_ms = Date.now() - t;

  // Single DB round-trip (service client — the app's deployed read path)
  out.rt_single = await timed(async () => {
    const { data } = await svc.from("events").select("id").limit(1);
    return data;
  });

  // Sequential round-trips to confirm linearity + isolate per-hop latency
  t = Date.now();
  for (let i = 0; i < 5; i++) await svc.from("events").select("id").limit(1);
  out.rt_5_sequential_ms = Date.now() - t;

  // Parallel round-trips (same 5 concurrently) — if ~= single, hops parallelize well
  t = Date.now();
  await Promise.all(
    Array.from({ length: 5 }, () => svc.from("events").select("id").limit(1))
  );
  out.rt_5_parallel_ms = Date.now() - t;

  // Auth cost (null-fast without a session; real cost only when authenticated)
  out.auth_getUser = await timed(async () => {
    const { data } = await app.auth.getUser();
    return data?.user ?? null;
  });

  // App helpers on the render critical path
  out.getCurrentPersonRoles = await timed(() => getCurrentPersonRoles());
  out.getEvent = await timed(() => getEvent(eventId));
  out.getYipEventAccess = await timed(() => getYipEventAccess(eventId));
  out.getEventSetupProgress = await timed(() => getEventSetupProgress(eventId));

  return NextResponse.json(out, { headers: { "cache-control": "no-store" } });
}
