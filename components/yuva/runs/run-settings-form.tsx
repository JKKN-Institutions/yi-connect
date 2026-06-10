"use client";

/**
 * Run settings form (Phase 7): chapter-entered start/end dates (template
 * Part B "Filled by Chapter"), application window, cohort announcement date
 * (shown publicly; required to publish), and capacity — labeled "Expected
 * Participants" (template Part B), a SOFT cap (overrun warns, never blocks).
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2 } from "lucide-react";
import toast from "react-hot-toast";
import { updateRunSettings } from "@/app/youth-academy/actions/runs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const formSchema = z.object({
  startDate: z.string(),
  endDate: z.string(),
  applyOpenAt: z.string(),
  applyCloseAt: z.string(),
  cohortAnnounceDate: z.string(),
  capacity: z
    .number({ message: "Enter the expected participants" })
    .int()
    .min(1, "At least 1 participant")
    .max(1000),
});

type FormValues = z.infer<typeof formSchema>;

/** ISO timestamp → value for an <input type="datetime-local"> (local time). */
function isoToLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export type RunSettingsInitial = {
  id: string;
  start_date: string | null;
  end_date: string | null;
  apply_open_at: string | null;
  apply_close_at: string | null;
  cohort_announce_date: string | null;
  capacity: number;
};

export function RunSettingsForm({
  run,
  disabled = false,
}: {
  run: RunSettingsInitial;
  /** Frozen runs (completed / certified / cancelled) render read-only. */
  disabled?: boolean;
}) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      startDate: run.start_date ? run.start_date.slice(0, 10) : "",
      endDate: run.end_date ? run.end_date.slice(0, 10) : "",
      applyOpenAt: isoToLocalInput(run.apply_open_at),
      applyCloseAt: isoToLocalInput(run.apply_close_at),
      cohortAnnounceDate: run.cohort_announce_date
        ? run.cohort_announce_date.slice(0, 10)
        : "",
      capacity: run.capacity,
    },
  });

  async function onSubmit(values: FormValues) {
    setSubmitting(true);
    const result = await updateRunSettings({
      runId: run.id,
      startDate: values.startDate || null,
      endDate: values.endDate || null,
      applyOpenAt: values.applyOpenAt
        ? new Date(values.applyOpenAt).toISOString()
        : null,
      applyCloseAt: values.applyCloseAt
        ? new Date(values.applyCloseAt).toISOString()
        : null,
      cohortAnnounceDate: values.cohortAnnounceDate || null,
      capacity: values.capacity,
    });
    setSubmitting(false);

    if (!result.success) {
      toast.error(result.error);
      return;
    }
    if (result.warning) {
      toast(result.warning, { icon: "⚠️", duration: 6000 });
    } else {
      toast.success("Run settings saved");
    }
    router.refresh();
  }

  const errors = form.formState.errors;

  return (
    <form
      onSubmit={form.handleSubmit(onSubmit)}
      className="grid gap-4 sm:grid-cols-2"
    >
      <div className="grid gap-2">
        <Label htmlFor="run-start">Start date</Label>
        <Input
          id="run-start"
          type="date"
          disabled={disabled}
          {...form.register("startDate")}
        />
        <p className="text-xs text-slate-500">
          Entered by the chapter (template Part B).
        </p>
      </div>
      <div className="grid gap-2">
        <Label htmlFor="run-end">End date</Label>
        <Input
          id="run-end"
          type="date"
          disabled={disabled}
          {...form.register("endDate")}
        />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="run-apply-open">Applications open</Label>
        <Input
          id="run-apply-open"
          type="datetime-local"
          disabled={disabled}
          {...form.register("applyOpenAt")}
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="run-apply-close">Applications close</Label>
        <Input
          id="run-apply-close"
          type="datetime-local"
          disabled={disabled}
          {...form.register("applyCloseAt")}
        />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="run-announce">Cohort announcement date</Label>
        <Input
          id="run-announce"
          type="date"
          disabled={disabled}
          {...form.register("cohortAnnounceDate")}
        />
        <p className="text-xs text-slate-500">
          Shown publicly — the date applicants are told decisions arrive and
          access codes go out. Required to publish.
        </p>
      </div>
      <div className="grid gap-2">
        <Label htmlFor="run-capacity">Expected Participants</Label>
        <Input
          id="run-capacity"
          type="number"
          min={1}
          max={1000}
          disabled={disabled}
          {...form.register("capacity", { valueAsNumber: true })}
        />
        {errors.capacity && (
          <p className="text-xs text-red-600">{errors.capacity.message}</p>
        )}
        <p className="text-xs text-slate-500">
          Soft cap (space norm 30–50 seats) — accepting beyond it warns, never
          blocks.
        </p>
      </div>

      {!disabled && (
        <div className="sm:col-span-2 flex justify-end">
          <Button
            type="submit"
            disabled={submitting}
            className="bg-slate-900 hover:bg-slate-800"
          >
            {submitting && <Loader2 className="size-4 animate-spin" />}
            Save settings
          </Button>
        </div>
      )}
    </form>
  );
}
