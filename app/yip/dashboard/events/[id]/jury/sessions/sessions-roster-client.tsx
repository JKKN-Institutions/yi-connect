"use client";

import { useState } from "react";
import Link from "next/link";
import {
  setJurorSessions,
  type SessionRoster,
} from "@/app/yip/actions/jury-sessions";
import { ArrowLeft, Check, Loader2, CalendarClock } from "lucide-react";

export function SessionRosterClient({
  eventId,
  roster,
}: {
  eventId: string;
  roster: SessionRoster;
}) {
  const { jurors, sessions } = roster;

  // juryId -> Set of agenda_item_id (which sessions that juror may score).
  const [assigned, setAssigned] = useState<Record<string, Set<string>>>(() => {
    const m: Record<string, Set<string>> = {};
    for (const j of jurors) m[j.id] = new Set<string>();
    for (const a of roster.assignments) {
      (m[a.jury_assignment_id] ??= new Set<string>()).add(a.agenda_item_id);
    }
    return m;
  });
  const [savingId, setSavingId] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function toggle(juryId: string, sessionId: string) {
    setError(null);
    const original = assigned[juryId] ?? new Set<string>();
    const next = new Set(original);
    if (next.has(sessionId)) next.delete(sessionId);
    else next.add(sessionId);

    // Optimistic update, then persist the juror's full set (replace-set).
    setAssigned((prev) => ({ ...prev, [juryId]: next }));
    setSavingId(juryId);
    const res = await setJurorSessions(eventId, juryId, [...next]);
    setSavingId(null);

    if (!res.success) {
      setAssigned((prev) => ({ ...prev, [juryId]: original })); // revert
      setError(res.error);
      return;
    }
    setSavedId(juryId);
    setTimeout(() => setSavedId((s) => (s === juryId ? null : s)), 1500);
  }

  return (
    <div className="mx-auto w-full max-w-3xl p-4 space-y-4">
      <div>
        <Link
          href={`/yip/dashboard/events/${eventId}/jury`}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft className="size-4" />
          Back to Jury
        </Link>
        <h1 className="mt-2 flex items-center gap-2 text-xl font-bold text-gray-900">
          <CalendarClock className="size-5 text-[#FF9933]" />
          Session assignments
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Tick the sessions each juror will score. A juror can only score the
          sessions ticked here — leave a juror with none and they can&apos;t score
          anything.
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {sessions.length === 0 ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          No scoreable sessions exist for this event yet.
        </div>
      ) : jurors.length === 0 ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          No jurors added yet — add jurors on the Jury page first.
        </div>
      ) : (
        <div className="space-y-3">
          {jurors.map((j) => {
            const set = assigned[j.id] ?? new Set<string>();
            return (
              <div
                key={j.id}
                className="rounded-xl border border-gray-200 bg-white p-4"
              >
                <div className="mb-3 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-gray-900">
                      {j.jury_name}
                    </p>
                    <p className="text-xs text-gray-500">
                      {set.size} of {sessions.length} sessions
                    </p>
                  </div>
                  <span className="shrink-0 text-xs">
                    {savingId === j.id ? (
                      <span className="inline-flex items-center gap-1 text-gray-500">
                        <Loader2 className="size-3.5 animate-spin" /> Saving
                      </span>
                    ) : savedId === j.id ? (
                      <span className="inline-flex items-center gap-1 text-green-600">
                        <Check className="size-3.5" /> Saved
                      </span>
                    ) : null}
                  </span>
                </div>

                <div className="flex flex-wrap gap-2">
                  {sessions.map((s) => {
                    const checked = set.has(s.id);
                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => toggle(j.id, s.id)}
                        disabled={savingId === j.id}
                        className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50
                          ${
                            checked
                              ? "border-[#138808] bg-[#138808]/10 text-[#0b5e06]"
                              : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
                          }`}
                        title={`Day ${s.day} · ${s.title}`}
                      >
                        {checked && <Check className="mr-1 inline size-3" />}
                        D{s.day} · {s.title}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
