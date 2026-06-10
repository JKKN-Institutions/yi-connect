/**
 * Student — cohort thread for one program (Phase 12) —
 * /youth-academy/me/messages/[runId].
 *
 * Gate (UX layer): the layout verified the signed cookie; here the run must
 * be among the caller's LIVE enrollments (getMyPrograms — active/completed,
 * dropped excluded), else an explicit Forbidden403. Every post re-gates
 * inside sendCohortMessage — the action is the security boundary.
 */

import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Forbidden403 } from "@/app/youth-academy/_components/Forbidden403";
import { getMyPrograms } from "@/app/youth-academy/actions/student";
import { getStudentSession } from "@/lib/yuva/auth/student-session";
import { CohortThread } from "@/components/yuva/messages/thread";

export const dynamic = "force-dynamic";

export const metadata = { title: "Cohort messages" };

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function StudentCohortThreadPage({
  params,
}: {
  params: Promise<{ runId: string }>;
}) {
  const { runId } = await params;
  if (!UUID_PATTERN.test(runId)) {
    notFound();
  }

  const session = await getStudentSession();
  if (!session) {
    redirect("/youth-academy/login?reason=session");
  }

  const programsRes = await getMyPrograms();
  if (!programsRes.success) {
    redirect("/youth-academy/login?reason=session");
  }

  const programs = programsRes.data;
  const program = programs.find((p) => p.runId === runId);
  if (!program) {
    return (
      <Forbidden403 reason="You are not enrolled in this program, so its cohort thread is not available to you." />
    );
  }

  // With one enrollment, /me/messages redirects here — send "back" to the
  // dashboard instead of bouncing between the two pages.
  const backHref =
    programs.length > 1 ? "/youth-academy/me/messages" : "/youth-academy/me";

  return (
    <main className="space-y-6">
      <div className="space-y-3">
        <Link
          href={backHref}
          className="inline-flex items-center gap-1 text-sm text-slate-500 transition-colors hover:text-slate-900"
        >
          <ArrowLeft className="size-4" />
          {programs.length > 1 ? "All threads" : "My programs"}
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            Cohort messages
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {program.programTitle} · {program.academyName} · Yi{" "}
            {program.chapter}
          </p>
        </div>
      </div>

      <CohortThread runId={runId} viewerPersonId={session.personId} />
    </main>
  );
}
