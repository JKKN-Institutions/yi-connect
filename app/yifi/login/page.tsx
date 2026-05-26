"use client";

import { useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { loginOrganiser, requestPasswordReset } from "@/app/yifi/actions/auth";

type View = "login" | "forgot" | "reset-sent" | "choose";

export default function YiFiLoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [view, setView] = useState<View>(
    searchParams.get("reset") === "true" ? "login" : "login"
  );
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [roles, setRoles] = useState({ isOrganiser: false, isRegistrant: false });

  function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await loginOrganiser(email, password);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      if (res.isOrganiser && res.isRegistrant) {
        setRoles({ isOrganiser: true, isRegistrant: true });
        setView("choose");
      } else if (res.isOrganiser) {
        router.push("/yifi/admin");
        router.refresh();
      } else {
        router.push("/yifi/admin");
        router.refresh();
      }
    });
  }

  function handleForgot(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await requestPasswordReset(email);
      if (!res.ok) {
        setError(res.error ?? "Something went wrong");
        return;
      }
      setView("reset-sent");
    });
  }

  return (
    <main className="min-h-screen bg-[#000066] flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <Link href="/yifi" className="text-[#FD7215] font-bold text-2xl">
            YiFi
          </Link>
          <p className="text-white/50 text-sm mt-2">Organiser Portal</p>
        </div>

        {view === "login" && (
          <>
            {searchParams.get("reset") === "true" && (
              <div className="bg-[#229434]/10 border border-[#229434]/20 rounded-lg px-3 py-2 text-sm text-[#229434] mb-4 text-center">
                Password updated. Sign in with your new password.
              </div>
            )}

            <div className="bg-white/5 border border-white/10 rounded-xl p-6">
              <h1 className="text-lg font-semibold text-white text-center mb-1">
                Sign In
              </h1>
              <p className="text-white/40 text-xs text-center mb-6">
                Enter your credentials to access event admin
              </p>

              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label htmlFor="email" className="block text-xs font-medium text-white/60 mb-1.5">
                    Email
                  </label>
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                    autoFocus
                    placeholder="organiser@example.com"
                    className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white text-sm placeholder:text-white/30 focus:outline-none focus:border-[#FD7215]/50 focus:ring-1 focus:ring-[#FD7215]/30"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label htmlFor="password" className="block text-xs font-medium text-white/60">
                      Password
                    </label>
                    <button
                      type="button"
                      onClick={() => setView("forgot")}
                      className="text-xs text-[#FD7215]/70 hover:text-[#FD7215]"
                    >
                      Forgot password?
                    </button>
                  </div>
                  <input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoComplete="current-password"
                    placeholder="Enter password"
                    className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white text-sm placeholder:text-white/30 focus:outline-none focus:border-[#FD7215]/50 focus:ring-1 focus:ring-[#FD7215]/30"
                  />
                </div>

                {error && (
                  <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2 text-sm text-red-300">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={pending}
                  className="w-full py-2.5 bg-[#FD7215] hover:bg-[#FD7215]/90 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
                >
                  {pending ? "Signing in..." : "Sign In"}
                </button>
              </form>
            </div>

            <p className="text-center text-white/30 text-xs mt-6">
              Are you a YiFi attendee?{" "}
              <Link href="/yifi/join" className="text-[#FD7215] hover:underline">
                Enter access code
              </Link>
            </p>
          </>
        )}

        {view === "forgot" && (
          <div className="bg-white/5 border border-white/10 rounded-xl p-6">
            <h1 className="text-lg font-semibold text-white text-center mb-1">
              Reset Password
            </h1>
            <p className="text-white/40 text-xs text-center mb-6">
              Enter your email and we'll send a reset link
            </p>

            <form onSubmit={handleForgot} className="space-y-4">
              <div>
                <label htmlFor="reset-email" className="block text-xs font-medium text-white/60 mb-1.5">
                  Email
                </label>
                <input
                  id="reset-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  autoFocus
                  placeholder="organiser@example.com"
                  className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white text-sm placeholder:text-white/30 focus:outline-none focus:border-[#FD7215]/50 focus:ring-1 focus:ring-[#FD7215]/30"
                />
              </div>

              {error && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2 text-sm text-red-300">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={pending}
                className="w-full py-2.5 bg-[#FD7215] hover:bg-[#FD7215]/90 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
              >
                {pending ? "Sending..." : "Send Reset Link"}
              </button>
            </form>

            <button
              onClick={() => { setView("login"); setError(null); }}
              className="w-full text-center text-white/40 text-xs mt-4 hover:text-white/60"
            >
              Back to sign in
            </button>
          </div>
        )}

        {view === "reset-sent" && (
          <div className="bg-white/5 border border-white/10 rounded-xl p-6 text-center">
            <div className="text-3xl mb-3">✉️</div>
            <h1 className="text-lg font-semibold text-white mb-2">Check Your Email</h1>
            <p className="text-white/50 text-sm mb-6">
              We sent a password reset link to <span className="text-white">{email}</span>.
              Click the link in the email to set a new password.
            </p>
            <button
              onClick={() => { setView("login"); setError(null); }}
              className="text-[#FD7215] text-sm hover:underline"
            >
              Back to sign in
            </button>
          </div>
        )}

        {view === "choose" && (
          <div className="bg-white/5 border border-white/10 rounded-xl p-6">
            <h1 className="text-lg font-semibold text-white text-center mb-1">
              Welcome Back
            </h1>
            <p className="text-white/40 text-xs text-center mb-6">
              Where would you like to go?
            </p>

            <div className="space-y-3">
              <button
                onClick={() => { router.push("/yifi/admin"); router.refresh(); }}
                className="w-full bg-[#FD7215] hover:bg-[#FD7215]/90 text-white rounded-xl p-4 text-left transition-colors"
              >
                <div className="font-semibold text-sm">Admin Dashboard</div>
                <div className="text-white/70 text-xs mt-0.5">
                  Manage registrants, matches, vows, and event operations
                </div>
              </button>

              {roles.isRegistrant && (
                <button
                  onClick={() => { router.push("/yifi/me"); router.refresh(); }}
                  className="w-full bg-white/5 hover:bg-white/10 border border-white/10 text-white rounded-xl p-4 text-left transition-colors"
                >
                  <div className="font-semibold text-sm">My YiFi</div>
                  <div className="text-white/50 text-xs mt-0.5">
                    View your routing matches, census, and vows
                  </div>
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
