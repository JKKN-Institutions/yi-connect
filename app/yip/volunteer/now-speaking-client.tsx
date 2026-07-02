"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { toast } from "sonner";
import {
  getNowSpeakingData,
  setLiveSpeaker,
  clearLiveSpeaker,
  type NowSpeakingData,
} from "@/app/yip/actions/speakers";
import type { ScoreableParticipant } from "@/app/yip/actions/scoring";

const SAFFRON = "#FF9933";
const INK = "#1a1a3e";

// Optimistic override so the tapped tile highlights instantly, before the
// server round-trip / next poll confirms.
type Optim = { kind: "set"; id: string } | { kind: "clear" } | null;

function deskNumber(p: ScoreableParticipant): string {
  const n = p.constituency_number ?? p.serial_no;
  return n != null ? String(n) : "—";
}

export function NowSpeakingConsole({ eventId }: { eventId: string }) {
  const [data, setData] = useState<NowSpeakingData | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [optim, setOptim] = useState<Optim>(null);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);

  const refresh = useCallback(async () => {
    const r = await getNowSpeakingData(eventId);
    if (r.success) {
      setData(r.data);
      setErr(null);
      setOptim(null); // server is now the source of truth
    } else {
      setErr(r.error);
    }
  }, [eventId]);

  useEffect(() => {
    refresh();
    const t = setInterval(() => {
      // Don't clobber an in-flight optimistic tap.
      if (!busyRef.current) refresh();
    }, 4000);
    return () => clearInterval(t);
  }, [refresh]);

  const currentId =
    optim?.kind === "set"
      ? optim.id
      : optim?.kind === "clear"
        ? null
        : (data?.currentParticipantId ?? null);

  const filtered = useMemo(() => {
    const list = data?.participants ?? [];
    const needle = q.trim().toLowerCase();
    if (!needle) return list;
    return list.filter(
      (p) =>
        deskNumber(p).includes(needle) ||
        p.full_name.toLowerCase().includes(needle)
    );
  }, [data, q]);

  const currentParticipant = useMemo(
    () => (data?.participants ?? []).find((p) => p.id === currentId) ?? null,
    [data, currentId]
  );

  async function tap(p: ScoreableParticipant) {
    if (p.id === currentId || busy) return; // double-tap / already-live no-op
    setBusy(true);
    busyRef.current = true;
    setOptim({ kind: "set", id: p.id });
    const r = await setLiveSpeaker(eventId, p.id);
    busyRef.current = false;
    setBusy(false);
    if (!r.success) {
      setOptim(null);
      toast.error(r.error);
      return;
    }
    refresh();
  }

  async function done() {
    if (busy || !currentId) return;
    setBusy(true);
    busyRef.current = true;
    setOptim({ kind: "clear" });
    const r = await clearLiveSpeaker(eventId);
    busyRef.current = false;
    setBusy(false);
    if (!r.success) {
      setOptim(null);
      toast.error(r.error);
      return;
    }
    refresh();
  }

  if (err) return <Banner tone="warn">{err}</Banner>;
  if (!data) return <Banner>Loading the floor…</Banner>;

  // ── Inactive state: no live session / between sessions ──────────────
  if (!data.active) {
    const live = (data.eventStatus ?? "").includes("live");
    return (
      <div className="space-y-3">
        <Header title="Now Speaking" subtitle="Broadcast the live speaker to the jury" />
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-8 text-center shadow-sm">
          <p className="text-3xl">🪑</p>
          <p className="mt-2 text-sm font-semibold text-amber-800">
            {live
              ? "Between sessions — waiting for the Speaker to open the floor."
              : "This event isn't live yet."}
          </p>
          <p className="mt-1 text-xs text-amber-700/70">
            The number pad appears the moment a session goes live.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3 pb-24">
      <Header
        title={data.agendaItemTitle ?? "Now Speaking"}
        subtitle="Tap the number the Speaker just recognised"
      />

      {/* Live banner */}
      <div
        className="rounded-2xl px-4 py-3 shadow-sm"
        style={{
          background: currentParticipant ? SAFFRON : "#1a1a3e08",
          color: currentParticipant ? "#fff" : INK,
        }}
      >
        <p className="text-[11px] font-bold uppercase tracking-wide opacity-80">
          Now speaking
        </p>
        {currentParticipant ? (
          <p className="text-2xl font-black leading-tight">
            No. {deskNumber(currentParticipant)}
            <span className="ml-2 text-sm font-semibold opacity-90">
              {currentParticipant.full_name}
            </span>
          </p>
        ) : (
          <p className="mt-0.5 text-sm font-semibold text-[#1a1a3e]/55">
            No one on the floor — tap a number when an MP is recognised.
          </p>
        )}
      </div>

      {/* Search (optional — the grid is the primary interface) */}
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        inputMode="numeric"
        placeholder="Jump to a number or name…"
        className="w-full rounded-lg border-2 border-[#1a1a3e]/10 px-3 py-2 text-sm focus:border-[#FF9933] focus:outline-none"
      />

      {/* The number grid */}
      {filtered.length === 0 ? (
        <div className="rounded-xl border border-[#1a1a3e]/8 bg-white px-4 py-8 text-center text-sm text-[#1a1a3e]/45">
          {data.participants.length === 0
            ? "No scoreable participants yet."
            : "No number matches your search."}
        </div>
      ) : (
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-5">
          {filtered.map((p) => {
            const active = p.id === currentId;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => tap(p)}
                disabled={busy && !active}
                aria-pressed={active}
                aria-label={`Participant number ${deskNumber(p)}, ${p.full_name}`}
                className={
                  "flex min-h-[64px] flex-col items-center justify-center rounded-xl border-2 px-1 py-2 text-center transition-colors disabled:opacity-60 " +
                  (active
                    ? "border-[#FF9933] bg-[#FF9933] text-white shadow-md"
                    : "border-[#1a1a3e]/10 bg-white text-[#1a1a3e] active:bg-[#FF9933]/10")
                }
              >
                <span className="text-xl font-black leading-none">
                  {deskNumber(p)}
                </span>
                <span
                  className={
                    "mt-1 w-full truncate text-[10px] font-medium " +
                    (active ? "text-white/85" : "text-[#1a1a3e]/45")
                  }
                >
                  {p.full_name.split(" ")[0]}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* Sticky "Speaker done" */}
      <div className="fixed inset-x-0 bottom-16 z-10 mx-auto max-w-md px-4">
        <button
          type="button"
          onClick={done}
          disabled={busy || !currentId}
          className="w-full rounded-xl bg-[#1a1a3e] px-4 py-3 text-sm font-bold text-white shadow-lg transition-opacity disabled:opacity-40"
        >
          {currentId ? "✓ Speaker done" : "No one speaking"}
        </button>
      </div>
    </div>
  );
}

function Header({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <header>
      <h2 className="text-base font-bold" style={{ color: INK }}>
        {title}
      </h2>
      {subtitle && <p className="text-xs text-[#1a1a3e]/45">{subtitle}</p>}
    </header>
  );
}

function Banner({
  children,
  tone = "info",
}: {
  children: React.ReactNode;
  tone?: "info" | "warn";
}) {
  const cls =
    tone === "warn"
      ? "border-amber-200 bg-amber-50 text-amber-800"
      : "border-[#1a1a3e]/8 bg-white text-[#1a1a3e]/70";
  return (
    <div
      className={`rounded-2xl border px-4 py-6 text-center text-sm font-medium shadow-sm ${cls}`}
    >
      {children}
    </div>
  );
}
