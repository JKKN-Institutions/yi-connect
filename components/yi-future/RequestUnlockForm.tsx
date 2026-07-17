"use client";

// Captain-side "Request unlock" form for frozen teams (BUG-494).
// In-app only: the request shows as a banner on the chapter admin's Teams
// pages and auto-clears when the admin unfreezes the team. No email.

import { useState, useTransition } from "react";
import { requestTeamUnlock } from "@/app/yi-future/actions/team-invites";

type Result = { ok: true; message?: string } | { ok: false; error: string };

export function RequestUnlockForm({ teamId }: { teamId: string }) {
  const [reason, setReason] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [pending, startTransition] = useTransition();

  if (result?.ok) {
    return (
      <p className="text-sm font-semibold text-yi-green">
        {result.message ?? "Unlock request sent."}
      </p>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setResult(null);
        startTransition(async () => {
          try {
            setResult(await requestTeamUnlock(teamId, reason));
          } catch {
            setResult({
              ok: false,
              error: "Couldn't send the request — check your connection and try again.",
            });
          }
        });
      }}
      className="space-y-2"
    >
      <textarea
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        required
        maxLength={300}
        rows={2}
        placeholder="Why does the team need to be unlocked? e.g. Need to add one more member"
        className="w-full px-3 py-2 border border-navy/20 rounded-md text-sm"
      />
      <button
        type="submit"
        disabled={pending || !reason.trim()}
        className="px-4 py-2 rounded-md bg-navy text-ivory text-sm font-semibold hover:bg-navy-dark disabled:opacity-50"
      >
        {pending ? "Sending…" : "Request unlock"}
      </button>
      {result && !result.ok && (
        <p className="text-xs font-semibold text-red-600">{result.error}</p>
      )}
    </form>
  );
}
