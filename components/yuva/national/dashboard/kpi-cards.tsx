/**
 * National dashboard KPI cards (Phase 15 — replaces the Phase 4
 * placeholders). Presentational RSC; numbers come from
 * getComplianceSnapshot() in app/youth-academy/actions/national-reports.ts.
 */

import {
  Building2,
  CalendarCheck,
  GraduationCap,
  PlayCircle,
  Users,
} from "lucide-react";
import type { ComplianceSnapshot } from "@/app/youth-academy/actions/national-reports";

export function KpiCards({ kpis }: { kpis: ComplianceSnapshot["kpis"] }) {
  const cards = [
    {
      label: "Active academies",
      value: kpis.active_academies,
      icon: Building2,
      hint: "National-created, currently active",
    },
    {
      label: "Runs in progress",
      value: kpis.runs_in_progress,
      icon: PlayCircle,
      hint: "Cohorts mid-delivery",
    },
    {
      label: "Sessions this month",
      value: kpis.sessions_this_month,
      icon: CalendarCheck,
      hint: "Completed sessions network-wide",
    },
    {
      label: "Students engaged",
      value: kpis.students_engaged,
      icon: Users,
      hint: "Distinct enrolled students",
    },
    {
      label: "Students certified",
      value: kpis.students_certified,
      icon: GraduationCap,
      hint: "Certificates issued",
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
      {cards.map(({ label, value, icon: Icon, hint }) => (
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
          <p className="mt-3 text-2xl font-bold text-slate-900">
            {value.toLocaleString("en-IN")}
          </p>
          <p className="mt-1 text-[11px] text-slate-400">{hint}</p>
        </div>
      ))}
    </div>
  );
}
