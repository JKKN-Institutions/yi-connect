"use client";

// Chapter-admin "unlock every locked team" control on /yi-future/chapter/teams
// (field request 2026-08-10). Freezing is a CAPTAIN's own "our team is final"
// declaration, so this reverses all of them in one go — hence:
//   - the count is on the button itself, so the blast radius is visible BEFORE
//     the first click, not confessed afterwards
//   - a second, differently-worded click is required to actually run it
//   - it renders nothing at all when there is nothing to unlock
//
// Deliberately not window.confirm(): a native dialog blocks the page and reads
// as a browser warning rather than part of the admin UI.

import { useState, useTransition } from "react";
import { unfreezeAllTeams } from "@/app/yi-future/actions/team-invites";

type Result = { ok: true; message?: string } | { ok: false; error: string };

export function UnlockAllTeamsButton({ frozenCount }: { frozenCount: number }) {
  const [armed, setArmed] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [pending, startTransition] = useTransition();

  if (frozenCount < 1 && !result) return null;

  if (result) {
    return (
      <p
        className={
          result.ok
            ? "text-xs font-semibold text-yi-green"
            : "text-xs font-semibold text-red-600"
        }
      >
        {result.ok ? (result.message ?? "Teams unlocked.") : result.error}
      </p>
    );
  }

  function run() {
    setResult(null);
    startTransition(async () => {
      try {
        setResult(await unfreezeAllTeams());
      } catch {
        // A thrown action (flaky network, mid-deploy version skew) must never
        // look like it worked.
        setResult({
          ok: false,
          error: "Couldn't unlock the teams — check your connection and try again.",
        });
      }
    });
  }

  if (!armed) {
    return (
      <button
        type="button"
        onClick={() => setArmed(true)}
        className="text-xs font-semibold text-navy hover:text-yi-gold border border-navy/20 rounded px-3 py-1.5 inline-flex items-center gap-1.5"
      >
        <span>🔓</span> Unlock all ({frozenCount})
      </button>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5">
      <button
        type="button"
        onClick={run}
        disabled={pending}
        className="text-xs font-bold text-navy bg-[#F5A623] hover:bg-[#F5A623]/90 rounded px-3 py-1.5 disabled:opacity-40"
      >
        {pending
          ? "Unlocking…"
          : `Yes, unlock ${frozenCount} team${frozenCount === 1 ? "" : "s"}`}
      </button>
      <button
        type="button"
        onClick={() => setArmed(false)}
        disabled={pending}
        className="text-xs font-semibold text-navy/60 hover:text-navy px-2 py-1.5"
      >
        Cancel
      </button>
    </span>
  );
}
