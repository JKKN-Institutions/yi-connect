"use client";

/**
 * Inline fill-in control for Section 1's one editable gap: the parliamentary
 * oath text. Rendered ONLY when canManage is true AND the oath is empty. Hidden
 * from the printout (`print:hidden`) — once saved, the section re-renders with
 * the oath as normal report text.
 *
 * This is the REFERENCE inline-capture pattern: a small "use client" child that
 * calls its section's server action and refreshes the route on success.
 */
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil } from "lucide-react";
import { saveReportOath } from "@/app/yip/actions/report-overview";

export function OverviewOathFill({
  eventId,
  initialValue,
}: {
  eventId: string;
  initialValue: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(initialValue);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function save() {
    setError(null);
    startTransition(async () => {
      const res = await saveReportOath(eventId, value);
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
        onClick={() => setOpen(true)}
        className="print:hidden inline-flex items-center gap-1.5 rounded-md border border-dashed border-[#FF9933]/40 bg-[#FF9933]/5 px-2.5 py-1 text-xs font-medium text-[#FF9933] transition-colors hover:bg-[#FF9933]/10"
      >
        <Pencil className="size-3" />
        Add the oath text
      </button>
    );
  }

  return (
    <div className="print:hidden mt-1 space-y-2">
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        rows={3}
        placeholder="Paste the parliamentary oath read aloud at this session…"
        className="w-full rounded-lg border border-[#1a1a3e]/15 bg-white px-3 py-2 text-sm text-[#1a1a3e] shadow-sm focus:border-[#FF9933] focus:outline-none focus:ring-2 focus:ring-[#FF9933]/30"
      />
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={save}
          disabled={pending}
          className="inline-flex items-center justify-center rounded-md bg-[#1a1a3e] px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-[#1a1a3e]/90 disabled:opacity-50"
        >
          {pending ? "Saving…" : "Save"}
        </button>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setValue(initialValue);
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
