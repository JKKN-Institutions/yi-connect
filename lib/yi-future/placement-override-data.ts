// ═══════════════════════════════════════════════════════════════════════
// Yi-Future — read the staff-override log (server-only).
//
// Split from lib/yi-future/placement-override.ts so the pure types + targets
// calculation stay importable by the client panel while this file keeps the
// service client to itself.
//
// TWO THINGS THIS FILE REFUSES TO DO
//
// 1. It never returns `[]` for an error. future.team_placement_overrides may not
//    exist yet (its migration ships unapplied) and, once created through the
//    Supabase Management API, it has NO service_role grant until the migration's
//    explicit GRANT runs. Both failures come back as a PostgREST error, and both
//    would read as "nobody has ever been placed without consenting" if the error
//    were swallowed — the worst possible lie for an audit log. So the result is a
//    discriminated union and the caller has to render the unavailable case.
//
// 2. It never counts a capped page. PostgREST caps one response at ~1000 rows
//    whether or not `.limit()` is set, so the read pages with `fetchAllRows` and
//    a stable order. One chapter is unlikely to reach 1,000 overrides — which is
//    exactly the reasoning that produced the row-cap bugs this codebase has
//    already paid for twice, so it pages anyway.
// ═══════════════════════════════════════════════════════════════════════

import { createServiceClient } from "@/lib/yi-future/supabase/server";
import { fetchAllRows } from "@/lib/pagination";
import { OVERRIDE_LOG_UNAVAILABLE_REASON } from "@/lib/yi-future/placement-override";
import type {
  PlacementOverrideLog,
  PlacementOverrideRecord,
} from "@/lib/yi-future/placement-override";

type OverrideRow = {
  id: string;
  delegate_id: string;
  delegate_name: string;
  team_id: string;
  team_name: string;
  placed_by_name: string | null;
  placed_by_email: string | null;
  placed_by_scope: string | null;
  had_pending_invite: boolean | null;
  reason: string | null;
  outcome: string | null;
  error_detail: string | null;
  created_at: string;
  applied_at: string | null;
};

const COLUMNS =
  "id, delegate_id, delegate_name, team_id, team_name, placed_by_name, placed_by_email, placed_by_scope, had_pending_invite, reason, outcome, error_detail, created_at, applied_at";

function toRecord(r: OverrideRow): PlacementOverrideRecord {
  return {
    id: r.id,
    delegateId: r.delegate_id,
    delegateName: r.delegate_name,
    teamId: r.team_id,
    teamName: r.team_name,
    placedByName: r.placed_by_name,
    placedByEmail: r.placed_by_email,
    placedByScope: r.placed_by_scope === "national" ? "national" : "chapter",
    hadPendingInvite: r.had_pending_invite === true,
    reason: r.reason,
    outcome:
      r.outcome === "applied"
        ? "applied"
        : r.outcome === "failed"
          ? "failed"
          : "pending",
    errorDetail: r.error_detail,
    createdAt: r.created_at,
    appliedAt: r.applied_at,
  };
}

/**
 * Every recorded override for one chapter + edition, newest first.
 *
 * Probes the table with a single-row read FIRST so a missing table / missing
 * grant is reported as such instead of being mistaken for an empty log. The
 * probe is one cheap request; correctness of an audit surface is worth it.
 */
export async function listPlacementOverrides(
  chapterId: string,
  editionId: string
): Promise<PlacementOverrideLog> {
  const svc = await createServiceClient();
  // future.team_placement_overrides is not in the generated types (same as
  // future.team_invitations and future.team_unlock_requests) → loose client for
  // these reads, the established pattern in this codebase.
  const loose = svc as any;

  const probe = await loose
    .schema("future")
    .from("team_placement_overrides")
    .select("id")
    .limit(1);

  if (probe.error) {
    const detail =
      typeof probe.error?.message === "string" ? probe.error.message : null;
    return {
      available: false,
      reason: OVERRIDE_LOG_UNAVAILABLE_REASON,
      detail,
    };
  }

  // Collected in an array rather than a `let` because the assignment happens
  // inside a callback, and a narrowed `let` would be read back as never-set.
  const readErrors: string[] = [];
  const rows = await fetchAllRows<OverrideRow>(async (from, to) => {
    const res = await loose
      .schema("future")
      .from("team_placement_overrides")
      .select(COLUMNS)
      .eq("chapter_id", chapterId)
      .eq("edition_id", editionId)
      // Stable, unique tiebreaker so pages neither overlap nor skip.
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .range(from, to);
    if (res.error) {
      const m = (res.error as { message?: string } | null)?.message;
      readErrors.push(typeof m === "string" ? m : "unknown error");
    }
    return res as { data: OverrideRow[] | null; error: unknown };
  });

  // `fetchAllRows` stops on error and returns what it has. A partial audit log
  // presented as complete is not acceptable, so a mid-read failure is reported
  // as unavailable rather than as a short list.
  if (readErrors.length > 0) {
    return {
      available: false,
      reason: OVERRIDE_LOG_UNAVAILABLE_REASON,
      detail: readErrors[0],
    };
  }

  return { available: true, rows: rows.map(toRecord) };
}
