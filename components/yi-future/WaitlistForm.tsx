"use client";

// Shown on /yi-future/join when registrations are fully closed: a late
// student can leave an email so the national team can invite them next time.
// The confirmation is deliberately the same for a new and a repeat email.

import { useState, useTransition } from "react";
import { joinRegistrationWaitlist } from "@/app/yi-future/actions/registration-window";

export function WaitlistForm() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (message) {
    return (
      <p className="mt-5 text-sm font-semibold text-yi-green">{message}</p>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => {
          try {
            const res = await joinRegistrationWaitlist(email);
            setMessage(res.message);
          } catch {
            setMessage("Thanks — we've noted your email.");
          }
        });
      }}
      className="mt-5 text-left"
    >
      <label className="block text-xs font-bold uppercase tracking-widest text-navy/60 mb-1.5">
        Tell me when registrations open
      </label>
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="your.email@example.com"
        required
        autoComplete="email"
        className="w-full px-3 py-2.5 border border-navy/20 rounded-md text-sm bg-white focus:border-[#F5A623] focus:outline-none"
      />
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
