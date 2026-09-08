"use client";

// Reopen one submitted jury score from the chapter scoring screen.
//
// Deliberately a BUTTON that calls the action directly, not a <form>. There is
// nothing to submit — the only input is an optional reason — and this screen is
// used live during a chapter final, so the fewer moving parts between the tap
// and the result, the better.
//
// Two taps, never one. The first opens a small confirm panel; the second acts.
// A single mis-tap on a scoring screen that is being read off a projector
// should not reopen somebody's score.
//
// The action's ActionResult is RENDERED, not discarded. Every refusal it can
// return — wrong chapter, already open, log unavailable — reaches the person
// who pressed the button. That is the whole lesson of #879, #887 and #888.

import { useState, useTransition } from "react";
import { unlockEvaluation } from "@/app/yi-future/actions/evaluations";

type Result = { ok: true; message?: string } | { ok: false; error: string };

export function UnlockEvaluationButton({
  evaluationId,
  juryName,
  teamName,
  score,
  totalMax,
}: {
  evaluationId: string;
  juryName: string | null;
  teamName: string;
  score: number;
  totalMax: number;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [pending, startTransition] = useTransition();

  // Once it has succeeded the score is a draft again and this row is stale —
  // show the outcome rather than an button that would now refuse.
  if (result?.ok) {
    return (
      <p className="max-w-[22rem] text-xs font-semibold text-yi-green">
        ✓ {result.message ?? "Reopened."}
      </p>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => {
          setResult(null);
          setOpen(true);
        }}
        className="rounded-md border border-navy/20 px-2 py-1 text-xs font-semibold text-navy/70 hover:border-navy/40 hover:text-navy"
      >
        Reopen
      </button>
    );
  }

  return (
    <div className="w-full max-w-sm rounded-md border border-navy/20 bg-navy/5 p-3">
      <p className="text-xs text-navy/80">
        Reopen <span className="font-semibold">{juryName ?? "this juror"}</span>
        &apos;s score of{" "}
        <span className="font-mono font-semibold">
          {score}/{totalMax}
        </span>{" "}
        for <span className="font-semibold">{teamName}</span>?
      </p>
      <p className="mt-1 text-[11px] text-navy/55">
        Their numbers stay exactly as they are — only they can change them, from
        their own jury screen. This is recorded.
      </p>

      <input
        type="text"
        value={reason}
        onChange={(ev) => setReason(ev.target.value)}
        placeholder="Why? (optional)"
        maxLength={500}
        className="mt-2 w-full rounded-md border border-navy/20 bg-white px-2 py-1 text-xs"
      />

      <div className="mt-2 flex items-center gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const res = await unlockEvaluation({ evaluationId, reason });
              setResult(res);
              if (!res.ok) setOpen(true);
            })
          }
          className="rounded-md bg-navy px-3 py-1 text-xs font-semibold text-ivory hover:bg-navy-dark disabled:opacity-60"
        >
          {pending ? "Reopening…" : "Yes, reopen"}
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            setOpen(false);
            setReason("");
            setResult(null);
          }}
          className="rounded-md border border-navy/20 px-3 py-1 text-xs font-semibold text-navy/70 hover:border-navy/40 disabled:opacity-60"
        >
          Cancel
        </button>
      </div>

      {result && !result.ok && (
        <p
          role="alert"
          className="mt-2 text-xs font-semibold text-red-600"
        >
          {result.error}
        </p>
      )}
    </div>
  );
}
