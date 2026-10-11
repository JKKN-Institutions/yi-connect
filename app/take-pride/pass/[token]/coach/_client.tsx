"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { sendCoachCheckin } from "./actions";
import { COACH_MOODS, MOOD_LABEL, UPDATE_MAX, type CoachMood, type CoachStep } from "@/lib/take-pride/coach/schemas";

type Msg = { ok: boolean; text: string } | null;

/**
 * One check-in form. `tryNow` shows it behind a "Try a check-in now" button
 * (sample delegates, before the date), so the demo is opt-in.
 */
export function CheckinForm({ token, step, tryNow = false }: { token: string; step: CoachStep; tryNow?: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(!tryNow);
  const [text, setText] = useState("");
  const [mood, setMood] = useState<CoachMood | null>(null);
  const [msg, setMsg] = useState<Msg>(null);
  const [pending, start] = useTransition();

  if (!open) {
    return (
      <div>
        <button type="button" className="tp-btn saffron sm" onClick={() => setOpen(true)} data-tp="coach-try-now">
          Try a check-in now
        </button>
      </div>
    );
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    start(async () => {
      const r = await sendCoachCheckin(token, step, text, mood);
      if (r.success) {
        setText("");
        setMsg({ ok: true, text: "Check-in sent. Your coach note will appear here." });
        router.refresh();
      } else {
        setMsg({ ok: false, text: r.error });
      }
    });
  }

  const id = `tp-coach-${step}`;
  return (
    <form className="tp-stack" onSubmit={submit} data-tp={`coach-form-${step}`}>
      <div className="tp-field">
        <label htmlFor={id}>What did you do on your pledge?</label>
        <p className="tp-small" style={{ margin: 0 }}>Tip: tap the microphone on your keyboard to speak instead of typing.</p>
        <textarea
          id={id}
          className="tp-textarea"
          data-tp="coach-update"
          maxLength={UPDATE_MAX}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="For example: I moved two small orders to a women-led supplier in our chapter."
        />
        <span className="tp-small tp-num">{text.length}/{UPDATE_MAX}</span>
      </div>
      <fieldset className="tp-field" style={{ border: 0, padding: 0, margin: 0 }}>
        <legend className="tp-legend">How is it going?</legend>
        <div className="tp-pick" data-tp="coach-mood">
          {COACH_MOODS.map((m) => (
            <button key={m} type="button" aria-pressed={mood === m} data-mood={m} onClick={() => setMood(m)}>
              {MOOD_LABEL[m]}
            </button>
          ))}
        </div>
      </fieldset>
      <div>
        <button type="submit" className="tp-btn saffron" data-tp="coach-submit" disabled={pending}>
          {pending ? "Sending…" : "Send check-in"}
        </button>
      </div>
      {msg && (
        <p className={msg.ok ? "tp-small" : "tp-alert bad"} role={msg.ok ? "status" : "alert"} style={{ margin: 0 }} data-tp="coach-msg">
          {msg.text}
        </p>
      )}
    </form>
  );
}
