"use client";

import { useCallback, useRef, useState } from "react";
import { ContinuousScanner } from "../../_scanner";
import { gateCheckIn } from "../../actions";
import { reviewGateCheckIn } from "../review-actions";

type Outcome =
  | { kind: "in"; name: string; chapter: string; at: string }
  | { kind: "already"; name: string; chapter: string; at: string }
  | { kind: "error"; text: string };

type HistoryRow = { id: number; scanned: string; when: string; outcome: Outcome };

const DEBOUNCE_MS = 10000;

function istClock(d: Date): string {
  return new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", hour: "numeric", minute: "2-digit", second: "2-digit" }).format(d);
}

function istStamp(iso: string): string {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}

export function GateScanner({ review = false, nameSearch }: { review?: boolean; nameSearch?: React.ReactNode }) {
  // Review mode uses the sample-only check-in; the server re-checks is_sample.
  const checkIn = review ? reviewGateCheckIn : gateCheckIn;
  const [result, setResult] = useState<Outcome | null>(null);
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [count, setCount] = useState(0);
  const [busy, setBusy] = useState(false);
  const [typed, setTyped] = useState("");
  const last = useRef<{ text: string; at: number } | null>(null);
  const seq = useRef(0);

  // Stable: reads only refs and functional setState, so a scanner started
  // earlier never calls a stale copy.
  const check = useCallback(async (raw: string) => {
    const text = raw.trim();
    if (!text) return;
    const now = Date.now();
    if (last.current && last.current.text === text && now - last.current.at < DEBOUNCE_MS) return;
    last.current = { text, at: now };

    setBusy(true);
    let outcome: Outcome;
    try {
      const r = await checkIn(text);
      if (r.success) {
        outcome = { kind: r.data.already ? "already" : "in", name: r.data.name, chapter: r.data.chapter, at: r.data.at };
        setCount((c) => c + 1);
      } else {
        outcome = { kind: "error", text: r.error };
      }
    } catch {
      outcome = { kind: "error", text: "Could not reach the server. Check the connection and scan again." };
    }
    setBusy(false);
    setResult(outcome);
    const row: HistoryRow = { id: ++seq.current, scanned: text, when: istClock(new Date()), outcome };
    setHistory((h) => [row, ...h].slice(0, 10));
  }, [checkIn]);

  return (
    <div className="tp-stack">
      <ResultCard result={result} busy={busy} />

      <section className="tp-card" aria-label="Scan a badge">
        <ContinuousScanner onScan={(text) => void check(text)} />
      </section>

      <form
        className="tp-card"
        onSubmit={(e) => {
          e.preventDefault();
          void check(typed);
          setTyped("");
        }}
      >
        <div className="tp-field">
          <label htmlFor="tp-gate-code">Type a badge code</label>
          <div className="tp-row" style={{ flexWrap: "nowrap" }}>
            <input
              id="tp-gate-code"
              className="tp-input"
              style={{ minWidth: 0, flex: 1 }}
              placeholder="TP26-1001"
              autoCapitalize="characters"
              autoComplete="off"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
            />
            <button type="submit" className="tp-btn green" disabled={busy || !typed.trim()}>
              Check in
            </button>
          </div>
        </div>
      </form>

      {nameSearch}

      <section className="tp-card" aria-labelledby="tp-gate-recent">
        <div className="tp-row">
          <h2 className="tp-h3" id="tp-gate-recent">Last scans</h2>
          <span className="tp-small tp-num">{count} scanned on this phone</span>
        </div>
        {history.length === 0 ? (
          <p className="tp-mute" style={{ margin: 0 }}>Nothing scanned yet.</p>
        ) : (
          <div className="tp-list">
            {history.map((h) => (
              <div key={h.id} className="tp-row" style={{ flexWrap: "nowrap", alignItems: "flex-start" }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 600 }}>
                    {h.outcome.kind === "error" ? h.scanned : `${h.outcome.name}, ${h.outcome.chapter}`}
                  </div>
                  <div className="tp-small tp-num">{h.when}</div>
                </div>
                {h.outcome.kind === "in" && <span className="tp-tag green">Checked in</span>}
                {h.outcome.kind === "already" && <span className="tp-tag saffron">Already in</span>}
                {h.outcome.kind === "error" && <span className="tp-tag bad">Problem</span>}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function ResultCard({ result, busy }: { result: Outcome | null; busy: boolean }) {
  if (busy) {
    return (
      <div className="tp-card" role="status" aria-live="polite">
        <p className="tp-h3" style={{ margin: 0 }}>Checking…</p>
      </div>
    );
  }
  if (!result) {
    return (
      <div className="tp-card" role="status" aria-live="polite">
        <p className="tp-mute" style={{ margin: 0 }}>Scan a delegate&rsquo;s pass, or type the badge code.</p>
      </div>
    );
  }
  const tone =
    result.kind === "in"
      ? { border: "var(--tp-green)", bg: "var(--tp-green-wash)", fg: "var(--tp-green)" }
      : result.kind === "already"
        ? { border: "var(--tp-saffron)", bg: "var(--tp-saffron-wash)", fg: "var(--tp-warn)" }
        : { border: "var(--tp-bad)", bg: "var(--tp-bad-wash)", fg: "var(--tp-bad)" };
  return (
    <div
      className="tp-card"
      role="status"
      aria-live="assertive"
      style={{ borderColor: tone.border, background: tone.bg, color: tone.fg, borderWidth: 2 }}
    >
      {result.kind === "in" && (
        <p className="tp-h2" style={{ margin: 0 }}>
          ✓ {result.name}, {result.chapter}, checked in
        </p>
      )}
      {result.kind === "already" && (
        <>
          <p className="tp-h2" style={{ margin: 0 }}>Already checked in at {istStamp(result.at)}</p>
          <p style={{ margin: 0 }}>
            {result.name}, {result.chapter}
          </p>
        </>
      )}
      {result.kind === "error" && <p className="tp-h2" style={{ margin: 0 }}>{result.text}</p>}
    </div>
  );
}
