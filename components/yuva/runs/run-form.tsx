"use client";

/**
 * Create-run form (Phase 7): pick an APPROVED program template + an academy
 * the actor can manage → the run is created in `draft` with the template's
 * sessions snapshotted into run_sessions. Scheduling happens on the run page.
 */

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Rocket } from "lucide-react";
import toast from "react-hot-toast";
import { createRun } from "@/app/youth-academy/actions/runs";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CATEGORY_LABELS } from "@/lib/yuva/constants";
import type { ApprovedProgram } from "./data";

export type AcademyOption = {
  id: string;
  display_name: string;
  chapter: string;
};

export function RunForm({
  programs,
  academies,
}: {
  /** Approved program templates (national catalogue). */
  programs: ApprovedProgram[];
  /** Academies scoped to the caller's access (manageable only). */
  academies: AcademyOption[];
}) {
  const router = useRouter();
  const [programId, setProgramId] = useState("");
  const [academyId, setAcademyId] = useState(
    academies.length === 1 ? academies[0].id : ""
  );
  const [submitting, setSubmitting] = useState(false);

  const selectedProgram = useMemo(
    () => programs.find((p) => p.id === programId) ?? null,
    [programs, programId]
  );

  async function handleSubmit() {
    if (!programId || !academyId) return;
    setSubmitting(true);
    const result = await createRun({ programId, academyId });
    setSubmitting(false);
    if (!result.success) {
      toast.error(result.error);
      return;
    }
    toast.success("Run created — now schedule its sessions.");
    router.push(`/youth-academy/chapter/runs/${result.data.id}`);
  }

  return (
    <div className="space-y-6 rounded-xl border border-slate-200 bg-white p-6">
      <div className="grid gap-2">
        <Label>Program</Label>
        <Select value={programId} onValueChange={setProgramId}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Pick an approved program template" />
          </SelectTrigger>
          <SelectContent>
            {programs.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.title} · {CATEGORY_LABELS[p.category]} ·{" "}
                {p.sessions_count} session{p.sessions_count === 1 ? "" : "s"}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {selectedProgram?.summary && (
          <p className="rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-600">
            {selectedProgram.summary}
          </p>
        )}
      </div>

      <div className="grid gap-2">
        <Label>Academy</Label>
        <Select value={academyId} onValueChange={setAcademyId}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Pick the academy hosting this run" />
          </SelectTrigger>
          <SelectContent>
            {academies.map((a) => (
              <SelectItem key={a.id} value={a.id}>
                {a.display_name} ({a.chapter})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-slate-500">
          The run is created as a draft — sessions are copied from the
          template, then you schedule dates, venues and mentors before
          publishing.
        </p>
      </div>

      <div className="flex justify-end">
        <Button
          onClick={handleSubmit}
          disabled={submitting || !programId || !academyId}
          className="bg-slate-900 hover:bg-slate-800"
        >
          {submitting ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Rocket className="size-4" />
          )}
          Create draft run
        </Button>
      </div>
    </div>
  );
}
