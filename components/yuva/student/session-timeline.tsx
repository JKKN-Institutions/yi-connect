"use client";

/**
 * Student schedule timeline (Phase 10) — per session: name, learning
 * objective, date/time/venue, facilitator (name + photo), national session
 * DOCUMENT download, mentor MATERIALS downloads, my attendance mark, and an
 * expects-work indicator (My Work portal lands in Phase 13).
 *
 * Downloads call getStudentFileUrl on demand: the action re-verifies the
 * caller's LIVE enrollment and mints a short-lived signed URL (URLs minted
 * at render time would expire while the tab sits open).
 */

import { useState } from "react";
import {
  BookOpen,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Clock,
  Download,
  FileText,
  Loader2,
  MapPin,
  MinusCircle,
  Paperclip,
  Target,
  XCircle,
} from "lucide-react";
import {
  getStudentFileUrl,
  type MyScheduleSession,
  type StudentFileKind,
} from "@/app/youth-academy/actions/student";
import { formatDateTime } from "@/components/yuva/public/format";

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");
}

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h} hr` : `${h} hr ${m} min`;
}

function DownloadButton({
  kind,
  id,
  label,
}: {
  kind: StudentFileKind;
  id: string;
  label: string;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setError(null);
    setLoading(true);
    try {
      const result = await getStudentFileUrl(kind, id);
      if (result.success) {
        window.open(result.data.url, "_blank", "noopener");
      } else {
        setError(result.error);
      }
    } catch {
      setError("Download failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <span className="inline-flex flex-col">
      <button
        type="button"
        onClick={handleClick}
        disabled={loading}
        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-60"
      >
        {loading ? (
          <Loader2 className="size-3.5 animate-spin" />
        ) : kind === "session_document" ? (
          <FileText className="size-3.5" />
        ) : (
          <Download className="size-3.5" />
        )}
        {label}
      </button>
      {error && (
        <span className="mt-1 text-xs text-red-600" role="alert">
          {error}
        </span>
      )}
    </span>
  );
}

function AttendanceMark({ value }: { value: boolean | null }) {
  if (value === true) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
        <CheckCircle2 className="size-3.5" />
        Present
      </span>
    );
  }
  if (value === false) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-600">
        <XCircle className="size-3.5" />
        Absent
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">
      <MinusCircle className="size-3.5" />
      Not marked
    </span>
  );
}

const STATUS_BADGE: Record<MyScheduleSession["status"], string> = {
  scheduled: "bg-blue-50 text-blue-700",
  completed: "bg-emerald-50 text-emerald-700",
  cancelled: "bg-slate-100 text-slate-500 line-through",
};

export function SessionTimeline({
  sessions,
}: {
  sessions: MyScheduleSession[];
}) {
  if (sessions.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-slate-200 bg-white p-6 text-center text-sm text-slate-500">
        The session schedule will appear here once your chapter publishes it.
      </p>
    );
  }

  return (
    <ol className="space-y-4">
      {sessions.map((session) => (
        <li
          key={session.id}
          className="relative rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-900 text-xs font-semibold text-white">
                  {session.seq}
                </span>
                <h3 className="font-semibold text-slate-900">
                  {session.name}
                </h3>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${STATUS_BADGE[session.status]}`}
                >
                  {session.status}
                </span>
              </div>

              {session.learningObjective && (
                <p className="mt-2 flex items-start gap-1.5 text-sm text-slate-600">
                  <Target className="mt-0.5 size-3.5 shrink-0 text-slate-400" />
                  {session.learningObjective}
                </p>
              )}

              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-500">
                <span className="inline-flex items-center gap-1.5">
                  <CalendarDays className="size-3.5 shrink-0" />
                  {formatDateTime(session.scheduledAt) ?? "Date to be announced"}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Clock className="size-3.5 shrink-0" />
                  {formatDuration(session.durationMinutes)}
                </span>
                {session.venue && (
                  <span className="inline-flex items-center gap-1.5">
                    <MapPin className="size-3.5 shrink-0" />
                    {session.venue}
                  </span>
                )}
              </div>
            </div>

            {/* Facilitator */}
            <div className="flex items-center gap-2.5">
              {session.mentor ? (
                <>
                  {session.mentor.photoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={session.mentor.photoUrl}
                      alt={session.mentor.name}
                      className="h-9 w-9 rounded-full object-cover"
                    />
                  ) : (
                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-200 text-xs font-semibold text-slate-600">
                      {initials(session.mentor.name)}
                    </span>
                  )}
                  <div className="text-sm">
                    <p className="font-medium text-slate-900">
                      {session.mentor.name}
                    </p>
                    <p className="text-xs text-slate-500">Facilitator</p>
                  </div>
                </>
              ) : (
                <p className="text-xs text-slate-400">
                  Facilitator to be announced
                </p>
              )}
            </div>
          </div>

          {/* Footer: attendance, expects-work, downloads */}
          <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
            <AttendanceMark value={session.myAttendance} />
            {session.expectsSubmission && (
              <span
                className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700"
                title="My Work submissions open soon"
              >
                <ClipboardList className="size-3.5" />
                Expects work — My Work opens soon
              </span>
            )}
            <span className="grow" />
            {session.hasDocument && (
              <DownloadButton
                kind="session_document"
                id={session.id}
                label="Session document"
              />
            )}
            {session.materials.map((material) => (
              <DownloadButton
                key={material.id}
                kind="material"
                id={material.id}
                label={material.title}
              />
            ))}
            {!session.hasDocument && session.materials.length === 0 && (
              <span className="inline-flex items-center gap-1 text-xs text-slate-400">
                <Paperclip className="size-3.5" />
                No materials yet
              </span>
            )}
          </div>

          {session.description && (
            <details className="mt-3">
              <summary className="cursor-pointer text-xs font-medium text-slate-500 hover:text-slate-700">
                <BookOpen className="mr-1 inline size-3.5" />
                About this session
              </summary>
              <p className="mt-2 whitespace-pre-line text-sm text-slate-600">
                {session.description}
              </p>
            </details>
          )}
        </li>
      ))}
    </ol>
  );
}
