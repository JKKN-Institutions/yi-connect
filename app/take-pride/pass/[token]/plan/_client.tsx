"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { askTheDesk, requestRadar, requestSummitPlan } from "./actions";

type Msg = { ok: boolean; text: string } | null;

export function Note({ msg }: { msg: Msg }) {
  if (!msg) return null;
  return (
    <p className={msg.ok ? "tp-small" : "tp-alert"} role={msg.ok ? "status" : "alert"} style={{ margin: 0 }} data-tp="ai-msg">
      {msg.text}
    </p>
  );
}

const POLL_MS = 10_000;
const POLL_MAX_MS = 5 * 60_000;

/**
 * While a job is being written, refresh the page every 10 seconds, for at
 * most 5 minutes after the job was queued. Then stop and say so.
 */
export function AutoRefresh({ since, label }: { since: string; label: string }) {
  const router = useRouter();
  const started = new Date(since).getTime();
  const [gaveUp, setGaveUp] = useState(() => Date.now() - started > POLL_MAX_MS);
  useEffect(() => {
    if (gaveUp) return;
    const t = setInterval(() => {
      if (Date.now() - started > POLL_MAX_MS) {
        setGaveUp(true);
        clearInterval(t);
        return;
      }
      router.refresh();
    }, POLL_MS);
    return () => clearInterval(t);
  }, [router, started, gaveUp]);

  return (
    <div className="tp-card hi" role="status" data-tp="ai-pending">
      <p style={{ margin: 0 }}>
        <b>{label}</b>
      </p>
      {gaveUp ? (
        <>
          <p className="tp-small" style={{ margin: 0 }}>
            This is taking longer than usual. It will appear here when it is ready.
          </p>
          <div>
            <button type="button" className="tp-btn ghost sm" onClick={() => router.refresh()} data-tp="ai-check-again">
              Check again
            </button>
          </div>
        </>
      ) : (
        <p className="tp-small" style={{ margin: 0 }}>This page checks again every 10 seconds.</p>
      )}
    </div>
  );
}

const DICTATION_TIP = "Tip: tap the microphone on your keyboard to speak instead of typing.";

export function GoalForm({ token, max, remaining, busy }: { token: string; max: number; remaining: number; busy: boolean }) {
  const router = useRouter();
  const [goal, setGoal] = useState("");
  const [msg, setMsg] = useState<Msg>(null);
  const [pending, start] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    start(async () => {
      const r = await requestSummitPlan(token, goal);
      if (r.success) {
        setGoal("");
        setMsg({ ok: true, text: "Request sent." });
        router.refresh();
      } else {
        setMsg({ ok: false, text: r.error });
      }
    });
  }

  return (
    <form className="tp-stack" onSubmit={submit} data-tp="plan-form">
      <div className="tp-field">
        <label htmlFor="tp-goal">What do you want from Take Pride?</label>
        <p className="tp-small" style={{ margin: 0 }}>{DICTATION_TIP}</p>
        <textarea
          id="tp-goal"
          className="tp-textarea"
          data-tp="plan-goal"
          maxLength={max}
          value={goal}
          onChange={(e) => setGoal(e.target.value)}
          placeholder="For example: I want a buyer in Europe for my yarn, and ideas to grow my chapter's Climate vertical."
        />
        <span className="tp-small tp-num">{goal.length}/{max}</span>
      </div>
      <div className="tp-row" style={{ justifyContent: "flex-start" }}>
        <button type="submit" className="tp-btn saffron" data-tp="plan-submit" disabled={pending || busy || remaining <= 0}>
          {pending ? "Sending…" : "Request plan"}
        </button>
        <span className="tp-small tp-num" data-tp="plan-remaining">
          {remaining} left today
        </span>
      </div>
      <Note msg={msg} />
    </form>
  );
}

export function RadarRefresh({ token, remaining, busy }: { token: string; remaining: number; busy: boolean }) {
  const router = useRouter();
  const [msg, setMsg] = useState<Msg>(null);
  const [pending, start] = useTransition();
  return (
    <div className="tp-stack" style={{ gap: 6 }}>
      <div>
        <button
          type="button"
          className="tp-btn saffron"
          data-tp="radar-refresh"
          disabled={pending || busy || remaining <= 0}
          onClick={() =>
            start(async () => {
              setMsg(null);
              const r = await requestRadar(token);
              if (r.success) router.refresh();
              else setMsg({ ok: false, text: r.error });
            })
          }
        >
          {pending ? "Sending…" : "Request refresh"}
        </button>
      </div>
      <p className="tp-small" style={{ margin: 0 }}>
        {remaining > 0 ? "You can refresh once a day. It also refreshes overnight." : "Refreshed today. It also refreshes overnight."}
      </p>
      <Note msg={msg} />
    </div>
  );
}

export function AskForm({ token, max, remaining }: { token: string; max: number; remaining: number }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [msg, setMsg] = useState<Msg>(null);
  const [pending, start] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    start(async () => {
      const r = await askTheDesk(token, q);
      if (r.success) {
        setQ("");
        setMsg({ ok: true, text: "Question sent. The answer will appear below." });
        router.refresh();
      } else {
        setMsg({ ok: false, text: r.error });
      }
    });
  }

  return (
    <form className="tp-stack" onSubmit={submit} data-tp="ask-form">
      <div className="tp-field">
        <label htmlFor="tp-question">Your question</label>
        <p className="tp-small" style={{ margin: 0 }}>{DICTATION_TIP}</p>
        <textarea
          id="tp-question"
          className="tp-textarea"
          data-tp="ask-question"
          maxLength={max}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="For example: When are the partner meetings on Day 2?"
        />
        <span className="tp-small tp-num">{q.length}/{max}</span>
      </div>
      <div className="tp-row" style={{ justifyContent: "flex-start" }}>
        <button type="submit" className="tp-btn saffron" data-tp="ask-submit" disabled={pending || remaining <= 0}>
          {pending ? "Sending…" : "Ask"}
        </button>
        <span className="tp-small tp-num" data-tp="ask-remaining">
          {remaining} left today
        </span>
      </div>
      <Note msg={msg} />
    </form>
  );
}
