"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { signInWithCode } from "../actions/auth";

export function LoginForm({ redirectTo }: { redirectTo?: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    start(async () => {
      const res = await signInWithCode(code);
      if (!res.success) {
        setError(res.error);
        return;
      }
      // Honour where they were trying to go. Already validated server-side
      // by safeYiqRedirect, so this is a same-site /yiq path or nothing.
      router.push(redirectTo || "/yiq/me");
      router.refresh();
    });
  }

  return (
    <form onSubmit={onSubmit} className="mt-8">
      <label htmlFor="yiq-code" className="yiq-eyebrow" style={{ color: "#9fb0d4" }}>
        Access code
      </label>
      <input
        id="yiq-code"
        value={code}
        onChange={(e) => setCode(e.target.value.toUpperCase())}
        autoComplete="one-time-code"
        autoCapitalize="characters"
        autoCorrect="off"
        spellCheck={false}
        inputMode="text"
        placeholder="Q7MK2W"
        className="yiq-data mt-2 w-full rounded-xl px-4 py-4 text-center text-[1.75rem] font-bold tracking-[0.2em]"
        style={{
          background: "rgba(247,244,237,0.07)",
          border: "1.5px solid rgba(247,244,237,0.2)",
          color: "#f7f4ed",
        }}
      />
      {error ? (
        <p
          role="alert"
          className="mt-3 rounded-lg px-3 py-2.5 text-[0.875rem] font-medium"
          style={{ background: "rgba(200,69,47,0.15)", color: "#ffb4a6" }}
        >
          {error}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={pending || code.trim().length === 0}
        className="mt-4 w-full rounded-full py-4 text-[0.9375rem] font-bold disabled:opacity-50"
        style={{ background: "#e8a33d", color: "#0a1633" }}
      >
        {pending ? "Checking…" : "Sign in"}
      </button>
    </form>
  );
}
