/**
 * Mentor — session detail (Phase 11).
 * Spec: docs/yi-youth-academy-spec.md → "Mentor — dashboard / sessions /
 * cohort": session info, national session document download, roster with
 * the attendance grid (present/absent + save, locked state with reason),
 * session materials (list + upload + delete).
 *
 * Gate: getMentorSessionAccess(id) — assigned mentor OR run manager.
 * Explicit Forbidden403 with the reason, never a redirect.
 */

import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  CalendarDays,
  ClipboardCheck,
  Clock,
  FileDown,
  FolderOpen,
  MapPin,
  StickyNote,
  Target,
  Users,
} from "lucide-react";
import { Forbidden403 } from "@/app/youth-academy/_components/Forbidden403";
import {
  canEditAttendance,
} from "@/lib/yuva/attendance-lock";
import { getMentorSessionAccess } from "@/lib/yuva/auth/mentor-access";
import type { RunStatus } from "@/lib/yuva/constants";
import { createSignedUrl } from "@/lib/yuva/storage";
import { createServiceClient } from "@/lib/yuva/supabase/service";
import { createServiceClient as createDirService } from "@/lib/yip/supabase/server";
import { AttendanceGrid } from "@/components/yuva/attendance/attendance-grid";
import {
  fetchAttendanceReopenedUntil,
  fetchSessionRoster,
} from "@/components/yuva/attendance/data";
import { AttendanceLockBanner } from "@/components/yuva/attendance/lock-banner";
import { MaterialsList } from "@/components/yuva/materials/materials-list";
import { MaterialUpload } from "@/components/yuva/materials/material-upload";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

export const metadata = { title: "Session" };

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const SESSION_STATUS_STYLES: Record<string, string> = {
  scheduled: "border-slate-200 bg-slate-50 text-slate-600",
  completed: "border-emerald-200 bg-emerald-50 text-emerald-700",
  cancelled: "border-rose-200 bg-rose-50 text-rose-600",
};

function formatWhen(scheduledAt: string | null): string {
  if (!scheduledAt) return "To be scheduled";
  const d = new Date(scheduledAt);
  if (Number.isNaN(d.getTime())) return "To be scheduled";
  return d.toLocaleString([], {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function MentorSessionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!UUID_PATTERN.test(id)) {
    notFound();
  }

  // Gate FIRST — assigned mentor or run manager; everyone else gets the
  // explicit reason (unassigned session id → Forbidden403, per spec).
  const gate = await getMentorSessionAccess(id);
  if (!gate.ok) {
    return <Forbidden403 reason={gate.reason} />;
  }

  const svc = await createServiceClient();
  const { data: session } = await svc
    .from("run_sessions")
    .select(
      "id, run_id, seq, name, duration_minutes, learning_objective, document_storage_path, scheduled_at, venue, remarks, status, runs ( id, status, chapter, program_id, academy_id )"
    )
    .eq("id", id)
    .maybeSingle();
  if (!session || !session.runs) {
    notFound();
  }
  const run = session.runs;

  const [programRes, academyRes, roster, materialsRes, reopenedUntil] =
    await Promise.all([
      svc
        .from("programs")
        .select("title")
        .eq("id", run.program_id)
        .maybeSingle(),
      svc
        .from("academies")
        .select("display_name")
        .eq("id", run.academy_id)
        .maybeSingle(),
      fetchSessionRoster(run.id, session.id),
      svc
        .from("materials")
        .select("id, title, created_at, uploaded_by")
        .eq("run_session_id", session.id)
        .order("created_at", { ascending: false }),
      fetchAttendanceReopenedUntil(run.id),
    ]);

  // Attendance lock — pure decision over run status + audited reopen flag.
  const lock = canEditAttendance(run.status as RunStatus, !!reopenedUntil);

  // National session document (course material) — short-lived signed URL.
  let documentUrl: string | null = null;
  if (session.document_storage_path) {
    const signed = await createSignedUrl(
      "yuva-materials",
      session.document_storage_path
    );
    if (signed.ok) documentUrl = signed.url;
  }

  // Uploader names for the materials list.
  const materials = materialsRes.data ?? [];
  const uploaderIds = [
    ...new Set(
      materials.map((m) => m.uploaded_by).filter((p): p is string => !!p)
    ),
  ];
  const uploaderNameById = new Map<string, string>();
  if (uploaderIds.length > 0) {
    const dir = await createDirService();
    const { data: people } = await dir
      .schema("yi_directory")
      .from("people")
      .select("id, full_name")
      .in("id", uploaderIds);
    for (const p of people ?? []) {
      uploaderNameById.set(p.id, p.full_name ?? "—");
    }
  }

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

        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold tracking-widest text-amber-600 uppercase">
              Session {session.seq} · {programRes.data?.title ?? "Program"}
            </p>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold text-slate-900">
                {session.name}
              </h1>
              <Badge
                variant="outline"
                className={
                  SESSION_STATUS_STYLES[session.status] ??
                  SESSION_STATUS_STYLES.scheduled
                }
              >
                {session.status}
              </Badge>
            </div>
            <p className="mt-1 text-sm text-slate-500">
              {academyRes.data?.display_name ?? "—"} · Yi {run.chapter}
            </p>
          </div>
          <Link
            href={`/youth-academy/mentor/cohorts/${run.id}`}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
          >
            <Users className="size-4" />
            View cohort
          </Link>
        </div>
      </div>

      {/* Session info */}
      <section className="grid gap-3 rounded-xl border border-slate-200 bg-white p-5 sm:grid-cols-2">
        <div className="flex items-start gap-2.5">
          <CalendarDays className="mt-0.5 size-4 shrink-0 text-slate-400" />
          <div>
            <p className="text-xs font-medium text-slate-500">When</p>
            <p className="text-sm text-slate-900">
              {formatWhen(session.scheduled_at)}
            </p>
          </div>
        </div>
        <div className="flex items-start gap-2.5">
          <MapPin className="mt-0.5 size-4 shrink-0 text-slate-400" />
          <div>
            <p className="text-xs font-medium text-slate-500">Venue</p>
            <p className="text-sm text-slate-900">
              {session.venue ?? "To be announced"}
            </p>
          </div>
        </div>
        <div className="flex items-start gap-2.5">
          <Clock className="mt-0.5 size-4 shrink-0 text-slate-400" />
          <div>
            <p className="text-xs font-medium text-slate-500">Duration</p>
            <p className="text-sm text-slate-900">
              {session.duration_minutes} minutes
            </p>
          </div>
        </div>
        {session.learning_objective && (
          <div className="flex items-start gap-2.5">
            <Target className="mt-0.5 size-4 shrink-0 text-slate-400" />
            <div>
              <p className="text-xs font-medium text-slate-500">
                Learning objective
              </p>
              <p className="text-sm text-slate-900">
                {session.learning_objective}
              </p>
            </div>
          </div>
        )}
        {session.remarks && (
          <div className="flex items-start gap-2.5 sm:col-span-2">
            <StickyNote className="mt-0.5 size-4 shrink-0 text-slate-400" />
            <div>
              <p className="text-xs font-medium text-slate-500">
                Additional remarks
              </p>
              <p className="text-sm text-slate-900">{session.remarks}</p>
            </div>
          </div>
        )}
        {documentUrl && (
          <div className="sm:col-span-2">
            <a
              href={documentUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100"
            >
              <FileDown className="size-4" />
              Download session document (course material)
            </a>
          </div>
        )}
      </section>

      {/* Attendance */}
      <section className="space-y-3">
        <div>
          <h2 className="flex items-center gap-2 font-semibold text-slate-900">
            <ClipboardCheck className="size-4 text-slate-500" />
            Attendance
          </h2>
          <p className="mt-0.5 text-sm text-slate-500">
            Mark each cohort member present or absent, then save.
          </p>
        </div>
        {!lock.editable && (
          <AttendanceLockBanner
            runId={run.id}
            reason={lock.reason}
            canReopen={gate.via === "manager"}
          />
        )}
        {lock.editable && reopenedUntil && (
          <AttendanceLockBanner
            runId={run.id}
            reason=""
            reopenedUntil={reopenedUntil}
          />
        )}
        <AttendanceGrid
          runSessionId={session.id}
          roster={roster}
          locked={!lock.editable}
        />
      </section>

      {/* Materials */}
      <section className="space-y-3">
        <div>
          <h2 className="flex items-center gap-2 font-semibold text-slate-900">
            <FolderOpen className="size-4 text-slate-500" />
            Session materials
          </h2>
          <p className="mt-0.5 text-sm text-slate-500">
            Supplementary materials you upload here are downloadable by the
            cohort on their program page.
          </p>
        </div>
        <MaterialUpload runSessionId={session.id} />
        <MaterialsList
          canDelete
          materials={materials.map((m) => ({
            id: m.id,
            title: m.title,
            created_at: m.created_at,
            uploaded_by_name: m.uploaded_by
              ? (uploaderNameById.get(m.uploaded_by) ?? null)
              : null,
          }))}
        />
      </section>
    </div>
  );
}
