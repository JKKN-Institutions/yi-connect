"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/yip/ui/button";
import { Flag, Loader2 } from "lucide-react";
import { goIndependent } from "@/app/yip/actions/participants";

/**
 * Participant self-service: "Leave my party → go Independent".
 * Only rendered for a plain MP (the server action also enforces this). Two-tap
 * confirm so a stray tap can't drop someone out of their party. On success we
 * hard-reload so the server-rendered dashboard re-reads the new role/party.
 */
export function GoIndependentButton({
  participantId,
  eventId,
}: {
  participantId: string;
  eventId: string;
}) {
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [isPending, startTransition] = useTransition();

  if (done) {
    return (
      <p className="text-sm font-medium text-emerald-700">
        You are now an Independent MP. Updating your dashboard…
      </p>
    );
  }

  if (!confirming) {
    return (
      <div className="space-y-1.5">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            setError(null);
            setConfirming(true);
          }}
        >
          <Flag className="size-3.5" />
          Leave my party — go Independent
        </Button>
        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>
    );
  }

  return (
    <div className="space-y-2 rounded-lg border border-amber-300 bg-amber-50 p-3">
      <p className="text-sm text-amber-900">
        Are you sure? You will leave your party and sit as an{" "}
        <strong>Independent MP</strong>. You can still speak, ask questions, and
        vote on bills and motions — but you will no longer take part in
        party-leader, PM, or cabinet elections. You can&apos;t undo this
        yourself; only an organiser can put you back in a party.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="destructive"
          size="sm"
          disabled={isPending}
          onClick={() =>
            startTransition(async () => {
              const res = await goIndependent(participantId, eventId);
              if (res.success) {
                setDone(true);
                window.location.reload();
              } else {
                setError(res.error);
                setConfirming(false);
              }
            })
          }
        >
          {isPending ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Flag className="size-3.5" />
          )}
          Yes, make me Independent
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={isPending}
          onClick={() => setConfirming(false)}
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}
