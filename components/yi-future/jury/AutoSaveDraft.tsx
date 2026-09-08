"use client";

// Saves the jury's scorecard as a draft a couple of seconds after they stop
// touching it, so nothing is lost if a phone locks or a tab is closed.
//
// WHY IT OBSERVES THE FORM RATHER THAN OWNING IT
// ----------------------------------------------
// The obvious shape — wrap the form, drive it with useActionState — was tried
// and it BROKE submission outright: no POST reached the server at all, from a
// click, from an element ref, or from form.requestSubmit(). So this component
// deliberately does not touch <form action={save}> at all. It sits inside the
// form, listens, and calls the action itself.
//
// The consequence that matters: if anything here fails or throws, Save draft
// and Submit still behave exactly as they do today. Auto-save can only ever
// add a save, never prevent one.
//
// WHY IT NEVER RUNS AFTER SUBMISSION
// ----------------------------------
// saveEvaluation refuses once status = 'submitted' ("Evaluation already
// submitted"). Auto-saving into that refusal would produce a permanent "not
// saved" banner on a scorecard that is finished and correct. `enabled` is false
// once the page knows it is submitted, so it simply never fires.

import { useEffect, useRef, useState } from "react";

type Result = { ok: true; message?: string } | { ok: false; error: string };

/** Quiet period after the last keystroke or slider move before saving. */
const IDLE_MS = 2000;

export function AutoSaveDraft({
  action,
  enabled,
}: {
  action: (formData: FormData) => Promise<Result>;
  enabled: boolean;
}) {
  const anchor = useRef<HTMLSpanElement | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inFlight = useRef(false);
  const pendingAgain = useRef(false);
  const [state, setState] = useState<
    { kind: "idle" } | { kind: "saving" } | { kind: "saved"; at: Date } | { kind: "failed"; why: string }
  >({ kind: "idle" });

  useEffect(() => {
    if (!enabled) return;
    const form = anchor.current?.closest("form");
    if (!form) return;

    async function run() {
      const el = anchor.current?.closest("form");
      if (!el) return;
      if (inFlight.current) {
        // A save is already on the wire. Remember that more edits happened and
        // save once more when it lands, rather than queueing a pile of writes.
        pendingAgain.current = true;
        return;
      }
      inFlight.current = true;
      setState({ kind: "saving" });
      try {
        const fd = new FormData(el);
        // Never let an auto-save submit the scorecard. Submitting is a decision
        // the juror makes by pressing the button, not something a timer does.
        fd.set("_submit", "0");
        const res = await action(fd);
        setState(
          res.ok
            ? { kind: "saved", at: new Date() }
            : { kind: "failed", why: res.error }
        );
      } catch {
        setState({
          kind: "failed",
          why: "Your draft could not be saved automatically — press Save draft.",
        });
      } finally {
        inFlight.current = false;
        if (pendingAgain.current) {
          pendingAgain.current = false;
          schedule();
        }
      }
    }

    function schedule() {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(run, IDLE_MS);
    }

    // `input` covers typing and slider drags; `change` covers the radios.
    form.addEventListener("input", schedule);
    form.addEventListener("change", schedule);
    return () => {
      form.removeEventListener("input", schedule);
      form.removeEventListener("change", schedule);
      if (timer.current) clearTimeout(timer.current);
    };
  }, [action, enabled]);

  // The anchor is how the component finds its own form without being handed an
  // id — it renders regardless so the ref is always attached.
  return (
    <span ref={anchor} className="text-xs" aria-live="polite">
      {state.kind === "saving" && (
        <span className="text-navy/50">Saving…</span>
      )}
      {state.kind === "saved" && (
        <span className="text-yi-green font-semibold">
          ✓ Draft saved{" "}
          {state.at.toLocaleTimeString("en-IN", {
            timeZone: "Asia/Kolkata",
            hour: "numeric",
            minute: "2-digit",
          })}
        </span>
      )}
      {state.kind === "failed" && (
        <span role="alert" className="text-red-600 font-semibold">
          {state.why}
        </span>
      )}
    </span>
  );
}
