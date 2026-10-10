"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import QRCode from "qrcode";
import { respondMeeting, setPartnerMeetingsOptIn } from "../../actions";

/** QR of the badge code text only (e.g. "TP26-1001"), read by the gate scanner. */
export function BadgeQr({ code }: { code: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!ref.current) return;
    QRCode.toCanvas(ref.current, code, { width: 180, margin: 1, color: { dark: "#141414", light: "#ffffff" } }).catch(() =>
      setFailed(true)
    );
  }, [code]);
  return (
    <div className="tp-qr" role="img" aria-label={`QR code for badge ${code}`}>
      {failed ? <p className="tp-small">Could not draw the QR. Show the badge code below instead.</p> : <canvas ref={ref} />}
    </div>
  );
}

export function MeetingRespond({ token, meetingId }: { token: string; meetingId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  function answer(accept: boolean) {
    setMsg(null);
    start(async () => {
      const r = await respondMeeting(token, meetingId, accept);
      if (r.success) {
        setMsg({ ok: true, text: accept ? "Accepted. The partner will see this." : "Declined." });
        router.refresh();
      } else {
        setMsg({ ok: false, text: r.error });
      }
    });
  }

  return (
    <div className="tp-stack" style={{ gap: 8 }}>
      <div className="tp-row" style={{ justifyContent: "flex-start" }}>
        <button type="button" className="tp-btn green sm" disabled={pending} onClick={() => answer(true)}>
          Accept
        </button>
        <button type="button" className="tp-btn ghost sm" disabled={pending} onClick={() => answer(false)}>
          Decline
        </button>
      </div>
      {msg && <p className={`tp-alert ${msg.ok ? "ok" : "bad"}`} style={{ margin: 0 }}>{msg.text}</p>}
    </div>
  );
}

export function OptInToggle({ token, optIn }: { token: string; optIn: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  function toggle() {
    setErr(null);
    start(async () => {
      const r = await setPartnerMeetingsOptIn(token, !optIn);
      if (r.success) router.refresh();
      else setErr(r.error);
    });
  }

  return (
    <div className="tp-stack" style={{ gap: 8 }}>
      <div className="tp-row">
        <span className={`tp-tag ${optIn ? "green" : ""}`}>{optIn ? "Taking requests" : "Not taking requests"}</span>
        <button type="button" className="tp-btn ghost sm" disabled={pending} onClick={toggle}>
          {pending ? "Saving…" : optIn ? "Stop requests" : "Allow requests"}
        </button>
      </div>
      {err && <p className="tp-alert bad" style={{ margin: 0 }}>{err}</p>}
    </div>
  );
}
