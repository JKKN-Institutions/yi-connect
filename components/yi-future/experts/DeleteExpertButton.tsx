"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

type Result = { ok: true; message?: string } | { ok: false; error: string };

function Btn() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="text-xs text-red-600/70 hover:text-red-600 disabled:opacity-50"
    >
      {pending ? "…" : "Delete"}
    </button>
  );
}

/**
 * Delete control for an expert that SURFACES the server's refusal (e.g. "still
 * assigned to N sessions") inline instead of failing silently — the plain
 * server-action form swallowed the result.
 */
export function DeleteExpertButton({
  id,
  action,
}: {
  id: string;
  action: (prev: Result | null, fd: FormData) => Promise<Result | null>;
}) {
  const [state, formAction] = useActionState(action, null);
  return (
    <div className="inline-flex flex-col items-end">
      <form action={formAction}>
        <input type="hidden" name="id" value={id} />
        <Btn />
      </form>
      {state && !state.ok && (
        <span className="mt-1 max-w-[180px] text-right text-[10px] leading-tight text-red-600">
          {state.error}
        </span>
      )}
    </div>
  );
}
