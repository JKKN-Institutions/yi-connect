"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/yip/ui/card";
import { Button, buttonVariants } from "@/components/yip/ui/button";
import {
  CheckCircle2,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  RefreshCw,
  ArrowRight,
  Compass,
  UserX,
} from "lucide-react";
import {
  getEventReadiness,
  type EventReadiness,
} from "@/app/yip/actions/event-readiness";
import {
  getUnmarkedStudents,
  type UnmarkedStudent,
  type UnmarkedStudents,
} from "@/app/yip/actions/unmarked-students";
import { INK, SAFFRON, SERIF } from "@/app/yip/me/credential-ui";

/**
 * "Mission Control" — a NON-BLOCKING, volunteer-facing readiness board at the
 * top of the live control panel. It reads the event's real data, shows one
 * "your next step" pointer + a full ✅/⚠ checklist with deep-links, and
 * auto-refreshes. It never blocks any action — purely a guide.
 */
export function MissionControl({ eventId }: { eventId: string }) {
  const [data, setData] = useState<EventReadiness | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [isPending, startTransition] = useTransition();

  const load = useCallback(() => {
    startTransition(async () => {
      const r = await getEventReadiness(eventId);
      setData(r);
      setLoaded(true);
    });
  }, [eventId]);

  useEffect(() => {
    load();
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
  }, [load]);

  // Organisers only (null = no manage access). Render nothing otherwise.
  if (loaded && !data) return null;

  const pct = data
    ? Math.round((data.okCount / Math.max(1, data.totalCount)) * 100)
    : 0;

  return (
    <div className="space-y-4">
    <Card className="border-indigo-200/70 overflow-hidden">
      <div className="h-1 w-full bg-gradient-to-r from-indigo-500 to-sky-400" />
      <CardContent className="pt-4 pb-4 space-y-3">
        {/* Header */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Compass className="size-5 text-indigo-600" />
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.16em]" style={{ color: SAFFRON }}>READINESS</p>
              <h2 className="text-sm font-bold" style={{ ...SERIF, color: INK }}>Mission Control</h2>
              <p className="text-xs text-gray-500">
                {data
                  ? `${data.okCount} of ${data.totalCount} steps ready`
                  : "Checking readiness…"}
              </p>
            </div>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={load}
            disabled={isPending}
          >
            <RefreshCw className={`size-3.5 ${isPending ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>

        {/* Progress bar */}
        <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
          <div
            className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-emerald-400 transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>

        {/* Next step banner */}
        {data?.nextStep ? (
          <div className="rounded-lg border border-amber-300 bg-amber-50 p-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-700">
              Your next step
            </p>
            <div className="mt-1 flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-amber-900">
                  {data.nextStep.label}
                </p>
                <p className="text-xs text-amber-700">{data.nextStep.phase}</p>
              </div>
              {data.nextStep.href && (
                <Link
                  href={data.nextStep.href}
                  className={`${buttonVariants({ size: "sm" })} shrink-0`}
                >
                  Take me there <ArrowRight className="size-3.5" />
                </Link>
              )}
            </div>
          </div>
        ) : data ? (
          <div className="flex items-center gap-2 rounded-lg border border-emerald-300 bg-emerald-50 p-3">
            <CheckCircle2 className="size-4 text-emerald-600" />
            <p className="text-sm font-medium text-emerald-900">
              All steps ready — you&apos;re good to go!
            </p>
          </div>
        ) : null}

        <p className="text-[11px] text-gray-400">
          This is a guide — it never blocks you. You can run any step at any time.
        </p>

        {/* Full checklist toggle */}
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="flex w-full items-center justify-between rounded-md px-1 py-1 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          <span>{expanded ? "Hide" : "Show"} full checklist</span>
          {expanded ? (
            <ChevronDown className="size-4" />
          ) : (
            <ChevronRight className="size-4" />
          )}
        </button>

        {expanded && data && (
          <div className="space-y-4">
            {data.phases.map((phase) => (
              <div key={phase.name}>
                <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                  {phase.name}
                </p>
                <div className="divide-y divide-gray-100 rounded-lg border border-gray-100">
                  {phase.items.map((it) => (
                    <div key={it.key} className="flex items-center gap-3 px-3 py-2">
                      {it.ok ? (
                        <CheckCircle2 className="size-4 shrink-0 text-emerald-500" />
                      ) : (
                        <AlertTriangle className="size-4 shrink-0 text-amber-500" />
                      )}
                      <div className="min-w-0 flex-1">
                        <p
                          className={`text-sm ${it.ok ? "text-gray-700" : "font-medium text-gray-900"}`}
                        >
                          {it.label}
                        </p>
                        <p className="text-xs text-gray-500">{it.detail}</p>
                      </div>
                      {!it.ok && it.href && (
                        <Link
                          href={it.href}
                          className="shrink-0 whitespace-nowrap text-xs font-medium text-indigo-600 hover:underline"
                        >
                          Fix this →
                        </Link>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
      <UnmarkedStudentsPanel eventId={eventId} />
    </div>
  );
}

/**
 * "Nobody has marked these students yet" — the live half of Director ruling 08
 * (2026-08-29), after 28 of 196 students went home from the SRTN Regional Round
 * with no submitted mark and nobody saw it until the judges had left.
 *
 * Deliberately a SEPARATE card from the readiness board above, not another item
 * in its checklist: PR #915 put a scoring finding into that checklist and it was
 * rejected for hijacking the live "your next step" pointer with a nag that could
 * never be satisfied while scoring was in progress (see lib/yip/results-missing.ts).
 * This panel touches neither the pointer nor the step count. Like the rest of
 * Mission Control it WARNS and never blocks.
 *
 * It shows the ABSENCE of a mark only — never a mark, a score, an average, a
 * rank or a count of marks — which is why it can be gated on canManage and
 * still be seen by the chapter organiser standing in the chamber, the only
 * person who can actually send a judge. See the header of
 * app/yip/actions/unmarked-students.ts.
 */
function UnmarkedStudentsPanel({ eventId }: { eventId: string }) {
  const [data, setData] = useState<UnmarkedStudents | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [isPending, startTransition] = useTransition();

  const load = useCallback(() => {
    startTransition(async () => {
      const r = await getUnmarkedStudents(eventId);
      setData(r);
      setLoaded(true);
    });
  }, [eventId]);

  useEffect(() => {
    load();
    const t = setInterval(load, 60000);
    return () => clearInterval(t);
  }, [load]);

  // Organisers only (null = no manage access). Render nothing otherwise.
  if (!loaded || !data) return null;

  const { couldNotCheck, noMarkAtAll, sessions, totalParticipants } = data;

  // A panel that cannot trust its own read must say so. Staying silent here
  // would read as "all clear", which is the exact failure this panel exists to
  // prevent.
  if (couldNotCheck) {
    return (
      <Card className="border-gray-200 overflow-hidden">
        <CardContent className="flex items-center gap-2 py-3">
          <AlertTriangle className="size-4 shrink-0 text-gray-400" />
          <p className="text-sm text-gray-600">{couldNotCheck}</p>
        </CardContent>
      </Card>
    );
  }

  const present = noMarkAtAll.filter((s) => s.wasPresent);
  const absent = noMarkAtAll.length - present.length;
  const sessionGaps = sessions.reduce((n, s) => n + s.unmarked, 0);
  const unmarkedSessions = sessions.filter((s) => s.noMarksAtAll);

  // All clear — say so quietly, so an organiser can tell "checked, nothing to
  // do" apart from "this panel never loaded".
  if (noMarkAtAll.length === 0 && sessions.length === 0) {
    return (
      <Card className="border-emerald-200 overflow-hidden">
        <CardContent className="flex items-center gap-2 py-3">
          <CheckCircle2 className="size-4 shrink-0 text-emerald-600" />
          <p className="text-sm text-emerald-900">
            Every student has at least one mark
            {totalParticipants > 0 ? ` (all ${totalParticipants})` : ""}.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-amber-300 overflow-hidden">
      <div className="h-1 w-full bg-gradient-to-r from-amber-500 to-orange-400" />
      <CardContent className="space-y-3 pt-4 pb-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-start gap-2">
            <UserX className="mt-0.5 size-5 shrink-0 text-amber-600" />
            <div>
              <p
                className="text-[10px] font-bold uppercase tracking-[0.16em]"
                style={{ color: SAFFRON }}
              >
                STILL TO BE MARKED
              </p>
              <h2 className="text-sm font-bold" style={{ ...SERIF, color: INK }}>
                Students nobody has marked yet
              </h2>
              <p className="text-xs text-gray-500">
                {present.length > 0
                  ? `${present.length} student${present.length === 1 ? "" : "s"} in the House ${present.length === 1 ? "has" : "have"} no mark at all`
                  : noMarkAtAll.length > 0
                    ? `${noMarkAtAll.length} student${noMarkAtAll.length === 1 ? "" : "s"} with no mark — none of them checked in`
                    : `${sessionGaps} speaking slot${sessionGaps === 1 ? "" : "s"} with no mark`}
              </p>
            </div>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={load}
            disabled={isPending}
          >
            <RefreshCw className={`size-3.5 ${isPending ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>

        {present.length > 0 && (
          <div className="rounded-lg border border-amber-300 bg-amber-50 p-3">
            <p className="text-sm font-medium text-amber-900">
              Send a judge to these {present.length === 1 ? "student" : "students"} before the round ends.
            </p>
            <p className="mt-1 text-xs text-amber-700">
              They checked in, so they are here — but no judge has saved a mark
              for them. Once everyone goes home this cannot be put right.
            </p>
          </div>
        )}

        {absent > 0 && (
          <p className="text-xs text-gray-500">
            {absent} more {absent === 1 ? "student has" : "students have"} no mark
            and never checked in — they will show in the results as not marked.
          </p>
        )}

        {unmarkedSessions.length > 0 && (
          <div className="rounded-lg border border-amber-200 bg-white p-3">
            <p className="text-sm font-medium text-amber-900">
              {unmarkedSessions.length === 1
                ? "This session has run with no marks saved at all:"
                : "These sessions have run with no marks saved at all:"}
            </p>
            <ul className="mt-1 list-inside list-disc text-xs text-gray-600">
              {unmarkedSessions.map((s) => (
                <li key={s.agendaItemId}>{s.label}</li>
              ))}
            </ul>
          </div>
        )}

        <p className="text-[11px] text-gray-400">
          This is a warning — it never blocks you. It shows who has no mark, never
          anyone&apos;s marks.
        </p>

        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="flex w-full items-center justify-between rounded-md px-1 py-1 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          <span>{expanded ? "Hide" : "Show"} who is missing</span>
          {expanded ? (
            <ChevronDown className="size-4" />
          ) : (
            <ChevronRight className="size-4" />
          )}
        </button>

        {expanded && (
          <div className="space-y-4">
            {noMarkAtAll.length > 0 && (
              <div>
                <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                  No mark anywhere in this round ({noMarkAtAll.length})
                </p>
                <StudentList students={noMarkAtAll} />
              </div>
            )}
            {sessions
              .filter((s) => s.students.length > 0)
              .map((s) => (
                <div key={s.agendaItemId}>
                  <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                    {s.label} — {s.unmarked} of {s.listed} on the speaking list
                    not marked
                  </p>
                  <StudentList students={s.students} />
                </div>
              ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/** Names only — no mark, no score, no rank. */
function StudentList({ students }: { students: UnmarkedStudent[] }) {
  return (
    <div className="divide-y divide-gray-100 rounded-lg border border-gray-100">
      {students.map((s) => (
        <div
          key={s.participantId}
          className="flex items-center gap-3 px-3 py-2"
        >
          {s.wasPresent ? (
            <AlertTriangle className="size-4 shrink-0 text-amber-500" />
          ) : (
            <UserX className="size-4 shrink-0 text-gray-300" />
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-gray-900">
              {s.participantName}
            </p>
            <p className="truncate text-xs text-gray-500">
              {[s.constituencyName, s.schoolName].filter(Boolean).join(" · ") ||
                "—"}
            </p>
          </div>
          <span className="shrink-0 whitespace-nowrap text-xs text-gray-400">
            {s.presenceLabel}
          </span>
        </div>
      ))}
    </div>
  );
}
