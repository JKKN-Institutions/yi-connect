"use client";

// Per-team unlocking from the chapter Teams list (field request 2026-08-10),
// alongside the existing "Unlock all (N)".
//
// Why a panel rather than a button on each team card: the cards are wrapped in
// a <Link> to the team page, so a nested <button> would be invalid markup and
// would fight the card's own click. Listing only the LOCKED teams here also
// answers the question the admin actually has — "which ones are locked?" —
// without making them scan every card.
//
// Each row calls the existing unfreezeTeam(), which is already chapter-scoped
// and already auto-resolves that team's open unlock request.

import { useState, useTransition } from "react";
import { unfreezeTeam } from "@/app/yi-future/actions/team-invites";

type LockedTeam = { id: string; team_name: string };

export function LockedTeamsPanel({ teams }: { teams: LockedTeam[] }) {
  // Teams unlocked in this render pass, so a row disappears the moment it
  // succeeds instead of waiting for a refresh.
  const [done, setDone] = useState<Set<string>>(new Set());
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const remaining = teams.filter((t) => !done.has(t.id));
  if (remaining.length === 0) return null;

  function unlock(id: string) {
    setBusyId(id);
    setErrors((e) => {
      const next = { ...e };
      delete next[id];
      return next;
    });
    startTransition(async () => {
      try {
        const res = await unfreezeTeam(id);
        if (res.ok) {
          setDone((d) => new Set(d).add(id));
        } else {
          setErrors((e) => ({ ...e, [id]: res.error }));
        }
      } catch {
        // A thrown action must never look like it worked.
        setErrors((e) => ({
          ...e,
          [id]: "Couldn't unlock — check your connection and try again.",
        }));
      } finally {
        setBusyId(null);
      }
    });
  }

  return (
    <details className="bg-white border border-navy/10 rounded-lg p-4">
      <summary className="cursor-pointer text-sm font-bold text-navy">
        🔒 {remaining.length} locked team{remaining.length === 1 ? "" : "s"}
        <span className="ml-2 font-normal text-xs text-navy/50">
          — unlock individually
        </span>
      </summary>

      <p className="mt-2 text-xs text-navy/50">
        A team locks itself when its captain marks it final. Unlocking lets them
        change members again.
      </p>

      <ul className="mt-3 space-y-1.5">
        {remaining.map((t) => (
          <li
            key={t.id}
            className="flex items-center justify-between gap-3 border-t border-navy/10 pt-1.5"
          >
            <span className="text-sm text-navy truncate">{t.team_name}</span>
            <span className="flex items-center gap-2 shrink-0">
              {errors[t.id] && (
                <span className="text-[11px] text-red-600">{errors[t.id]}</span>
              )}
              <button
                type="button"
                onClick={() => unlock(t.id)}
                disabled={pending && busyId === t.id}
                className="text-xs font-semibold text-navy hover:text-yi-gold border border-navy/20 rounded px-3 py-1.5 disabled:opacity-40"
              >
                {pending && busyId === t.id ? "Unlocking…" : "Unlock"}
              </button>
            </span>
          </li>
        ))}
      </ul>
    </details>
  );
}
