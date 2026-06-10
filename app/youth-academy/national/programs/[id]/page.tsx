import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Info } from "lucide-react";
import { requireYuvaNational } from "@/lib/yuva/auth/require-national";
import { createServiceClient } from "@/lib/yuva/supabase/service";
import { Forbidden403 } from "@/app/youth-academy/_components/Forbidden403";
import { CategoryBadge } from "@/components/yuva/national/category-badge";
import { ProgramStatusBadge } from "@/components/yuva/national/program-status-badge";
import { ProgramStatusActions } from "@/components/yuva/national/program-status-actions";
import { ProgramForm } from "@/components/yuva/national/program-form";
import { SessionStructureBuilder } from "@/components/yuva/national/session-structure-builder";

/**
 * Yi Youth Academy — program template editor (Phase 4).
 * Details form + ordered session-structure builder + approve/archive
 * controls. Template rule: when the program already has runs, structure
 * changes affect NEW runs only (runs snapshot at creation) — surfaced as
 * an inline note.
 */

export const dynamic = "force-dynamic";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function ProgramEditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const gate = await requireYuvaNational();
  if (!gate.ok) {
    return <Forbidden403 reason={gate.error} />;
  }

  const { id } = await params;
  if (!UUID_PATTERN.test(id)) {
    notFound();
  }

  const svc = await createServiceClient();
  const [programRes, sessionsRes, runsRes] = await Promise.all([
    svc
      .from("programs")
      .select(
        "id, title, category, objective, summary, takeaways, status, total_minutes"
      )
      .eq("id", id)
      .maybeSingle(),
    svc
      .from("program_sessions")
      .select(
        "id, seq, name, duration_minutes, learning_objective, description, document_storage_path, expects_submission"
      )
      .eq("program_id", id)
      .order("seq", { ascending: true }),
    svc
      .from("runs")
      .select("id", { count: "exact", head: true })
      .eq("program_id", id),
  ]);

  const program = programRes.data;
  if (!program) {
    notFound();
  }

  const sessions = sessionsRes.data ?? [];
  const runsCount = runsRes.count ?? 0;
  const takeaways = Array.isArray(program.takeaways)
    ? program.takeaways.filter((t): t is string => typeof t === "string")
    : [];

  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <Link
          href="/youth-academy/national/programs"
          className="inline-flex items-center gap-1 text-sm text-slate-500 transition-colors hover:text-slate-900"
        >
          <ArrowLeft className="size-4" />
          Back to programs
        </Link>

        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              {program.title}
            </h1>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <CategoryBadge category={program.category} />
              <ProgramStatusBadge status={program.status} />
              <span className="text-sm text-slate-500">
                {sessions.length} session{sessions.length === 1 ? "" : "s"} ·{" "}
                {runsCount} run{runsCount === 1 ? "" : "s"}
              </span>
            </div>
          </div>
          <ProgramStatusActions
            programId={program.id}
            status={program.status}
            sessionsCount={sessions.length}
          />
        </div>

        {runsCount > 0 && (
          <div className="flex items-start gap-2 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-800">
            <Info className="mt-0.5 size-4 shrink-0" />
            <p>
              This program has {runsCount} run{runsCount === 1 ? "" : "s"}.
              Structure changes affect <strong>new runs only</strong> —
              existing runs keep the session structure they snapshotted at
              creation.
            </p>
          </div>
        )}
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6">
        <h2 className="mb-4 text-base font-semibold text-slate-900">
          Program details
        </h2>
        <ProgramForm
          programId={program.id}
          initial={{
            title: program.title,
            category: program.category,
            objective: program.objective ?? "",
            summary: program.summary ?? "",
            takeaways,
          }}
        />
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-base font-semibold text-slate-900">
            Session structure
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Ordered sessions with duration, learning objective, course
            material and the &ldquo;expects student work&rdquo; flag. Total
            duration is auto-computed from the sessions.
          </p>
        </div>
        <SessionStructureBuilder
          programId={program.id}
          initialSessions={sessions.map((s) => ({
            name: s.name,
            duration_minutes: s.duration_minutes,
            learning_objective: s.learning_objective,
            description: s.description,
            document_storage_path: s.document_storage_path,
            expects_submission: s.expects_submission,
          }))}
        />
      </section>
    </div>
  );
}
