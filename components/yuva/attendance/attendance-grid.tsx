"use client";

/**
 * Attendance grid (Phase 11) — SHARED by the mentor session page and the
 * chapter/coordinator cohort page. Present/absent toggle per cohort member,
 * mark-all helpers, one bulk save (saveSessionAttendance upsert). Locked
 * state renders read-only — the surrounding page shows the lock banner.
 */

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, Users, X } from "lucide-react";
import toast from "react-hot-toast";
import { saveSessionAttendance } from "@/app/youth-academy/actions/attendance";
import type { SessionRosterRow } from "@/components/yuva/attendance/data";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function AttendanceGrid({
  runSessionId,
  roster,
  locked = false,
}: {
  runSessionId: string;
  roster: SessionRosterRow[];
  /** Read-only render (post-completion lock with no active reopen). */
  locked?: boolean;
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  // null = not yet marked.
  const [marks, setMarks] = useState<Record<string, boolean | null>>(() =>
    Object.fromEntries(roster.map((r) => [r.enrollment_id, r.present]))
  );

  const presentCount = useMemo(
    () => Object.values(marks).filter((v) => v === true).length,
    [marks]
  );
  const unmarkedCount = useMemo(
    () => Object.values(marks).filter((v) => v === null).length,
    [marks]
  );

  if (roster.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-slate-300 p-8 text-center">
        <Users className="mx-auto size-6 text-slate-400" />
        <p className="mt-2 text-sm font-medium text-slate-700">
          No cohort yet
        </p>
        <p className="mt-1 text-sm text-slate-500">
          Attendance can be marked once the cohort is formed.
        </p>
      </div>
    );
  }

  function setAll(present: boolean) {
    setMarks(
      Object.fromEntries(roster.map((r) => [r.enrollment_id, present]))
    );
  }

  async function onSave() {
    const rows = roster
      .filter((r) => marks[r.enrollment_id] !== null)
      .map((r) => ({
        enrollment_id: r.enrollment_id,
        present: marks[r.enrollment_id] === true,
      }));
    if (rows.length === 0) {
      toast.error("Mark at least one student before saving.");
      return;
    }
    setSaving(true);
    const result = await saveSessionAttendance(runSessionId, rows);
    setSaving(false);
    if (!result.success) {
      toast.error(result.error);
      return;
    }
    toast.success(
      `Attendance saved — ${result.data.saved} student${result.data.saved === 1 ? "" : "s"}.`
    );
    router.refresh();
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-slate-600">
          <span className="font-semibold text-slate-900">{presentCount}</span>{" "}
          of {roster.length} present
          {unmarkedCount > 0 && (
            <span className="text-slate-400"> · {unmarkedCount} unmarked</span>
          )}
        </p>
        {!locked && (
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setAll(true)}
            >
              All present
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setAll(false)}
            >
              All absent
            </Button>
          </div>
        )}
      </div>

      <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white">
        {roster.map((row) => {
          const mark = marks[row.enrollment_id];
          return (
            <li
              key={row.enrollment_id}
              className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-slate-900">
                  {row.full_name}
                </p>
                {row.institution_name && (
                  <p className="truncate text-xs text-slate-500">
                    {row.institution_name}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  disabled={locked}
                  onClick={() =>
                    setMarks((m) => ({ ...m, [row.enrollment_id]: true }))
                  }
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                    mark === true
                      ? "border-emerald-300 bg-emerald-100 text-emerald-800"
                      : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50",
                    locked && "cursor-not-allowed opacity-60"
                  )}
                  aria-pressed={mark === true}
                >
                  <Check className="size-3.5" />
                  Present
                </button>
                <button
                  type="button"
                  disabled={locked}
                  onClick={() =>
                    setMarks((m) => ({ ...m, [row.enrollment_id]: false }))
                  }
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                    mark === false
                      ? "border-rose-300 bg-rose-100 text-rose-800"
                      : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50",
                    locked && "cursor-not-allowed opacity-60"
                  )}
                  aria-pressed={mark === false}
                >
                  <X className="size-3.5" />
                  Absent
                </button>
              </div>
            </li>
          );
        })}
      </ul>

      {!locked && (
        <div className="flex justify-end">
          <Button
            type="button"
            onClick={onSave}
            disabled={saving}
            className="bg-slate-900 hover:bg-slate-800"
          >
            {saving && <Loader2 className="size-4 animate-spin" />}
            Save attendance
          </Button>
        </div>
      )}
    </div>
  );
}
