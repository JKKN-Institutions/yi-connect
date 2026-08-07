"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Badge } from "@/components/yip/ui/badge";
import { Button } from "@/components/yip/ui/button";
import { Card, CardContent } from "@/components/yip/ui/card";
import {
  Landmark,
  ArrowLeft,
  CheckCircle2,
  Loader2,
  Plus,
  RotateCcw,
  X,
} from "lucide-react";
import { setCabinetMinistries } from "@/app/yip/actions/cabinet";
import type { CommitteeTopicOption } from "@/app/yip/actions/events";

/**
 * Per-event cabinet picker. Shows the full official ministry catalogue (same as
 * the Committees tab) and the organiser ticks which ones make up the cabinet —
 * name only. Organisers can also coin their own ministries for this event —
 * custom labels ride the same save flow (setCabinetMinistries is label-driven)
 * and flow into voting / Question Hour / projector via effectiveMinistries().
 * Saving stores the picked names as the per-event cabinet (and sets the cabinet
 * size to match). Picking none / Reset falls back to the default cabinet; other
 * events are unaffected.
 */
export function CabinetClient({
  eventId,
  catalog,
  initialSelected,
  defaultCount,
}: {
  eventId: string;
  catalog: CommitteeTopicOption[];
  initialSelected: string[];
  defaultCount: number;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(initialSelected)
  );
  // Saved labels that aren't catalogue rows are this event's custom ministries.
  const [customList, setCustomList] = useState<string[]>(() => {
    const catalogNames = new Set(catalog.map((c) => c.committee.toLowerCase()));
    return initialSelected.filter((n) => !catalogNames.has(n.toLowerCase()));
  });
  const [customInput, setCustomInput] = useState("");

  const count = selected.size;

  function toggle(name: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
    setFlash(null);
    setError(null);
  }

  function selectAll() {
    setSelected(new Set([...catalog.map((c) => c.committee), ...customList]));
    setFlash(null);
  }
  function clearAll() {
    setSelected(new Set());
    setCustomList([]);
    setFlash(null);
  }

  function addCustom() {
    const label = customInput.trim();
    setFlash(null);
    setError(null);
    if (!label) return;
    if (label.length > 60) {
      setError("Keep the ministry name under 60 characters.");
      return;
    }
    const lower = label.toLowerCase();
    const catalogMatch = catalog.find(
      (c) => c.committee.toLowerCase() === lower
    );
    if (catalogMatch) {
      // Already an official catalogue entry — just tick it instead.
      setSelected((prev) => new Set(prev).add(catalogMatch.committee));
      setCustomInput("");
      return;
    }
    if (customList.some((n) => n.toLowerCase() === lower)) {
      setError("That ministry is already in your custom list.");
      return;
    }
    if (count >= 30) {
      setError("That's too many ministries (max 30).");
      return;
    }
    setCustomList((prev) => [...prev, label]);
    setSelected((prev) => new Set(prev).add(label));
    setCustomInput("");
  }

  function removeCustom(name: string) {
    setCustomList((prev) => prev.filter((n) => n !== name));
    setSelected((prev) => {
      const next = new Set(prev);
      next.delete(name);
      return next;
    });
    setFlash(null);
    setError(null);
  }

  function save() {
    setError(null);
    setFlash(null);
    if (count === 0) {
      setError("Pick at least one ministry, or use Reset for the default cabinet.");
      return;
    }
    startTransition(async () => {
      const res = await setCabinetMinistries(eventId, [...selected]);
      if (!res.success) {
        setError(res.error ?? "Could not save.");
        return;
      }
      setFlash(`Saved — ${res.count} cabinet ministers for this event.`);
    });
  }

  function reset() {
    startTransition(async () => {
      setError(null);
      setFlash(null);
      const res = await setCabinetMinistries(eventId, []);
      if (!res.success) {
        setError(res.error ?? "Could not reset.");
        return;
      }
      setSelected(new Set());
      setCustomList([]);
      setFlash(`Reset to the default cabinet (${defaultCount} ministers).`);
    });
  }

  return (
    <div className="space-y-5">
      <Link
        href={`/yip/dashboard/events/${eventId}/control`}
        className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800"
      >
        <ArrowLeft className="size-4" /> Back to control
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-xl font-bold text-[#1a1a3e]">
            <Landmark className="size-5 text-[#FF9933]" />
            Cabinet ministries
          </h2>
          <p className="mt-0.5 max-w-2xl text-sm text-[#1a1a3e]/60">
            Choose which ministries make up the cabinet for this event. These are
            the posts students vote for and the Prime Minister picks from (the
            opposition mirrors them as shadow ministers). Pick none and Reset to
            use the default cabinet — other chapters are not affected.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge
            className={
              count === 0
                ? "bg-amber-50 text-amber-700 border border-amber-200"
                : "bg-[#138808]/10 text-[#138808] border border-[#138808]/20"
            }
          >
            {count} selected
          </Badge>
          <Button onClick={save} disabled={pending || count === 0}>
            {pending ? (
              <Loader2 className="size-4 mr-2 animate-spin" />
            ) : (
              <CheckCircle2 className="size-4 mr-2" />
            )}
            Save cabinet
          </Button>
          <Button variant="outline" onClick={reset} disabled={pending}>
            <RotateCcw className="size-4 mr-1" /> Reset to default
          </Button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}
      {flash && (
        <div className="rounded-lg border border-[#138808]/20 bg-[#138808]/10 px-3 py-2 text-sm text-[#138808]">
          {flash}
        </div>
      )}

      {catalog.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-[#1a1a3e]/60">
            No ministries in the catalogue yet. Ask an admin to seed them at
            Admin → Topics — or add your own below.
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="flex items-center gap-3 text-xs">
            <button
              type="button"
              onClick={selectAll}
              disabled={pending}
              className="text-[#FF9933] hover:underline disabled:opacity-50"
            >
              Select all {catalog.length}
            </button>
            <span className="text-[#1a1a3e]/30">·</span>
            <button
              type="button"
              onClick={clearAll}
              disabled={pending}
              className="text-[#1a1a3e]/60 hover:underline disabled:opacity-50"
            >
              Clear
            </button>
          </div>

          <div className="grid gap-2">
            {catalog.map((c) => {
              const on = selected.has(c.committee);
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => toggle(c.committee)}
                  disabled={pending}
                  className={`flex items-center gap-3 rounded-lg border px-3 py-3 text-left transition disabled:opacity-60 ${
                    on
                      ? "border-[#138808]/40 bg-[#138808]/5"
                      : "border-[#1a1a3e]/10 bg-white hover:border-[#1a1a3e]/20"
                  }`}
                >
                  <span
                    className={`flex size-5 shrink-0 items-center justify-center rounded border ${
                      on
                        ? "border-[#138808] bg-[#138808] text-white"
                        : "border-[#1a1a3e]/30 bg-white"
                    }`}
                  >
                    {on && <CheckCircle2 className="size-4" />}
                  </span>
                  <span className="text-sm font-bold text-[#1a1a3e]">
                    {c.committee}
                  </span>
                </button>
              );
            })}
          </div>
        </>
      )}

      <div className="space-y-2">
        <h3 className="text-sm font-bold text-[#1a1a3e]">
          Custom (this event)
        </h3>
        {customList.length > 0 && (
          <div className="grid gap-2">
            {customList.map((name) => (
              <div
                key={name}
                className="flex items-center gap-3 rounded-lg border border-[#138808]/40 bg-[#138808]/5 px-3 py-3"
              >
                <span className="flex size-5 shrink-0 items-center justify-center rounded border border-[#138808] bg-[#138808] text-white">
                  <CheckCircle2 className="size-4" />
                </span>
                <span className="min-w-0 flex-1 truncate text-sm font-bold text-[#1a1a3e]">
                  {name}
                </span>
                <button
                  type="button"
                  onClick={() => removeCustom(name)}
                  disabled={pending}
                  aria-label={`Remove ${name}`}
                  className="shrink-0 text-[#1a1a3e]/40 transition hover:text-red-600 disabled:opacity-50"
                >
                  <X className="size-4" />
                </button>
              </div>
            ))}
          </div>
        )}
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={customInput}
            onChange={(e) => setCustomInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addCustom();
              }
            }}
            maxLength={60}
            placeholder="Add your own ministry (e.g. Ministry of Space)"
            disabled={pending}
            className="w-full max-w-sm rounded-lg border border-[#1a1a3e]/15 bg-white px-3 py-2 text-sm text-[#1a1a3e] placeholder:text-[#1a1a3e]/35 focus:border-[#FF9933] focus:outline-none disabled:opacity-60"
          />
          <Button
            variant="outline"
            onClick={addCustom}
            disabled={pending || customInput.trim().length === 0}
          >
            <Plus className="size-4 mr-1" /> Add
          </Button>
        </div>
        <p className="text-xs text-[#1a1a3e]/50">
          Not in the official catalogue? Coin a ministry just for this event —
          it works in voting, Question Hour and the projector like any other.
          Remember to Save cabinet after adding.
        </p>
      </div>
    </div>
  );
}
