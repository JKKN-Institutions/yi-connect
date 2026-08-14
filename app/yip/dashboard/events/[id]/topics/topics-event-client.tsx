"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { BookOpen, CheckCircle2, Loader2 } from "lucide-react";
import { Badge } from "@/components/yip/ui/badge";
import { Button } from "@/components/yip/ui/button";
import { Card, CardContent } from "@/components/yip/ui/card";
import {
  setEventCommittees,
  setEventCommitteeCount,
  attributeCommitteeMinistry,
  setCommitteeWhatsappLink,
  type CommitteeTopicOption,
} from "@/app/yip/actions/events";
import type { EventCommittee } from "@/lib/yip/event-committees";
import { WHATSAPP_INVITE_HINT } from "@/lib/yip/whatsapp-links";

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
  slots,
  studentsBySlot,
}: {
  eventId: string;
  catalog: CommitteeTopicOption[];
  initialSelected: string[];
  /** This event's committees as numbered slots, 1..N. */
  slots: EventCommittee[];
  /** committee number → how many students already sit in it. */
  studentsBySlot: Record<number, number>;
  /** committee number (as text) → WhatsApp group invite link. */
  committeeWhatsapp: Record<string, string>;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [countInput, setCountInput] = useState(
    slots.length > 0 ? String(slots.length) : "5"
  );
  // Edited locally so a half-typed link is never saved on every keystroke; the
  // value is committed on blur or Enter.
  const [waDraft, setWaDraft] = useState<Record<number, string>>(() =>
    Object.fromEntries(
      slots.map((s2) => [s2.number, committeeWhatsapp[String(s2.number)] ?? ""])
    )
  );

  const anyAllocated = Object.values(studentsBySlot).some((n) => n > 0);

  function saveCount() {
    setError(null);
    setFlash(null);
    const n = Number(countInput);
    if (!Number.isInteger(n) || n < 1 || n > 40) {
      setError("Enter a whole number of committees between 1 and 40.");
      return;
    }
    startTransition(async () => {
      const res = await setEventCommitteeCount(eventId, n);
      if (!res.success) {
        setError(res.error);
        return;
      }
      setFlash(
        res.data.unassigned > 0
          ? `Now running ${res.data.count} committees. ${res.data.unassigned} student${
              res.data.unassigned === 1 ? " was" : "s were"
            } in a committee you removed — they are now unassigned, so place them from the Participants tab.`
          : `Now running ${res.data.count} committees. Students will be split across Committee 1–${res.data.count}.`
      );
      router.refresh();
    });
  }

  function saveWhatsapp(number: number) {
    const url = (waDraft[number] ?? "").trim();
    if (url === (committeeWhatsapp[String(number)] ?? "")) return; // unchanged
    setError(null);
    setFlash(null);
    startTransition(async () => {
      const res = await setCommitteeWhatsappLink(
        eventId,
        number,
        url === "" ? null : url
      );
      if (!res.success) {
        setError(res.error);
        return;
      }
      setFlash(
        res.data.saved
          ? `WhatsApp group saved for Committee ${number}. It goes out with the access-code emails.`
          : `WhatsApp group cleared for Committee ${number}.`
      );
      router.refresh();
    });
  }

  function attribute(number: number, ministry: string) {
    setError(null);
    setFlash(null);
    startTransition(async () => {
      const res = await attributeCommitteeMinistry(
        eventId,
        number,
        ministry === "" ? null : ministry
      );
      if (!res.success) {
        setError(res.error);
        return;
      }
      setFlash(
        ministry === ""
          ? `Committee ${number} has no ministry again.`
          : `Committee ${number} is now ${res.data.name}${
              res.data.moved > 0
                ? ` — ${res.data.moved} student${
                    res.data.moved === 1 ? "" : "s"
                  } updated`
                : ""
            }.`
      );
      router.refresh();
    });
  }
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

      {/* ─── 1. HOW MANY ────────────────────────────────────────────
          The number is what a student is told at allocation; the ministry is
          attributed to that number later. So a chapter can commit to "we run
          6 committees" long before it decides what any of them debate. */}
      <Card>
        <CardContent className="space-y-3 py-4">
          <div>
            <h3 className="text-sm font-bold text-[#1a1a3e]">
              How many committees will you run?
            </h3>
            <p className="mt-0.5 text-xs text-[#1a1a3e]/60">
              Students are split across Committee 1 to N at allocation. You can
              decide which ministry each number gets later — nothing here forces
              you to choose the subjects now.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="number"
              min={1}
              max={40}
              value={countInput}
              onChange={(e) => setCountInput(e.target.value)}
              disabled={pending}
              className="w-24 rounded-lg border border-[#1a1a3e]/20 px-3 py-2 text-sm disabled:opacity-50"
              aria-label="Number of committees"
            />
            <Button variant="outline" onClick={saveCount} disabled={pending}>
              {pending ? (
                <Loader2 className="size-4 mr-2 animate-spin" />
              ) : null}
              Set number of committees
            </Button>
            {anyAllocated && (
              <span className="text-xs text-[#1a1a3e]/50">
                Students are already placed — reducing this frees the ones in
                the committees you drop, and leaves everyone else where they are.
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ─── 2. THE NUMBERED COMMITTEES ─────────────────────────────── */}
      {slots.length > 0 && (
        <Card>
          <CardContent className="space-y-3 py-4">
            <div>
              <h3 className="text-sm font-bold text-[#1a1a3e]">
                Your committees
              </h3>
              <p className="mt-0.5 text-xs text-[#1a1a3e]/60">
                Attribute a ministry to each number whenever you are ready. The
                number never changes — students keep the committee they were
                given.
              </p>
            </div>
            <div className="grid gap-2">
              {slots.map((s) => {
                const topic =
                  catalog.find((c) => c.committee === s.name)?.topic ?? "";
                const students = studentsBySlot[s.number] ?? 0;
                return (
                  <div
                    key={s.number}
                    className="flex flex-wrap items-center gap-3 rounded-lg border border-[#1a1a3e]/10 bg-white px-3 py-2.5"
                  >
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[#FF9933]/10 text-sm font-bold text-[#FF9933]">
                      {s.number}
                    </span>
                    <div className="min-w-0 flex-1">
                      <select
                        value={s.unnamed ? "" : s.name}
                        onChange={(e) => attribute(s.number, e.target.value)}
                        disabled={pending}
                        className="w-full max-w-md rounded-lg border border-[#1a1a3e]/20 px-2.5 py-1.5 text-sm disabled:opacity-50"
                        aria-label={`Ministry for committee ${s.number}`}
                      >
                        <option value="">Not decided yet</option>
                        {catalog.map((c) => (
                          <option key={c.id} value={c.committee}>
                            {c.committee}
                          </option>
                        ))}
                      </select>
                      {topic && (
                        <p className="mt-1 text-xs text-[#1a1a3e]/60">{topic}</p>
                      )}
                      {/* This committee's WhatsApp group. Sent to its students
                          with their access code. Saved on blur or Enter, never
                          on every keystroke. */}
                      <input
                        type="url"
                        inputMode="url"
                        placeholder="WhatsApp group link (optional)"
                        value={waDraft[s.number] ?? ""}
                        onChange={(e) =>
                          setWaDraft((prev) => ({
                            ...prev,
                            [s.number]: e.target.value,
                          }))
                        }
                        onBlur={() => saveWhatsapp(s.number)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            saveWhatsapp(s.number);
                          }
                        }}
                        disabled={pending}
                        className="mt-1.5 w-full max-w-md rounded-lg border border-[#1a1a3e]/15 px-2.5 py-1.5 text-xs disabled:opacity-50"
                        aria-label={`WhatsApp group link for committee ${s.number}`}
                      />
                    </div>
                    <span className="shrink-0 text-xs text-[#1a1a3e]/50">
                      {students === 0
                        ? "no students yet"
                        : `${students} student${students === 1 ? "" : "s"}`}
                    </span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ─── 3. PICK THEM ALL AT ONCE (the original flow) ───────────── */}
      <div className="pt-1">
        <h3 className="text-sm font-bold text-[#1a1a3e]">
          Or pick all your ministries at once
        </h3>
        <p className="mt-0.5 mb-3 text-xs text-[#1a1a3e]/60">
          Choose the exact ministries you will run. This replaces the list
          above, so use it before students are placed into committees.
        </p>
      </div>

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
