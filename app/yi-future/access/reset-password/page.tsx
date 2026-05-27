"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ProgramWordmark } from "@/components/yi-future/brand/BrandHeader";
import { createClient } from "@/lib/yi-future/supabase/client";

export default function ResetPasswordPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [pending, startTransition] = useTransition();
  const [exchanging, setExchanging] = useState(false);

  useEffect(() => {
    const code = searchParams.get("code");
    if (!code) return;
    setExchanging(true);
    const supabase = createClient();
    supabase.auth
      .exchangeCodeForSession(code)
      .then(({ error: err }) => {
        if (err) setError("Reset link expired or invalid. Request a new one.");
        setExchanging(false);
      })
      .catch(() => {
        setError("Something went wrong. Request a new reset link.");
        setExchanging(false);
      });
  }, [searchParams]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }
    startTransition(async () => {
      const supabase = createClient();
      const { error: updateErr } = await supabase.auth.updateUser({
        password,
      });
      if (updateErr) {
        setError(updateErr.message);
        return;
      }
      setSuccess(true);
    });
  }

  if (exchanging) {
    return (
      <main className="min-h-screen bg-ivory flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="animate-spin h-8 w-8 border-4 border-navy/20 border-t-navy rounded-full mx-auto" />
          <p className="text-sm text-navy/60">Verifying reset link…</p>
        </div>
      </main>
    );
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
          {success ? (
            <div className="text-center space-y-4">
              <div className="text-5xl">✅</div>
              <h1 className="text-2xl font-bold text-navy">Password updated</h1>
              <p className="text-sm text-navy/60">
                Your password has been reset. You can now sign in with your new
                password.
              </p>
              <button
                type="button"
                onClick={() => router.push("/yi-future/access")}
                className="mt-4 px-6 py-3 rounded-xl bg-navy text-ivory font-semibold hover:bg-navy-dark"
              >
                Sign in →
              </button>
            </div>
          ) : (
            <>
              <div className="text-center mb-6">
                <h1 className="text-2xl md:text-3xl font-bold text-navy">
                  Set new password
                </h1>
                <p className="mt-1 text-sm text-navy/60">
                  Choose a new password for your account.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-widest text-navy/60 mb-1">
                    New Password
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    minLength={6}
                    autoComplete="new-password"
                    autoFocus
                    className="w-full px-4 py-3 border border-navy/20 rounded-xl text-sm focus:border-[#F5A623] focus:outline-none focus:ring-2 focus:ring-[#F5A623]/20"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-widest text-navy/60 mb-1">
                    Confirm Password
                  </label>
                  <input
                    type="password"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    placeholder="••••••••"
                    required
                    minLength={6}
                    autoComplete="new-password"
                    className="w-full px-4 py-3 border border-navy/20 rounded-xl text-sm focus:border-[#F5A623] focus:outline-none focus:ring-2 focus:ring-[#F5A623]/20"
                  />
                </div>
                <button
                  type="submit"
                  disabled={!password || !confirm || pending}
                  className="w-full py-3 rounded-xl bg-navy text-ivory font-semibold hover:bg-navy-dark disabled:opacity-40"
                >
                  {pending ? "Updating…" : "Update password"}
                </button>
              </form>

              {error && (
                <div className="mt-4 p-3 rounded-md bg-red-50 border border-red-200 text-sm text-red-700">
                  {error}
                  {error.includes("expired") && (
                    <Link
                      href="/yi-future/access/forgot-password"
                      className="block mt-2 font-semibold underline"
                    >
                      Request a new reset link →
                    </Link>
                  )}
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
