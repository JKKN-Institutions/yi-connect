"use client";

import { useState } from "react";
import { WORDS } from "@/lib/recognitions/constants";
import { countWords } from "@/lib/recognitions/words";
import { ConfirmDialog, ResultLine, WordField } from "../../_ui/client";
import { IconCheck, IconReturn } from "../../_ui/icons";
import { passNomination, returnNomination } from "../../actions/check";
import { useAction } from "../admin/_lib/use-action";

/**
 * Pass / Send back for one nomination. Used on the Check desk by Regional
 * Chairs and Regional Mentors alike. The server decides the seat; `pass` is
 * the page's preview of that same verdict (decideSeat), never the gate.
 */
export function CheckControls({
  nominationId,
  chapterName,
  pass,
  canReturn,
  returnBlocked,
  fixClosed,
}: {
  nominationId: string;
  chapterName: string;
  pass: { ok: true; label: string } | { ok: false; error: string };
  canReturn: boolean;
  returnBlocked: string | null;
  /** True when the fix deadline has passed: a send-back now takes it out of the race. */
  fixClosed: boolean;
}) {
  const [dialog, setDialog] = useState<"pass" | "return" | null>(null);
  const [note, setNote] = useState("");
  const { pending, result, run } = useAction();
  const words = countWords(note);
  const noteOk = note.trim() !== "" && words <= WORDS.returnNote;

  return (
    <div className="rx-stack" style={{ gap: 8 }}>
      <div className="rx-row" style={{ gap: 8 }}>
        {pass.ok ? (
          <button type="button" className="rx-btn rx-btn-sm" disabled={pending} onClick={() => setDialog("pass")}>
            <IconCheck size={16} /> Pass as {pass.label}
          </button>
        ) : null}
        {canReturn ? (
          <button type="button" className="rx-btn rx-btn-quiet rx-btn-sm" disabled={pending} onClick={() => setDialog("return")}>
            <IconReturn size={16} /> Send back
          </button>
        ) : null}
      </div>
      {!pass.ok && canReturn ? <p className="rx-small rx-mute">{pass.error}</p> : null}
      {!pass.ok && !canReturn && returnBlocked ? <p className="rx-small rx-mute">{returnBlocked}</p> : null}
      <ResultLine result={result} />

      <ConfirmDialog
        open={dialog === "pass"}
        title={`Pass ${chapterName}?`}
        confirmLabel={pass.ok ? `Pass as ${pass.label}` : "Pass"}
        busy={pending}
        onClose={() => setDialog(null)}
        onConfirm={() => run(() => passNomination(nominationId), (r) => r.success && setDialog(null))}
      >
        <p>
          You confirm this nomination is eligible and complete. It is scored only once the Regional Chair AND a
          Regional Mentor have both passed it.
        </p>
        <ResultLine result={result} />
      </ConfirmDialog>

      <ConfirmDialog
        open={dialog === "return"}
        title={`Send ${chapterName}'s nomination back?`}
        confirmLabel="Send back"
        tone="danger"
        busy={pending || !noteOk}
        onClose={() => setDialog(null)}
        onConfirm={() =>
          run(() => returnNomination(nominationId, note), (r) => {
            if (r.success) {
              setDialog(null);
              setNote("");
            }
          })
        }
      >
        <div className="rx-stack">
          <p className="rx-small">
            The chapter sees your note, fixes the nomination and resubmits it. Any passes it already has are cleared
            when it comes back, so both checkers pass the final version.
          </p>
          {fixClosed ? (
            <p className="rx-small" style={{ color: "var(--rx-vermilion)", fontWeight: 600 }}>
              The fix deadline has passed. If you send it back now, the chapter can&apos;t resubmit and it is out of the race.
            </p>
          ) : null}
          <WordField
            label="What should the chapter fix? (required)"
            value={note}
            onChange={setNote}
            limit={WORDS.returnNote}
            rows={3}
          />
          <ResultLine result={result} />
        </div>
      </ConfirmDialog>
    </div>
  );
}
