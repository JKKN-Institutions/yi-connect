"use client";

import { useState, useMemo, useTransition } from "react";
import Link from "next/link";
import { markSpeechFinished } from "@/app/yip/actions/participants";
import { Card, CardContent } from "@/components/yip/ui/card";
import { Input } from "@/components/yip/ui/input";
import { ArrowLeft, Search, Check, Loader2, Mic } from "lucide-react";

type Speaker = {
  id: string;
  full_name: string;
  party_number: number | null;
  constituency_number: number | null;
  speech_finished: boolean;
};

function partyLabel(n: number | null): string {
  if (n == null) return "";
  return n >= 1 && n <= 26 ? `Party ${String.fromCharCode(64 + n)}` : `Party ${n}`;
}

export function SpeechesClient({
  eventId,
  eventName,
  roster,
}: {
  eventId: string;
  eventName: string;
  roster: Speaker[];
}) {
  const [items, setItems] = useState(roster);
  const [query, setQuery] = useState("");
  const [pendingOnly, setPendingOnly] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const total = items.length;
  const doneCount = items.filter((s) => s.speech_finished).length;
  const pct = total > 0 ? Math.round((doneCount / total) * 100) : 0;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items
      .filter((s) => (pendingOnly ? !s.speech_finished : true))
      .filter((s) => (q ? s.full_name.toLowerCase().includes(q) : true))
      .sort(
        (a, b) =>
          (a.constituency_number ?? 1e9) - (b.constituency_number ?? 1e9) ||
          a.full_name.localeCompare(b.full_name)
      );
  }, [items, query, pendingOnly]);

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
          Every delegate gives a 90-second speech. Tap a name to mark it done as
          they speak.
        </p>
      </div>

      {/* Progress */}
      <Card>
        <CardContent className="pt-5">
          <div className="flex items-center justify-between text-sm">
            <span className="font-semibold text-[#1a1a3e]">
              {doneCount} / {total} done
            </span>
            <span className="text-[#1a1a3e]/50">{pct}%</span>
          </div>
          <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-gray-100">
            <div
              className="h-full rounded-full bg-[#138808] transition-all"
              style={{ width: `${pct}%` }}
            />
          </div>
        </CardContent>
      </Card>

      {/* Search + filter */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
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
          {pendingOnly ? "Pending only" : "Show all"}
        </button>
      </div>

      {/* Roster */}
      <Card>
        <CardContent className="divide-y p-0">
          {filtered.length === 0 ? (
            <p className="p-8 text-center text-sm text-gray-400">
              {pendingOnly
                ? "Everyone's done — no pending speeches. 🎉"
                : "No students match your search."}
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
                  {s.party_number != null && (
                    <span className="block text-xs text-gray-400">
                      {partyLabel(s.party_number)}
                    </span>
                  )}
                </span>
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
