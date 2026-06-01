/**
 * Shared "Email me a magic link" form. Sibling to GoogleOAuthButton.
 * Calls supabase.auth.signInWithOtp({ email }) — produces an emailed
 * link that signs the user in on click. Same session cookie as
 * email+password or Google OAuth.
 */
"use client";

import { useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { Button } from "@/components/yip/ui/button";
import { Input } from "@/components/yip/ui/input";
import { Label } from "@/components/yip/ui/label";
import { Loader2, Mail, CheckCircle2 } from "lucide-react";

interface MagicLinkFormProps {
  /** Where the user lands after clicking the magic link. */
  redirectTo: string;
  className?: string;
}

export function MagicLinkForm({ redirectTo, className }: MagicLinkFormProps) {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    if (!email.includes("@")) {
      setError("Enter a valid email address.");
      return;
    }
    setLoading(true);
    try {
      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      );
      const { error: otpErr } = await supabase.auth.signInWithOtp({
        email,
        options: {
          // Route through /auth/callback so the PKCE `code` from the magic link
          // is exchanged for a session (exchangeCodeForSession) BEFORE landing on
          // the protected destination. Pointing `emailRedirectTo` straight at a
          // protected page (e.g. /yip/dashboard) orphans the code — the page has
          // no code-exchange, so the link bounces and sign-in never completes.
          // Same fix already applied to GoogleOAuthButton.
          emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(redirectTo)}`,
        },
      });
      if (otpErr) {
        setError(otpErr.message || "Could not send magic link.");
      } else {
        setSent(true);
      }
    } catch {
      setError("Could not send magic link. Try email+password instead.");
    } finally {
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <div className={`rounded-md bg-green-50 border border-green-200 p-3 text-sm text-green-800 ${className ?? ""}`}>
        <div className="flex items-start gap-2">
          <CheckCircle2 className="size-4 shrink-0 mt-0.5" />
          <div>
            <p className="font-medium">Magic link sent.</p>
            <p className="mt-0.5 text-green-700">Check {email} — click the link to sign in.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <form method="post" action="#" onSubmit={handleSubmit} className={`space-y-2 ${className ?? ""}`}>
      <Label htmlFor="magic-email" className="text-sm">Email me a sign-in link</Label>
      <div className="flex gap-2">
        <Input
          id="magic-email"
          type="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={loading}
          required
          className="flex-1"
        />
        <Button type="submit" variant="outline" disabled={loading || !email}>
          {loading ? <Loader2 className="size-4 animate-spin" /> : <Mail className="size-4" />}
        </Button>
      </div>
      {error && <p className="text-sm text-red-600" role="alert">{error}</p>}
    </form>
  );
}
