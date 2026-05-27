"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { validateAccessCode } from "@/app/yip/actions/auth";

export default function JoinPage() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!code.trim()) return;

    setError(null);
    setLoading(true);

    try {
      const result = await validateAccessCode(code);

      if (result.type === "participant") {
        router.push("/yip/me");
      } else if (result.type === "jury") {
        router.push("/yip/jury");
      } else {
        setError(result.message);
        inputRef.current?.focus();
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#FEFCF6]">
      {/* Tricolor top bar */}
      <div className="flex h-1.5">
        <div className="flex-1 bg-[#FF9933]" />
        <div className="flex-1 bg-white" />
        <div className="flex-1 bg-[#138808]" />
      </div>

      {/* Background texture */}
      <div className="relative flex flex-1 items-center justify-center px-4 py-12">
        {/* Subtle grid */}
        <div
          className="absolute inset-0 opacity-[0.01]"
          style={{
            backgroundImage: `repeating-linear-gradient(0deg, transparent, transparent 40px, #1a1a3e 40px, #1a1a3e 41px), repeating-linear-gradient(90deg, transparent, transparent 40px, #1a1a3e 40px, #1a1a3e 41px)`,
          }}
        />
        {/* Radial glow */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 h-[400px] w-[400px] rounded-full bg-[#FF9933]/[0.04] blur-3xl" />

        <div className="relative w-full max-w-sm">
          {/* Logo */}
          <div className="mb-10 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#FF9933] shadow-lg shadow-[#FF9933]/20">
              <span className="font-[family-name:var(--font-heading)] text-2xl font-bold text-white">Y</span>
            </div>
            <h1 className="font-[family-name:var(--font-heading)] text-2xl font-bold text-[#1a1a3e]">
              Young Indians Parliament
            </h1>
            <p className="mt-1.5 text-sm text-[#1a1a3e]/40">Enter the House</p>
          </div>

          {/* Code entry card */}
          <div className="overflow-hidden rounded-2xl border border-[#1a1a3e]/5 bg-white shadow-xl shadow-[#1a1a3e]/5">
            <div className="p-6 sm:p-8">
              <div className="mb-6 text-center">
                <h2 className="text-lg font-semibold text-[#1a1a3e]">Your Access Code</h2>
                <p className="mt-1 text-sm text-[#1a1a3e]/40">
                  Find it on your name badge
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <input
                    ref={inputRef}
                    type="text"
                    placeholder="ABC123"
                    value={code}
                    onChange={(e) => {
                      setCode(e.target.value.toUpperCase());
                      setError(null);
                    }}
                    maxLength={10}
                    autoFocus
                    autoComplete="off"
                    spellCheck={false}
                    className="h-16 w-full rounded-xl border-2 border-[#1a1a3e]/10 bg-[#FEFCF6] text-center font-[family-name:var(--font-mono)] text-2xl font-bold tracking-[0.3em] text-[#1a1a3e] uppercase transition-colors focus:border-[#FF9933] focus:outline-none focus:ring-4 focus:ring-[#FF9933]/10 placeholder:text-[#1a1a3e]/15 placeholder:tracking-[0.2em]"
                  />
                </div>

                {error && (
                  <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-center text-sm font-medium text-red-600">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading || !code.trim()}
                  className="flex h-14 w-full items-center justify-center gap-2.5 rounded-xl bg-[#FF9933] text-base font-semibold text-white shadow-lg shadow-[#FF9933]/25 transition-all hover:bg-[#E68A2E] hover:shadow-xl disabled:opacity-50 disabled:shadow-none"
                >
                  {loading ? (
                    <svg className="size-5 animate-spin" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                  ) : (
                    <svg className="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
                  )}
                  {loading ? "Verifying..." : "Enter Parliament"}
                </button>
              </form>
            </div>

            {/* Bottom accent */}
            <div className="flex h-1">
              <div className="flex-1 bg-[#FF9933]" />
              <div className="flex-1 bg-white" />
              <div className="flex-1 bg-[#138808]" />
            </div>
          </div>

          <p className="mt-8 text-center text-sm text-[#1a1a3e]/35">
            Jury member?{" "}
            <Link
              href="/yip/jury/login"
              className="font-medium text-[#FF9933] hover:underline"
            >
              Sign in with email
            </Link>
          </p>
          <p className="mt-2 text-center text-sm text-[#1a1a3e]/35">
            Organizing an event?{" "}
            <Link
              href="/yip/login"
              className="font-medium text-[#FF9933] hover:underline"
            >
              Sign in here
            </Link>
          </p>
          <p className="mt-2 text-center text-xs text-[#1a1a3e]/40">
            <Link
              href="/yip/test-login"
              className="underline hover:text-[#FF9933]"
            >
              One-click demo accounts
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
