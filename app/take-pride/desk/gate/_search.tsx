"use client";

import { useRef, useState } from "react";
import type { GateNameHit } from "./_core";
import { gateCheckInByName, gateSearchByName } from "./actions";

function istStamp(iso: string): string {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}

type Msg = { tone: "ok" | "warn" | "bad"; text: string };

/**
 * "No badge? Search by name": type 2+ letters, pick the delegate, confirm
 * the face-and-chapter check, check in. Scope (real vs sample) is decided on
 * the server; `review` only changes the wording here.
 */
export function GateNameSearch({ review = false }: { review?: boolean }) {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<GateNameHit[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [msg, setMsg] = useState<Msg | null>(null);
  const seq = useRef(0);

  const search = async (raw: string) => {
    const text = raw.trim();
    setConfirming(null);
    if (text.replace(/[^\p{L}\p{N}]/gu, "").length < 2) {
      seq.current++; // drop any search still on its way
      setSearching(false);
      setHits(null);
      return;
    }
    const mine = ++seq.current;
    setSearching(true);
    try {
      const r = await gateSearchByName(text);
      if (mine !== seq.current) return; // a newer search is on its way
      if (r.success) {
        setHits(r.data);
        setMsg(null);
      } else {
        setHits(null);
        setMsg({ tone: "bad", text: r.error });
      }
    } catch {
      if (mine === seq.current) setMsg({ tone: "bad", text: "Could not reach the server. Check the connection and try again." });
    } finally {
      if (mine === seq.current) setSearching(false);
    }
  };

  const checkIn = async (h: GateNameHit) => {
    setBusyId(h.id);
    try {
      const r = await gateCheckInByName(h.id);
      if (!r.success) {
        setMsg({ tone: "bad", text: r.error });
      } else {
        const at = r.data.at;
        setHits((list) => (list ?? []).map((x) => (x.id === h.id ? { ...x, checked_in_at: at } : x)));
        setMsg(
          r.data.already
            ? { tone: "warn", text: `${r.data.name}, ${r.data.chapter}: already checked in at ${istStamp(at)}` }
            : { tone: "ok", text: `✓ ${r.data.name}, ${r.data.chapter}, checked in` }
        );
      }
    } catch {
      setMsg({ tone: "bad", text: "Could not reach the server. Check the connection and try again." });
    }
    setBusyId(null);
    setConfirming(null);
  };

  return (
    <section className="tp-card" aria-labelledby="tp-gate-name" data-testid="gate-name">
      <h2 className="tp-h3" id="tp-gate-name" style={{ margin: 0 }}>No badge? Search by name</h2>
      <p className="tp-small" style={{ margin: 0 }}>
        {review ? "Review mode searches sample delegates only." : "Searches the real delegate list."} Check their face and chapter before you check them in.
      </p>
      <form
        className="tp-row"
        style={{ flexWrap: "nowrap" }}
        onSubmit={(e) => {
          e.preventDefault();
          void search(q);
        }}
      >
        <input
          className="tp-input"
          style={{ minWidth: 0, flex: 1 }}
          type="search"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            void search(e.target.value);
          }}
          placeholder="Type 2 or more letters"
          aria-label="Delegate name"
          autoComplete="off"
          data-testid="gate-name-q"
        />
        <button type="submit" className="tp-btn sm" disabled={searching}>
          {searching ? "…" : "Search"}
        </button>
      </form>

      {msg && (
        <p className={`tp-alert ${msg.tone}`} style={{ margin: 0 }} role="status" aria-live="assertive" data-testid="gate-name-msg">
          {msg.text}
        </p>
      )}

      {hits !== null && (
        <div className="tp-list" data-testid="gate-name-hits">
          {hits.length === 0 ? (
            <p className="tp-mute" style={{ margin: 0 }} data-testid="gate-name-none">No delegate with that name.</p>
          ) : (
            hits.map((h) => (
              <div key={h.id} className="tp-stack" style={{ gap: 6 }} data-testid="gate-name-hit">
                <div className="tp-row" style={{ flexWrap: "nowrap", alignItems: "flex-start" }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 600 }}>{h.full_name}</div>
                    <div className="tp-small">
                      {h.chapter}
                      {h.business_name ? ` · ${h.business_name}` : ""}
                    </div>
                  </div>
                  {h.checked_in_at ? (
                    <span className="tp-tag green" style={{ flexShrink: 0 }}>In {istStamp(h.checked_in_at)}</span>
                  ) : confirming === h.id ? null : (
                    <button
                      type="button"
                      className="tp-btn green sm"
                      style={{ flexShrink: 0 }}
                      onClick={() => setConfirming(h.id)}
                      data-testid="gate-name-checkin"
                    >
                      Check in
                    </button>
                  )}
                </div>
                {confirming === h.id && !h.checked_in_at && (
                  <div className="tp-alert warn tp-stack" style={{ margin: 0, gap: 8 }} data-testid="gate-name-confirm">
                    <b>Did you check their face and chapter?</b>
                    <div className="tp-row" style={{ justifyContent: "flex-start", gap: 8 }}>
                      <button
                        type="button"
                        className="tp-btn green sm"
                        disabled={busyId === h.id}
                        onClick={() => void checkIn(h)}
                        data-testid="gate-name-yes"
                      >
                        {busyId === h.id ? "Checking in…" : "Yes, check in"}
                      </button>
                      <button type="button" className="tp-btn ghost sm" onClick={() => setConfirming(null)} data-testid="gate-name-cancel">
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </section>
  );
}
