"use client";

import { useEffect, useState } from "react";

// ─────────────────────────────────────────────────────────────────────
// PasswordReveal — one-shot, time-boxed display of a freshly reset
// password.
//
// The super admin clicks "Reset password" on the table row, the server
// action returns the new password as part of the form result, and the
// surrounding server-component page passes it here as a prop. We render
// it in monospace with a Copy button, then auto-clear after 30 seconds
// so a screen left unattended doesn't keep the secret in the DOM.
//
// We do NOT persist the password anywhere — not in localStorage, not
// in URL params. If the super admin loses it before sharing, the only
// recovery is to run the reset again.
// ─────────────────────────────────────────────────────────────────────

const AUTO_CLEAR_SECONDS = 30;

export function PasswordReveal({
  email,
  password,
}: {
  email: string;
  password: string;
}): React.JSX.Element {
  const [hidden, setHidden] = useState(false);
  const [copied, setCopied] = useState(false);
  const [remaining, setRemaining] = useState(AUTO_CLEAR_SECONDS);

  useEffect(() => {
    if (hidden) return;
    if (remaining <= 0) {
      setHidden(true);
      return;
    }
    const t = setTimeout(() => setRemaining((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [remaining, hidden]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(password);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API can fail on insecure contexts — fall back to
      // selecting the text and letting the user copy manually.
    }
  }

  if (hidden) {
    return (
      <div className="rounded-md border border-navy/15 bg-navy/5 px-4 py-3 text-sm text-navy/60">
        Hidden — page action complete. Run reset again if you still need the password.
      </div>
    );
  }

  return (
    <div className="rounded-md border-2 border-yi-gold bg-yi-gold/10 px-4 py-3 space-y-2">
      <div className="text-xs font-semibold uppercase tracking-widest text-navy/70">
        New password for {email}
      </div>
      <div className="flex items-center gap-3">
        <code className="flex-1 font-mono text-base text-navy bg-white border border-navy/15 rounded px-3 py-2 select-all">
          {password}
        </code>
        <button
          type="button"
          onClick={copy}
          className="px-3 py-2 rounded-md bg-navy text-ivory text-sm font-semibold hover:bg-navy-dark"
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <div className="text-xs text-navy/60">
        Share this with {email} now — it disappears in {remaining}s and is not stored anywhere.
      </div>
    </div>
  );
}
