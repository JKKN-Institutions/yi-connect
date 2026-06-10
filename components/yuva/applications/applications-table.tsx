"use client";

/**
 * Applications review queue (Phase 9): filter tabs
 * (all/pending/accepted/rejected), bulk select with accept/reject, expandable
 * rows showing the full review card, and — post-formation — per-student
 * cohort/code actions (resend/regenerate) plus "Add to cohort" for
 * accepted-but-unenrolled applicants.
 */

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronDown, ChevronRight, Inbox, Loader2, X } from "lucide-react";
import toast from "react-hot-toast";
import { bulkReview } from "@/app/youth-academy/actions/applications";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ApplicationReviewCard } from "./application-review-card";
import { AddToCohortButton, CodeActions } from "./code-actions";
import type { ApplicationQueueRow } from "./data";

type Filter = "all" | "pending" | "accepted" | "rejected";

const STATUS_BADGE: Record<ApplicationQueueRow["status"], string> = {
  pending: "bg-slate-100 text-slate-600",
  accepted: "bg-emerald-50 text-emerald-700",
  rejected: "bg-red-50 text-red-600",
  withdrawn: "bg-slate-100 text-slate-400 line-through",
};

export function ApplicationsTable({
  applications,
  canReview,
  cohortFormed,
}: {
  applications: ApplicationQueueRow[];
  /** Run status allows accept/reject (published / closed / in progress). */
  canReview: boolean;
  /** Run reached in_progress (or later) — show cohort/code actions. */
  cohortFormed: boolean;
}) {
  const router = useRouter();
  const [filter, setFilter] = useState<Filter>("all");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState<"accept" | "reject" | null>(null);

  const counts = useMemo(() => {
    const c = { all: applications.length, pending: 0, accepted: 0, rejected: 0 };
    for (const a of applications) {
      if (a.status === "pending") c.pending++;
      if (a.status === "accepted") c.accepted++;
      if (a.status === "rejected") c.rejected++;
    }
    return c;
  }, [applications]);

  const visible = useMemo(
    () =>
      filter === "all"
        ? applications
        : applications.filter((a) => a.status === filter),
    [applications, filter]
  );

  // Bulk-selectable: reviewable (not withdrawn) and not already enrolled.
  const selectable = useMemo(
    () =>
      canReview
        ? visible.filter((a) => a.status !== "withdrawn" && !a.enrollment_id)
        : [],
    [visible, canReview]
  );
  const selectedVisible = selectable.filter((a) => selected.has(a.id));
  const allVisibleSelected =
    selectable.length > 0 && selectedVisible.length === selectable.length;

  function toggleExpand(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    setSelected(
      allVisibleSelected ? new Set() : new Set(selectable.map((a) => a.id))
    );
  }

  async function runBulk(decision: "accept" | "reject") {
    const ids = selectedVisible.map((a) => a.id);
    if (ids.length === 0) return;
    setBulkBusy(decision);
    const result = await bulkReview({
      items: ids.map((id) => ({ id, decision })),
    });
    setBulkBusy(null);
    if (!result.success) {
      toast.error(result.error);
      return;
    }
    const { accepted, rejected, failed } = result.data;
    if (failed > 0) {
      const firstError = result.data.results.find((r) => !r.success)?.error;
      toast(
        `${decision === "accept" ? accepted : rejected} done, ${failed} failed${firstError ? ` — ${firstError}` : ""}`,
        { icon: "⚠️", duration: 8000 }
      );
    } else {
      toast.success(
        decision === "accept"
          ? `${accepted} application${accepted === 1 ? "" : "s"} accepted.`
          : `${rejected} application${rejected === 1 ? "" : "s"} rejected.`
      );
    }
    setSelected(new Set());
    router.refresh();
  }

  if (applications.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center">
        <Inbox className="size-8 text-slate-300" />
        <p className="text-sm font-medium text-slate-600">
          No applications yet
        </p>
        <p className="text-xs text-slate-400">
          Applications appear here as soon as students apply on the public
          program page.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Filter tabs */}
      <div className="flex flex-wrap items-center gap-1.5">
        {(
          [
            ["all", `All (${counts.all})`],
            ["pending", `Pending (${counts.pending})`],
            ["accepted", `Accepted (${counts.accepted})`],
            ["rejected", `Rejected (${counts.rejected})`],
          ] as Array<[Filter, string]>
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setFilter(key)}
            className={`rounded-full px-3 py-1 text-sm transition-colors ${
              filter === key
                ? "bg-slate-900 text-white"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Bulk action bar */}
      {canReview && selectedVisible.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
          <p className="text-sm text-slate-600">
            {selectedVisible.length} selected
          </p>
          <Button
            size="sm"
            onClick={() => runBulk("accept")}
            disabled={bulkBusy !== null}
            className="h-7 bg-emerald-700 px-2.5 text-xs hover:bg-emerald-800"
          >
            {bulkBusy === "accept" ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Check className="size-3.5" />
            )}
            Accept selected
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => runBulk("reject")}
            disabled={bulkBusy !== null}
            className="h-7 border-red-200 px-2.5 text-xs text-red-700 hover:bg-red-50"
          >
            {bulkBusy === "reject" ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <X className="size-3.5" />
            )}
            Reject selected
          </Button>
        </div>
      )}

      {/* Queue */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-medium tracking-wide text-slate-500 uppercase">
              {canReview && (
                <th className="w-10 px-3 py-2.5">
                  <Checkbox
                    checked={allVisibleSelected}
                    onCheckedChange={toggleSelectAll}
                    aria-label="Select all reviewable"
                  />
                </th>
              )}
              <th className="px-3 py-2.5">Applicant</th>
              <th className="hidden px-3 py-2.5 md:table-cell">Institution</th>
              <th className="hidden px-3 py-2.5 sm:table-cell">YUVA member</th>
              <th className="px-3 py-2.5">Status</th>
              <th className="w-10 px-3 py-2.5" />
            </tr>
          </thead>
          <tbody>
            {visible.map((a) => {
              const isExpanded = expanded.has(a.id);
              const rowSelectable =
                canReview && a.status !== "withdrawn" && !a.enrollment_id;
              return (
                <FragmentRow
                  key={a.id}
                  application={a}
                  canReview={canReview}
                  cohortFormed={cohortFormed}
                  isExpanded={isExpanded}
                  selectable={rowSelectable}
                  showCheckboxColumn={canReview}
                  isSelected={selected.has(a.id)}
                  onToggleExpand={() => toggleExpand(a.id)}
                  onToggleSelect={() => toggleSelect(a.id)}
                />
              );
            })}
            {visible.length === 0 && (
              <tr>
                <td
                  colSpan={canReview ? 6 : 5}
                  className="px-3 py-8 text-center text-sm text-slate-400"
                >
                  No {filter} applications.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function FragmentRow({
  application: a,
  canReview,
  cohortFormed,
  isExpanded,
  selectable,
  showCheckboxColumn,
  isSelected,
  onToggleExpand,
  onToggleSelect,
}: {
  application: ApplicationQueueRow;
  canReview: boolean;
  cohortFormed: boolean;
  isExpanded: boolean;
  selectable: boolean;
  showCheckboxColumn: boolean;
  isSelected: boolean;
  onToggleExpand: () => void;
  onToggleSelect: () => void;
}) {
  const colSpan = showCheckboxColumn ? 6 : 5;
  return (
    <>
      <tr
        className="cursor-pointer border-b border-slate-100 transition-colors last:border-0 hover:bg-slate-50/60"
        onClick={onToggleExpand}
      >
        {showCheckboxColumn && (
          <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
            {selectable && (
              <Checkbox
                checked={isSelected}
                onCheckedChange={onToggleSelect}
                aria-label={`Select ${a.full_name}`}
              />
            )}
          </td>
        )}
        <td className="px-3 py-2.5">
          <p className="font-medium text-slate-900">{a.full_name}</p>
          <p className="text-xs text-slate-400">{a.email}</p>
        </td>
        <td className="hidden px-3 py-2.5 text-slate-600 md:table-cell">
          {a.institution_name ?? "—"}
        </td>
        <td className="hidden px-3 py-2.5 text-slate-600 sm:table-cell">
          {a.yuva_member_claim}
        </td>
        <td className="px-3 py-2.5">
          <div className="flex flex-wrap items-center gap-1.5">
            <span
              className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium capitalize ${STATUS_BADGE[a.status]}`}
            >
              {a.status}
            </span>
            {cohortFormed && a.enrollment_id && (
              <span onClick={(e) => e.stopPropagation()}>
                <CodeActions enrollmentId={a.enrollment_id} />
              </span>
            )}
            {cohortFormed && a.status === "accepted" && !a.enrollment_id && (
              <span onClick={(e) => e.stopPropagation()}>
                <AddToCohortButton applicationId={a.id} />
              </span>
            )}
          </div>
        </td>
        <td className="px-3 py-2.5 text-slate-400">
          {isExpanded ? (
            <ChevronDown className="size-4" />
          ) : (
            <ChevronRight className="size-4" />
          )}
        </td>
      </tr>
      {isExpanded && (
        <tr className="border-b border-slate-100 last:border-0">
          <td colSpan={colSpan} className="bg-white px-3 pb-3">
            <ApplicationReviewCard
              application={a}
              canReview={
                canReview && a.status !== "withdrawn" && !a.enrollment_id
              }
            />
          </td>
        </tr>
      )}
    </>
  );
}
