"use client";

import { useState, useTransition } from "react";
import {
  sendChapterNudge,
  sendBulkNudges,
  type BulkNudgeRow,
} from "./actions";

type NudgeProps = {
  chapterId: string;
  mobile: string | null;
  name: string;
  message: string;
  label?: string;
  disabled?: boolean;
};

/**
 * Single-chapter nudge button. Calls the server action, shows pending +
 * inline success / error. Never silently no-ops.
 */
export function NudgeButton({
  chapterId,
  mobile,
  name,
  message,
  label = "Send via WhatsApp",
  disabled = false,
}: NudgeProps) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(
    null
  );

  if (!mobile) {
    return <span className="text-[11px] text-navy/30">no mobile</span>;
  }

  const onClick = () => {
    setResult(null);
    startTransition(async () => {
      try {
        const r = await sendChapterNudge(chapterId, mobile, name, message);
        setResult(
          r.ok
            ? { ok: true, msg: "Sent" }
            : { ok: false, msg: r.error ?? "Send failed" }
        );
      } catch {
        setResult({ ok: false, msg: "Send failed — try again" });
      }
    });
  };

  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        onClick={onClick}
        disabled={pending || disabled}
        className="inline-flex items-center px-2 py-1 rounded border border-yi-green/30 bg-yi-green/5 text-[11px] font-semibold text-yi-green hover:bg-yi-green/10 disabled:opacity-50 disabled:cursor-not-allowed"
        title="Sends through the connected Yi WhatsApp number"
      >
        {pending ? "Sending…" : label}
      </button>
      {result && (
        <span
          className={`text-[11px] font-medium ${
            result.ok ? "text-yi-green" : "text-red-600"
          }`}
        >
          {result.ok ? "✓ " : "❌ "}
          {result.msg}
        </span>
      )}
    </span>
  );
}

type BulkProps = {
  rows: BulkNudgeRow[];
  label?: string;
};

/**
 * Bulk send button. Sends to every supplied row through the connected number.
 */
export function BulkNudgeButton({
  rows,
  label = "Send credentials info to all",
}: BulkProps) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(
    null
  );

  const onClick = () => {
    setResult(null);
    startTransition(async () => {
      try {
        const s = await sendBulkNudges(rows);
        if (s.error) {
          setResult({ ok: false, msg: s.error });
        } else {
          setResult({
            ok: s.failed === 0,
            msg: `Sent ${s.sent}/${s.total}${
              s.failed ? ` · ${s.failed} failed` : ""
            }`,
          });
        }
      } catch {
        setResult({ ok: false, msg: "Bulk send failed — try again" });
      }
    });
  };

  return (
    <div className="inline-flex items-center gap-3">
      <button
        type="button"
        onClick={onClick}
        disabled={pending || rows.length === 0}
        className="inline-flex items-center px-3 py-1.5 rounded-md bg-yi-green text-white text-xs font-semibold hover:bg-yi-green/90 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {pending
          ? `Sending to ${rows.length}…`
          : `${label} (${rows.length})`}
      </button>
      {result && (
        <span
          className={`text-xs font-medium ${
            result.ok ? "text-yi-green" : "text-red-600"
          }`}
        >
          {result.ok ? "✓ " : "❌ "}
          {result.msg}
        </span>
      )}
    </div>
  );
}
