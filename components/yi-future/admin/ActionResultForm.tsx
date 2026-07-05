"use client";

// Form wrapper that surfaces the server action's ActionResult instead of
// discarding it. The plain `<form action={...}>` pattern re-renders the page
// on error, blanking uncontrolled fields with no message — reporters saw
// "filled details vanish, nothing saved" (BUG-446/402/466). Submitting from
// the client keeps typed values in the DOM and renders the error inline.

import { useState, useTransition } from "react";

type ActionResult = { ok: true; message?: string } | { ok: false; error: string };

export function ActionResultForm({
  action,
  className,
  children,
}: {
  action: (formData: FormData) => Promise<ActionResult | void>;
  className?: string;
  children: React.ReactNode;
}) {
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <form
      className={className}
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        setResult(null);
        startTransition(async () => {
          const res = await action(fd);
          if (res) setResult(res);
        });
      }}
    >
      {children}
      {pending && (
        <p className="text-xs font-semibold text-navy/50">Saving…</p>
      )}
      {result && !result.ok && (
        <p className="text-sm font-semibold text-red-600">{result.error}</p>
      )}
      {result && result.ok && result.message && (
        <p className="text-sm font-semibold text-yi-green">{result.message}</p>
      )}
    </form>
  );
}
