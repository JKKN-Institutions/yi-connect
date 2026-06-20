"use client";

import { useState, useTransition } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/yip/ui/dialog";
import { Button } from "@/components/yip/ui/button";
import { Input } from "@/components/yip/ui/input";
import { ShieldOff, AlertTriangle, Loader2 } from "lucide-react";
import { listChapterEventsForPush } from "@/app/yip/actions/events";
import { anonymizeEventPII } from "@/app/yip/actions/pii";

type ChapterEvent = {
  id: string;
  name: string | null;
  status: string | null;
  chapter_name: string | null;
  day1_date: string | null;
  pii_purged_at: string | null;
};

/**
 * DPDP: "Remove personal data" picker. Lists real chapter events; the
 * super-admin / chapter chair ticks events and anonymizes their participants +
 * volunteers (name -> pseudonym, contacts/school removed). IRREVERSIBLE — gated
 * by typing the selected event's exact name (or "REMOVE N EVENTS" for a bulk
 * selection), so an accidental click can never erase data. Already-cleaned
 * events are flagged.
 */
export function RemovePiiDialog() {
  const [open, setOpen] = useState(false);
  const [events, setEvents] = useState<ChapterEvent[] | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [pending, startTransition] = useTransition();
  const [confirmText, setConfirmText] = useState("");
  const [flash, setFlash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function openDialog() {
    setOpen(true);
    setError(null);
    setFlash(null);
    setSelected(new Set());
    setConfirmText("");
    setLoading(true);
    const evs = await listChapterEventsForPush();
    setEvents(evs);
    setLoading(false);
  }

  function toggle(id: string) {
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  const list = events ?? [];
  const allSelected = list.length > 0 && selected.size === list.length;
  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(list.map((e) => e.id)));
  }

  // To prevent accidental wipes, the chair must type the EXACT name of the
  // single event being erased (forces a conscious match — a generic word like
  // "REMOVE" becomes muscle memory). For a multi-event selection, require the
  // count phrase so a bulk wipe can never be reflexive.
  const selectedEvents = list.filter((e) => selected.has(e.id));
  const single = selectedEvents.length === 1 ? selectedEvents[0] : null;
  const requiredPhrase = single
    ? single.name ?? single.chapter_name ?? "Untitled event"
    : `REMOVE ${selected.size} EVENTS`;
  // Lenient compare (trim + collapse whitespace + case-insensitive) so a name
  // with an em-dash is still confirmable by copy-paste, without being brittle.
  const normalize = (s: string) =>
    s.trim().replace(/\s+/g, " ").toLowerCase();
  const canConfirm =
    selected.size > 0 && normalize(confirmText) === normalize(requiredPhrase);

  function doRemove() {
    if (!canConfirm) return;
    setError(null);
    startTransition(async () => {
      const res = await anonymizeEventPII([...selected]);
      if (!res.success) {
        setError(res.error);
        return;
      }
      const d = res.data;
      setFlash(
        `Removed personal data from ${d.events_anonymized} event${
          d.events_anonymized === 1 ? "" : "s"
        }: ${d.participants} participants, ${d.volunteers} volunteers anonymized.${
          d.skipped_unauthorized
            ? ` (${d.skipped_unauthorized} skipped — not authorized.)`
            : ""
        }`
      );
      setOpen(false);
      setTimeout(() => setFlash(null), 9000);
    });
  }

  return (
    <>
      <Button
        variant="outline"
        onClick={openDialog}
        disabled={pending}
        className="border-[#cc3a21]/40 text-[#cc3a21] hover:bg-[#cc3a21]/5"
      >
        <ShieldOff className="size-4 mr-2" /> Remove personal data (DPDP)
      </Button>
      {flash && (
        <p className="mt-2 text-sm font-medium text-[#138808]">{flash}</p>
      )}

      <Dialog open={open} onOpenChange={(o) => !o && setOpen(false)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Remove personal data (DPDP)</DialogTitle>
            <DialogDescription>
              Permanently anonymizes participants &amp; volunteers of the selected
              events — names become “Participant&nbsp;#…”, and email / phone /
              school are removed. Scores, results and awards are kept. This{" "}
              <strong>cannot be undone</strong>.
            </DialogDescription>
          </DialogHeader>

          {loading ? (
            <div className="flex items-center gap-2 py-8 text-sm text-[#1a1a3e]/60">
              <Loader2 className="size-4 animate-spin" /> Loading chapter events…
            </div>
          ) : list.length === 0 ? (
            <p className="py-8 text-sm text-[#1a1a3e]/60">
              No real chapter events found.
            </p>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center justify-between border-b border-[#1a1a3e]/10 pb-2">
                <label className="flex items-center gap-2 text-sm font-medium text-[#1a1a3e] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleAll}
                    className="size-4 accent-[#cc3a21]"
                  />
                  Select all ({list.length})
                </label>
                <span className="text-xs text-[#1a1a3e]/50">
                  {selected.size} selected
                </span>
              </div>

              <div className="max-h-[40vh] overflow-y-auto pr-1 space-y-1">
                {list.map((e) => {
                  const cleaned = !!e.pii_purged_at;
                  return (
                    <label
                      key={e.id}
                      className="flex items-start gap-2 rounded-md px-2 py-2 text-sm hover:bg-[#1a1a3e]/5 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={selected.has(e.id)}
                        onChange={() => toggle(e.id)}
                        className="mt-0.5 size-4 accent-[#cc3a21]"
                      />
                      <span className="flex-1">
                        <span className="font-medium text-[#1a1a3e]">
                          {e.name ?? e.chapter_name ?? "Untitled event"}
                        </span>
                        <span className="block text-xs text-[#1a1a3e]/50">
                          {e.chapter_name ?? "—"}
                          {e.day1_date ? ` · ${e.day1_date}` : ""}
                          {cleaned ? (
                            <span className="ml-1 font-semibold text-[#138808]">
                              · already cleaned
                            </span>
                          ) : null}
                        </span>
                      </span>
                    </label>
                  );
                })}
              </div>

              <div className="flex items-start gap-2 rounded-md bg-[#cc3a21]/8 px-3 py-2 text-xs text-[#cc3a21]">
                <AlertTriangle className="size-4 shrink-0 mt-0.5" />
                <span>
                  Irreversible. Download any certificates/exports that need real
                  names first. Re-running on an already-cleaned event is harmless.
                </span>
              </div>

              <div>
                <label className="text-xs font-medium text-[#1a1a3e]/70 mb-1 block">
                  {single ? (
                    <>
                      Type the event&apos;s name to confirm:
                    </>
                  ) : (
                    <>Type the phrase below to confirm:</>
                  )}
                </label>
                <p className="mb-1.5 select-all rounded bg-[#1a1a3e]/5 px-2 py-1 font-mono text-xs font-bold text-[#1a1a3e] break-words">
                  {requiredPhrase}
                </p>
                <Input
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  placeholder={single ? "Event name" : requiredPhrase}
                  disabled={pending}
                />
              </div>

              {error && <p className="text-sm text-[#cc3a21]">{error}</p>}
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button
              onClick={doRemove}
              disabled={!canConfirm || pending}
              className="bg-[#cc3a21] hover:bg-[#cc3a21]/90 text-white"
            >
              {pending ? (
                <Loader2 className="size-4 mr-2 animate-spin" />
              ) : (
                <ShieldOff className="size-4 mr-2" />
              )}
              Remove from {selected.size} event{selected.size === 1 ? "" : "s"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
