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
import { Send, AlertTriangle, Loader2 } from "lucide-react";
import { listChapterEventsForPush } from "@/app/yip/actions/events";

type ChapterEvent = {
  id: string;
  name: string | null;
  status: string | null;
  chapter_name: string | null;
  day1_date: string | null;
};

type PushResult<T> =
  | { success: true; data: T }
  | { success: false; error: string };

/**
 * Admin "Push to selected chapter events…" button + picker dialog. Sits next to
 * the existing one-click "Push to all" button on the Topics and Agenda admin
 * pages. Loads the real chapter-event list on open, lets the super-admin tick
 * the events to push to (with Select all), warns when any STARTED event is
 * chosen (pushing overwrites — for agenda it deletes existing rows), then calls
 * the supplied push action with the chosen IDs.
 */
export function PushToSelectedEvents<T>({
  label = "Push to selected…",
  dialogTitle,
  dialogDescription,
  action,
  formatSuccess,
}: {
  label?: string;
  dialogTitle: string;
  dialogDescription: string;
  /** The push server action, scoped to the given event IDs. */
  action: (eventIds: string[]) => Promise<PushResult<T>>;
  /** Build the success toast from the action's result data. */
  formatSuccess: (data: T) => string;
}) {
  const [open, setOpen] = useState(false);
  const [events, setEvents] = useState<ChapterEvent[] | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [pending, startTransition] = useTransition();
  const [flash, setFlash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function openDialog() {
    setOpen(true);
    setError(null);
    setFlash(null);
    setSelected(new Set());
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

  const startedSelectedCount = list.filter(
    (e) => selected.has(e.id) && e.status !== "draft"
  ).length;

  function doPush() {
    if (selected.size === 0) return;
    setError(null);
    startTransition(async () => {
      const res = await action([...selected]);
      if (!res.success) {
        setError(res.error);
        return;
      }
      setFlash(formatSuccess(res.data));
      setOpen(false);
      setTimeout(() => setFlash(null), 6000);
    });
  }

  return (
    <>
      <Button variant="outline" onClick={openDialog} disabled={pending}>
        <Send className="size-4 mr-2" /> {label}
      </Button>
      {flash && (
        <span className="ml-3 text-sm font-medium text-[#138808]">{flash}</span>
      )}

      <Dialog open={open} onOpenChange={(o) => !o && setOpen(false)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{dialogTitle}</DialogTitle>
            <DialogDescription>{dialogDescription}</DialogDescription>
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
                    className="size-4 accent-[#FF9933]"
                  />
                  Select all ({list.length})
                </label>
                <span className="text-xs text-[#1a1a3e]/50">
                  {selected.size} selected
                </span>
              </div>

              <div className="max-h-[46vh] overflow-y-auto pr-1 space-y-1">
                {list.map((e) => {
                  const started = e.status !== "draft";
                  return (
                    <label
                      key={e.id}
                      className="flex items-start gap-2 rounded-md px-2 py-2 text-sm hover:bg-[#1a1a3e]/5 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={selected.has(e.id)}
                        onChange={() => toggle(e.id)}
                        className="mt-0.5 size-4 accent-[#FF9933]"
                      />
                      <span className="flex-1">
                        <span className="font-medium text-[#1a1a3e]">
                          {e.name ?? e.chapter_name ?? "Untitled event"}
                        </span>
                        <span className="block text-xs text-[#1a1a3e]/50">
                          {e.chapter_name ?? "—"}
                          {e.day1_date ? ` · ${e.day1_date}` : ""}
                          {started ? (
                            <span className="ml-1 font-semibold text-[#cc3a21]">
                              · started ({e.status})
                            </span>
                          ) : (
                            <span className="ml-1 text-[#1a1a3e]/40">· draft</span>
                          )}
                        </span>
                      </span>
                    </label>
                  );
                })}
              </div>

              {startedSelectedCount > 0 && (
                <div className="flex items-start gap-2 rounded-md bg-[#cc3a21]/8 px-3 py-2 text-xs text-[#cc3a21]">
                  <AlertTriangle className="size-4 shrink-0 mt-0.5" />
                  <span>
                    {startedSelectedCount} selected event
                    {startedSelectedCount > 1 ? "s have" : " has"} already
                    started. Pushing overwrites their content — agenda items with
                    live scores/votes are protected and will be skipped, but other
                    changes cannot be undone.
                  </span>
                </div>
              )}

              {error && (
                <p className="text-sm text-[#cc3a21]">{error}</p>
              )}
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
            <Button onClick={doPush} disabled={selected.size === 0 || pending}>
              {pending ? (
                <Loader2 className="size-4 mr-2 animate-spin" />
              ) : (
                <Send className="size-4 mr-2" />
              )}
              Push to {selected.size} selected
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
