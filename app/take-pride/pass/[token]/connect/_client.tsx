"use client";

import { useCallback, useRef, useState } from "react";
import Link from "next/link";
import { ContinuousScanner } from "../../../_scanner";
import type { ConnectResult } from "@/lib/take-pride/connections";
import { connectByBadge } from "./actions";

type Outcome = { ok: true; data: ConnectResult } | { ok: false; text: string };

const DEBOUNCE_MS = 10000;

export function ConnectScanner({ token }: { token: string }) {
  const [busy, setBusy] = useState(false);
  const [typed, setTyped] = useState("");
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const last = useRef<{ text: string; at: number } | null>(null);

  const scan = useCallback(
    async (raw: string) => {
      const text = raw.trim();
      if (!text) return;
      const now = Date.now();
      if (last.current && last.current.text === text && now - last.current.at < DEBOUNCE_MS) return;
      last.current = { text, at: now };
      setBusy(true);
      try {
        const r = await connectByBadge(token, text);
        setOutcome(r.success ? { ok: true, data: r.data } : { ok: false, text: r.error });
        if (r.success) setTyped("");
      } catch {
        setOutcome({ ok: false, text: "Could not reach the server. Check the connection and scan again." });
      }
      setBusy(false);
    },
    [token]
  );

  return (
    <div className="tp-stack">
      <div aria-live="polite" data-tp="connect-result">
        {busy && <p className="tp-alert warn" style={{ margin: 0 }}>Checking the badge…</p>}
        {!busy && outcome?.ok && (
          <div className="tp-card ok" style={{ gap: 6 }} data-tp="connect-ok">
            <p className="tp-eyebrow" style={{ margin: 0 }}>{outcome.data.already ? "Already connected" : "Connected"}</p>
            <h3 className="tp-h2" style={{ fontSize: 24 }}>{outcome.data.name}</h3>
            <p style={{ margin: 0 }}>
              {[outcome.data.role, outcome.data.business].filter(Boolean).join(" · ") || "—"}
            </p>
            <p className="tp-small" style={{ margin: 0 }}>Yi {outcome.data.chapter}</p>
            <p className="tp-small" style={{ margin: 0 }}>
              {outcome.data.already
                ? "You two are already connected."
                : "You now see each other in My people."}{" "}
              <Link href={`/take-pride/pass/${token}/people-saved`}>Open My people</Link>
            </p>
          </div>
        )}
        {!busy && outcome && !outcome.ok && (
          <p className="tp-alert bad" style={{ margin: 0 }} data-tp="connect-err">{outcome.text}</p>
        )}
      </div>

      <ContinuousScanner onScan={(t) => void scan(t)} />

      <form
        className="tp-stack"
        style={{ gap: 8 }}
        onSubmit={(e) => {
          e.preventDefault();
          last.current = null; // a typed retry is always sent
          void scan(typed);
        }}
      >
        <div className="tp-field">
          <label htmlFor="connect-code">Or type the code on their badge</label>
          <input
            id="connect-code"
            className="tp-input tp-num"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            placeholder="e.g. TP26-1234-K7QXM"
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
          />
          <span className="tp-small">All of it, including the 5 letters at the end.</span>
        </div>
        <button className="tp-btn green block" disabled={busy || !typed.trim()} data-tp="connect-submit">
          {busy ? "Connecting…" : "Connect"}
        </button>
      </form>
    </div>
  );
}
