/**
 * Student — Messages (Phase 12) — /youth-academy/me/messages.
 *
 * Per-run thread selector, consistent with Phase 10's stacked-cards
 * approach: zero enrollments → empty state; exactly one → straight into
 * that run's thread; multiple → one card per program linking to its thread.
 */

import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronRight, MessagesSquare } from "lucide-react";
import { getMyPrograms } from "@/app/youth-academy/actions/student";

export const dynamic = "force-dynamic";

export const metadata = { title: "Messages" };

export default async function StudentMessagesPage() {
  const programsRes = await getMyPrograms();
  if (!programsRes.success) {
    // The layout verified the cookie, so a gate failure here means the
    // session died in between — back to login with the message banner.
    redirect("/youth-academy/login?reason=session");
  }

  const programs = programsRes.data;
  if (programs.length === 1) {
    // Single enrollment — straight into the thread (no switcher needed).
    redirect(`/youth-academy/me/messages/${programs[0].runId}`);
  }

  return (
    <main className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Messages</h1>
        <p className="mt-1 text-sm text-slate-500">
          Each program has one shared cohort thread — students, mentors and
          your chapter team.
        </p>
      </div>

      {programs.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 bg-white p-10 text-center">
          <MessagesSquare className="mx-auto size-8 text-slate-300" />
          <p className="mt-3 font-medium text-slate-700">No cohort threads</p>
          <p className="mx-auto mt-1 max-w-sm text-sm text-slate-500">
            Your cohort thread appears here once you are enrolled in a
            program.
          </p>
        </div>
      ) : (
        <div className="grid gap-3">
          {programs.map((program) => (
            <Link
              key={program.enrollmentId}
              href={`/youth-academy/me/messages/${program.runId}`}
              className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-5 transition-colors hover:border-slate-300 hover:bg-slate-50"
            >
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-slate-100">
                  <MessagesSquare className="size-5 text-slate-500" />
                </div>
                <div className="min-w-0">
                  <p className="truncate font-medium text-slate-900">
                    {program.programTitle}
                  </p>
                  <p className="truncate text-sm text-slate-500">
                    {program.academyName} · Yi {program.chapter}
                  </p>
                </div>
              </div>
              <ChevronRight className="size-4 shrink-0 text-slate-400" />
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
