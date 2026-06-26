"use client";

/**
 * Inline fill-in controls for Section 5 (Committees & Bills). Rendered ONLY when
 * canManage is true. Hidden from the printout (`print:hidden`) — once saved, the
 * section re-renders with the value as normal report text.
 *
 * Two small controls, matching the reference inline-capture pattern (a "use
 * client" child that calls its section's server action and refreshes the route
 * on success):
 *   • CommitteeLeaderFill — set/edit the committee leader name when none was
 *     auto-resolved from a committee_chair participant.
 *   • BillOutcomeFill — override the report's Passed/Rejected/Not Presented line
 *     (report-only; never touches the live vote).
 */
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Check } from "lucide-react";
import {
  saveReportCommitteeLeader,
  saveReportBillOutcome,
} from "@/app/yip/actions/report-committees-bills";

type Outcome = "passed" | "rejected" | "not_presented";

export function CommitteeLeaderFill({
  eventId,
  committeeName,
  initialValue,
  hasLeader,
}: {
  eventId: string;
  committeeName: string;
  initialValue: string;
  hasLeader: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(initialValue);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function save() {
    setError(null);
    startTransition(async () => {
      const res = await saveReportCommitteeLeader(eventId, committeeName, value);
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
        className="print:hidden inline-flex items-center gap-1 rounded-md border border-dashed border-[#FF9933]/40 bg-[#FF9933]/5 px-2 py-0.5 text-[11px] font-medium text-[#FF9933] transition-colors hover:bg-[#FF9933]/10"
      >
        <Pencil className="size-2.5" />
        {hasLeader ? "Edit leader" : "Add leader"}
      </button>
    );
  }

  return (
    <div className="print:hidden mt-1 flex flex-wrap items-center gap-1.5">
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Committee leader name"
        className="w-44 rounded-md border border-[#1a1a3e]/15 bg-white px-2 py-1 text-xs text-[#1a1a3e] shadow-sm focus:border-[#FF9933] focus:outline-none focus:ring-2 focus:ring-[#FF9933]/30"
      />
      <button
        type="button"
        onClick={save}
        disabled={pending}
        className="inline-flex items-center justify-center rounded-md bg-[#1a1a3e] px-2.5 py-1 text-xs font-medium text-white transition-colors hover:bg-[#1a1a3e]/90 disabled:opacity-50"
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
        className="inline-flex items-center justify-center rounded-md border border-[#1a1a3e]/15 bg-white px-2.5 py-1 text-xs font-medium text-[#1a1a3e] transition-colors hover:bg-[#1a1a3e]/5 disabled:opacity-50"
      >
        Cancel
      </button>
      {error && <p className="w-full text-[11px] text-red-600">{error}</p>}
    </div>
  );
}

const OUTCOME_OPTIONS: { value: Outcome | "auto"; label: string }[] = [
  { value: "auto", label: "Auto (from vote)" },
  { value: "passed", label: "Passed" },
  { value: "rejected", label: "Rejected" },
  { value: "not_presented", label: "Not Presented" },
];

export function BillOutcomeFill({
  eventId,
  committeeName,
  overridden,
}: {
  eventId: string;
  committeeName: string;
  overridden: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function choose(value: Outcome | "auto") {
    setError(null);
    startTransition(async () => {
      const res = await saveReportBillOutcome(eventId, committeeName, value);
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
        className="print:hidden inline-flex items-center gap-1 rounded-md border border-dashed border-[#FF9933]/40 bg-[#FF9933]/5 px-2 py-0.5 text-[11px] font-medium text-[#FF9933] transition-colors hover:bg-[#FF9933]/10"
      >
        <Pencil className="size-2.5" />
        {overridden ? "Edit outcome" : "Set outcome"}
      </button>
    );
  }

  return (
    <div className="print:hidden mt-1 flex flex-wrap items-center gap-1">
      {OUTCOME_OPTIONS.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => choose(opt.value)}
          disabled={pending}
          className="inline-flex items-center gap-1 rounded-md border border-[#1a1a3e]/15 bg-white px-2 py-1 text-[11px] font-medium text-[#1a1a3e] transition-colors hover:border-[#FF9933] hover:bg-[#FF9933]/5 disabled:opacity-50"
        >
          {opt.label}
        </button>
      ))}
      <button
        type="button"
        onClick={() => {
          setOpen(false);
          setError(null);
        }}
        disabled={pending}
        className="inline-flex items-center justify-center rounded-md px-2 py-1 text-[11px] font-medium text-[#1a1a3e]/55 transition-colors hover:text-[#1a1a3e] disabled:opacity-50"
      >
        <Check className="size-3" />
      </button>
      {error && <p className="w-full text-[11px] text-red-600">{error}</p>}
    </div>
  );
}
