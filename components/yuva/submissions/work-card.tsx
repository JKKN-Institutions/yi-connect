"use client";

/**
 * "My Work" session card (Phase 13) — one per expects_submission session:
 * session name, due context (session date + SUBMISSION_GRACE_DAYS grace
 * note), status (draft/submitted/reviewed/missing), late badge, mentor
 * feedback when reviewed, my-file download, and the editor dialog.
 */

import { useState } from "react";
import { CalendarClock, Download, Loader2, MessageSquareText } from "lucide-react";
import toast from "react-hot-toast";
import { getMySubmissionFileUrl } from "@/app/youth-academy/actions/submissions";
import { SUBMISSION_GRACE_DAYS } from "@/lib/yuva/constants";
import { formatDate, formatDateTime } from "@/components/yuva/public/format";
import { Button } from "@/components/ui/button";
import type { MyWorkSession } from "./data";
import { LateBadge, SubmissionStatusBadge } from "./status-badge";
import { SubmissionEditor } from "./submission-editor";

const DAY_MS = 24 * 60 * 60 * 1000;

function dueContext(scheduledAt: string | null): string {
  if (!scheduledAt) {
    return "Session date to be announced — no deadline yet.";
  }
  const due = new Date(new Date(scheduledAt).getTime() + SUBMISSION_GRACE_DAYS * DAY_MS);
  return `Session ${formatDateTime(scheduledAt)} · submit by ${formatDate(due.toISOString())} (${SUBMISSION_GRACE_DAYS}-day grace)`;
}

export function WorkCard({ session }: { session: MyWorkSession }) {
  const [downloading, setDownloading] = useState(false);
  const submission = session.submission;
  const status = submission?.status ?? "missing";

  async function onDownload() {
    if (!submission) return;
    setDownloading(true);
    try {
      const result = await getMySubmissionFileUrl(submission.id);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      window.open(result.data.url, "_blank", "noopener,noreferrer");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold text-slate-900">
              <span className="text-slate-400">S{session.seq}</span>{" "}
              {session.name}
            </h3>
            <SubmissionStatusBadge status={status} />
            {submission?.isLate ? <LateBadge /> : null}
            {submission && submission.version > 1 ? (
              <span className="text-xs font-medium text-slate-400">
                v{submission.version}
              </span>
            ) : null}
          </div>
          <p className="mt-1 inline-flex items-center gap-1.5 text-sm text-slate-500">
            <CalendarClock className="size-3.5 shrink-0" />
            {dueContext(session.scheduledAt)}
          </p>
          {submission?.submittedAt ? (
            <p className="mt-0.5 text-xs text-slate-400">
              Submitted {formatDateTime(submission.submittedAt)}
            </p>
          ) : null}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {submission?.hasFile ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onDownload}
              disabled={downloading}
            >
              {downloading ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Download className="size-3.5" />
              )}
              My file
            </Button>
          ) : null}
          <SubmissionEditor
            runSessionId={session.runSessionId}
            sessionName={session.name}
            current={session.submission}
          />
        </div>
      </div>

      {submission?.status === "reviewed" && submission.feedback ? (
        <div className="mt-3 rounded-lg border border-emerald-100 bg-emerald-50/60 p-3">
          <p className="inline-flex items-center gap-1.5 text-xs font-semibold tracking-wide text-emerald-700 uppercase">
            <MessageSquareText className="size-3.5" />
            Mentor feedback
            {submission.reviewedAt
              ? ` · ${formatDate(submission.reviewedAt)}`
              : ""}
          </p>
          <p className="mt-1 text-sm whitespace-pre-wrap text-slate-700">
            {submission.feedback}
          </p>
        </div>
      ) : null}
    </div>
  );
}
