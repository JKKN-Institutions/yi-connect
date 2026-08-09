"use server";

/**
 * Yi-Future VOLUNTEER DESK actions — called by a person holding a 6-character
 * code, with no Supabase Auth account. Every export re-resolves the volunteer
 * from the DB via requireDeskVolunteer() (fail closed) and re-verifies that the
 * target session and the target delegate belong to that volunteer's own
 * chapter + edition. The rendered list is NOT a gate; these checks are.
 *
 * Deliberately SEPARATE from app/yi-future/actions/attendance.ts (the
 * admin-side bulk save) — see the note on markDelegatePresent for why the
 * volunteer path must never write a bulk map.
 *
 * Reads are NON-PII: names only. No email, phone, college or resume.
 */

import { revalidatePath } from "next/cache";
import {
  requireDeskVolunteer,
  assertSessionInMyChapter,
  assertDelegateInMyChapter,
} from "@/lib/yi-future/auth/volunteer-session";
import {
  DESK_ROSTER_LIMIT,
  stationLabel,
  type DeskResult,
  type DeskRoster,
  type DeskRosterRow,
  type DeskSession,
} from "@/lib/yi-future/volunteers";

function msg(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

// ─── WHO AM I + WHICH SESSIONS CAN I WORK ───────────────────────────────────
export async function getMyDesk(): Promise<
  DeskResult<{
    volunteerName: string;
    stationLabel: string;
    sessions: DeskSession[];
  }>
> {
  try {
    // Read-only screen, so the station check is relaxed here: a hospitality
    // volunteer may LOOK at the desk and is told plainly (by markDelegatePresent)
    // that they cannot mark. Writes still require a check-in station.
    const auth = await requireDeskVolunteer(false);
    if (!auth.ok) return { ok: false, error: auth.error };
    const { supabase, volunteer } = auth;

    const since = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();

    const base = () =>
      supabase
        .schema("future")
        .from("phase_events")
        .select("id, title, scheduled_at, venue, completed")
        .eq("chapter_id", volunteer.chapter_id)
        .eq("edition_id", volunteer.edition_id);

    let { data } = await base()
      .gte("scheduled_at", since)
      .order("scheduled_at", { ascending: true })
      .limit(25);

    // Nothing recent or upcoming → show the most recent past sessions instead
    // of an empty screen the volunteer cannot explain to anyone.
    if (!data || data.length === 0) {
      const fallback = await base()
        .order("scheduled_at", { ascending: false })
        .limit(10);
      data = fallback.data;
    }

    const sessions: DeskSession[] = (
      (data as unknown as {
        id: string;
        title: string | null;
        scheduled_at: string;
        venue: string | null;
        completed: boolean | null;
      }[]) ?? []
    ).map((s) => ({
      id: s.id,
      title: s.title ?? "Session",
      scheduled_at: s.scheduled_at,
      venue: s.venue,
      completed: !!s.completed,
    }));

    return {
      ok: true,
      data: {
        volunteerName: volunteer.full_name,
        stationLabel: stationLabel(volunteer.station),
        sessions,
      },
    };
  } catch (e) {
    return {
      ok: false,
      error: `Could not load your desk (${msg(e)}). Tap Retry.`,
    };
  }
}

// ─── ROSTER ─────────────────────────────────────────────────────────────────
/**
 * Bounded, row-cap-safe roster read.
 *
 * A chapter can hold thousands of delegates (Visakhapatnam 1,923 / Bhopal
 * 1,221 in Future 6.0), and PostgREST caps any single response at ~1000 rows.
 * So this NEVER fetches the whole chapter and counts it in JS — the two totals
 * come from exact head-only COUNT queries (uncapped), and only a bounded slice
 * of rows is ever transferred. A phone at a desk gets 60 names, not 2,000.
 */
export async function getDeskRoster(
  phaseEventId: string,
  query: string
): Promise<DeskResult<DeskRoster>> {
  try {
    const auth = await requireDeskVolunteer(false);
    if (!auth.ok) return { ok: false, error: auth.error };
    const { supabase, volunteer } = auth;

    const scope = await assertSessionInMyChapter(
      supabase,
      volunteer,
      phaseEventId
    );
    if (!scope.ok) return { ok: false, error: scope.error };

    const q = (query ?? "").trim();

    // Exact, uncapped counts.
    const { count: total } = await supabase
      .schema("future")
      .from("delegates")
      .select("id", { count: "exact", head: true })
      .eq("chapter_id", volunteer.chapter_id)
      .eq("edition_id", volunteer.edition_id)
      .eq("is_active", true);

    const { count: presentCount } = await supabase
      .schema("future")
      .from("phase_event_attendance")
      .select("delegate_id", { count: "exact", head: true })
      .eq("phase_event_id", phaseEventId)
      .eq("attended", true);

    // Bounded slice. One extra row tells us whether it is truncated.
    let listQuery = supabase
      .schema("future")
      .from("delegates")
      .select("id, full_name")
      .eq("chapter_id", volunteer.chapter_id)
      .eq("edition_id", volunteer.edition_id)
      .eq("is_active", true);

    if (q.length >= 2) {
      // Escape PostgREST/LIKE wildcards so a stray % cannot widen the match.
      const safe = q.replace(/[%_,()]/g, " ");
      listQuery = listQuery.ilike("full_name", `%${safe}%`);
    }

    const { data: delegateRows, error: listError } = await listQuery
      .order("full_name", { ascending: true })
      .order("id", { ascending: true })
      .limit(DESK_ROSTER_LIMIT + 1);

    if (listError) {
      return {
        ok: false,
        error: `Could not load the list (${listError.message}). Tap Retry.`,
      };
    }

    const found =
      (delegateRows as unknown as { id: string; full_name: string | null }[]) ??
      [];
    const truncated = found.length > DESK_ROSTER_LIMIT;
    const slice = truncated ? found.slice(0, DESK_ROSTER_LIMIT) : found;

    // Present flags for just the rendered slice (≤60 ids — no cap risk).
    const presentIds = new Set<string>();
    if (slice.length > 0) {
      const { data: att } = await supabase
        .schema("future")
        .from("phase_event_attendance")
        .select("delegate_id, attended")
        .eq("phase_event_id", phaseEventId)
        .in(
          "delegate_id",
          slice.map((d) => d.id)
        );
      for (const a of (att as unknown as {
        delegate_id: string;
        attended: boolean | null;
      }[]) ?? []) {
        if (a.attended) presentIds.add(a.delegate_id);
      }
    }

    const rows: DeskRosterRow[] = slice.map((d) => ({
      id: d.id,
      full_name: d.full_name ?? "(no name)",
      present: presentIds.has(d.id),
    }));

    return {
      ok: true,
      data: {
        total: total ?? 0,
        presentCount: presentCount ?? 0,
        rows,
        truncated,
      },
    };
  } catch (e) {
    return {
      ok: false,
      error: `Could not load the list (${msg(e)}). Tap Retry.`,
    };
  }
}

// ─── MARK ONE DELEGATE ──────────────────────────────────────────────────────
/**
 * Marks ONE delegate for ONE session. Deliberately single-row.
 *
 * The admin screen posts a bulk map of every rendered delegate, which is why a
 * dropped row there once wrote real attendees ABSENT. A desk cannot afford that
 * failure mode: here the write is a single upsert on the natural primary key
 * (phase_event_id, delegate_id), so
 *   • it is idempotent — retrying after a lost response converges, it never
 *     double-counts;
 *   • two volunteers marking the SAME delegate both write attended=true and
 *     neither corrupts the other (last write wins on the marker columns only);
 *   • two volunteers marking DIFFERENT delegates never touch each other's rows.
 *
 * BLOCKER A: marked_by (FK -> auth.users) is set explicitly NULL and the
 * volunteer is recorded in marked_by_volunteer_id (FK -> future.volunteers).
 * A BEFORE trigger keeps exactly one of the two set, so the audit question
 * "who marked this delegate present" always has one answer.
 */
export async function markDelegatePresent(
  phaseEventId: string,
  delegateId: string,
  present: boolean
): Promise<DeskResult<{ delegateId: string; present: boolean; name: string }>> {
  try {
    const auth = await requireDeskVolunteer(true); // station gate ON for writes
    if (!auth.ok) return { ok: false, error: auth.error };
    const { supabase, volunteer } = auth;

    const scope = await assertSessionInMyChapter(
      supabase,
      volunteer,
      phaseEventId
    );
    if (!scope.ok) return { ok: false, error: scope.error };

    const target = await assertDelegateInMyChapter(
      supabase,
      volunteer,
      delegateId
    );
    if (!target.ok) return { ok: false, error: target.error };

    const { error } = await supabase
      .schema("future")
      .from("phase_event_attendance")
      .upsert(
        {
          phase_event_id: phaseEventId,
          delegate_id: delegateId,
          attended: present,
          marked_at: new Date().toISOString(),
          marked_by: null,
          marked_by_volunteer_id: volunteer.id,
        } as never,
        { onConflict: "phase_event_id,delegate_id" }
      );

    if (error) {
      // 42703 = column does not exist → the migration has not been applied yet.
      // Say so instead of showing a raw Postgres string at a desk.
      const unapplied =
        error.code === "42703" ||
        /marked_by_volunteer_id/.test(error.message ?? "");
      return {
        ok: false,
        error: unapplied
          ? "Check-in is not switched on for this event yet. Tell your chapter chair the volunteer migration is not applied."
          : `Not saved (${error.message}). Tap the name again to retry.`,
      };
    }

    // Keep the chair's own attendance screen honest.
    revalidatePath(`/yi-future/chapter/journey/${phaseEventId}`);

    return {
      ok: true,
      data: { delegateId, present, name: target.fullName },
    };
  } catch (e) {
    return {
      ok: false,
      error: `Not saved (${msg(e)}). Tap the name again to retry.`,
    };
  }
}
