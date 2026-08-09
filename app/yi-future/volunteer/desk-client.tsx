"use client";

/**
 * Yi-Future check-in desk — the screen a volunteer holds at the door.
 *
 * FAILURE PATH IS THE FEATURE. A desk that shows a spinner is worse than a desk
 * that shows an error, because the volunteer keeps tapping and the queue grows.
 * Every rule below exists for that reason:
 *
 *   1. Every async call is wrapped in withTimeout(). Nothing can hang forever.
 *   2. Every async IIFE inside an effect has BOTH a .catch() that releases the
 *      UI and a timeout, so a rejected promise can never leave the screen stuck.
 *   3. A timeout is NOT reported as a failure. The server action may already
 *      have written the row, so the tap goes AMBER ("not confirmed") with a
 *      Refresh button — never a green tick we cannot prove, never a rollback
 *      that hides a write that happened.
 *   4. An explicit ok:false rolls the optimistic tick back and prints the
 *      server's sentence on that row. No toast that scrolls away.
 *   5. One in-flight write per delegate. Double-tapping cannot fire twice.
 *   6. Offline is stated in words at the top of the screen and marks are
 *      blocked, because a silent queue that never flushes loses attendance.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  getMyDesk,
  getDeskRoster,
  markDelegatePresent,
} from "@/app/yi-future/actions/volunteer-desk";
import type { DeskRoster, DeskSession } from "@/lib/yi-future/volunteers";

const LOAD_TIMEOUT_MS = 12_000;
const MARK_TIMEOUT_MS = 10_000;

class TimeoutError extends Error {}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new TimeoutError("timeout")),
      ms
    );
    p.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e) => {
        clearTimeout(timer);
        reject(e);
      }
    );
  });
}

type RowState = "idle" | "saving" | "error" | "unconfirmed";

export function DeskClient({
  volunteerName,
  stationLabel,
  canMark,
}: {
  volunteerName: string;
  stationLabel: string;
  /** false when the volunteer's station does not serve check-in. */
  canMark: boolean;
}) {
  const [sessions, setSessions] = useState<DeskSession[] | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [deskError, setDeskError] = useState<string | null>(null);
  const [loadingDesk, setLoadingDesk] = useState(true);

  const [roster, setRoster] = useState<DeskRoster | null>(null);
  const [rosterError, setRosterError] = useState<string | null>(null);
  const [loadingRoster, setLoadingRoster] = useState(false);

  const [query, setQuery] = useState("");
  const [rowState, setRowState] = useState<Record<string, RowState>>({});
  const [rowError, setRowError] = useState<Record<string, string>>({});
  const inFlight = useRef<Set<string>>(new Set());

  const [online, setOnline] = useState(true);

  // ── Online / offline, stated in words ────────────────────────────────────
  useEffect(() => {
    setOnline(
      typeof navigator === "undefined" ? true : navigator.onLine !== false
    );
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener("online", up);
    window.addEventListener("offline", down);
    return () => {
      window.removeEventListener("online", up);
      window.removeEventListener("offline", down);
    };
  }, []);

  // ── Load the desk (who am I, which sessions) ─────────────────────────────
  const loadDesk = useCallback(() => {
    setLoadingDesk(true);
    setDeskError(null);
    let cancelled = false;

    (async () => {
      const res = await withTimeout(getMyDesk(), LOAD_TIMEOUT_MS);
      if (cancelled) return;
      if (!res.ok) {
        setDeskError(res.error);
        setLoadingDesk(false);
        return;
      }
      setSessions(res.data.sessions);
      // Preselect the session closest to now so the common case is zero taps.
      if (res.data.sessions.length > 0) {
        const now = Date.now();
        const nearest = [...res.data.sessions].sort(
          (a, b) =>
            Math.abs(new Date(a.scheduled_at).getTime() - now) -
            Math.abs(new Date(b.scheduled_at).getTime() - now)
        )[0];
        setSessionId((prev) => prev ?? nearest.id);
      }
      setLoadingDesk(false);
    })().catch((e) => {
      // Rule 2: release the UI. An unhandled rejection here is exactly how a
      // "Loading…" screen becomes permanent.
      if (cancelled) return;
      setDeskError(
        e instanceof TimeoutError
          ? "The desk did not respond in 12 seconds. Check the Wi-Fi, then tap Retry."
          : "Could not load your desk. Tap Retry."
      );
      setLoadingDesk(false);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const cleanup = loadDesk();
    return cleanup;
  }, [loadDesk]);

  // ── Load the roster for the chosen session (debounced on search) ─────────
  const loadRoster = useCallback(
    (sid: string, q: string) => {
      setLoadingRoster(true);
      setRosterError(null);
      let cancelled = false;

      (async () => {
        const res = await withTimeout(getDeskRoster(sid, q), LOAD_TIMEOUT_MS);
        if (cancelled) return;
        if (!res.ok) {
          setRosterError(res.error);
          setLoadingRoster(false);
          return;
        }
        setRoster(res.data);
        // A fresh read is the source of truth — clear stale row flags.
        setRowState({});
        setRowError({});
        setLoadingRoster(false);
      })().catch((e) => {
        if (cancelled) return;
        setRosterError(
          e instanceof TimeoutError
            ? "The list did not load in 12 seconds. Check the Wi-Fi, then tap Retry."
            : "Could not load the list. Tap Retry."
        );
        setLoadingRoster(false);
      });

      return () => {
        cancelled = true;
      };
    },
    []
  );

  useEffect(() => {
    if (!sessionId) return;
    const q = query.trim();
    const t = setTimeout(() => {
      loadRoster(sessionId, q);
    }, q.length > 0 ? 300 : 0);
    return () => clearTimeout(t);
  }, [sessionId, query, loadRoster]);

  // ── Mark one delegate ────────────────────────────────────────────────────
  async function toggle(delegateId: string, nextPresent: boolean) {
    if (!sessionId || !canMark) return;
    if (inFlight.current.has(delegateId)) return; // rule 5
    if (!online) {
      setRowError((m) => ({
        ...m,
        [delegateId]: "You are offline — nothing was saved.",
      }));
      setRowState((m) => ({ ...m, [delegateId]: "error" }));
      return;
    }

    inFlight.current.add(delegateId);
    setRowState((m) => ({ ...m, [delegateId]: "saving" }));
    setRowError((m) => {
      const next = { ...m };
      delete next[delegateId];
      return next;
    });

    // Optimistic flip.
    setRoster((r) =>
      r
        ? {
            ...r,
            presentCount: r.presentCount + (nextPresent ? 1 : -1),
            rows: r.rows.map((row) =>
              row.id === delegateId ? { ...row, present: nextPresent } : row
            ),
          }
        : r
    );

    try {
      const res = await withTimeout(
        markDelegatePresent(sessionId, delegateId, nextPresent),
        MARK_TIMEOUT_MS
      );
      if (res.ok) {
        setRowState((m) => ({ ...m, [delegateId]: "idle" }));
      } else {
        // Rule 4: roll the tick back, show the server's own sentence.
        setRoster((r) =>
          r
            ? {
                ...r,
                presentCount: r.presentCount + (nextPresent ? -1 : 1),
                rows: r.rows.map((row) =>
                  row.id === delegateId
                    ? { ...row, present: !nextPresent }
                    : row
                ),
              }
            : r
        );
        setRowState((m) => ({ ...m, [delegateId]: "error" }));
        setRowError((m) => ({ ...m, [delegateId]: res.error }));
      }
    } catch (e) {
      if (e instanceof TimeoutError) {
        // Rule 3: it may well have saved. Do NOT roll back and do NOT claim
        // success — flag it and push the volunteer to Refresh.
        setRowState((m) => ({ ...m, [delegateId]: "unconfirmed" }));
        setRowError((m) => ({
          ...m,
          [delegateId]: "No reply in 10s — tap Refresh to check if it saved.",
        }));
      } else {
        setRoster((r) =>
          r
            ? {
                ...r,
                presentCount: r.presentCount + (nextPresent ? -1 : 1),
                rows: r.rows.map((row) =>
                  row.id === delegateId
                    ? { ...row, present: !nextPresent }
                    : row
                ),
              }
            : r
        );
        setRowState((m) => ({ ...m, [delegateId]: "error" }));
        setRowError((m) => ({
          ...m,
          [delegateId]: "Network error — tap the name again to retry.",
        }));
      }
    } finally {
      inFlight.current.delete(delegateId);
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────
  const activeSession = sessions?.find((s) => s.id === sessionId) ?? null;

  return (
    <div className="min-h-screen bg-ivory">
      {/* Header */}
      <header className="sticky top-0 z-20 bg-white border-b border-navy/10 safe-top">
        <div className="max-w-2xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[10px] font-bold uppercase tracking-widest text-navy/40">
                Check-in Desk
              </div>
              <div className="font-bold text-navy truncate">
                {volunteerName}
              </div>
              <div className="text-xs text-navy/50">{stationLabel}</div>
            </div>
            {roster && (
              <div className="text-right shrink-0">
                <div className="text-2xl font-bold text-navy leading-none">
                  {roster.presentCount}
                </div>
                <div className="text-[10px] font-semibold uppercase tracking-widest text-navy/40">
                  of {roster.total} present
                </div>
              </div>
            )}
          </div>
        </div>

        {!online && (
          <div
            role="alert"
            className="bg-red-600 text-white text-center text-xs font-bold py-2 px-4"
          >
            You are OFFLINE. Nothing is being saved. Wait for the Wi-Fi, then
            mark again.
          </div>
        )}
        {!canMark && (
          <div
            role="alert"
            className="bg-amber-100 border-t border-amber-300 text-amber-900 text-center text-xs font-semibold py-2 px-4"
          >
            Your station is {stationLabel} — you can view the list but not mark
            anyone present. Ask your chapter chair to move you to the Check-in
            Desk.
          </div>
        )}
      </header>

      <main className="max-w-2xl mx-auto px-4 py-4 space-y-4">
        {/* Desk load state */}
        {loadingDesk && (
          <div className="bg-white border border-navy/10 rounded-lg p-6 text-center">
            <p className="text-sm text-navy/60">Loading your sessions…</p>
            <p className="mt-1 text-xs text-navy/40">
              If this is still here in 12 seconds you will get a Retry button.
            </p>
          </div>
        )}

        {deskError && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-sm font-semibold text-red-700">{deskError}</p>
            <button
              type="button"
              onClick={() => loadDesk()}
              className="mt-3 px-4 py-2 rounded-md bg-red-600 text-white text-sm font-bold"
            >
              Retry
            </button>
          </div>
        )}

        {/* Session picker */}
        {sessions && sessions.length === 0 && (
          <div className="bg-white border border-navy/10 rounded-lg p-6 text-center">
            <p className="text-sm font-semibold text-navy">
              Your chapter has no sessions yet.
            </p>
            <p className="mt-1 text-xs text-navy/50">
              The chapter chair has to create the session under Journey before
              anyone can be checked in.
            </p>
          </div>
        )}

        {sessions && sessions.length > 0 && (
          <div className="bg-white border border-navy/10 rounded-lg p-4">
            <label
              htmlFor="desk-session"
              className="block text-[10px] font-bold uppercase tracking-widest text-navy/40 mb-1"
            >
              Session
            </label>
            <select
              id="desk-session"
              value={sessionId ?? ""}
              onChange={(e) => setSessionId(e.target.value || null)}
              className="w-full px-3 py-3 border border-navy/20 rounded-md bg-white text-sm font-semibold text-navy"
            >
              <option value="">— pick the session —</option>
              {sessions.map((s) => (
                <option key={s.id} value={s.id}>
                  {new Date(s.scheduled_at).toLocaleString("en-IN", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}{" "}
                  · {s.title}
                  {s.completed ? " (completed)" : ""}
                </option>
              ))}
            </select>
            {activeSession?.venue && (
              <p className="mt-1 text-xs text-navy/50">
                {activeSession.venue}
              </p>
            )}
          </div>
        )}

        {/* Search + refresh */}
        {sessionId && (
          <div className="flex gap-2">
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Type a name to find them fast"
              aria-label="Search delegates by name"
              className="flex-1 px-4 py-3 border border-navy/20 rounded-md bg-white text-base"
            />
            <button
              type="button"
              onClick={() => loadRoster(sessionId, query.trim())}
              className="px-4 py-3 rounded-md border border-navy/20 text-sm font-bold text-navy bg-white"
            >
              Refresh
            </button>
          </div>
        )}

        {/* Roster load state */}
        {loadingRoster && (
          <p className="text-center text-sm text-navy/50 py-4">
            Loading the list…
          </p>
        )}

        {rosterError && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-sm font-semibold text-red-700">{rosterError}</p>
            <button
              type="button"
              onClick={() => sessionId && loadRoster(sessionId, query.trim())}
              className="mt-3 px-4 py-2 rounded-md bg-red-600 text-white text-sm font-bold"
            >
              Retry
            </button>
          </div>
        )}

        {/* Roster */}
        {roster && !loadingRoster && !rosterError && (
          <>
            {roster.truncated && (
              <p className="text-xs text-navy/50">
                Showing the first {roster.rows.length} names of {roster.total}.
                Type a name to find anyone else.
              </p>
            )}
            {roster.rows.length === 0 ? (
              <div className="bg-white border border-navy/10 rounded-lg p-6 text-center">
                <p className="text-sm font-semibold text-navy">
                  No delegate matches “{query}”.
                </p>
                <p className="mt-1 text-xs text-navy/50">
                  Check the spelling, or send them to the chapter chair — they
                  may not be registered.
                </p>
              </div>
            ) : (
              <ul className="space-y-2">
                {roster.rows.map((row) => {
                  const state = rowState[row.id] ?? "idle";
                  const err = rowError[row.id];
                  return (
                    <li key={row.id}>
                      <button
                        type="button"
                        disabled={!canMark || state === "saving"}
                        onClick={() => toggle(row.id, !row.present)}
                        aria-pressed={row.present}
                        className={`w-full text-left px-4 py-4 rounded-lg border-2 flex items-center justify-between gap-3 min-h-[64px] transition-colors disabled:opacity-60 ${
                          state === "error"
                            ? "border-red-400 bg-red-50"
                            : state === "unconfirmed"
                              ? "border-amber-400 bg-amber-50"
                              : row.present
                                ? "border-emerald-500 bg-emerald-50"
                                : "border-navy/15 bg-white"
                        }`}
                      >
                        <span className="font-semibold text-navy text-base">
                          {row.full_name}
                        </span>
                        <span className="text-xs font-bold uppercase tracking-wider shrink-0">
                          {state === "saving" ? (
                            <span className="text-navy/50">saving…</span>
                          ) : state === "unconfirmed" ? (
                            <span className="text-amber-700">not confirmed</span>
                          ) : state === "error" ? (
                            <span className="text-red-700">not saved</span>
                          ) : row.present ? (
                            <span className="text-emerald-700">✓ present</span>
                          ) : (
                            <span className="text-navy/40">tap to mark</span>
                          )}
                        </span>
                      </button>
                      {err && (
                        <p
                          role="alert"
                          className={`mt-1 px-1 text-xs font-semibold ${
                            state === "unconfirmed"
                              ? "text-amber-800"
                              : "text-red-700"
                          }`}
                        >
                          {err}
                        </p>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </>
        )}
      </main>

      <footer className="max-w-2xl mx-auto px-4 pb-10 pt-4">
        <p className="text-[11px] text-navy/40 text-center">
          Every tap saves on its own. If a name goes amber, tap Refresh to see
          what actually saved before marking it again.
        </p>
      </footer>
    </div>
  );
}
