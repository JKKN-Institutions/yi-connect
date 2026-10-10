"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { answerMeet, askToMeet } from "./actions";

const NOTE_MAX = 140;

export function AskToMeet({ token, toId, name }: { token: string; toId: string; name: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  function send() {
    setMsg(null);
    start(async () => {
      const r = await askToMeet(token, toId, note);
      if (r.success) {
        setMsg({ ok: true, text: `Request sent to ${name}.` });
        setOpen(false);
        router.refresh();
      } else {
        setMsg({ ok: false, text: r.error });
        // They may have asked me a moment ago: reload so their request shows below.
        router.refresh();
      }
    });
  }

  return (
    <div className="tp-stack" style={{ gap: 8 }}>
      {!open ? (
        <div>
          <button type="button" className="tp-btn saffron sm" data-tp="ask" onClick={() => setOpen(true)} disabled={pending}>
            Ask to meet
          </button>
        </div>
      ) : (
        <div className="tp-stack" style={{ gap: 8 }}>
          <div className="tp-field">
            <label htmlFor={`note-${toId}`}>Short note (optional)</label>
            <textarea
              id={`note-${toId}`}
              className="tp-textarea"
              style={{ minHeight: 64 }}
              maxLength={NOTE_MAX}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Why you would like to meet"
            />
            <span className="tp-small tp-num">{note.length}/{NOTE_MAX}</span>
          </div>
          <div className="tp-row" style={{ justifyContent: "flex-start" }}>
            <button type="button" className="tp-btn green sm" data-tp="send" onClick={send} disabled={pending}>
              {pending ? "Sending…" : "Send request"}
            </button>
            <button type="button" className="tp-btn ghost sm" onClick={() => setOpen(false)} disabled={pending}>
              Cancel
            </button>
          </div>
        </div>
      )}
      {msg && (
        <p className={`tp-alert ${msg.ok ? "ok" : "bad"}`} data-tp="ask-msg" style={{ margin: 0 }}>
          {msg.text}
        </p>
      )}
    </div>
  );
}

export function AnswerMeet({ token, meetingId }: { token: string; meetingId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  function answer(accept: boolean) {
    setErr(null);
    start(async () => {
      const r = await answerMeet(token, meetingId, accept);
      if (r.success) router.refresh();
      else setErr(r.error);
    });
  }

  return (
    <div className="tp-stack" style={{ gap: 8 }}>
      <div className="tp-row" style={{ justifyContent: "flex-start" }}>
        <button type="button" className="tp-btn green sm" data-tp="accept" disabled={pending} onClick={() => answer(true)}>
          Accept
        </button>
        <button type="button" className="tp-btn ghost sm" data-tp="decline" disabled={pending} onClick={() => answer(false)}>
          Decline
        </button>
      </div>
      {err && <p className="tp-alert bad" style={{ margin: 0 }}>{err}</p>}
    </div>
  );
}
