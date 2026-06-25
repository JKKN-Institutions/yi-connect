"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { getKioskState, castKioskVote } from "@/app/yip/actions/vote-capture";

// ─── Local types (mirror getKioskState's data shape) ────────────

interface KioskOption {
  value: string;
  label: string;
}

interface KioskActive {
  sessionId: string;
  voteType: string;
  title: string;
  options: KioskOption[];
}

interface KioskPendingVoter {
  participantId: string;
  constituencyNumber: number | null;
  fullName: string;
  constituencyName: string | null;
}

interface KioskState {
  active: KioskActive | null;
  pending: KioskPendingVoter[];
  turnout: { cast: number; eligible: number };
}

type Phase = "WAITING" | "LIST" | "HANDOFF" | "CHOICE" | "DONE";

type DoneKind = "success" | "already_voted" | "closed";

const SAFFRON = "#FF9933";

export function KioskClient({
  eventId,
  volunteerName,
}: {
  eventId: string;
  volunteerName: string;
}) {
  const [state, setState] = useState<KioskState | null>(null);
  const [phase, setPhase] = useState<Phase>("WAITING");
  const [selectedVoter, setSelectedVoter] =
    useState<KioskPendingVoter | null>(null);
  const [pendingChoice, setPendingChoice] = useState<KioskOption | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [doneKind, setDoneKind] = useState<DoneKind>("success");
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  // Keep the latest phase available inside the polling effect without
  // re-subscribing on every phase change.
  const phaseRef = useRef<Phase>(phase);
  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  // ─── State fetch ──────────────────────────────────────────────

  const refresh = useCallback(async () => {
    const result = await getKioskState(eventId);
    if (!result.success) {
      setError(result.error);
      return null;
    }
    setState(result.data);
    return result.data;
  }, [eventId]);

  // Derive WAITING vs LIST only when we are in a "screen idle" phase, so an
  // active vote arriving moves us off WAITING, and a vote closing under us
  // doesn't yank a student mid-handoff.
  const settleIdlePhase = useCallback((data: KioskState | null) => {
    const current = phaseRef.current;
    if (current === "HANDOFF" || current === "CHOICE" || current === "DONE") {
      return;
    }
    if (data?.active) {
      setPhase("LIST");
    } else {
      setPhase("WAITING");
    }
  }, []);

  // Initial load.
  useEffect(() => {
    let alive = true;
    (async () => {
      const data = await refresh();
      if (alive) settleIdlePhase(data);
    })();
    return () => {
      alive = false;
    };
  }, [refresh, settleIdlePhase]);

  // Poll: every 4s in WAITING, every 5s in LIST. No polling during HANDOFF /
  // CHOICE / DONE (don't disturb the active handoff).
  useEffect(() => {
    if (phase !== "WAITING" && phase !== "LIST") return;
    const interval = phase === "WAITING" ? 4000 : 5000;
    const timer = setInterval(async () => {
      const data = await refresh();
      settleIdlePhase(data);
    }, interval);
    return () => clearInterval(timer);
  }, [phase, refresh, settleIdlePhase]);

  // ─── Actions ──────────────────────────────────────────────────

  function pickVoter(voter: KioskPendingVoter) {
    setError(null);
    setSelectedVoter(voter);
    setPendingChoice(null);
    setPhase("HANDOFF");
  }

  function backToList() {
    setSelectedVoter(null);
    setPendingChoice(null);
    setPhase("LIST");
  }

  async function confirmVote() {
    if (!state?.active || !selectedVoter || !pendingChoice) return;
    setSubmitting(true);
    setError(null);

    const result = await castKioskVote(
      eventId,
      state.active.sessionId,
      selectedVoter.participantId,
      pendingChoice.value
    );

    setSubmitting(false);

    if (!result.success) {
      setError(result.error);
      setPendingChoice(null);
      setPhase("LIST");
      return;
    }

    setDoneKind(result.data.status);
    setPhase("DONE");

    // After showing the outcome, auto-return to LIST and refresh.
    window.setTimeout(async () => {
      setSelectedVoter(null);
      setPendingChoice(null);
      const data = await refresh();
      if (data?.active) {
        setPhase("LIST");
      } else {
        setPhase("WAITING");
      }
    }, 2500);
  }

  // ─── Render ───────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      {error && phase === "LIST" && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-center text-sm font-medium text-red-700">
          {error}
        </div>
      )}

      {phase === "WAITING" && <WaitingScreen />}

      {phase === "LIST" && state?.active && (
        <ListScreen
          active={state.active}
          pending={state.pending}
          turnout={state.turnout}
          search={search}
          onSearch={setSearch}
          onPick={pickVoter}
        />
      )}

      {phase === "HANDOFF" && selectedVoter && (
        <HandoffScreen
          voter={selectedVoter}
          onConfirm={() => setPhase("CHOICE")}
          onBack={backToList}
        />
      )}

      {phase === "CHOICE" && state?.active && selectedVoter && (
        <ChoiceScreen
          active={state.active}
          voter={selectedVoter}
          pendingChoice={pendingChoice}
          submitting={submitting}
          onChoose={setPendingChoice}
          onConfirm={confirmVote}
          onBack={() => {
            setPendingChoice(null);
            setPhase("HANDOFF");
          }}
        />
      )}

      {phase === "DONE" && (
        <DoneScreen kind={doneKind} voterName={selectedVoter?.fullName ?? ""} />
      )}

      <p className="pt-2 text-center text-xs text-[#1a1a3e]/35">
        Roving kiosk · {volunteerName}
      </p>
    </div>
  );
}

// ─── 1. WAITING ─────────────────────────────────────────────────

function WaitingScreen() {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-[#1a1a3e]/5 bg-white px-6 py-16 text-center shadow-sm">
      <div
        className="size-10 animate-spin rounded-full border-[3px] border-gray-200"
        style={{ borderTopColor: SAFFRON }}
      />
      <p className="mt-5 text-base font-semibold text-[#1a1a3e]">
        Waiting for the organizer to open a vote…
      </p>
      <p className="mt-1.5 text-sm text-[#1a1a3e]/45">
        This screen will update automatically.
      </p>
    </div>
  );
}

// ─── 2. LIST ────────────────────────────────────────────────────

function ListScreen({
  active,
  pending,
  turnout,
  search,
  onSearch,
  onPick,
}: {
  active: KioskActive;
  pending: KioskPendingVoter[];
  turnout: { cast: number; eligible: number };
  search: string;
  onSearch: (v: string) => void;
  onPick: (v: KioskPendingVoter) => void;
}) {
  const q = search.trim().toLowerCase();
  const filtered = q
    ? pending.filter(
        (p) =>
          p.fullName.toLowerCase().includes(q) ||
          (p.constituencyNumber != null && String(p.constituencyNumber).includes(q))
      )
    : pending;

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold text-[#1a1a3e]">{active.title}</h1>
          <p className="text-sm text-[#1a1a3e]/45">Tap a student to hand off</p>
        </div>
        <span
          className="shrink-0 rounded-full px-3 py-1 text-sm font-semibold text-white"
          style={{ backgroundColor: SAFFRON }}
        >
          {turnout.cast} of {turnout.eligible} voted
        </span>
      </div>

      <input
        type="text"
        inputMode="text"
        value={search}
        onChange={(e) => onSearch(e.target.value)}
        placeholder="Search by seat number or name"
        className="h-12 w-full rounded-xl border-2 border-[#1a1a3e]/10 bg-white px-4 text-base text-[#1a1a3e] transition-colors focus:border-[#FF9933] focus:outline-none focus:ring-4 focus:ring-[#FF9933]/10 placeholder:text-[#1a1a3e]/30"
      />

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-[#1a1a3e]/5 bg-white px-6 py-12 text-center shadow-sm">
          <p className="text-base font-semibold text-[#1a1a3e]">
            {pending.length === 0
              ? "Everyone has voted."
              : "No students match your search."}
          </p>
          {pending.length === 0 && (
            <p className="mt-1 text-sm text-[#1a1a3e]/45">
              Wait for the next vote to open.
            </p>
          )}
        </div>
      ) : (
        <ul className="space-y-2">
          {filtered.map((voter) => (
            <li key={voter.participantId}>
              <button
                type="button"
                onClick={() => onPick(voter)}
                className="flex min-h-[56px] w-full items-center gap-3 rounded-xl border border-[#1a1a3e]/8 bg-white px-4 py-3 text-left transition-colors hover:border-[#FF9933]/40 hover:bg-[#FF9933]/5 active:bg-[#FF9933]/10"
              >
                <span className="flex h-9 min-w-9 shrink-0 items-center justify-center rounded-lg bg-[#1a1a3e]/5 px-1.5 font-[family-name:var(--font-mono)] text-sm font-bold text-[#1a1a3e]/70">
                  {voter.constituencyNumber ?? "—"}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-base font-semibold text-[#1a1a3e]">
                    {voter.fullName}
                  </span>
                  {voter.constituencyName && (
                    <span className="block truncate text-sm text-[#1a1a3e]/45">
                      {voter.constituencyName}
                    </span>
                  )}
                </span>
                <svg
                  className="size-5 shrink-0 text-[#1a1a3e]/25"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="m9 18 6-6-6-6" />
                </svg>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ─── 3. HANDOFF ─────────────────────────────────────────────────

function HandoffScreen({
  voter,
  onConfirm,
  onBack,
}: {
  voter: KioskPendingVoter;
  onConfirm: () => void;
  onBack: () => void;
}) {
  return (
    <div className="flex min-h-[60vh] flex-col">
      <div className="flex flex-1 flex-col items-center justify-center text-center">
        <p className="text-base font-medium text-[#1a1a3e]/55">
          Hand the device to
        </p>
        <p className="mt-4 text-3xl font-black leading-tight text-[#1a1a3e]">
          {voter.fullName}
        </p>
        <p
          className="mt-3 inline-flex items-center rounded-full px-4 py-1.5 font-[family-name:var(--font-mono)] text-lg font-bold text-white"
          style={{ backgroundColor: SAFFRON }}
        >
          #{voter.constituencyNumber ?? "—"}
        </p>
        {voter.constituencyName && (
          <p className="mt-3 text-base text-[#1a1a3e]/45">
            {voter.constituencyName}
          </p>
        )}
      </div>

      <div className="space-y-3 pt-6">
        <button
          type="button"
          onClick={onConfirm}
          className="flex min-h-[72px] w-full items-center justify-center rounded-2xl text-lg font-bold text-white shadow-lg transition-all hover:brightness-105 active:translate-y-px"
          style={{ backgroundColor: SAFFRON }}
        >
          This is me — vote now
        </button>
        <button
          type="button"
          onClick={onBack}
          className="flex min-h-[56px] w-full items-center justify-center rounded-2xl border-2 border-[#1a1a3e]/10 bg-white text-base font-semibold text-[#1a1a3e]/70 transition-colors hover:bg-[#1a1a3e]/5"
        >
          Back
        </button>
      </div>
    </div>
  );
}

// ─── 4. CHOICE ──────────────────────────────────────────────────

function ChoiceScreen({
  active,
  voter,
  pendingChoice,
  submitting,
  onChoose,
  onConfirm,
  onBack,
}: {
  active: KioskActive;
  voter: KioskPendingVoter;
  pendingChoice: KioskOption | null;
  submitting: boolean;
  onChoose: (o: KioskOption) => void;
  onConfirm: () => void;
  onBack: () => void;
}) {
  // Inline confirm step once an option is chosen.
  if (pendingChoice) {
    return (
      <div className="flex min-h-[60vh] flex-col">
        <div className="flex flex-1 flex-col items-center justify-center text-center">
          <p className="text-base font-medium text-[#1a1a3e]/55">
            {voter.fullName} · #{voter.constituencyNumber ?? "—"}
          </p>
          <p className="mt-4 text-2xl font-black text-[#1a1a3e]">
            Vote {pendingChoice.label}
          </p>
          <p className="mt-2 text-base font-semibold text-red-600">
            This cannot be changed.
          </p>
        </div>

        <div className="space-y-3 pt-6">
          <button
            type="button"
            onClick={onConfirm}
            disabled={submitting}
            className="flex min-h-[72px] w-full items-center justify-center rounded-2xl text-lg font-bold text-white shadow-lg transition-all hover:brightness-105 active:translate-y-px disabled:opacity-60"
            style={{ backgroundColor: SAFFRON }}
          >
            {submitting ? "Recording…" : "Confirm vote"}
          </button>
          <button
            type="button"
            onClick={onBack}
            disabled={submitting}
            className="flex min-h-[56px] w-full items-center justify-center rounded-2xl border-2 border-[#1a1a3e]/10 bg-white text-base font-semibold text-[#1a1a3e]/70 transition-colors hover:bg-[#1a1a3e]/5 disabled:opacity-60"
          >
            Go back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="text-center">
        <p className="text-base font-medium text-[#1a1a3e]/55">{active.title}</p>
        <p className="mt-1 text-xl font-black text-[#1a1a3e]">
          {voter.fullName}
        </p>
        <p className="text-sm text-[#1a1a3e]/45">#{voter.constituencyNumber ?? "—"}</p>
      </div>

      <div className="space-y-3">
        {active.options.length === 0 ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-6 text-center text-sm font-medium text-amber-800">
            No voting options are available for this session.
          </div>
        ) : (
          active.options.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChoose(opt)}
              className="flex min-h-[72px] w-full items-center justify-center rounded-2xl border-2 border-[#1a1a3e]/10 bg-white px-4 text-center text-lg font-bold text-[#1a1a3e] shadow-sm transition-all hover:border-[#FF9933] hover:bg-[#FF9933]/5 active:translate-y-px"
            >
              {opt.label}
            </button>
          ))
        )}
      </div>

      <button
        type="button"
        onClick={onBack}
        className="flex min-h-[56px] w-full items-center justify-center rounded-2xl border-2 border-[#1a1a3e]/10 bg-white text-base font-semibold text-[#1a1a3e]/70 transition-colors hover:bg-[#1a1a3e]/5"
      >
        Back
      </button>
    </div>
  );
}

// ─── 5. DONE ────────────────────────────────────────────────────

function DoneScreen({
  kind,
  voterName,
}: {
  kind: DoneKind;
  voterName: string;
}) {
  if (kind === "success") {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center rounded-2xl border border-green-200 bg-green-50 px-6 py-16 text-center">
        <div className="flex size-20 items-center justify-center rounded-full bg-green-500">
          <svg
            className="size-12 text-white"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M20 6 9 17l-5-5" />
          </svg>
        </div>
        <p className="mt-5 text-2xl font-black text-green-800">
          Vote recorded — FINAL.
        </p>
        <p className="mt-2 text-base text-green-700">
          Please return the device.
        </p>
      </div>
    );
  }

  if (kind === "already_voted") {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center rounded-2xl border border-amber-200 bg-amber-50 px-6 py-16 text-center">
        <div className="flex size-20 items-center justify-center rounded-full bg-amber-400">
          <svg
            className="size-12 text-white"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 8v4" />
            <path d="M12 16h.01" />
            <circle cx="12" cy="12" r="9" />
          </svg>
        </div>
        <p className="mt-5 text-2xl font-black text-amber-800">
          Already voted
        </p>
        <p className="mt-2 text-base text-amber-700">
          {voterName ? `${voterName}'s vote is unchanged.` : "Vote unchanged."}
        </p>
      </div>
    );
  }

  // closed
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center rounded-2xl border border-[#1a1a3e]/10 bg-white px-6 py-16 text-center">
      <div className="flex size-20 items-center justify-center rounded-full bg-[#1a1a3e]/10">
        <svg
          className="size-11 text-[#1a1a3e]/60"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v5l3 2" />
        </svg>
      </div>
      <p className="mt-5 text-2xl font-black text-[#1a1a3e]">
        Voting has closed.
      </p>
      <p className="mt-2 text-base text-[#1a1a3e]/50">
        Returning to the list…
      </p>
    </div>
  );
}
