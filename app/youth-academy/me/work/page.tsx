/**
 * Student "My Work" (Phase 13) — /youth-academy/me/work.
 *
 * One card per expects_submission session of each ACTIVE enrollment:
 * session name, due context (session date + grace note), status
 * (draft/submitted/reviewed/missing), late badge, mentor feedback when
 * reviewed, and the editor (text + file, save draft / submit with confirm).
 *
 * Gate: the layout verified the signed cookie; this page re-verifies via
 * getStudentSession() and the data layer keys everything off the LIVE
 * person → active-enrollment lookup. Every mutation re-gates itself in
 * app/youth-academy/actions/submissions.ts.
 */

import { redirect } from "next/navigation";
import { ClipboardList } from "lucide-react";
import { getStudentSession } from "@/lib/yuva/auth/student-session";
import { fetchMyWork } from "@/components/yuva/submissions/data";
import { WorkCard } from "@/components/yuva/submissions/work-card";
import { CategoryBadge } from "@/components/yuva/national/category-badge";

export const dynamic = "force-dynamic";

export const metadata = { title: "My work" };

export default async function MyWorkPage() {
  const session = await getStudentSession();
  if (!session) {
    redirect("/youth-academy/login?reason=session");
  }

  const programs = await fetchMyWork(session.personId);
  const totalSlots = programs.reduce((n, p) => n + p.sessions.length, 0);

  return (
    <main className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">My work</h1>
        <p className="mt-1 text-sm text-slate-500">
          {totalSlots === 0
            ? "Sessions that expect a submission will appear here."
            : "One slot per session that expects work — save drafts, submit when ready, and read your mentor's feedback."}
        </p>
      </div>

      {totalSlots === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 bg-white p-10 text-center">
          <ClipboardList className="mx-auto size-8 text-slate-300" />
          <p className="mt-3 font-medium text-slate-700">Nothing due yet</p>
          <p className="mx-auto mt-1 max-w-sm text-sm text-slate-500">
            None of your program&apos;s sessions expects a submission right
            now. Check back after your next session.
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {programs
            .filter((p) => p.sessions.length > 0)
            .map((program) => (
              <section key={program.enrollmentId} className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="font-semibold text-slate-900">
                    {program.programTitle}
                  </h2>
                  <CategoryBadge category={program.programCategory} />
                  <span className="text-sm text-slate-500">
                    {program.academyName}
                  </span>
                </div>
                <div className="grid gap-3">
                  {program.sessions.map((s) => (
                    <WorkCard key={s.runSessionId} session={s} />
                  ))}
                </div>
              </section>
            ))}
        </div>
      )}
    </main>
  );
}
