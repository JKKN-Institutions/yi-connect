"use client";

import { useCallback, useState, useTransition } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/yip/ui/card";
import { Button } from "@/components/yip/ui/button";
import {
  Hand,
  Mic,
  Check,
  SkipForward,
  AlertTriangle,
  Smartphone,
} from "lucide-react";
import { cn } from "@/lib/yip/utils";
import { useSpeakingFloorLive } from "@/lib/yip/hooks/use-speaking-floor";
import {
  getSpeakingFloor,
  callSpeaker,
  markSpoken,
  skipSpeakingRequest,
  setSpeakingPlacardEnabled,
  type SpeakingFloorState,
  type SpeakingFloorEntry,
} from "@/app/yip/actions/speaking-floor";

/**
 * Speaking Floor — the Chair's speaking-equity cockpit. Answers Erode 2026's #1
 * feedback theme (unequal speaking) WITHOUT adding phone use by default:
 *
 *  • Fairness meter + "Yet to speak" board — always on, derived from the
 *    Now-Speaking / agenda_speakers data already captured for jury scoring. The
 *    Chair scans it and calls on members who haven't spoken. Zero student phones.
 *  • Phone hand-raise placard — an OPTIONAL per-event switch (off by default,
 *    since Erode also disliked phone overuse). When on, members can queue from
 *    their phones and the Chair works the Call → Mark spoken queue below.
 *
 * Read-only for canView; Call / Mark spoken / Skip / the placard toggle are
 * gated on canManage here AND server-side (fail closed). Realtime via
 * useSpeakingFloorLive (speaking_requests + agenda_speakers).
 */
export function SpeakingFloorPanel({
  eventId,
  canManage,
}: {
  eventId: string;
  canManage: boolean;
}) {
  const { data } = useSpeakingFloorLive<SpeakingFloorState>(
    eventId,
    useCallback(async () => {
      const res = await getSpeakingFloor(eventId);
      return res.success ? res.data : null;
    }, [eventId]),
    { trackTurns: true }
  );

  const [pending, startTransition] = useTransition();

  // Local mirror of the placard flag so the toggle feels instant (the realtime
  // hook watches speaking_requests, not events, so it won't refetch on a flag
  // change). Adopt each fresh server value during render (React's derived-state
  // pattern) — this clears any optimistic override once the server confirms it,
  // without a setState-in-effect.
  const serverPlacard = data?.placardEnabled ?? false;
  const [placardOn, setPlacardOn] = useState(serverPlacard);
  const [syncedPlacard, setSyncedPlacard] = useState(serverPlacard);
  if (serverPlacard !== syncedPlacard) {
    setSyncedPlacard(serverPlacard);
    setPlacardOn(serverPlacard);
  }

  if (!data) return null;

  const { board, queue, calledEntry, spokenCount, totalParticipants } = data;
  const pct =
    totalParticipants > 0
      ? Math.round((spokenCount / totalParticipants) * 100)
      : 0;
  const yetToSpeak = board.filter((m) => m.turns === 0);

  const run = (fn: () => Promise<unknown>) =>
    startTransition(async () => {
      await fn();
    });

  const togglePlacard = () => {
    const next = !placardOn;
    setPlacardOn(next); // optimistic
    startTransition(async () => {
      const res = await setSpeakingPlacardEnabled(eventId, next);
      if (!res.success) setPlacardOn(!next); // revert on failure
    });
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-sm text-muted-foreground">
            <Hand className="size-4" />
            Speaking Floor
            {placardOn && data.waitingCount > 0 && (
              <span className="rounded-full bg-[#FF9933]/15 px-2 py-0.5 text-xs font-semibold text-[#9a5212]">
                {data.waitingCount} waiting
              </span>
            )}
          </CardTitle>
          {canManage && (
            <button
              type="button"
              onClick={togglePlacard}
              disabled={pending}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors disabled:opacity-50",
                placardOn
                  ? "bg-[#138808]/12 text-[#138808]"
                  : "bg-gray-100 text-gray-500"
              )}
              title="Let members raise their hand from their phones"
            >
              <Smartphone className="size-3" />
              Phone hand-raise: {placardOn ? "On" : "Off"}
            </button>
          )}
        </div>

        {/* Fairness meter — detailed (Chair). Public aggregate mirrors on the
            projector. */}
        <div className="mt-2">
          <div className="mb-1 flex items-center justify-between text-xs">
            <span className="font-medium text-gray-700">
              {spokenCount} of {totalParticipants} have spoken
            </span>
            <span className="font-mono tabular-nums text-gray-500">{pct}%</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${pct}%`,
                background:
                  pct >= 66 ? "#138808" : pct >= 33 ? "#FF9933" : "#e0902f",
              }}
            />
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* ── Phone-free fairness board — who still needs a turn ── */}
        <div>
          <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-gray-500">
            {yetToSpeak.length > 0
              ? `Yet to speak — ${yetToSpeak.length}`
              : "Everyone has spoken"}
          </p>
          {yetToSpeak.length > 0 ? (
            <div className="flex max-h-44 flex-wrap gap-1.5 overflow-y-auto rounded-lg border border-gray-100 bg-gray-50/60 p-2">
              {yetToSpeak.map((m) => (
                <span
                  key={m.participantId}
                  className="inline-flex items-center gap-1 rounded-full border border-green-200 bg-green-50 px-2 py-0.5 text-xs text-green-800"
                >
                  {m.constituencyNumber != null && (
                    <span className="font-mono text-[10px] text-green-600">
                      #{m.constituencyNumber}
                    </span>
                  )}
                  {m.name}
                </span>
              ))}
            </div>
          ) : (
            <p className="rounded-lg border border-green-100 bg-green-50 px-3 py-2 text-sm text-green-700">
              🎉 Every member of the House has had at least one turn.
            </p>
          )}
          <p className="mt-1.5 text-[11px] text-gray-400">
            Turns are counted from the Now Speaking desk — call on someone above
            when hands go up to keep the floor fair.
          </p>
        </div>

        {/* ── Phone hand-raise queue (only when the placard is on) ── */}
        {placardOn && (
          <div className="space-y-3 border-t border-gray-100 pt-3">
            {calledEntry && (
              <div className="rounded-lg border-2 border-green-200 bg-green-50 p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <Mic className="size-4 shrink-0 text-green-700" />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-gray-900">
                        {calledEntry.name}
                        {calledEntry.constituencyNumber != null && (
                          <span className="ml-1.5 font-mono text-xs font-normal text-gray-500">
                            #{calledEntry.constituencyNumber}
                          </span>
                        )}
                      </p>
                      <p className="text-[11px] font-medium uppercase tracking-wide text-green-700">
                        At the mic
                      </p>
                    </div>
                  </div>
                  {canManage && (
                    <div className="flex shrink-0 gap-1.5">
                      <Button
                        size="sm"
                        disabled={pending}
                        onClick={() =>
                          run(() => markSpoken(calledEntry.requestId))
                        }
                      >
                        <Check className="size-3.5" />
                        Spoken
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={pending}
                        onClick={() =>
                          run(() => skipSpeakingRequest(calledEntry.requestId))
                        }
                      >
                        <SkipForward className="size-3.5" />
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {queue.length === 0 ? (
              !calledEntry && (
                <p className="py-2 text-center text-sm text-muted-foreground">
                  No hands raised yet. Members tap “I wish to speak” on their
                  phones.
                </p>
              )
            ) : (
              <ul className="space-y-1.5">
                {queue.map((entry, idx) => (
                  <QueueRow
                    key={entry.requestId}
                    entry={entry}
                    position={idx + 1}
                    canManage={canManage}
                    pending={pending}
                    onCall={() => run(() => callSpeaker(entry.requestId))}
                    onSkip={() => run(() => skipSpeakingRequest(entry.requestId))}
                  />
                ))}
              </ul>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function QueueRow({
  entry,
  position,
  canManage,
  pending,
  onCall,
  onSkip,
}: {
  entry: SpeakingFloorEntry;
  position: number;
  canManage: boolean;
  pending: boolean;
  onCall: () => void;
  onSkip: () => void;
}) {
  // Turn badge: 0 = "yet to speak" (highlighted — prioritise), else "N spoken".
  const fresh = entry.turns === 0;

  return (
    <li className="flex items-center justify-between gap-2 rounded-lg border border-gray-100 bg-white px-3 py-2">
      <div className="flex items-center gap-2.5 min-w-0">
        <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-gray-100 font-mono text-[11px] font-semibold text-gray-500">
          {position}
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-gray-900">
            {entry.name}
            {entry.constituencyNumber != null && (
              <span className="ml-1.5 font-mono text-xs font-normal text-gray-400">
                #{entry.constituencyNumber}
              </span>
            )}
          </p>
          <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
            <span
              className={cn(
                "inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold",
                fresh
                  ? "bg-green-100 text-green-700"
                  : "bg-gray-100 text-gray-500"
              )}
            >
              {fresh
                ? "Yet to speak"
                : `${entry.turns} turn${entry.turns === 1 ? "" : "s"}`}
            </span>
            {entry.thirdTurnFlag && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">
                <AlertTriangle className="size-2.5" />
                Others still waiting
              </span>
            )}
          </div>
        </div>
      </div>
      {canManage && (
        <div className="flex shrink-0 gap-1.5">
          <Button size="sm" disabled={pending} onClick={onCall}>
            <Mic className="size-3.5" />
            Call
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={pending}
            onClick={onSkip}
          >
            <SkipForward className="size-3.5" />
          </Button>
        </div>
      )}
    </li>
  );
}
