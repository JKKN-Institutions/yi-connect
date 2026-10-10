"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { cancelMyTable, joinTable, leaveTable, startTable } from "./actions";

type Msg = { ok: boolean; text: string } | null;

function Note({ msg }: { msg: Msg }) {
  if (!msg) return null;
  return (
    <p className={`tp-alert ${msg.ok ? "ok" : "bad"}`} data-tp="table-msg" style={{ margin: 0 }} role="status">
      {msg.text}
    </p>
  );
}

/** Join, Leave or (for the host) Cancel one table. */
export function TableAction({
  token,
  circleId,
  mode,
}: {
  token: string;
  circleId: string;
  mode: "join" | "leave" | "host";
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<Msg>(null);
  const [confirming, setConfirming] = useState(false);

  function run(kind: "join" | "leave" | "cancel") {
    setMsg(null);
    start(async () => {
      const r =
        kind === "join"
          ? await joinTable(token, circleId)
          : kind === "leave"
            ? await leaveTable(token, circleId)
            : await cancelMyTable(token, circleId);
      if (r.success) {
        setConfirming(false);
        router.refresh();
      } else {
        setMsg({ ok: false, text: r.error });
        router.refresh();
      }
    });
  }

  return (
    <div className="tp-stack" style={{ gap: 8 }}>
      <div className="tp-row" style={{ justifyContent: "flex-start" }}>
        {mode === "join" && (
          <button type="button" className="tp-btn green sm" data-tp="join" disabled={pending} onClick={() => run("join")}>
            {pending ? "Joining…" : "Join this table"}
          </button>
        )}
        {mode === "leave" && (
          <button type="button" className="tp-btn ghost sm" data-tp="leave" disabled={pending} onClick={() => run("leave")}>
            {pending ? "Leaving…" : "Leave"}
          </button>
        )}
        {mode === "host" && !confirming && (
          <button type="button" className="tp-btn ghost sm" data-tp="cancel-mine" disabled={pending} onClick={() => setConfirming(true)}>
            Cancel my table
          </button>
        )}
        {mode === "host" && confirming && (
          <>
            <button type="button" className="tp-btn sm" data-tp="cancel-yes" disabled={pending} onClick={() => run("cancel")}>
              {pending ? "Cancelling…" : "Yes, cancel it"}
            </button>
            <button type="button" className="tp-btn ghost sm" disabled={pending} onClick={() => setConfirming(false)}>
              Keep it
            </button>
          </>
        )}
      </div>
      <Note msg={msg} />
    </div>
  );
}

const TITLE_MAX = 60;
const ABOUT_MAX = 200;

export function StartTableForm({
  token,
  slots,
  places,
  seats,
}: {
  token: string;
  slots: { key: string; label: string }[];
  places: readonly string[];
  seats: { min: number; max: number };
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [about, setAbout] = useState("");
  const [slot, setSlot] = useState(slots[0]?.key ?? "");
  const [place, setPlace] = useState(places[0] ?? "");
  const [n, setN] = useState(8);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<Msg>(null);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    start(async () => {
      const r = await startTable(token, { title, about, slot, place, seats: n });
      if (r.success) {
        setMsg({ ok: true, text: "Your table is open. You hold one of its seats." });
        setTitle("");
        setAbout("");
        setOpen(false);
        router.refresh();
      } else {
        setMsg({ ok: false, text: r.error });
      }
    });
  }

  if (!open) {
    return (
      <div className="tp-stack" style={{ gap: 8 }}>
        <div>
          <button type="button" className="tp-btn saffron" data-tp="start-open" onClick={() => setOpen(true)}>
            Start a table
          </button>
        </div>
        <Note msg={msg} />
      </div>
    );
  }

  return (
    <form className="tp-stack" onSubmit={submit} data-tp="start-form">
      <div className="tp-field">
        <label htmlFor="tt-title">Topic</label>
        <input
          id="tt-title"
          className="tp-input"
          maxLength={TITLE_MAX}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="For example: Exporting to the Gulf"
          required
        />
        <span className="tp-small tp-num">{title.length}/{TITLE_MAX}</span>
      </div>
      <div className="tp-field">
        <label htmlFor="tt-about">What you will talk about (optional)</label>
        <textarea
          id="tt-about"
          className="tp-textarea"
          maxLength={ABOUT_MAX}
          value={about}
          onChange={(e) => setAbout(e.target.value)}
        />
        <span className="tp-small tp-num">{about.length}/{ABOUT_MAX}</span>
      </div>
      <div className="tp-field">
        <label htmlFor="tt-slot">When</label>
        <select id="tt-slot" className="tp-select" value={slot} onChange={(e) => setSlot(e.target.value)}>
          {slots.map((s) => (
            <option key={s.key} value={s.key}>{s.label}</option>
          ))}
        </select>
      </div>
      <div className="tp-field">
        <label htmlFor="tt-place">Where</label>
        <select id="tt-place" className="tp-select" value={place} onChange={(e) => setPlace(e.target.value)}>
          {places.map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>
      </div>
      <div className="tp-field">
        <label htmlFor="tt-seats">Seats, including you ({seats.min} to {seats.max})</label>
        <input
          id="tt-seats"
          className="tp-input tp-num"
          type="number"
          inputMode="numeric"
          min={seats.min}
          max={seats.max}
          value={n}
          onChange={(e) => setN(Number(e.target.value))}
        />
      </div>
      <div className="tp-row" style={{ justifyContent: "flex-start" }}>
        <button type="submit" className="tp-btn green" data-tp="start-submit" disabled={pending}>
          {pending ? "Opening…" : "Open my table"}
        </button>
        <button type="button" className="tp-btn ghost" disabled={pending} onClick={() => setOpen(false)}>
          Cancel
        </button>
      </div>
      <Note msg={msg} />
    </form>
  );
}
