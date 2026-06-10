/**
 * Yi Youth Academy — PUBLIC run detail (Phase 8).
 * Spec: docs/yi-youth-academy-spec.md → "Run detail (public)".
 *
 * Only published+ statuses render (published / applications_closed /
 * in_progress / completed / certified) — draft & cancelled → notFound(),
 * which also covers "run unpublished after publish" (applicants keep their
 * tokenized status page). Sessions without an assigned mentor show
 * "Mentor to be announced".
 */

import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  Building2,
  CalendarDays,
  CheckCircle2,
  Clock,
  MapPin,
  Megaphone,
  Target,
  Users,
} from "lucide-react";
import { CategoryBadge } from "@/components/yuva/national/category-badge";
import {
  fetchPublicRunDetail,
  type ApplyState,
} from "@/components/yuva/public/data";
import {
  formatDate,
  formatDateRange,
  formatDateTime,
  formatDuration,
  formatHours,
  formatTime,
} from "@/components/yuva/public/format";

export const dynamic = "force-dynamic";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const CLOSED_REASON: Record<Exclude<ApplyState, "open">, string> = {
  not_yet_open: "Applications haven't opened yet",
  closed_deadline: "The application deadline has passed",
  closed_full: "All seats for this cohort are taken",
  closed_status: "This cohort is no longer accepting applications",
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ runId: string }>;
}) {
  const { runId } = await params;
  if (!UUID_RE.test(runId)) return { title: "Program" };
  const run = await fetchPublicRunDetail(runId);
  if (!run) return { title: "Program" };
  return {
    title: run.program.title,
    description:
      run.program.summary ??
      `A Yi Youth Academy certificate program at ${run.academy.display_name}.`,
  };
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");
}

export default async function PublicRunDetailPage({
  params,
}: {
  params: Promise<{ runId: string }>;
}) {
  const { runId } = await params;
  if (!UUID_RE.test(runId)) notFound();

  const run = await fetchPublicRunDetail(runId);
  if (!run) notFound();

  const isOpen = run.state === "open";
  const seatsLeft = Math.max(run.capacity - run.accepted_count, 0);
  const dates = formatDateRange(run.start_date, run.end_date);
  const hours = formatHours(run.total_minutes);
  const openAt = formatDateTime(run.apply_open_at);
  const closeAt = formatDateTime(run.apply_close_at);
  const announce = formatDate(run.cohort_announce_date);

  return (
    <main className="min-h-screen bg-slate-50">
      {/* ── Header ───────────────────────────────────────────────────── */}
      <header className="bg-[#0f2557] text-white">
        <div className="mx-auto max-w-6xl px-6 py-10">
          <Link
            href="/youth-academy"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-300 hover:text-white"
          >
            <ArrowLeft className="size-4" />
            All programs
          </Link>
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <CategoryBadge category={run.program.category} />
            {!isOpen && (
              <span className="rounded-full bg-white/10 px-2.5 py-0.5 text-xs font-medium text-slate-200">
                {CLOSED_REASON[run.state as Exclude<ApplyState, "open">]}
              </span>
            )}
          </div>
          <h1 className="mt-3 max-w-3xl text-3xl font-bold sm:text-4xl">
            {run.program.title}
          </h1>
          <p className="mt-2 flex items-center gap-2 text-slate-300">
            <MapPin className="size-4 shrink-0" />
            {run.academy.display_name}
            {run.academy.city ? ` · ${run.academy.city}` : ""}
          </p>
        </div>
      </header>

      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-8 px-6 py-10 lg:grid-cols-[1fr_340px]">
        {/* ── Main column ───────────────────────────────────────────── */}
        <div className="space-y-10">
          {/* About */}
          <section>
            <h2 className="text-xl font-bold text-slate-900">
              About this program
            </h2>
            {run.program.summary && (
              <p className="mt-3 whitespace-pre-line leading-relaxed text-slate-600">
                {run.program.summary}
              </p>
            )}
            {run.program.objective && (
              <div className="mt-4 flex gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
                <Target className="mt-0.5 size-5 shrink-0 text-amber-600" />
                <div>
                  <h3 className="text-sm font-semibold text-amber-900">
                    Program objective
                  </h3>
                  <p className="mt-1 text-sm leading-relaxed text-amber-800">
                    {run.program.objective}
                  </p>
                </div>
              </div>
            )}
          </section>

          {/* Takeaways */}
          {run.program.takeaways.length > 0 && (
            <section>
              <h2 className="text-xl font-bold text-slate-900">
                What you&apos;ll take away
              </h2>
              <ul className="mt-4 space-y-2.5">
                {run.program.takeaways.map((t, i) => (
                  <li key={i} className="flex gap-2.5 text-slate-600">
                    <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-500" />
                    <span>{t}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Schedule */}
          <section>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-xl font-bold text-slate-900">
                Session schedule
              </h2>
              {hours && (
                <span className="text-sm text-slate-500">
                  {run.sessions.length} session
                  {run.sessions.length === 1 ? "" : "s"} · {hours} total
                </span>
              )}
            </div>
            {run.sessions.length === 0 ? (
              <p className="mt-4 text-sm text-slate-500">
                The session schedule will be published soon.
              </p>
            ) : (
              <ol className="mt-5 space-y-3">
                {run.sessions.map((session) => {
                  const day = formatDate(session.scheduled_at);
                  const time = formatTime(session.scheduled_at);
                  return (
                    <li
                      key={session.id}
                      className="rounded-xl border border-slate-200 bg-white p-4"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="flex min-w-0 gap-3">
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-900 text-sm font-semibold text-white">
                            {session.seq}
                          </span>
                          <div className="min-w-0">
                            <h3 className="font-semibold text-slate-900">
                              {session.name}
                            </h3>
                            <p className="mt-0.5 text-sm text-slate-500">
                              {day ? `${day}${time ? ` · ${time}` : ""}` : "Date to be announced"}
                              {" · "}
                              {formatDuration(session.duration_minutes)}
                              {session.venue ? ` · ${session.venue}` : ""}
                            </p>
                            {session.learning_objective && (
                              <p className="mt-1.5 text-sm text-slate-600">
                                {session.learning_objective}
                              </p>
                            )}
                          </div>
                        </div>

                        {session.mentor ? (
                          <Link
                            href="/youth-academy/mentors"
                            className="flex shrink-0 items-center gap-2 rounded-lg border border-slate-100 bg-slate-50 px-2.5 py-1.5 transition-colors hover:bg-slate-100"
                          >
                            {session.mentor.photoUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={session.mentor.photoUrl}
                                alt={session.mentor.name}
                                className="h-8 w-8 rounded-full border border-slate-200 object-cover"
                              />
                            ) : (
                              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-900 text-xs font-semibold text-white">
                                {initials(session.mentor.name)}
                              </span>
                            )}
                            <span className="max-w-36 truncate text-sm font-medium text-slate-700">
                              {session.mentor.name}
                            </span>
                          </Link>
                        ) : (
                          <span className="shrink-0 rounded-lg border border-dashed border-slate-200 px-2.5 py-1.5 text-xs text-slate-400">
                            Mentor to be announced
                          </span>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
          </section>
        </div>

        {/* ── Sidebar ───────────────────────────────────────────────── */}
        <aside className="space-y-5 lg:sticky lg:top-6 lg:self-start">
          {/* Apply card */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <dl className="space-y-3 text-sm">
              {dates && (
                <div className="flex items-center gap-2.5 text-slate-600">
                  <CalendarDays className="size-4 shrink-0 text-slate-400" />
                  <span>{dates}</span>
                </div>
              )}
              {hours && (
                <div className="flex items-center gap-2.5 text-slate-600">
                  <Clock className="size-4 shrink-0 text-slate-400" />
                  <span>{hours} of sessions</span>
                </div>
              )}
              <div className="flex items-center gap-2.5 text-slate-600">
                <Users className="size-4 shrink-0 text-slate-400" />
                <span>
                  {seatsLeft} of {run.capacity} seats left
                </span>
              </div>
              {(openAt || closeAt) && (
                <div className="flex items-start gap-2.5 text-slate-600">
                  <Megaphone className="mt-0.5 size-4 shrink-0 text-slate-400" />
                  <span>
                    {openAt ? `Applications open ${openAt}` : null}
                    {openAt && closeAt ? <br /> : null}
                    {closeAt ? `Apply by ${closeAt}` : null}
                  </span>
                </div>
              )}
            </dl>

            {announce && (
              <p className="mt-4 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">
                Results announced by <strong>{announce}</strong>
              </p>
            )}

            {isOpen ? (
              <Link
                href={`/youth-academy/apply/${run.id}`}
                className="mt-5 flex w-full items-center justify-center rounded-lg bg-amber-500 px-4 py-2.5 text-sm font-semibold text-slate-900 transition-colors hover:bg-amber-400"
              >
                Apply now
              </Link>
            ) : (
              <div className="mt-5">
                <button
                  type="button"
                  disabled
                  className="flex w-full cursor-not-allowed items-center justify-center rounded-lg bg-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-500"
                >
                  Apply now
                </button>
                <p className="mt-2 text-center text-xs text-slate-500">
                  {CLOSED_REASON[run.state as Exclude<ApplyState, "open">]}.
                </p>
              </div>
            )}
          </div>

          {/* Academy block */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-sm font-semibold text-slate-900">
              Hosted at
            </h3>
            <div className="mt-3 flex items-center gap-3">
              {run.academy.logo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={run.academy.logo_url}
                  alt={`${run.academy.display_name} logo`}
                  className="h-14 w-14 shrink-0 rounded-lg border border-slate-200 bg-white object-contain p-1"
                />
              ) : (
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-slate-900 text-white">
                  <Building2 className="size-6" />
                </div>
              )}
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-900">
                  {run.academy.display_name}
                </p>
                <p className="truncate text-xs text-slate-500">
                  Yi {run.academy.chapter}
                  {run.academy.institution_name
                    ? ` · ${run.academy.institution_name}`
                    : ""}
                </p>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </main>
  );
}
