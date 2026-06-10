/**
 * NATIONAL — academy detail: edit + logo upload + qualitative outcomes +
 * coordinator display + runs (spec "National — academies"). Record mutations
 * stay national-gated server-side; coordinator ASSIGNMENT lives on the
 * chapter surface (/youth-academy/chapter/academies).
 */

import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Mail } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Forbidden403 } from "@/app/youth-academy/_components/Forbidden403";
import { requireYuvaNational } from "@/lib/yuva/auth/require-national";
import { listYiChapters } from "@/app/youth-academy/actions/academies";
import { createServiceClient } from "@/lib/yuva/supabase/service";
import { RUN_STATUS_LABELS, type RunStatus } from "@/lib/yuva/constants";
import { AcademyLogo } from "@/components/yuva/academies/academy-card";
import { AcademyActiveToggle } from "@/components/yuva/academies/active-toggle";
import { AcademyForm } from "@/components/yuva/academies/academy-form";
import { LogoUpload } from "@/components/yuva/academies/logo-upload";
import { QualitativeNotesEditor } from "@/components/yuva/academies/qualitative-notes-editor";
import { fetchAcademyById } from "@/components/yuva/academies/data";

export const metadata = { title: "Academy" };

export default async function NationalAcademyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const gate = await requireYuvaNational();
  if (!gate.ok) return <Forbidden403 reason={gate.error} />;

  const { id } = await params;
  const academy = await fetchAcademyById(id);
  if (!academy) notFound();

  const chaptersResult = await listYiChapters();
  const chapters = chaptersResult.success ? chaptersResult.data : [];

  const svc = await createServiceClient();
  const { data: runs } = await svc
    .from("runs")
    .select("id, status, start_date, end_date, created_at")
    .eq("academy_id", academy.id)
    .order("created_at", { ascending: false });

  return (
    <main className="mx-auto max-w-3xl space-y-6 p-6">
      <div>
        <Link
          href="/youth-academy/national/academies"
          className="inline-flex items-center gap-1 text-sm text-slate-500 underline-offset-2 hover:underline"
        >
          <ArrowLeft className="size-4" />
          Academies
        </Link>
        <div className="mt-3 flex flex-wrap items-center gap-4">
          <AcademyLogo
            url={academy.logo_url}
            name={academy.display_name}
            size={56}
          />
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-bold text-slate-900">
              {academy.display_name}
            </h1>
            <p className="text-sm text-slate-500">
              Yi {academy.chapter} ·{" "}
              {academy.institution_name ?? "No institution attached"}
            </p>
          </div>
          <AcademyActiveToggle
            academyId={academy.id}
            isActive={academy.is_active}
          />
        </div>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 font-semibold text-slate-900">Logo</h2>
        <LogoUpload
          academyId={academy.id}
          academyName={academy.display_name}
          currentUrl={academy.logo_url}
        />
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 font-semibold text-slate-900">Edit academy</h2>
        <AcademyForm
          chapters={chapters}
          initial={{
            id: academy.id,
            chapter: academy.chapter,
            display_name: academy.display_name,
            capacity_norm: academy.capacity_norm,
            institution_id: academy.institution_id,
            institution_name: academy.institution_id
              ? academy.institution_name
              : null,
            institution_other: academy.institution_other,
          }}
        />
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="mb-2 font-semibold text-slate-900">
          Institution coordinator
        </h2>
        {academy.coordinator ? (
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <span className="font-medium text-slate-900">
              {academy.coordinator.name}
            </span>
            {academy.coordinator.email ? (
              <span className="inline-flex items-center gap-1 text-slate-400">
                <Mail className="size-3.5" />
                {academy.coordinator.email}
              </span>
            ) : null}
          </div>
        ) : (
          <p className="text-sm text-slate-500">
            No coordinator assigned — optional; the chapter assigns one from
            its academy view.
          </p>
        )}
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="mb-2 font-semibold text-slate-900">
          Qualitative outcomes
        </h2>
        <p className="mb-3 text-xs text-slate-400">
          Free text, editable by chapter and national — included in the
          quarterly CSV.
        </p>
        <QualitativeNotesEditor
          academyId={academy.id}
          initialNotes={academy.qualitative_notes}
          canEdit
        />
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="mb-2 font-semibold text-slate-900">Runs</h2>
        {!runs || runs.length === 0 ? (
          <p className="text-sm text-slate-500">
            No runs yet — the chapter schedules program runs from approved
            templates.
          </p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {runs.map((run) => (
              <li
                key={run.id}
                className="flex items-center justify-between gap-3 py-2.5"
              >
                <span className="text-sm text-slate-600">
                  {run.start_date ?? "Dates TBD"}
                  {run.end_date ? ` → ${run.end_date}` : ""}
                </span>
                <Badge variant="secondary">
                  {RUN_STATUS_LABELS[run.status as RunStatus] ?? run.status}
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
