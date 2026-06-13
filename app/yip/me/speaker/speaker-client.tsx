"use client";

import { useState, useCallback } from "react";
import {
  getSpeakerMotions,
  speakerAdmitMotion,
  speakerRejectMotion,
  speakerRecordMotionVote,
} from "@/app/yip/actions/speaker";
import type { Motion } from "@/app/yip/actions/motions";
import {
  MOTION_TYPES,
  MOTION_STATUS_LABELS,
  MOTION_STATUS_COLORS,
  type MotionStatus,
} from "@/lib/yip/motions";

const TYPE_LABEL = new Map(MOTION_TYPES.map((t) => [t.code, t.label]));

export function SpeakerClient({
  eventId,
  participantId,
  roleLabel,
  initialMotions,
  loadError,
}: {
  eventId: string;
  participantId: string;
  roleLabel: string;
  initialMotions: Motion[];
  loadError: string | null;
}) {
  const [motions, setMotions] = useState<Motion[]>(initialMotions);
  const [error, setError] = useState<string | null>(loadError);
  const [busy, setBusy] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<Record<string, string>>({});
  const [votes, setVotes] = useState<Record<string, { for: string; against: string; abstain: string }>>({});

  const refresh = useCallback(async () => {
    const r = await getSpeakerMotions(eventId, participantId);
    if (r.success) setMotions(r.data);
    else setError(r.error);
  }, [eventId, participantId]);

  async function run(id: string, fn: () => Promise<{ success: boolean; error?: string }>) {
    setBusy(id);
    setError(null);
    const r = await fn();
    setBusy(null);
    if (!r.success) setError(r.error ?? "Action failed");
    try {
      await refresh();
    } catch {
      setError("Couldn't refresh — reload the page.");
    }
    return r;
  }

  const pending = motions.filter((m) => m.status === "submitted");
  const active = motions.filter((m) => m.status === "discussing" || m.status === "voting");
  const done = motions.filter(
    (m) => !["submitted", "discussing", "voting"].includes(m.status)
  );

  return (
    <div className="mx-auto w-full max-w-md space-y-5 px-4 py-5 pb-24">
      <header>
        <h1 className="text-lg font-bold text-[#1a1a3e]">Speaker&apos;s Desk</h1>
        <p className="text-sm text-[#1a1a3e]/55">
          {roleLabel} · rule on motions for the House
        </p>
      </header>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <Section title={`Awaiting your ruling (${pending.length})`}>
        {pending.length === 0 && <Empty>No motions waiting.</Empty>}
        {pending.map((m) => (
          <MotionCard key={m.id} m={m}>
            {rejecting[m.id] !== undefined ? (
              <div className="space-y-2">
                <textarea
                  value={rejecting[m.id]}
                  onChange={(e) => setRejecting((s) => ({ ...s, [m.id]: e.target.value }))}
                  placeholder="Reason for rejecting (shown to the House)…"
                  rows={2}
                  className="w-full rounded-lg border-2 border-[#1a1a3e]/10 px-3 py-2 text-sm focus:border-[#FF9933] focus:outline-none"
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={busy === m.id || !rejecting[m.id].trim()}
                    onClick={() =>
                      run(m.id, () =>
                        speakerRejectMotion(eventId, participantId, m.id, rejecting[m.id].trim())
                      ).then((r) => {
                        if (r.success)
                          setRejecting((s) => { const n = { ...s }; delete n[m.id]; return n; });
                      })
                    }
                    className="flex-1 rounded-lg bg-red-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
                  >
                    Confirm reject
                  </button>
                  <button
                    type="button"
                    onClick={() => setRejecting((s) => { const n = { ...s }; delete n[m.id]; return n; })}
                    className="rounded-lg border-2 border-[#1a1a3e]/10 px-3 py-2 text-sm font-semibold text-[#1a1a3e]/70"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={busy === m.id}
                  onClick={() => run(m.id, () => speakerAdmitMotion(eventId, participantId, m.id))}
                  className="flex-1 rounded-lg bg-[#138808] px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
                >
                  {m.motion_type === "no_confidence" ? "Admit → open vote" : "Admit"}
                </button>
                <button
                  type="button"
                  disabled={busy === m.id}
                  onClick={() => setRejecting((s) => ({ ...s, [m.id]: "" }))}
                  className="flex-1 rounded-lg border-2 border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700 disabled:opacity-50"
                >
                  Reject
                </button>
              </div>
            )}
          </MotionCard>
        ))}
      </Section>

      <Section title={`On the floor (${active.length})`}>
        {active.length === 0 && <Empty>Nothing under discussion.</Empty>}
        {active.map((m) => (
          <MotionCard key={m.id} m={m}>
            {m.status === "voting" ? (
              <VoteForm
                value={votes[m.id] ?? { for: "", against: "", abstain: "" }}
                disabled={busy === m.id}
                onChange={(v) => setVotes((s) => ({ ...s, [m.id]: v }))}
                onSubmit={() => {
                  const v = votes[m.id] ?? { for: "", against: "", abstain: "" };
                  run(m.id, () =>
                    speakerRecordMotionVote(eventId, participantId, m.id, {
                      for: Number(v.for) || 0,
                      against: Number(v.against) || 0,
                      abstain: Number(v.abstain) || 0,
                    })
                  );
                }}
              />
            ) : (
              <p className="text-xs text-[#1a1a3e]/50">Under discussion — no vote required.</p>
            )}
          </MotionCard>
        ))}
      </Section>

      <Section title={`Resolved (${done.length})`}>
        {done.length === 0 && <Empty>Nothing resolved yet.</Empty>}
        {done.map((m) => (
          <MotionCard key={m.id} m={m}>
            {m.outcome && (
              <p className="text-sm font-semibold text-[#1a1a3e]">
                Outcome: {m.outcome === "passed" ? "Passed" : "Rejected"}
                {(m.votes_for || m.votes_against || m.votes_abstain) ? (
                  <span className="font-normal text-[#1a1a3e]/55">
                    {" "}({m.votes_for}–{m.votes_against}, {m.votes_abstain} abstain)
                  </span>
                ) : null}
              </p>
            )}
            {m.speaker_note && (
              <p className="text-xs text-[#1a1a3e]/55">Note: {m.speaker_note}</p>
            )}
          </MotionCard>
        ))}
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="text-xs font-bold uppercase tracking-wide text-[#FF9933]">{title}</h2>
      {children}
    </section>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-[#1a1a3e]/8 bg-white px-4 py-6 text-center text-sm text-[#1a1a3e]/45">
      {children}
    </div>
  );
}

function MotionCard({ m, children }: { m: Motion; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-[#1a1a3e]/8 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-bold text-[#1a1a3e]">{m.subject}</p>
        <span
          className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
            MOTION_STATUS_COLORS[m.status as MotionStatus] ?? "bg-gray-100 text-gray-700 border-gray-200"
          }`}
        >
          {MOTION_STATUS_LABELS[m.status as MotionStatus] ?? m.status}
        </span>
      </div>
      <p className="mt-0.5 text-xs font-medium text-[#FF9933]">
        {TYPE_LABEL.get(m.motion_type) ?? m.motion_type}
      </p>
      {m.details && <p className="mt-1.5 text-sm text-[#1a1a3e]/70">{m.details}</p>}
      <p className="mt-1.5 text-xs text-[#1a1a3e]/45">
        Raised by {m.raised_by_name ?? "—"}
        {m.raised_by_role ? ` · ${m.raised_by_role}` : ""}
      </p>
      <div className="mt-3">{children}</div>
    </div>
  );
}

function VoteForm({
  value,
  disabled,
  onChange,
  onSubmit,
}: {
  value: { for: string; against: string; abstain: string };
  disabled: boolean;
  onChange: (v: { for: string; against: string; abstain: string }) => void;
  onSubmit: () => void;
}) {
  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        {(["for", "against", "abstain"] as const).map((k) => (
          <label key={k} className="flex-1">
            <span className="block text-[10px] font-semibold uppercase text-[#1a1a3e]/45">{k}</span>
            <input
              type="number"
              inputMode="numeric"
              min={0}
              value={value[k]}
              disabled={disabled}
              onChange={(e) => onChange({ ...value, [k]: e.target.value })}
              className="mt-0.5 w-full rounded-lg border-2 border-[#1a1a3e]/10 px-2 py-1.5 text-center text-sm focus:border-[#FF9933] focus:outline-none"
            />
          </label>
        ))}
      </div>
      <button
        type="button"
        disabled={disabled}
        onClick={onSubmit}
        className="w-full rounded-lg bg-[#FF9933] px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
      >
        Record result
      </button>
    </div>
  );
}
