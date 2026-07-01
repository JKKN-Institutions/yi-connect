"use client";

import { useState, useCallback, useEffect } from "react";
import {
  getSpeakerMotions,
  speakerAdmitMotion,
  speakerRejectMotion,
  speakerOpenMotionVote,
  speakerRecordMotionVote,
  getNoConfidenceVoteState,
  getSpeakerQuestions,
  type MotionVoteState,
  type SpeakerQuestion,
} from "@/app/yip/actions/speaker";
import type { Motion } from "@/app/yip/actions/motions";
import {
  MOTION_TYPES,
  MOTION_STATUS_LABELS,
  MOTION_STATUS_COLORS,
  type MotionStatus,
} from "@/lib/yip/motions";
import { Gavel, Vote, CheckCircle2, ListOrdered, type LucideIcon } from "lucide-react";
import { ministryLabel, type MinistryPortfolio } from "@/lib/yip/cabinet";
import {
  SectionShell,
  SectionHeading,
  INK,
  SAFFRON,
  GREEN,
  GOLD,
  SERIF,
  inkA,
} from "../credential-ui";

const TYPE_LABEL = new Map(MOTION_TYPES.map((t) => [t.code, t.label]));

// Status chip for the Chair — shows whether the organiser has approved the
// question yet ("Pending"), plus the downstream states once it is in play.
const Q_STATUS: Record<string, { label: string; bg: string; fg: string }> = {
  submitted: { label: "Pending", bg: "#f59e0b1f", fg: "#b45309" },
  approved: { label: "Approved", bg: `${GREEN}14`, fg: GREEN },
  asked: { label: "Asked", bg: "#2563eb14", fg: "#2563eb" },
  answered: { label: "Answered", bg: "#05966914", fg: "#059669" },
  skipped: { label: "Skipped", bg: inkA(0.06), fg: inkA(0.5) },
  rejected: { label: "Rejected", bg: "#9A33241a", fg: "#9A3324" },
};
const SIDE_BADGE: Record<"ruling" | "opposition", { label: string; bg: string; fg: string }> = {
  ruling: { label: "Ruling", bg: "#C2691A1a", fg: "#8a4a12" },
  opposition: { label: "Opposition", bg: "#4f46e51a", fg: "#4338ca" },
};

/** One question row on the Chair's List of Business — MP, ministry, status +
 *  bench tags, constituency, and the question text. Read-only. */
function QuestionRow({
  qn,
  n,
  ministries,
}: {
  qn: SpeakerQuestion;
  n: number | null;
  ministries: MinistryPortfolio[];
}) {
  const st = Q_STATUS[qn.status] ?? { label: qn.status, bg: inkA(0.06), fg: inkA(0.5) };
  const sb = qn.side ? SIDE_BADGE[qn.side] : null;
  const ministry = qn.directed_to_ministry
    ? ministryLabel(qn.directed_to_ministry, ministries)
    : "—";
  return (
    <SectionShell accent={GOLD}>
      <div className="space-y-1.5 px-5 py-3.5">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-semibold" style={{ ...SERIF, color: INK }}>
            {n != null ? `${n}. ` : ""}
            {qn.mp_name}
          </p>
          <span
            className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold"
            style={{ background: `${GOLD}1a`, color: GOLD }}
          >
            {ministry}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <span
            className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
            style={{ background: st.bg, color: st.fg }}
          >
            {st.label}
          </span>
          {sb && (
            <span
              className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
              style={{ background: sb.bg, color: sb.fg }}
            >
              {sb.label}
            </span>
          )}
        </div>
        <p className="text-xs" style={{ color: inkA(0.55) }}>
          {qn.constituency_name ?? "—"}
          {qn.constituency_number != null
            ? ` · Constituency No. ${qn.constituency_number}`
            : ""}
        </p>
        <p className="text-sm leading-snug" style={{ color: inkA(0.82) }}>
          {qn.question_text}
        </p>
      </div>
    </SectionShell>
  );
}

export function SpeakerClient({
  eventId,
  participantId,
  roleLabel,
  initialMotions,
  initialQuestions,
  ministries,
  loadError,
}: {
  eventId: string;
  participantId: string;
  roleLabel: string;
  initialMotions: Motion[];
  initialQuestions: SpeakerQuestion[];
  ministries: MinistryPortfolio[];
  loadError: string | null;
}) {
  const [motions, setMotions] = useState<Motion[]>(initialMotions);
  const [questions, setQuestions] = useState<SpeakerQuestion[]>(initialQuestions);
  const [error, setError] = useState<string | null>(loadError);
  const [busy, setBusy] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<Record<string, string>>({});
  // Live floor-vote state for No-Confidence motions, keyed by motionId.
  const [voteStates, setVoteStates] = useState<Record<string, MotionVoteState>>({});
  // Question Hour view controls (Chair-side, read-only): filter by bench, and
  // tuck rejected questions behind an expander so the live list stays clean.
  const [sideFilter, setSideFilter] = useState<"all" | "ruling" | "opposition">("all");
  const [showRejected, setShowRejected] = useState(false);

  const refresh = useCallback(async () => {
    const [m, v, q] = await Promise.all([
      getSpeakerMotions(eventId, participantId),
      getNoConfidenceVoteState(eventId, participantId),
      getSpeakerQuestions(eventId, participantId),
    ]);
    if (m.success) setMotions(m.data);
    else setError(m.error);
    if (v.success) setVoteStates(v.data);
    if (q.success) setQuestions(q.data);
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

  // While a motion is on the floor, poll so the live tally and any new motion
  // state stay current without a manual refresh.
  const hasVoting = active.some((m) => m.status === "voting");
  useEffect(() => {
    if (!hasVoting) return;
    const t = setInterval(() => {
      refresh().catch(() => {});
    }, 5000);
    return () => clearInterval(t);
  }, [hasVoting, refresh]);

  const done = motions.filter(
    (m) => !["submitted", "discussing", "voting"].includes(m.status)
  );

  // Question Hour, split for the Chair: filter by bench, keep rejected apart.
  const qhVisible = questions.filter(
    (q) => sideFilter === "all" || q.side === sideFilter
  );
  const qhInline = qhVisible.filter((q) => q.status !== "rejected");
  const qhRejected = qhVisible.filter((q) => q.status === "rejected");

  return (
    <div className="mx-auto w-full max-w-md space-y-5 px-4 py-5 pb-24">
      <header>
        <p
          className="text-[10px] font-bold uppercase tracking-[0.16em]"
          style={{ color: GOLD }}
        >
          The Chair
        </p>
        <h1
          className="mt-0.5 text-[28px] font-bold leading-[1.1] tracking-tight"
          style={{ ...SERIF, color: INK }}
        >
          Speaker&apos;s Desk
        </h1>
        <p className="text-sm mt-1.5" style={{ color: inkA(0.6) }}>
          {roleLabel} · rule on motions for the House
        </p>
      </header>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <Section title={`Question Hour (${questions.length})`} icon={ListOrdered} accent={GOLD}>
        {questions.length === 0 ? (
          <Empty>
            No questions tabled yet. As MPs submit them they appear here — each tagged
            with its approval status (Pending until the organiser approves it) and the
            bench that raised it.
          </Empty>
        ) : (
          <>
            {/* Bench filter — All / Ruling / Opposition */}
            <div className="flex gap-1.5">
              {(["all", "ruling", "opposition"] as const).map((s) => {
                const on = sideFilter === s;
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setSideFilter(s)}
                    className="rounded-full px-3 py-1 text-[11px] font-semibold transition-colors"
                    style={
                      on
                        ? { background: INK, color: "#fff" }
                        : { background: inkA(0.06), color: inkA(0.6) }
                    }
                  >
                    {s === "all" ? "All" : s === "ruling" ? "Ruling" : "Opposition"}
                  </button>
                );
              })}
            </div>

            {qhVisible.length === 0 && (
              <Empty>
                No {sideFilter === "all" ? "" : `${sideFilter} `}questions to show.
              </Empty>
            )}

            {qhInline.map((qn, i) => (
              <QuestionRow key={qn.id} qn={qn} n={i + 1} ministries={ministries} />
            ))}

            {qhRejected.length > 0 && (
              <div className="space-y-3">
                <button
                  type="button"
                  onClick={() => setShowRejected((v) => !v)}
                  className="text-xs font-semibold underline-offset-2 hover:underline"
                  style={{ color: inkA(0.55) }}
                >
                  {showRejected ? "Hide" : "Show"} rejected ({qhRejected.length})
                </button>
                {showRejected &&
                  qhRejected.map((qn) => (
                    <QuestionRow key={qn.id} qn={qn} n={null} ministries={ministries} />
                  ))}
              </div>
            )}
          </>
        )}
      </Section>

      <Section title={`Awaiting your ruling (${pending.length})`} icon={Gavel} accent={SAFFRON}>
        {pending.length === 0 && <Empty>No motions waiting.</Empty>}
        {pending.map((m) => (
          <MotionCard key={m.id} m={m} accent={SAFFRON}>
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

      <Section title={`On the floor (${active.length})`} icon={Vote} accent={GOLD}>
        {active.length === 0 && <Empty>Nothing under discussion.</Empty>}
        {active.map((m) => (
          <MotionCard key={m.id} m={m} accent={GOLD}>
            {m.status === "voting" ? (
              <FloorVote
                state={voteStates[m.id]}
                disabled={busy === m.id}
                onOpen={() =>
                  run(m.id, () => speakerOpenMotionVote(eventId, participantId, m.id))
                }
                onReveal={() =>
                  run(m.id, () => speakerRecordMotionVote(eventId, participantId, m.id))
                }
              />
            ) : (
              <p className="text-xs text-[#1a1a3e]/50">Under discussion — no vote required.</p>
            )}
          </MotionCard>
        ))}
      </Section>

      <Section title={`Resolved (${done.length})`} icon={CheckCircle2} accent={GREEN}>
        {done.length === 0 && <Empty>Nothing resolved yet.</Empty>}
        {done.map((m) => (
          <MotionCard key={m.id} m={m} accent={GREEN}>
            {m.outcome && (
              <p className="text-sm font-semibold" style={{ ...SERIF, color: INK }}>
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

function Section({
  title,
  icon,
  accent,
  children,
}: {
  title: string;
  icon?: LucideIcon;
  accent?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <SectionHeading title={title} icon={icon} accent={accent} />
      {children}
    </section>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <SectionShell>
      <div
        className="px-5 py-6 text-center text-sm"
        style={{ color: inkA(0.45) }}
      >
        {children}
      </div>
    </SectionShell>
  );
}

function MotionCard({
  m,
  accent = SAFFRON,
  children,
}: {
  m: Motion;
  accent?: string;
  children: React.ReactNode;
}) {
  return (
    <SectionShell accent={accent}>
      <div className="px-5 py-4">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-bold" style={{ ...SERIF, color: INK }}>
            {m.subject}
          </p>
          <span
            className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
              MOTION_STATUS_COLORS[m.status as MotionStatus] ?? "bg-gray-100 text-gray-700 border-gray-200"
            }`}
          >
            {MOTION_STATUS_LABELS[m.status as MotionStatus] ?? m.status}
          </span>
        </div>
        <p className="mt-0.5 text-xs font-medium" style={{ color: SAFFRON }}>
          {TYPE_LABEL.get(m.motion_type) ?? m.motion_type}
        </p>
        {m.details && <p className="mt-1.5 text-sm text-[#1a1a3e]/70">{m.details}</p>}
        <p className="mt-1.5 text-xs text-[#1a1a3e]/45">
          Raised by {m.raised_by_name ?? "—"}
          {m.raised_by_role ? ` · ${m.raised_by_role}` : ""}
        </p>
        <div className="mt-3">{children}</div>
      </div>
    </SectionShell>
  );
}

/**
 * No-Confidence floor vote. Before a vote is open the Speaker opens it; once
 * open, the live House tally shows and the Speaker reveals the counted result.
 */
function FloorVote({
  state,
  disabled,
  onOpen,
  onReveal,
}: {
  state: MotionVoteState | undefined;
  disabled: boolean;
  onOpen: () => void;
  onReveal: () => void;
}) {
  if (!state) {
    return (
      <div className="space-y-1.5">
        <button
          type="button"
          disabled={disabled}
          onClick={onOpen}
          className="w-full rounded-lg bg-[#138808] px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          Open floor vote
        </button>
        <p className="text-[11px] text-[#1a1a3e]/45">
          The whole House votes Aye / Nay / Abstain on their phones.
        </p>
      </div>
    );
  }

  const t = state.tally;
  return (
    <div className="space-y-2">
      <div className="flex gap-2 text-center">
        <Pill label="Aye" value={t.for} tone="green" />
        <Pill label="Nay" value={t.against} tone="red" />
        <Pill label="Abstain" value={t.abstain} tone="gray" />
      </div>
      <p className="text-[11px] text-[#1a1a3e]/45">
        {t.total} ballot{t.total === 1 ? "" : "s"} cast · live
      </p>
      <button
        type="button"
        disabled={disabled}
        onClick={onReveal}
        className="w-full rounded-lg bg-[#FF9933] px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
      >
        Reveal result
      </button>
    </div>
  );
}

function Pill({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "green" | "red" | "gray";
}) {
  const cls =
    tone === "green"
      ? "border-green-200 bg-green-50 text-green-700"
      : tone === "red"
        ? "border-red-200 bg-red-50 text-red-700"
        : "border-gray-200 bg-gray-50 text-gray-600";
  return (
    <div className={`flex-1 rounded-lg border px-2 py-1.5 ${cls}`}>
      <span className="block text-[10px] font-semibold uppercase">{label}</span>
      <span className="block text-lg font-bold" style={SERIF}>{value}</span>
    </div>
  );
}
