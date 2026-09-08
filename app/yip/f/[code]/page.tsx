"use client";

/**
 * Participant deep-link login — /yip/f/[code] (Online House Formation, §5.2).
 *
 * Formation invite emails carry https://…/yip/f/{ACCESS_CODE}. This page is a
 * CLIENT component that calls the existing `validateAccessCode` SERVER ACTION
 * on mount: the action mints the httpOnly `yip_session` cookie, and cookies
 * may only be set from server actions / route handlers — a server-component
 * render may NOT set them. That constraint is exactly why this route is a
 * client-invoked auto-submit rather than a server redirect.
 *
 * Outcomes (no silent redirects — CLAUDE.md gate rule):
 *   participant → router.replace("/yip/me/vote")  (the remote ballot)
 *   jury / volunteer → their homes (session already minted by the action;
 *                      mirrors /yip/join routing)
 *   failure → the /yip/join-style code entry, PREFILLED with the code from
 *             the URL and the error visible on screen, so the participant can
 *             correct a mangled code without a dead end.
 */

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { validateAccessCode } from "@/app/yip/actions/auth";

/** Codes are strictly A-Z0-9 (BUG-429) — normalise whatever the URL carried. */
function normaliseCode(raw: string): string {
  return decodeURIComponent(raw).toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export default function FormationDeepLinkPage() {
  const router = useRouter();
  const params = useParams<{ code: string }>();
  const initialCode = normaliseCode(params.code ?? "");

  const [code, setCode] = useState(initialCode);
  const [error, setError] = useState<string | null>(null);
  // "checking" while the on-mount auto-login runs; "form" after a failure.
  const [phase, setPhase] = useState<"checking" | "form">("checking");
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // React strict/dev mode invokes effects twice — fire the auto-login once.
  // (validateAccessCode is idempotent — re-minting the same session is
  // harmless — but a second in-flight call could double-navigate.)
  const attempted = useRef(false);

  async function loginWith(candidate: string): Promise<void> {
    const result = await validateAccessCode(candidate);
    if (result.type === "participant") {
      // Deep-link context: land directly on the remote ballot.
      router.replace("/yip/me/vote");
    } else if (result.type === "jury") {
      router.replace("/yip/jury");
    } else if (result.type === "volunteer") {
      router.replace("/yip/volunteer");
    } else {
      setError(result.message);
      setPhase("form");
    }
  }

  useEffect(() => {
    if (attempted.current) return;
    attempted.current = true;

    if (!initialCode) {
      setError("This link is missing an access code");
      setPhase("form");
      return;
    }

    loginWith(initialCode).catch(() => {
      setError("Something went wrong. Please try again.");
      setPhase("form");
    });
    // Run exactly once on mount for the code baked into the URL.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!code.trim() || loading) return;

    setError(null);
    setLoading(true);
    try {
      await loginWith(code);
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
          <div className="mb-10 text-center">
            <h1 className="font-[family-name:var(--font-heading)] text-2xl font-bold text-[#1a1a3e]">
              Young Indians Parliament
            </h1>
            <p className="mt-1.5 text-sm text-[#1a1a3e]/40">Enter the House</p>
          </div>

          {phase === "checking" ? (
            /* Auto-login in progress — visible state, never a blank flash. */
            <div className="overflow-hidden rounded-2xl border border-[#1a1a3e]/5 bg-white shadow-xl shadow-[#1a1a3e]/5">
              <div className="flex flex-col items-center gap-4 p-10 text-center">
                <svg
                  className="size-8 animate-spin text-[#FF9933]"
                  viewBox="0 0 24 24"
                  fill="none"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                  />
                </svg>
                <div>
                  <h2 className="text-lg font-semibold text-[#1a1a3e]">
                    Checking your code…
                  </h2>
                  <p className="mt-1 font-[family-name:var(--font-mono)] text-sm font-bold tracking-[0.2em] text-[#1a1a3e]/40">
                    {initialCode}
                  </p>
                </div>
              </div>
              <div className="flex h-1">
                <div className="flex-1 bg-[#FF9933]" />
                <div className="flex-1 bg-white" />
                <div className="flex-1 bg-[#138808]" />
              </div>
            </div>
          ) : (
            /* Join-style code entry, prefilled with the code from the link. */
            <div className="overflow-hidden rounded-2xl border border-[#1a1a3e]/5 bg-white shadow-xl shadow-[#1a1a3e]/5">
              <div className="p-6 sm:p-8">
                <div className="mb-6 text-center">
                  <h2 className="text-lg font-semibold text-[#1a1a3e]">
                    Your Access Code
                  </h2>
                  <p className="mt-1 text-sm text-[#1a1a3e]/40">
                    Check the code from your invite email
                  </p>
                </div>

                <form
                  method="post"
                  action="#"
                  onSubmit={handleSubmit}
                  className="space-y-5"
                >
                  <div>
                    <input
                      ref={inputRef}
                      type="text"
                      placeholder="ABC123"
                      value={code}
                      onChange={(e) => {
                        setCode(
                          e.target.value
                            .toUpperCase()
                            .replace(/[^A-Z0-9]/g, "")
                        );
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
                      <svg
                        className="size-5 animate-spin"
                        viewBox="0 0 24 24"
                        fill="none"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        />
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                        />
                      </svg>
                    ) : (
                      <svg
                        className="size-5"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M5 12h14" />
                        <path d="m12 5 7 7-7 7" />
                      </svg>
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
          )}

          <p className="mt-8 text-center text-sm text-[#1a1a3e]/35">
            Link not working?{" "}
            <Link
              href="/yip/join"
              className="font-medium text-[#FF9933] hover:underline"
            >
              Type your code here
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
