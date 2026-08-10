"use client";

// Chapter-admin locking on /yi-future/chapter/teams (field request 2026-08-10):
// a manual "Lock all" and a deadline that locks the chapter automatically.
//
// Locking is the destructive direction — it takes editing away from delegates
// mid-flight — so the manual button uses the same two-click pattern as
// "Unlock all", with the count on the button before the first click.
//
// The datetime-local input is read in the ADMIN'S OWN timezone and converted to
// an absolute instant before it is sent. A chapter chair setting "12 Aug 18:00"
// means six in the evening where they are, not UTC.

import { useState, useTransition } from "react";
import {
  freezeAllTeams,
  setTeamLockDeadline,
} from "@/app/yi-future/actions/team-invites";

type Result = { ok: true; message?: string } | { ok: false; error: string };

/** ISO instant -> value a datetime-local input accepts, in local time. */
function toLocalInputValue(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
}

export function TeamLockControls({
  unlockedCount,
  lockAt,
  appliedAt,
  lockedCount,
}: {
  unlockedCount: number;
  lockAt: string | null;
  appliedAt: string | null;
  lockedCount: number | null;
}) {
  const [armed, setArmed] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [when, setWhen] = useState<string>(toLocalInputValue(lockAt));
  const [scheduleMsg, setScheduleMsg] = useState<Result | null>(null);
  const [pending, startTransition] = useTransition();

  function lockAll() {
    setResult(null);
    startTransition(async () => {
      try {
        setResult(await freezeAllTeams());
      } catch {
        setResult({
          ok: false,
          error: "Couldn't lock the teams — check your connection and try again.",
        });
      }
      setArmed(false);
    });
  }

  function saveSchedule(clear: boolean) {
    setScheduleMsg(null);
    startTransition(async () => {
      try {
        // new Date(localValue).toISOString() converts from the admin's own
        // clock to an absolute instant.
        const iso = clear || !when ? null : new Date(when).toISOString();
        setScheduleMsg(await setTeamLockDeadline(iso));
        if (clear) setWhen("");
      } catch {
        setScheduleMsg({
          ok: false,
          error: "Couldn't save the deadline — check your connection.",
        });
      }
    });
  }

  return (
    <div className="bg-white border border-navy/10 rounded-lg p-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-bold text-navy">Lock teams</p>
          <p className="text-xs text-navy/50">
            A locked team can&apos;t change its members. Captains can lock their
            own team; this locks the whole chapter.
          </p>
        </div>

        {result ? (
          <p
            className={
              result.ok
                ? "text-xs font-semibold text-yi-green"
                : "text-xs font-semibold text-red-600"
            }
          >
            {result.ok ? (result.message ?? "Locked.") : result.error}
          </p>
        ) : unlockedCount > 0 ? (
          armed ? (
            <span className="inline-flex items-center gap-1.5">
              <button
                type="button"
                onClick={lockAll}
                disabled={pending}
                className="text-xs font-bold text-ivory bg-navy hover:bg-navy-dark rounded px-3 py-1.5 disabled:opacity-40"
              >
                {pending
                  ? "Locking…"
                  : `Yes, lock ${unlockedCount} team${unlockedCount === 1 ? "" : "s"}`}
              </button>
              <button
                type="button"
                onClick={() => setArmed(false)}
                disabled={pending}
                className="text-xs font-semibold text-navy/60 hover:text-navy px-2 py-1.5"
              >
                Cancel
              </button>
            </span>
          ) : (
            <button
              type="button"
              onClick={() => setArmed(true)}
              className="text-xs font-semibold text-navy hover:text-yi-gold border border-navy/20 rounded px-3 py-1.5"
            >
              🔒 Lock all ({unlockedCount})
            </button>
          )
        ) : (
          <span className="text-xs text-navy/40">Every team is locked</span>
        )}
      </div>

      <div className="border-t border-navy/10 pt-3">
        <label
          htmlFor="lock_at"
          className="block text-xs font-bold text-navy mb-1"
        >
          Lock automatically at
        </label>
        <div className="flex flex-wrap items-center gap-2">
          <input
            id="lock_at"
            type="datetime-local"
            value={when}
            onChange={(e) => setWhen(e.target.value)}
            className="px-2 py-1.5 border border-navy/20 rounded-md text-sm"
          />
          <button
            type="button"
            onClick={() => saveSchedule(false)}
            disabled={pending || !when}
            className="text-xs font-semibold text-navy hover:text-yi-gold border border-navy/20 rounded px-3 py-1.5 disabled:opacity-40"
          >
            Save
          </button>
          {lockAt && (
            <button
              type="button"
              onClick={() => saveSchedule(true)}
              disabled={pending}
              className="text-xs font-semibold text-navy/60 hover:text-navy px-2 py-1.5"
            >
              Remove
            </button>
          )}
          {scheduleMsg && (
            <span
              className={
                scheduleMsg.ok
                  ? "text-xs font-semibold text-yi-green"
                  : "text-xs font-semibold text-red-600"
              }
            >
              {scheduleMsg.ok
                ? (scheduleMsg.message ?? "Saved.")
                : scheduleMsg.error}
            </span>
          )}
        </div>

        <p className="mt-1.5 text-[11px] text-navy/50">
          {appliedAt
            ? `Ran ${new Date(appliedAt).toLocaleString()} — locked ${
                lockedCount ?? 0
              } team${lockedCount === 1 ? "" : "s"}. Teams you unlock now stay unlocked.`
            : lockAt
              ? `Every team in this chapter locks at ${new Date(
                  lockAt
                ).toLocaleString()}, including teams that aren't full. Checked every 5 minutes.`
              : "No automatic lock set. Teams stay editable until a captain locks their own team, or you lock them here."}
        </p>
      </div>
    </div>
  );
}
