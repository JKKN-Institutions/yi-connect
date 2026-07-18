"use client";

import { useState, useTransition } from "react";
import { runDossierGeneration } from "./actions";
import type { GenerationActionResult } from "@/lib/yifi/dossier/types";

/**
 * Admin control: generate dossiers for all census-complete registrants.
 *
 * One explicit button. Shows a live "working…" state and a result summary
 * (total / succeeded / failed + the first few error lines). Never auto-runs.
 */
export function GeneratePanel() {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<GenerationActionResult | null>(null);

  function handleGenerate() {
    setResult(null);
    startTransition(async () => {
      const r = await runDossierGeneration();
      setResult(r);
    });
  }

  return (
    <section className="bg-white/5 border border-white/10 rounded-xl p-5 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-white font-semibold">Generate dossiers</h2>
          <p className="text-white/50 text-sm mt-1 max-w-2xl">
            Reads the summit&apos;s session content + each census-complete
            registrant&apos;s profile, then produces a personalised dossier per
            attendee. Re-running regenerates ready dossiers.
          </p>
        </div>
        <button
          type="button"
          onClick={handleGenerate}
          disabled={pending}
          className="shrink-0 text-sm font-medium px-4 py-2 rounded-lg bg-[#FD7215] text-white hover:bg-[#FD7215]/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {pending ? "Generating…" : "Generate dossiers for all census-complete registrants"}
        </button>
      </div>

      {result && (
        <div
          className={`rounded-lg border p-4 text-sm ${
            result.ok
              ? "bg-[#229434]/10 border-[#229434]/30"
              : "bg-red-500/10 border-red-500/30"
          }`}
        >
          {!result.ok ? (
            <p className="text-red-300">{result.error ?? "Generation failed."}</p>
          ) : result.summary ? (
            <div className="space-y-2">
              <p className="text-white">
                Processed{" "}
                <span className="font-semibold">{result.summary.total}</span>{" "}
                registrant{result.summary.total === 1 ? "" : "s"} —{" "}
                <span className="text-[#229434] font-semibold">
                  {result.summary.succeeded} ready
                </span>
                ,{" "}
                <span className="text-red-300 font-semibold">
                  {result.summary.failed} failed
                </span>
                .
              </p>
              {result.summary.errors.length > 0 && (
                <ul className="text-white/60 text-xs list-disc pl-5 space-y-0.5">
                  {result.summary.errors.slice(0, 8).map((err, i) => (
                    <li key={i}>{err}</li>
                  ))}
                  {result.summary.errors.length > 8 && (
                    <li>…and {result.summary.errors.length - 8} more.</li>
                  )}
                </ul>
              )}
            </div>
          ) : null}
        </div>
      )}
    </section>
  );
}
