"use client";

/**
 * Publish confirmation dialog (Phase 7). The page computes
 * lib/yuva/run-machine.validatePublish server-side and passes its
 * errors+warnings in: ERRORS block (publish button disabled until resolved),
 * WARNINGS (e.g. sessions outside the entered run dates) require an explicit
 * confirm but never block. Unassigned mentors are allowed — "to be
 * announced". The server action re-validates on submit (defense-in-depth).
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Loader2, Megaphone, XCircle } from "lucide-react";
import toast from "react-hot-toast";
import { publishRun } from "@/app/youth-academy/actions/runs";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export function PublishDialog({
  runId,
  errors,
  warnings,
}: {
  runId: string;
  /** Blocking problems from validatePublish — publish stays disabled. */
  errors: string[];
  /** Non-blocking notices — listed, explicit confirm required. */
  warnings: string[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const blocked = errors.length > 0;

  async function handlePublish() {
    setSubmitting(true);
    const result = await publishRun({ runId });
    setSubmitting(false);
    if (!result.success) {
      toast.error(result.error);
      return;
    }
    if (result.warning) {
      toast(result.warning, { icon: "⚠️", duration: 6000 });
    }
    toast.success("Run published — it's now live on the academy page.");
    setOpen(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-emerald-700 hover:bg-emerald-800">
          <Megaphone className="size-4" />
          Publish run
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {blocked ? "Not ready to publish" : "Publish this run?"}
          </DialogTitle>
          <DialogDescription>
            {blocked
              ? "Fix the problems below, then come back — publishing makes the run publicly visible and opens applications."
              : "Publishing makes the run publicly visible on the academy page and opens it for applications. Mentors marked “to be announced” are allowed."}
          </DialogDescription>
        </DialogHeader>

        {errors.length > 0 && (
          <ul className="space-y-1.5 rounded-lg border border-red-200 bg-red-50 p-3">
            {errors.map((e) => (
              <li
                key={e}
                className="flex items-start gap-2 text-sm text-red-700"
              >
                <XCircle className="mt-0.5 size-4 shrink-0" />
                {e}
              </li>
            ))}
          </ul>
        )}

        {warnings.length > 0 && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
            <p className="mb-1.5 text-xs font-semibold tracking-wide text-amber-800 uppercase">
              Warnings — publishing is still allowed
            </p>
            <ul className="space-y-1.5">
              {warnings.map((w) => (
                <li
                  key={w}
                  className="flex items-start gap-2 text-sm text-amber-800"
                >
                  <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                  {w}
                </li>
              ))}
            </ul>
          </div>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button
            onClick={handlePublish}
            disabled={blocked || submitting}
            className="bg-emerald-700 hover:bg-emerald-800"
          >
            {submitting && <Loader2 className="size-4 animate-spin" />}
            {warnings.length > 0 ? "Publish anyway" : "Publish"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
