/**
 * CHAPTER — academy view (spec "Chapter — academy view (read-only)").
 * Read-only academy record (create/edit/logo/activation are NATIONAL-only —
 * pinned by lib/yuva/__tests__/academy-gate.test.ts) + the two chapter-owned
 * mutations: assign/replace/remove the institution coordinator (OPTIONAL —
 * an academy can operate with none) and edit qualitative outcomes.
 * Coordinators get the read view without the management controls.
 */

import Link from "next/link";
import { ArrowLeft, Mail } from "lucide-react";
import { getYuvaAccess } from "@/lib/yuva/auth/yuva-access";
import { AcademyCard } from "@/components/yuva/academies/academy-card";
import { CoordinatorAssignDialog } from "@/components/yuva/academies/coordinator-assign-dialog";
import { QualitativeNotesEditor } from "@/components/yuva/academies/qualitative-notes-editor";
import { SignatoriesEditor } from "@/components/yuva/academies/signatories-editor";
import {
  fetchAcademies,
  type AcademyScope,
} from "@/components/yuva/academies/data";

export const metadata = { title: "Academy" };

export default async function ChapterAcademiesPage() {
  // Layout already gated; re-resolve for scoping + per-academy controls.
  const access = await getYuvaAccess();
  const scope: AcademyScope = access.isNational
    ? { kind: "all" }
    : access.chapterAdminOf
      ? { kind: "chapter", chapter: access.chapterAdminOf }
      : { kind: "ids", ids: access.coordinatorAcademyIds };

  const academies = await fetchAcademies(scope);

  return (
    <main className="mx-auto max-w-3xl space-y-6 p-6">
      <div>
        <Link
          href="/youth-academy/chapter"
          className="inline-flex items-center gap-1 text-sm text-slate-500 underline-offset-2 hover:underline"
        >
          <ArrowLeft className="size-4" />
          Chapter dashboard
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-slate-900">
          {academies.length === 1 ? "Your academy" : "Your academies"}
        </h1>
        <p className="text-sm text-slate-500">
          Academy details are managed by the Yi National team. Your chapter
          assigns the (optional) institution coordinator and records
          qualitative outcomes.
        </p>
      </div>

      {academies.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center">
          <p className="font-medium text-slate-700">No academy yet</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">
            Your academy is set up by the Yi National team — chapters cannot
            create academies.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {academies.map((academy) => {
            // Management controls: own-chapter admin or national. A bound
            // coordinator sees the read view only (server actions enforce
            // the same gate — this just hides dead controls).
            const canManage = access.canManageAcademy({
              id: academy.id,
              chapter: academy.chapter,
            });
            return (
              <AcademyCard key={academy.id} academy={academy}>
                <div className="space-y-4 py-1">
                  <div>
                    <h3 className="mb-1.5 text-sm font-semibold text-slate-700">
                      Institution coordinator
                    </h3>
                    {academy.coordinator ? (
                      <div className="mb-2 flex flex-wrap items-center gap-2 text-sm text-slate-600">
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
                      <p className="mb-2 text-sm text-slate-500">
                        None assigned — optional; your chapter can run the
                        academy through its own logins.
                      </p>
                    )}
                    {canManage ? (
                      <CoordinatorAssignDialog
                        academyId={academy.id}
                        academyName={academy.display_name}
                        current={academy.coordinator}
                      />
                    ) : null}
                  </div>

                  <div>
                    <h3 className="mb-1.5 text-sm font-semibold text-slate-700">
                      Qualitative outcomes
                    </h3>
                    <QualitativeNotesEditor
                      academyId={academy.id}
                      initialNotes={academy.qualitative_notes}
                      canEdit={canManage}
                    />
                  </div>
                </div>
              </AcademyCard>
            );
          })}
        </div>
      )}
    </main>
  );
}
