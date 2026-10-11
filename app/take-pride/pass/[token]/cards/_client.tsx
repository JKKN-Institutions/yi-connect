"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { compressCardPhoto } from "@/lib/take-pride/cards/compress";
import {
  CARD_FIELD_MAX,
  CARD_MAX_BYTES,
  CARD_MAX_SIDE,
  CARD_QUALITY_STEPS,
  CARD_TARGET_BYTES,
  websiteHref,
  type CardContactFields,
  type CardField,
} from "@/lib/take-pride/cards/schemas";
import { removeCardContact, saveCardContact, uploadCardPhoto } from "./actions";

type Msg = { ok: boolean; text: string } | null;

function kb(bytes: number): string {
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

/**
 * `left` is null when today's count could not be read: scanning is then closed (fail closed).
 * `off` is a reason scanning is turned off for this pass (the shared sample pass); the server refuses too.
 */
export function ScanCard({ token, left, off = null }: { token: string; left: number | null; off?: string | null }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<"idle" | "shrinking" | "sending">("idle");
  const [msg, setMsg] = useState<Msg>(null);
  const [sent, setSent] = useState<number | null>(null);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // the same photo can be picked again
    if (!file) return;
    setMsg(null);
    setSent(null);
    setStep("shrinking");
    const c = await compressCardPhoto(file, {
      maxSide: CARD_MAX_SIDE,
      qualities: CARD_QUALITY_STEPS,
      targetBytes: CARD_TARGET_BYTES,
      maxBytes: CARD_MAX_BYTES,
    });
    if (!c.ok) {
      setStep("idle");
      setMsg({ ok: false, text: c.error });
      return;
    }
    setSent(c.bytes);
    setStep("sending");
    try {
      const r = await uploadCardPhoto(token, c.b64);
      if (r.success) {
        setMsg({ ok: true, text: "Card sent. It is being read, about 1–2 minutes. It appears below when ready." });
        router.refresh();
      } else setMsg({ ok: false, text: r.error });
    } catch {
      setMsg({ ok: false, text: "The photo did not reach us. Check your connection and try again." });
    }
    setStep("idle");
  }

  const busy = step !== "idle";
  const closed = off !== null || left === null || left <= 0;
  return (
    <div className="tp-stack" style={{ gap: 10 }} data-tp="scan-card">
      <input
        ref={input}
        id="tp-card-photo"
        type="file"
        accept="image/*"
        capture="environment"
        onChange={onFile}
        disabled={busy || closed}
        style={{ position: "absolute", width: 1, height: 1, opacity: 0, pointerEvents: "none" }}
        data-tp="card-input"
      />
      <button
        type="button"
        className="tp-btn saffron block"
        disabled={busy || closed}
        onClick={() => input.current?.click()}
        data-tp="card-take"
      >
        {step === "shrinking" ? "Preparing the photo…" : step === "sending" ? "Sending…" : "Scan a business card"}
      </button>
      <p className="tp-small" style={{ margin: 0 }} data-tp="card-left">
        {off !== null
          ? off
          : left === null
          ? "Card scanning is not available right now. Please try again later."
          : left > 0
          ? `Lay the card flat in good light and fill the frame. ${left} ${left === 1 ? "scan" : "scans"} left today.`
          : "You have used today's scans. Try again tomorrow."}
      </p>
      {sent !== null && (
        <p className="tp-small tp-num" style={{ margin: 0 }} data-tp="card-bytes" data-bytes={sent}>
          Photo size {kb(sent)}
        </p>
      )}
      {msg && (
        <p className={`tp-alert ${msg.ok ? "ok" : "bad"}`} role={msg.ok ? "status" : "alert"} style={{ margin: 0 }} data-tp="card-msg">
          {msg.text}
        </p>
      )}
    </div>
  );
}

const FIELDS: { key: CardField; label: string; type?: string; inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"] }[] = [
  { key: "full_name", label: "Name" },
  { key: "title", label: "Title" },
  { key: "company", label: "Company" },
  { key: "phone", label: "Phone", type: "tel", inputMode: "tel" },
  { key: "email", label: "Email", type: "email", inputMode: "email" },
  { key: "website", label: "Website", inputMode: "url" },
  { key: "city", label: "City" },
];

function waLink(phone: string): string | null {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) return `https://wa.me/91${digits}`;
  if (digits.length >= 11 && digits.length <= 15) return `https://wa.me/${digits}`;
  return null;
}

export type ContactView = CardContactFields & { id: string; created_at: string };

export function ContactCard({ token, contact }: { token: string; contact: ContactView }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<CardContactFields>(contact);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<Msg>(null);
  const title = contact.full_name || contact.company || "Business card";
  const site = websiteHref(contact.website);
  const wa = contact.phone ? waLink(contact.phone) : null;

  function save() {
    setMsg(null);
    start(async () => {
      const r = await saveCardContact(token, contact.id, form);
      if (r.success) {
        setEditing(false);
        setMsg({ ok: true, text: "Saved." });
        router.refresh();
      } else setMsg({ ok: false, text: r.error });
    });
  }

  function remove() {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    setMsg(null);
    start(async () => {
      const r = await removeCardContact(token, contact.id);
      if (r.success) router.refresh();
      else {
        setConfirmDelete(false);
        setMsg({ ok: false, text: r.error });
      }
    });
  }

  if (editing) {
    return (
      <article className="tp-stack" style={{ gap: 8 }} data-tp="card-contact" data-editing="1">
        {FIELDS.map((f) => (
          <div className="tp-field" key={f.key}>
            <label htmlFor={`${f.key}-${contact.id}`}>{f.label}</label>
            <input
              id={`${f.key}-${contact.id}`}
              className="tp-input"
              type={f.type ?? "text"}
              inputMode={f.inputMode}
              maxLength={CARD_FIELD_MAX[f.key]}
              value={form[f.key] ?? ""}
              onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
              data-tp={`edit-${f.key}`}
            />
          </div>
        ))}
        <div className="tp-field">
          <label htmlFor={`note-${contact.id}`}>Note</label>
          <textarea
            id={`note-${contact.id}`}
            className="tp-textarea"
            maxLength={CARD_FIELD_MAX.note}
            value={form.note ?? ""}
            onChange={(e) => setForm({ ...form, note: e.target.value })}
            data-tp="edit-note"
          />
        </div>
        <div className="tp-row" style={{ justifyContent: "flex-start" }}>
          <button type="button" className="tp-btn green sm" disabled={pending} onClick={save} data-tp="card-save">
            {pending ? "Saving…" : "Save"}
          </button>
          <button
            type="button"
            className="tp-btn ghost sm"
            disabled={pending}
            onClick={() => {
              setForm(contact);
              setEditing(false);
              setMsg(null);
            }}
          >
            Cancel
          </button>
        </div>
        {msg && (
          <p className={`tp-alert ${msg.ok ? "ok" : "bad"}`} style={{ margin: 0 }} data-tp="card-contact-msg">
            {msg.text}
          </p>
        )}
      </article>
    );
  }

  return (
    <article className="tp-stack" style={{ gap: 8 }} data-tp="card-contact" data-name={title}>
      <div style={{ minWidth: 0 }}>
        <h3 className="tp-h3">{title}</h3>
        {(contact.title || (contact.full_name && contact.company)) && (
          <p style={{ margin: 0 }}>{[contact.title, contact.full_name ? contact.company : null].filter(Boolean).join(" · ")}</p>
        )}
        {contact.city && <p className="tp-small" style={{ margin: 0 }}>{contact.city}</p>}
      </div>
      {(contact.phone || contact.email || site) && (
        <div className="tp-stack" style={{ gap: 4 }}>
          {contact.phone && (
            <div className="tp-row" style={{ justifyContent: "flex-start", gap: 10 }}>
              <a href={`tel:${contact.phone.replace(/[^\d+]/g, "")}`} className="tp-num">{contact.phone}</a>
              {wa && (
                <a href={wa} target="_blank" rel="noopener noreferrer" className="tp-small">WhatsApp</a>
              )}
            </div>
          )}
          {contact.email && (
            <a href={`mailto:${contact.email}`} style={{ overflowWrap: "anywhere" }}>{contact.email}</a>
          )}
          {site && (
            <a href={site} target="_blank" rel="noopener noreferrer" style={{ overflowWrap: "anywhere" }}>{contact.website}</a>
          )}
        </div>
      )}
      {contact.note && <p className="tp-small" style={{ margin: 0, whiteSpace: "pre-wrap" }}>{contact.note}</p>}
      <div className="tp-row" style={{ justifyContent: "flex-start", flexWrap: "wrap" }}>
        <a
          href={`/take-pride/pass/${token}/cards/contact.vcf?id=${contact.id}`}
          className="tp-btn green sm"
          style={{ color: "#fff" }}
          download
          data-tp="card-vcf"
        >
          Save to phone
        </a>
        <button type="button" className="tp-btn ghost sm" disabled={pending} onClick={() => setEditing(true)} data-tp="card-edit">
          Edit
        </button>
        <button type="button" className="tp-btn ghost sm" disabled={pending} onClick={remove} data-tp="card-delete">
          {pending ? "Deleting…" : confirmDelete ? "Tap again to delete" : "Delete"}
        </button>
      </div>
      {msg && (
        <p className={`tp-alert ${msg.ok ? "ok" : "bad"}`} style={{ margin: 0 }} data-tp="card-contact-msg">
          {msg.text}
        </p>
      )}
    </article>
  );
}
