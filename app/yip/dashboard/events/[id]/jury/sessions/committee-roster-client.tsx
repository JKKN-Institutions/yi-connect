"use client";

import { useState } from "react";
import {
  setJurorCommittees,
  type CommitteeAssignmentRoster,
} from "@/app/yip/actions/committee-scores";
import { Check, Loader2, ShieldCheck } from "lucide-react";
import { INK, SAFFRON, SERIF } from "@/app/yip/me/credential-ui";

export function CommitteeRosterClient({
  eventId,
  roster,
}: {
  eventId: string;
  roster: CommitteeAssignmentRoster;
}) {
  const { jurors, committees } = roster;

  // juryId -> Set of committee_name (which committees that juror may score).
  const [assigned, setAssigned] = useState<Record<string, Set<string>>>(() => {
    const m: Record<string, Set<string>> = {};
    for (const j of jurors) m[j.id] = new Set<string>();
    for (const a of roster.assignments) {
      (m[a.jury_assignment_id] ??= new Set<string>()).add(a.committee_name);
    }
    return m;
  });
  const [savingId, setSavingId] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function persist(juryId: string, next: Set<string>, original: Set<string>) {
    setAssigned((prev) => ({ ...prev, [juryId]: next }));
    setSavingId(juryId);
    const res = await setJurorCommittees({
      eventId,
      juryAssignmentId: juryId,
      committeeNames: [...next],
    });
    setSavingId(null);
    if (!res.success) {
      setAssigned((prev) => ({ ...prev, [juryId]: original })); // revert
      setError(res.error);
      return;
    }
    setSavedId(juryId);
    setTimeout(() => setSavedId((s) => (s === juryId ? null : s)), 1500);
  }

  function toggle(juryId: string, committee: string) {
    setError(null);
    const original = assigned[juryId] ?? new Set<string>();
    const next = new Set(original);
    if (next.has(committee)) next.delete(committee);
    else next.add(committee);
    persist(juryId, next, original);
  }

  function toggleAll(juryId: string) {
    setError(null);
    const original = assigned[juryId] ?? new Set<string>();
    const all = committees.map((c) => c.committee_name);
    const hasAll = all.every((c) => original.has(c));
    persist(juryId, new Set(hasAll ? [] : all), original);
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[0.16em]" style={{ color: SAFFRON }}>JURY</p>
        <h2 className="mt-0.5 flex items-center gap-2 text-xl font-bold tracking-tight" style={{ ...SERIF, color: INK }}>
          <ShieldCheck className="size-5 text-[#FF9933]" />
          Committee assignments
        </h2>
        <p className="mt-1 text-sm text-gray-500">
          Tick the committees each judge will evaluate (or “All”). A judge can
          only score the committees ticked here. Set this before the event.
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {committees.length === 0 ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          No committees yet — run allocation first (committees come from
          participants&apos; committee assignments).
        </div>
      ) : jurors.length === 0 ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          No judges added yet — add them on the Jury page first.
        </div>
      ) : (
        <div className="space-y-3">
          {jurors.map((j) => {
            const set = assigned[j.id] ?? new Set<string>();
            const allOn = committees.every((c) => set.has(c.committee_name));
            return (
              <div key={j.id} className="rounded-xl border border-gray-200 bg-white p-4">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-gray-900">{j.jury_name}</p>
                    <p className="text-xs text-gray-500">
                      {set.size} of {committees.length} committees
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {savingId === j.id ? (
                      <span className="inline-flex items-center gap-1 text-xs text-gray-500">
                        <Loader2 className="size-3.5 animate-spin" /> Saving
                      </span>
                    ) : savedId === j.id ? (
                      <span className="inline-flex items-center gap-1 text-xs text-green-600">
                        <Check className="size-3.5" /> Saved
                      </span>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => toggleAll(j.id)}
                      disabled={savingId === j.id}
                      className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50
                        ${
                          allOn
                            ? "border-[#FF9933] bg-[#FF9933]/10 text-[#b9650f]"
                            : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
                        }`}
                    >
                      All
                    </button>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  {committees.map((c) => {
                    const checked = set.has(c.committee_name);
                    return (
                      <button
                        key={c.committee_name}
                        type="button"
                        onClick={() => toggle(j.id, c.committee_name)}
                        disabled={savingId === j.id}
                        className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50
                          ${
                            checked
                              ? "border-[#138808] bg-[#138808]/10 text-[#0b5e06]"
                              : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
                          }`}
                      >
                        {checked && <Check className="mr-1 inline size-3" />}
                        {c.committee_number != null ? `${c.committee_number} · ` : ""}
                        {c.committee_name}
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
