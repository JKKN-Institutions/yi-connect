"use client";

import { useState } from "react";
import {
  moveNoConfidence,
  oppositionRespondToBill,
  type GovBill,
} from "@/app/yip/actions/opposition";

export function OppositionClient({
  eventId,
  participantId,
  initialBills,
  loadError,
}: {
  eventId: string;
  participantId: string;
  initialBills: GovBill[];
  loadError?: string | null;
}) {
  const [subject, setSubject] = useState("");
  const [details, setDetails] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(loadError ?? null);
  const [moved, setMoved] = useState(false);
  const [bills, setBills] = useState<GovBill[]>(initialBills);

  async function submit() {
    setBusy(true);
    setError(null);
    const r = await moveNoConfidence(eventId, participantId, subject, details);
    setBusy(false);
    if (!r.success) {
      setError(r.error);
    } else {
      setMoved(true);
      setSubject("");
      setDetails("");
    }
  }

  function onResponded(billId: string, response: string, at: string) {
    setBills((prev) =>
      prev.map((b) =>
        b.id === billId
          ? { ...b, opposition_response: response, opposition_response_at: at }
          : b
      )
    );
  }

  return (
    <div className="mx-auto w-full max-w-md space-y-5 px-4 py-5 pb-24">
      <header>
        <h1 className="text-lg font-bold text-[#1a1a3e]">Leader of Opposition</h1>
        <p className="text-sm text-[#1a1a3e]/55">Hold the Government to account</p>
      </header>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <section className="space-y-2">
        <h2 className="text-xs font-bold uppercase tracking-wide text-red-600">
          Move a No-Confidence Motion
        </h2>
        {moved ? (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-center">
            <p className="text-sm font-semibold text-emerald-800">
              No-Confidence Motion submitted to the Speaker.
            </p>
            <button
              type="button"
              onClick={() => setMoved(false)}
              className="mt-2 text-xs font-semibold text-emerald-700 underline"
            >
              Move another
            </button>
          </div>
        ) : (
          <div className="space-y-2 rounded-2xl border border-[#1a1a3e]/8 bg-white p-4 shadow-sm">
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Subject (e.g. No confidence in the Government)"
              className="w-full rounded-lg border-2 border-[#1a1a3e]/10 px-3 py-2 text-sm focus:border-[#FF9933] focus:outline-none"
            />
            <textarea
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              placeholder="Grounds for the motion (at least 20 characters)…"
              rows={4}
              className="w-full rounded-lg border-2 border-[#1a1a3e]/10 px-3 py-2 text-sm focus:border-[#FF9933] focus:outline-none"
            />
            <button
              type="button"
              disabled={busy || subject.trim().length < 5 || details.trim().length < 20}
              onClick={submit}
              className="w-full rounded-lg bg-red-600 px-3 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
            >
              {busy ? "Submitting…" : "Submit No-Confidence Motion"}
            </button>
            <p className="text-[11px] text-[#1a1a3e]/45">
              Goes to the Speaker, who admits it and puts it to a House vote.
            </p>
          </div>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="text-xs font-bold uppercase tracking-wide text-[#FF9933]">
          Government Bills ({bills.length})
        </h2>
        {bills.length === 0 && (
          <div className="rounded-xl border border-[#1a1a3e]/8 bg-white px-4 py-6 text-center text-sm text-[#1a1a3e]/45">
            No government bills yet.
          </div>
        )}
        {bills.map((b) => (
          <GovBillCard
            key={b.id}
            bill={b}
            eventId={eventId}
            participantId={participantId}
            onResponded={onResponded}
          />
        ))}
      </section>
    </div>
  );
}

function GovBillCard({
  bill,
  eventId,
  participantId,
  onResponded,
}: {
  bill: GovBill;
  eventId: string;
  participantId: string;
  onResponded: (billId: string, response: string, at: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(bill.opposition_response ?? "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const hasResponse = !!bill.opposition_response;

  async function save() {
    setBusy(true);
    setErr(null);
    const r = await oppositionRespondToBill(eventId, participantId, bill.id, text);
    setBusy(false);
    if (!r.success) {
      setErr(r.error);
      return;
    }
    onResponded(bill.id, text.trim(), new Date().toISOString());
    setOpen(false);
  }

  return (
    <div className="rounded-2xl border border-[#1a1a3e]/8 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-bold text-[#1a1a3e]">{bill.title}</p>
        <span className="shrink-0 rounded-full bg-[#1a1a3e]/5 px-2 py-0.5 text-[10px] font-semibold text-[#1a1a3e]/55">
          {bill.status}
        </span>
      </div>
      {bill.objective && <p className="mt-1 text-sm text-[#1a1a3e]/70">{bill.objective}</p>}
      {(bill.votes_for || bill.votes_against || bill.votes_abstain) ? (
        <p className="mt-1.5 text-xs text-[#1a1a3e]/45">
          Vote: {bill.votes_for}–{bill.votes_against}, {bill.votes_abstain} abstain
        </p>
      ) : null}

      {/* Saved Opposition response */}
      {hasResponse && !open && (
        <div className="mt-3 rounded-xl border border-red-100 bg-red-50/60 p-3">
          <p className="text-[11px] font-bold uppercase tracking-wide text-red-600">
            Your Opposition response
          </p>
          <p className="mt-1 whitespace-pre-wrap text-sm text-[#1a1a3e]/80">
            {bill.opposition_response}
          </p>
        </div>
      )}

      {err && (
        <div className="mt-2 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs text-red-700">
          {err}
        </div>
      )}

      {open ? (
        <div className="mt-3 space-y-2">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="The Opposition's response to this bill (at least 10 characters)…"
            rows={4}
            className="w-full rounded-lg border-2 border-[#1a1a3e]/10 px-3 py-2 text-sm focus:border-red-500 focus:outline-none"
          />
          <div className="flex gap-2">
            <button
              type="button"
              disabled={busy || text.trim().length < 10}
              onClick={save}
              className="flex-1 rounded-lg bg-red-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              {busy ? "Saving…" : "Save response"}
            </button>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setText(bill.opposition_response ?? "");
                setErr(null);
              }}
              className="rounded-lg border-2 border-[#1a1a3e]/10 px-3 py-2 text-sm font-semibold text-[#1a1a3e]/60"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="mt-3 w-full rounded-lg border-2 border-red-200 px-3 py-2 text-sm font-semibold text-red-600"
        >
          {hasResponse ? "Edit Opposition response" : "Respond to this bill"}
        </button>
      )}
    </div>
  );
}
