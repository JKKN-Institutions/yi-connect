"use client";

/**
 * Yi Youth Academy — approve / archive controls for a program template
 * (Phase 4). Both actions confirm via AlertDialog. Approve is blocked
 * client-side when the program has zero sessions (the server action
 * enforces the same rule); archive notes that existing runs are unaffected.
 */

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Archive, CheckCircle2, Loader2 } from "lucide-react";
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
import { useToast } from "@/hooks/use-toast";
import {
  approveProgram,
  archiveProgram,
} from "@/app/youth-academy/actions/programs";

export function ProgramStatusActions({
  programId,
  status,
  sessionsCount,
}: {
  programId: string;
  status: "draft" | "approved" | "archived";
  sessionsCount: number;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();

  function runApprove() {
    startTransition(async () => {
      const result = await approveProgram(programId);
      if (!result.success) {
        toast({ description: result.error, variant: "destructive" });
        return;
      }
      toast({ description: "Program approved — chapters can now run it" });
      router.refresh();
    });
  }

  function runArchive() {
    startTransition(async () => {
      const result = await archiveProgram(programId);
      if (!result.success) {
        toast({ description: result.error, variant: "destructive" });
        return;
      }
      toast({ description: "Program archived — no new runs can be created" });
      router.refresh();
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {status !== "approved" && (
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button disabled={isPending || sessionsCount === 0}>
              {isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <CheckCircle2 className="size-4" />
              )}
              Approve
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Approve this program?</AlertDialogTitle>
              <AlertDialogDescription>
                Approving makes the template instantiable by chapters — they
                can create runs from its {sessionsCount} session
                {sessionsCount === 1 ? "" : "s"}. You can keep editing it
                later; structure changes affect new runs only.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={runApprove}>
                Approve program
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

      {status !== "approved" && sessionsCount === 0 && (
        <p className="text-sm text-slate-500">
          Add at least one session before approving.
        </p>
      )}

      {status !== "archived" && (
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="outline" disabled={isPending}>
              <Archive className="size-4" />
              Archive
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Archive this program?</AlertDialogTitle>
              <AlertDialogDescription>
                Archiving blocks NEW runs from being created with this
                template. Existing runs are unaffected — they keep their
                snapshotted session structure and continue as scheduled.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={runArchive}>
                Archive program
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
}
