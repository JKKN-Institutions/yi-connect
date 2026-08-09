"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { BrandStrip, ProgramWordmark } from "@/components/yi-future/brand/BrandHeader";
import { createClient } from "@/lib/yi-future/supabase/client";
import {
  loginAdmin,
  adminHomeForCurrentUser,
} from "@/app/yi-future/actions/auth";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [finishingGoogle, setFinishingGoogle] = useState(false);

  // ─── Google sign-in for admins ────────────────────────────────────────
  // This form was password-only, so an admin whose account is Google-backed
  // had no supported way in — their only route was the STUDENT door, which
  // after Google pushes them into "pick your chapter → pick your name", a
  // delegate flow their name is not in. Six chapter admins have a Google
  // identity and no password at all, and with email delivery down, password
  // reset cannot reach them either.
  async function handleGoogle() {
    setError(null);
    const supabase = createClient();
    const { error: oauthErr } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/yi-future/login` },
    });
    if (oauthErr) setError("Google sign-in could not start. Try again.");
  }

  // Finish the Google round trip.
  //
  // Do NOT call exchangeCodeForSession here. createBrowserClient runs with
  // detectSessionInUrl defaulting to true, so constructing the client above
  // already spends the single-use ?code=. Calling exchange on top of it is a
  // second exchange of a spent code, which always fails — that mistake shipped
  // once already and reported "link expired" over a working session.
  useEffect(() => {
    if (!new URLSearchParams(window.location.search).has("code")) return;
    let cancelled = false;
    setFinishingGoogle(true);

    (async () => {
      const supabase = createClient();
      let user = (await supabase.auth.getUser()).data.user;
      // The auto-detect is asynchronous — wait for it rather than racing it.
      for (let i = 0; i < 10 && !user; i++) {
        await new Promise((r) => setTimeout(r, 150));
        user = (await supabase.auth.getUser()).data.user;
      }
      if (cancelled) return;

      if (!user) {
        setError("That Google sign-in did not complete. Please try again.");
        setFinishingGoogle(false);
        return;
      }

      // Route by ROLE, so a national admin lands on the national dashboard and
      // a chapter admin on their chapter — rather than a fixed path that is
      // wrong for one of them.
      const home = await adminHomeForCurrentUser();
      if (cancelled) return;
      if (!home.ok || !home.path) {
        setError(
          `${home.email ?? "That Google account"} is not a Yi-Future admin. If you are a student, mentor or jury member, sign in with your access code instead.`
        );
        setFinishingGoogle(false);
        return;
      }
      router.push(home.path);
      router.refresh();
    })();

    return () => {
      cancelled = true;
    };
    // Mount only: the code in the URL is consumed exactly once.
  }, [router]);

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
