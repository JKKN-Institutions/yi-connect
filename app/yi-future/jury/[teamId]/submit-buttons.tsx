"use client";

import { useFormStatus } from "react-dom";

export function SubmitButtons() {
  const { pending } = useFormStatus();
  return (
    <div className="flex items-center justify-end gap-3 pt-2 border-t border-navy/10">
      <button
        type="submit"
        name="_submit"
        value="0"
        disabled={pending}
        className="px-4 py-2 rounded-md text-sm font-semibold border border-navy/20 text-navy/70 hover:border-navy/40 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {pending ? "Saving..." : "Save draft"}
      </button>
      <button
        type="submit"
        name="_submit"
        value="1"
        disabled={pending}
        className="px-4 py-2 rounded-md bg-navy text-ivory text-sm font-semibold hover:bg-navy-dark disabled:opacity-60 disabled:cursor-not-allowed inline-flex items-center gap-2"
      >
        {pending && (
          <span
            aria-hidden="true"
            className="inline-block h-3 w-3 rounded-full border-2 border-ivory/40 border-t-ivory animate-spin"
          />
        )}
        {pending ? "Submitting..." : "Submit evaluation"}
      </button>
    </div>
  );
}
