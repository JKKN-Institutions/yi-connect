"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { loginOrganiser } from "@/app/yifi/actions/auth";

export default function YiFiLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await loginOrganiser(email, password);
      if (res.ok) {
        router.push("/yifi/admin");
        router.refresh();
      } else {
        setError(res.error);
      }
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

        <div className="bg-white/5 border border-white/10 rounded-xl p-6">
          <h1 className="text-lg font-semibold text-white text-center mb-1">
            Sign In
          </h1>
          <p className="text-white/40 text-xs text-center mb-6">
            Enter your credentials to access event admin
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
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
              <label htmlFor="password" className="block text-xs font-medium text-white/60 mb-1.5">
                Password
              </label>
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
      </div>
    </main>
  );
}
