/**
 * Yi Youth Academy — tokenized application status page (Phase 8).
 * Spec: docs/yi-youth-academy-spec.md → "Application status (public,
 * tokenized)".
 *
 * The unguessable status_token from the confirmation email is the only
 * credential. Shows ONLY the applicant's own application + run context —
 * invalid/unknown token → notFound() with zero data leak. Survives
 * unpublish: this page reads by token, not by run status.
 */

import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle2,
  Clock3,
  HeartHandshake,
  Undo2,
} from "lucide-react";
import { getApplicationStatusByToken } from "@/app/youth-academy/actions/apply";
import {
  formatDate,
  formatDateRange,
} from "@/components/yuva/public/format";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Application status",
  robots: { index: false, follow: false },
};

export default async function ApplicationStatusPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const view = await getApplicationStatusByToken(token);
  if (!view) notFound();

  const announce = formatDate(view.cohortAnnounceDate);
  const dates = formatDateRange(view.startDate, view.endDate);

  const statusBlock = (() => {
    switch (view.status) {
      case "accepted":
        return {
          icon: <CheckCircle2 className="size-6 text-emerald-600" />,
          iconBg: "bg-emerald-100",
          badge: (
            <span className="rounded-full bg-emerald-100 px-3 py-1 text-sm font-semibold text-emerald-700">
              Accepted
            </span>
          ),
          heading: `Congratulations, ${view.fullName}!`,
          body: "You've been accepted into this program. Your login details (an access code) will arrive by email when your cohort is formed — nothing more to do right now.",
        };
      case "rejected":
        return {
          icon: <HeartHandshake className="size-6 text-slate-500" />,
          iconBg: "bg-slate-100",
          badge: (
            <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-600">
              Not selected
            </span>
          ),
          heading: `Thank you for applying, ${view.fullName}`,
          body: "We're sorry — we couldn't offer you a seat in this cohort. Seats are limited, and this is no reflection of your potential. We'd love to see you apply to a future Yi Youth Academy program.",
        };
      case "withdrawn":
        return {
          icon: <Undo2 className="size-6 text-slate-500" />,
          iconBg: "bg-slate-100",
          badge: (
            <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-600">
              Withdrawn
            </span>
          ),
          heading: `Application withdrawn`,
          body: "This application has been withdrawn. If that wasn't intended, reach out to your Yi chapter — or apply again to a future program.",
        };
      default:
        return {
          icon: <Clock3 className="size-6 text-amber-600" />,
          iconBg: "bg-amber-100",
          badge: (
            <span className="rounded-full bg-amber-100 px-3 py-1 text-sm font-semibold text-amber-700">
              Under review
            </span>
          ),
          heading: `Hang tight, ${view.fullName}`,
          body: announce
            ? `Your application is being reviewed by the chapter team. Decisions will be announced by ${announce} — you'll hear from us by email.`
            : "Your application is being reviewed by the chapter team. You'll hear from us by email once decisions are announced.",
        };
    }
  })();

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6 py-16">
      <div className="w-full max-w-md">
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <div
            className={`mx-auto flex h-12 w-12 items-center justify-center rounded-full ${statusBlock.iconBg}`}
          >
            {statusBlock.icon}
          </div>
          <div className="mt-4 flex justify-center">{statusBlock.badge}</div>
          <h1 className="mt-4 text-xl font-bold text-slate-900">
            {statusBlock.heading}
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">
            {statusBlock.body}
          </p>

          <dl className="mt-6 space-y-1.5 rounded-xl bg-slate-50 p-4 text-left text-sm">
            <div className="flex justify-between gap-3">
              <dt className="text-slate-500">Program</dt>
              <dd className="text-right font-medium text-slate-900">
                {view.programTitle}
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-slate-500">Academy</dt>
              <dd className="text-right font-medium text-slate-900">
                {view.academyName}
              </dd>
            </div>
            {dates && (
              <div className="flex justify-between gap-3">
                <dt className="text-slate-500">Dates</dt>
                <dd className="text-right font-medium text-slate-900">
                  {dates}
                </dd>
              </div>
            )}
            {announce && view.status === "pending" && (
              <div className="flex justify-between gap-3">
                <dt className="text-slate-500">Decisions by</dt>
                <dd className="text-right font-medium text-slate-900">
                  {announce}
                </dd>
              </div>
            )}
          </dl>

          {view.status === "accepted" && (
            <p className="mt-4 text-xs text-slate-400">
              Already received your access code?{" "}
              <Link
                href="/youth-academy/login"
                className="font-medium text-slate-600 underline-offset-2 hover:underline"
              >
                Log in here
              </Link>
              .
            </p>
          )}
        </div>

        <div className="mt-5 text-center">
          <Link
            href="/youth-academy"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-900"
          >
            <ArrowLeft className="size-4" />
            Yi Youth Academy
          </Link>
        </div>
      </div>
    </main>
  );
}
