"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { TpResult } from "@/lib/take-pride/types";
import { pickDelegateMeetingTime } from "./actions";

export type SlotChoiceProp = { key: string; label: string };

/**
 * "Pick a time" for one accepted meeting. The free times are worked out on
 * the server for BOTH people; the server checks again when one is tapped.
 */
export function PickTimeView({
  when,
  currentKey,
  choices,
  onPick,
}: {
  when: string | null;
  currentKey: string | null;
  choices: SlotChoiceProp[];
  onPick: (slotKey: string) => Promise<TpResult<{ when: string }>>;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  function pick(key: string) {
    setMsg(null);
    start(async () => {
      const r = await onPick(key);
      if (r.success) {
        setMsg({ ok: true, text: `Booked: ${r.data.when}` });
        setOpen(false);
      } else {
        setMsg({ ok: false, text: r.error });
      }
      // Either way, reload: the free times may have changed.
      router.refresh();
    });
  }

  return (
    <div className="tp-stack" style={{ gap: 8 }} data-tp="time-box">
      {when ? (
        <p className="tp-alert ok" style={{ margin: 0 }} data-tp="when">
          {when}
        </p>
      ) : (
        <p className="tp-small" style={{ margin: 0 }} data-tp="no-time">
          Time not set yet. Either of you can pick one.
        </p>
      )}
      {!open ? (
        <div>
          <button
            type="button"
            className={`tp-btn ${when ? "ghost" : "saffron"} sm`}
            data-tp="pick-time"
            disabled={pending}
            onClick={() => {
              setMsg(null);
              setOpen(true);
            }}
          >
            {when ? "Change time" : "Pick a time"}
          </button>
        </div>
      ) : (
        <div className="tp-stack" style={{ gap: 8 }}>
          {choices.length === 0 ? (
            <p className="tp-alert warn" style={{ margin: 0 }} data-tp="no-choices">
              No time left when you are both free. Ask the Take Pride desk to help.
            </p>
          ) : (
            <>
              <p className="tp-small" style={{ margin: 0 }}>
                Times when you are both free. Tap one to book it; a table is given to you.
              </p>
              <div className="tp-pick" role="group" aria-label="Free times">
                {choices.map((c) => (
                  <button
                    key={c.key}
                    type="button"
                    data-tp="slot-choice"
                    data-slot={c.key}
                    aria-pressed={c.key === currentKey}
                    disabled={pending}
                    onClick={() => pick(c.key)}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            </>
          )}
          <div>
            <button type="button" className="tp-btn ghost sm" disabled={pending} onClick={() => setOpen(false)}>
              {pending ? "Saving…" : "Cancel"}
            </button>
          </div>
        </div>
      )}
      {msg && (
        <p className={`tp-alert ${msg.ok ? "ok" : "bad"}`} role="status" style={{ margin: 0 }} data-tp="pick-msg">
          {msg.text}
        </p>
      )}
    </div>
  );
}

export function DelegatePickTime({
  token,
  kind,
  meetingId,
  when,
  currentKey,
  choices,
}: {
  token: string;
  kind: "delegate" | "partner";
  meetingId: string;
  when: string | null;
  currentKey: string | null;
  choices: SlotChoiceProp[];
}) {
  return (
    <PickTimeView
      when={when}
      currentKey={currentKey}
      choices={choices}
      onPick={(key) => pickDelegateMeetingTime(token, kind, meetingId, key)}
    />
  );
}
