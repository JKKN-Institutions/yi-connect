/**
 * Student dashboard (Phase 10) — /youth-academy/me.
 *
 * One self-contained card per enrollment (program title + academy, next
 * session, progress bar, certificate state, link to the full schedule).
 * Multiple enrollments render as a stacked card list — every program is
 * visible at once (the spec's "program switcher" need, without hiding any
 * program behind a toggle).
 */

import { redirect } from "next/navigation";
import { GraduationCap } from "lucide-react";
import { ModuleWelcome } from "@/app/youth-academy/_components/ModuleWelcome";
import {
  getMyPrograms,
  getMyProgress,
  getMySchedule,
  type MyProgram,
  type MyProgress,
} from "@/app/youth-academy/actions/student";
import {
  ProgramCard,
  type NextSessionInfo,
} from "@/components/yuva/student/program-card";

export const dynamic = "force-dynamic";

type CardData = {
  program: MyProgram;
  progress: MyProgress | null;
  nextSession: NextSessionInfo;
};

async function loadCard(program: MyProgram): Promise<CardData> {
  const [scheduleRes, progressRes] = await Promise.all([
    getMySchedule(program.runId),
    getMyProgress(program.runId),
  ]);

  let nextSession: NextSessionInfo = null;
  if (scheduleRes.success) {
    const now = Date.now();
    const upcoming = scheduleRes.data.sessions
      .filter(
        (s) =>
          s.status === "scheduled" &&
          (!s.scheduledAt || new Date(s.scheduledAt).getTime() >= now)
      )
      .sort((a, b) => {
        // Dated upcoming sessions first (soonest first), undated last.
        if (a.scheduledAt && b.scheduledAt) {
          return (
            new Date(a.scheduledAt).getTime() -
            new Date(b.scheduledAt).getTime()
          );
        }
        if (a.scheduledAt) return -1;
        if (b.scheduledAt) return 1;
        return a.seq - b.seq;
      })[0];
    if (upcoming) {
      nextSession = {
        name: upcoming.name,
        scheduledAt: upcoming.scheduledAt,
        venue: upcoming.venue,
        mentorName: upcoming.mentor?.name ?? null,
      };
    }
  }

  return {
    program,
    progress: progressRes.success ? progressRes.data : null,
    nextSession,
  };
}

export default async function StudentDashboardPage() {
  const programsRes = await getMyPrograms();
  if (!programsRes.success) {
    // The layout verified the cookie, so a gate failure here means the
    // session died in between — back to login with the message banner.
    redirect("/youth-academy/login?reason=session");
  }

  const programs = programsRes.data;
  const cards = await Promise.all(programs.map(loadCard));

  return (
    <main className="space-y-6">
      <ModuleWelcome
        moduleKey="student-home"
        lane="student"
        title="Welcome to Yi Youth Academy"
        body="This is your home base — your enrolled programs, sessions, and progress all live here. Here's a quick tour of how it works."
        cta={{ label: "Show me how", href: "/youth-academy/guide?lane=student" }}
      />
      <div>
        <h1 className="text-2xl font-bold text-slate-900">My programs</h1>
        <p className="mt-1 text-sm text-slate-500">
          {programs.length === 0
            ? "Your enrollments will appear here."
            : programs.length === 1
              ? "Your enrolled program at a glance."
              : `You are enrolled in ${programs.length} programs.`}
        </p>
      </div>

      {programs.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 bg-white p-10 text-center">
          <GraduationCap className="mx-auto size-8 text-slate-300" />
          <p className="mt-3 font-medium text-slate-700">
            No active enrollment found
          </p>
          <p className="mx-auto mt-1 max-w-sm text-sm text-slate-500">
            If you were recently accepted, your cohort may not have been
            formed yet. Contact your chapter coordinator if you believe this
            is a mistake.
          </p>
        </div>
      ) : (
        <div className="grid gap-5">
          {cards.map((card) => (
            <ProgramCard
              key={card.program.enrollmentId}
              program={card.program}
              progress={card.progress}
              nextSession={card.nextSession}
            />
          ))}
        </div>
      )}
    </main>
  );
}
