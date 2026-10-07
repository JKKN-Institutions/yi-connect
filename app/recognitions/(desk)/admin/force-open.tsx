"use client";

import { useState } from "react";
import { forceOpenStage2 } from "../../actions/admin-setup";
import { ConfirmDialog, ResultLine } from "../../_ui/client";
import { useAction } from "./_lib/use-action";

/**
 * Escape hatch. The spec unlocks Stage 2 only at 100% RM + NMT submission
 * and is silent on a missed Stage 1 deadline; this opens it anyway, with a
 * reason kept on the record.
 */
export function ForceOpenStage2({
  awardId,
  awardTitle,
  rm,
  nmt,
}: {
  awardId: string;
  awardTitle: string;
  rm: { submitted: number; required: number };
  nmt: { submitted: number; required: number };
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const { pending, result, run } = useAction();

  return (
    <div className="rx-stack" style={{ gap: 8 }}>
      <div className="rx-row">
        <button type="button" className="rx-btn rx-btn-quiet rx-btn-sm" onClick={() => setOpen(true)}>
          Force-open Stage 2 (escape hatch)
        </button>
        <span className="rx-ad-mini">Only for a missed deadline. Normally Stage 2 opens by itself at 100%.</span>
      </div>
      <ResultLine result={result} />
      <ConfirmDialog
        open={open}
        title={`Force-open Stage 2 for ${awardTitle}?`}
        confirmLabel="Open Stage 2 now"
        tone="danger"
        busy={pending}
        onClose={() => setOpen(false)}
        onConfirm={() =>
          run(() => forceOpenStage2({ awardId, reason }), (r) => {
            if (r.success) {
              setOpen(false);
              setReason("");
            }
          })
        }
      >
        <div className="rx-stack" style={{ gap: 10 }}>
          <p className="rx-small">
            Scoring is not complete: Regional Mentors {rm.submitted}/{rm.required}, NMT {nmt.submitted}/{nmt.required}. The NMT
            leader will moderate with the scores that are in. This can&apos;t be undone, and the reason is kept in the audit trail.
          </p>
          <div>
            <label className="rx-label" htmlFor="force-reason">Reason (required)</label>
            <textarea
              id="force-reason"
              className="rx-textarea"
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="For example: Stage 1 deadline passed; two RMs confirmed they will not score."
            />
          </div>
          <ResultLine result={result} />
        </div>
      </ConfirmDialog>
    </div>
  );
}
