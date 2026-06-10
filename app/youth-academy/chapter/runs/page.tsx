/**
 * Chapter / Institution — runs list (Phase 7).
 * Spec: docs/yi-youth-academy-spec.md → "Chapter / Institution — runs
 * (program scheduling)" (/youth-academy/chapter/runs).
 *
 * Gate (defense-in-depth on top of the chapter layout): chapter admin sees
 * THEIR chapter's runs; an institution coordinator sees ONLY their bound
 * academy's runs; national sees all. Everyone else: explicit Forbidden403 —
 * never a silent redirect.
 */

import Link from "next/link";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Forbidden403 } from "@/app/youth-academy/_components/Forbidden403";
import { getYuvaAccess } from "@/lib/yuva/auth/yuva-access";
import { RunCard } from "@/components/yuva/runs/run-card";
import { fetchRuns, runScopeFromAccess } from "@/components/yuva/runs/data";

export const dynamic = "force-dynamic";

export const metadata = { title: "Program runs" };

export default async function ChapterRunsPage() {
  const access = await getYuvaAccess();
  const allowed =
    access.isNational ||
    access.chapterAdminOf !== null ||
    access.coordinatorAcademyIds.length > 0;
  if (!allowed) {
    return (
      <Forbidden403
        reason={`Program runs are managed by chapter admins, institution coordinators and the national team. Your access: ${access.reason}`}
      />
    );
  }

  const runs = await fetchRuns(runScopeFromAccess(access));

  return (
    <main className="mx-auto max-w-5xl space-y-6 p-4 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold tracking-widest text-amber-600 uppercase">
            {access.chapterAdminOf
              ? `Yi ${access.chapterAdminOf}`
              : access.isNational
                ? "All chapters"
                : "Your academy"}
          </p>
          <h1 className="mt-1 text-2xl font-bold text-slate-900">
            Program runs
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Schedule an approved program at your academy, publish it for
            applications, and take the cohort through to certificates.
          </p>
        </div>
        <Button asChild className="bg-slate-900 hover:bg-slate-800">
          <Link href="/youth-academy/chapter/runs/new">
            <Plus className="size-4" />
            Create run
          </Link>
        </Button>
      </div>

      {runs.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center">
          <p className="font-medium text-slate-700">No runs yet</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">
            Create your first run by picking an approved program template and
            the academy that will host it.
          </p>
          <Button asChild className="mt-4 bg-slate-900 hover:bg-slate-800">
            <Link href="/youth-academy/chapter/runs/new">
              <Plus className="size-4" />
              Create run
            </Link>
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {runs.map((run) => (
            <RunCard key={run.id} run={run} />
          ))}
        </div>
      )}
    </main>
  );
}
