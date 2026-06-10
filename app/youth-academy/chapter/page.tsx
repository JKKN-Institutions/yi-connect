/**
 * CHAPTER — dashboard shell (Phase 5; spec "Chapter — dashboard").
 * Shows the academy/academies in the caller's scope (national-created) with
 * placeholder slots for runs / applications / sessions — Phases 7 and 9 fill
 * them. Coordinator assignment lives on the academy view.
 */

import Link from "next/link";
import { Building2, CalendarClock, Inbox, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getYuvaAccess } from "@/lib/yuva/auth/yuva-access";
import {
  AcademyCard,
} from "@/components/yuva/academies/academy-card";
import {
  fetchAcademies,
  type AcademyScope,
} from "@/components/yuva/academies/data";

export const metadata = { title: "Chapter dashboard" };

export default async function ChapterDashboardPage() {
  // Layout already gated; re-resolve for scoping (layouts can't pass props).
  const access = await getYuvaAccess();
  const scope: AcademyScope = access.isNational
    ? { kind: "all" }
    : access.chapterAdminOf
      ? { kind: "chapter", chapter: access.chapterAdminOf }
      : { kind: "ids", ids: access.coordinatorAcademyIds };

  const academies = await fetchAcademies(scope);
  const heading = access.chapterAdminOf
    ? `Yi ${access.chapterAdminOf} — Youth Academy`
    : access.isNational
      ? "Youth Academy — all chapters"
      : "Your academy";

  return (
    <main className="mx-auto max-w-5xl space-y-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{heading}</h1>
          <p className="text-sm text-slate-500">
            Cohort-based certificate programs for the Yi YUVA network.
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href="/youth-academy/chapter/academies">
            <Building2 className="size-4" />
            Academy &amp; coordinator
          </Link>
        </Button>
      </div>

      {academies.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center">
          <p className="font-medium text-slate-700">No academy yet</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">
            Your academy is set up by the Yi National team — chapters cannot
            create academies. Reach out to the national team to get started.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {academies.map((academy) => (
            <AcademyCard key={academy.id} academy={academy}>
              <Link
                href="/youth-academy/chapter/academies"
                className="text-sm font-medium text-emerald-700 underline-offset-2 hover:underline"
              >
                View academy &amp; assign coordinator →
              </Link>
            </AcademyCard>
          ))}
        </div>
      )}

      {/* Placeholder slots — Phase 7 (runs) and Phase 9 (applications) fill these. */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex items-center gap-2 text-slate-700">
            <CalendarClock className="size-4 text-amber-600" />
            <h2 className="font-semibold">Program runs</h2>
          </div>
          <p className="mt-1 text-sm text-slate-400">
            Scheduling and publishing arrive with program runs — coming soon.
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex items-center gap-2 text-slate-700">
            <Inbox className="size-4 text-amber-600" />
            <h2 className="font-semibold">Applications</h2>
          </div>
          <p className="mt-1 text-sm text-slate-400">
            Review queue and cohort formation — coming soon.
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex items-center gap-2 text-slate-700">
            <Users className="size-4 text-amber-600" />
            <h2 className="font-semibold">Upcoming sessions</h2>
          </div>
          <p className="mt-1 text-sm text-slate-400">
            This week&apos;s sessions appear here once runs are scheduled.
          </p>
        </div>
      </div>
    </main>
  );
}
