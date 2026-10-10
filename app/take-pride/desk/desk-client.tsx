"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deskConfirmPartner, deskRejectPartner, deskSavePaymentInstructions } from "../actions";
import { reviewCancelPartner, reviewConfirmPartner, reviewRejectPartner } from "./review-actions";
import { deskCancelPartner } from "./cancel-actions";

export function PartnerActions({ partnerId, review = false }: { partnerId: string; review?: boolean }) {
  // Review mode uses sample-only actions; the server re-checks is_sample either way.
  const confirm = review ? reviewConfirmPartner : deskConfirmPartner;
  const reject = review ? reviewRejectPartner : deskRejectPartner;
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
          <button className="tp-btn green sm" disabled={pending} onClick={() => run(() => confirm(partnerId))}>
            {pending ? "Saving…" : "Payment received, confirm"}
          </button>
          <button className="tp-btn ghost sm" disabled={pending} onClick={() => setRejecting(true)}>Not received</button>
        </div>
      ) : (
        <form className="tp-row" style={{ justifyContent: "flex-start" }} onSubmit={(e) => { e.preventDefault(); run(() => reject(partnerId, reason)); }}>
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

/** "Cancel partner": a required note (the partner sees it) and a refund choice. */
export function CancelPartner({ partnerId, review = false }: { partnerId: string; review?: boolean }) {
  // Review mode uses the sample-only action; the server re-checks is_sample.
  const cancel = review ? reviewCancelPartner : deskCancelPartner;
  const router = useRouter();
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [refund, setRefund] = useState("");
  const [err, setErr] = useState<string | null>(null);

  if (!open) {
    return (
      <button type="button" className="tp-btn ghost sm" onClick={() => setOpen(true)} data-tp="cancel-open">
        Cancel partner
      </button>
    );
  }
  return (
    <form
      className="tp-stack"
      style={{ gap: 6, width: "100%" }}
      data-tp="cancel-form"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          setErr(null);
          const r = await cancel(partnerId, note, refund);
          if (!r.success) setErr(r.error);
          else {
            setOpen(false);
            router.refresh();
          }
        });
      }}
    >
      <textarea
        className="tp-textarea"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        maxLength={500}
        placeholder="Why it is cancelled. The partner sees this note."
        aria-label="Cancellation note"
      />
      <select className="tp-select" value={refund} onChange={(e) => setRefund(e.target.value)} aria-label="What happens to the money">
        <option value="" disabled>What happens to the money?</option>
        <option value="refund_due">Refund due</option>
        <option value="no_refund">No refund</option>
        <option value="credit">Credit to a higher tier</option>
      </select>
      <div className="tp-row" style={{ justifyContent: "flex-start" }}>
        <button className="tp-btn sm" disabled={pending}>{pending ? "Saving…" : "Cancel this partner"}</button>
        <button type="button" className="tp-btn ghost sm" onClick={() => setOpen(false)}>Keep</button>
      </div>
      {err && <span className="tp-small" style={{ color: "var(--tp-bad)" }}>{err}</span>}
    </form>
  );
}
