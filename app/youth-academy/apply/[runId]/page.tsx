/**
 * Yi Youth Academy — PUBLIC application form page (Phase 8).
 * Spec: docs/yi-youth-academy-spec.md → "Application form (public)".
 *
 * The window/status check here is UI-level convenience only — the
 * authoritative check re-runs server-side inside submitApplication (spec
 * edge case: "run closes between page load and submit → friendly
 * rejection"). Draft/cancelled runs 404; closed/not-yet-open/full runs get
 * a friendly "applications closed" screen, never a hidden error.
 */

import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CalendarOff } from "lucide-react";
import { ApplyWizard } from "@/components/yuva/apply/apply-wizard";
import { fetchPublicRunDetail } from "@/components/yuva/public/data";
import {
  formatDate,
  formatDateTime,
} from "@/components/yuva/public/format";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Apply",
  robots: { index: false },
};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function ApplyPage({
  params,
}: {
  params: Promise<{ runId: string }>;
}) {
  const { runId } = await params;
  if (!UUID_RE.test(runId)) notFound();

  const run = await fetchPublicRunDetail(runId);
  if (!run) notFound();

  const detailHref = `/youth-academy/programs/${run.id}`;

  // ── Closed / not-yet-open / full → friendly screen ──────────────────
  if (run.state !== "open") {
    const openAt = formatDateTime(run.apply_open_at);
    const message =
      run.state === "not_yet_open"
        ? openAt
          ? `Applications for this program open on ${openAt}. Come back then!`
          : "Applications for this program haven't opened yet. Come back soon!"
        : run.state === "closed_full"
          ? "All seats for this cohort are taken. Keep an eye on the landing page for the next one."
          : "Applications for this cohort have closed. Keep an eye on the landing page for the next one.";

    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6 py-16">
        <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
            <CalendarOff className="size-6 text-slate-500" />
          </div>
          <h1 className="mt-4 text-xl font-bold text-slate-900">
            {run.state === "not_yet_open"
              ? "Applications open soon"
              : "Applications closed"}
          </h1>
          <p className="mt-2 text-sm font-medium text-slate-700">
            {run.program.title}
          </p>
          <p className="mt-2 text-sm text-slate-600">{message}</p>
          <div className="mt-6 flex flex-col gap-2">
            <Link
              href={detailHref}
              className="inline-flex items-center justify-center rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-800"
            >
              View program details
            </Link>
            <Link
              href="/youth-academy"
              className="inline-flex items-center justify-center rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50"
            >
              Browse other programs
            </Link>
          </div>
        </div>
      </main>
    );
  }

  // ── Open → wizard ────────────────────────────────────────────────────
  const closeAt = formatDateTime(run.apply_close_at);
  const announce = formatDate(run.cohort_announce_date);

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-2xl px-6 py-10">
        <Link
          href={detailHref}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft className="size-4" />
          Back to program
        </Link>

        <div className="mt-5">
          <p className="text-sm font-semibold tracking-widest text-amber-600 uppercase">
            Application
          </p>
          <h1 className="mt-1 text-2xl font-bold text-slate-900 sm:text-3xl">
            {run.program.title}
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            {run.academy.display_name}
            {run.academy.city ? ` · ${run.academy.city}` : ""}
            {announce ? ` · results announced by ${announce}` : ""}
          </p>
        </div>

        <div className="mt-6">
          <ApplyWizard
            runId={run.id}
            programTitle={run.program.title}
            academyName={run.academy.display_name}
            deadlineLabel={closeAt ? `Apply by ${closeAt}` : null}
          />
        </div>
      </div>
    </main>
  );
}
