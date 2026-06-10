/**
 * Read-only syllabus view (Phase 11) — the locked Email-1 mentor monitoring
 * requirement: full run schedule + program summary/takeaways, visible to
 * mentors (and managers) on the cohort page. Pure props, server-renderable.
 */

import { BookOpen, CalendarDays, Clock } from "lucide-react";
import type { CohortData, CohortSession } from "@/components/yuva/cohort/data";
import { Badge } from "@/components/ui/badge";

const SESSION_STATUS_STYLES: Record<CohortSession["status"], string> = {
  scheduled: "border-slate-200 bg-slate-50 text-slate-600",
  completed: "border-emerald-200 bg-emerald-50 text-emerald-700",
  cancelled: "border-rose-200 bg-rose-50 text-rose-600",
};

function formatWhen(scheduledAt: string | null): string {
  if (!scheduledAt) return "To be scheduled";
  const d = new Date(scheduledAt);
  if (Number.isNaN(d.getTime())) return "To be scheduled";
  return d.toLocaleString([], {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function SyllabusView({
  program,
  sessions,
}: {
  program: CohortData["program"];
  sessions: CohortSession[];
}) {
  return (
    <div className="space-y-5">
      {/* Program summary + takeaways */}
      {(program.objective || program.summary || program.takeaways.length > 0) && (
        <div className="rounded-lg border border-slate-200 bg-white p-5">
          <h3 className="flex items-center gap-2 font-semibold text-slate-900">
            <BookOpen className="size-4 text-slate-500" />
            About this program
          </h3>
          {program.objective && (
            <p className="mt-2 text-sm font-medium text-slate-700">
              {program.objective}
            </p>
          )}
          {program.summary && (
            <p className="mt-2 text-sm text-slate-600">{program.summary}</p>
          )}
          {program.takeaways.length > 0 && (
            <div className="mt-3">
              <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
                Key takeaways
              </p>
              <ul className="mt-1.5 list-disc space-y-1 pl-5 text-sm text-slate-600">
                {program.takeaways.map((takeaway) => (
                  <li key={takeaway}>{takeaway}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Full run schedule — read-only */}
      <div className="rounded-lg border border-slate-200 bg-white">
        <div className="border-b border-slate-100 px-5 py-3">
          <h3 className="flex items-center gap-2 font-semibold text-slate-900">
            <CalendarDays className="size-4 text-slate-500" />
            Run schedule ({sessions.length} session
            {sessions.length === 1 ? "" : "s"})
          </h3>
        </div>
        {sessions.length === 0 ? (
          <p className="px-5 py-6 text-sm text-slate-500">
            No sessions in this run.
          </p>
        ) : (
          <ol className="divide-y divide-slate-100">
            {sessions.map((session) => (
              <li key={session.id} className="px-5 py-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-900">
                      {session.seq}. {session.name}
                    </p>
                    {session.learning_objective && (
                      <p className="mt-0.5 text-xs text-slate-500">
                        {session.learning_objective}
                      </p>
                    )}
                    <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-slate-500">
                      <span>{formatWhen(session.scheduled_at)}</span>
                      {session.venue && <span>· {session.venue}</span>}
                      <span className="inline-flex items-center gap-1">
                        <Clock className="size-3" />
                        {session.duration_minutes} min
                      </span>
                      <span>
                        · Facilitator: {session.mentor_name ?? "To be announced"}
                      </span>
                    </p>
                    {session.remarks && (
                      <p className="mt-1 text-xs text-slate-400">
                        {session.remarks}
                      </p>
                    )}
                  </div>
                  <Badge
                    variant="outline"
                    className={SESSION_STATUS_STYLES[session.status]}
                  >
                    {session.status}
                  </Badge>
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}
