"use client";

// ═══════════════════════════════════════════════════════════════════════
// Yi-Future — "more students than seats" strategy chooser.
//
// The Director's instruction (2026-08-09) was "show all options on the ui": when
// a chapter has more students than chairs, the platform must NOT pick a rule.
// All four ways out are laid out side by side, each with the real number it
// frees and the real number of students it still cannot seat FOR THE CHAPTER ON
// SCREEN, plus what it costs in words a chapter chair uses.
//
// NOTHING HERE WRITES BY BEING SHOWN OR BY BEING SELECTED.
//   • Selecting an option is a local choice; it unlocks the approve button below
//     and nothing else.
//   • Unlocking teams is its OWN two-step confirmation that NAMES every team,
//     because a locked team locked itself on purpose. It is never folded into
//     the invitation batch and never derived from a count.
//   • Creating teams is its own two-step confirmation.
//   • Neither pre-step sends an invitation. After one runs, the plan re-reads
//     and the reviewer approves the list separately — so "unlock succeeded but
//     the invitation failed" leaves a visible, reversible state (a captain can
//     freeze the team again) instead of a half-applied batch.
//
// FAILURE PATHS (each one visible, none of them a spinner that never ends):
//   • action rejects          → red panel naming the reason + Reload.
//   • action never answers    → watchdog releases the button and says the write
//                               MAY have happened, so reload before retrying.
//   • partly applied          → one result row per team: done / skipped / failed.
//   • plan drifted mid-review → the server re-derives from live data and refuses
//                               with the reason (e.g. the shortfall has closed).
// ═══════════════════════════════════════════════════════════════════════

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  createTeamsForPlacement,
  unlockTeamsForPlacement,
} from "@/app/yi-future/actions/placement";
import {
  describeCallFailure,
  WATCHDOG_STEP_MS,
  withWatchdog,
} from "@/lib/yi-future/placement-watchdog";
import type {
  PlacementStats,
  PlacementStepResult,
  PlacementStrategyId,
  PlacementStrategyOption,
} from "@/lib/yi-future/placement";

type StepKind = "unlock" | "create";

export function StrategyPanel({
  chapterId,
  strategies,
  stats,
  selected,
  onSelect,
}: {
  chapterId: string;
  strategies: PlacementStrategyOption[];
  stats: PlacementStats;
  selected: PlacementStrategyId | null;
  onSelect: (id: PlacementStrategyId) => void;
}) {
  const router = useRouter();

  const unlock = strategies.find((s) => s.id === "unlock_frozen");
  const newTeams = strategies.find((s) => s.id === "new_teams");

  // Pre-tick the smallest set of locked teams that closes the gap. The reviewer
  // can tick more or fewer — nothing is unlocked without their explicit confirm.
  const [unlockPicks, setUnlockPicks] = useState<Set<string>>(
    () =>
      new Set(
        (unlock?.unlockCandidates ?? [])
          .filter((c) => c.neededForGap)
          .map((c) => c.teamId)
      )
  );
  const [confirming, setConfirming] = useState<StepKind | null>(null);
  const [busy, setBusy] = useState<StepKind | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<
    (PlacementStepResult & { kind: StepKind }) | null
  >(null);

  const pickedTeams = useMemo(
    () =>
      (unlock?.unlockCandidates ?? []).filter((c) => unlockPicks.has(c.teamId)),
    [unlock, unlockPicks]
  );
  const pickedSeats = pickedTeams.reduce((n, c) => n + c.seatsFreed, 0);

  function toggleTeam(teamId: string) {
    setUnlockPicks((prev) => {
      const next = new Set(prev);
      if (next.has(teamId)) next.delete(teamId);
      else next.add(teamId);
      return next;
    });
    setConfirming(null);
  }

  /** One code path for both pre-steps: watchdog, per-row result, always released. */
  async function runStep(kind: StepKind) {
    setBusy(kind);
    setError(null);
    setResult(null);
    try {
      const res = await withWatchdog(
        kind === "unlock"
          ? unlockTeamsForPlacement(
              chapterId,
              pickedTeams.map((c) => c.teamId)
            )
          : createTeamsForPlacement(chapterId, newTeams?.newTeamCount ?? 0),
        WATCHDOG_STEP_MS
      );
      setResult({ ...res, kind });
      // Re-read the chapter so the suggestion list below reflects the new seats.
      if (res.ok && res.done > 0) router.refresh();
    } catch (e) {
      setError(
        describeCallFailure(
          e,
          kind === "unlock"
            ? "Some teams may already have been unlocked"
            : "Some teams may already have been created"
        )
      );
    } finally {
      // Releases the UI on success, failure and timeout alike.
      setBusy(null);
      setConfirming(null);
    }
  }

  const shortfall = Math.max(0, stats.unteamed - stats.openSeatsPhysical);

  return (
    <section className="space-y-4">
      <div>
        <h3 className="text-lg font-bold text-navy">
          {shortfall > 0
            ? `${shortfall} student${shortfall === 1 ? "" : "s"} have no chair in this chapter — choose how to handle it`
            : "Every student has a chair — choose how you want to proceed"}
        </h3>
        {/* The basis is stated because the two honest ways to count give
            different answers, and a chapter chair must not have to guess which
            one a number came from. */}
        <p className="mt-1 text-sm text-navy/60">
          Counted as chairs: {stats.unteamed} student
          {stats.unteamed === 1 ? "" : "s"} with no team against{" "}
          {stats.openSeatsPhysical} free seat
          {stats.openSeatsPhysical === 1 ? "" : "s"} in unlocked teams, at{" "}
          {stats.teamSizeMax} per team.
          {stats.pendingInvites > 0 && (
            <>
              {" "}
              Unanswered invitations are not counted as chairs — this chapter has{" "}
              {stats.pendingInvites} of them for {stats.openSeatsPhysical} chair
              {stats.openSeatsPhysical === 1 ? "" : "s"}.
            </>
          )}
        </p>
        <p className="mt-1 text-sm font-semibold text-navy">
          Nothing is written by picking an option. Every option below still ends
          with you approving a list of invitations.
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {strategies.map((s) => {
          const on = selected === s.id;
          return (
            <div
              key={s.id}
              className={`rounded-lg border-2 p-4 flex flex-col ${
                !s.available
                  ? "border-navy/10 bg-navy/[0.03]"
                  : on
                    ? "border-navy bg-white"
                    : "border-navy/15 bg-white"
              }`}
            >
              <div className="text-sm font-bold text-navy">{s.title}</div>

              <div className="mt-3 flex items-baseline gap-2">
                <span
                  className={`text-3xl font-bold ${
                    s.wouldRemain > 0 ? "text-[#F5A623]" : "text-yi-green"
                  }`}
                >
                  {s.wouldRemain}
                </span>
                <span className="text-[11px] font-semibold text-navy/60">
                  still without a team
                </span>
              </div>
              <div className="mt-0.5 text-[11px] text-navy/50">
                {s.seats} seat{s.seats === 1 ? "" : "s"} available · seats{" "}
                {s.wouldSeat} of {stats.unteamed} student
                {stats.unteamed === 1 ? "" : "s"}
              </div>

              <ul className="mt-3 space-y-1 flex-1">
                {s.detail.map((d) => (
                  <li key={d} className="text-[11px] text-navy/70">
                    • {d}
                  </li>
                ))}
              </ul>

              <div className="mt-3 pt-3 border-t border-navy/10">
                <div className="text-[10px] font-bold uppercase tracking-widest text-navy/40">
                  What it costs
                </div>
                <p className="mt-1 text-[11px] text-navy/70">{s.cost}</p>
              </div>

              {s.available ? (
                <label className="mt-3 flex items-start gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="placement-strategy"
                    checked={on}
                    onChange={() => {
                      onSelect(s.id);
                      setConfirming(null);
                      setResult(null);
                      setError(null);
                    }}
                    disabled={busy !== null}
                    className="mt-0.5 h-4 w-4 accent-[#1a1a3e]"
                  />
                  <span className="text-xs font-semibold text-navy">
                    {on ? "Chosen" : "Choose this"}
                  </span>
                </label>
              ) : (
                <div className="mt-3 rounded border border-navy/15 bg-white p-2">
                  <div className="text-[10px] font-bold uppercase tracking-widest text-red-700/70">
                    Not available
                  </div>
                  <p className="mt-1 text-[11px] text-navy/70">
                    {s.unavailableReason}
                  </p>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ─── Failure / result, shared by both pre-steps ─────────────────── */}
      {error && (
        <div className="bg-red-50 border-2 border-red-300 rounded-lg p-4">
          <p className="text-sm font-bold text-red-700">{error}</p>
          <button
            type="button"
            onClick={() => router.refresh()}
            className="mt-2 text-xs font-semibold underline text-red-700"
          >
            Reload this chapter
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
              {result.kind === "unlock"
                ? `${result.done} team${result.done === 1 ? "" : "s"} unlocked`
                : `${result.done} team${result.done === 1 ? "" : "s"} created`}
              {result.skipped > 0 && ` · ${result.skipped} skipped`}
              {result.failed > 0 && ` · ${result.failed} failed`}
            </p>
            {/* The one thing the reviewer must not assume. */}
            <p className="mt-0.5 text-xs text-navy/70">
              No invitation has been sent by this step. Approve the list below to
              invite anyone.
              {result.failed > 0 &&
                result.kind === "unlock" &&
                " The teams that failed are still locked."}
              {result.done > 0 &&
                result.kind === "unlock" &&
                " If you change your mind, each team's captain can freeze it again from their own team page."}
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
                    r.status === "done"
                      ? "text-yi-green"
                      : r.status === "skipped"
                        ? "text-navy/50"
                        : "text-red-600"
                  }`}
                >
                  {r.status === "done"
                    ? "✓ done"
                    : r.status === "skipped"
                      ? "– skipped"
                      : "✕ failed"}
                </span>
                <span className="font-semibold text-navy">{r.label}</span>
                <span className="text-navy/60">{r.detail}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* ─── Chosen: unlock locked teams ───────────────────────────────── */}
      {selected === "unlock_frozen" && unlock && (
        <div className="bg-white border-2 border-navy/20 rounded-lg p-4 space-y-3">
          <div>
            <p className="text-sm font-bold text-navy">
              Which locked teams should be unlocked?
            </p>
            <p className="mt-1 text-xs text-navy/70">
              Each of these teams pressed Freeze itself. Unlocking re-opens it to
              new members — tell the team before you do it. Every team is named
              here; nothing is unlocked from a count.
            </p>
          </div>

          <ul className="divide-y divide-navy/5 border border-navy/10 rounded">
            {unlock.unlockCandidates.map((c) => (
              <li key={c.teamId} className="px-3 py-2 flex items-center gap-3">
                <input
                  type="checkbox"
                  id={`unlock-${c.teamId}`}
                  checked={unlockPicks.has(c.teamId)}
                  onChange={() => toggleTeam(c.teamId)}
                  disabled={busy !== null}
                  className="h-4 w-4 accent-[#1a1a3e]"
                />
                <label
                  htmlFor={`unlock-${c.teamId}`}
                  className="flex-1 cursor-pointer"
                >
                  <span className="text-sm font-semibold text-navy">
                    {c.teamName}
                  </span>
                  <span className="ml-2 text-[11px] text-navy/60">
                    {c.members} member{c.members === 1 ? "" : "s"} · frees{" "}
                    {c.seatsFreed} seat{c.seatsFreed === 1 ? "" : "s"}
                  </span>
                  {c.neededForGap && (
                    <span className="ml-2 text-[10px] font-bold uppercase tracking-widest text-navy/40">
                      needed to close the gap
                    </span>
                  )}
                </label>
              </li>
            ))}
          </ul>

          <div className="flex flex-wrap items-center gap-3">
            {pickedTeams.length === 0 ? (
              <p className="text-xs font-semibold text-navy/60">
                No team ticked — nothing will be unlocked.
              </p>
            ) : confirming === "unlock" ? (
              <>
                <p className="text-xs font-semibold text-navy">
                  Unlock {pickedTeams.length} team
                  {pickedTeams.length === 1 ? "" : "s"} — {pickedTeams
                    .map((c) => c.teamName)
                    .join(", ")}
                  ? This frees {pickedSeats} seat
                  {pickedSeats === 1 ? "" : "s"} and cancels each team&apos;s own
                  decision to lock. No invitation is sent by this.
                </p>
                <button
                  type="button"
                  onClick={() => runStep("unlock")}
                  disabled={busy !== null}
                  className="px-4 py-2 rounded-md bg-navy text-ivory text-sm font-semibold hover:bg-navy-dark disabled:opacity-50"
                >
                  {busy === "unlock"
                    ? "Unlocking… do not close this tab"
                    : `Yes, unlock ${pickedTeams.length}`}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirming(null)}
                  disabled={busy !== null}
                  className="text-xs font-semibold text-navy/60 underline disabled:opacity-50"
                >
                  Cancel
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => setConfirming("unlock")}
                disabled={busy !== null}
                className="px-4 py-2 rounded-md bg-navy text-ivory text-sm font-semibold hover:bg-navy-dark disabled:opacity-40"
              >
                Unlock {pickedTeams.length} team
                {pickedTeams.length === 1 ? "" : "s"} ({pickedSeats} seat
                {pickedSeats === 1 ? "" : "s"})
              </button>
            )}
          </div>
        </div>
      )}

      {/* ─── Chosen: create new teams ──────────────────────────────────── */}
      {selected === "new_teams" && newTeams && (
        <div className="bg-white border-2 border-navy/20 rounded-lg p-4 space-y-3">
          <div>
            <p className="text-sm font-bold text-navy">
              Create {newTeams.newTeamCount} new team
              {newTeams.newTeamCount === 1 ? "" : "s"}?
            </p>
            <p className="mt-1 text-xs text-navy/70">
              They are named after this chapter and numbered. One student with no
              chair is set as each team&apos;s leader so invitations can be sent
              from it — they are invited like everybody else and join only when
              they accept. Creating a team sends no invitation.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {confirming === "create" ? (
              <>
                <p className="text-xs font-semibold text-navy">
                  Create {newTeams.newTeamCount} empty team
                  {newTeams.newTeamCount === 1 ? "" : "s"}? If nobody accepts,
                  you will have to delete them.
                </p>
                <button
                  type="button"
                  onClick={() => runStep("create")}
                  disabled={busy !== null}
                  className="px-4 py-2 rounded-md bg-navy text-ivory text-sm font-semibold hover:bg-navy-dark disabled:opacity-50"
                >
                  {busy === "create"
                    ? "Creating… do not close this tab"
                    : `Yes, create ${newTeams.newTeamCount}`}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirming(null)}
                  disabled={busy !== null}
                  className="text-xs font-semibold text-navy/60 underline disabled:opacity-50"
                >
                  Cancel
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => setConfirming("create")}
                disabled={busy !== null}
                className="px-4 py-2 rounded-md bg-navy text-ivory text-sm font-semibold hover:bg-navy-dark disabled:opacity-40"
              >
                Create {newTeams.newTeamCount} team
                {newTeams.newTeamCount === 1 ? "" : "s"}
              </button>
            )}
          </div>
        </div>
      )}

      {/* ─── Chosen: leave them out ────────────────────────────────────── */}
      {selected === "leave_unteamed" && (
        <div className="bg-white border-2 border-navy/20 rounded-lg p-4">
          <p className="text-sm font-bold text-navy">
            {shortfall > 0
              ? `${shortfall} student${shortfall === 1 ? "" : "s"} will stay without a team.`
              : "Nothing is left over — no student is being left out."}
          </p>
          <p className="mt-1 text-xs text-navy/70">
            Nothing is unlocked and no team is created. You can still approve the
            invitations below for the students who do fit. The students left out
            are named at the bottom of this page — nobody is told automatically.
          </p>
        </div>
      )}
    </section>
  );
}
