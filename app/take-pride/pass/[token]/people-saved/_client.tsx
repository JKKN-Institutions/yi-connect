"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { MyPerson } from "@/lib/take-pride/connections";
import { savePersonNote, setShareContact } from "./actions";

const NOTE_MAX = 500;

export function ShareToggle({ token, share, hasContact }: { token: string; share: boolean; hasContact: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  function toggle() {
    setErr(null);
    start(async () => {
      const r = await setShareContact(token, !share);
      if (r.success) router.refresh();
      else setErr(r.error);
    });
  }

  return (
    <div className="tp-stack" style={{ gap: 8 }} data-tp="share">
      <div className="tp-row">
        <span className={`tp-tag ${share ? "green" : ""}`} data-tp="share-state">
          {share ? "Sharing my phone and email" : "Not sharing my phone and email"}
        </span>
        <button type="button" className="tp-btn ghost sm" disabled={pending} onClick={toggle} data-tp="share-toggle">
          {pending ? "Saving…" : share ? "Stop sharing" : "Share my contact"}
        </button>
      </div>
      <p className="tp-small" style={{ margin: 0 }}>
        {share
          ? "People in your list who also share will see your phone and email, and you will see theirs. Nobody else sees them."
          : "Turn this on to swap phone and email with people in your list who also share. Until you both turn it on, neither of you sees the other's details."}
        {!hasContact && " The desk has no phone or email on file for you yet."}
      </p>
      {err && <p className="tp-alert bad" style={{ margin: 0 }}>{err}</p>}
    </div>
  );
}

function waLink(phone: string): string | null {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) return `https://wa.me/91${digits}`;
  if (digits.length >= 11 && digits.length <= 15) return `https://wa.me/${digits}`;
  return null;
}

function istDay(iso: string): string {
  return new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short" }).format(new Date(iso));
}

function NoteEditor({ token, person }: { token: string; person: MyPerson }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState(person.note ?? "");
  const [date, setDate] = useState(person.follow_up ?? "");
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  function save() {
    setMsg(null);
    start(async () => {
      const r = await savePersonNote(token, person.id, note, date);
      if (r.success) {
        setMsg({ ok: true, text: "Saved. Only you can see this." });
        setOpen(false);
        router.refresh();
      } else setMsg({ ok: false, text: r.error });
    });
  }

  if (!open) {
    return (
      <div className="tp-stack" style={{ gap: 6 }}>
        {(person.note || person.follow_up) && (
          <div className="tp-small" style={{ margin: 0, color: "var(--tp-ink)" }} data-tp="my-note">
            {person.note && <div style={{ whiteSpace: "pre-wrap" }}>{person.note}</div>}
            {person.follow_up && <div className="tp-num">Follow up by {person.follow_up}</div>}
          </div>
        )}
        <div>
          <button type="button" className="tp-btn ghost sm" onClick={() => setOpen(true)} data-tp="edit-note">
            {person.note || person.follow_up ? "Edit my note" : "Add a private note"}
          </button>
        </div>
        {msg && <p className={`tp-alert ${msg.ok ? "ok" : "bad"}`} style={{ margin: 0 }}>{msg.text}</p>}
      </div>
    );
  }

  return (
    <div className="tp-stack" style={{ gap: 8 }}>
      <div className="tp-field">
        <label htmlFor={`note-${person.id}`}>My private note</label>
        <textarea
          id={`note-${person.id}`}
          className="tp-textarea"
          maxLength={NOTE_MAX}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="What you talked about, what to send them"
          data-tp="note-input"
        />
        <span className="tp-small tp-num">{note.length}/{NOTE_MAX} · only you see this</span>
      </div>
      <div className="tp-field">
        <label htmlFor={`fu-${person.id}`}>Follow up by (optional)</label>
        <input
          id={`fu-${person.id}`}
          type="date"
          className="tp-input"
          min="2026-01-01"
          max="2030-12-31"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          data-tp="date-input"
        />
      </div>
      <div className="tp-row" style={{ justifyContent: "flex-start" }}>
        <button type="button" className="tp-btn green sm" disabled={pending} onClick={save} data-tp="save-note">
          {pending ? "Saving…" : "Save"}
        </button>
        <button type="button" className="tp-btn ghost sm" disabled={pending} onClick={() => setOpen(false)}>
          Cancel
        </button>
      </div>
      {msg && <p className={`tp-alert ${msg.ok ? "ok" : "bad"}`} style={{ margin: 0 }}>{msg.text}</p>}
    </div>
  );
}

export function PeopleList({ token, people, iShare }: { token: string; people: MyPerson[]; iShare: boolean }) {
  const [q, setQ] = useState("");
  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return people;
    return people.filter((p) =>
      [p.full_name, p.chapter, p.business_name ?? "", p.role_title ?? "", p.note ?? ""].some((v) => v.toLowerCase().includes(needle))
    );
  }, [people, q]);

  return (
    <div className="tp-stack">
      <div className="tp-field">
        <label htmlFor="people-search">Search my people</label>
        <input
          id="people-search"
          className="tp-input"
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Name, chapter, business or your note"
          data-tp="people-search"
        />
      </div>
      {shown.length === 0 ? (
        <p className="tp-mute" style={{ margin: 0 }}>No one matches &ldquo;{q}&rdquo;.</p>
      ) : (
        <div className="tp-list">
          {shown.map((p) => {
            const wa = p.phone ? waLink(p.phone) : null;
            return (
              <article key={p.id} className="tp-stack" style={{ gap: 8 }} data-tp="person" data-name={p.full_name}>
                <div className="tp-row" style={{ alignItems: "flex-start" }}>
                  <div style={{ minWidth: 0 }}>
                    <h3 className="tp-h3">{p.full_name}</h3>
                    {(p.role_title || p.business_name) && (
                      <p style={{ margin: 0 }}>{[p.role_title, p.business_name].filter(Boolean).join(" · ")}</p>
                    )}
                    <p className="tp-small" style={{ margin: 0 }}>{p.chapter} · since {istDay(p.since)}</p>
                  </div>
                  <div className="tp-chips" style={{ justifyContent: "flex-end" }}>
                    {p.scanned && <span className="tp-tag green">Connected</span>}
                    {p.meeting && <span className="tp-tag saffron">Meeting on</span>}
                  </div>
                </div>

                {p.phone || p.email ? (
                  <div className="tp-stack" style={{ gap: 4 }} data-tp="contact">
                    {p.phone && (
                      <div className="tp-row" style={{ justifyContent: "flex-start", gap: 10 }}>
                        <a href={`tel:${p.phone}`} className="tp-num" data-tp="phone">{p.phone}</a>
                        {wa && (
                          <a href={wa} target="_blank" rel="noopener noreferrer" className="tp-small">WhatsApp</a>
                        )}
                      </div>
                    )}
                    {p.email && (
                      <a href={`mailto:${p.email}`} data-tp="email" style={{ overflowWrap: "anywhere" }}>{p.email}</a>
                    )}
                  </div>
                ) : (
                  <p className="tp-small" style={{ margin: 0 }} data-tp="no-contact">
                    {!iShare
                      ? "Contact details hidden. Share yours to swap with people who share too."
                      : p.they_share
                        ? "They share, but the desk has no phone or email on file for them."
                        : "They have not shared their contact details."}
                  </p>
                )}

                <NoteEditor token={token} person={p} />
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
