/**
 * Chapter / Institution — applications review (Phase 9).
 * Spec: docs/yi-youth-academy-spec.md → "Chapter / Institution —
 * applications review".
 *
 * Queue with applicant details (form answers, institution, YUVA membership
 * claim, motivation), pending/accepted/rejected filters, capacity meter
 * (soft cap), accept/reject + bulk review, and the "Form cohort" CTA
 * (CAS-claimed in the action). Post-formation: cohort-formed banner,
 * per-student resend/regenerate code actions, and "Add to cohort" late
 * acceptance.
 *
 * Gate (defense-in-depth on top of the chapter layout): canManageRun on the
 * run's {academy_id, chapter} — explicit Forbidden403, never a redirect.
 */

import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Building2, CheckCircle2 } from "lucide-react";
import { Forbidden403 } from "@/app/youth-academy/_components/Forbidden403";
import { getYuvaAccess } from "@/lib/yuva/auth/yuva-access";
import { REVIEWABLE_RUN_STATUSES } from "@/lib/yuva/cohort";
import { runStatusLabel } from "@/lib/yuva/run-machine";
import { ApplicationsTable } from "@/components/yuva/applications/applications-table";
import { CapacityMeter } from "@/components/yuva/applications/capacity-meter";
import { fetchApplicationsQueue } from "@/components/yuva/applications/data";
import { FormCohortDialog } from "@/components/yuva/applications/form-cohort-dialog";
import { CategoryBadge } from "@/components/yuva/national/category-badge";
import { fetchRunDetail } from "@/components/yuva/runs/data";
import { RunStatusBadge } from "@/components/yuva/runs/run-status-badge";

export const dynamic = "force-dynamic";

export const metadata = { title: "Applications review" };

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Run statuses at/after cohort formation. */
const FORMED_STATUSES = new Set(["in_progress", "completed", "certified"]);

export default async function ApplicationsReviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!UUID_PATTERN.test(id)) {
    notFound();
  }

  const run = await fetchRunDetail(id);
  if (!run) {
    notFound();
  }

  const access = await getYuvaAccess();
  if (
    !access.canManageRun({ academy_id: run.academy_id, chapter: run.chapter })
  ) {
    return (
      <Forbidden403
        reason={`You can't review applications for this run — it belongs to ${run.academy_name} (Yi ${run.chapter}). Your access: ${access.reason}`}
      />
    );
  }

  const applications = await fetchApplicationsQueue(run.id);
  const pendingCount = applications.filter(
    (a) => a.status === "pending"
  ).length;
  const acceptedCount = applications.filter(
    (a) => a.status === "accepted"
  ).length;
  const rejectedCount = applications.filter(
    (a) => a.status === "rejected"
  ).length;
  const enrolledCount = applications.filter((a) => a.enrollment_id).length;

  const cohortFormed = FORMED_STATUSES.has(run.status);
  const canReview = REVIEWABLE_RUN_STATUSES.has(run.status);

  // Form-cohort CTA disable reasons (the action re-checks — this is UX).
  let formDisabledReason: string | null = null;
  if (run.status === "draft") {
    formDisabledReason = "Publish the run before forming a cohort.";
  } else if (["completed", "certified", "cancelled"].includes(run.status)) {
    formDisabledReason = `This run is ${runStatusLabel(run.status).toLowerCase()} — the cohort can no longer be formed.`;
  } else if (acceptedCount === 0) {
    formDisabledReason =
      "Accept at least one application before forming the cohort.";
  }

  return (
    <main className="mx-auto max-w-5xl space-y-6 p-4 sm:p-6">
      <div className="space-y-3">
        <Link
          href={`/youth-academy/chapter/runs/${run.id}`}
          className="inline-flex items-center gap-1 text-sm text-slate-500 transition-colors hover:text-slate-900"
        >
          <ArrowLeft className="size-4" />
          Back to run
        </Link>

        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold text-slate-900">
                Applications — {run.program_title}
              </h1>
              <RunStatusBadge status={run.status} />
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-3 text-sm text-slate-500">
              <CategoryBadge category={run.program_category} />
              <span className="inline-flex items-center gap-1">
                <Building2 className="size-3.5" />
                {run.academy_name} · Yi {run.chapter}
              </span>
            </div>
          </div>

          {!cohortFormed && (
            <FormCohortDialog
              runId={run.id}
              acceptedCount={acceptedCount}
              rejectedCount={rejectedCount}
              pendingCount={pendingCount}
              capacity={run.capacity}
              disabledReason={formDisabledReason}
            />
          )}
        </div>
      </div>

      {cohortFormed && (
        <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
          <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-700" />
          <div className="text-sm text-emerald-900">
            <p className="font-semibold">
              Cohort formed — {enrolledCount} student
              {enrolledCount === 1 ? "" : "s"} enrolled.
            </p>
            <p className="mt-0.5 text-emerald-800">
              Access codes were generated and emailed. Use{" "}
              <strong>Resend code</strong> /<strong> Regenerate</strong> on a
              student&apos;s row for login problems, and{" "}
              <strong>Add to cohort</strong> to enroll a late acceptance.
            </p>
          </div>
        </div>
      )}

      <CapacityMeter accepted={acceptedCount} capacity={run.capacity} />

      <ApplicationsTable
        applications={applications}
        canReview={canReview}
        cohortFormed={cohortFormed}
      />
    </main>
  );
}
