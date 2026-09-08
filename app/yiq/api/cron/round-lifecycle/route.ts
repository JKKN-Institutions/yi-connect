import { NextResponse, type NextRequest } from "next/server";
import { createServiceClient } from "@/lib/yiq/supabase/server";
import { planTransition, type LifecycleEdition, type LifecycleEvent } from "@/lib/yiq/lifecycle";

/**
 * Vercel-Cron entry point for the round lifecycle.
 *
 * Moves each chapter event along the clock-owned rungs of its ladder —
 * registration opens, registration closes, the online round opens, the online
 * round closes — each strictly on its own window. Everything from
 * `finals_scheduled` onward is a human's call and is never touched here.
 *
 * WHY THIS ROUTE EXISTS ALONGSIDE /yiq/api/round-lifecycle: that one accepts
 * only `X-Cron-Secret` with its own secret, and **Vercel Cron sends a GET with
 * `Authorization: Bearer <CRON_SECRET>`** — so it could never have driven it.
 * This follows the pattern the four crons already in vercel.json use and reads
 * the SHARED `CRON_SECRET` already configured in production, so scheduling it
 * needs no new env var.
 *
 * SAFETY, inherited from lib/yiq/lifecycle.ts and preserved here:
 *  - a rung is NEVER skipped. Two or more rungs due means the calendar and the
 *    data disagree, and nothing moves — opening a registration that closed
 *    weeks ago, or closing a round that never opened, is worse than waiting
 *    for a human.
 *  - every write is a compare-and-set on the status we read, so an event an
 *    organiser moved by hand between the read and the write is skipped, not
 *    clobbered.
 *  - standings are NEVER computed or published here. Publishing a chapter's
 *    result is an organiser's decision; closing the round only logs that it
 *    is ready.
 *  - fails CLOSED when CRON_SECRET is unset.
 */
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const incoming = request.headers.get("x-cron-secret");
  const bearer = request.headers.get("authorization");
  const authorised =
    Boolean(cronSecret) && (incoming === cronSecret || bearer === `Bearer ${cronSecret}`);

  if (!authorised) {
    console.log(
      JSON.stringify({
        tag: "yiq_lifecycle_cron",
        verdict: "deny",
        reason: cronSecret ? "bad_secret" : "secret_unset",
      })
    );
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const svc = await createServiceClient();
  const now = Date.now();

  const { data: edition } = await svc
    .from("editions")
    .select(
      "id, name, registration_opens_at, registration_closes_at, online_round_opens_at, online_round_closes_at"
    )
    .eq("is_active", true)
    .maybeSingle();

  if (!edition) {
    return NextResponse.json({ ran: false, reason: "no_active_edition" });
  }

  const { data: events } = await svc
    .from("chapter_events")
    .select(
      "id, chapter_name, status, registration_opens_at, registration_closes_at, online_round_opens_at, online_round_closes_at"
    )
    .eq("edition_id", edition.id);

  if (!events?.length) {
    return NextResponse.json({ ran: true, events: 0, transitioned: 0, attention: 0 });
  }

  // Group by (from -> to) so each group is one compare-and-set UPDATE.
  const groups = new Map<string, { from: string; to: string; ids: string[] }>();
  let attention = 0;

  for (const e of events) {
    const plan = planTransition(
      e as unknown as LifecycleEvent,
      edition as unknown as LifecycleEdition,
      now
    );
    if (plan.kind === "transition") {
      const key = `${plan.from}->${plan.to}`;
      const g = groups.get(key) ?? { from: plan.from, to: plan.to, ids: [] };
      g.ids.push(e.id);
      groups.set(key, g);
    } else if (plan.kind === "attention") {
      attention++;
      console.log(
        JSON.stringify({
          tag: "yiq_lifecycle_cron",
          verdict: "attention",
          eventId: e.id,
          chapter: e.chapter_name,
          status: e.status,
          reason: plan.reason,
        })
      );
    }
  }

  let transitioned = 0;
  for (const g of groups.values()) {
    // Compare-and-set: .eq("status", g.from) means a row an organiser moved
    // between our read and this write is skipped rather than overwritten.
    const { data: moved } = await svc
      .from("chapter_events")
      .update({ status: g.to })
      .in("id", g.ids)
      .eq("status", g.from)
      .select("id, chapter_name");

    const movedIds = new Set((moved ?? []).map((m) => m.id));
    transitioned += movedIds.size;

    for (const m of moved ?? []) {
      console.log(
        JSON.stringify({
          tag: "yiq_lifecycle_cron",
          verdict: "transitioned",
          eventId: m.id,
          chapter: m.chapter_name,
          from: g.from,
          to: g.to,
        })
      );
      if (g.to === "online_round_closed") {
        // Ready to compute — but publishing is the organiser's decision.
        console.log(
          JSON.stringify({
            tag: "yiq_lifecycle_cron",
            verdict: "standings_ready",
            eventId: m.id,
            chapter: m.chapter_name,
          })
        );
      }
    }

    for (const id of g.ids.filter((i) => !movedIds.has(i))) {
      console.log(
        JSON.stringify({
          tag: "yiq_lifecycle_cron",
          verdict: "skipped_changed_underneath",
          eventId: id,
          expectedFrom: g.from,
        })
      );
    }
  }

  console.log(
    JSON.stringify({
      tag: "yiq_lifecycle_cron",
      verdict: "ran",
      events: events.length,
      transitioned,
      attention,
    })
  );
  return NextResponse.json({ ran: true, events: events.length, transitioned, attention });
}
