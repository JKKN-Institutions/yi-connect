"use client";

// ═══════════════════════════════════════════════════════════════════════
// Yi-Future — review-and-approve board for team placement suggestions.
//
// The screen SUGGESTS; a human APPROVES. Nothing is written by rendering this
// component, by ticking a box, or by any timer. One explicit click, then a
// second confirm click, sends invitations for exactly the ticked rows — and an
// invitation still has to be accepted by the student before they join a team.
//
// FAILURE PATHS (all visible, none of them "a spinner forever"):
//   • request rejects            → red panel with the reason + Retry.
//   • request never answers      → a 2-minute watchdog releases the button and
//                                  says invitations MAY already have been sent,
//                                  so the reviewer reloads instead of double-
//                                  sending.
//   • batch half-applies         → per-row sent / skipped / failed list. Never
//                                  collapsed into one opaque message.
//   • plan went stale mid-review → rows come back "skipped: joined a team since
//                                  this page loaded", which is the correct
//                                  outcome, not an error.
// ═══════════════════════════════════════════════════════════════════════

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { approvePlacements } from "@/app/yi-future/actions/placement";
import { PLACEMENT_BATCH_MAX } from "@/lib/yi-future/placement";
import type {
  PlacementPlan,
  PlacementBatchResult,
} from "@/lib/yi-future/placement";

/** Rows rendered at once. The send cap is 50, so working from the top is the
 *  intended flow; the rest reappear on the next reload. */
const RENDER_LIMIT = 200;
const WATCHDOG_MS = 120_000;

/**
 * Reject the wait (not the request) if the server never answers, so the button
 * is always released and the reviewer is told the truth: the send may or may
 * not have happened.
 */
async function withWatchdog<T>(p: Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const bell = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error("__WATCHDOG__")), WATCHDOG_MS);
  });
  try {
    return await Promise.race([p, bell]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export function PlacementBoard({
  chapterId,
  chapterName,
  plan,
}: {
  chapterId: string;
  chapterName: string;
  plan: PlacementPlan;
}) {
  const router = useRouter();
  const visible = plan.suggestions.slice(0, RENDER_LIMIT);

  // Pre-tick the first batch so the common case is "scan, untick the odd one,
  // send" — but the send itself is always an explicit click.
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(visible.slice(0, PLACEMENT_BATCH_MAX).map((s) => s.key))
  );
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PlacementBatchResult | null>(null);

  const chosen = useMemo(
    () => visible.filter((s) => selected.has(s.key)),
    [visible, selected]
  );
  const overCap = chosen.length > PLACEMENT_BATCH_MAX;

  function toggle(key: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
    setConfirming(false);
  }

  async function send() {
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const res = await withWatchdog(
        approvePlacements(
          chapterId,
          chosen.map((s) => ({ delegateId: s.delegateId, teamId: s.teamId }))
        )
      );
      setResult(res);
      if (res.ok) {
        // Drop the rows we just acted on so a second click can't resend them.
        const acted = new Set(res.rows.map((r) => r.key));
        setSelected((prev) => new Set([...prev].filter((k) => !acted.has(k))));
        router.refresh();
      }
    } catch (e) {
      setError(
        e instanceof Error && e.message === "__WATCHDOG__"
          ? "No response after 2 minutes. Some invitations may already have been sent — reload this page and check before trying again."
          : e instanceof Error
            ? `Could not send: ${e.message}`
            : "Could not send the invitations. Nothing is confirmed — reload this page and check before trying again."
      );
    } finally {
      // Always releases the UI, on success, failure, or watchdog.
      setBusy(false);
      setConfirming(false);
    }
  }

  const s = plan.stats;

  return (
    <div className="space-y-6">
      {/* ─── Capacity reality ─────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Tile label="Without a team" value={s.unteamed} note={chapterName} />
        <Tile
          label="Free seats now"
          value={s.openSeats}
          note={`in ${s.openTeams} open team${s.openTeams === 1 ? "" : "s"}`}
        />
        <Tile label="Suggested below" value={s.suggested} note="each needs your approval" />
        <Tile
          label="Invitation pending"
          value={s.awaitingResponse}
          note="waiting on the student"
        />
        <Tile
          label="No seat available"
          value={s.seatShortfall}
          note={
            s.seatShortfall > 0
              ? `create ${s.newTeamsNeeded} more team${s.newTeamsNeeded === 1 ? "" : "s"}`
              : "everyone has a seat"
          }
          alert={s.seatShortfall > 0}
        />
      </div>

      {/* Measured in Erode on 2026-08-09: 95 of 96 unteamed students already
          held a fresh invitation, so the plan could only suggest 1 placement.
          Without this line the screen reads as broken ("96 unteamed, 1
          suggestion") when it is in fact correct — the chapter's real blocker
          is acceptance, not suggestions. */}
      {s.awaitingResponse > s.suggested && s.awaitingResponse > 0 && (
        <div className="bg-white border-2 border-navy/15 rounded-lg p-4 text-sm text-navy/80">
          <p className="font-bold text-navy">
            Most of these students have already been invited.
          </p>
          <p className="mt-1">
            {s.awaitingResponse} of {s.unteamed} are sitting on an invitation
            they have not answered yet, so there is nothing to re-suggest for
            them — inviting them again would just be a second notification for
            the same decision. Chase those acceptances first; the list at the
            bottom names every one of them and the team they were invited to.
          </p>
        </div>
      )}

      {s.seatShortfall > 0 && (
        <div className="bg-[#F5A623]/10 border-2 border-[#F5A623]/40 rounded-lg p-4 text-sm text-navy/80">
          <p className="font-bold text-navy">
            {s.seatShortfall} student{s.seatShortfall === 1 ? "" : "s"} cannot be
            placed into an existing team.
          </p>
          <p className="mt-1">
            Open teams hold {s.openSeats} free seat
            {s.openSeats === 1 ? "" : "s"}.
            {s.frozenTeams > 0 && (
              <>
                {" "}
                Another {s.frozenSeats} seat{s.frozenSeats === 1 ? "" : "s"} sit
                inside {s.frozenTeams} locked team
                {s.frozenTeams === 1 ? "" : "s"} — unlocking a team releases
                them.
              </>
            )}
            {s.leaderlessTeams > 0 && (
              <>
                {" "}
                {s.leaderlessSeats} seat{s.leaderlessSeats === 1 ? "" : "s"} are
                in {s.leaderlessTeams} team
                {s.leaderlessTeams === 1 ? "" : "s"} with no captain — an
                invitation cannot be sent from a team without a captain.
              </>
            )}{" "}
            Otherwise create {s.newTeamsNeeded} new team
            {s.newTeamsNeeded === 1 ? "" : "s"}.
          </p>
        </div>
      )}

      {/* ─── How this works ──────────────────────────────────────────── */}
      <div className="bg-white border border-navy/10 rounded-lg p-4 text-sm text-navy/70">
        <p className="font-bold text-navy">Nothing moves until you approve.</p>
        <p className="mt-1">
          Ticked rows are sent as <strong>invitations</strong>. The student has
          to accept before they join a team — you are not moving anyone, you are
          asking. Untick any row you disagree with. Up to{" "}
          {PLACEMENT_BATCH_MAX} at a time.
        </p>
      </div>

      {/* ─── Result / error ──────────────────────────────────────────── */}
      {error && (
        <div className="bg-red-50 border-2 border-red-300 rounded-lg p-4">
          <p className="text-sm font-bold text-red-700">{error}</p>
          <button
            type="button"
            onClick={() => router.refresh()}
            className="mt-2 text-xs font-semibold underline text-red-700"
          >
            Reload the plan
          </button>
        </div>
      )}

      {result && !result.ok && (
        <div className="bg-red-50 border-2 border-red-300 rounded-lg p-4">
          <p className="text-sm font-bold text-red-700">{result.error}</p>
        </div>
      )}

      {result && result.ok && (
        <div className="bg-white border-2 border-navy/15 rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-navy/10">
            <p className="text-sm font-bold text-navy">
              {result.sent} invitation{result.sent === 1 ? "" : "s"} sent
              {result.skipped > 0 && ` · ${result.skipped} skipped`}
              {result.failed > 0 && ` · ${result.failed} failed`}
            </p>
            <p className="mt-0.5 text-xs text-navy/60">
              Students must accept before they appear on a team.
            </p>
          </div>
          <ul className="divide-y divide-navy/5">
            {result.rows.map((r) => (
              <li
                key={r.key}
                className="px-4 py-2 text-xs flex flex-wrap items-baseline gap-x-2"
              >
                <span
                  className={`font-bold ${
                    r.status === "sent"
                      ? "text-yi-green"
                      : r.status === "skipped"
                        ? "text-navy/50"
                        : "text-red-600"
                  }`}
                >
                  {r.status === "sent" ? "✓ sent" : r.status === "skipped" ? "– skipped" : "✕ failed"}
                </span>
                <span className="font-semibold text-navy">{r.delegateName}</span>
                <span className="text-navy/50">→ {r.teamName}</span>
                <span className="text-navy/60">{r.detail}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* ─── Suggestions ─────────────────────────────────────────────── */}
      {visible.length === 0 ? (
        <div className="bg-white border border-navy/10 rounded-lg p-10 text-center">
          <div className="text-lg font-bold text-navy">
            No placement suggestions
          </div>
          <p className="mt-2 text-sm text-navy/60 max-w-md mx-auto">
            {s.unteamed === 0
              ? "Every active delegate in this chapter is already on a team."
              : s.awaitingResponse === s.unteamed
                ? "Every unteamed student already has an invitation waiting for their answer."
                : "There is no open team with a free seat and a captain. Create a team, or unlock one, then reload."}
          </p>
        </div>
      ) : (
        <div className="bg-white border border-navy/10 rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-navy/10 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-bold text-navy">
                {chosen.length} of {visible.length} selected
              </p>
              {plan.suggestions.length > visible.length && (
                <p className="text-[11px] text-navy/50">
                  Showing the first {visible.length} of{" "}
                  {plan.suggestions.length} — the rest appear after this batch.
                </p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setSelected(
                    new Set(
                      visible.slice(0, PLACEMENT_BATCH_MAX).map((x) => x.key)
                    )
                  );
                  setConfirming(false);
                }}
                className="text-xs font-semibold px-3 py-1.5 rounded border border-navy/20 bg-white text-navy hover:border-navy/40"
              >
                Select first {PLACEMENT_BATCH_MAX}
              </button>
              <button
                type="button"
                onClick={() => {
                  setSelected(new Set());
                  setConfirming(false);
                }}
                className="text-xs font-semibold px-3 py-1.5 rounded border border-navy/20 bg-white text-navy hover:border-navy/40"
              >
                Clear selection
              </button>
            </div>
          </div>

          <table className="w-full text-sm">
            <thead className="bg-navy/5 text-navy/70">
              <tr>
                <th className="w-10 px-3 py-2" scope="col">
                  <span className="sr-only">Approve</span>
                </th>
                <th className="text-left px-3 py-2 font-semibold" scope="col">
                  Student
                </th>
                <th className="text-left px-3 py-2 font-semibold" scope="col">
                  Suggested team
                </th>
                <th className="text-left px-3 py-2 font-semibold" scope="col">
                  Why this team
                </th>
              </tr>
            </thead>
            <tbody>
              {visible.map((sg) => {
                const on = selected.has(sg.key);
                return (
                  <tr
                    key={sg.key}
                    className={`border-t border-navy/5 ${on ? "" : "opacity-50"}`}
                  >
                    <td className="px-3 py-2 align-top">
                      <input
                        type="checkbox"
                        checked={on}
                        onChange={() => toggle(sg.key)}
                        disabled={busy}
                        aria-label={`Approve placing ${sg.delegateName} in ${sg.teamName}`}
                        className="h-4 w-4 accent-[#1a1a3e]"
                      />
                    </td>
                    <td className="px-3 py-2 align-top">
                      <div className="font-semibold text-navy">
                        {sg.delegateName}
                      </div>
                      <div className="text-[11px] text-navy/50">
                        {sg.collegeName ?? "No college on record"}
                        {sg.course ? ` · ${sg.course}` : ""}
                        {sg.yearOfStudy != null ? ` · year ${sg.yearOfStudy}` : ""}
                      </div>
                    </td>
                    <td className="px-3 py-2 align-top">
                      <div className="font-semibold text-navy">{sg.teamName}</div>
                      <div className="text-[11px] text-navy/50">
                        {sg.sizeBefore} → {sg.sizeAfter} members
                        {sg.problemTitle ? ` · ${sg.problemTitle}` : ""}
                      </div>
                    </td>
                    <td className="px-3 py-2 align-top">
                      <ul className="space-y-0.5">
                        {sg.reasons.map((r) => (
                          <li key={r} className="text-[11px] text-navy/70">
                            • {r}
                          </li>
                        ))}
                        {sg.warnings.map((w) => (
                          <li
                            key={w}
                            className="text-[11px] text-[#F5A623] font-semibold"
                          >
                            ! {w}
                          </li>
                        ))}
                      </ul>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* ─── Approve (two steps, always) ───────────────────────── */}
          <div className="px-4 py-3 border-t border-navy/10 bg-navy/[0.02] flex flex-wrap items-center gap-3">
            {overCap ? (
              <p className="text-xs font-semibold text-red-600">
                {chosen.length} selected — untick down to {PLACEMENT_BATCH_MAX}{" "}
                or use “Select first {PLACEMENT_BATCH_MAX}”.
              </p>
            ) : confirming ? (
              <>
                <p className="text-xs font-semibold text-navy">
                  Send {chosen.length} invitation
                  {chosen.length === 1 ? "" : "s"}? Students must accept before
                  joining. No team changes until they do.
                </p>
                <button
                  type="button"
                  onClick={send}
                  disabled={busy}
                  className="px-4 py-2 rounded-md bg-navy text-ivory text-sm font-semibold hover:bg-navy-dark disabled:opacity-50"
                >
                  {busy
                    ? "Sending… do not close this tab"
                    : `Yes, send ${chosen.length}`}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirming(false)}
                  disabled={busy}
                  className="text-xs font-semibold text-navy/60 underline disabled:opacity-50"
                >
                  Cancel
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => setConfirming(true)}
                disabled={busy || chosen.length === 0}
                className="px-4 py-2 rounded-md bg-navy text-ivory text-sm font-semibold hover:bg-navy-dark disabled:opacity-40"
              >
                Approve {chosen.length} placement
                {chosen.length === 1 ? "" : "s"}
              </button>
            )}
          </div>
        </div>
      )}

      {/* ─── Already waiting on the student ──────────────────────────── */}
      {plan.awaiting.length > 0 && (
        <details className="bg-white border border-navy/10 rounded-lg p-4">
          <summary className="text-sm font-bold text-navy cursor-pointer">
            {plan.awaiting.length} student
            {plan.awaiting.length === 1 ? "" : "s"} already have an invitation
            waiting
          </summary>
          <ul className="mt-2 space-y-1">
            {plan.awaiting.slice(0, 100).map((a) => (
              <li key={a.delegateId} className="text-xs text-navy/70">
                {a.delegateName} — invited to {a.teamName}
              </li>
            ))}
          </ul>
          {plan.awaiting.length > 100 && (
            <p className="mt-2 text-[11px] text-navy/50">
              …and {plan.awaiting.length - 100} more.
            </p>
          )}
        </details>
      )}

      {/* ─── Nowhere to put them ─────────────────────────────────────── */}
      {plan.blocked.length > 0 && (
        <details className="bg-white border border-navy/10 rounded-lg p-4">
          <summary className="text-sm font-bold text-navy cursor-pointer">
            {plan.blocked.length} student
            {plan.blocked.length === 1 ? "" : "s"} need a new team
          </summary>
          <ul className="mt-2 space-y-1">
            {plan.blocked.slice(0, 100).map((b) => (
              <li key={b.delegateId} className="text-xs text-navy/70">
                <span className="font-semibold text-navy">{b.delegateName}</span>
                {b.collegeName ? ` · ${b.collegeName}` : ""} — {b.reason}
              </li>
            ))}
          </ul>
          {plan.blocked.length > 100 && (
            <p className="mt-2 text-[11px] text-navy/50">
              …and {plan.blocked.length - 100} more.
            </p>
          )}
        </details>
      )}
    </div>
  );
}

function Tile({
  label,
  value,
  note,
  alert = false,
}: {
  label: string;
  value: number;
  note: string;
  alert?: boolean;
}) {
  return (
    <div
      className={`bg-white border rounded-lg p-4 ${
        alert ? "border-[#F5A623]/60" : "border-navy/10"
      }`}
    >
      <div className="text-[10px] font-semibold uppercase tracking-widest text-navy/50">
        {label}
      </div>
      <div className="mt-1 text-3xl font-bold text-navy">{value}</div>
      <div className="mt-0.5 text-[11px] text-navy/50">{note}</div>
    </div>
  );
}
