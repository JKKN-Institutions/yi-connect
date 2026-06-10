"use client";

/**
 * Run lifecycle controls (Phase 7): close applications, unpublish (with the
 * applicants-keep-status-access note), complete run — each behind a
 * confirmation dialog. Which buttons render is status-driven; the server
 * action re-validates every transition through lib/yuva/run-machine.ts.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCheck, DoorClosed, Loader2, Undo2 } from "lucide-react";
import toast from "react-hot-toast";
import {
  closeApplications,
  completeRun,
  unpublishRun,
} from "@/app/youth-academy/actions/runs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import type { RunStatus } from "@/lib/yuva/constants";

type PendingAction = "close" | "unpublish" | "complete" | null;

export function RunLifecycleControls({
  runId,
  status,
}: {
  runId: string;
  status: RunStatus;
}) {
  const router = useRouter();
  const [pending, setPending] = useState<PendingAction>(null);

  async function run(
    action: Exclude<PendingAction, null>,
    fn: () => Promise<{ success: boolean; error?: string }>,
    successMessage: string
  ) {
    setPending(action);
    try {
      const result = await fn();
      if (!result.success) {
        toast.error(result.error ?? "Something went wrong.");
        return;
      }
      toast.success(successMessage);
      router.refresh();
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {status === "published" && (
        <>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" disabled={pending !== null}>
                {pending === "close" ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <DoorClosed className="size-4" />
                )}
                Close applications
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Close applications now?</AlertDialogTitle>
                <AlertDialogDescription>
                  New applications will no longer be accepted. Existing
                  applications stay in the review queue and the cohort can
                  still be formed.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() =>
                    run(
                      "close",
                      () => closeApplications({ runId }),
                      "Applications closed"
                    )
                  }
                >
                  Close applications
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" disabled={pending !== null}>
                {pending === "unpublish" ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Undo2 className="size-4" />
                )}
                Unpublish
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Unpublish this run?</AlertDialogTitle>
                <AlertDialogDescription>
                  The run goes back to draft and disappears from the public
                  academy page. People who already applied keep access to
                  their application status page — nothing is deleted.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() =>
                    run(
                      "unpublish",
                      () => unpublishRun({ runId }),
                      "Run unpublished — back to draft"
                    )
                  }
                >
                  Unpublish
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </>
      )}

      {status === "in_progress" && (
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              disabled={pending !== null}
              className="bg-slate-900 hover:bg-slate-800"
            >
              {pending === "complete" ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <CheckCheck className="size-4" />
              )}
              Complete run
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Complete this run?</AlertDialogTitle>
              <AlertDialogDescription>
                Completing the run ends the program for this cohort and
                unlocks certificate issuance. At least one session must be
                marked completed.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() =>
                  run(
                    "complete",
                    () => completeRun({ runId }),
                    "Run completed"
                  )
                }
              >
                Complete run
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
}
