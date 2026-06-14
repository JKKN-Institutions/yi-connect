"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { ProgramWordmark } from "@/components/yi-future/brand/BrandHeader";
import { requestAdminPasswordReset } from "@/app/yi-future/actions/auth";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) {
      setError("Please enter your email address.");
      return;
    }
    startTransition(async () => {
      const supabase = createClient();
      const { error: resetErr } = await supabase.auth.resetPasswordForEmail(
        trimmed,
        {
          redirectTo: `${window.location.origin}/yi-future/access/reset-password`,
        }
      );
      if (resetErr) {
        setError(resetErr.message);
        return;
      }
      setSent(true);
    });
  }

  return (
    <main className="min-h-screen bg-ivory flex flex-col">
      <header className="py-4 px-4 border-b border-navy/10 bg-white safe-top">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <ProgramWordmark />
          <Link
            href="/yi-future/access"
            className="text-xs text-navy/60 hover:text-navy font-medium"
          >
            ← Back to sign in
          </Link>
        </div>
      </header>

      <section className="flex-1 px-4 py-8 md:py-12">
        <div className="max-w-md mx-auto">
          {sent ? (
            <div className="text-center space-y-4">
              <div className="text-5xl">📧</div>
              <h1 className="text-2xl font-bold text-navy">Check your email</h1>
              <p className="text-sm text-navy/60">
                We sent a password reset link to{" "}
                <strong className="text-navy">{email}</strong>. Click the link in
                the email to set a new password.
              </p>
              <p className="text-xs text-navy/40">
                Didn&apos;t get it? Check your spam folder, or{" "}
                <button
                  type="button"
                  onClick={() => setSent(false)}
                  className="underline hover:text-navy"
                >
                  try again
                </button>
                .
              </p>
            </div>
          ) : (
            <>
              <div className="text-center mb-6">
                <h1 className="text-2xl md:text-3xl font-bold text-navy">
                  Reset your password
                </h1>
                <p className="mt-1 text-sm text-navy/60">
                  Enter the email you registered with and we&apos;ll send you a
                  reset link.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-widest text-navy/60 mb-1">
                    Email
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="your.email@example.com"
                    required
                    autoComplete="email"
                    autoFocus
                    className="w-full px-4 py-3 border border-navy/20 rounded-xl text-sm focus:border-[#F5A623] focus:outline-none focus:ring-2 focus:ring-[#F5A623]/20"
                  />
                </div>
                <button
                  type="submit"
                  disabled={!email.trim() || pending}
                  className="w-full py-3 rounded-xl bg-navy text-ivory font-semibold hover:bg-navy-dark disabled:opacity-40"
                >
                  {pending ? "Sending…" : "Send reset link"}
                </button>
              </form>

              {error && (
                <div className="mt-4 p-3 rounded-md bg-red-50 border border-red-200 text-sm text-red-700">
                  {error}
                </div>
              )}
            </>
          )}
        </div>
      </section>

      <footer className="border-t border-navy/10 py-6 px-4 bg-white">
        <div className="max-w-3xl mx-auto text-center">
          <p className="text-[11px] text-navy/40">
            Yi YUVA Future 6.0 · From Opinions to Impact
          </p>
        </div>
      </footer>
    </main>
  );
}
