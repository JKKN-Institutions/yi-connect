"use client";

import { useState, useTransition } from "react";
import { Check, Trash2 } from "lucide-react";
import { toggleTask, deleteTask } from "@/lib/varnam/actions/manage-tasks";

/**
 * Done-toggle circle — sits at the start of a task row. Optimistic-feeling
 * (disabled while the action runs), with inline error text on failure.
 */
export function TaskToggle({
  taskId,
  done,
  title,
}: {
  taskId: string;
  done: boolean;
  title: string;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");

  return (
    <span className="inline-flex flex-col items-start">
      <button
        type="button"
        disabled={pending}
        aria-label={done ? `Reopen "${title}"` : `Mark "${title}" done`}
        title={done ? "Reopen" : "Mark done"}
        onClick={() => {
          setError("");
          startTransition(async () => {
            const res = await toggleTask(taskId);
            if (!res.ok) setError(res.message);
          });
        }}
        className={`inline-flex size-6 shrink-0 items-center justify-center rounded-full border transition disabled:opacity-50 ${
          done
            ? "border-[#0CA4A5] bg-[#0CA4A5] text-white hover:bg-[#0a8485]"
            : "border-[#3B0A45]/25 bg-white text-transparent hover:border-[#0CA4A5] hover:text-[#0CA4A5]/40"
        }`}
      >
        <Check className="size-3.5" strokeWidth={3} />
      </button>
      {error && (
        <span className="mt-1 max-w-[10rem] text-[11px] font-medium text-[#D6336C]">
          {error}
        </span>
      )}
    </span>
  );
}

/** Delete button — confirm() first, inline error on failure. */
export function TaskDeleteButton({
  taskId,
  title,
}: {
  taskId: string;
  title: string;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");

  return (
    <span className="inline-flex flex-col items-end">
      <button
        type="button"
        disabled={pending}
        aria-label={`Delete "${title}"`}
        title="Delete"
        onClick={() => {
          if (!confirm(`Delete "${title}"? This can't be undone.`)) return;
          setError("");
          startTransition(async () => {
            const res = await deleteTask(taskId);
            if (!res.ok) setError(res.message);
          });
        }}
        className="inline-flex size-7 items-center justify-center rounded-full text-[#2B0A33]/35 transition hover:bg-[#D6336C]/10 hover:text-[#b02a59] disabled:opacity-50"
      >
        <Trash2 className="size-3.5" />
      </button>
      {error && (
        <span className="mt-1 max-w-[10rem] text-right text-[11px] font-medium text-[#D6336C]">
          {error}
        </span>
      )}
    </span>
  );
}
