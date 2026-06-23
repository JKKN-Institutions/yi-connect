"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { BookOpen, CheckCircle2, Loader2 } from "lucide-react";
import { Badge } from "@/components/yip/ui/badge";
import { Button } from "@/components/yip/ui/button";
import { Card, CardContent } from "@/components/yip/ui/card";
import {
  setEventCommittees,
  type CommitteeTopicOption,
} from "@/app/yip/actions/events";

/**
 * Per-chapter committee picker. Each chapter chooses WHICH of the official 15
 * committees (and how many) it will run — the selection is saved as the event's
 * committee_topics and drives allocation's committee assignment. Replaces the
 * retired central/regional topic picker (that model was removed when the
 * platform moved to the 15-committee model).
 */
export function CommitteePickerClient({
  eventId,
  catalog,
  initialSelected,
}: {
  eventId: string;
  catalog: CommitteeTopicOption[];
  initialSelected: string[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(initialSelected)
  );

  const count = selected.size;
  const dirty =
    count !== initialSelected.length ||
    initialSelected.some((n) => !selected.has(n));

  function toggle(name: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
    setFlash(null);
  }

  function selectAll() {
    setSelected(new Set(catalog.map((c) => c.committee)));
    setFlash(null);
  }
  function clearAll() {
    setSelected(new Set());
    setFlash(null);
  }

  function save() {
    setError(null);
    setFlash(null);
    if (count === 0) {
      setError("Pick at least one committee for this chapter.");
      return;
    }
    startTransition(async () => {
      const res = await setEventCommittees(eventId, [...selected]);
      if (!res.success) {
        setError(res.error);
        return;
      }
      setFlash(
        `Saved — ${res.data.count} committee${
          res.data.count === 1 ? "" : "s"
        } for this chapter. Allocation will use these.`
      );
      router.refresh();
    });
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-xl font-bold text-[#1a1a3e]">
            <BookOpen className="size-5 text-[#FF9933]" />
            Committees
          </h2>
          <p className="mt-0.5 max-w-2xl text-sm text-[#1a1a3e]/60">
            Choose which committees this chapter will run — and how many. Each
            committee is a cross-party group of students assigned one topic.
            Allocation distributes students across exactly the committees you pick
            here. Recommended: 5 — you can pick more.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge
            className={
              count === 0
                ? "bg-red-50 text-red-700 border border-red-200"
                : "bg-[#138808]/10 text-[#138808] border border-[#138808]/20"
            }
          >
            {count} selected
          </Badge>
          <Button onClick={save} disabled={pending || !dirty}>
            {pending ? (
              <Loader2 className="size-4 mr-2 animate-spin" />
            ) : (
              <CheckCircle2 className="size-4 mr-2" />
            )}
            Save committees
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
            No committees in the catalogue yet. Ask an admin to seed them at
            Admin → Topics.
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
                  className={`flex items-start gap-3 rounded-lg border px-3 py-3 text-left transition disabled:opacity-60 ${
                    on
                      ? "border-[#138808]/40 bg-[#138808]/5"
                      : "border-[#1a1a3e]/10 bg-white hover:border-[#1a1a3e]/20"
                  }`}
                >
                  <span
                    className={`mt-0.5 flex size-5 shrink-0 items-center justify-center rounded border ${
                      on
                        ? "border-[#138808] bg-[#138808] text-white"
                        : "border-[#1a1a3e]/30 bg-white"
                    }`}
                  >
                    {on && <CheckCircle2 className="size-4" />}
                  </span>
                  <span className="min-w-0">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-bold text-[#1a1a3e]">
                        {c.committee}
                      </span>
                      <Badge className="bg-[#1a1a3e]/5 text-[#1a1a3e]/70 border border-[#1a1a3e]/10">
                        Committee
                      </Badge>
                    </span>
                    {c.topic && (
                      <span className="mt-0.5 block text-sm text-[#1a1a3e]/80">
                        {c.topic}
                      </span>
                    )}
                    {c.scheme && (
                      <span className="mt-0.5 block text-xs text-[#1a1a3e]/50">
                        Linked scheme: {c.scheme}
                      </span>
                    )}
                  </span>
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
