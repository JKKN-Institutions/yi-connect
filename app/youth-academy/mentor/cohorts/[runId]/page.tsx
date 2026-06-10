/**
 * Mentor — cohort view (Phase 11).
 * Spec: docs/yi-youth-academy-spec.md → "Mentor — dashboard / sessions /
 * cohort": tabs Roster | Messages (Phase 12) | Submissions (Phase 13 —
 * per-session queue with review/feedback); roster shows attendance %, submissions
 * status and progress % per student (lib/yuva/progress.ts over live data);
 * full run schedule + program summary/takeaways visible read-only — the
 * syllabus view (locked Email-1 mentor monitoring requirement).
 *
 * Gate: getMentorRunAccess(runId) — mentor assigned to ≥1 session of the run
 * OR run manager. Explicit Forbidden403 with the reason, never a redirect.
 */

import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Users } from "lucide-react";
import { Forbidden403 } from "@/app/youth-academy/_components/Forbidden403";
import { getMentorRunAccess } from "@/lib/yuva/auth/mentor-access";
import { RUN_STATUS_LABELS } from "@/lib/yuva/constants";
import { CategoryBadge } from "@/components/yuva/national/category-badge";
import { fetchCohortData } from "@/components/yuva/cohort/data";
import { CohortThread } from "@/components/yuva/messages/thread";
import { RosterTable } from "@/components/yuva/cohort/roster-table";
import { SyllabusView } from "@/components/yuva/cohort/syllabus-view";
import { fetchRunSubmissionsQueue } from "@/components/yuva/submissions/data";
import { ReviewQueue } from "@/components/yuva/submissions/review-queue";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const dynamic = "force-dynamic";

export const metadata = { title: "Cohort" };

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function MentorCohortPage({
  params,
}: {
  params: Promise<{ runId: string }>;
}) {
  const { runId } = await params;
  if (!UUID_PATTERN.test(runId)) {
    notFound();
  }

  // Gate FIRST — assigned mentor (any session of this run) or run manager.
  const gate = await getMentorRunAccess(runId);
  if (!gate.ok) {
    return <Forbidden403 reason={gate.reason} />;
  }

  const [cohort, submissionsQueue] = await Promise.all([
    fetchCohortData(runId),
    fetchRunSubmissionsQueue(runId),
  ]);
  if (!cohort) {
    notFound();
  }

  const activeCount = cohort.roster.filter(
    (r) => r.status !== "dropped"
  ).length;

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 sm:p-6">
      <div className="space-y-3">
        <Link
          href="/youth-academy/mentor"
          className="inline-flex items-center gap-1 text-sm text-slate-500 transition-colors hover:text-slate-900"
        >
          <ArrowLeft className="size-4" />
          Back to dashboard
        </Link>

        <div className="min-w-0">
          <p className="text-xs font-semibold tracking-widest text-amber-600 uppercase">
            Cohort
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold text-slate-900">
              {cohort.run.program_title}
            </h1>
            <Badge
              variant="outline"
              className="border-slate-200 bg-slate-50 text-slate-600"
            >
              {RUN_STATUS_LABELS[cohort.run.status]}
            </Badge>
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-3 text-sm text-slate-500">
            <CategoryBadge category={cohort.run.program_category} />
            <span>
              {cohort.run.academy_name} · Yi {cohort.run.chapter}
            </span>
            <span className="inline-flex items-center gap-1">
              <Users className="size-3.5" />
              {activeCount} student{activeCount === 1 ? "" : "s"}
            </span>
          </div>
        </div>
      </div>

      <Tabs defaultValue="roster">
        <TabsList>
          <TabsTrigger value="roster">Roster</TabsTrigger>
          <TabsTrigger value="messages">Messages</TabsTrigger>
          <TabsTrigger value="submissions">Submissions</TabsTrigger>
        </TabsList>

        <TabsContent value="roster" className="mt-4">
          <RosterTable roster={cohort.roster} />
        </TabsContent>

        <TabsContent value="messages" className="mt-4">
          <CohortThread runId={runId} viewerPersonId={gate.personId} />
        </TabsContent>

        <TabsContent value="submissions" className="mt-4">
          <ReviewQueue sessions={submissionsQueue} />
        </TabsContent>
      </Tabs>

      {/* Read-only syllabus: full schedule + program summary/takeaways */}
      <section className="space-y-3">
        <div>
          <h2 className="font-semibold text-slate-900">Syllabus</h2>
          <p className="mt-0.5 text-sm text-slate-500">
            The full run schedule and program outline — read-only. Session
            scheduling is managed by the chapter.
          </p>
        </div>
        <SyllabusView program={cohort.program} sessions={cohort.sessions} />
      </section>
    </div>
  );
}
