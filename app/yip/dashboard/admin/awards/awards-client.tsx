"use client";

import { useState, useTransition } from "react";
import {
  updateAwardDefinition,
  type AwardDefinition,
} from "@/app/yip/actions/admin-awards";
import { Trophy, Users, Loader2, Check } from "lucide-react";

export function AwardsClient({
  initialAwards,
}: {
  initialAwards: AwardDefinition[];
}) {
  const [awards, setAwards] = useState(initialAwards);
  const [pending, startTransition] = useTransition();
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [flashKey, setFlashKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Local label drafts so typing doesn't save on every keystroke.
  const [labelDraft, setLabelDraft] = useState<Record<string, string>>({});

  function save(
    awardKey: string,
    patch: { label?: string; default_recipients?: number; is_active?: boolean }
  ) {
    setError(null);
    setBusyKey(awardKey);
    startTransition(async () => {
      const res = await updateAwardDefinition(awardKey, patch);
      setBusyKey(null);
      if (!res.success) {
        setError(res.error);
        return;
      }
      setAwards((prev) =>
        prev.map((a) => (a.award_key === awardKey ? res.data : a))
      );
      setFlashKey(awardKey);
      setTimeout(() => setFlashKey(null), 1500);
    });
  }

  return (
    <div className="mx-auto w-full max-w-4xl space-y-4 p-4">
      <div className="flex items-center gap-2">
        <Trophy className="size-5 text-[#FF9933]" />
        <h1 className="text-lg font-bold text-[#1a1a3e]">Awards</h1>
      </div>
      <p className="text-sm text-[#1a1a3e]/60">
        The {awards.length} Yi 2026 awards. Set how many recipients each gives
        (raise it to recognise more students), turn an award on or off, or rename
        it. Changes apply the next time results are computed. Each award&apos;s
        basis is fixed to the official workbook. A chapter can also override the
        recipient count on its own event from the event&apos;s Results page.
      </p>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="divide-y divide-[#1a1a3e]/10 rounded-xl border border-[#1a1a3e]/10 bg-white">
        {awards.map((a) => {
          const draft = labelDraft[a.award_key] ?? a.label;
          const rowBusy = busyKey === a.award_key && pending;
          return (
            <div
              key={a.award_key}
              className={`flex flex-col gap-2 px-4 py-3 transition-colors sm:flex-row sm:items-center ${
                a.is_active ? "" : "bg-[#1a1a3e]/[0.02] opacity-70"
              }`}
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <input
                    value={draft}
                    disabled={rowBusy}
                    onChange={(e) =>
                      setLabelDraft({
                        ...labelDraft,
                        [a.award_key]: e.target.value,
                      })
                    }
                    onBlur={() => {
                      if (draft.trim() && draft.trim() !== a.label)
                        save(a.award_key, { label: draft });
                    }}
                    className="min-w-0 flex-1 rounded-md border border-transparent bg-transparent px-1 py-0.5 text-sm font-semibold text-[#1a1a3e] hover:border-[#1a1a3e]/15 focus:border-[#FF9933] focus:outline-none"
                  />
                  {a.is_team && (
                    <span
                      title="Team award — the whole top committee co-wins; recipient count doesn't apply"
                      className="inline-flex shrink-0 items-center gap-0.5 rounded-full bg-[#138808]/10 px-1.5 py-0.5 text-[10px] font-semibold text-[#138808]"
                    >
                      <Users className="size-3" /> Team
                    </span>
                  )}
                  {flashKey === a.award_key && (
                    <Check className="size-4 shrink-0 text-[#138808]" />
                  )}
                  {rowBusy && (
                    <Loader2 className="size-4 shrink-0 animate-spin text-[#1a1a3e]/40" />
                  )}
                </div>
                <p className="mt-0.5 px-1 text-xs text-[#1a1a3e]/50">
                  {a.basis_description}
                </p>
              </div>

              <div className="flex shrink-0 items-center gap-4">
                {/* Recipients */}
                <label className="flex items-center gap-1.5 text-xs text-[#1a1a3e]/70">
                  <span>{a.is_team ? "Recipients" : "Top"}</span>
                  <input
                    type="number"
                    min={1}
                    max={50}
                    defaultValue={a.default_recipients}
                    disabled={rowBusy || a.is_team}
                    title={
                      a.is_team
                        ? "Team award — every member of the top committee co-wins"
                        : "How many students receive this award"
                    }
                    onBlur={(e) => {
                      const n = parseInt(e.target.value, 10);
                      if (
                        Number.isFinite(n) &&
                        n >= 1 &&
                        n <= 50 &&
                        n !== a.default_recipients
                      )
                        save(a.award_key, { default_recipients: n });
                    }}
                    className="w-14 rounded-md border border-[#1a1a3e]/15 px-2 py-1 text-center text-sm disabled:bg-[#1a1a3e]/5 disabled:text-[#1a1a3e]/40"
                  />
                </label>

                {/* On / off */}
                <button
                  type="button"
                  role="switch"
                  aria-checked={a.is_active}
                  aria-label={`${a.is_active ? "Disable" : "Enable"} ${a.label}`}
                  disabled={rowBusy}
                  onClick={() => save(a.award_key, { is_active: !a.is_active })}
                  className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:opacity-50 ${
                    a.is_active ? "bg-[#138808]" : "bg-gray-300"
                  }`}
                >
                  <span
                    className={`inline-block size-4 transform rounded-full bg-white shadow transition-transform ${
                      a.is_active ? "translate-x-6" : "translate-x-1"
                    }`}
                  />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
