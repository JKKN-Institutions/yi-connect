"use client";

import { useEffect, useId, useRef } from "react";
import { countWords } from "@/lib/recognitions/words";

/** Text box with a word meter that fills as you write and turns red past the limit. */
export function WordField({
  label,
  help,
  value,
  onChange,
  limit,
  rows = 4,
  readOnly = false,
  name,
  placeholder,
}: {
  label: string;
  help?: string;
  value: string;
  onChange?: (v: string) => void;
  limit: number;
  rows?: number;
  readOnly?: boolean;
  name?: string;
  placeholder?: string;
}) {
  const id = useId();
  const words = countWords(value);
  const over = words > limit;
  return (
    <div>
      <label htmlFor={id} className="rx-label">{label}</label>
      <textarea
        id={id}
        name={name}
        className="rx-textarea"
        rows={rows}
        value={value}
        readOnly={readOnly}
        placeholder={placeholder}
        onChange={(e) => onChange?.(e.target.value)}
        aria-describedby={`${id}-meter`}
        aria-invalid={over || undefined}
      />
      <div className="rx-meter" data-over={over} id={`${id}-meter`}>
        <div className="rx-meter-track">
          <div className="rx-meter-fill" style={{ width: `${Math.min(100, (words / limit) * 100)}%` }} />
        </div>
        <span className="rx-meter-count">
          {words} / {limit} words{over ? " · too long" : ""}
        </span>
      </div>
      {help ? <p className="rx-help">{help}</p> : null}
    </div>
  );
}

/** One parameter on a 0-5 scale, as six round stops. */
export function PipScale({
  label,
  hint,
  value,
  onChange,
  disabled = false,
}: {
  label: string;
  hint?: string;
  value: number | undefined;
  onChange: (v: number) => void;
  disabled?: boolean;
}) {
  const id = useId();
  return (
    <div className="rx-spread" style={{ alignItems: "flex-start" }}>
      <div style={{ flex: "1 1 220px" }}>
        <div className="rx-h3" id={id}>{label}</div>
        {hint ? <div className="rx-help">{hint}</div> : null}
      </div>
      <div className="rx-pips" role="radiogroup" aria-labelledby={id}>
        {[0, 1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            className="rx-pip"
            aria-checked={value === n}
            aria-label={`${n} of 5`}
            disabled={disabled}
            onClick={() => onChange(n)}
          >
            {n}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Native <dialog> confirm — Escape and backdrop work out of the box. */
export function ConfirmDialog({
  open,
  title,
  children,
  confirmLabel,
  tone = "primary",
  busy = false,
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  children: React.ReactNode;
  confirmLabel: string;
  tone?: "primary" | "gilt" | "danger";
  busy?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  const btn = tone === "gilt" ? "rx-btn rx-btn-gilt" : tone === "danger" ? "rx-btn rx-btn-danger" : "rx-btn";
  return (
    <dialog ref={ref} className="rx-dialog" onClose={onClose} aria-labelledby={titleId}>
      <div className="rx-stack">
        <h2 id={titleId} className="rx-h2">{title}</h2>
        <div>{children}</div>
        <div className="rx-row" style={{ justifyContent: "flex-end" }}>
          <button type="button" className="rx-btn rx-btn-quiet" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button type="button" className={btn} onClick={onConfirm} disabled={busy}>
            {busy ? "Working…" : confirmLabel}
          </button>
        </div>
      </div>
    </dialog>
  );
}

/** Inline result line under a form: the outcome of the last action, in words. */
export function ResultLine({ result }: { result: { ok: boolean; text: string } | null }) {
  if (!result) return null;
  return (
    <p
      role={result.ok ? "status" : "alert"}
      className="rx-small"
      style={{ color: result.ok ? "var(--rx-laurel)" : "var(--rx-vermilion)", fontWeight: 600 }}
    >
      {result.text}
    </p>
  );
}
