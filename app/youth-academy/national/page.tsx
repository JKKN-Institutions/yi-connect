import Link from "next/link";
import {
  Building2,
  CalendarCheck,
  GraduationCap,
  PlayCircle,
  Users,
} from "lucide-react";
import { requireYuvaNational } from "@/lib/yuva/auth/require-national";
import { Forbidden403 } from "@/app/youth-academy/_components/Forbidden403";

/**
 * Yi Youth Academy — national dashboard SHELL (Phase 4).
 * KPI cards and the usage-norm compliance table are PLACEHOLDERS — live
 * metrics (sessions conducted, norm RAG, quarterly export) land in
 * Phase 15 via lib/yuva/norms.ts + actions/national-reports.ts.
 */

const KPI_PLACEHOLDERS = [
  { label: "Active academies", icon: Building2 },
  { label: "Runs in progress", icon: PlayCircle },
  { label: "Sessions this month", icon: CalendarCheck },
  { label: "Students engaged", icon: Users },
  { label: "Students certified", icon: GraduationCap },
];

export default async function NationalDashboardPage() {
  const gate = await requireYuvaNational();
  if (!gate.ok) {
    return <Forbidden403 reason={gate.error} />;
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">
          National dashboard
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Program templates, academies and usage-norm compliance across the Yi
          Youth Academy network.
        </p>
      </div>

      {/* KPI placeholders — replaced with live metrics in Phase 15. */}
      <section aria-label="Key metrics">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {KPI_PLACEHOLDERS.map(({ label, icon: Icon }) => (
            <div
              key={label}
              className="rounded-xl border border-slate-200 bg-white p-4"
            >
              <div className="flex items-center gap-2 text-slate-400">
                <Icon className="size-4" />
                <span className="text-xs font-medium uppercase tracking-wide">
                  {label}
                </span>
              </div>
              <p className="mt-3 text-2xl font-bold text-slate-300">—</p>
              <p className="mt-1 text-[11px] text-slate-400">
                Live metric coming soon
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Usage-norm compliance placeholder — Phase 15. */}
      <section
        aria-label="Usage-norm compliance"
        className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center"
      >
        <h2 className="text-sm font-semibold text-slate-700">
          Usage-norm compliance
        </h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">
          Per-academy red/amber/green view of the usage norms (≥3 engagements
          per month, ≥30 active days per year) plus the quarterly review
          export will appear here once academies start running sessions.
        </p>
      </section>

      <section className="flex flex-col gap-3 sm:flex-row">
        <Link
          href="/youth-academy/national/programs"
          className="inline-flex items-center justify-center rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-800"
        >
          Manage program templates
        </Link>
        <Link
          href="/youth-academy/national/academies"
          className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-900 transition-colors hover:bg-slate-50"
        >
          Manage academies
        </Link>
      </section>
    </div>
  );
}
