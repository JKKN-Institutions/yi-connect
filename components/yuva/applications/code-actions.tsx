"use client";

/**
 * Post-formation per-student actions (Phase 9):
 *   CodeActions        — resend the EXISTING access code (once/day) or
 *                        regenerate a new one (old code stops working).
 *   AddToCohortButton  — late acceptance: enroll an accepted-but-unenrolled
 *                        applicant after the cohort was formed.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, Loader2, RefreshCw, Send, UserPlus } from "lucide-react";
import toast from "react-hot-toast";
import {
  addLateAcceptance,
  regenerateAccessCode,
  resendAccessCode,
} from "@/app/youth-academy/actions/applications";
import { Button } from "@/components/ui/button";

export function CodeActions({ enrollmentId }: { enrollmentId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState<"resend" | "regenerate" | null>(null);

  async function resend() {
    setBusy("resend");
    const result = await resendAccessCode({ enrollmentId });
    setBusy(null);
    if (!result.success) {
      toast.error(result.error);
      return;
    }
    if (result.warning) {
      toast(result.warning, { icon: "⚠️", duration: 6000 });
    } else {
      toast.success("Access code re-sent by email.");
    }
    router.refresh();
  }

  async function regenerate() {
    if (
      !window.confirm(
        "Generate a NEW access code? The old code stops working immediately and the new one is emailed to the student."
      )
    ) {
      return;
    }
    setBusy("regenerate");
    const result = await regenerateAccessCode({ enrollmentId });
    setBusy(null);
    if (!result.success) {
      toast.error(result.error);
      return;
    }
    if (result.warning) {
      toast(result.warning, { icon: "⚠️", duration: 8000 });
    } else {
      toast.success("New access code generated and emailed.");
    }
    router.refresh();
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
        <KeyRound className="size-3" />
        In cohort
      </span>
      <Button
        size="sm"
        variant="ghost"
        onClick={resend}
        disabled={busy !== null}
        className="h-7 px-2 text-xs text-slate-600"
        title="Re-email the existing access code (once per day)"
      >
        {busy === "resend" ? (
          <Loader2 className="size-3.5 animate-spin" />
        ) : (
          <Send className="size-3.5" />
        )}
        Resend code
      </Button>
      <Button
        size="sm"
        variant="ghost"
        onClick={regenerate}
        disabled={busy !== null}
        className="h-7 px-2 text-xs text-slate-600"
        title="Invalidate the old code and email a new one"
      >
        {busy === "regenerate" ? (
          <Loader2 className="size-3.5 animate-spin" />
        ) : (
          <RefreshCw className="size-3.5" />
        )}
        Regenerate
      </Button>
    </div>
  );
}

export function AddToCohortButton({ applicationId }: { applicationId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function add() {
    setBusy(true);
    const result = await addLateAcceptance({ applicationId });
    setBusy(false);
    if (!result.success) {
      toast.error(result.error);
      return;
    }
    toast.success(
      "Added to the cohort — access code generated and acceptance email queued."
    );
    router.refresh();
  }

  return (
    <Button
      size="sm"
      onClick={add}
      disabled={busy}
      className="h-7 bg-emerald-700 px-2.5 text-xs hover:bg-emerald-800"
      title="Enroll this accepted applicant into the formed cohort"
    >
      {busy ? (
        <Loader2 className="size-3.5 animate-spin" />
      ) : (
        <UserPlus className="size-3.5" />
      )}
      Add to cohort
    </Button>
  );
}
