"use client";

import { useState, useMemo, useTransition } from "react";
import Link from "next/link";
import { markSpeechFinished } from "@/app/yip/actions/participants";
import { Card, CardContent } from "@/components/yip/ui/card";
import { Input } from "@/components/yip/ui/input";
import {
  ArrowLeft,
  Search,
  Check,
  Loader2,
  Mic,
  Gavel,
  UserX,
} from "lucide-react";

type Speaker = {
  id: string;
  full_name: string;
  party_number: number | null;
  constituency_number: number | null;
  speech_finished: boolean;
  // True when some YUVA volunteer's desk (party/committee) covers this delegate
  // — i.e. a volunteer can mark their speech. False = nobody but an organiser.
  covered: boolean;
  // Distinct jurors who have submitted a score for this delegate (0 = not yet).
  scoredJurors: number;
};

function partyLabel(n: number | null): string {
  if (n == null) return "";
  return n >= 1 && n <= 26 ? `Party ${String.fromCharCode(64 + n)}` : `Party ${n}`;
}

export function SpeechesClient({
  eventId,
  eventName,
  roster,
  hasVolunteers,
}: {
  eventId: string;
  eventName: string;
  roster: Speaker[];
  hasVolunteers: boolean;
}) {
  const [items, setItems] = useState(roster);
  const [query, setQuery] = useState("");
  const [pendingOnly, setPendingOnly] = useState(false);
  const [noVolunteerOnly, setNoVolunteerOnly] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const total = items.length;
  const doneCount = items.filter((s) => s.speech_finished).length;
  const pct = total > 0 ? Math.round((doneCount / total) * 100) : 0;
  const scoredCount = items.filter((s) => s.scoredJurors > 0).length;
  const uncoveredCount = hasVolunteers
    ? items.filter((s) => !s.covered).length
    : total;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items
      .filter((s) => (pendingOnly ? !s.speech_finished : true))
      .filter((s) => (noVolunteerOnly ? !s.covered : true))
      .filter((s) => (q ? s.full_name.toLowerCase().includes(q) : true))
      .sort(
        (a, b) =>
          (a.constituency_number ?? 1e9) - (b.constituency_number ?? 1e9) ||
          a.full_name.localeCompare(b.full_name)
      );
  }, [items, query, pendingOnly, noVolunteerOnly]);

  function toggle(s: Speaker) {
    if (savingId) return;
    const next = !s.speech_finished;
    setSavingId(s.id);
    // Optimistic update — revert if the server rejects.
    setItems((prev) =>
      prev.map((x) => (x.id === s.id ? { ...x, speech_finished: next } : x))
    );
    startTransition(async () => {
      const res = await markSpeechFinished(s.id, eventId, next);
      setSavingId(null);
      if (!res.success) {
        setItems((prev) =>
          prev.map((x) =>
            x.id === s.id ? { ...x, speech_finished: !next } : x
          )
        );
      }
    });
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4 px-4 py-6">
      {/* Header */}
      <div>
        <Link
          href={`/yip/dashboard/events/${eventId}`}
          className="mb-2 inline-flex items-center gap-1 text-xs text-[#1a1a3e]/60 hover:text-[#1a1a3e]"
        >
          <ArrowLeft className="size-3" /> {eventName}
        </Link>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-[#1a1a3e]">
          <Mic className="size-6 text-[#FF9933]" />
          90-Second Speeches
        </h1>
        <p className="mt-1 text-sm text-[#1a1a3e]/60">
          {hasVolunteers ? (
            <>
              YUVA volunteers normally mark speeches from their own desk (each
              covers their party / committee). This is your overview — and a
              fallback to mark a delegate&apos;s speech yourself when{" "}
              <span className="font-medium text-amber-700">no volunteer</span>{" "}
              covers them. It also shows whether the jury has scored each
              delegate.
            </>
          ) : (
            <>
              No YUVA volunteers are assigned to this event yet, so mark every
              delegate&apos;s 90-second speech here. This also shows whether the
              jury has scored each delegate.
            </>
          )}
        </p>
      </div>

      {/* Progress */}
      <Card>
        <CardContent className="space-y-3 pt-5">
          <div>
            <div className="flex items-center justify-between text-sm">
              <span className="font-semibold text-[#1a1a3e]">
                Speeches: {doneCount} / {total} done
              </span>
              <span className="text-[#1a1a3e]/50">{pct}%</span>
            </div>
            <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-gray-100">
              <div
                className="h-full rounded-full bg-[#138808] transition-all"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
            <span className="inline-flex items-center gap-1 text-[#1a1a3e]/70">
              <Gavel className="size-3.5 text-[#1a1a3e]/40" />
              Jury scored:{" "}
              <span className="font-semibold text-[#1a1a3e]">
                {scoredCount} / {total}
              </span>
            </span>
            {hasVolunteers && uncoveredCount > 0 && (
              <span className="inline-flex items-center gap-1 text-amber-700">
                <UserX className="size-3.5" />
                {uncoveredCount} have no volunteer — mark theirs here
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Search + filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[180px] flex-1">
          <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-gray-400" />
          <Input
            className="pl-8"
            placeholder="Search student…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <button
          type="button"
          onClick={() => setPendingOnly((v) => !v)}
          className={`shrink-0 rounded-md border px-3 py-2 text-xs font-medium ${
            pendingOnly
              ? "border-[#FF9933] bg-[#FF9933]/10 text-[#FF9933]"
              : "border-gray-200 text-gray-600 hover:bg-gray-50"
          }`}
        >
          Pending speeches
        </button>
        {hasVolunteers && (
          <button
            type="button"
            onClick={() => setNoVolunteerOnly((v) => !v)}
            className={`inline-flex shrink-0 items-center gap-1 rounded-md border px-3 py-2 text-xs font-medium ${
              noVolunteerOnly
                ? "border-amber-400 bg-amber-50 text-amber-700"
                : "border-gray-200 text-gray-600 hover:bg-gray-50"
            }`}
          >
            <UserX className="size-3.5" /> No volunteer
          </button>
        )}
      </div>

      {/* Roster */}
      <Card>
        <CardContent className="divide-y p-0">
          {filtered.length === 0 ? (
            <p className="p-8 text-center text-sm text-gray-400">
              {pendingOnly && items.every((s) => s.speech_finished)
                ? "Everyone's done — no pending speeches. 🎉"
                : "No delegates match your filters."}
            </p>
          ) : (
            filtered.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => toggle(s)}
                disabled={savingId === s.id}
                className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-gray-50 disabled:opacity-60"
              >
                <span className="w-10 shrink-0 font-mono text-xs text-gray-400">
                  {s.constituency_number ?? "—"}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-[#1a1a3e]">
                    {s.full_name}
                  </span>
                  <span className="mt-0.5 block text-xs">
                    {s.party_number != null && (
                      <span className="text-gray-400">
                        {partyLabel(s.party_number)}
                      </span>
                    )}
                    {s.party_number != null && (
                      <span className="text-gray-300"> · </span>
                    )}
                    {s.scoredJurors > 0 ? (
                      <span className="font-medium text-[#138808]">
                        Jury scored ({s.scoredJurors})
                      </span>
                    ) : (
                      <span className="text-gray-400">Not scored yet</span>
                    )}
                  </span>
                </span>
                {hasVolunteers && !s.covered && (
                  <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700">
                    <UserX className="size-3" /> No volunteer
                  </span>
                )}
                {savingId === s.id ? (
                  <Loader2 className="size-5 shrink-0 animate-spin text-gray-400" />
                ) : s.speech_finished ? (
                  <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[#138808]/10 px-2.5 py-1 text-xs font-medium text-[#138808]">
                    <Check className="size-3.5" /> Done
                  </span>
                ) : (
                  <span className="inline-flex shrink-0 items-center rounded-full border border-gray-200 px-2.5 py-1 text-xs font-medium text-gray-500">
                    Mark done
                  </span>
                )}
              </button>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
