"use client";

import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/yip/ui/card";
import { Button } from "@/components/yip/ui/button";
import { Input } from "@/components/yip/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/yip/ui/dialog";
import { AlertTriangle, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { canResetEvent, resetEventForGoLive } from "@/app/yip/actions/event-reset";

// Danger zone shown on the event edit page. Self-gating: renders nothing unless
// the viewer is the chapter chair / super-admin (canResetEvent). The reset
// action re-checks authorization server-side — this is UX, not the gate.
export function EventDangerZone({
  eventId,
  eventName,
}: {
  eventId: string;
  eventName: string;
}) {
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [open, setOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [resetting, setResetting] = useState(false);

  useEffect(() => {
    let active = true;
    canResetEvent(eventId)
      .then((v) => active && setAllowed(v))
      .catch(() => active && setAllowed(false));
    return () => {
      active = false;
    };
  }, [eventId]);

  if (!allowed) return null;

  const nameMatches =
    confirmText.trim().length > 0 &&
    confirmText.trim() === (eventName ?? "").trim();

  async function handleReset() {
    if (!nameMatches) return;
    setResetting(true);
    const res = await resetEventForGoLive(eventId, confirmText);
    setResetting(false);
    if (res.success) {
      const s = res.data.summary;
      const removed = Object.entries(s)
        .filter(([k]) => k !== "participants_cleared")
        .reduce((sum, [, n]) => sum + (Number(n) || 0), 0);
      toast.success(
        `Practice data cleared — ${removed} record${removed === 1 ? "" : "s"} removed, ${
          s.participants_cleared ?? 0
        } students kept.`
      );
      setOpen(false);
      setConfirmText("");
    } else {
      toast.error(res.error);
    }
  }

  return (
    <Card className="border-red-200">
      <CardContent className="space-y-3 pt-5">
        <div className="flex items-start gap-2">
          <AlertTriangle className="mt-0.5 size-5 shrink-0 text-red-500" />
          <div>
            <h3 className="text-sm font-semibold text-red-700">
              Danger Zone — Clear practice data
            </h3>
            <p className="mt-1 text-sm text-gray-600">
              Rehearsed on this event? This permanently deletes all votes, jury
              scores, bills, questions, motions, check-ins and computed results,
              and clears every party / constituency / committee / role
              assignment — so you can start the real day clean.{" "}
              <span className="font-medium text-gray-800">
                Your imported students and the agenda are kept.
              </span>
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          className="border-red-300 text-red-700 hover:bg-red-50"
          onClick={() => setOpen(true)}
        >
          <Trash2 className="size-4" />
          Clear practice data &amp; go live
        </Button>
      </CardContent>

      <Dialog
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
          if (!o) setConfirmText("");
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-red-700">
              Clear all practice data?
            </DialogTitle>
            <DialogDescription>
              This cannot be undone. Read what will be removed, then type the
              event name to confirm.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 text-sm">
            <p className="text-gray-700">
              Permanently removes for{" "}
              <span className="font-medium">{eventName}</span>:
            </p>
            <ul className="list-disc space-y-0.5 pl-5 text-gray-600">
              <li>all votes, jury scores &amp; computed results / awards</li>
              <li>all submitted bills, questions &amp; motions</li>
              <li>everyone&apos;s check-in status</li>
              <li>every party, constituency, committee &amp; role assignment</li>
            </ul>
            <p className="text-gray-600">
              Kept: the{" "}
              <span className="font-medium text-gray-800">
                imported students
              </span>{" "}
              (names, schools, access codes) and the{" "}
              <span className="font-medium text-gray-800">agenda</span>.
            </p>
            <p className="pt-1 text-gray-700">
              Type{" "}
              <span className="font-mono font-medium text-gray-900">
                {eventName}
              </span>{" "}
              to confirm:
            </p>
            <Input
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder={eventName}
              autoComplete="off"
            />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              className="bg-red-600 text-white hover:bg-red-700"
              disabled={!nameMatches || resetting}
              onClick={handleReset}
            >
              {resetting ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Clearing…
                </>
              ) : (
                "Permanently clear"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
