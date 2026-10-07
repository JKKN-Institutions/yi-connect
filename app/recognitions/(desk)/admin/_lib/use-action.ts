"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ActionResult } from "@/lib/recognitions/types";

/**
 * Runs a server action from a client form and turns the outcome into a
 * plain result line. A transport failure (network, deploy swap) is caught
 * and said in words instead of leaving the button spinning.
 */
export function useAction() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);

  function run<T>(fn: () => Promise<ActionResult<T>>, onDone?: (r: ActionResult<T>) => void) {
    setResult(null);
    start(async () => {
      try {
        const r = await fn();
        setResult(r.success ? { ok: true, text: r.message ?? "Saved." } : { ok: false, text: r.error });
        if (r.success) router.refresh();
        onDone?.(r);
      } catch {
        setResult({ ok: false, text: "The connection dropped before the server answered. Check your network and try again." });
      }
    });
  }
  return { pending, result, setResult, run };
}
