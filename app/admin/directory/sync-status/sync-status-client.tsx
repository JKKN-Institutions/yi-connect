/**
 * Directory Admin — Sync-Status Client (Phase C, 2026-05-28)
 *
 * Renders three collapsible drift sections + an overall headline.
 * Read-only: no mutation buttons. Each row shows the suggested action so
 * an operator can reconcile manually in a later phase.
 */
"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ArrowLeft,
} from "lucide-react";

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
import type {
  DriftKind,
  DriftRow,
  GapResult,
} from "../actions/sync-status";

const GAP_LABEL: Record<GapResult["gap"], string> = {
  yi_national_admins: "yi.national_admins → yi_directory (app=future)",
  yip_organizers: "yip.organizers → yi_directory (app=yip)",
  future_chapter_core_team:
    "future.chapter_core_team → yi_directory (app=future, role=chapter_chair)",
};

const KIND_BADGE: Record<DriftKind, { label: string; className: string }> = {
  MISSING: {
    label: "Missing",
    className: "bg-red-100 text-red-800 border-red-200",
  },
  ROLE_MISMATCH: {
    label: "Role mismatch",
    className: "bg-amber-100 text-amber-800 border-amber-200",
  },
  ORPHAN: {
    label: "Orphan",
    className: "bg-purple-100 text-purple-800 border-purple-200",
  },
};

function DriftTable({ rows }: { rows: DriftRow[] }) {
  if (rows.length === 0) {
    return (
      <p className="px-4 py-3 text-sm text-slate-500">No rows in this bucket.</p>
    );
  }
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-[120px]">Kind</TableHead>
          <TableHead>Email / Name</TableHead>
          <TableHead>Legacy says</TableHead>
          <TableHead>Directory says</TableHead>
          <TableHead>Suggested action</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((r) => {
          const badge = KIND_BADGE[r.kind];
          return (
            <TableRow key={`${r.kind}-${r.source_id}`}>
              <TableCell>
                <Badge
                  variant="outline"
                  className={`border ${badge.className}`}
                >
                  {badge.label}
                </Badge>
              </TableCell>
              <TableCell className="font-medium text-slate-900">
                <div>{r.email ?? "—"}</div>
                {r.full_name ? (
                  <div className="text-xs text-slate-500">{r.full_name}</div>
                ) : null}
              </TableCell>
              <TableCell className="text-sm text-slate-700">
                {r.legacy_summary}
              </TableCell>
              <TableCell className="text-sm text-slate-700">
                {r.directory_summary}
              </TableCell>
              <TableCell className="text-sm text-slate-700">
                {r.suggested_action}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

function GapSection({
  gap,
  defaultOpen,
}: {
  gap: GapResult;
  defaultOpen: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const inSync = gap.drift_count === 0;
  const Icon = open ? ChevronDown : ChevronRight;
  return (
    <section className="rounded-lg border border-slate-200 bg-white">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition hover:bg-slate-50"
      >
        <div className="flex items-center gap-3">
          <Icon className="h-4 w-4 text-slate-500" />
          <div>
            <div className="text-sm font-semibold text-slate-900">
              {GAP_LABEL[gap.gap]}
            </div>
            <div className="mt-0.5 text-xs text-slate-500">
              {gap.synced_count} of {gap.legacy_total} synced ·{" "}
              {gap.sync_pct}% in sync · {gap.drift_count} drift
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {inSync ? (
            <Badge className="border border-green-200 bg-green-100 text-green-800">
              <CheckCircle2 className="mr-1 h-3 w-3" /> In sync
            </Badge>
          ) : (
            <Badge className="border border-amber-200 bg-amber-100 text-amber-800">
              <AlertTriangle className="mr-1 h-3 w-3" />
              {gap.drift_count} drift
            </Badge>
          )}
        </div>
      </button>

      {open ? (
        <div className="border-t border-slate-200">
          {inSync ? (
            <p className="px-4 py-6 text-sm text-slate-500">
              Nothing to reconcile. All legacy rows have a matching active
              role_assignment in yi_directory.
            </p>
          ) : (
            <div className="space-y-4 px-2 py-3">
              {gap.missing.length > 0 ? (
                <div>
                  <h4 className="px-2 pb-2 text-xs font-semibold uppercase tracking-wide text-red-700">
                    Missing ({gap.missing.length})
                  </h4>
                  <DriftTable rows={gap.missing} />
                </div>
              ) : null}
              {gap.role_mismatch.length > 0 ? (
                <div>
                  <h4 className="px-2 pb-2 text-xs font-semibold uppercase tracking-wide text-amber-700">
                    Role mismatch ({gap.role_mismatch.length})
                  </h4>
                  <DriftTable rows={gap.role_mismatch} />
                </div>
              ) : null}
              {gap.orphan.length > 0 ? (
                <div>
                  <h4 className="px-2 pb-2 text-xs font-semibold uppercase tracking-wide text-purple-700">
                    Orphan in yi_directory ({gap.orphan.length})
                  </h4>
                  <DriftTable rows={gap.orphan} />
                </div>
              ) : null}
            </div>
          )}
        </div>
      ) : null}
    </section>
  );
}

export function SyncStatusClient({
  gap1,
  gap2,
  gap3,
}: {
  gap1: GapResult;
  gap2: GapResult;
  gap3: GapResult;
}) {
  const totals = useMemo(() => {
    const legacy = gap1.legacy_total + gap2.legacy_total + gap3.legacy_total;
    const synced = gap1.synced_count + gap2.synced_count + gap3.synced_count;
    const drift = gap1.drift_count + gap2.drift_count + gap3.drift_count;
    const pct =
      legacy === 0 ? 100 : Math.round((synced / legacy) * 100);
    return { legacy, synced, drift, pct };
  }, [gap1, gap2, gap3]);

  const headlineColor =
    totals.drift === 0
      ? "border-green-200 bg-green-50"
      : "border-amber-200 bg-amber-50";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-slate-900">
            Sync Status
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Drift between legacy auth tables and the canonical yi_directory.
            Read-only — reconciliation happens in a later phase.
          </p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link href="/admin/directory">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Directory
          </Link>
        </Button>
      </div>

      {/* Headline */}
      <div className={`rounded-lg border p-5 ${headlineColor}`}>
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="text-2xl font-semibold text-slate-900">
              {totals.drift === 0
                ? "All 3 gaps are in sync"
                : `${totals.drift} drift rows across 3 gaps`}
            </div>
            <div className="mt-1 text-sm text-slate-700">
              {totals.synced} of {totals.legacy} legacy rows synced ·{" "}
              <span className="font-semibold">{totals.pct}% in sync</span>
            </div>
          </div>
          {totals.drift === 0 ? (
            <CheckCircle2 className="h-10 w-10 text-green-600" />
          ) : (
            <AlertTriangle className="h-10 w-10 text-amber-600" />
          )}
        </div>
      </div>

      {/* Gap sections — open by default if they have drift */}
      <div className="space-y-3">
        <GapSection gap={gap1} defaultOpen={gap1.drift_count > 0} />
        <GapSection gap={gap2} defaultOpen={gap2.drift_count > 0} />
        <GapSection gap={gap3} defaultOpen={gap3.drift_count > 0} />
      </div>
    </div>
  );
}
