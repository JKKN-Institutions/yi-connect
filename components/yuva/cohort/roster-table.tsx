"use client";

/**
 * Cohort roster table (Phase 11) — shared by the mentor cohort view
 * (read-only) and the chapter/coordinator cohort management page
 * (showActions adds the manager-gated mark-dropped control). Progress
 * columns come precomputed from components/yuva/cohort/data.ts
 * (lib/yuva/progress.ts engines over live data).
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, UserX, Users } from "lucide-react";
import toast from "react-hot-toast";
import { markEnrollmentDropped } from "@/app/youth-academy/actions/attendance";
import type { CohortRosterRow } from "@/components/yuva/cohort/data";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

const STATUS_STYLES: Record<CohortRosterRow["status"], string> = {
  active: "border-emerald-200 bg-emerald-50 text-emerald-700",
  completed: "border-sky-200 bg-sky-50 text-sky-700",
  dropped: "border-slate-200 bg-slate-100 text-slate-500",
};

function PctCell({ value, dropped }: { value: number; dropped: boolean }) {
  if (dropped) return <span className="text-slate-400">—</span>;
  return (
    <span
      className={cn(
        "font-medium tabular-nums",
        value >= 75
          ? "text-emerald-700"
          : value >= 50
            ? "text-amber-700"
            : "text-slate-700"
      )}
    >
      {value}%
    </span>
  );
}

export function RosterTable({
  roster,
  showActions = false,
}: {
  roster: CohortRosterRow[];
  /** Chapter/coordinator surface — adds the mark-dropped action. */
  showActions?: boolean;
}) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);

  if (roster.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-slate-300 p-8 text-center">
        <Users className="mx-auto size-6 text-slate-400" />
        <p className="mt-2 text-sm font-medium text-slate-700">
          No cohort yet
        </p>
        <p className="mt-1 text-sm text-slate-500">
          Accept applications and form the cohort to see students here.
        </p>
      </div>
    );
  }

  async function onDrop(row: CohortRosterRow) {
    if (
      !window.confirm(
        `Mark ${row.full_name} as dropped? They leave the cohort, every progress calculation and the certificate eligibility list. This is audit-logged.`
      )
    ) {
      return;
    }
    setBusyId(row.enrollment_id);
    const result = await markEnrollmentDropped(row.enrollment_id);
    setBusyId(null);
    if (!result.success) {
      toast.error(result.error);
      return;
    }
    toast.success(`${row.full_name} marked as dropped.`);
    router.refresh();
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Student</TableHead>
            <TableHead>Institution</TableHead>
            <TableHead className="text-right">Attendance</TableHead>
            <TableHead className="text-right">Submissions</TableHead>
            <TableHead className="text-right">Progress</TableHead>
            <TableHead>Status</TableHead>
            {showActions && <TableHead className="text-right">Action</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {roster.map((row) => {
            const dropped = row.status === "dropped";
            return (
              <TableRow
                key={row.enrollment_id}
                className={dropped ? "opacity-60" : undefined}
              >
                <TableCell className="font-medium text-slate-900">
                  {row.full_name}
                </TableCell>
                <TableCell className="text-slate-600">
                  {row.institution_name ?? "—"}
                </TableCell>
                <TableCell className="text-right">
                  <PctCell value={row.attendance_pct} dropped={dropped} />
                </TableCell>
                <TableCell className="text-right tabular-nums text-slate-700">
                  {dropped ? (
                    <span className="text-slate-400">—</span>
                  ) : row.submissions_expected > 0 ? (
                    `${row.submissions_done}/${row.submissions_expected}`
                  ) : (
                    <span className="text-slate-400">n/a</span>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <PctCell value={row.progress_pct} dropped={dropped} />
                </TableCell>
                <TableCell>
                  <Badge
                    variant="outline"
                    className={STATUS_STYLES[row.status]}
                  >
                    {row.status}
                  </Badge>
                </TableCell>
                {showActions && (
                  <TableCell className="text-right">
                    {!dropped && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={busyId === row.enrollment_id}
                        onClick={() => onDrop(row)}
                        className="text-rose-700 hover:bg-rose-50"
                      >
                        {busyId === row.enrollment_id ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : (
                          <UserX className="size-4" />
                        )}
                        Mark dropped
                      </Button>
                    )}
                  </TableCell>
                )}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
