"use client";

import { useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { ResultLine } from "../_ui/client";

/**
 * Sign-in for Yi Recognitions. Google or an emailed link, both landing on
 * /auth/callback so the PKCE code is exchanged before the session is used.
 * The same email also carries a code (6 Nov 2026): company mail systems such
 * as Outlook 365 open links to scan them, which uses up the one-time link
 * before the person clicks it. Typing the code works on any device.
 * The password form exists ONLY in local development, for testing.
 */
export function SignInForm({ next, devPassword }: { next: string; devPassword: boolean }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState<"google" | "link" | "password" | "code" | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);

  const client = () =>
    createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
  const callback = () => `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;

  async function google() {
    setBusy("google");
    setResult(null);
    const { error } = await client().auth.signInWithOAuth({ provider: "google", options: { redirectTo: callback() } });
    if (error) {
      setResult({ ok: false, text: "Google sign-in did not start. Try the emailed link instead." });
      setBusy(null);
    }
  }

  async function emailLink(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setBusy("link");
    setResult(null);
    const { error } = await client().auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: callback(), shouldCreateUser: false },
    });
    setBusy(null);
    if (!error) setSentTo(email.trim());
    setResult(
      error
        ? { ok: false, text: "We couldn't send a link to that address. Use the email your Yi account is under." }
        : {
            ok: true,
            text: `Email sent to ${email.trim()}. Open the link on this device, or type the code from the email below. If the link takes you back without signing in, use the code.`,
          }
    );
  }

  async function withCode(e: React.FormEvent) {
    e.preventDefault();
    const token = code.replace(/\s+/g, "");
    if (!sentTo || !token) return;
    setBusy("code");
    setResult(null);
    const { error } = await client().auth.verifyOtp({ email: sentTo, token, type: "email" });
    if (error) {
      setResult({ ok: false, text: "That code didn't work. Check it, or ask for a new email. Codes last one hour; only the newest one works." });
      setBusy(null);
      return;
    }
    window.location.assign(next);
  }

  async function withPassword(e: React.FormEvent) {
    e.preventDefault();
    setBusy("password");
    setResult(null);
    const { error } = await client().auth.signInWithPassword({ email: email.trim(), password });
    if (error) {
      setResult({ ok: false, text: error.message });
      setBusy(null);
      return;
    }
    window.location.assign(next);
  }

  return (
    <div className="rx-stack">
      <button type="button" className="rx-btn" style={{ width: "100%" }} onClick={google} disabled={busy !== null}>
        {busy === "google" ? "Opening Google…" : "Continue with Google"}
      </button>

      <div className="rx-row rx-small rx-mute" style={{ gap: 10 }}>
        <hr className="rx-rule" style={{ flex: 1, margin: 0 }} />
        or get a link by email
        <hr className="rx-rule" style={{ flex: 1, margin: 0 }} />
      </div>

      <form onSubmit={devPassword ? withPassword : emailLink} className="rx-stack">
        <div>
          <label htmlFor="rx-email" className="rx-label">Email</label>
          <input
            id="rx-email"
            type="email"
            autoComplete="email"
            className="rx-input"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        {devPassword ? (
          <div>
            <label htmlFor="rx-password" className="rx-label">Password (local testing only)</label>
            <input
              id="rx-password"
              type="password"
              autoComplete="current-password"
              className="rx-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
        ) : null}
        <button type="submit" className="rx-btn rx-btn-quiet" style={{ width: "100%" }} disabled={busy !== null}>
          {devPassword
            ? busy === "password" ? "Signing in…" : "Sign in"
            : busy === "link" ? "Sending…" : "Email me a sign-in link"}
        </button>
      </form>
      {sentTo && !devPassword ? (
        <form onSubmit={withCode} className="rx-stack">
          <div>
            <label htmlFor="rx-code" className="rx-label">Code from the email</label>
            <input
              id="rx-code"
              inputMode="numeric"
              autoComplete="one-time-code"
              className="rx-input"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              required
            />
          </div>
          <button type="submit" className="rx-btn" style={{ width: "100%" }} disabled={busy !== null}>
            {busy === "code" ? "Signing in…" : "Sign in with the code"}
          </button>
        </form>
      ) : null}
      <ResultLine result={result} />
    </div>
  );
}
