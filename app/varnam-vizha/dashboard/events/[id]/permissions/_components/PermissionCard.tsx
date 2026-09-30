"use client";

import { useRef, useState, useTransition } from "react";
import { Copy, FileText, Printer } from "lucide-react";
import {
  draftLetter,
  saveNotes,
  setPermissionStatus,
} from "@/lib/varnam/actions/manage-permissions";
import { PERMISSION_STATUSES } from "@/lib/varnam/letters";

export type PermissionCardRow = {
  id: string;
  event_id: string;
  authority: string;
  status: string;
  letter_body: string | null;
  notes: string | null;
};

const STATUS_LABEL: Record<string, string> = {
  needed: "Needed",
  drafted: "Drafted",
  submitted: "Submitted",
  approved: "Approved",
};

function statusPill(status: string): string {
  switch (status) {
    case "drafted":
      return "bg-[#F4A300]/15 text-[#a06a00]";
    case "submitted":
      return "bg-[#0CA4A5]/12 text-[#0CA4A5]";
    case "approved":
      return "bg-[#0a8485]/12 text-[#0a8485]";
    default: // needed
      return "bg-[#3B0A45]/8 text-[#3B0A45]/60";
  }
}

const inputCls =
  "w-full rounded-lg border border-[#3B0A45]/15 bg-white px-3 py-2.5 text-sm text-[#2B0A33] outline-none transition focus:border-[#D6336C] focus:ring-2 focus:ring-[#D6336C]/20";

export function PermissionCard({
  authorityName,
  row,
}: {
  authorityName: string;
  row: PermissionCardRow;
}) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(
    null
  );
  // Controlled inputs — React 19 resets uncontrolled fields after server actions.
  const [notes, setNotes] = useState(row.notes ?? "");
  const [copied, setCopied] = useState(false);
  const letterRef = useRef<HTMLDivElement>(null);

  const run = (fn: () => Promise<{ ok: boolean; message: string }>) => {
    setMessage(null);
    startTransition(async () => {
      const res = await fn();
      if (res.message) setMessage({ ok: res.ok, text: res.message });
    });
  };

  const onPrint = () => {
    const el = letterRef.current;
    if (!el) return;
    // Tag just this letter for the page-level @media print rules, print,
    // then untag (window.print blocks until the dialog closes).
    el.classList.add("vv-print-area");
    window.print();
    el.classList.remove("vv-print-area");
  };

  const onCopy = async () => {
    if (!row.letter_body) return;
    try {
      await navigator.clipboard.writeText(row.letter_body);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setMessage({ ok: false, text: "Couldn't copy — select the text instead." });
    }
  };

  return (
    <section className="rounded-2xl border border-[#3B0A45]/10 bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-[family-name:var(--font-vv-display)] text-lg font-bold text-[#3B0A45]">
          {authorityName}
        </h2>
        <span
          className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${statusPill(
            row.status
          )}`}
        >
          {STATUS_LABEL[row.status] ?? row.status}
        </span>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        {row.status === "needed" && (
          <button
            type="button"
            disabled={pending}
            onClick={() => run(() => draftLetter(row.id))}
            className="inline-flex items-center gap-2 rounded-full bg-[#3B0A45] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#2B0A33] disabled:opacity-60"
          >
            <FileText className="size-4" />
            {pending ? "Drafting…" : "Draft letter"}
          </button>
        )}

        <label className="flex items-center gap-2 text-sm text-[#2B0A33]">
          <span className="text-[#2B0A33]/60">Status</span>
          <select
            value={row.status}
            disabled={pending}
            onChange={(e) =>
              run(() => setPermissionStatus(row.id, e.target.value))
            }
            className="rounded-lg border border-[#3B0A45]/15 bg-white px-2.5 py-1.5 text-sm text-[#2B0A33] outline-none transition focus:border-[#D6336C] focus:ring-2 focus:ring-[#D6336C]/20 disabled:opacity-60"
          >
            {PERMISSION_STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABEL[s]}
              </option>
            ))}
          </select>
        </label>
      </div>

      {row.letter_body && (
        <details className="mt-4 rounded-xl border border-[#3B0A45]/10 bg-[#FFF9F0] p-4 open:pb-5">
          <summary className="cursor-pointer text-sm font-semibold text-[#3B0A45]">
            View letter
          </summary>
          <div className="mt-3">
            <div className="mb-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={onPrint}
                className="inline-flex items-center gap-1.5 rounded-full bg-[#D6336C] px-3.5 py-1.5 text-xs font-semibold text-white transition hover:bg-[#b02a59]"
              >
                <Printer className="size-3.5" />
                Print
              </button>
              <button
                type="button"
                onClick={onCopy}
                className="inline-flex items-center gap-1.5 rounded-full border border-[#3B0A45]/15 bg-white px-3.5 py-1.5 text-xs font-semibold text-[#3B0A45] transition hover:bg-[#3B0A45]/5"
              >
                <Copy className="size-3.5" />
                {copied ? "Copied!" : "Copy"}
              </button>
            </div>
            <div
              ref={letterRef}
              className="rounded-lg border border-[#3B0A45]/10 bg-white p-4"
            >
              <pre className="whitespace-pre-wrap font-serif text-sm leading-relaxed text-[#2B0A33]">
                {row.letter_body}
              </pre>
            </div>
            <p className="mt-2 text-xs text-[#2B0A33]/45">
              Fill in [CHAIR_NAME] and [PHONE] on the printed copy before
              signing.
            </p>
          </div>
        </details>
      )}

      <div className="mt-4">
        <label
          htmlFor={`notes-${row.id}`}
          className="mb-1 block text-sm font-medium text-[#2B0A33]"
        >
          Notes{" "}
          <span className="text-[#2B0A33]/40">
            (who you met, what they said, what&apos;s pending)
          </span>
        </label>
        <textarea
          id={`notes-${row.id}`}
          rows={2}
          maxLength={2000}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="e.g. Met the PRO on Monday — asked us to resubmit with the route map."
          className={inputCls}
        />
        <div className="mt-2 flex items-center gap-3">
          <button
            type="button"
            disabled={pending || notes === (row.notes ?? "")}
            onClick={() => run(() => saveNotes(row.id, notes))}
            className="rounded-full border border-[#3B0A45]/15 bg-white px-4 py-1.5 text-xs font-semibold text-[#3B0A45] transition hover:bg-[#3B0A45]/5 disabled:opacity-50"
          >
            {pending ? "Saving…" : "Save notes"}
          </button>
          {message && (
            <p
              className={`text-xs font-medium ${
                message.ok ? "text-[#0a8485]" : "text-[#D6336C]"
              }`}
            >
              {message.text}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
