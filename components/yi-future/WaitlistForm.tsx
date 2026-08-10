"use client";

// Shown on /yi-future/join when registrations are fully closed: a late
// student can leave an email so the national team can invite them next time.
// The confirmation is deliberately the same for a new and a repeat email.
//
// Guarded since 2026-08-10 (see lib/yi-future/waitlist-guard.ts). Two states
// are possible now, and they must look different:
//   success  → the form is replaced by the neutral confirmation.
//   blocked  → the form STAYS on screen with the reason above it, so a
//              genuine student caught by the burst breaker can retry. Showing
//              them the green "we've noted your email" would be a lie.

import { useState, useTransition } from "react";
import { joinRegistrationWaitlist } from "@/app/yi-future/actions/registration-window";
import { YuvaTurnstile } from "@/components/yuva/turnstile";

export function WaitlistForm() {
  const [email, setEmail] = useState("");
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [turnstileToken, setTurnstileToken] = useState("");
  const [pending, startTransition] = useTransition();

  if (done) {
    return <p className="mt-5 text-sm font-semibold text-yi-green">{done}</p>;
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        startTransition(async () => {
          try {
            const res = await joinRegistrationWaitlist(
              email,
              turnstileToken || null
            );
            if (res.ok) setDone(res.message);
            else setError(res.message);
          } catch {
            // A thrown action (flaky network, mid-deploy version skew) must
            // never end as a silent no-op — the student is told to retry.
            setError("Something went wrong. Please try again.");
          }
        });
      }}
      className="mt-5 text-left"
    >
      <label className="block text-xs font-bold uppercase tracking-widest text-navy/60 mb-1.5">
        Tell me when registrations open
      </label>
      {error && (
        <p className="mb-2 p-2 rounded-md bg-[#F5A623]/10 border border-[#F5A623]/40 text-[11px] text-navy">
          {error}
        </p>
      )}
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="your.email@example.com"
        required
        autoComplete="email"
        className="w-full px-3 py-2.5 border border-navy/20 rounded-md text-sm bg-white focus:border-[#F5A623] focus:outline-none"
      />
      <YuvaTurnstile onToken={setTurnstileToken} />
      <button
        type="submit"
        disabled={!email || pending}
        className="mt-2 w-full py-2.5 rounded-md bg-[#F5A623] text-navy text-sm font-bold hover:bg-[#F5A623]/90 disabled:opacity-40"
      >
        {pending ? "Saving…" : "Notify me"}
      </button>
      <p className="mt-2 text-[11px] text-navy/40">
        We&apos;ll only use this to tell you about the next Future edition.
      </p>
    </form>
  );
}
