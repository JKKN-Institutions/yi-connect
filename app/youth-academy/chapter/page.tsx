/**
 * CHAPTER — dashboard (spec "Chapter — dashboard").
 * Shows the academy/academies in the caller's scope (national-created),
 * active runs, and pending-application counts. Coordinator assignment lives
 * on the academy view.
 */

import Link from "next/link";
import { BookOpen, Building2, CalendarClock, Inbox, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getYuvaAccess } from "@/lib/yuva/auth/yuva-access";
import {
  AcademyCard,
} from "@/components/yuva/academies/academy-card";
import {
  fetchAcademies,
  type AcademyScope,
} from "@/components/yuva/academies/data";
import { fetchRuns, runScopeFromAccess } from "@/components/yuva/runs/data";
import { RunStatusBadge } from "@/components/yuva/runs/run-status-badge";
import { GUIDES, type GuideLane } from "@/lib/yuva/guide/content";
import { getCompletedSteps, logGuideEvent } from "@/lib/yuva/guide/actions";
import { NextStepWidget } from "@/app/youth-academy/_components/GuideSurfacing";
import { OnboardingLauncher } from "@/app/youth-academy/_components/OnboardingLauncher";

export const metadata = { title: "Chapter dashboard" };

export default async function ChapterDashboardPage() {
  // Layout already gated; re-resolve for scoping (layouts can't pass props).
  const access = await getYuvaAccess();
  const scope: AcademyScope = access.isNational
    ? { kind: "all" }
    : access.chapterAdminOf
      ? { kind: "chapter", chapter: access.chapterAdminOf }
      : { kind: "ids", ids: access.coordinatorAcademyIds };

  const [academies, activeRuns] = await Promise.all([
    fetchAcademies(scope),
    fetchRuns(runScopeFromAccess(access), { activeOnly: true, limit: 5 }),
  ]);
  const heading = access.chapterAdminOf
    ? `Yi ${access.chapterAdminOf} — Youth Academy`
    : access.isNational
      ? "Youth Academy — all chapters"
      : "Your academy";

  // Proactive "next step" — the chapter/coordinator setup checklist, surfaced
  // where they land (the guide page itself holds the full checklist).
  const guideLane: GuideLane = access.chapterAdminOf
    ? "chapter_admin"
    : access.coordinatorAcademyIds.length > 0
      ? "coordinator"
      : "chapter_admin";
  const guideCompleted = await getCompletedSteps(guideLane);

  return (
    <main className="mx-auto max-w-5xl space-y-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{heading}</h1>
          <p className="text-sm text-slate-500">
            Cohort-based certificate programs for the Yi YUVA network.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <OnboardingLauncher
            content={GUIDES[guideLane]}
            lane={guideLane}
            completed={guideCompleted}
            onEvent={logGuideEvent}
          />
          <Button asChild variant="ghost">
            <Link href="/youth-academy/guide">
              <BookOpen className="size-4" />
              Guide
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/youth-academy/chapter/academies">
              <Building2 className="size-4" />
              Academy &amp; coordinator
            </Link>
          </Button>
        </div>
      </div>

      <NextStepWidget
        guide={GUIDES[guideLane]}
        completed={guideCompleted}
        onEvent={logGuideEvent}
      />

      {academies.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center">
          <p className="font-medium text-slate-700">No academy yet</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">
            Your academy is set up by the Yi National team — chapters cannot
            create academies. Reach out to the national team to get started.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {academies.map((academy) => (
            <AcademyCard key={academy.id} academy={academy}>
              <Link
                href="/youth-academy/chapter/academies"
                className="text-sm font-medium text-emerald-700 underline-offset-2 hover:underline"
              >
                View academy &amp; assign coordinator →
              </Link>
            </AcademyCard>
          ))}
        </div>
      )}

      {/* Phase 7 fills the runs slot; Phase 9 (applications/sessions) fills the rest. */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-slate-700">
              <CalendarClock className="size-4 text-amber-600" />
              <h2 className="font-semibold">Program runs</h2>
            </div>
            <Link
              href="/youth-academy/chapter/runs"
              className="text-xs font-medium text-emerald-700 underline-offset-2 hover:underline"
            >
              View all →
            </Link>
          </div>
          {activeRuns.length === 0 ? (
            <p className="mt-1 text-sm text-slate-400">
              No active runs yet —{" "}
              <Link
                href="/youth-academy/chapter/runs/new"
                className="font-medium text-emerald-700 underline-offset-2 hover:underline"
              >
                create one
              </Link>{" "}
              from an approved program.
            </p>
          ) : (
            <ul className="mt-2 space-y-1.5">
              {activeRuns.map((run) => (
                <li key={run.id}>
                  <Link
                    href={`/youth-academy/chapter/runs/${run.id}`}
                    className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-slate-50"
                  >
                    <span className="truncate font-medium text-slate-700">
                      {run.program_title}
                    </span>
                    <RunStatusBadge status={run.status} />
                  </Link>
                  <div className="flex items-center gap-3 px-2 pb-1.5 text-xs">
                    <Link
                      href={`/youth-academy/chapter/runs/${run.id}/applications`}
                      className="font-medium text-emerald-700 underline-offset-2 hover:underline"
                    >
                      Review applications
                    </Link>
                    <Link
                      href={`/youth-academy/chapter/runs/${run.id}/cohort`}
                      className="font-medium text-emerald-700 underline-offset-2 hover:underline"
                    >
                      Manage cohort
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex items-center gap-2 text-slate-700">
            <Inbox className="size-4 text-amber-600" />
            <h2 className="font-semibold">Applications</h2>
          </div>
          <p className="mt-1 text-sm text-slate-500">
            {activeRuns.length === 0
              ? "Open a run to review applications and form its cohort."
              : "Open a run above to review its application queue and form the cohort."}
          </p>
          <Link
            href="/youth-academy/chapter/runs"
            className="mt-2 inline-block text-xs font-medium text-emerald-700 underline-offset-2 hover:underline"
          >
            Go to runs →
          </Link>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex items-center gap-2 text-slate-700">
            <Users className="size-4 text-amber-600" />
            <h2 className="font-semibold">Upcoming sessions</h2>
          </div>
          <p className="mt-1 text-sm text-slate-400">
            This week&apos;s sessions appear here once runs are scheduled.
          </p>
        </div>
      </div>
    </main>
  );
}
