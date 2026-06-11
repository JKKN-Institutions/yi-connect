"use client";

// ═══════════════════════════════════════════════════════════════════════
// Yi Youth Academy — Cloudflare Turnstile widget (public abuse hardening).
// Spec: Known Issue P2 — "CAPTCHA/Turnstile on public apply + OTP endpoints".
//
// ENV-GATED + graceful NO-OP:
//   • NEXT_PUBLIC_TURNSTILE_SITE_KEY unset → renders null. The form is
//     unchanged and onToken is never called (token stays null/"").
//   • NEXT_PUBLIC_TURNSTILE_SITE_KEY set   → loads the Cloudflare script
//     once and renders an explicit widget, surfacing the response token via
//     the onToken callback (and refreshing it on expiry).
//
// Self-contained: no npm dependency, just the official api.js script tag.
// ═══════════════════════════════════════════════════════════════════════

import { useEffect, useRef } from "react";

const SCRIPT_SRC =
  "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
const SCRIPT_ID = "cf-turnstile-script";

// Minimal shape of the global the Cloudflare script installs.
type TurnstileApi = {
  render: (
    el: HTMLElement,
    opts: {
      sitekey: string;
      callback: (token: string) => void;
      "expired-callback"?: () => void;
      "error-callback"?: () => void;
      theme?: "light" | "dark" | "auto";
    }
  ) => string;
  remove: (widgetId: string) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
    // Named onload the api.js calls once it has parsed (render=explicit).
    __yuvaTurnstileOnload?: () => void;
  }
}

/** Load the Cloudflare api.js once; resolve when window.turnstile is ready. */
function loadTurnstileScript(): Promise<void> {
  return new Promise((resolve) => {
    if (typeof window === "undefined") return;
    if (window.turnstile) {
      resolve();
      return;
    }
    const existing = document.getElementById(SCRIPT_ID);
    if (existing) {
      // Script tag present but global not ready yet — poll briefly.
      const check = () => {
        if (window.turnstile) resolve();
        else setTimeout(check, 50);
      };
      check();
      return;
    }
    window.__yuvaTurnstileOnload = () => resolve();
    const s = document.createElement("script");
    s.id = SCRIPT_ID;
    s.src = `${SCRIPT_SRC}&onload=__yuvaTurnstileOnload`;
    s.async = true;
    s.defer = true;
    document.head.appendChild(s);
  });
}

/**
 * Turnstile challenge widget.
 *
 * @param onToken  Called with the verification token when the challenge is
 *                 solved, and with "" when it expires (so callers re-require
 *                 a fresh solve). Never fires when the site key is absent.
 */
export function YuvaTurnstile({
  onToken,
}: {
  onToken: (token: string) => void;
}) {
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  const containerRef = useRef<HTMLDivElement | null>(null);
  // Keep the latest callback without re-running the render effect.
  const onTokenRef = useRef(onToken);
  onTokenRef.current = onToken;

  useEffect(() => {
    if (!siteKey) return;
    const el = containerRef.current;
    if (!el) return;

    let widgetId: string | null = null;
    let cancelled = false;

    void loadTurnstileScript().then(() => {
      if (cancelled || !window.turnstile || !el) return;
      // Guard against double-render (e.g. React strict-mode re-mounts).
      if (el.childElementCount > 0) return;
      widgetId = window.turnstile.render(el, {
        sitekey: siteKey,
        callback: (token: string) => onTokenRef.current(token),
        "expired-callback": () => onTokenRef.current(""),
        "error-callback": () => onTokenRef.current(""),
        theme: "auto",
      });
    });

    return () => {
      cancelled = true;
      if (widgetId && window.turnstile) {
        try {
          window.turnstile.remove(widgetId);
        } catch {
          // ignore — widget already gone
        }
      }
    };
  }, [siteKey]);

  // No site key → render nothing; the form behaves exactly as before.
  if (!siteKey) return null;

  return <div ref={containerRef} className="flex justify-center" />;
}
