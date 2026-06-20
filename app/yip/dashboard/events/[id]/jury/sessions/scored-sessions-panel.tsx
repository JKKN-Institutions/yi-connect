"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  setSessionScoreable,
  type ScoringToggleSession,
} from "@/app/yip/actions/jury-sessions";
import { Check, Loader2, Star, AlertTriangle } from "lucide-react";

export function ScoredSessionsPanel({
  eventId,
  sessions,
}: {
  eventId: string;
  sessions: ScoringToggleSession[];
}) {
  const router = useRouter();
  const [savingId, setSavingId] = useState<string | null>(null);
  const [pendingOffId, setPendingOffId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function apply(sessionId: string, next: boolean) {
    setError(null);
    setPendingOffId(null);
    setSavingId(sessionId);
    const res = await setSessionScoreable(eventId, sessionId, next);
    setSavingId(null);
    if (!res.success) {
      setError(res.error);
      return;
    }
    // Re-pull server data so the assignment grid below reflects the new set.
    router.refresh();
  }

  function onToggle(s: ScoringToggleSession) {
    const next = !s.is_scoreable;
    // Turning OFF a session that already has scores → confirm first.
    if (!next && s.score_count > 0) {
      setPendingOffId(s.id);
      return;
    }
    apply(s.id, next);
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <div className="mb-1 flex items-center gap-2">
        <Star className="size-5 text-[#FF9933]" />
        <h2 className="text-lg font-bold text-gray-900">Scored sessions</h2>
      </div>
      <p className="mb-3 text-sm text-gray-500">
        Choose which sessions are scored in this event. The standard scoring
        scheme applies by default — switch a session off here if your chapter
        isn&apos;t scoring it. Only sessions that have scoring criteria set up can
        be switched on.
      </p>

      {error && (
        <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {sessions.length === 0 ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          No scoreable sessions are configured for this event&apos;s agenda.
        </div>
      ) : (
        <ul className="divide-y divide-gray-100">
          {sessions.map((s) => {
            const saving = savingId === s.id;
            const confirming = pendingOffId === s.id;
            const criteriaGone = !s.has_criteria && s.is_scoreable;
            return (
              <li key={s.id} className="flex items-center gap-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-gray-900">
                    <span className="text-gray-400">D{s.day} ·</span> {s.title}
                  </p>
                  <p className="text-xs text-gray-500">
                    {s.score_count > 0 && (
                      <span className="text-gray-600">
                        {s.score_count} score{s.score_count === 1 ? "" : "s"} recorded
                      </span>
                    )}
                    {criteriaGone && (
                      <span className="inline-flex items-center gap-1 text-amber-700">
                        <AlertTriangle className="size-3" /> criteria removed from
                        master — can only switch off
                      </span>
                    )}
                  </p>
                </div>

                {confirming ? (
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="text-xs text-amber-700">
                      Hide {s.score_count} score{s.score_count === 1 ? "" : "s"}?
                    </span>
                    <button
                      type="button"
                      onClick={() => apply(s.id, false)}
                      className="rounded-md bg-red-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-red-700"
                    >
                      Switch off
                    </button>
                    <button
                      type="button"
                      onClick={() => setPendingOffId(null)}
                      className="rounded-md border border-gray-200 px-2.5 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    role="switch"
                    aria-checked={s.is_scoreable}
                    aria-label={`Scoring for ${s.title}`}
                    disabled={saving}
                    onClick={() => onToggle(s)}
                    className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:opacity-50
                      ${s.is_scoreable ? "bg-[#138808]" : "bg-gray-300"}`}
                  >
                    {saving ? (
                      <Loader2 className="absolute left-1/2 size-3.5 -translate-x-1/2 animate-spin text-white" />
                    ) : (
                      <span
                        className={`inline-block size-4 transform rounded-full bg-white shadow transition-transform
                          ${s.is_scoreable ? "translate-x-6" : "translate-x-1"}`}
                      >
                        {s.is_scoreable && (
                          <Check className="size-3 text-[#138808] m-0.5" />
                        )}
                      </span>
                    )}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
