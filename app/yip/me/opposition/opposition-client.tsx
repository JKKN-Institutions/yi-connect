"use client";

import { useState } from "react";
import { moveNoConfidence, type GovBill } from "@/app/yip/actions/opposition";

export function OppositionClient({
  eventId,
  participantId,
  initialBills,
}: {
  eventId: string;
  participantId: string;
  initialBills: GovBill[];
}) {
  const [subject, setSubject] = useState("");
  const [details, setDetails] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [moved, setMoved] = useState(false);

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
          Government Bills ({initialBills.length})
        </h2>
        {initialBills.length === 0 && (
          <div className="rounded-xl border border-[#1a1a3e]/8 bg-white px-4 py-6 text-center text-sm text-[#1a1a3e]/45">
            No government bills yet.
          </div>
        )}
        {initialBills.map((b) => (
          <div key={b.id} className="rounded-2xl border border-[#1a1a3e]/8 bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-bold text-[#1a1a3e]">{b.title}</p>
              <span className="shrink-0 rounded-full bg-[#1a1a3e]/5 px-2 py-0.5 text-[10px] font-semibold text-[#1a1a3e]/55">
                {b.status}
              </span>
            </div>
            {b.objective && <p className="mt-1 text-sm text-[#1a1a3e]/70">{b.objective}</p>}
            {(b.votes_for || b.votes_against || b.votes_abstain) ? (
              <p className="mt-1.5 text-xs text-[#1a1a3e]/45">
                Vote: {b.votes_for}–{b.votes_against}, {b.votes_abstain} abstain
              </p>
            ) : null}
          </div>
        ))}
      </section>
    </div>
  );
}
