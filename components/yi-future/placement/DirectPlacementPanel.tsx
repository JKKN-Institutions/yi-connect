"use client";

// ═══════════════════════════════════════════════════════════════════════
// Yi-Future — STAFF OVERRIDE panel: place one named student on one named team.
//
// This is the exception, and the screen is built so it always reads as one:
//   • it is COLLAPSED by default and sits BELOW the whole consent flow, so the
//     invitation path is what an admin meets first;
//   • there is no bulk anything — one student, found by typing their name, and
//     one team, chosen by name;
//   • the student must be chosen, the team must be chosen, an acknowledgement
//     naming the consent bypass must be ticked, and THEN a confirmation that
//     names the student and the team must be pressed. Four deliberate acts;
//   • every attempt is recorded before it happens, and the panel says so before
//     and after.
//
// FAILURE PATHS — none of them is a spinner, and none of them is silence:
//   • the action refuses (frozen team, full team, student already placed, log
//     table missing) → red panel with the server's own sentence, which always
//     states whether anything was placed. The acknowledgement is cleared, so a
//     retry is a fresh deliberate act rather than a second click on a hot button.
//   • the request never answers → a 30-second watchdog releases the button and
//     says the placement MAY have happened, with a Reload button, because it may
//     genuinely have gone through on the server.
//   • the placement lands but a follow-up write does not (log could not be marked
//     applied, an invitation could not be closed) → green result plus the caveat
//     spelled out. Never reported as a clean success.
//   • the log table is unreachable → the whole panel is disabled UP FRONT with
//     the reason, instead of letting an admin fill the form and be refused.
//
// There is deliberately NO useEffect in this component: no polling, no
// auto-loading, nothing that could fire an override without a click. The only
// async work is the click handler, and it is wrapped in try/catch/finally with a
// watchdog so the UI is released on every path.
// ═══════════════════════════════════════════════════════════════════════

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { placeDelegateDirectly } from "@/app/yi-future/actions/placement-override";
import { OVERRIDE_REASON_MAX } from "@/lib/yi-future/placement-override";
import {
  describeCallFailure,
  WATCHDOG_OVERRIDE_MS,
  withWatchdog,
} from "@/lib/yi-future/placement-watchdog";
import type {
  OverrideTargets,
  PlacementOverrideResult,
} from "@/lib/yi-future/placement-override";

/** Names shown at once while searching. Chapters run to 1,900 delegates. */
const MATCH_LIMIT = 25;

export function DirectPlacementPanel({
  chapterId,
  targets,
  /** Null ⇒ the log is writable. Non-null ⇒ the reason the override is off. */
  disabledReason,
  recordedCount,
}: {
  chapterId: string;
  targets: OverrideTargets;
  disabledReason: string | null;
  recordedCount: number;
}) {
  const router = useRouter();

  const [query, setQuery] = useState("");
  const [studentId, setStudentId] = useState<string | null>(null);
  const [teamId, setTeamId] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [acknowledged, setAcknowledged] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PlacementOverrideResult | null>(null);

  const student = useMemo(
    () => targets.students.find((s) => s.delegateId === studentId) ?? null,
    [targets.students, studentId]
  );
  const team = useMemo(
    () => targets.teams.find((t) => t.teamId === teamId) ?? null,
    [targets.teams, teamId]
  );

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return targets.students
      .filter((s) =>
        `${s.name} ${s.collegeName ?? ""} ${s.course ?? ""}`
          .toLowerCase()
          .includes(q)
      )
      .slice(0, MATCH_LIMIT);
  }, [query, targets.students]);

  const selectable = targets.teams.filter((t) => t.refusal === null);
  const blockedTeams = targets.teams.filter((t) => t.refusal !== null);

  /** Reset to a clean, un-armed form. Called after every attempt. */
  function disarm() {
    setAcknowledged(false);
    setConfirming(false);
  }

  async function place() {
    if (!student || !team || !acknowledged) {
      // The button is disabled in these states; this is the belt-and-braces
      // branch, and it says which piece is missing rather than doing nothing.
      setError(
        !student
          ? "Pick the student first — nothing was placed."
          : !team
            ? "Pick the team first — nothing was placed."
            : "Tick the acknowledgement first — nothing was placed."
      );
      setConfirming(false);
      return;
    }
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const res = await withWatchdog(
        placeDelegateDirectly({
          chapterId,
          delegateId: student.delegateId,
          teamId: team.teamId,
          reason: reason.trim() || undefined,
          acknowledged: true,
        }),
        WATCHDOG_OVERRIDE_MS
      );
      setResult(res);
      if (res.ok) {
        // Clear the form so the same student cannot be sent twice, and re-read
        // the chapter so they leave the picker and appear in the log below.
        setStudentId(null);
        setTeamId(null);
        setQuery("");
        setReason("");
        router.refresh();
      }
    } catch (e) {
      setError(
        describeCallFailure(
          e,
          `${student.name} may already be on ${team.name}`
        )
      );
    } finally {
      // Always releases the UI — success, refusal, throw or watchdog — and
      // always un-arms, so a retry has to be re-acknowledged.
      setBusy(false);
      disarm();
    }
  }

  return (
    <details className="bg-white border-2 border-[#F5A623]/50 rounded-lg">
      <summary className="px-4 py-3 cursor-pointer">
        <span className="text-sm font-bold text-navy">
          Place one student directly, without waiting for them to accept
        </span>
        <span className="ml-2 text-[11px] font-semibold text-[#B26B00]">
          override · recorded
        </span>
        <p className="mt-1 text-xs text-navy/60">
          The normal way is above: you approve invitations and the student
          accepts. This is the exception — one named student, one named team, and
          the platform writes down who did it.
          {recordedCount > 0 &&
            ` ${recordedCount} placement${recordedCount === 1 ? " has" : "s have"} been recorded this way in this chapter.`}
        </p>
      </summary>

      <div className="px-4 pb-4 space-y-4 border-t border-navy/10 pt-4">
        {/* ─── Switched off (log unavailable) ───────────────────────────── */}
        {disabledReason ? (
          <div className="bg-navy/[0.03] border border-navy/15 rounded-lg p-4">
            <p className="text-sm font-bold text-navy">
              Direct placement is switched off here.
            </p>
            <p className="mt-1 text-xs text-navy/70">{disabledReason}</p>
            <p className="mt-2 text-xs text-navy/70">
              Nothing on this screen is broken by that — the invitation flow
              above works as normal.
            </p>
          </div>
        ) : (
          <>
            <div className="bg-navy/[0.03] border border-navy/15 rounded-lg p-3">
              <p className="text-xs text-navy/80">
                <strong className="text-navy">What gets recorded:</strong> the
                student, the team, your name, the time, and your reason if you
                give one. It stays on this page afterwards and is not deletable
                from the app.
              </p>
              <p className="mt-1 text-xs text-navy/80">
                <strong className="text-navy">Teams cap at{" "}
                {targets.teamSizeMax}</strong>{" "}
                — an override cannot make a team bigger, and a locked team has to
                be unlocked by name first.
              </p>
            </div>

            {/* ─── 1. The student ─────────────────────────────────────── */}
            <div>
              <label
                htmlFor="override-search"
                className="block text-xs font-bold uppercase tracking-widest text-navy/50"
              >
                1. Which student
              </label>
              {targets.students.length === 0 ? (
                /* Not a disabled search box with no explanation: say the reason. */
                <p className="mt-2 text-xs font-semibold text-navy/70">
                  Every active delegate in this chapter is already on a team, so
                  there is nobody to place.
                </p>
              ) : student ? (
                <div className="mt-2 flex flex-wrap items-center gap-3 rounded border-2 border-navy/20 bg-white px-3 py-2">
                  <span className="text-sm font-semibold text-navy">
                    {student.name}
                  </span>
                  <span className="text-[11px] text-navy/60">
                    {student.collegeName ?? "No college on record"}
                    {student.course ? ` · ${student.course}` : ""}
                    {student.yearOfStudy != null
                      ? ` · year ${student.yearOfStudy}`
                      : ""}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setStudentId(null);
                      disarm();
                    }}
                    disabled={busy}
                    className="ml-auto text-xs font-semibold text-navy/60 underline disabled:opacity-50"
                  >
                    Change
                  </button>
                </div>
              ) : (
                <>
                  <input
                    id="override-search"
                    type="search"
                    value={query}
                    onChange={(e) => {
                      setQuery(e.target.value);
                      disarm();
                    }}
                    disabled={busy}
                    placeholder="Type a name to search this chapter's students without a team…"
                    className="mt-2 w-full rounded border border-navy/20 px-3 py-2 text-sm text-navy disabled:opacity-50"
                  />
                  {query.trim() === "" ? (
                    <p className="mt-1 text-[11px] text-navy/50">
                      {targets.students.length} student
                      {targets.students.length === 1 ? "" : "s"} in this chapter
                      are on no team. Search by name — the list is deliberately
                      not shown all at once, because this is a one-student
                      decision.
                    </p>
                  ) : matches.length === 0 ? (
                    <p className="mt-1 text-[11px] font-semibold text-navy/70">
                      No student without a team matches “{query.trim()}”. If they
                      already joined a team they will not be here.
                    </p>
                  ) : (
                    <ul className="mt-2 divide-y divide-navy/5 border border-navy/10 rounded max-h-64 overflow-y-auto">
                      {matches.map((s) => (
                        <li key={s.delegateId}>
                          <button
                            type="button"
                            onClick={() => {
                              setStudentId(s.delegateId);
                              disarm();
                              setResult(null);
                              setError(null);
                            }}
                            disabled={busy}
                            className="w-full text-left px-3 py-2 hover:bg-navy/[0.03] disabled:opacity-50"
                          >
                            <span className="text-sm font-semibold text-navy">
                              {s.name}
                            </span>
                            <span className="ml-2 text-[11px] text-navy/60">
                              {s.collegeName ?? "No college on record"}
                              {s.course ? ` · ${s.course}` : ""}
                            </span>
                            {s.pendingTeamName && (
                              <span className="block text-[11px] font-semibold text-[#B26B00]">
                                Already invited to {s.pendingTeamName} and has
                                not answered
                              </span>
                            )}
                          </button>
                        </li>
                      ))}
                      {matches.length === MATCH_LIMIT && (
                        <li className="px-3 py-2 text-[11px] text-navy/50">
                          Showing the first {MATCH_LIMIT} matches — keep typing
                          to narrow it down.
                        </li>
                      )}
                    </ul>
                  )}
                </>
              )}
            </div>

            {/* ─── 2. The team ────────────────────────────────────────── */}
            {student && (
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-navy/50">
                  2. Which team
                </p>
                {student.pendingTeamName && (
                  <p className="mt-1 text-xs font-semibold text-[#B26B00]">
                    {student.name} is holding an unanswered invitation to{" "}
                    {student.pendingTeamName}. Placing them directly ends that
                    wait — the invitation is closed off and the record notes that
                    one was outstanding.
                  </p>
                )}
                {selectable.length === 0 ? (
                  <p className="mt-2 text-xs font-semibold text-navy/70">
                    No team in this chapter can take a member right now — every
                    one is locked or full. Use the options above to open a seat
                    first.
                  </p>
                ) : (
                  <ul className="mt-2 divide-y divide-navy/5 border border-navy/10 rounded">
                    {selectable.map((t) => {
                      const on = teamId === t.teamId;
                      // After this override the team has one chair fewer. If more
                      // invitations are outstanding than chairs remain, somebody
                      // else's Accept will be refused — said out loud, because
                      // the chapter's over-invitation is not obvious otherwise.
                      const squeezed = t.pendingInvites > t.seatsFree - 1;
                      return (
                        <li
                          key={t.teamId}
                          className="px-3 py-2 flex items-start gap-3"
                        >
                          <input
                            type="radio"
                            name="override-team"
                            id={`override-team-${t.teamId}`}
                            checked={on}
                            onChange={() => {
                              setTeamId(t.teamId);
                              disarm();
                            }}
                            disabled={busy}
                            className="mt-1 h-4 w-4 accent-[#1a1a3e]"
                          />
                          <label
                            htmlFor={`override-team-${t.teamId}`}
                            className="flex-1 cursor-pointer"
                          >
                            <span className="text-sm font-semibold text-navy">
                              {t.name}
                            </span>
                            <span className="ml-2 text-[11px] text-navy/60">
                              {t.members} member{t.members === 1 ? "" : "s"} ·{" "}
                              {t.seatsFree} free chair
                              {t.seatsFree === 1 ? "" : "s"}
                              {t.problemTitle ? ` · ${t.problemTitle}` : ""}
                            </span>
                            {!t.hasLeader && (
                              <span className="block text-[11px] text-navy/60">
                                This team has no captain. That blocks
                                invitations, not a direct placement.
                              </span>
                            )}
                            {squeezed && (
                              <span className="block text-[11px] font-semibold text-[#B26B00]">
                                {t.pendingInvites} unanswered invitation
                                {t.pendingInvites === 1 ? "" : "s"} for{" "}
                                {t.seatsFree} chair
                                {t.seatsFree === 1 ? "" : "s"} — taking one now
                                means one of those students will be refused when
                                they tap Accept.
                              </span>
                            )}
                          </label>
                        </li>
                      );
                    })}
                  </ul>
                )}

                {blockedTeams.length > 0 && (
                  <details className="mt-2">
                    <summary className="text-[11px] font-semibold text-navy/60 cursor-pointer">
                      {blockedTeams.length} team
                      {blockedTeams.length === 1 ? "" : "s"} cannot take a direct
                      placement — see why
                    </summary>
                    <ul className="mt-1 space-y-1">
                      {blockedTeams.map((t) => (
                        <li key={t.teamId} className="text-[11px] text-navy/60">
                          <span className="font-semibold text-navy">
                            {t.name}
                          </span>{" "}
                          — {t.refusal}
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
              </div>
            )}

            {/* ─── 3. Reason + acknowledgement ────────────────────────── */}
            {student && team && (
              <div className="space-y-3">
                <div>
                  <label
                    htmlFor="override-reason"
                    className="block text-xs font-bold uppercase tracking-widest text-navy/50"
                  >
                    3. Why (optional, but recorded)
                  </label>
                  <textarea
                    id="override-reason"
                    value={reason}
                    onChange={(e) => {
                      setReason(e.target.value.slice(0, OVERRIDE_REASON_MAX));
                      disarm();
                    }}
                    disabled={busy}
                    rows={2}
                    placeholder="e.g. asked in person at the chapter meeting; phone unreachable before the deadline"
                    className="mt-2 w-full rounded border border-navy/20 px-3 py-2 text-sm text-navy disabled:opacity-50"
                  />
                  <p className="mt-1 text-[11px] text-navy/50">
                    {reason.trim().length === 0
                      ? "Left blank, the record will show that no reason was given."
                      : `${reason.trim().length} of ${OVERRIDE_REASON_MAX} characters.`}
                  </p>
                </div>

                <label className="flex items-start gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={acknowledged}
                    onChange={(e) => {
                      setAcknowledged(e.target.checked);
                      setConfirming(false);
                    }}
                    disabled={busy}
                    className="mt-0.5 h-4 w-4 accent-[#1a1a3e]"
                  />
                  <span className="text-xs font-semibold text-navy">
                    I am placing {student.name} on {team.name} without their
                    agreement, and I understand this is recorded against my name.
                  </span>
                </label>
              </div>
            )}

            {/* ─── 4. Confirm, naming both ───────────────────────────── */}
            {student && team && (
              <div className="flex flex-wrap items-center gap-3 border-t border-navy/10 pt-3">
                {!acknowledged ? (
                  <p className="text-xs font-semibold text-navy/70">
                    Tick the box above to enable the button. Nothing has been
                    placed.
                  </p>
                ) : confirming ? (
                  <>
                    <p className="text-xs font-semibold text-navy">
                      Place {student.name} on {team.name} now? They have not
                      agreed to it. {team.name} goes from {team.members} to{" "}
                      {team.members + 1} member
                      {team.members + 1 === 1 ? "" : "s"}.
                    </p>
                    <button
                      type="button"
                      onClick={place}
                      disabled={busy}
                      className="px-4 py-2 rounded-md bg-[#B26B00] text-ivory text-sm font-semibold hover:bg-[#8a5300] disabled:opacity-50"
                    >
                      {busy
                        ? "Placing… do not close this tab"
                        : `Yes, place ${student.name} on ${team.name}`}
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
                    disabled={busy}
                    className="px-4 py-2 rounded-md bg-white border-2 border-[#B26B00] text-[#B26B00] text-sm font-semibold hover:bg-[#B26B00]/5 disabled:opacity-40"
                  >
                    Place {student.name} on {team.name}
                  </button>
                )}
              </div>
            )}
          </>
        )}

        {/* ─── Failure / result ───────────────────────────────────────── */}
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
            <p className="mt-1 text-xs text-red-700/80">
              {result.attemptRecorded
                ? "The attempt is in the override log, so it is not lost."
                : "Nothing was recorded, because nothing happened."}
            </p>
            <button
              type="button"
              onClick={() => router.refresh()}
              className="mt-2 text-xs font-semibold underline text-red-700"
            >
              Reload this chapter
            </button>
          </div>
        )}

        {result && result.ok && (
          <div className="bg-white border-2 border-yi-green/40 rounded-lg p-4">
            <p className="text-sm font-bold text-navy">
              {result.delegateName} is now on {result.teamName}.
            </p>
            <p className="mt-1 text-xs text-navy/70">
              Recorded as a direct placement — it is listed below with your name
              on it. They did not accept an invitation.
            </p>
            {result.caveat && (
              <p className="mt-2 text-xs font-semibold text-[#B26B00]">
                {result.caveat}
              </p>
            )}
          </div>
        )}
      </div>
    </details>
  );
}
