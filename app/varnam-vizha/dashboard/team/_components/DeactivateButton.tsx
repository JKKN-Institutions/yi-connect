"use client";

import { useState, useTransition } from "react";
import { deactivateMember } from "@/lib/varnam/actions/manage-team";

export function DeactivateButton({
  assignmentId,
  memberName,
}: {
  assignmentId: string;
  memberName: string;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");

  return (
    <div className="inline-flex flex-col items-end gap-1">
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          if (!confirm(`Remove ${memberName} from the committee?`)) return;
          setError("");
          startTransition(async () => {
            const res = await deactivateMember(assignmentId);
            if (!res.ok) setError(res.message);
          });
        }}
        className="rounded-full border border-[#D6336C]/30 px-3 py-1 text-xs font-medium text-[#b02a59] transition hover:bg-[#D6336C]/5 disabled:opacity-60"
      >
        {pending ? "Removing…" : "Remove"}
      </button>
      {error && (
        <p className="max-w-[14rem] text-right text-[11px] font-medium text-[#D6336C]">
          {error}
        </p>
      )}
    </div>
  );
}
