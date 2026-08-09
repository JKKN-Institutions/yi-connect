"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient, createServiceClient } from "@/lib/yi-future/supabase/server";
import { fetchAllRows } from "@/lib/pagination";
import type { ActionResult } from "./editions";
import { requireChapterAdmin } from "@/lib/yi-future/auth/require-access";

type PhaseEventScope = {
  userId: string;
  /** null only when the phase_event row does not exist → treat as deny. */
  chapterId: string | null;
};

type StoredAttendance = { delegate_id: string; attended: boolean | null };

/**
 * Attendance hangs off a phase_event → resolve THAT session's chapter so a
 * chair of chapter A cannot mark attendance on chapter B's session. Fails
 * closed: an unresolvable chapter denies every non-national caller.
 *
 * Returns the session's chapter alongside the caller so per-delegate writes can
 * also check the delegate is in that chapter (the delegate id is supplied by the
 * client on every toggle, so it cannot be trusted on its own).
 */
async function requirePhaseEventChapterAdmin(
  phaseEventId: string
): Promise<PhaseEventScope> {
  const svc = await createServiceClient();
  const { data } = await svc
    .schema("future")
    .from("phase_events")
    .select("chapter_id")
    .eq("id", phaseEventId)
    .maybeSingle();
  const chapterId =
    (data as { chapter_id: string | null } | null)?.chapter_id ?? null;
  const access = await requireChapterAdmin(chapterId);
  return { userId: access.userId, chapterId };
}

/** Read every stored attendance row for one session, past the ~1000-row cap. */
async function readStoredAttendance(
  phaseEventId: string
): Promise<Map<string, boolean>> {
  const svc = await createServiceClient();
  // Paginated: a large chapter's roster exceeds PostgREST's ~1000-row cap, and a
  // row dropped here would read as "never marked" and get rewritten as absent —
  // the exact bug the cap already caused on this page once.
  const rows = await fetchAllRows<StoredAttendance>((from, to) =>
    svc
      .schema("future")
      .from("phase_event_attendance")
      .select("delegate_id, attended")
      .eq("phase_event_id", phaseEventId)
      .order("delegate_id", { ascending: true })
      .range(from, to) as unknown as PromiseLike<{
      data: StoredAttendance[] | null;
      error: unknown;
    }>
  );
  return new Map(rows.map((r) => [r.delegate_id, r.attended === true]));
}

// ─── MARK ONE DELEGATE ──────────────────────────────────────────────
/**
 * Check ONE delegate in or out. This is the write path the check-in UI uses.
 *
 * Why it exists: the bulk path below posts a snapshot of the whole roster, so two
 * volunteers marking the same session on two devices silently clobbered each
 * other — the second device's stale snapshot flipped an already-present delegate
 * back to absent. (phase_event_id, delegate_id) is the table's key, so a one-row
 * upsert touches only the delegate that was actually tapped and the two devices
 * no longer fight.
 *
 * Deliberately does NOT revalidatePath: at a live event with a four-figure roster
 * every tap would re-run the page's full delegate + attendance reads. The caller
 * holds its own view and offers an explicit Refresh instead.
 */
export async function setDelegateAttendance(
  phaseEventId: string,
  delegateId: string,
  attended: boolean
): Promise<ActionResult> {
  if (!phaseEventId || !delegateId) {
    return { ok: false, error: "Missing session or delegate." };
  }

  // Same gate as the bulk path — chapter-scoped, fails closed, denies explicitly.
  const scope = await requirePhaseEventChapterAdmin(phaseEventId);
  const svc = await createServiceClient();

  // The delegate id arrives from the client on every tap, so confirm it belongs
  // to THIS session's chapter. Fails closed: a missing delegate, a delegate with
  // no chapter, an unresolvable session chapter, or a mismatch all DENY — none of
  // them fall through to the write.
  const { data: delRow, error: delErr } = await svc
    .schema("future")
    .from("delegates")
    .select("id, chapter_id")
    .eq("id", delegateId)
    .maybeSingle();
  if (delErr) return { ok: false, error: delErr.message };
  const delegate = delRow as { id: string; chapter_id: string | null } | null;
  if (!delegate) return { ok: false, error: "Delegate not found." };
  if (
    !scope.chapterId ||
    !delegate.chapter_id ||
    delegate.chapter_id !== scope.chapterId
  ) {
    return {
      ok: false,
      error: "That delegate is not in this session's chapter.",
    };
  }

  const { error } = await svc
    .schema("future")
    .from("phase_event_attendance")
    .upsert(
      {
        phase_event_id: phaseEventId,
        delegate_id: delegateId,
        attended,
        marked_at: new Date().toISOString(),
        marked_by: scope.userId,
      },
      { onConflict: "phase_event_id,delegate_id" }
    );
  if (error) return { ok: false, error: error.message };

  return { ok: true, message: attended ? "Marked present." : "Marked absent." };
}

// ─── BULK UPDATE ATTENDANCE ─────────────────────────────────────────
/**
 * Bulk path, kept for callers that hold a whole-roster map. Now writes only the
 * rows whose value actually CHANGES, so a concurrent per-delegate mark is no
 * longer overwritten by a stale snapshot of the rest of the roster.
 */
export async function saveAttendance(
  eventId: string,
  attended: Record<string, boolean>
): Promise<ActionResult> {
  const scope = await requirePhaseEventChapterAdmin(eventId);
  const svc = await createServiceClient();

  const wanted = Object.entries(attended);
  if (wanted.length === 0) return { ok: true };

  const stored = await readStoredAttendance(eventId);
  const markedAt = new Date().toISOString();

  const rows = wanted
    .filter(([delegateId, isAttended]) => {
      const current = stored.get(delegateId);
      // No stored row: "absent" is already the truth every reader sees (each one
      // counts a delegate only when attended === true, so a missing row and
      // attended=false are identical) → nothing to write.
      if (current === undefined) return isAttended;
      return current !== isAttended;
    })
    .map(([delegate_id, isAttended]) => ({
      phase_event_id: eventId,
      delegate_id,
      attended: isAttended,
      marked_at: markedAt,
      marked_by: scope.userId,
    }));

  if (rows.length === 0) {
    revalidatePath(`/yi-future/chapter/journey/${eventId}`);
    return { ok: true, message: "No changes to save." };
  }

  // Upsert: existing rows update, new rows insert
  const { error } = await svc
    .schema("future")
    .from("phase_event_attendance")
    .upsert(rows, { onConflict: "phase_event_id,delegate_id" });
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/yi-future/chapter/journey/${eventId}`);
  return {
    ok: true,
    message: `Attendance saved (${rows.length} change${
      rows.length === 1 ? "" : "s"
    }).`,
  };
}
