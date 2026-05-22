"use client";

import { useState, useTransition } from "react";
import type { ResetPasswordResult } from "@/app/yi-future/actions/national-admins";
import { PasswordReveal } from "./PasswordReveal";

// ─────────────────────────────────────────────────────────────────────
// ResetPasswordForm — a per-row client island.
//
// Why a client island instead of a plain <form action={fn}>?
//   The reset-password server action returns a freshly generated
//   password that we need to display ONCE in the UI (PasswordReveal).
//   A bare <form action> would discard the return value. So we call
//   the action via useTransition + direct invocation, capture the
//   result locally, and render <PasswordReveal> with the new password.
//
//   The action prop is the typed server action itself — passing it
//   down keeps the page server-side (no need to inline the call into
//   a client file).
// ─────────────────────────────────────────────────────────────────────

export function ResetPasswordForm({
  email,
  action,
}: {
  email: string;
  action: (formData: FormData) => Promise<ResetPasswordResult>;
}): React.JSX.Element {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<ResetPasswordResult | null>(null);

  function handleClick() {
    setResult(null);
    startTransition(async () => {
      const fd = new FormData();
      fd.set("email", email);
      const res = await action(fd);
      setResult(res);
    });
  }

  return (
    <div className="inline-flex flex-col items-end gap-2">
      <button
        type="button"
        onClick={handleClick}
        disabled={pending}
        className="text-xs font-semibold text-navy hover:text-yi-gold border border-navy/20 rounded px-2.5 py-1 disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {pending ? "Resetting…" : "Reset password"}
      </button>

      {result && !result.ok && (
        <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded px-2 py-1 max-w-xs text-left">
          {result.error}
        </div>
      )}

      {result && result.ok && (
        <div className="w-[22rem] max-w-[80vw]">
          <PasswordReveal email={result.email} password={result.password} />
        </div>
      )}
    </div>
  );
}
