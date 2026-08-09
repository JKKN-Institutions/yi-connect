"use client";

import { useState, useTransition, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { BrandStrip, ProgramWordmark } from "@/components/yi-future/brand/BrandHeader";
import { createClient } from "@/lib/yi-future/supabase/client";
import {
  loginAdmin,
  adminHomeForCurrentUser,
} from "@/app/yi-future/actions/auth";

// useSearchParams() forces this subtree to render on the client, so it needs a
// Suspense boundary or the production build refuses to prerender the route.
export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginInner />
    </Suspense>
  );
}

function LoginInner() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // Seeded at first render rather than flipped inside the effect, so the
  // returning admin never sees the form flash before the spinner — and so no
  // setState happens synchronously inside an effect.
  const returningFromGoogle = useSearchParams().has("code");
  const [finishingGoogle, setFinishingGoogle] = useState(returningFromGoogle);

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
    if (!returningFromGoogle) return;
    let cancelled = false;

    // Watchdog. The catch below covers a throw; this covers a HANG — a server
    // action that never settles would otherwise leave the spinner up forever
    // with no error and no way forward.
    const watchdog = setTimeout(() => {
      if (cancelled) return;
      setError(
        "That took too long. You may already be signed in — try /yi-future/chapter or /yi-future/national, or reload and try again."
      );
      setFinishingGoogle(false);
    }, 15000);

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
    })().catch(() => {
      // Any throw in the block above — a failing server action, a network
      // blip — used to kill it silently, leaving "Finishing sign-in…" spinning
      // forever AFTER the session had already been established. The user was
      // signed in and being shown a spinner. Never let the async work end
      // without releasing the UI.
      if (cancelled) return;
      setError(
        "Signed in, but we could not work out where to send you. Try /yi-future/chapter or /yi-future/national directly, or reload this page."
      );
      setFinishingGoogle(false);
    });

    return () => {
      cancelled = true;
    };
    // Mount only: the code in the URL is consumed exactly once.
  }, [router, returningFromGoogle]);

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

            <div className="mt-5 flex items-center gap-3">
              <span className="h-px flex-1 bg-navy/10" />
              <span className="text-[11px] uppercase tracking-widest text-navy/40">
                or
              </span>
              <span className="h-px flex-1 bg-navy/10" />
            </div>

            <button
              type="button"
              onClick={handleGoogle}
              disabled={finishingGoogle}
              className="mt-4 w-full py-3 rounded-md bg-white border-2 border-navy/20 text-navy font-semibold hover:border-navy/40 transition-colors flex items-center justify-center gap-3 disabled:opacity-50"
            >
              <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden>
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              {finishingGoogle ? "Finishing sign-in…" : "Continue with Google"}
            </button>

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
