"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ProgramWordmark } from "@/components/yi-future/brand/BrandHeader";
import { CodeEntryStep } from "@/app/yi-future/join/steps/code-entry";
import { createClient } from "@/lib/yi-future/supabase/client";
import {
  loginDelegateByEmail,
  loginDelegateById,
  listDelegatesForChapter,
} from "@/app/yi-future/actions/auth";

type Tab = "code" | "google" | "email";

export default function AccessCodePage() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("code");

  return (
    <main className="min-h-screen bg-ivory flex flex-col">
      <header className="py-4 px-4 border-b border-navy/10 bg-white safe-top">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <ProgramWordmark />
          <Link
            href="/yi-future/login"
            className="text-xs text-navy/60 hover:text-navy font-medium"
          >
            Admin sign-in
          </Link>
        </div>
      </header>

      <section className="flex-1 px-4 py-8 md:py-12">
        <div className="max-w-lg mx-auto">
          <div className="text-center mb-6">
            <h1 className="text-2xl md:text-3xl font-bold text-navy">
              Delegate Login
            </h1>
            <p className="mt-1 text-sm text-navy/60">
              Choose how you want to sign in
            </p>
          </div>

          {/* Tab bar */}
          <div className="flex border-b border-navy/10 mb-6">
            {([
              { key: "code" as Tab, label: "Access Code" },
              { key: "google" as Tab, label: "Google" },
              { key: "email" as Tab, label: "Email" },
            ]).map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setTab(t.key)}
                className={`flex-1 py-3 text-sm font-semibold transition-colors ${
                  tab === t.key
                    ? "text-navy border-b-2 border-[#F5A623]"
                    : "text-navy/40 hover:text-navy/70"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {tab === "code" && (
            <CodeEntryStep
              onBack={() => router.push("/yi-future/join")}
              onSuccess={(redirect) => {
                router.push(redirect);
                router.refresh();
              }}
            />
          )}

          {tab === "google" && <GoogleLoginTab />}

          {tab === "email" && <EmailLoginTab />}
        </div>
      </section>

      <footer className="border-t border-navy/10 py-6 px-4 bg-white">
        <div className="max-w-3xl mx-auto text-center">
          <p className="text-[11px] text-navy/40">
            Yi YUVA Future 6.0 · From Opinions to Impact
          </p>
          <p className="mt-2 text-xs text-navy/50">
            Don&apos;t have an account?{" "}
            <Link
              href="/yi-future/join"
              className="font-semibold text-navy hover:text-yi-gold"
            >
              Register here
            </Link>
          </p>
        </div>
      </footer>
    </main>
  );
}

// ─── Google Login Tab ──────────────────────────────────────────────
function GoogleLoginTab() {
  const router = useRouter();
  const [step, setStep] = useState<"start" | "pick-chapter" | "pick-name">("start");
  const [chapters, setChapters] = useState<{ id: string; name: string }[]>([]);
  const [delegates, setDelegates] = useState<{ id: string; full_name: string; email: string | null }[]>([]);
  const [selectedChapter, setSelectedChapter] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [googleEmail, setGoogleEmail] = useState<string | null>(null);

  async function handleGoogleSignIn() {
    setError(null);
    const supabase = createClient();
    const { error: oauthErr } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/yi-future/access?tab=google&step=pick-chapter`,
      },
    });
    if (oauthErr) {
      setError("Google sign-in failed. Try another method.");
    }
  }

  async function loadChapters() {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user?.email) setGoogleEmail(user.email);

    const res = await fetch("/api/yi-future/chapters");
    if (res.ok) {
      const data = await res.json();
      setChapters(data);
      setStep("pick-chapter");
    }
  }

  async function handleChapterSelect() {
    if (!selectedChapter) return;
    setError(null);
    startTransition(async () => {
      const list = await listDelegatesForChapter(selectedChapter);
      setDelegates(list);
      setStep("pick-name");
    });
  }

  async function handleNameSelect(delegateId: string) {
    setError(null);
    startTransition(async () => {
      const res = await loginDelegateById(delegateId);
      if (res.ok) {
        router.push(res.redirect);
        router.refresh();
      } else {
        setError(res.error);
      }
    });
  }

  if (step === "start") {
    return (
      <div className="text-center space-y-4">
        <p className="text-sm text-navy/60">
          Sign in with your Google account, then select your chapter and name.
        </p>
        <button
          type="button"
          onClick={handleGoogleSignIn}
          className="w-full py-3 rounded-xl bg-white border-2 border-navy/20 text-navy font-semibold hover:border-navy/40 flex items-center justify-center gap-3"
        >
          <svg viewBox="0 0 24 24" width="20" height="20">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
          </svg>
          Continue with Google
        </button>
        <button
          type="button"
          onClick={loadChapters}
          className="text-xs text-navy/50 hover:text-navy"
        >
          Already signed in with Google? Continue →
        </button>
        {error && (
          <div className="p-3 rounded-md bg-red-50 border border-red-200 text-sm text-red-700">
            {error}
          </div>
        )}
      </div>
    );
  }

  if (step === "pick-chapter") {
    return (
      <div className="space-y-4">
        {googleEmail && (
          <p className="text-xs text-navy/50 text-center">
            Signed in as <strong className="text-navy">{googleEmail}</strong>
          </p>
        )}
        <div>
          <label className="block text-xs font-bold uppercase tracking-widest text-navy/60 mb-2">
            Select your chapter
          </label>
          <select
            value={selectedChapter}
            onChange={(e) => setSelectedChapter(e.target.value)}
            className="w-full px-3 py-2.5 border border-navy/20 rounded-md text-sm bg-white"
          >
            <option value="">Pick your chapter…</option>
            {chapters.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
        <button
          type="button"
          onClick={handleChapterSelect}
          disabled={!selectedChapter || pending}
          className="w-full py-3 rounded-xl bg-navy text-ivory font-semibold hover:bg-navy-dark disabled:opacity-40"
        >
          {pending ? "Loading…" : "Next"}
        </button>
        {error && (
          <div className="p-3 rounded-md bg-red-50 border border-red-200 text-sm text-red-700">
            {error}
          </div>
        )}
      </div>
    );
  }

  // pick-name
  return (
    <div className="space-y-4">
      <p className="text-sm text-navy/60 text-center">
        Select your name to log in
      </p>
      <div className="space-y-1 max-h-80 overflow-y-auto">
        {delegates.map((d) => (
          <button
            key={d.id}
            type="button"
            onClick={() => handleNameSelect(d.id)}
            disabled={pending}
            className="w-full text-left px-4 py-3 rounded-lg border border-navy/10 hover:border-[#F5A623]/50 hover:bg-[#F5A623]/5 transition-colors disabled:opacity-50"
          >
            <div className="font-semibold text-navy">{d.full_name}</div>
            {d.email && <div className="text-xs text-navy/50">{d.email}</div>}
          </button>
        ))}
        {delegates.length === 0 && (
          <p className="text-sm text-navy/50 italic text-center py-4">
            No delegates registered in this chapter yet.
          </p>
        )}
      </div>
      <button
        type="button"
        onClick={() => setStep("pick-chapter")}
        className="text-xs text-navy/50 hover:text-navy"
      >
        ← Back to chapter selection
      </button>
      {error && (
        <div className="p-3 rounded-md bg-red-50 border border-red-200 text-sm text-red-700">
          {error}
        </div>
      )}
    </div>
  );
}

// ─── Email Login Tab ───────────────────────────────────────────────
function EmailLoginTab() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await loginDelegateByEmail(email);
      if (res.ok) {
        router.push(res.redirect);
        router.refresh();
      } else {
        setError(res.error);
      }
    });
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-navy/60 text-center">
        Enter the email you registered with. No password needed.
      </p>
      <form onSubmit={handleSubmit} className="space-y-3">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="your.email@example.com"
          required
          autoComplete="email"
          className="w-full px-4 py-3 border border-navy/20 rounded-xl text-sm focus:border-[#F5A623] focus:outline-none focus:ring-2 focus:ring-[#F5A623]/20"
        />
        <button
          type="submit"
          disabled={!email || pending}
          className="w-full py-3 rounded-xl bg-navy text-ivory font-semibold hover:bg-navy-dark disabled:opacity-40"
        >
          {pending ? "Checking…" : "Log in with email"}
        </button>
      </form>
      {error && (
        <div className="p-3 rounded-md bg-red-50 border border-red-200 text-sm text-red-700">
          {error}
        </div>
      )}
    </div>
  );
}
