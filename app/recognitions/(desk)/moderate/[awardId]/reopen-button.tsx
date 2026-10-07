"use client";

import { useState, useTransition } from "react";
import { ConfirmDialog, ResultLine } from "@/app/recognitions/_ui/client";
import { reopenModeration } from "@/app/recognitions/actions/moderation";

export function ReopenButton({ awardId, fromVersion }: { awardId: string; fromVersion: number }) {
  const [open, setOpen] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  return (
    <div className="rx-stack" style={{ gap: 8 }}>
      <div>
        <button type="button" className="rx-btn" disabled={pending} onClick={() => setOpen(true)}>
          Reopen moderation
        </button>
      </div>
      <ResultLine result={result} />
      <ConfirmDialog
        open={open}
        title="Reopen moderation?"
        confirmLabel="Reopen moderation"
        busy={pending}
        onClose={() => setOpen(false)}
        onConfirm={() =>
          start(async () => {
            const res = await reopenModeration(awardId);
            setOpen(false);
            setResult(res.success ? { ok: true, text: res.message ?? "Reopened." } : { ok: false, text: res.error });
          })
        }
      >
        <p>
          This starts version {fromVersion + 1} as a copy of version {fromVersion}. Version {fromVersion} stays on
          record unchanged. Amend the ranking and texts, then submit again.
        </p>
      </ConfirmDialog>
    </div>
  );
}
