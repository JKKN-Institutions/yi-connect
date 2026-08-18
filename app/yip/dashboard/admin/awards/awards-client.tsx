"use client";

import { useState, useTransition } from "react";
import {
  updateAwardDefinition,
  type AwardDefinition,
} from "@/app/yip/actions/admin-awards";
import {
  ROUND_LEVELS,
  ROUND_LEVEL_LABELS,
  describeRoundLevels,
  type RoundLevel,
} from "@/lib/yip/round-level";
import { Trophy, Users, Loader2, Check } from "lucide-react";

export function AwardsClient({
  initialAwards,
}: {
  initialAwards: AwardDefinition[];
}) {
  const [awards, setAwards] = useState(initialAwards);
  const [pending, startTransition] = useTransition();
  // An award_key is no longer unique — the same award can exist once for chapter
  // rounds and again for regional ones — so every piece of per-row state is
  // keyed by the row id, and so is every save.
  const [busyId, setBusyId] = useState<string | null>(null);
  const [flashId, setFlashId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Local label drafts so typing doesn't save on every keystroke.
  const [labelDraft, setLabelDraft] = useState<Record<string, string>>({});
  const [levelFilter, setLevelFilter] = useState<"all" | RoundLevel>("all");

  function save(
    id: string,
    patch: {
      label?: string;
      default_recipients?: number;
      is_active?: boolean;
      levels?: string[] | null;
    }
  ) {
    setError(null);
    setBusyId(id);
    startTransition(async () => {
      const res = await updateAwardDefinition(id, patch);
      setBusyId(null);
      if (!res.success) {
        setError(res.error);
        return;
      }
      setAwards((prev) => prev.map((a) => (a.id === id ? res.data : a)));
      setFlashId(id);
      setTimeout(() => setFlashId(null), 1500);
    });
  }

  /** Toggle one level on an award. Nothing selected = every round. */
  function toggleLevel(a: AwardDefinition, l: RoundLevel) {
    const current = a.levels ?? [];
    const next = current.includes(l)
      ? current.filter((x) => x !== l)
      : [...current, l];
    save(a.id, { levels: next });
  }

  // Show only the awards a given round would hand out. An every-round award is
  // shown under every filter — it is the fallback each level inherits.
  const visible =
    levelFilter === "all"
      ? awards
      : awards.filter(
          (a) => !a.levels?.length || a.levels.includes(levelFilter)
        );

  // Group by scope so a growing catalogue stays legible: the shared awards
  // first, then each level's own set.
  const groups = [
    {
      key: "*",
      title: "Every round",
      rows: visible.filter((a) => !a.levels?.length),
    },
    ...ROUND_LEVELS.map((l) => ({
      key: l,
      title: `${ROUND_LEVEL_LABELS[l]} rounds only`,
      rows: visible.filter((a) => a.levels?.length === 1 && a.levels[0] === l),
    })),
    {
      key: "multi",
      title: "Shared by some rounds",
      rows: visible.filter((a) => (a.levels?.length ?? 0) > 1),
    },
  ].filter((g) => g.rows.length > 0);

  return (
    <div className="mx-auto w-full max-w-4xl space-y-4 p-4">
      <div className="flex items-center gap-2">
        <Trophy className="size-5 text-[#FF9933]" />
        <h1 className="text-lg font-bold text-[#1a1a3e]">Awards</h1>
      </div>
      <p className="text-sm text-[#1a1a3e]/60">
        The {awards.length} Yi 2026 awards. Set how many recipients each gives
        (raise it to recognise more students), turn an award on or off, or rename
        it. Changes apply the next time results are computed. A chapter can also
        override the recipient count on its own event from the event&apos;s
        Results page.
      </p>
      <p className="text-sm text-[#1a1a3e]/60">
        An award applies to <strong>every round</strong> unless you restrict it
        to chapter, regional or national rounds. A round that has awards of its
        own hands out <strong>only</strong> those; every other round falls back
        to the every-round list.
      </p>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Which rounds to show */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-[#1a1a3e]/50">
          Show awards given at
        </span>
        {(["all", ...ROUND_LEVELS] as const).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setLevelFilter(f)}
            className={`rounded-full border px-3 py-1 text-xs font-medium ${
              levelFilter === f
                ? "border-[#1a1a3e] bg-[#1a1a3e] text-white"
                : "border-gray-300 text-gray-600 hover:bg-gray-50"
            }`}
          >
            {f === "all" ? "All rounds" : `${ROUND_LEVEL_LABELS[f]} rounds`}
          </button>
        ))}
      </div>

      {groups.length === 0 && (
        <p className="rounded-xl border border-dashed border-[#1a1a3e]/15 px-4 py-6 text-center text-sm text-[#1a1a3e]/50">
          No awards are given at those rounds yet.
        </p>
      )}

      {groups.map((g) => (
      <section key={g.key}>
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#1a1a3e]/40">
          {g.title}{" "}
          <span className="font-normal normal-case tracking-normal">
            ({g.rows.length})
          </span>
        </h2>
      <div className="divide-y divide-[#1a1a3e]/10 rounded-xl border border-[#1a1a3e]/10 bg-white">
        {g.rows.map((a) => {
          const draft = labelDraft[a.id] ?? a.label;
          const rowBusy = busyId === a.id && pending;
          return (
            <div
              key={a.id}
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
                        [a.id]: e.target.value,
                      })
                    }
                    onBlur={() => {
                      if (draft.trim() && draft.trim() !== a.label)
                        save(a.id, { label: draft });
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
                  {/* Scope badge — which rounds hand this award out */}
                  <span
                    title={
                      a.levels?.length
                        ? `Given only at ${describeRoundLevels(a.levels)} rounds`
                        : "Given at chapter, regional and national rounds alike"
                    }
                    className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium ${
                      a.levels?.length
                        ? "bg-[#1a1a3e]/10 text-[#1a1a3e]"
                        : "bg-[#FF9933]/10 text-[#B35C00]"
                    }`}
                  >
                    {describeRoundLevels(a.levels)}
                  </span>
                  {flashId === a.id && (
                    <Check className="size-4 shrink-0 text-[#138808]" />
                  )}
                  {rowBusy && (
                    <Loader2 className="size-4 shrink-0 animate-spin text-[#1a1a3e]/40" />
                  )}
                </div>
                <p className="mt-0.5 px-1 text-xs text-[#1a1a3e]/50">
                  {a.basis_description}
                </p>

                {/* Round-level scope. Nothing selected = applies everywhere,
                    which is what every award meant before this control. */}
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5 px-1">
                  <span className="text-[11px] font-medium text-[#1a1a3e]/50">
                    Applies to
                  </span>
                  <button
                    type="button"
                    disabled={rowBusy}
                    onClick={() => save(a.id, { levels: [] })}
                    className={`rounded-full border px-2 py-0.5 text-[11px] font-medium disabled:opacity-50 ${
                      !a.levels?.length
                        ? "border-[#FF9933] bg-[#FF9933]/10 text-[#B35C00]"
                        : "border-gray-300 text-gray-600 hover:bg-gray-50"
                    }`}
                  >
                    Every round
                  </button>
                  {ROUND_LEVELS.map((l) => (
                    <button
                      key={l}
                      type="button"
                      disabled={rowBusy}
                      onClick={() => toggleLevel(a, l)}
                      className={`rounded-full border px-2 py-0.5 text-[11px] font-medium disabled:opacity-50 ${
                        a.levels?.includes(l)
                          ? "border-[#1a1a3e] bg-[#1a1a3e]/5 text-[#1a1a3e]"
                          : "border-gray-300 text-gray-600 hover:bg-gray-50"
                      }`}
                    >
                      {ROUND_LEVEL_LABELS[l]}
                    </button>
                  ))}
                </div>
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
                        save(a.id, { default_recipients: n });
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
                  onClick={() => save(a.id, { is_active: !a.is_active })}
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
      </section>
      ))}
    </div>
  );
}
