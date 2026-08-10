/**
 * GET /yi-future/api/cron/lock-teams
 *
 * Vercel Cron endpoint (every 5 min — registered in vercel.json). Applies the
 * per-chapter team-lock deadlines set from the chapter Teams page.
 *
 * For each future.team_lock_schedule row whose lock_at has passed and whose
 * applied_at is still null:
 *   1. lock every unlocked team in that chapter + edition
 *   2. stamp applied_at and locked_count
 *
 * Why a sweep and not a one-shot timer: a job that fires once at an exact
 * minute has no second chance — a missed or failed run means the deadline
 * silently never happens. A sweep that asks "which deadlines have passed?"
 * catches up on the next run.
 *
 * Why applied_at matters: without it this would re-lock every 5 minutes, so an
 * admin who deliberately unlocked a team after the deadline would find it
 * locked again almost immediately. Acting once per deadline leaves the admin
 * in control afterwards. Re-scheduling clears applied_at (setTeamLockDeadline),
 * so a new deadline does fire.
 *
 * Auth: header X-Cron-Secret matching process.env.CRON_SECRET, OR
 * `Authorization: Bearer <CRON_SECRET>` — the header Vercel Cron sends when
 * CRON_SECRET is configured. Fails CLOSED when CRON_SECRET is unset: an
 * endpoint that can lock every team in a chapter must never be open.
 *
 * Returns { deadlines_applied, teams_locked }.
 */

import { NextResponse, type NextRequest } from "next/server";
import { createServiceClient } from "@/lib/yi-future/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type DueRow = {
  id: string;
  chapter_id: string;
  edition_id: string;
};

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const incomingSecret = request.headers.get("x-cron-secret");
  const bearer = request.headers.get("authorization");

  const authorized =
    !!cronSecret &&
    (incomingSecret === cronSecret || bearer === `Bearer ${cronSecret}`);

  if (!authorized) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const nowIso = new Date().toISOString();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const svc = (await createServiceClient()) as any;

  const { data: dueRaw, error: dueErr } = await svc
    .schema("future")
    .from("team_lock_schedule")
    .select("id, chapter_id, edition_id")
    .lte("lock_at", nowIso)
    .is("applied_at", null);

  if (dueErr) {
    return NextResponse.json({ error: dueErr.message }, { status: 500 });
  }

  const due = (dueRaw as DueRow[] | null) ?? [];
  let teamsLocked = 0;
  let deadlinesApplied = 0;

  for (const row of due) {
    // Count first so the number reported is what this run actually locks,
    // and so head:true keeps it clear of the 1,000-row PostgREST cap.
    const { count: openCount } = await svc
      .schema("future")
      .from("teams")
      .select("id", { count: "exact", head: true })
      .eq("chapter_id", row.chapter_id)
      .eq("edition_id", row.edition_id)
      .eq("is_frozen", false);

    const n = openCount ?? 0;

    if (n > 0) {
      const { error: lockErr } = await svc
        .schema("future")
        .from("teams")
        .update({ is_frozen: true, frozen_at: nowIso, updated_at: nowIso })
        .eq("chapter_id", row.chapter_id)
        .eq("edition_id", row.edition_id)
        .eq("is_frozen", false);
      // A failure here must NOT stamp applied_at, or the deadline would be
      // silently marked done having locked nothing. Leaving it unstamped means
      // the next run retries it.
      if (lockErr) continue;
      teamsLocked += n;
    }

    await svc
      .schema("future")
      .from("team_lock_schedule")
      .update({ applied_at: nowIso, locked_count: n, updated_at: nowIso })
      .eq("id", row.id);
    deadlinesApplied += 1;
  }

  return NextResponse.json({
    deadlines_applied: deadlinesApplied,
    teams_locked: teamsLocked,
  });
}
