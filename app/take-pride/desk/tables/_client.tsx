"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { cancelTable, createTable } from "./actions";

type Msg = { ok: boolean; text: string } | null;

const TITLE_MAX = 60;
const ABOUT_MAX = 200;

export function CreateTableForm({
  slots,
  places,
  seats,
}: {
  slots: { key: string; label: string }[];
  places: readonly string[];
  seats: { min: number; max: number };
}) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [about, setAbout] = useState("");
  const [slot, setSlot] = useState(slots[0]?.key ?? "");
  const [place, setPlace] = useState(places[0] ?? "");
  const [n, setN] = useState(10);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<Msg>(null);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    start(async () => {
      const r = await createTable({ title, about, slot, place, seats: n });
      if (r.success) {
        setMsg({ ok: true, text: `"${title.trim()}" is open for delegates.` });
        setTitle("");
        setAbout("");
        router.refresh();
      } else {
        setMsg({ ok: false, text: r.error });
      }
    });
  }

  return (
    <form className="tp-stack" onSubmit={submit} data-tp="desk-create">
      <div className="tp-field">
        <label htmlFor="dt-title">Topic</label>
        <input id="dt-title" className="tp-input" maxLength={TITLE_MAX} value={title} onChange={(e) => setTitle(e.target.value)} required />
      </div>
      <div className="tp-field">
        <label htmlFor="dt-about">Short description (optional)</label>
        <textarea id="dt-about" className="tp-textarea" maxLength={ABOUT_MAX} value={about} onChange={(e) => setAbout(e.target.value)} />
        <span className="tp-small tp-num">{about.length}/{ABOUT_MAX}</span>
      </div>
      <div className="tp-grid2">
        <div className="tp-field">
          <label htmlFor="dt-slot">When</label>
          <select id="dt-slot" className="tp-select" value={slot} onChange={(e) => setSlot(e.target.value)}>
            {slots.map((s) => (
              <option key={s.key} value={s.key}>{s.label}</option>
            ))}
          </select>
        </div>
        <div className="tp-field">
          <label htmlFor="dt-place">Where</label>
          <select id="dt-place" className="tp-select" value={place} onChange={(e) => setPlace(e.target.value)}>
            {places.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </div>
        <div className="tp-field">
          <label htmlFor="dt-seats">Seats ({seats.min} to {seats.max})</label>
          <input
            id="dt-seats"
            className="tp-input tp-num"
            type="number"
            inputMode="numeric"
            min={seats.min}
            max={seats.max}
            value={n}
            onChange={(e) => setN(Number(e.target.value))}
          />
        </div>
      </div>
      <div>
        <button type="submit" className="tp-btn green" disabled={pending}>
          {pending ? "Creating…" : "Create table"}
        </button>
      </div>
      {msg && (
        <p className={`tp-alert ${msg.ok ? "ok" : "bad"}`} role="status" style={{ margin: 0 }}>
          {msg.text}
        </p>
      )}
    </form>
  );
}

export function CancelTableButton({ circleId, title }: { circleId: string; title: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  function run() {
    setErr(null);
    start(async () => {
      const r = await cancelTable(circleId);
      if (r.success) {
        setConfirming(false);
        router.refresh();
      } else setErr(r.error);
    });
  }

  return (
    <span className="tp-stack" style={{ gap: 6 }}>
      {!confirming ? (
        <button type="button" className="tp-btn ghost sm" onClick={() => setConfirming(true)} aria-label={`Cancel ${title}`}>
          Cancel table
        </button>
      ) : (
        <span className="tp-row" style={{ justifyContent: "flex-start" }}>
          <button type="button" className="tp-btn sm" disabled={pending} onClick={run}>
            {pending ? "Cancelling…" : "Yes, cancel"}
          </button>
          <button type="button" className="tp-btn ghost sm" disabled={pending} onClick={() => setConfirming(false)}>
            Keep
          </button>
        </span>
      )}
      {err && <span className="tp-alert bad">{err}</span>}
    </span>
  );
}

export function PrintButton() {
  return (
    <button type="button" className="tp-btn sm tp-noprint" onClick={() => window.print()}>
      Print
    </button>
  );
}
