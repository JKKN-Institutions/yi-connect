"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { countWords } from "@/lib/recognitions/words";
import { ConfirmDialog, ResultLine, WordField } from "@/app/recognitions/_ui/client";
import { sendBackToMentors } from "@/app/recognitions/actions/mentor-sendback";

const REMARK_WORDS = 100;

/**
 * NMT leader: send this recognition back to its Regional Mentors with a
 * compulsory remark (recognitions_05). The Mentors' marks reopen as drafts
 * of a new round; the earlier marks stay in the history.
 */
export function MentorSendBackPanel({ awardId, closesAt }: { awardId: string; closesAt: string }) {
  const id = useId();
  const router = useRouter();
  const [remark, setRemark] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const ready = remark.trim() !== "" && countWords(remark) <= REMARK_WORDS;

  function send() {
    setResult(null);
    start(async () => {
      const res = await sendBackToMentors(awardId, remark);
      setConfirm(false);
      setResult(res.success ? { ok: true, text: res.message ?? "Sent back." } : { ok: false, text: res.error });
      if (res.success) {
        setRemark("");
        router.refresh();
      }
    });
  }

  return (
    <section className="rx-plate rx-stack" aria-labelledby={`${id}-h`} data-testid="mentor-sendback">
      <h2 className="rx-h2" id={`${id}-h`}>Send back to the Regional Mentors</h2>
      <p className="rx-small rx-mute">
        If the Mentors&apos; marks need another look, send this recognition back to them with a remark. Their marks
        reopen as drafts (their earlier marks stay in the history) until {closesAt}. Stage 2 opens again once every
        Mentor resubmits.
      </p>
      <WordField
        label="Remark for the Regional Mentors (required)"
        value={remark}
        onChange={setRemark}
        limit={REMARK_WORDS}
        rows={3}
      />
      <div className="rx-row">
        <button type="button" className="rx-btn rx-btn-danger" disabled={!ready || pending} onClick={() => setConfirm(true)}>
          Send back to Mentors
        </button>
      </div>
      <ResultLine result={confirm ? null : result} />
      <ConfirmDialog
        open={confirm}
        title="Send this recognition back to the Regional Mentors?"
        confirmLabel="Send back"
        tone="danger"
        busy={pending}
        onConfirm={send}
        onClose={() => setConfirm(false)}
      >
        <div className="rx-stack" style={{ gap: 8 }}>
          <p className="rx-small">
            Every submitted Mentor mark reopens as a draft. The Mentors see your remark. Their earlier marks are kept and
            can&apos;t be lost.
          </p>
          <p className="rx-p-quote rx-small">{remark.trim()}</p>
          <ResultLine result={result} />
        </div>
      </ConfirmDialog>
    </section>
  );
}

export type SendBackItem = {
  id: string;
  round: number;
  remark: string;
  sentAt: string;
  sentBy: string;
  reopened: number;
};

/** Every send-back to the Mentors, newest first. Append-only, so this is the full record. */
export function SendBackHistory({ items }: { items: SendBackItem[] }) {
  if (items.length === 0) return null;
  return (
    <section className="rx-stack" aria-label="Send-backs to the Regional Mentors">
      <h2 className="rx-h2">Sent back to the Regional Mentors</h2>
      {items.map((b) => (
        <article key={b.id} className="rx-plate rx-plate-tight rx-stack" style={{ gap: 6 }}>
          <div className="rx-small rx-mute">
            Mentor round {b.round} · {b.sentBy} · {b.sentAt} · {b.reopened} mark{b.reopened === 1 ? "" : "s"} reopened
          </div>
          <p className="rx-p-quote rx-small">{b.remark}</p>
        </article>
      ))}
    </section>
  );
}
