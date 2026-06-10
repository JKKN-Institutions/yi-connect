/**
 * Student certificate page (Phase 14).
 *
 * Gate: getStudentSession() (the me/ layout also gates; defense-in-depth)
 * with a LIVE enrollment lookup — nothing enrollment-shaped is trusted from
 * the cookie. Per enrollment: not issued → "in progress" with the live
 * attendance % so far; issued → certificate card (number, issue date) with
 * an owner-only signed download (getMyCertificateUrl); revoked → explicit
 * notice instead of a download.
 */

import { redirect } from "next/navigation";
import { Award, Clock } from "lucide-react";
import { getStudentSession } from "@/lib/yuva/auth/student-session";
import { CERT_ATTENDANCE_DEFAULT, RUN_STATUS_LABELS } from "@/lib/yuva/constants";
import { CertificateCard } from "@/components/yuva/certificates/certificate-card";
import { fetchMyCertificateOverview } from "@/components/yuva/certificates/data";

export const dynamic = "force-dynamic";

export const metadata = { title: "Certificate" };

export default async function StudentCertificatePage() {
  const session = await getStudentSession();
  if (!session) {
    redirect("/youth-academy/login?reason=session");
  }
  const rows = await fetchMyCertificateOverview(session.personId);

  return (
    <main className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Certificate</h1>
        <p className="mt-1 text-sm text-slate-500">
          Your e-certificate is issued by your chapter after the program
          completes — the default eligibility is ≥{CERT_ATTENDANCE_DEFAULT}%
          attendance.
        </p>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 bg-white p-10 text-center">
          <Award className="mx-auto size-8 text-slate-300" />
          <p className="mt-3 text-sm text-slate-500">
            No enrollments yet — certificates appear here once you complete a
            program.
          </p>
        </div>
      ) : (
        <div className="grid gap-4">
          {rows.map((row) =>
            row.certificate ? (
              <CertificateCard
                key={row.enrollmentId}
                enrollmentId={row.enrollmentId}
                programTitle={row.programTitle}
                academyName={row.academyName}
                certificateNo={row.certificate.certificate_no}
                issuedAt={row.certificate.issued_at}
                revoked={row.certificate.revoked}
              />
            ) : (
              <div
                key={row.enrollmentId}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
              >
                <div>
                  <p className="font-semibold text-slate-900">
                    {row.programTitle}
                  </p>
                  <p className="text-sm text-slate-500">
                    {row.academyName} · {RUN_STATUS_LABELS[row.runStatus]}
                  </p>
                  <p className="mt-1 text-sm text-slate-600">
                    Attendance so far:{" "}
                    <span className="font-semibold tabular-nums text-slate-900">
                      {row.attendancePct}%
                    </span>
                  </p>
                </div>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1.5 text-sm font-medium text-slate-600">
                  <Clock className="size-4" />
                  In progress
                </span>
              </div>
            )
          )}
        </div>
      )}
    </main>
  );
}
