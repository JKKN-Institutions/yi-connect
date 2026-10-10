"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { applyProfileSuggestion, requestProfileHelp } from "../plan/actions";
import { AutoRefresh, Note } from "../plan/_client";

/*
 * Profile helper: a delegate writes two sentences, the AI routine suggests
 * needs / offers tags, a Yi vertical and a polished pledge, and "Apply to my
 * profile" writes ONLY those fields (checked again on the server).
 * Rendered on /plan; the profile page itself is not changed.
 */

export type HelperSuggestion = {
  jobId: string;
  needs: string[];
  offers: string[];
  yi_vertical: string | null;
  pledge: string | null;
};

export type HelperState =
  | { status: "none" }
  | { status: "waiting"; since: string }
  | { status: "failed" }
  | { status: "ready"; suggestion: HelperSuggestion };

export function ProfileAiHelper({
  token,
  state,
  remaining,
  max,
}: {
  token: string;
  state: HelperState;
  remaining: number;
  max: number;
}) {
  const router = useRouter();
  const [about, setAbout] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const [applied, setApplied] = useState(false);
  const waiting = state.status === "waiting";

  function ask(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    setApplied(false);
    start(async () => {
      const r = await requestProfileHelp(token, about);
      if (r.success) {
        setAbout("");
        router.refresh();
      } else {
        setMsg({ ok: false, text: r.error });
      }
    });
  }

  function apply(jobId: string) {
    setMsg(null);
    start(async () => {
      const r = await applyProfileSuggestion(token, jobId);
      if (r.success) {
        setApplied(true);
        setMsg({ ok: true, text: "Saved to your profile." });
        router.refresh();
      } else {
        setMsg({ ok: false, text: r.error });
      }
    });
  }

  return (
    <section className="tp-card" aria-labelledby="tp-helper" data-tp="profile-helper">
      <h2 className="tp-h2" id="tp-helper">Profile helper</h2>
      <form className="tp-stack" onSubmit={ask}>
        <div className="tp-field">
          <label htmlFor="tp-about">Tell us about you in two sentences</label>
          <p className="tp-small" style={{ margin: 0 }}>
            We suggest what you need and offer, your Yi vertical and a 1% pledge. Tip: tap the microphone on your
            keyboard to speak.
          </p>
          <textarea
            id="tp-about"
            className="tp-textarea"
            data-tp="helper-about"
            maxLength={max}
            value={about}
            onChange={(e) => setAbout(e.target.value)}
            placeholder="For example: I run a packaging unit in Coimbatore. I want export buyers and I lead my chapter's Climate work."
          />
          <span className="tp-small tp-num">{about.length}/{max}</span>
        </div>
        <div className="tp-row" style={{ justifyContent: "flex-start" }}>
          <button type="submit" className="tp-btn ghost" data-tp="helper-submit" disabled={pending || waiting || remaining <= 0}>
            {pending ? "Sending…" : "Suggest"}
          </button>
          <span className="tp-small tp-num">{remaining} left today</span>
        </div>
      </form>

      {state.status === "waiting" && <AutoRefresh key={state.since} since={state.since} label="Your suggestions are being written, usually 1–2 minutes." />}
      {state.status === "failed" && (
        <p className="tp-mute" style={{ margin: 0 }} data-tp="helper-failed">
          We could not write suggestions this time. Try again.
        </p>
      )}
      {state.status === "ready" && (
        <div className="tp-stack" style={{ gap: 8 }} data-tp="helper-suggestion">
          <p className="tp-eyebrow" style={{ margin: 0 }}>Suggestions</p>
          {state.suggestion.needs.length > 0 && (
            <div>
              <div className="tp-small">You need</div>
              <div className="tp-chips">
                {state.suggestion.needs.map((t) => (
                  <span key={t} className="tp-chip on">{t}</span>
                ))}
              </div>
            </div>
          )}
          {state.suggestion.offers.length > 0 && (
            <div>
              <div className="tp-small">You offer</div>
              <div className="tp-chips">
                {state.suggestion.offers.map((t) => (
                  <span key={t} className="tp-chip">{t}</span>
                ))}
              </div>
            </div>
          )}
          {state.suggestion.yi_vertical && (
            <p style={{ margin: 0 }}>
              <span className="tp-small">Yi vertical: </span>
              {state.suggestion.yi_vertical}
            </p>
          )}
          {state.suggestion.pledge && (
            <p style={{ margin: 0 }}>
              <span className="tp-small">1% pledge: </span>
              {state.suggestion.pledge}
            </p>
          )}
          <div>
            <button
              type="button"
              className="tp-btn green"
              data-tp="helper-apply"
              disabled={pending || applied}
              onClick={() => apply(state.suggestion.jobId)}
            >
              {applied ? "Applied" : "Apply to my profile"}
            </button>
          </div>
          <p className="tp-small" style={{ margin: 0 }}>
            This replaces your needs, offers, vertical and pledge with the suggestions above. You can change them
            any time on your profile.
          </p>
        </div>
      )}
      <Note msg={msg} />
    </section>
  );
}
