"use client";

/**
 * Inline fill-in control for Section 5/6's one editable gap: the Zero Hour
 * summary. Rendered ONLY when canManage is true AND the summary is empty.
 * Hidden from the printout (`print:hidden`) — once saved, the section
 * re-renders with the summary as normal report text.
 *
 * Mirrors OverviewOathFill.tsx: a small "use client" child that calls its
 * section's server action and refreshes the route on success. Extra here: when
 * the saved summary is empty we pre-fill the textarea with an auto-draft
 * assembled from the event's questions + motions, so the organiser edits rather
 * than writes from scratch.
 */
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Wand2 } from "lucide-react";
import { saveZeroHourSummary } from "@/app/yip/actions/report-awards-zero-hour";

export function AwardsZeroHourFill({
  eventId,
  draft,
  hasSources,
}: {
  eventId: string;
  /** Auto-draft assembled from questions + motions; "" when none. */
  draft: string;
  hasSources: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(draft);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function save() {
    setError(null);
    startTransition(async () => {
      const res = await saveZeroHourSummary(eventId, value);
      if (!res.success) {
        setError(res.error);
        return;
      }
      setOpen(false);
      router.refresh();
    });
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => {
          setValue(draft);
          setOpen(true);
        }}
        className="print:hidden inline-flex items-center gap-1.5 rounded-md border border-dashed border-[#FF9933]/40 bg-[#FF9933]/5 px-2.5 py-1 text-xs font-medium text-[#FF9933] transition-colors hover:bg-[#FF9933]/10"
      >
        <Pencil className="size-3" />
        Write the Zero Hour summary
      </button>
    );
  }

  return (
    <div className="print:hidden mt-1 space-y-2">
      {hasSources && draft.length > 0 && (
        <p className="flex items-center gap-1.5 text-xs text-[#1a1a3e]/55">
          <Wand2 className="size-3 text-[#FF9933]" />
          Pre-filled from this event&apos;s questions &amp; motions — edit before
          saving.
        </p>
      )}
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        rows={8}
        placeholder="Summarise the Zero Hour — questions raised, ministries addressed, motions moved and their outcomes…"
        className="w-full rounded-lg border border-[#1a1a3e]/15 bg-white px-3 py-2 text-sm leading-relaxed text-[#1a1a3e] shadow-sm focus:border-[#FF9933] focus:outline-none focus:ring-2 focus:ring-[#FF9933]/30"
      />
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={save}
          disabled={pending}
          className="inline-flex items-center justify-center rounded-md bg-[#1a1a3e] px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-[#1a1a3e]/90 disabled:opacity-50"
        >
          {pending ? "Saving…" : "Save"}
        </button>
        {hasSources && draft.length > 0 && (
          <button
            type="button"
            onClick={() => setValue(draft)}
            disabled={pending}
            className="inline-flex items-center justify-center gap-1.5 rounded-md border border-[#FF9933]/40 bg-[#FF9933]/5 px-3 py-1.5 text-xs font-medium text-[#FF9933] transition-colors hover:bg-[#FF9933]/10 disabled:opacity-50"
          >
            <Wand2 className="size-3" />
            Reset to auto-draft
          </button>
        )}
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setValue(draft);
            setError(null);
          }}
          disabled={pending}
          className="inline-flex items-center justify-center rounded-md border border-[#1a1a3e]/15 bg-white px-3 py-1.5 text-xs font-medium text-[#1a1a3e] transition-colors hover:bg-[#1a1a3e]/5 disabled:opacity-50"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
