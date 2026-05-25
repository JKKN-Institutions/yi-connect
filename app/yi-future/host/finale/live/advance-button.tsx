"use client";

import { useTransition } from "react";
import { markTeamAdvanced } from "@/app/yi-future/actions/finale";

export function AdvanceTeamButton({
  teamId,
  teamName,
  currentStatus,
}: {
  teamId: string;
  teamName: string;
  currentStatus: string;
}) {
  const [isPending, startTransition] = useTransition();

  if (currentStatus === "national_finalist") {
    return (
      <span className="bg-yi-green/10 text-yi-green px-2 py-0.5 rounded-full text-xs font-bold">
        National Finalist
      </span>
    );
  }

  const handleClick = () => {
    if (
      !confirm(
        `Advance "${teamName}" to National Finals? This will update the team status.`
      )
    )
      return;

    startTransition(async () => {
      await markTeamAdvanced(teamId);
    });
  };

  return (
    <button
      onClick={handleClick}
      disabled={isPending}
      className="px-3 py-1 rounded-md text-xs font-semibold bg-navy text-ivory hover:bg-navy-dark disabled:opacity-50 transition-colors"
    >
      {isPending ? "Advancing..." : "Advance"}
    </button>
  );
}
