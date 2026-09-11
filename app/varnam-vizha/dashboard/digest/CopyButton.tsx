"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

/**
 * One-tap copy for the daily digest. Uses the async Clipboard API; if the
 * browser blocks it (old WebView, http context) we surface an honest inline
 * hint instead of failing silently.
 */
export function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");

  async function copy() {
    setError("");
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setError(
        "Couldn't copy automatically — long-press the message above and copy it manually."
      );
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={copy}
        className="flex w-full items-center justify-center gap-2 rounded-full bg-[#3B0A45] px-6 py-3.5 text-base font-semibold text-white transition hover:bg-[#2B0A33] sm:w-auto"
      >
        {copied ? (
          <>
            <Check className="size-5" />
            Copied — paste it in WhatsApp
          </>
        ) : (
          <>
            <Copy className="size-5" />
            Copy digest
          </>
        )}
      </button>
      {error && (
        <p className="mt-2 text-sm font-medium text-[#D6336C]">{error}</p>
      )}
    </div>
  );
}
