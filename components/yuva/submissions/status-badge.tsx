/**
 * Submission status + late badges (Phase 13) — shared by the student
 * "My Work" cards and the mentor review queue. Plain module — safe in
 * RSCs and client components alike.
 */

import { Badge } from "@/components/ui/badge";
import type { SubmissionStatus } from "@/lib/yuva/submission-rules";

const STATUS_STYLES: Record<SubmissionStatus | "missing", string> = {
  draft: "border-slate-200 bg-slate-50 text-slate-600",
  submitted: "border-blue-200 bg-blue-50 text-blue-700",
  reviewed: "border-emerald-200 bg-emerald-50 text-emerald-700",
  missing: "border-amber-200 bg-amber-50 text-amber-700",
};

const STATUS_LABELS: Record<SubmissionStatus | "missing", string> = {
  draft: "Draft",
  submitted: "Submitted",
  reviewed: "Reviewed",
  missing: "Missing",
};

export function SubmissionStatusBadge({
  status,
}: {
  status: SubmissionStatus | "missing";
}) {
  return (
    <Badge variant="outline" className={STATUS_STYLES[status]}>
      {STATUS_LABELS[status]}
    </Badge>
  );
}

export function LateBadge() {
  return (
    <Badge variant="outline" className="border-red-200 bg-red-50 text-red-700">
      Late
    </Badge>
  );
}
