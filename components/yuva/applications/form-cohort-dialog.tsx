"use client";

/**
 * "Form cohort" confirmation dialog (Phase 9) — the point of no return.
 * Summarizes the accepted set and spells out exactly what happens:
 * applications close (run → in progress), access codes are generated, and
 * acceptance + rejection emails go out. The server action arbitrates
 * concurrency with a compare-and-swap claim — a stale second click fails
 * with an explicit reload message, never double-processes.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  KeyRound,
  Loader2,
  Lock,
  Mail,
  Users,
} from "lucide-react";
import toast from "react-hot-toast";
import { formCohort } from "@/app/youth-academy/actions/applications";
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

export function FormCohortDialog({
  runId,
  acceptedCount,
  rejectedCount,
  pendingCount,
  capacity,
  /** Non-null ⇒ the CTA is disabled, with this reason shown under it. */
  disabledReason,
}: {
  runId: string;
  acceptedCount: number;
  rejectedCount: number;
  pendingCount: number;
  capacity: number;
  disabledReason?: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const overCapacity = acceptedCount > capacity;

  async function handleFormCohort() {
    setSubmitting(true);
    const result = await formCohort({ runId });
    setSubmitting(false);
    if (!result.success) {
      toast.error(result.error);
      setOpen(false);
      router.refresh();
      return;
    }
    if (result.warning) {
      toast(result.warning, { icon: "⚠️", duration: 8000 });
    }
    toast.success(
      `Cohort formed — ${result.data.enrolled} enrolled, ${result.data.emailsQueued} emails queued${result.data.skipped > 0 ? `, ${result.data.skipped} skipped` : ""}.`
    );
    setOpen(false);
    router.refresh();
  }

  if (disabledReason) {
    return (
      <div className="text-right">
        <Button disabled className="bg-emerald-700">
          <Users className="size-4" />
          Form cohort
        </Button>
        <p className="mt-1 text-xs text-slate-400">{disabledReason}</p>
      </div>
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-emerald-700 hover:bg-emerald-800">
          <Users className="size-4" />
          Form cohort
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            Form the cohort with {acceptedCount} student
            {acceptedCount === 1 ? "" : "s"}?
          </DialogTitle>
          <DialogDescription>
            This locks the acceptance set and starts the program. It can&apos;t
            be undone.
          </DialogDescription>
        </DialogHeader>

        <ul className="space-y-2.5 rounded-lg border border-slate-200 bg-slate-50 p-3.5 text-sm text-slate-700">
          <li className="flex items-start gap-2">
            <KeyRound className="mt-0.5 size-4 shrink-0 text-emerald-700" />
            {acceptedCount} accepted applicant{acceptedCount === 1 ? "" : "s"}{" "}
            get a student login: a unique access code is generated and emailed
            with the program details.
          </li>
          <li className="flex items-start gap-2">
            <Mail className="mt-0.5 size-4 shrink-0 text-slate-500" />
            {rejectedCount > 0
              ? `${rejectedCount} rejected applicant${rejectedCount === 1 ? "" : "s"} receive the rejection email.`
              : "No rejection emails — nothing is currently rejected."}
          </li>
          <li className="flex items-start gap-2">
            <Lock className="mt-0.5 size-4 shrink-0 text-slate-500" />
            Applications close and the run moves to{" "}
            <strong>In progress</strong>.
            {pendingCount > 0 &&
              ` ${pendingCount} pending application${pendingCount === 1 ? "" : "s"} stay${pendingCount === 1 ? "s" : ""} reviewable — accepted later, they join via "Add to cohort".`}
          </li>
        </ul>

        {overCapacity && (
          <p className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            {acceptedCount} accepted is above the expected {capacity}{" "}
            participants — this is a soft cap, forming is still allowed.
          </p>
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
            onClick={handleFormCohort}
            disabled={submitting}
            className="bg-emerald-700 hover:bg-emerald-800"
          >
            {submitting && <Loader2 className="size-4 animate-spin" />}
            Form cohort
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
