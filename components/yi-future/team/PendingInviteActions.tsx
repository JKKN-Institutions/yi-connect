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
 * FAILURE PATH is the whole point of this component. Three distinct failures
 * are each given their own visible outcome, because a spinner that never ends
 * is a bug:
 *   1. THROWS   — network drop / server 500 → caught, plain-English line + Reload.
 *   2. HANGS    — no response at all → a watchdog releases the UI after
 *                 WATCHDOG_MS with "we can't confirm this finished" + Reload.
 *                 The button is never left spinning forever.
 *   3. HALF-DONE— the action returns ok:false because the world moved
 *                 (invite cancelled, team filled up, student joined a team by
 *                 another route). Raw Postgres constraint text is translated to
 *                 a sentence a 17-year-old can act on, and Reload is offered so
 *                 they can see the real current state.
 * A late reply always wins over the watchdog message — good or bad news beats
 * "we don't know".
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { respondInvite } from "@/app/yi-future/actions/team-invites";

type Result = { ok: true; message?: string } | { ok: false; error: string };

/** How long we wait for respondInvite before we stop claiming to be busy. */
const WATCHDOG_MS = 12_000;

/**
 * respondInvite surfaces `insErr.message` straight from Postgres when the
 * one-team-per-edition unique index rejects the join. That reads
 * "duplicate key value violates unique constraint uniq_delegate_per_edition"
 * — useless to a student. Translate the ones we can recognise; pass anything
 * already-plain through untouched.
 */
function humanise(raw: string): string {
  const s = raw.toLowerCase();
  if (
    s.includes("uniq_delegate_per_edition") ||
    s.includes("duplicate key") ||
    s.includes("already on another team")
  ) {
    return "You're already on a team, so this invitation can't be accepted. Reload to see your team.";
  }
  if (s.includes("no longer pending")) {
    return "This invitation was withdrawn or already answered. Reload to see your current invitations.";
  }
  if (s.includes("not addressed to you")) {
    return "This invitation isn't yours to answer. Reload the page.";
  }
  if (s.includes("permission") || s.includes("jwt") || s.includes("row-level")) {
    return "Your sign-in seems to have expired. Reload the page and enter your access code again.";
  }
  return raw;
}

export function PendingInviteActions({
  inviteId,
  canAccept,
}: {
  inviteId: string;
  /** false when the team is frozen or already full — no Accept button is drawn. */
  canAccept: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<null | "accepted" | "declined">(null);
  const [result, setResult] = useState<Result | null>(null);
  const [unconfirmed, setUnconfirmed] = useState(false);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const aliveRef = useRef(true);

  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const run = useCallback(
    async (response: "accepted" | "declined") => {
      if (busy) return; // no double-submit
      setBusy(response);
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
        res = await respondInvite(inviteId, response);
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
      setResult(res.ok ? res : { ok: false, error: humanise(res.error) });

      if (res.ok) {
        // Re-render the server banner: an accepted invite makes it disappear and
        // the team card take its place; a declined one drops off the list.
        router.refresh();
      }
    },
    [busy, inviteId, router]
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
        {canAccept && (
          <button
            type="button"
            onClick={() => run("accepted")}
            disabled={busy !== null}
            className="px-4 py-2 rounded-md bg-yi-green text-ivory text-sm font-bold hover:opacity-90 disabled:opacity-60 disabled:cursor-wait"
          >
            {busy === "accepted" ? "Joining…" : "Accept & join"}
          </button>
        )}
        <button
          type="button"
          onClick={() => run("declined")}
          disabled={busy !== null}
          className="px-3 py-2 rounded-md border border-navy/25 text-navy text-sm font-semibold hover:bg-navy/5 disabled:opacity-60 disabled:cursor-wait"
        >
          {busy === "declined" ? "Declining…" : "Decline"}
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
    </div>
  );
}
