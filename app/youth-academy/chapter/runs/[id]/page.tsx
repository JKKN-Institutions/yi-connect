/**
 * Chapter / Institution — run management (Phase 7).
 * Settings card (chapter-entered dates / apply window / cohort announcement
 * date / Expected Participants), session scheduling table (mentor select from
 * the chapter's Mentor YUVA Network, out-of-range + double-booking warning
 * badges) and the lifecycle controls (publish / close / unpublish /
 * complete) with confirmation dialogs surfacing validatePublish
 * errors+warnings.
 *
 * Gate (defense-in-depth on top of the chapter layout): canManageRun on the
 * run's {academy_id, chapter} — explicit Forbidden403, never a redirect.
 */

import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Building2, Inbox, Users } from "lucide-react";
import { Forbidden403 } from "@/app/youth-academy/_components/Forbidden403";
import { getYuvaAccess } from "@/lib/yuva/auth/yuva-access";
import { validatePublish } from "@/lib/yuva/run-machine";
import { CategoryBadge } from "@/components/yuva/national/category-badge";
import {
  fetchChapterMentors,
  fetchRunDetail,
} from "@/components/yuva/runs/data";
import { PublishDialog } from "@/components/yuva/runs/publish-dialog";
import { RunLifecycleControls } from "@/components/yuva/runs/run-lifecycle-controls";
import { RunSettingsForm } from "@/components/yuva/runs/run-settings-form";
import { RunStatusBadge } from "@/components/yuva/runs/run-status-badge";
import { SessionScheduleTable } from "@/components/yuva/runs/session-schedule-table";

export const dynamic = "force-dynamic";

export const metadata = { title: "Run management" };

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const FROZEN = new Set(["completed", "certified", "cancelled"]);

export default async function RunManagementPage({
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
        reason={`You can't manage this run — it belongs to ${run.academy_name} (Yi ${run.chapter}). Your access: ${access.reason}`}
      />
    );
  }

  const frozen = FROZEN.has(run.status);

  // Publish readiness — computed server-side with the pure machine and fed
  // to the dialog (errors block, warnings need an explicit confirm).
  const publishValidation =
    run.status === "draft" ? validatePublish(run, run.sessions) : null;

  const mentors = await fetchChapterMentors(run.chapter);

  return (
    <main className="mx-auto max-w-5xl space-y-6 p-4 sm:p-6">
      <div className="space-y-3">
        <Link
          href="/youth-academy/chapter/runs"
          className="inline-flex items-center gap-1 text-sm text-slate-500 transition-colors hover:text-slate-900"
        >
          <ArrowLeft className="size-4" />
          Back to runs
        </Link>

        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold text-slate-900">
                {run.program_title}
              </h1>
              <RunStatusBadge status={run.status} />
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-3 text-sm text-slate-500">
              <CategoryBadge category={run.program_category} />
              <span className="inline-flex items-center gap-1">
                <Building2 className="size-3.5" />
                {run.academy_name} · Yi {run.chapter}
              </span>
              <span className="inline-flex items-center gap-1">
                <Inbox className="size-3.5" />
                {run.applications_count} application
                {run.applications_count === 1 ? "" : "s"} (
                {run.accepted_count} accepted)
              </span>
              {run.enrollments_count > 0 && (
                <span className="inline-flex items-center gap-1">
                  <Users className="size-3.5" />
                  {run.enrollments_count} enrolled
                </span>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {publishValidation && (
              <PublishDialog
                runId={run.id}
                errors={publishValidation.errors}
                warnings={publishValidation.warnings}
              />
            )}
            <RunLifecycleControls runId={run.id} status={run.status} />
          </div>
        </div>
      </div>

      {/* Applications review entry point (Phase 9) */}
      <Link
        href={`/youth-academy/chapter/runs/${run.id}/applications`}
        className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-5 transition-colors hover:border-emerald-300 hover:bg-emerald-50/40"
      >
        <div className="flex items-center gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-emerald-50">
            <Inbox className="size-5 text-emerald-700" />
          </div>
          <div>
            <p className="font-semibold text-slate-900">Applications</p>
            <p className="text-sm text-slate-500">
              {run.pending_count > 0
                ? `${run.pending_count} pending review`
                : "No pending applications"}
              {" · "}
              {run.accepted_count} accepted of {run.applications_count} total
            </p>
          </div>
        </div>
        <span className="text-sm font-medium text-emerald-700">
          Review →
        </span>
      </Link>

      {/* Cohort management entry point (Phase 11) */}
      <Link
        href={`/youth-academy/chapter/runs/${run.id}/cohort`}
        className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-5 transition-colors hover:border-sky-300 hover:bg-sky-50/40"
      >
        <div className="flex items-center gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-sky-50">
            <Users className="size-5 text-sky-700" />
          </div>
          <div>
            <p className="font-semibold text-slate-900">Cohort</p>
            <p className="text-sm text-slate-500">
              {run.enrollments_count > 0
                ? `${run.enrollments_count} enrolled — roster, attendance, progress`
                : "Roster, attendance and progress (after cohort formation)"}
            </p>
          </div>
        </div>
        <span className="text-sm font-medium text-sky-700">Manage →</span>
      </Link>

      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="font-semibold text-slate-900">Run settings</h2>
        <p className="mt-0.5 mb-4 text-sm text-slate-500">
          Dates entered by the chapter, the application window, the publicly
          shown cohort announcement date, and the expected participants.
        </p>
        <RunSettingsForm
          run={{
            id: run.id,
            start_date: run.start_date,
            end_date: run.end_date,
            apply_open_at: run.apply_open_at,
            apply_close_at: run.apply_close_at,
            cohort_announce_date: run.cohort_announce_date,
            capacity: run.capacity,
          }}
          disabled={frozen}
        />
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="font-semibold text-slate-900">
            Sessions ({run.sessions.length})
          </h2>
          <p className="mt-0.5 text-sm text-slate-500">
            Set the date &amp; time, venue and facilitator per session.
            Mentors come from the Yi {run.chapter} Mentor YUVA Network — “to
            be announced” is allowed at publish.
            {run.status !== "draft" && !frozen
              ? " Editing the schedule after publish is allowed — enrolled students are notified by email."
              : ""}
          </p>
        </div>
        <SessionScheduleTable
          sessions={run.sessions}
          mentors={mentors}
          runStartDate={run.start_date}
          runEndDate={run.end_date}
          defaultVenue={run.academy_name}
          readOnly={frozen}
        />
      </section>
    </main>
  );
}
