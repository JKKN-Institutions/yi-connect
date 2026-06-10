/**
 * Chapter / Institution — create run (Phase 7).
 * Approved-program picker + academy picker scoped to the academies the actor
 * can MANAGE runs for: chapter admin → their chapter's academies; institution
 * coordinator → their bound academy; national → all. Self-gates with an
 * explicit Forbidden403 (defense-in-depth on top of the chapter layout).
 */

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Forbidden403 } from "@/app/youth-academy/_components/Forbidden403";
import { getYuvaAccess } from "@/lib/yuva/auth/yuva-access";
import {
  fetchAcademies,
  type AcademyScope,
} from "@/components/yuva/academies/data";
import { fetchApprovedPrograms } from "@/components/yuva/runs/data";
import { RunForm } from "@/components/yuva/runs/run-form";

export const dynamic = "force-dynamic";

export const metadata = { title: "Create run" };

export default async function NewRunPage() {
  const access = await getYuvaAccess();
  const allowed =
    access.isNational ||
    access.chapterAdminOf !== null ||
    access.coordinatorAcademyIds.length > 0;
  if (!allowed) {
    return (
      <Forbidden403
        reason={`Creating runs is for chapter admins, institution coordinators and the national team. Your access: ${access.reason}`}
      />
    );
  }

  const scope: AcademyScope = access.isNational
    ? { kind: "all" }
    : access.chapterAdminOf
      ? { kind: "chapter", chapter: access.chapterAdminOf }
      : { kind: "ids", ids: access.coordinatorAcademyIds };

  const [programs, academies] = await Promise.all([
    fetchApprovedPrograms(),
    fetchAcademies(scope),
  ]);
  const activeAcademies = academies.filter((a) => a.is_active);

  return (
    <main className="mx-auto max-w-2xl space-y-6 p-4 sm:p-6">
      <div className="space-y-3">
        <Link
          href="/youth-academy/chapter/runs"
          className="inline-flex items-center gap-1 text-sm text-slate-500 transition-colors hover:text-slate-900"
        >
          <ArrowLeft className="size-4" />
          Back to runs
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Create a run</h1>
          <p className="mt-1 text-sm text-slate-600">
            Pick an approved program and the academy hosting it. The template
            sessions are copied into the run for scheduling.
          </p>
        </div>
      </div>

      {programs.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center">
          <p className="font-medium text-slate-700">
            No approved programs yet
          </p>
          <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">
            Program templates are created and approved by the Yi National
            team. Once a program is approved it appears here for scheduling.
          </p>
        </div>
      ) : activeAcademies.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center">
          <p className="font-medium text-slate-700">No active academy</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">
            Runs need an active academy to host them. Your academy is set up
            by the Yi National team — reach out to get started.
          </p>
        </div>
      ) : (
        <RunForm
          programs={programs}
          academies={activeAcademies.map((a) => ({
            id: a.id,
            display_name: a.display_name,
            chapter: a.chapter,
          }))}
        />
      )}
    </main>
  );
}
