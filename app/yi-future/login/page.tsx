"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { BrandStrip, ProgramWordmark } from "@/components/yi-future/brand/BrandHeader";
import { loginAdmin } from "@/app/yi-future/actions/auth";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await loginAdmin(email, password);
      if (res.ok) {
        router.push("/yi-future/chapter");
        router.refresh();
      } else {
        setError(res.error);
      }
    });
  }

  return (
    <main className="min-h-screen bg-ivory flex flex-col">
      <header className="py-4 px-4 border-b border-navy/10 bg-white safe-top">
        <div className="max-w-5xl mx-auto">
          <ProgramWordmark />
        </div>
      </header>

      <section className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          <BrandStrip className="mb-8" />

          <div className="bg-white rounded-lg shadow-sm border border-navy/10 p-8">
            <h1 className="text-3xl font-bold text-navy text-center">
              Admin Sign-In
            </h1>
            <p className="mt-3 text-sm text-navy/60 text-center">
              For Chapter, Host Chapter, and Yi National administrators.
            </p>

            <form onSubmit={handleSubmit} className="mt-8 space-y-4">
              <div>
                <label
                  htmlFor="email"
                  className="block text-xs font-semibold uppercase tracking-widest text-navy/70 mb-2"
                >
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-3 border border-navy/20 rounded-md focus:border-yi-gold focus:outline-none focus:ring-4 focus:ring-yi-gold/20"
                />
              </div>

              <div>
                <label
                  htmlFor="password"
                  className="block text-xs font-semibold uppercase tracking-widest text-navy/70 mb-2"
                >
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3 border border-navy/20 rounded-md focus:border-yi-gold focus:outline-none focus:ring-4 focus:ring-yi-gold/20"
                />
              </div>

              {error && (
                <div className="p-3 rounded-md bg-red-50 border border-red-200 text-sm text-red-700">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={!email || !password || pending}
                className="w-full py-3 rounded-md bg-navy text-ivory font-semibold hover:bg-navy-dark transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {pending ? "Signing in…" : "Sign in"}
              </button>
            </form>

            <div className="mt-6 pt-6 border-t border-navy/10 text-center">
              <p className="text-xs text-navy/50">Student, mentor, or jury?</p>
              <Link
                href="/yi-future/access"
                className="mt-1 inline-block text-sm text-navy font-semibold hover:text-yi-gold transition-colors"
              >
                Sign in with code / Google / email →
              </Link>
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-navy/10 py-6 px-4 bg-white">
        <BrandStrip />
      </footer>
    </main>
  );
}
