"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { draftPartnerFollowups, preparePartnerBrief } from "./ai-actions";
import type { BriefState, DraftState } from "@/lib/take-pride/ai-partners/schemas";

/*
 * Partner-side AI pieces for the Catalyst page. The text comes from the
 * out-of-band routine; this file only asks for it and shows it.
 */

const errStyle = { color: "var(--tp-bad)" } as const;

function BriefButton({ token, delegateId, label }: { token: string; delegateId: string; label: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  return (
    <span style={{ display: "grid", gap: 4, justifyItems: "start" }}>
      <button
        type="button"
        className="tp-btn ghost sm"
        disabled={pending}
        data-tp="prepare-me"
        onClick={() =>
          start(async () => {
            setErr(null);
            const r = await preparePartnerBrief(token, delegateId);
            if (!r.success) setErr(r.error);
            else router.refresh();
          })
        }
      >
        {pending ? "Asking…" : label}
      </button>
      {err && (
        <span className="tp-small" style={errStyle} role="alert">
          {err}
        </span>
      )}
    </span>
  );
}

/** Under one person: "Prepare me", or the brief, or where it stands. */
export function BriefSlot({ token, delegateId, state }: { token: string; delegateId: string; state: BriefState }) {
  if (state.status === "none") return <BriefButton token={token} delegateId={delegateId} label="Prepare me" />;
  if (state.status === "waiting") {
    return (
      <p className="tp-small" style={{ margin: 0 }} data-tp="brief-waiting">
        Your meeting brief is being prepared, usually within a few minutes.
      </p>
    );
  }
  if (state.status === "failed") {
    return (
      <div className="tp-stack" style={{ gap: 4 }} data-tp="brief-failed">
        <p className="tp-small" style={{ margin: 0 }}>We could not prepare this brief. You can try again.</p>
        <BriefButton token={token} delegateId={delegateId} label="Try again" />
      </div>
    );
  }
  return (
    <div className="tp-card hi" style={{ gap: 6, padding: 12 }} data-tp="brief">
      <p style={{ margin: 0 }}>
        <b>Why this person:</b> {state.why}
      </p>
      {state.talking_points.length > 0 && (
        <div>
          <b className="tp-small">Talk about</b>
          <ul style={{ margin: "2px 0 0", paddingLeft: 18 }}>
            {state.talking_points.map((t, i) => (
              <li key={i} className="tp-small">
                {t}
              </li>
            ))}
          </ul>
        </div>
      )}
      <p className="tp-small" style={{ margin: 0 }}>
        <b>Open with:</b> &ldquo;{state.opening_line}&rdquo;
      </p>
      {state.avoid && (
        <p className="tp-small" style={{ margin: 0 }}>
          <b>Avoid:</b> {state.avoid}
        </p>
      )}
      <p className="tp-small" style={{ margin: 0, opacity: 0.75 }}>Written by an AI helper from their public profile and your offer.</p>
    </div>
  );
}

/** "Draft follow-ups" for every lead and accepted meeting that has no draft yet. */
export function DraftFollowupsButton({ token, missing, remaining }: { token: string; missing: number; remaining: number }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  return (
    <div className="tp-stack" style={{ gap: 6 }} data-tp="draft-followups">
      <div className="tp-row" style={{ justifyContent: "flex-start" }}>
        <button
          type="button"
          className="tp-btn green sm"
          disabled={pending || missing === 0}
          onClick={() =>
            start(async () => {
              setMsg(null);
              const r = await draftPartnerFollowups(token);
              if (!r.success) {
                setMsg({ ok: false, text: r.error });
                return;
              }
              const extra = r.data.limited ? ` ${r.data.limited} more can be drafted tomorrow.` : "";
              setMsg({ ok: true, text: `${r.data.queued} follow-up${r.data.queued === 1 ? "" : "s"} on the way.${extra}` });
              router.refresh();
            })
          }
        >
          {pending ? "Asking…" : "Draft follow-ups"}
        </button>
        <span className="tp-small tp-num">
          {missing === 0 ? "Everyone here has a draft." : `${missing} without a draft · ${remaining} left today`}
        </span>
      </div>
      {msg && (
        <p className={`tp-alert ${msg.ok ? "ok" : "bad"}`} role="status" style={{ margin: 0 }}>
          {msg.text}
        </p>
      )}
    </div>
  );
}

/** A ready follow-up: the text, Copy, and WhatsApp with NO number (the app never shares delegates' numbers). */
export function MessageDraft({ message, href, label }: { message: string; href: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="tp-card" style={{ gap: 6, padding: 12 }} data-tp="message-draft">
      <p style={{ margin: 0, whiteSpace: "pre-wrap", fontSize: 14 }}>{message}</p>
      <div className="tp-row" style={{ justifyContent: "flex-start" }}>
        <button
          type="button"
          className="tp-btn ghost sm"
          data-tp="copy-draft"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(message);
              setCopied(true);
            } catch {
              setCopied(false);
            }
          }}
        >
          {copied ? "Copied" : "Copy"}
        </button>
        <a className="tp-btn green sm" href={href} target="_blank" rel="noopener noreferrer" data-tp="wa-draft">
          {label}
        </a>
      </div>
    </div>
  );
}

export function DraftSlot({ state, href }: { state: DraftState; href: string | null }) {
  if (state.status === "none") return null;
  if (state.status === "waiting") {
    return (
      <p className="tp-small" style={{ margin: 0 }} data-tp="draft-waiting">
        Follow-up being drafted.
      </p>
    );
  }
  if (state.status === "failed") {
    return (
      <p className="tp-small" style={{ margin: 0 }} data-tp="draft-failed">
        This draft could not be written. Tap Draft follow-ups to try again.
      </p>
    );
  }
  return <MessageDraft message={state.message} href={href ?? "https://wa.me/"} label="Open in WhatsApp" />;
}
