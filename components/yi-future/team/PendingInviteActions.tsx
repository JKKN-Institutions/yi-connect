"use client";

/**
 * Accept / Decline buttons for one pending team invitation, shown inside the
 * dashboard reminder banner (PendingInviteAlert).
 *
 * Calls the EXISTING `respondInvite` server action — the same one the
 * /yi-future/me/team/invites page uses. No parallel accept logic lives here:
 * respondInvite already re-checks expiry, frozen, team size and the
 * one-team-per-delegate unique index, and already auto-declines the delegate's
 * other pending invites when one is accepted.
 *
 * FAILURE PATH is the whole point of this component. Each distinct failure is
 * given its own visible outcome, because a spinner that never ends is a bug:
 *   1. THROWS   — network drop / server 500 → caught, plain-English line + Reload.
 *   2. HANGS    — no response at all → a watchdog releases the UI after
 *                 WATCHDOG_MS with "we can't confirm this finished" + Reload.
 *                 The button is never left spinning forever.
 *   3. HALF-DONE— the action returns ok:false because the world moved
 *                 (invite cancelled, student joined a team by another route).
 *                 Raw Postgres constraint text is translated to a sentence a
 *                 17-year-old can act on, and Reload is offered so they can see
 *                 the real current state.
 *   4. TEAM FULL— treated separately from every other ok:false, because it is
 *                 the failure this feature will actually cause at scale and it
 *                 has a real next step. See below.
 * A late reply always wins over the watchdog message — good or bad news beats
 * "we don't know".
 *
 * WHY "TEAM FULL" GETS ITS OWN TREATMENT: the reminder banner makes a whole
 * chapter act at once. Erode holds 141 live pending invitations across 93
 * students against 106 open seats in 43 teams — enough room, but only just, and
 * seats go first-come. Teams will fill while another student is mid-tap.
 * The director's call was "honest message plus their other options": say the
 * team is full, then re-read from the server what this student is STILL holding
 * and offer those as one-tap choices. A dead end must become a next step.
 *
 * Two things that treatment must never do, both handled here:
 *   - Offer an alternative from a stale client-side list. The list is re-read
 *     server-side on every failure, because the whole premise is that the
 *     situation changed seconds ago.
 *   - Offer an invitation that is ALSO full, or one respondInvite deliberately
 *     auto-declined when an accept succeeded. The server action filters on live
 *     capacity and on status = 'pending', and writes nothing.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { respondInvite } from "@/app/yi-future/actions/team-invites";
import { getRemainingInviteOptions } from "@/app/yi-future/actions/pending-invite-options";
import {
  humanise,
  isTeamFullError,
  type RemainingInvitesResult,
} from "@/lib/yi-future/invite-options";

type Result = { ok: true; message?: string } | { ok: false; error: string };

/** State of the "here are your other options" re-read. */
type OptionsState =
  | { phase: "loading" }
  | { phase: "loaded"; data: Extract<RemainingInvitesResult, { ok: true }> }
  | { phase: "failed"; error: string }
  /** The re-read itself hung — never leave this as a silent spinner either. */
  | { phase: "unconfirmed" };

/** How long we wait for a server action before we stop claiming to be busy. */
const WATCHDOG_MS = 12_000;

const NAVY = "#1a1a3e";
const GOLD = "#F5A623";
const WARN = "#B45309";

export function PendingInviteActions({
  inviteId,
  canAccept,
  teamName,
}: {
  inviteId: string;
  /** false when the team is frozen or already full — no Accept button is drawn. */
  canAccept: boolean;
  /** Named back to the student if this team turns out to be full. */
  teamName?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<null | {
    id: string;
    kind: "accepted" | "declined";
  }>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [unconfirmed, setUnconfirmed] = useState(false);
  /** Set once an Accept has lost the race for the last seat. */
  const [filledUp, setFilledUp] = useState<{ teamName: string | null } | null>(
    null
  );
  /** Invitations proven to be dead ends. Never offered back to the student. */
  const [deadIds, setDeadIds] = useState<string[]>([]);
  const [options, setOptions] = useState<OptionsState | null>(null);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const optTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const aliveRef = useRef(true);

  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
      if (timerRef.current) clearTimeout(timerRef.current);
      if (optTimerRef.current) clearTimeout(optTimerRef.current);
    };
  }, []);

  /**
   * Re-read the invitations still open to this student. Same watchdog contract
   * as the accept itself: this must never sit as an unexplained spinner, so a
   * hang resolves to an explicit "we couldn't check" with a retry, and a late
   * real answer still wins over that message.
   */
  const loadOptions = useCallback(async (dead: string[]) => {
    setOptions({ phase: "loading" });

    if (optTimerRef.current) clearTimeout(optTimerRef.current);
    optTimerRef.current = setTimeout(() => {
      if (!aliveRef.current) return;
      setOptions({ phase: "unconfirmed" });
    }, WATCHDOG_MS);

    let res: RemainingInvitesResult;
    try {
      res = await getRemainingInviteOptions(dead);
    } catch {
      res = {
        ok: false,
        error:
          "We couldn't reach the server to check your other invitations.",
      };
    }

    if (optTimerRef.current) {
      clearTimeout(optTimerRef.current);
      optTimerRef.current = null;
    }
    if (!aliveRef.current) return;

    setOptions(
      res.ok
        ? { phase: "loaded", data: res }
        : { phase: "failed", error: humanise(res.error) }
    );
  }, []);

  const run = useCallback(
    async (
      response: "accepted" | "declined",
      /** Which invitation — the banner's own, or one of the offered options. */
      targetId: string,
      targetName?: string
    ) => {
      if (busy) return; // no double-submit
      setBusy({ id: targetId, kind: response });
      setResult(null);
      setUnconfirmed(false);

      // WATCHDOG — a hang must not leave the student staring at a spinner.
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        if (!aliveRef.current) return;
        setBusy(null);
        setUnconfirmed(true);
      }, WATCHDOG_MS);

      let res: Result;
      try {
        res = await respondInvite(targetId, response);
      } catch {
        // THROWS — network dropped, server 500, action rejected.
        res = {
          ok: false,
          error:
            "That didn't go through — check your internet and try again. Nothing was changed.",
        };
      }

      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      if (!aliveRef.current) return;

      // A real reply always beats the watchdog's "we don't know".
      setUnconfirmed(false);
      setBusy(null);

      if (res.ok) {
        setResult(res);
        // Re-render the server banner: an accepted invite makes it disappear and
        // the team card take its place; a declined one drops off the list.
        router.refresh();
        return;
      }

      // THE RACE WE EXPECT AT SCALE: the last seat went to someone else while
      // this student was tapping. Only this failure gets "here are your other
      // options" — every other refusal (locked team, expired invite, already on
      // a team, withdrawn invite, network) keeps the plain one-line treatment,
      // because offering alternatives would paper over a different problem.
      if (isTeamFullError(res.error)) {
        const nextDead = deadIds.includes(targetId)
          ? deadIds
          : [...deadIds, targetId];
        setDeadIds(nextDead);
        setFilledUp({ teamName: targetName ?? null });
        setResult(null);
        void loadOptions(nextDead);
        return;
      }

      setResult({ ok: false, error: humanise(res.error) });
    },
    [busy, deadIds, loadOptions, router]
  );

  if (result?.ok) {
    return (
      <p className="pt-1 text-sm font-semibold text-yi-green" role="status">
        {result.message ?? "Done."}
      </p>
    );
  }

  return (
    <div className="pt-1 space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        {/* Once this invitation is known to be full, its Accept button is gone —
            re-offering it would just repeat the same failure. Decline stays, so
            the student can still free the seat request for the inviter. */}
        {canAccept && !deadIds.includes(inviteId) && (
          <button
            type="button"
            onClick={() => run("accepted", inviteId, teamName)}
            disabled={busy !== null}
            className="px-4 py-2 rounded-md bg-yi-green text-ivory text-sm font-bold hover:opacity-90 disabled:opacity-60 disabled:cursor-wait"
          >
            {busy?.id === inviteId && busy.kind === "accepted"
              ? "Joining…"
              : "Accept & join"}
          </button>
        )}
        <button
          type="button"
          onClick={() => run("declined", inviteId, teamName)}
          disabled={busy !== null}
          className="px-3 py-2 rounded-md border border-navy/25 text-navy text-sm font-semibold hover:bg-navy/5 disabled:opacity-60 disabled:cursor-wait"
        >
          {busy?.id === inviteId && busy.kind === "declined"
            ? "Declining…"
            : "Decline"}
        </button>
      </div>

      {unconfirmed && (
        <p className="text-xs font-semibold text-yi-saffron" role="alert">
          Still no answer from the server — we can&apos;t confirm whether this
          went through.{" "}
          <button
            type="button"
            onClick={() => router.refresh()}
            className="underline font-bold"
          >
            Reload to check
          </button>
        </p>
      )}

      {result && !result.ok && (
        <p className="text-xs font-semibold text-red-600" role="alert">
          {result.error}{" "}
          <button
            type="button"
            onClick={() => router.refresh()}
            className="underline font-bold"
          >
            Reload
          </button>
        </p>
      )}

      {/* TEAM FILLED UP MID-TAP — honest message, then their real options. */}
      {filledUp && (
        <div
          className="rounded-lg border p-3"
          style={{ borderColor: `${GOLD}66`, background: "#FFF8EC" }}
        >
          <p
            className="text-xs font-bold"
            style={{ color: NAVY }}
            role="alert"
          >
            {filledUp.teamName
              ? `“${filledUp.teamName}” is full now`
              : "That team is full now"}{" "}
            — the last seat went to someone else while you were tapping, so you
            weren&apos;t added. Nothing else about your account changed.
          </p>

          {options?.phase === "loading" && (
            <p className="mt-2 text-xs text-navy/60" role="status">
              Checking which of your other invitations still have room…
            </p>
          )}

          {/* The re-read hung. Say so and offer a retry — never a bare spinner. */}
          {options?.phase === "unconfirmed" && (
            <p
              className="mt-2 text-xs font-semibold"
              style={{ color: WARN }}
              role="alert"
            >
              We couldn&apos;t check your other invitations in time.{" "}
              <button
                type="button"
                onClick={() => loadOptions(deadIds)}
                className="underline font-bold"
              >
                Try again
              </button>{" "}
              ·{" "}
              <Link
                href="/yi-future/me/team/invites"
                className="underline font-bold"
              >
                See all my invitations
              </Link>
            </p>
          )}

          {/* The re-read failed outright (network, sign-in expired, DB error). */}
          {options?.phase === "failed" && (
            <p
              className="mt-2 text-xs font-semibold"
              style={{ color: WARN }}
              role="alert"
            >
              {options.error}{" "}
              <button
                type="button"
                onClick={() => loadOptions(deadIds)}
                className="underline font-bold"
              >
                Try again
              </button>{" "}
              ·{" "}
              <Link
                href="/yi-future/me/team/invites"
                className="underline font-bold"
              >
                See all my invitations
              </Link>
            </p>
          )}

          {options?.phase === "loaded" && options.data.alreadyOnTeam && (
            <p
              className="mt-2 text-xs font-semibold text-yi-green"
              role="status"
            >
              Good news — you&apos;re on a team after all.{" "}
              <button
                type="button"
                onClick={() => router.refresh()}
                className="underline font-bold"
              >
                Reload to see it
              </button>
            </p>
          )}

          {options?.phase === "loaded" &&
            !options.data.alreadyOnTeam &&
            options.data.options.length > 0 && (
              <div className="mt-2 space-y-2">
                <p className="text-xs font-bold" style={{ color: NAVY }}>
                  {options.data.options.length === 1
                    ? "You still hold this invitation — accept it instead:"
                    : "You still hold these invitations — accept one instead:"}
                </p>
                <ul className="space-y-2">
                  {options.data.options.map((opt) => (
                    <li
                      key={opt.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-md border bg-white px-3 py-2"
                      style={{ borderColor: `${NAVY}1f` }}
                    >
                      <span className="text-xs" style={{ color: NAVY }}>
                        <span className="font-bold">{opt.teamName}</span>
                        {opt.inviterName ? (
                          <> · invited by {opt.inviterName}</>
                        ) : null}
                        {" · "}
                        {opt.seatsLeft} seat
                        {opt.seatsLeft === 1 ? "" : "s"} left
                      </span>
                      <button
                        type="button"
                        onClick={() => run("accepted", opt.id, opt.teamName)}
                        disabled={busy !== null}
                        className="px-3 py-1.5 rounded-md bg-yi-green text-ivory text-xs font-bold hover:opacity-90 disabled:opacity-60 disabled:cursor-wait"
                      >
                        {busy?.id === opt.id && busy.kind === "accepted"
                          ? "Joining…"
                          : "Accept & join"}
                      </button>
                    </li>
                  ))}
                </ul>
                {options.data.blockedCount > 0 && (
                  <p className="text-xs text-navy/60">
                    Your other {options.data.blockedCount} invitation
                    {options.data.blockedCount === 1 ? " is" : "s are"} full or
                    locked, so they aren&apos;t listed here.
                  </p>
                )}
              </div>
            )}

          {/* No alternative at all. This is the MAJORITY case in Erode — 51 of
              93 students hold exactly one invitation — so it has to be an
              honest next step, not an empty list. */}
          {options?.phase === "loaded" &&
            !options.data.alreadyOnTeam &&
            options.data.options.length === 0 && (
              <div className="mt-2 space-y-1.5">
                <p className="text-xs font-semibold" style={{ color: NAVY }}>
                  {options.data.blockedCount > 0
                    ? `Your other ${options.data.blockedCount} invitation${
                        options.data.blockedCount === 1 ? " is" : "s are"
                      } full or locked too, so there is nothing left to accept.`
                    : "That was the only invitation you were holding, so there is nothing else to accept."}
                </p>
                <p className="text-xs text-navy/70">
                  You can{" "}
                  <Link
                    href="/yi-future/me/team"
                    className="underline font-bold"
                    style={{ color: NAVY }}
                  >
                    start your own team
                  </Link>{" "}
                  and invite others, or ask your chapter admin to place you in a
                  team.
                </p>
              </div>
            )}
        </div>
      )}
    </div>
  );
}
