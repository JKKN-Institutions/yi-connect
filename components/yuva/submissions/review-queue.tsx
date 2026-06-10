"use client";

/**
 * Mentor submissions queue (Phase 13) — grouped by session. Per session:
 * submitted/reviewed/missing counts, then one row per student with the
 * latest version, late badge, and the review/view dialog.
 */

import { FileStack } from "lucide-react";
import { formatDateTime } from "@/components/yuva/public/format";
import type { QueueSession } from "./data";
import { ReviewDialog } from "./review-dialog";
import { LateBadge, SubmissionStatusBadge } from "./status-badge";

function CountPill({ label, value }: { label: string; value: number }) {
  return (
    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
      {value} {label}
    </span>
  );
}

export function ReviewQueue({ sessions }: { sessions: QueueSession[] }) {
  if (sessions.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-slate-300 p-10 text-center">
        <div className="mx-auto flex size-10 items-center justify-center rounded-lg bg-slate-100 text-slate-400">
          <FileStack className="size-5" />
        </div>
        <p className="mt-3 text-sm font-medium text-slate-700">
          No sessions expect work
        </p>
        <p className="mt-1 text-sm text-slate-500">
          None of this run&apos;s sessions has a submission slot.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {sessions.map((session) => (
        <section
          key={session.runSessionId}
          className="rounded-xl border border-slate-200 bg-white"
        >
          <header className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
            <div className="min-w-0">
              <h3 className="font-semibold text-slate-900">
                <span className="text-slate-400">S{session.seq}</span>{" "}
                {session.name}
              </h3>
              {session.scheduledAt ? (
                <p className="text-xs text-slate-500">
                  {formatDateTime(session.scheduledAt)}
                </p>
              ) : null}
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <CountPill label="submitted" value={session.counts.submitted} />
              <CountPill label="reviewed" value={session.counts.reviewed} />
              <CountPill label="missing" value={session.counts.missing} />
            </div>
          </header>

          <ul className="divide-y divide-slate-100">
            {session.rows.map((row) => (
              <li
                key={row.enrollmentId}
                className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5"
              >
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                  <span className="text-sm font-medium text-slate-800">
                    {row.studentName}
                  </span>
                  {row.version ? (
                    <span className="text-xs text-slate-400">
                      v{row.version}
                    </span>
                  ) : null}
                  <SubmissionStatusBadge status={row.status} />
                  {row.isLate ? <LateBadge /> : null}
                  {row.submittedAt ? (
                    <span className="text-xs text-slate-400">
                      {formatDateTime(row.submittedAt)}
                    </span>
                  ) : null}
                </div>
                {row.submissionId && row.status !== "draft" ? (
                  <ReviewDialog row={row} sessionName={session.name} />
                ) : null}
              </li>
            ))}
            {session.rows.length === 0 ? (
              <li className="px-4 py-3 text-sm text-slate-500">
                No students in this cohort yet.
              </li>
            ) : null}
          </ul>
        </section>
      ))}
    </div>
  );
}
