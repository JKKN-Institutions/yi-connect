"use client";

// The sign-in address to hand to jury members, shown on the chapter Jury page
// (field request 2026-08-10).
//
// Chapter admins already have each juror's 6-character access code on this
// page but had nowhere to read the URL those codes are for, so it was being
// dictated from memory. `?tab=code` deep-links straight to the access-code tab
// — without it the page opens on whichever tab is default and the juror has to
// find the right one.
//
// The origin is read from the browser rather than hardcoded, so this stays
// correct on preview deployments and localhost as well as production.

import { useEffect, useState } from "react";

const PATH = "/yi-future/access?tab=code";

export function JuryLoginLink() {
  const [origin, setOrigin] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  const url = origin ? `${origin}${PATH}` : PATH;

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard can be blocked (insecure context, permission). The URL is
      // on screen and selectable, so this is a silent fallback by design.
      setCopied(false);
    }
  }

  return (
    <div className="bg-[#F5A623]/10 border border-[#F5A623]/40 rounded-lg p-3 flex flex-wrap items-center gap-x-3 gap-y-2">
      <span className="text-xs font-bold text-navy">
        Jury sign in here:
      </span>
      <a
        href={PATH}
        target="_blank"
        rel="noopener noreferrer"
        className="text-xs font-mono text-navy underline break-all"
      >
        {url}
      </a>
      <button
        type="button"
        onClick={copy}
        className="text-xs font-semibold text-navy hover:text-yi-gold border border-navy/20 rounded px-2.5 py-1 bg-white"
      >
        {copied ? "Copied ✓" : "Copy"}
      </button>
      <span className="text-[11px] text-navy/50 basis-full">
        Send this with their 6-character access code below. Codes are shown per
        juror — they are the password, so send them individually.
      </span>
    </div>
  );
}
