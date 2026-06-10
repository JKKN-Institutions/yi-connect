import Link from "next/link";
import { Building2 } from "lucide-react";
import { requireYuvaNational } from "@/lib/yuva/auth/require-national";
import { Forbidden403 } from "@/app/youth-academy/_components/Forbidden403";
import {
  getComplianceSnapshot,
  getEmailQueueHealth,
} from "@/app/youth-academy/actions/national-reports";
import { KpiCards } from "@/components/yuva/national/dashboard/kpi-cards";
import { ComplianceTable } from "@/components/yuva/national/dashboard/compliance-table";
import { QueueHealthCard } from "@/components/yuva/national/dashboard/queue-health-card";
import { QuarterlyExport } from "@/components/yuva/national/dashboard/quarterly-export";

/**
 * Yi Youth Academy — national dashboard (Phase 15 — live).
 * KPIs, per-academy usage-norm compliance (RAG), email-queue health and the
 * quarterly review CSV export. Data assembly lives in
 * app/youth-academy/actions/national-reports.ts (national-gated);
 * norm math in lib/yuva/norms.ts + lib/yuva/quarterly.ts (TDD).
 */

export const dynamic = "force-dynamic";

export default async function NationalDashboardPage() {
  const gate = await requireYuvaNational();
  if (!gate.ok) {
    return <Forbidden403 reason={gate.error} />;
  }

  const [snapshot, queueHealth] = await Promise.all([
    getComplianceSnapshot(),
    getEmailQueueHealth(),
  ]);

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

      {/* KPIs — live (Phase 15). */}
      <section aria-label="Key metrics">
        {snapshot.success ? (
          <KpiCards kpis={snapshot.data.kpis} />
        ) : (
          <p className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            Could not load network metrics: {snapshot.error}
          </p>
        )}
      </section>

      {/* Operational strip: email-queue health + quarterly CSV export. */}
      <section
        aria-label="Operations"
        className="grid gap-4 sm:grid-cols-2"
      >
        {queueHealth.success ? (
          <QueueHealthCard health={queueHealth.data} />
        ) : (
          <p className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            Could not load email-queue health: {queueHealth.error}
          </p>
        )}
        <QuarterlyExport />
      </section>

      {/* Usage-norm compliance — live per-academy RAG (Phase 15). */}
      <section aria-label="Usage-norm compliance">
        {!snapshot.success ? null : snapshot.data.academies.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center">
            <Building2 className="mx-auto size-8 text-slate-300" />
            <h2 className="mt-3 text-sm font-semibold text-slate-700">
              No academies yet
            </h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">
              Usage-norm compliance appears here once the network has active
              academies. The national team creates academies — creating one is
              the approval.
            </p>
            <Link
              href="/youth-academy/national/academies/new"
              className="mt-4 inline-flex items-center justify-center rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-800"
            >
              Create your first academy
            </Link>
          </div>
        ) : (
          <ComplianceTable
            month={snapshot.data.month}
            academies={snapshot.data.academies}
          />
        )}
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
