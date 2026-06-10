"use client";

/**
 * Submission review dialog (Phase 13) — mentor/manager view of one
 * student's latest version: text body, file download, and (for 'submitted'
 * work) a mandatory feedback box + "Mark reviewed". Reviewed work shows
 * its feedback read-only.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Download, Eye, Loader2 } from "lucide-react";
import toast from "react-hot-toast";
import {
  getSubmissionFileUrl,
  reviewSubmission,
} from "@/app/youth-academy/actions/submissions";
import { formatDateTime } from "@/components/yuva/public/format";
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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { QueueStudentRow } from "./data";
import { LateBadge, SubmissionStatusBadge } from "./status-badge";

export function ReviewDialog({
  row,
  sessionName,
}: {
  row: QueueStudentRow;
  sessionName: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [busy, setBusy] = useState<"review" | "download" | null>(null);

  if (!row.submissionId) return null;
  const reviewable = row.status === "submitted";

  async function onDownload() {
    if (!row.submissionId) return;
    setBusy("download");
    try {
      const result = await getSubmissionFileUrl(row.submissionId);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      window.open(result.data.url, "_blank", "noopener,noreferrer");
    } finally {
      setBusy(null);
    }
  }

  async function onMarkReviewed() {
    if (!row.submissionId) return;
    if (!feedback.trim()) {
      toast.error("Feedback is required — tell the student what you saw.");
      return;
    }
    setBusy("review");
    try {
      const result = await reviewSubmission(row.submissionId, { feedback });
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success(`Reviewed ${row.studentName}'s work.`);
      setOpen(false);
      setFeedback("");
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant={reviewable ? "default" : "outline"} size="sm">
          <Eye className="size-3.5" />
          {reviewable ? "Review" : "View"}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-2">
            {row.studentName}
            <span className="text-sm font-normal text-slate-400">
              v{row.version}
            </span>
            <SubmissionStatusBadge status={row.status} />
            {row.isLate ? <LateBadge /> : null}
          </DialogTitle>
          <DialogDescription>
            {sessionName}
            {row.submittedAt
              ? ` · submitted ${formatDateTime(row.submittedAt)}`
              : ""}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          {row.textBody ? (
            <div className="max-h-56 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50/60 p-3 text-sm whitespace-pre-wrap text-slate-700">
              {row.textBody}
            </div>
          ) : (
            <p className="text-sm text-slate-500 italic">
              No text — this submission is file-only.
            </p>
          )}

          {row.hasFile ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-fit"
              onClick={onDownload}
              disabled={busy !== null}
            >
              {busy === "download" ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Download className="size-3.5" />
              )}
              Download file
            </Button>
          ) : null}

          {reviewable ? (
            <div className="grid gap-1.5">
              <Label htmlFor={`feedback-${row.submissionId}`}>
                Feedback (required)
              </Label>
              <Textarea
                id={`feedback-${row.submissionId}`}
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                rows={4}
                maxLength={20000}
                placeholder="What worked, what to improve…"
                disabled={busy !== null}
              />
            </div>
          ) : row.feedback ? (
            <div className="rounded-lg border border-emerald-100 bg-emerald-50/60 p-3">
              <p className="text-xs font-semibold tracking-wide text-emerald-700 uppercase">
                Feedback
                {row.reviewedAt ? ` · ${formatDateTime(row.reviewedAt)}` : ""}
              </p>
              <p className="mt-1 text-sm whitespace-pre-wrap text-slate-700">
                {row.feedback}
              </p>
            </div>
          ) : null}
        </div>

        {reviewable ? (
          <DialogFooter>
            <Button
              type="button"
              onClick={onMarkReviewed}
              disabled={busy !== null}
              className="bg-slate-900 hover:bg-slate-800"
            >
              {busy === "review" ? (
                <Loader2 className="size-4 animate-spin" />
              ) : null}
              Mark reviewed
            </Button>
          </DialogFooter>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
