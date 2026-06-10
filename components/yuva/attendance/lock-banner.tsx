"use client";

/**
 * Attendance lock banner (Phase 11). Shown wherever the attendance grid is
 * locked (run completed/certified, no active reopen). Managers additionally
 * get the audited "Reopen for 30 minutes" control; mentors only see the
 * reason. When a reopen IS active, shows the countdown context instead.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, LockKeyhole, LockKeyholeOpen } from "lucide-react";
import toast from "react-hot-toast";
import { reopenAttendance } from "@/app/youth-academy/actions/attendance";
import { ATTENDANCE_REOPEN_MINUTES } from "@/lib/yuva/attendance-lock";
import { Button } from "@/components/ui/button";

export function AttendanceLockBanner({
  runId,
  reason,
  canReopen = false,
  reopenedUntil = null,
}: {
  runId: string;
  /** Lock reason from lib/yuva/attendance-lock (shown verbatim). */
  reason: string;
  /** Managers only — renders the audited reopen control. */
  canReopen?: boolean;
  /** ISO expiry of an ACTIVE reopen window (renders the unlocked notice). */
  reopenedUntil?: string | null;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  if (reopenedUntil) {
    const until = new Date(reopenedUntil);
    return (
      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50/60 p-4">
        <LockKeyholeOpen className="size-5 shrink-0 text-emerald-600" />
        <p className="text-sm text-emerald-900">
          Attendance editing is <span className="font-semibold">reopened</span>{" "}
          until{" "}
          {Number.isNaN(until.getTime())
            ? "the window expires"
            : until.toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}{" "}
          (audit-logged). Edits lock again automatically.
        </p>
      </div>
    );
  }

  async function onReopen() {
    setPending(true);
    const result = await reopenAttendance(runId);
    setPending(false);
    if (!result.success) {
      toast.error(result.error);
      return;
    }
    toast.success(
      `Attendance reopened for ${ATTENDANCE_REOPEN_MINUTES} minutes (audit-logged).`
    );
    router.refresh();
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50/60 p-4">
      <div className="flex items-center gap-3">
        <LockKeyhole className="size-5 shrink-0 text-amber-600" />
        <p className="text-sm text-amber-900">{reason}</p>
      </div>
      {canReopen && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={pending}
          onClick={onReopen}
          className="border-amber-300 bg-white text-amber-900 hover:bg-amber-100"
        >
          {pending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <LockKeyholeOpen className="size-4" />
          )}
          Reopen for {ATTENDANCE_REOPEN_MINUTES} minutes
        </Button>
      )}
    </div>
  );
}
