"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ContinuousScanner } from "../../../_scanner";
import { captureLead, requestMeeting, submitPayment } from "../../../actions";
import { PickTimeView, type SlotChoiceProp } from "../../../pass/[token]/schedule/_client";
import { pickPartnerMeetingTime } from "./slot-actions";
import { addTeamMember, removeTeamMember } from "./team-actions";

export function PaymentForm({ token, current }: { token: string; current: string | null }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  return (
    <form
      className="tp-stack"
      onSubmit={(e) => {
        e.preventDefault();
        const ref = String(new FormData(e.currentTarget).get("reference") ?? "");
        start(async () => {
          const r = await submitPayment(token, ref);
          setMsg(r.success ? { ok: true, text: "Reference sent. The team will confirm it today." } : { ok: false, text: r.error });
          if (r.success) router.refresh();
        });
      }}
    >
      <div className="tp-field">
        <label htmlFor="reference">{current ? "Change the payment reference" : "UPI or bank reference number"}</label>
        <input className="tp-input" id="reference" name="reference" defaultValue={current ?? ""} inputMode="text" autoComplete="off" placeholder="e.g. 428917365012" />
      </div>
      {msg && <p className={`tp-alert ${msg.ok ? "ok" : "bad"}`} role="status">{msg.text}</p>}
      <button className="tp-btn saffron block" disabled={pending}>{pending ? "Sending…" : "I have paid, send reference"}</button>
    </form>
  );
}

export function CopyLink() {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className="tp-btn ghost sm"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(window.location.href.split("?")[0]);
          setDone(true);
        } catch {
          setDone(false);
        }
      }}
    >
      {done ? "Link copied. Save it in WhatsApp to yourself." : "Copy my private link"}
    </button>
  );
}

export function RequestMeetingButton({ token, delegateId, disabled }: { token: string; delegateId: string; disabled: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  return (
    <span style={{ display: "grid", gap: 4, justifyItems: "end" }}>
      <button
        type="button"
        className="tp-btn green sm"
        disabled={disabled || pending}
        onClick={() =>
          start(async () => {
            const r = await requestMeeting(token, delegateId);
            if (!r.success) setErr(r.error);
            else router.refresh();
          })
        }
      >
        {pending ? "Sending…" : "Request meeting"}
      </button>
      {err && <span className="tp-small" style={{ color: "var(--tp-bad)" }}>{err}</span>}
    </span>
  );
}

export function LeadCapture({ token }: { token: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [code, setCode] = useState("");
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const last = useRef<{ text: string; at: number }>({ text: "", at: 0 });

  function save(scanned: string) {
    const now = Date.now();
    if (scanned === last.current.text && now - last.current.at < 10000) return;
    last.current = { text: scanned, at: now };
    start(async () => {
      const r = await captureLead(token, scanned, note);
      if (!r.success) {
        setMsg({ ok: false, text: r.error });
        return;
      }
      setMsg({ ok: true, text: r.data.duplicate ? `${r.data.name} is already in your leads.` : `Saved ${r.data.name}, ${r.data.chapter}.` });
      setCode("");
      setNote("");
      router.refresh();
    });
  }

  return (
    <div className="tp-stack">
      <div className="tp-field">
        <label htmlFor="lead-note">Note for this lead (optional, add before scanning)</label>
        <input className="tp-input" id="lead-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. wants 300 hampers for Diwali" />
      </div>
      <ContinuousScanner onScan={save} />
      <form className="tp-row" onSubmit={(e) => { e.preventDefault(); if (code.trim()) save(code.trim()); }}>
        <input className="tp-input" style={{ flex: 1, minWidth: 0 }} value={code} onChange={(e) => setCode(e.target.value)} placeholder="Or type the badge code, e.g. TP26-1001" aria-label="Badge code" />
        <button className="tp-btn green" disabled={pending}>Save lead</button>
      </form>
      {msg && <p className={`tp-alert ${msg.ok ? "ok" : "bad"}`} role="status">{msg.text}</p>}
    </div>
  );
}

/** Time + table for an accepted meeting; either side can pick or change it. */
export function PartnerPickTime({
  token,
  meetingId,
  when,
  currentKey,
  choices,
}: {
  token: string;
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
      onPick={(key) => pickPartnerMeetingTime(token, meetingId, key)}
    />
  );
}

/**
 * Team scanners: the partner adds up to `max` people (name only) and shares
 * each person's own scanner link. The link opens ONLY the lead scanner.
 */
export function TeamPanel({
  token,
  members,
  max,
}: {
  token: string;
  members: { id: string; name: string; token: string }[];
  max: number;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [name, setName] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const linkFor = (t: string) => `${window.location.origin}/take-pride/catalyst/team/${t}`;

  return (
    <div className="tp-stack" data-tp="team-panel">
      <p className="tp-small" style={{ margin: 0 }}>
        Add up to {max} people from your company. Each gets a private link that opens only the lead scanner and the leads they scan.
      </p>
      {members.length === 0 && <p className="tp-mute" style={{ margin: 0 }}>No team members yet.</p>}
      <div className="tp-list">
        {members.map((m) => (
          <div key={m.id} className="tp-stack" style={{ gap: 6 }} data-tp="team-member">
            <b>{m.name}</b>
            <div className="tp-row" style={{ justifyContent: "flex-start" }}>
              <button
                type="button"
                className="tp-btn ghost sm"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(linkFor(m.token));
                    setCopied(m.id);
                  } catch {
                    setCopied(null);
                  }
                }}
              >
                {copied === m.id ? "Link copied" : "Copy link"}
              </button>
              <button
                type="button"
                className="tp-btn green sm"
                onClick={() => {
                  window.open(`https://wa.me/?text=${encodeURIComponent(`Your Take Pride lead scanner: ${linkFor(m.token)}`)}`, "_blank", "noopener");
                }}
              >
                Share on WhatsApp
              </button>
              <button
                type="button"
                className="tp-btn ghost sm"
                disabled={pending}
                onClick={() =>
                  start(async () => {
                    setMsg(null);
                    const r = await removeTeamMember(token, m.id);
                    if (!r.success) setMsg({ ok: false, text: r.error });
                    else {
                      setMsg({ ok: true, text: `${m.name} removed. Their link no longer works.` });
                      router.refresh();
                    }
                  })
                }
              >
                Remove
              </button>
            </div>
          </div>
        ))}
      </div>
      {members.length < max ? (
        <form
          className="tp-row"
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => {
              setMsg(null);
              const r = await addTeamMember(token, name);
              if (!r.success) setMsg({ ok: false, text: r.error });
              else {
                setMsg({ ok: true, text: `${name.trim()} added. Share their link with them.` });
                setName("");
                router.refresh();
              }
            });
          }}
        >
          <input
            className="tp-input"
            style={{ flex: 1, minWidth: 0 }}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Team member's name"
            aria-label="Team member's name"
            maxLength={80}
          />
          <button className="tp-btn sm" disabled={pending}>{pending ? "Saving…" : "Add"}</button>
        </form>
      ) : (
        <p className="tp-small" style={{ margin: 0 }}>Your team is full ({max} people). Remove someone to add another.</p>
      )}
      {msg && <p className={`tp-alert ${msg.ok ? "ok" : "bad"}`} role="status">{msg.text}</p>}
    </div>
  );
}
