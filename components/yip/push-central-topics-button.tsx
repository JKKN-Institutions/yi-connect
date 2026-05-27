"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/yip/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/yip/ui/dialog";
import { AlertTriangle, Loader2, Send, CheckCircle2 } from "lucide-react";
import {
  pushCentralTopicsToAllChapterEvents,
  getYiYearIdForYear,
} from "@/app/yip/actions/admin-topics";

type Props = {
  centralTopicIds: string[];
  centralCount: number;
};

export function PushCentralTopicsButton({
  centralTopicIds,
  centralCount,
}: Props) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<
    { events_updated: number; rows_upserted: number } | null
  >(null);

  function handleConfirm() {
    setError(null);
    setResult(null);
    startTransition(async () => {
      // Scope to the currently active YI year (default: calendar year 2026).
      // If no active year is found, pass null and the action will scope to
      // all chapter events.
      const currentYear = new Date().getFullYear();
      const yearId = await getYiYearIdForYear(currentYear);
      const res = await pushCentralTopicsToAllChapterEvents(
        yearId,
        centralTopicIds
      );
      if (!res.success) {
        setError(res.error);
        return;
      }
      setResult(res.data);
    });
  }

  function close() {
    if (pending) return;
    setOpen(false);
    setError(null);
    setResult(null);
  }

  const disabled = centralTopicIds.length === 0;

  return (
    <>
      <Button
        onClick={() => setOpen(true)}
        disabled={disabled}
        variant="outline"
        className="border-[#FF9933]/40 text-[#FF9933] hover:bg-[#FF9933]/10"
        title={
          disabled
            ? "No central topics available"
            : `Push ${centralCount} central topics to all chapter events`
        }
      >
        <Send className="size-4 mr-2" />
        Push topics to all chapter events
      </Button>

      <Dialog open={open} onOpenChange={(o) => (o ? setOpen(true) : close())}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Push central topics to all chapter events</DialogTitle>
            <DialogDescription>
              This will push the central topics list ({centralCount} active
              central topic{centralCount === 1 ? "" : "s"}) to every chapter
              event in the current season. Each chapter event will have these
              topics added (merged in via upsert) — existing event topics are
              kept and not deleted. Continue?
            </DialogDescription>
          </DialogHeader>

          {error && (
            <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded p-2 flex items-start gap-2">
              <AlertTriangle className="size-3.5 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {result && (
            <div className="text-sm text-[#138808] bg-[#138808]/8 border border-[#138808]/20 rounded p-3 flex items-start gap-2">
              <CheckCircle2 className="size-4 mt-0.5 shrink-0" />
              <span>
                Pushed to <strong>{result.events_updated}</strong> chapter
                event{result.events_updated === 1 ? "" : "s"} ·{" "}
                {result.rows_upserted} row{result.rows_upserted === 1 ? "" : "s"}{" "}
                upserted.
              </span>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={close} disabled={pending}>
              {result ? "Close" : "Cancel"}
            </Button>
            {!result && (
              <Button
                onClick={handleConfirm}
                disabled={pending || disabled}
                className="bg-[#FF9933] hover:bg-[#FF9933]/90 text-white"
              >
                {pending && <Loader2 className="size-4 mr-2 animate-spin" />}
                Push now
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
