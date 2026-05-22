"use client";

import { useState, useTransition } from "react";
import { changeMyPassword } from "@/app/yi-future/actions/chair-account";

export function ChangePasswordForm(): React.JSX.Element {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [pending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    if (next !== confirm) {
      setError("New password and confirmation do not match.");
      return;
    }
    if (next.length < 10) {
      setError("New password must be at least 10 characters.");
      return;
    }

    startTransition(async () => {
      const res = await changeMyPassword(current, next);
      if (res.ok) {
        setSuccess(true);
        setCurrent("");
        setNext("");
        setConfirm("");
      } else {
        setError(res.error);
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Field
        id="current"
        label="Current password"
        value={current}
        onChange={setCurrent}
        autoComplete="current-password"
      />
      <Field
        id="next"
        label="New password (min 10 chars)"
        value={next}
        onChange={setNext}
        autoComplete="new-password"
      />
      <Field
        id="confirm"
        label="Confirm new password"
        value={confirm}
        onChange={setConfirm}
        autoComplete="new-password"
      />

      {error && (
        <div className="p-3 rounded-md bg-red-50 border border-red-200 text-sm text-red-700">
          {error}
        </div>
      )}
      {success && (
        <div className="p-3 rounded-md bg-emerald-50 border border-emerald-200 text-sm text-emerald-800">
          Password updated. Use the new password the next time you sign in.
        </div>
      )}

      <button
        type="submit"
        disabled={!current || !next || !confirm || pending}
        className="w-full py-3 rounded-md bg-navy text-ivory font-semibold hover:bg-navy-dark transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {pending ? "Updating…" : "Update password"}
      </button>
    </form>
  );
}

function Field({
  id,
  label,
  value,
  onChange,
  autoComplete,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (s: string) => void;
  autoComplete: string;
}) {
  return (
    <div>
      <label
        htmlFor={id}
        className="block text-xs font-semibold uppercase tracking-widest text-navy/70 mb-2"
      >
        {label}
      </label>
      <input
        id={id}
        type="password"
        autoComplete={autoComplete}
        required
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-4 py-3 border border-navy/20 rounded-md focus:border-yi-gold focus:outline-none focus:ring-4 focus:ring-yi-gold/20"
      />
    </div>
  );
}
