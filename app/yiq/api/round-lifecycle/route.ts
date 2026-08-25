/**
 * Secret-protected endpoint that walks every YIQ chapter event of the ACTIVE
 * edition up its lifecycle ladder when its window says so.
 *
 *   GET  → READ-ONLY DRY RUN. Reports what WOULD change and why. Mutates
 *          NOTHING (see the warning below).
 *   POST → applies the due transitions, batched, one structured log line per
 *          transition.
 *
 * The decision itself is pure and lives in lib/yiq/lifecycle.ts — this file
 * only reads rows, hands them to it, and writes back what it says. It never
 * skips a rung, never moves an event backwards, and never touches anything at
 * or past `finals_scheduled`; those stages are a human's call, not a clock's.
 *
 * ⛔ THE GET MUST STAY READ-ONLY. In this repo a routine's GET once CLAIMED the
 * rows it returned, and 25 healthy papers became permanently stuck when the
 * caller crashed after the claim. A dry run that mutates is not a dry run. If
 * you are adding behaviour here, add it to POST.
 *
 * Auth: a single shared secret in the `X-Cron-Secret` header compared to
 * process.env.YIQ_LIFECYCLE_SECRET, mirroring app/yip/api/ai-drafts/route.ts.
 * FAILS CLOSED when the secret is unset — an unconfigured deploy returns 503
 * and runs nothing, so it can never become a way to open or close another
 * chapter's round. The caller is trusted ONLY for the secret; every fact used
 * to decide is read server-side. Uses the service client; no user session.
 *
 * NOTE for whoever schedules this: Vercel Cron cannot send a custom header —
 * it sends `Authorization: Bearer $CRON_SECRET`. Drive this from the same kind
 * of out-of-band routine that calls /yip/api/ai-drafts, or have a human decide
 * to widen the auth here first.
 */
import { NextResponse, type NextRequest } from "next/server";
import { createServiceClient } from "@/lib/yiq/supabase/server";
import {
  describePlan,
  groupTransitions,
  planEdition,
  type LifecycleEdition,
  type LifecycleEvent,
  type PlannedEvent,
} from "@/lib/yiq/lifecycle";

// Live DB reads/writes — never cache this route.
export const dynamic = "force-dynamic";

// 65 chapters, each a read plus a batched write. Give the function real
// headroom so a slow drain is never cut off half-applied.
export const maxDuration = 300;

const LOG_TAG = "yiq_lifecycle";

const EVENT_COLUMNS =
  "id, chapter_name, status, edition_id, registration_opens_at, registration_closes_at, online_round_opens_at, online_round_closes_at";
const EDITION_COLUMNS =
  "id, name, registration_opens_at, registration_closes_at, online_round_opens_at, online_round_closes_at";

type AuthOutcome = "ok" | "unconfigured" | "denied";

function authorize(request: NextRequest): AuthOutcome {
  const secret = process.env.YIQ_LIFECYCLE_SECRET;
  // Fail CLOSED: no secret configured means this endpoint does nothing at all.
  if (!secret) return "unconfigured";
  return request.headers.get("x-cron-secret") === secret ? "ok" : "denied";
}

function authResponse(outcome: Exclude<AuthOutcome, "ok">): NextResponse {
  if (outcome === "unconfigured") {
    return NextResponse.json(
      { error: "YIQ_LIFECYCLE_SECRET is not configured; this endpoint is disabled." },
      { status: 503 }
    );
  }
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

/** One structured line per decision, greppable in Vercel logs after the fact. */
function log(payload: Record<string, unknown>): void {
  console.log(JSON.stringify({ tag: LOG_TAG, ...payload }));
}

type Loaded =
  | { ok: true; edition: LifecycleEdition & { id: string; name?: string }; events: LifecycleEvent[] }
  | { ok: false; response: NextResponse };

/**
 * Read the active edition and all of its chapter events. Shared by GET and
 * POST so the dry run reports on exactly the rows the real run would act on.
 */
async function loadActiveEdition(): Promise<Loaded> {
  const svc = await createServiceClient();

  const { data: edition, error: editionErr } = await svc
    .from("editions")
    .select(EDITION_COLUMNS)
    .eq("is_active", true)
    .maybeSingle();

  if (editionErr) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Could not read the active edition." },
        { status: 500 }
      ),
    };
  }
  if (!edition) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "No active edition.", transitioned: 0, attention: [] },
        { status: 200 }
      ),
    };
  }

  const { data: events, error: eventsErr } = await svc
    .from("chapter_events")
    .select(EVENT_COLUMNS)
    .eq("edition_id", edition.id)
    .order("chapter_name", { ascending: true });

  if (eventsErr) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Could not read the chapter events." },
        { status: 500 }
      ),
    };
  }

  return {
    ok: true,
    edition: edition as LifecycleEdition & { id: string; name?: string },
    events: (events ?? []) as LifecycleEvent[],
  };
}

/** Rows a human should look at — reported by both verbs, acted on by neither. */
function attentionRows(planned: PlannedEvent[]) {
  return planned
    .filter((p) => p.plan.kind === "attention")
    .map(({ event, plan }) => ({
      eventId: event.id,
      chapter: event.chapter_name ?? null,
      status: event.status,
      clockSays: plan.kind === "attention" ? plan.clockSays : null,
      rungsBehind: plan.kind === "attention" ? plan.rungsBehind : 0,
      reason: plan.kind === "attention" ? plan.reason : "",
    }));
}

/**
 * GET — DRY RUN. Reads the same rows POST would, runs the same pure decision,
 * and reports it. It writes NOTHING: no status update, no audit row, no claim,
 * no side effect of any kind. Safe to call from a browser, safe to call twice.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const auth = authorize(request);
  if (auth !== "ok") return authResponse(auth);

  const loaded = await loadActiveEdition();
  if (!loaded.ok) return loaded.response;

  const now = new Date();
  const planned = planEdition(loaded.events, loaded.edition, now);

  const wouldChange = planned
    .filter((p) => p.plan.kind === "transition")
    .map(({ event, plan }) => ({
      eventId: event.id,
      chapter: event.chapter_name ?? null,
      from: plan.kind === "transition" ? plan.from : event.status,
      to: plan.kind === "transition" ? plan.to : null,
      window: plan.kind === "transition" ? plan.window : null,
      dueAt: plan.kind === "transition" ? plan.dueAt : null,
      windowSource: plan.kind === "transition" ? plan.windowSource : null,
      standingsReady: plan.kind === "transition" ? plan.standingsReady : false,
      why: describePlan(plan),
    }));

  const unchanged = planned
    .filter((p) => p.plan.kind === "none")
    .map(({ event, plan }) => ({
      eventId: event.id,
      chapter: event.chapter_name ?? null,
      status: event.status,
      why: plan.kind === "none" ? plan.reason : "",
    }));

  return NextResponse.json({
    dryRun: true,
    mutated: false,
    now: now.toISOString(),
    editionId: loaded.edition.id,
    editionName: loaded.edition.name ?? null,
    counts: {
      events: planned.length,
      wouldTransition: wouldChange.length,
      needsAttention: planned.filter((p) => p.plan.kind === "attention").length,
      unchanged: unchanged.length,
      standingsReady: wouldChange.filter((w) => w.standingsReady).length,
    },
    wouldTransition: wouldChange,
    needsAttention: attentionRows(planned),
    unchanged,
  });
}

/**
 * POST — apply every due transition for the active edition.
 *
 * Applied as one compare-and-set UPDATE per (from → to) group rather than one
 * per event: `.eq("status", from)` means a row an organiser moved by hand
 * between our read and our write is left exactly where they put it, and the
 * returned ids tell us precisely which rows actually flipped.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const auth = authorize(request);
  if (auth !== "ok") return authResponse(auth);

  const loaded = await loadActiveEdition();
  if (!loaded.ok) return loaded.response;

  const svc = await createServiceClient();
  const now = new Date();
  const nowIso = now.toISOString();
  const planned = planEdition(loaded.events, loaded.edition, now);
  const groups = groupTransitions(planned);

  const chapterById = new Map(
    loaded.events.map((e) => [e.id, e.chapter_name ?? null])
  );
  const planById = new Map(planned.map((p) => [p.event.id, p.plan]));

  const applied: {
    eventId: string;
    chapter: string | null;
    from: string;
    to: string;
    standingsReady: boolean;
  }[] = [];
  const skipped: { eventId: string; reason: string }[] = [];
  const errors: { from: string; to: string; error: string }[] = [];

  for (const group of groups) {
    const { data, error } = await svc
      .from("chapter_events")
      .update({ status: group.to, updated_at: nowIso })
      .in("id", group.eventIds)
      .eq("status", group.from)
      .select("id");

    if (error) {
      errors.push({ from: group.from, to: group.to, error: error.message });
      log({
        event: "transition_failed",
        from: group.from,
        to: group.to,
        eventIds: group.eventIds,
        error: error.message,
      });
      continue;
    }

    const flipped = new Set((data ?? []).map((r) => r.id));

    for (const eventId of group.eventIds) {
      if (!flipped.has(eventId)) {
        // The row moved under us — an organiser got there first. Leave it.
        skipped.push({
          eventId,
          reason: `No longer in ${group.from}; someone changed it first.`,
        });
        log({
          event: "transition_skipped",
          eventId,
          chapter: chapterById.get(eventId) ?? null,
          from: group.from,
          to: group.to,
          reason: "status_changed_under_us",
          at: nowIso,
        });
        continue;
      }

      const plan = planById.get(eventId);
      const dueAt = plan && plan.kind === "transition" ? plan.dueAt : null;
      const windowSource =
        plan && plan.kind === "transition" ? plan.windowSource : null;

      applied.push({
        eventId,
        chapter: chapterById.get(eventId) ?? null,
        from: group.from,
        to: group.to,
        standingsReady: group.standingsReady,
      });

      // One structured line per transition — this is the record that makes a
      // wrong move findable in Vercel logs afterwards.
      log({
        event: "transition",
        eventId,
        chapter: chapterById.get(eventId) ?? null,
        from: group.from,
        to: group.to,
        window: group.window,
        windowSource,
        dueAt,
        standingsReady: group.standingsReady,
        at: nowIso,
      });

      // Closing the online round means this chapter's standings CAN now be
      // computed. That is all this endpoint says about it. Computing and
      // publishing a result is an organiser's decision, taken in the dashboard
      // (computeChapterStandings) — a cron must never decide who qualified.
      if (group.standingsReady) {
        log({
          event: "standings_ready",
          eventId,
          chapter: chapterById.get(eventId) ?? null,
          note: "Online round closed. Standings can be computed by an organiser; nothing was computed or published here.",
          at: nowIso,
        });
      }

      // Best-effort in-product history, matching the row that
      // app/yiq/actions/admin.ts writes when a human changes the status. Never
      // allowed to fail the drain.
      const { error: auditErr } = await svc.from("audit_log").insert({
        actor_user_id: null,
        actor_label: "yiq_lifecycle_cron",
        action: "chapter_event_status_changed",
        entity_type: "chapter_event",
        entity_id: eventId,
        chapter_event_id: eventId,
        detail: {
          status: group.to,
          from: group.from,
          by: "lifecycle_cron",
          window: group.window,
          window_source: windowSource,
          due_at: dueAt,
          standings_ready: group.standingsReady,
        },
      });
      if (auditErr) {
        log({
          event: "audit_write_failed",
          eventId,
          error: auditErr.message,
          at: nowIso,
        });
      }
    }
  }

  const attention = attentionRows(planned);
  for (const row of attention) {
    log({
      event: "needs_attention",
      eventId: row.eventId,
      chapter: row.chapter,
      status: row.status,
      clockSays: row.clockSays,
      rungsBehind: row.rungsBehind,
      reason: row.reason,
      at: nowIso,
    });
  }

  log({
    event: "run_complete",
    editionId: loaded.edition.id,
    events: planned.length,
    transitioned: applied.length,
    skipped: skipped.length,
    needsAttention: attention.length,
    errors: errors.length,
    at: nowIso,
  });

  return NextResponse.json({
    dryRun: false,
    now: nowIso,
    editionId: loaded.edition.id,
    counts: {
      events: planned.length,
      transitioned: applied.length,
      skipped: skipped.length,
      needsAttention: attention.length,
      standingsReady: applied.filter((a) => a.standingsReady).length,
      errors: errors.length,
    },
    transitioned: applied,
    skipped,
    needsAttention: attention,
    errors,
  });
}
