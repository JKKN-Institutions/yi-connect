"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import QRCode from "qrcode";
import { getMyBadge, respondMeeting, setPartnerMeetingsOptIn } from "../../actions";

/**
 * QR of the FULL badge code ("TP26-1234-K7QXM": number + secret), read by the
 * gate, partner lead and scan-to-connect scanners. The secret is not in the
 * page's delegate data, so when `full` is not passed it is fetched for the
 * pass token in the URL. No QR is drawn until the full code is known: a
 * number-only QR would be refused by partners and other delegates.
 */
export function BadgeQr({ code, full, size = 180, nav = true }: { code: string; full?: string; size?: number; nav?: boolean }) {
  const params = useParams<{ token: string }>();
  const token = typeof params?.token === "string" ? params.token : "";
  const ref = useRef<HTMLCanvasElement>(null);
  const [fetched, setFetched] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const shown = full ?? fetched;

  useEffect(() => {
    if (full || !token) return;
    let live = true;
    getMyBadge(token)
      .then((r) => {
        if (!live) return;
        if (r.success) setFetched(r.data.code);
        else setFailed(true);
      })
      .catch(() => live && setFailed(true));
    return () => {
      live = false;
    };
  }, [full, token]);

  useEffect(() => {
    if (!ref.current || !shown) return;
    QRCode.toCanvas(ref.current, shown, { width: size, margin: 1, color: { dark: "#141414", light: "#ffffff" } }).catch(() =>
      setFailed(true)
    );
  }, [shown, size]);

  const box = size + 20;
  return (
    <div className="tp-stack" style={{ gap: 8, justifyItems: "center" }}>
      <div className="tp-qr" role="img" aria-label={`QR code for badge ${shown ?? code}`} style={{ width: box, height: box }}>
        {failed ? (
          <p className="tp-small">Could not draw the QR. Show the badge code instead.</p>
        ) : shown ? (
          <canvas ref={ref} />
        ) : (
          <p className="tp-small">Loading your QR…</p>
        )}
      </div>
      {shown && (
        <p className="tp-small tp-num" data-tp-code={shown} style={{ margin: 0 }}>
          Full badge code: <b style={{ color: "var(--tp-ink)", letterSpacing: ".06em" }}>{shown}</b>
        </p>
      )}
      {nav && token && (
        <div className="tp-row" style={{ justifyContent: "center" }}>
          <Link href={`/take-pride/pass/${token}/connect`} className="tp-btn green sm" data-tp="go-connect" style={{ color: "#fff" }}>
            Scan to connect
          </Link>
          <Link href={`/take-pride/pass/${token}/people-saved`} className="tp-btn ghost sm" data-tp="go-people">
            My people
          </Link>
        </div>
      )}
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
