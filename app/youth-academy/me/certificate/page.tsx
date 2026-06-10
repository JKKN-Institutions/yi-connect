/**
 * Student certificate page (Phase 10, task 7) — pre-issuance state.
 *
 * Certificates are issued in Phase 14 (PDF render + download). Until a
 * certificate row exists for the enrollment this page shows the
 * "in progress" state per program; once issued it shows an "issued" state
 * (download wiring lands with Phase 14).
 */

import { redirect } from "next/navigation";
import { Award, Clock } from "lucide-react";
import { getMyPrograms } from "@/app/youth-academy/actions/student";
import { RUN_STATUS_LABELS } from "@/lib/yuva/constants";

export const dynamic = "force-dynamic";

export const metadata = { title: "Certificate" };

export default async function StudentCertificatePage() {
  const programsRes = await getMyPrograms();
  if (!programsRes.success) {
    redirect("/youth-academy/login?reason=session");
  }
  const programs = programsRes.data;

  return (
    <main className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Certificate</h1>
        <p className="mt-1 text-sm text-slate-500">
          Your e-certificate is issued by your chapter after the program
          completes, based on attendance and submitted work.
        </p>
      </div>

      {programs.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 bg-white p-10 text-center">
          <Award className="mx-auto size-8 text-slate-300" />
          <p className="mt-3 text-sm text-slate-500">
            No enrollments yet — certificates appear here once you complete a
            program.
          </p>
        </div>
      ) : (
        <div className="grid gap-4">
          {programs.map((program) => (
            <div
              key={program.enrollmentId}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
            >
              <div>
                <p className="font-semibold text-slate-900">
                  {program.programTitle}
                </p>
                <p className="text-sm text-slate-500">
                  {program.academyName} ·{" "}
                  {RUN_STATUS_LABELS[program.runStatus]}
                </p>
              </div>
              {program.certificateId ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5 text-sm font-medium text-emerald-700">
                  <Award className="size-4" />
                  Issued — download available soon
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1.5 text-sm font-medium text-slate-600">
                  <Clock className="size-4" />
                  In progress
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
