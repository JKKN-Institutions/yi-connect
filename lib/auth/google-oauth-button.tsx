/**
 * Shared "Continue with Google" button for use across all Yi verticals
 * (yi-connect main, YIP, Yi-Future, Yuva, Thalir, ...).
 *
 * Per CLAUDE.md "canonical auth UI" pattern: every vertical's login page
 * imports this single component. The button calls
 * supabase.auth.signInWithOAuth({ provider: 'google' }) using the generic
 * browser client (not schema-pinned), which produces the SAME session
 * cookie that email+password and access-code flows produce. After OAuth,
 * Supabase redirects to the `redirectTo` URL.
 *
 * Yi-Future's /yi-future/access page (2026-04) was the first surface to
 * wire this; we lifted the pattern out here so YIP organizers, YIP
 * delegates, and any future vertical can drop it in with one line.
 */
"use client";

import { useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { Button } from "@/components/yip/ui/button";
import { Loader2 } from "lucide-react";

interface GoogleOAuthButtonProps {
  /** Where to land after successful Google sign-in. Must be a full path on this origin (e.g. "/yip/dashboard"). */
  redirectTo: string;
  /** Optional class names for visual variants (saffron for YIP, navy for Yi-Future, neutral default). */
  className?: string;
  /** Label override. Defaults to "Continue with Google". */
  label?: string;
}

export function GoogleOAuthButton({
  redirectTo,
  className,
  label = "Continue with Google",
}: GoogleOAuthButtonProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setError(null);
    setLoading(true);
    try {
      // Generic browser client (not schema-pinned). Auth operations don't need
      // a specific schema — they hit auth.* which is reachable from any client.
      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      );
      const { error: oauthErr } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}${redirectTo}`,
        },
      });
      if (oauthErr) {
        setError("Google sign-in failed. Try email instead.");
        setLoading(false);
      }
      // On success the browser is redirected to Google; this component unmounts.
    } catch {
      setError("Google sign-in failed. Try email instead.");
      setLoading(false);
    }
  }

  return (
    <div className="space-y-2">
      <Button
        type="button"
        variant="outline"
        className={className}
        onClick={handleClick}
        disabled={loading}
      >
        {loading ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <>
            <GoogleLogo />
            {label}
          </>
        )}
      </Button>
      {error && (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

function GoogleLogo() {
  return (
    <svg
      className="size-4"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  );
}
