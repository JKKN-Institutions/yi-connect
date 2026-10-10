"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deskConfirmPartner, deskRejectPartner, deskSavePaymentInstructions } from "../actions";

export function PartnerActions({ partnerId }: { partnerId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const [err, setErr] = useState<string | null>(null);

  const run = (fn: () => Promise<{ success: boolean; error?: string }>) =>
    start(async () => {
      setErr(null);
      const r = await fn();
      if (!r.success) setErr(r.error ?? "Something went wrong");
      else router.refresh();
    });

  return (
    <div className="tp-stack" style={{ gap: 6 }}>
      {!rejecting ? (
        <div className="tp-row" style={{ justifyContent: "flex-start" }}>
          <button className="tp-btn green sm" disabled={pending} onClick={() => run(() => deskConfirmPartner(partnerId))}>
            {pending ? "Saving…" : "Payment received, confirm"}
          </button>
          <button className="tp-btn ghost sm" disabled={pending} onClick={() => setRejecting(true)}>Not received</button>
        </div>
      ) : (
        <form className="tp-row" style={{ justifyContent: "flex-start" }} onSubmit={(e) => { e.preventDefault(); run(() => deskRejectPartner(partnerId, reason)); }}>
          <input className="tp-input" style={{ flex: 1, minWidth: 180 }} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="What the member should fix" aria-label="Reason" />
          <button className="tp-btn sm" disabled={pending}>Send back</button>
          <button type="button" className="tp-btn ghost sm" onClick={() => setRejecting(false)}>Cancel</button>
        </form>
      )}
      {err && <span className="tp-small" style={{ color: "var(--tp-bad)" }}>{err}</span>}
    </div>
  );
}

export function PaymentInstructionsForm({ current }: { current: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [text, setText] = useState(current);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  return (
    <form
      className="tp-stack"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await deskSavePaymentInstructions(text);
          setMsg(r.success ? { ok: true, text: "Saved. Partners now see these details." } : { ok: false, text: r.error });
          if (r.success) router.refresh();
        });
      }}
    >
      <textarea className="tp-textarea" value={text} onChange={(e) => setText(e.target.value)} placeholder={"UPI ID: …\nAccount name: …\nBank, account number, IFSC: …"} aria-label="Payment details" />
      {msg && <p className={`tp-alert ${msg.ok ? "ok" : "bad"}`}>{msg.text}</p>}
      <button className="tp-btn sm" disabled={pending}>{pending ? "Saving…" : "Save payment details"}</button>
    </form>
  );
}
