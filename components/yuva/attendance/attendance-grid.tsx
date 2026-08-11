"use client";

/**
 * Attendance grid (Phase 11) — SHARED by the mentor session page and the
 * chapter/coordinator cohort page. Locked state renders read-only; the
 * surrounding page shows the lock banner.
 *
 * Every tap saves ONE learner (setLearnerAttendance). The previous version
 * staged marks locally and posted a snapshot of the WHOLE roster on Save, so
 * two staff marking the same session on two devices silently overwrote each
 * other — the second save flipped an already-present learner back to absent,
 * with no error shown to anybody. The workaround was "one person, one
 * device", which does not survive a real session.
 *
 * Failure handling is the point of this component, not an afterthought:
 *   - a throw   → the row rolls BACK to the last server-confirmed mark and
 *                 turns red with the reason;
 *   - a hang    → a watchdog rejects at SAVE_TIMEOUT_MS and it is handled
 *                 exactly like a throw, so a row can never sit on "Saving…"
 *                 forever;
 *   - partial   → every row carries its own state, so a run of taps where
 *                 some landed and some did not shows exactly which failed;
 *   - mark-all  → one bulk call; on failure every optimistic mark it set
 *                 rolls back and a banner names the reason.
 * Refresh re-reads the server to settle any doubt. The grid never shows a
 * learner as present while the write is known to have failed.
 */

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, RefreshCw, Users, X } from "lucide-react";
import {
  saveSessionAttendance,
  setLearnerAttendance,
} from "@/app/youth-academy/actions/attendance";
import type { SessionRosterRow } from "@/components/yuva/attendance/data";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * A save that neither resolves nor rejects must still surface. Without this a
 * dropped connection mid-session leaves the row spinning and the staff member
 * moves on believing it saved.
 */
const SAVE_TIMEOUT_MS = 12_000;
/** Mark-all writes up to a whole cohort, so it gets a longer leash. */
const BULK_TIMEOUT_MS = 20_000;
/** Same reasoning for the re-read: "Refreshing…" must not spin forever. */
const REFRESH_TIMEOUT_MS = 12_000;
const REFRESH_STUCK =
  "Refresh did not come back — you may be offline. The marks below are from the last load that worked.";

function withTimeout<T>(work: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error("Timed out — check your connection and retry.")),
      ms
    );
    work.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      }
    );
  });
}

function omit<T>(source: Record<string, T>, key: string): Record<string, T> {
  if (!(key in source)) return source;
  const next = { ...source };
  delete next[key];
  return next;
}

function reason(err: unknown, fallback: string): string {
  return err instanceof Error && err.message ? err.message : fallback;
}

export function AttendanceGrid({
  runSessionId,
  roster,
  locked = false,
}: {
  runSessionId: string;
  roster: SessionRosterRow[];
  /** Read-only render (post-completion lock with no active reopen). */
  locked?: boolean;
}) {
  const router = useRouter();
  const [isRefreshing, startRefresh] = useTransition();

  // What the server last told us, and this device's confirmed changes on top
  // of it. Layering them (instead of copying the roster into state once) is
  // what lets Refresh pull in the OTHER device's marks without discarding
  // ours — the old single-copy state also went stale on every router.refresh().
  const serverMarks = useMemo(
    () =>
      new Map<string, boolean | null>(
        roster.map((r) => [r.enrollment_id, r.present])
      ),
    [roster]
  );
  const [overrides, setOverrides] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState<Record<string, true>>({});
  const [failed, setFailed] = useState<Record<string, string>>({});
  const [bulkPending, setBulkPending] = useState(false);
  const [bulkError, setBulkError] = useState<string | null>(null);
  const [refreshNote, setRefreshNote] = useState<string | null>(null);

  // Watchdog for the re-read. router.refresh() has no completion callback, so
  // a refresh that never returns would leave the button reading "Refreshing…"
  // forever. If the transition is still pending after REFRESH_TIMEOUT_MS, say
  // so and re-enable the button; the cleanup fires when it does come back,
  // which clears the note.
  useEffect(() => {
    if (!isRefreshing) return;
    const timer = setTimeout(
      () => setRefreshNote(REFRESH_STUCK),
      REFRESH_TIMEOUT_MS
    );
    return () => {
      clearTimeout(timer);
      setRefreshNote(null);
    };
  }, [isRefreshing]);

  // null = not yet marked (no attendance row exists for this learner).
  const markOf = (enrollmentId: string): boolean | null =>
    overrides[enrollmentId] ?? serverMarks.get(enrollmentId) ?? null;

  const presentCount = roster.filter(
    (r) => markOf(r.enrollment_id) === true
  ).length;
  const unmarkedCount = roster.filter(
    (r) => markOf(r.enrollment_id) === null
  ).length;
  const failedIds = Object.keys(failed);

  if (roster.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-slate-300 p-8 text-center">
        <Users className="mx-auto size-6 text-slate-400" />
        <p className="mt-2 text-sm font-medium text-slate-700">
          No cohort yet
        </p>
        <p className="mt-1 text-sm text-slate-500">
          Attendance can be marked once the cohort is formed.
        </p>
      </div>
    );
  }

  /**
   * Re-read the server and let it settle every doubt: drop this device's
   * overrides (except rows still in flight) and clear the red flags, so after
   * a refresh every row shows what is actually stored. That is the recovery
   * path for a half-succeeded save — e.g. a write that timed out on the client
   * but landed on the server anyway. All the updates run inside the
   * transition, so they commit together with the fresh data instead of
   * flashing stale marks.
   */
  function refresh() {
    startRefresh(() => {
      setOverrides((current) => {
        const kept: Record<string, boolean> = {};
        for (const id of Object.keys(saving)) {
          if (id in current) kept[id] = current[id];
        }
        return kept;
      });
      setFailed({});
      setBulkError(null);
      router.refresh();
    });
  }

  /** Mark ONE learner. One row in, one row written — no roster snapshot. */
  async function markOne(enrollmentId: string, present: boolean) {
    if (locked) return;
    const previous = overrides[enrollmentId];

    // Optimistic: the pill moves now, the truth catches up.
    setOverrides((o) => ({ ...o, [enrollmentId]: present }));
    setSaving((s) => ({ ...s, [enrollmentId]: true }));
    setFailed((f) => omit(f, enrollmentId));

    try {
      const result = await withTimeout(
        setLearnerAttendance(runSessionId, enrollmentId, present),
        SAVE_TIMEOUT_MS
      );
      if (!result.success) throw new Error(result.error);
      // Saved. The override now matches the stored row, so it stays —
      // dropping it here would snap the pill back to the stale server prop.
    } catch (err) {
      // Roll back to the last value we know the server had, so the grid can
      // never claim "present" when the write did not land.
      setOverrides((o) =>
        previous === undefined
          ? omit(o, enrollmentId)
          : { ...o, [enrollmentId]: previous }
      );
      setFailed((f) => ({
        ...f,
        [enrollmentId]: reason(err, "Could not save — tap to retry."),
      }));
    } finally {
      // Always releases the row: on success, on throw, and on timeout alike.
      setSaving((s) => omit(s, enrollmentId));
    }
  }

  /**
   * Mark the whole roster in one call. Still the bulk action, which now writes
   * only the rows that actually change — but it IS a whole-roster snapshot, so
   * it can still overwrite a mark another device made since this page loaded.
   * That is the explicit intent of pressing "All present"/"All absent".
   */
  async function setAll(present: boolean) {
    if (locked || roster.length === 0) return;
    const rollback = overrides;

    setOverrides(
      Object.fromEntries(roster.map((r) => [r.enrollment_id, present]))
    );
    setFailed({});
    setBulkError(null);
    setBulkPending(true);

    try {
      const result = await withTimeout(
        saveSessionAttendance(
          runSessionId,
          roster.map((r) => ({ enrollment_id: r.enrollment_id, present }))
        ),
        BULK_TIMEOUT_MS
      );
      // A returned error means the action refused BEFORE writing (bad rows,
      // denied gate, active lock) or the single upsert statement itself
      // failed — either way nothing landed, so we can say so outright.
      if (!result.success) {
        setOverrides(rollback);
        setBulkError(`Nothing was saved — ${result.error}`);
        return;
      }
    } catch (err) {
      // A throw or a timeout is different: the write may well have landed and
      // only the reply was lost, so do NOT claim nothing changed. Roll the
      // optimistic marks back (never show a cohort present on a failed write)
      // and point at Refresh, which re-reads what is actually stored.
      setOverrides(rollback);
      setBulkError(
        `${reason(err, "Could not save.")} The marks below are back to their last confirmed values — tap Refresh to see what is stored.`
      );
    } finally {
      setBulkPending(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-slate-600" aria-live="polite">
          <span className="font-semibold text-slate-900">{presentCount}</span>{" "}
          of {roster.length} present
          {unmarkedCount > 0 && (
            <span className="text-slate-400"> · {unmarkedCount} unmarked</span>
          )}
        </p>
        <div className="flex items-center gap-2">
          {!locked && (
            <>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={bulkPending}
                onClick={() => void setAll(true)}
              >
                {bulkPending && <Loader2 className="size-4 animate-spin" />}
                All present
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={bulkPending}
                onClick={() => void setAll(false)}
              >
                {bulkPending && <Loader2 className="size-4 animate-spin" />}
                All absent
              </Button>
            </>
          )}
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isRefreshing && !refreshNote}
            onClick={refresh}
          >
            <RefreshCw
              className={cn(
                "size-4",
                isRefreshing && !refreshNote && "animate-spin"
              )}
            />
            {isRefreshing && !refreshNote ? "Refreshing…" : "Refresh"}
          </Button>
        </div>
      </div>

      {!locked && (
        <p className="text-xs text-slate-500">
          Each student saves on its own as you tap. Two people can mark this
          session at the same time — tap Refresh to pull in the other
          device&apos;s marks.
        </p>
      )}

      {refreshNote && (
        <div
          role="alert"
          className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-900"
        >
          {refreshNote}
        </div>
      )}

      {bulkError && (
        <div
          role="alert"
          className="rounded-md border border-rose-300 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-800"
        >
          {bulkError}
        </div>
      )}

      {failedIds.length > 0 && (
        <div
          role="alert"
          className="rounded-md border border-rose-300 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-800"
        >
          {failedIds.length} student{failedIds.length === 1 ? "" : "s"} did not
          save and {failedIds.length === 1 ? "is" : "are"} shown in red below.
          Tap {failedIds.length === 1 ? "that student" : "them"} again to retry,
          or tap Refresh to see what is stored.
        </div>
      )}

      <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white">
        {roster.map((row) => {
          const mark = markOf(row.enrollment_id);
          const busy = !!saving[row.enrollment_id] || bulkPending;
          const error = failed[row.enrollment_id];
          const disabled = locked || busy;
          return (
            <li
              key={row.enrollment_id}
              className={cn(
                "flex flex-wrap items-center justify-between gap-2 px-4 py-2.5",
                error && "bg-rose-50",
                busy && "opacity-60"
              )}
            >
              <div className="min-w-0">
                <p
                  className={cn(
                    "truncate text-sm font-medium",
                    error ? "text-rose-800" : "text-slate-900"
                  )}
                >
                  {row.full_name}
                </p>
                {row.institution_name && !error && (
                  <p className="truncate text-xs text-slate-500">
                    {row.institution_name}
                  </p>
                )}
                {busy && (
                  <p role="status" className="text-xs text-slate-500">
                    Saving…
                  </p>
                )}
                {error && !busy && (
                  <p
                    id={`att-err-${row.enrollment_id}`}
                    className="text-xs font-medium text-rose-700"
                  >
                    Not saved — {error}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => void markOne(row.enrollment_id, true)}
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                    mark === true
                      ? "border-emerald-300 bg-emerald-100 text-emerald-800"
                      : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50",
                    disabled && "cursor-not-allowed opacity-60"
                  )}
                  aria-pressed={mark === true}
                  aria-describedby={
                    error ? `att-err-${row.enrollment_id}` : undefined
                  }
                >
                  <Check className="size-3.5" />
                  Present
                </button>
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => void markOne(row.enrollment_id, false)}
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                    mark === false
                      ? "border-rose-300 bg-rose-100 text-rose-800"
                      : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50",
                    disabled && "cursor-not-allowed opacity-60"
                  )}
                  aria-pressed={mark === false}
                  aria-describedby={
                    error ? `att-err-${row.enrollment_id}` : undefined
                  }
                >
                  <X className="size-3.5" />
                  Absent
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
