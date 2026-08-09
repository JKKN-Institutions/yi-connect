"use client";

/**
 * Check-in list. Each tap saves ONE delegate.
 *
 * The previous version was a plain form that posted a snapshot of the entire
 * roster on submit, so two volunteers marking the same session on two devices
 * silently overwrote each other — the second submit flipped an already-present
 * delegate back to absent. The operating workaround was "one person, one device",
 * which does not survive a real event. Now every tap writes exactly one row.
 *
 * Failure handling is the point of this component, not an afterthought:
 *   - a throw  → the checkbox rolls BACK to the last server-confirmed value and
 *                the name turns red with the reason;
 *   - a hang   → a watchdog rejects at SAVE_TIMEOUT_MS and it is treated as a
 *                throw, so a tap can never sit on "Saving…" forever;
 *   - partial  → each name carries its own state, so a run of taps where some
 *                landed and some did not shows exactly which ones failed, and
 *                Refresh re-reads the server to settle any doubt.
 * The UI never shows a delegate as present while the write is known to have
 * failed.
 */

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setDelegateAttendance } from "@/app/yi-future/actions/attendance";

type Delegate = { id: string; full_name: string };

type AttendanceCheckInProps = {
  phaseEventId: string;
  delegates: Delegate[];
  /** Delegate ids the server read as present when this page was rendered. */
  initialAttendedIds: string[];
};

/**
 * A save that neither resolves nor rejects must still surface. Without this a
 * dropped connection at a venue leaves the row spinning and the volunteer moves
 * on believing it saved.
 */
const SAVE_TIMEOUT_MS = 12_000;

/** Same reasoning for the re-read: "Refreshing…" must not spin forever. */
const REFRESH_TIMEOUT_MS = 12_000;
const REFRESH_STUCK =
  "Refresh did not come back — you may be offline. The list below is from the last load that worked.";

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

export function AttendanceCheckIn({
  phaseEventId,
  delegates,
  initialAttendedIds,
}: AttendanceCheckInProps) {
  const router = useRouter();
  const [isRefreshing, startRefresh] = useTransition();

  // What the server last told us, and this device's confirmed changes on top of
  // it. Layering them (instead of copying props into state once) is what lets
  // Refresh pull in the OTHER device's marks without discarding our own.
  const serverAttended = useMemo(
    () => new Set(initialAttendedIds),
    [initialAttendedIds]
  );
  const [overrides, setOverrides] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState<Record<string, true>>({});
  const [failed, setFailed] = useState<Record<string, string>>({});

  const [refreshNote, setRefreshNote] = useState<string | null>(null);

  // Watchdog for the re-read. router.refresh() has no completion callback, so a
  // refresh that never returns would leave the button reading "Refreshing…"
  // forever. If the transition is still pending after REFRESH_TIMEOUT_MS, say so
  // and re-enable the button; the cleanup fires when it does come back, which
  // clears the note.
  useEffect(() => {
    if (!isRefreshing) return;
    const timer = setTimeout(() => setRefreshNote(REFRESH_STUCK), REFRESH_TIMEOUT_MS);
    return () => {
      clearTimeout(timer);
      setRefreshNote(null);
    };
  }, [isRefreshing]);

  const isPresent = (id: string) => overrides[id] ?? serverAttended.has(id);
  const presentCount = delegates.filter((d) => isPresent(d.id)).length;
  const failedIds = Object.keys(failed);

  /**
   * Re-read the server and let it settle every doubt: drop this device's
   * overrides (except rows still in flight) and clear the red flags, so after a
   * refresh every checkbox shows what is actually stored. That is the recovery
   * path for a half-succeeded save — e.g. a write that timed out on the client
   * but landed on the server anyway. Both updates run inside the transition, so
   * they commit together with the fresh data instead of flashing stale values.
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
      router.refresh();
    });
  }

  async function toggle(delegateId: string, next: boolean) {
    const previous = overrides[delegateId];

    // Optimistic: the checkbox moves now, the truth catches up.
    setOverrides((o) => ({ ...o, [delegateId]: next }));
    setSaving((s) => ({ ...s, [delegateId]: true }));
    setFailed((f) => omit(f, delegateId));

    try {
      const res = await withTimeout(
        setDelegateAttendance(phaseEventId, delegateId, next),
        SAVE_TIMEOUT_MS
      );
      if (!res.ok) throw new Error(res.error);
      // Saved. The override now matches the row in the database, so it stays —
      // dropping it here would snap the checkbox back to the stale server prop.
    } catch (err) {
      // Roll back to the last value we know the server had, so the list can
      // never claim "present" when the write did not land.
      setOverrides((o) =>
        previous === undefined
          ? omit(o, delegateId)
          : { ...o, [delegateId]: previous }
      );
      setFailed((f) => ({
        ...f,
        [delegateId]:
          err instanceof Error && err.message
            ? err.message
            : "Could not save — retry.",
      }));
    } finally {
      // Always releases the row, on success, throw, and timeout alike.
      setSaving((s) => omit(s, delegateId));
    }
  }

  return (
    <section className="bg-white border border-navy/10 rounded-lg p-5">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
        <h3 className="text-sm font-bold text-navy">Attendance</h3>
        <div className="flex items-center gap-3">
          <div className="text-xs font-semibold text-navy" aria-live="polite">
            {presentCount}/{delegates.length} present
          </div>
          <button
            type="button"
            onClick={refresh}
            disabled={isRefreshing && !refreshNote}
            className="px-2 py-1 rounded border border-navy/20 text-xs font-semibold text-navy hover:bg-navy/5 disabled:opacity-50"
          >
            {isRefreshing && !refreshNote ? "Refreshing…" : "Refresh"}
          </button>
        </div>
      </div>
      <p className="text-xs text-navy/50 mb-4">
        Each name saves on its own as you tap it. Two people can mark this session
        at the same time — tap Refresh to pull in the other device&apos;s marks.
      </p>

      {refreshNote && (
        <div
          role="alert"
          className="mb-3 rounded-md border border-yi-saffron bg-yi-saffron-light px-3 py-2 text-xs font-semibold text-navy"
        >
          {refreshNote}
        </div>
      )}

      {failedIds.length > 0 && (
        <div
          role="alert"
          className="mb-3 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700"
        >
          {failedIds.length} name{failedIds.length === 1 ? "" : "s"} did not save
          and {failedIds.length === 1 ? "is" : "are"} shown in red below —{" "}
          {failedIds.length === 1 ? "its" : "their"} attendance is NOT recorded.
          Tap {failedIds.length === 1 ? "it" : "them"} again to retry.
        </div>
      )}

      {delegates.length === 0 ? (
        <p className="text-sm text-navy/50 italic">
          No active delegates in your chapter yet.
        </p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {delegates.map((d) => {
            const busy = !!saving[d.id];
            const error = failed[d.id];
            return (
              <label
                key={d.id}
                className={`flex items-center gap-2 p-2 border rounded cursor-pointer ${
                  error
                    ? "border-red-400 bg-red-50"
                    : "border-navy/10 hover:bg-navy/5"
                } ${busy ? "opacity-60" : ""}`}
              >
                <input
                  type="checkbox"
                  checked={isPresent(d.id)}
                  disabled={busy}
                  aria-invalid={!!error}
                  aria-describedby={error ? `att-err-${d.id}` : undefined}
                  onChange={(e) => {
                    void toggle(d.id, e.target.checked);
                  }}
                  className="h-4 w-4 accent-yi-gold"
                />
                <span className="min-w-0 flex-1">
                  <span
                    className={`block text-sm truncate ${
                      error ? "font-semibold text-red-700" : "text-navy"
                    }`}
                  >
                    {d.full_name}
                  </span>
                  {busy && (
                    <span
                      role="status"
                      className="block text-[11px] text-navy/50"
                    >
                      Saving…
                    </span>
                  )}
                  {error && !busy && (
                    <span
                      id={`att-err-${d.id}`}
                      className="block text-[11px] font-semibold text-red-700"
                    >
                      Not saved — {error}
                    </span>
                  )}
                </span>
              </label>
            );
          })}
        </div>
      )}
    </section>
  );
}
