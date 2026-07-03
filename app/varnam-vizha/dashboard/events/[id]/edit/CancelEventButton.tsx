"use client";

import { useState, useTransition } from "react";
import {
  cancelEvent,
  uncancelEvent,
  type ManageEventState,
} from "@/lib/varnam/actions/manage-events";

export function CancelEventButton({
  eventId,
  status,
}: {
  eventId: string;
  status: string | null;
}) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<ManageEventState | null>(null);
  const isCancelled = status === "cancelled";

  const onClick = () => {
    const confirmed = window.confirm(
      isCancelled
        ? "Restore this event and publish it again?"
        : "Cancel this event? It stays on the public site with a Cancelled badge, and registration closes."
    );
    if (!confirmed) return;
    startTransition(async () => {
      const res = isCancelled
        ? await uncancelEvent(eventId)
        : await cancelEvent(eventId);
      setResult(res);
    });
  };

  return (
    <div className="text-right">
      <button
        type="button"
        onClick={onClick}
        disabled={pending}
        className={
          isCancelled
            ? "rounded-full border border-[#0CA4A5]/40 bg-white px-4 py-2 text-sm font-semibold text-[#0a8485] transition hover:bg-[#0CA4A5]/5 disabled:opacity-60"
            : "rounded-full border border-[#D6336C]/40 bg-white px-4 py-2 text-sm font-semibold text-[#D6336C] transition hover:bg-[#D6336C]/5 disabled:opacity-60"
        }
      >
        {pending
          ? "Working…"
          : isCancelled
            ? "Restore event"
            : "Cancel event"}
      </button>
      {result && (
        <p
          className={`mt-2 text-xs font-medium ${
            result.ok ? "text-[#0a8485]" : "text-[#D6336C]"
          }`}
        >
          {result.message}
        </p>
      )}
    </div>
  );
}
