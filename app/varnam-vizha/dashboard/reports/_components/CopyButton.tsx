"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Copy } from "lucide-react";

/**
 * One-tap copy for report text blocks. Shows "✓ Copied" for a moment after a
 * successful copy; falls back to an inline error if the clipboard is blocked
 * (older phones / non-HTTPS) so the organiser knows to long-press instead.
 */
export function CopyButton({
  text,
  label = "Copy",
}: {
  text: string;
  label?: string;
}) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setState("copied");
    } catch {
      setState("failed");
    }
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setState("idle"), 2000);
  };

  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        onClick={onCopy}
        className="inline-flex items-center gap-1.5 rounded-full bg-[#D6336C] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#b02a59]"
      >
        {state === "copied" ? (
          <>
            <Check className="size-4" /> ✓ Copied
          </>
        ) : (
          <>
            <Copy className="size-4" /> {label}
          </>
        )}
      </button>
      {state === "failed" && (
        <span className="text-xs text-[#D6336C]">
          Couldn&apos;t copy — long-press the text to select it.
        </span>
      )}
    </span>
  );
}
