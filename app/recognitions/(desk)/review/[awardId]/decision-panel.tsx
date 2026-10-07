"use client";

import { useState, useTransition } from "react";
import { ConfirmDialog, ResultLine } from "@/app/recognitions/_ui/client";
import { approveAward, sendBackForReevaluation } from "@/app/recognitions/actions/governance";

export function DecisionPanel({ awardId, version }: { awardId: string; version: number }) {
  const [dialog, setDialog] = useState<"approve" | "reevaluate" | null>(null);
  const [reason, setReason] = useState("");
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  function act(kind: "approve" | "reevaluate") {
    if (kind === "reevaluate" && reason.trim() === "") {
      setResult({ ok: false, text: "Write the reason first. The NMT leader needs it to know what to change." });
      return;
    }
    setResult(null);
    start(async () => {
      const res = kind === "approve" ? await approveAward(awardId) : await sendBackForReevaluation(awardId, reason);
      setDialog(null);
      setResult(res.success ? { ok: true, text: res.message ?? "Done." } : { ok: false, text: res.error });
    });
  }

  return (
    <div className="rx-plate rx-plate-gilt rx-stack">
      <h2 className="rx-h2">Your decision on version {version}</h2>
      <p className="rx-small rx-mute">
        Approve to finalise the award, or send it back to the NMT leader with the reason. A send-back starts Stage 3:
        the NMT leader reopens the moderation and submits a revised version.
      </p>
      <div className="rx-row">
        <button type="button" className="rx-btn" disabled={pending} onClick={() => setDialog("approve")}>
          Approve
        </button>
        <button type="button" className="rx-btn rx-btn-danger" disabled={pending} onClick={() => setDialog("reevaluate")}>
          Send back for re-evaluation
        </button>
      </div>
      <ResultLine result={result} />

      <ConfirmDialog
        open={dialog === "approve"}
        title="Approve this award?"
        confirmLabel="Approve"
        busy={pending}
        onConfirm={() => act("approve")}
        onClose={() => setDialog(null)}
      >
        <p>This finalises the award. The ranking and podium of version {version} become the result.</p>
      </ConfirmDialog>

      <ConfirmDialog
        open={dialog === "reevaluate"}
        title="Send back for re-evaluation?"
        confirmLabel="Send back for re-evaluation"
        tone="danger"
        busy={pending}
        onConfirm={() => act("reevaluate")}
        onClose={() => setDialog(null)}
      >
        <div className="rx-stack" style={{ gap: 8 }}>
          <label htmlFor="rx-sendback-reason" className="rx-label">
            Reason (required)
          </label>
          <textarea
            id="rx-sendback-reason"
            className="rx-textarea"
            rows={5}
            required
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Significant variance observed between Health Card performance and final ranking."
          />
          <p className="rx-help">The NMT leader sees this exactly as you write it.</p>
          {dialog === "reevaluate" ? <ResultLine result={result} /> : null}
        </div>
      </ConfirmDialog>
    </div>
  );
}
