"use client";

import { useCallback, useTransition } from "react";
import { Mic, Check, SkipForward, AlertTriangle, Smartphone } from "lucide-react";
import { useSpeakingFloorLive } from "@/lib/yip/hooks/use-speaking-floor";
import {
  getSpeakerSpeakingFloor,
  speakerCallSpeaker,
  speakerMarkSpoken,
  speakerSkipSpeakingRequest,
  type SpeakingFloorState,
  type SpeakingFloorEntry,
} from "@/app/yip/actions/speaking-floor";
import { SectionShell, INK, GREEN, GOLD, SERIF, inkA } from "../credential-ui";

/**
 * Speaking Floor — the presiding officer's own console on the Speaker's Desk.
 * Mirrors app/yip/dashboard/events/[id]/control/speaking-floor-panel.tsx (the
 * organiser's Chair panel) structure and wording so the two screens never
 * describe the same queue differently: same fairness meter copy, same "Yet to
 * speak" board, same Call / Mark spoken / Skip queue.
 *
 * The Speaker/Deputy Speaker can run the floor from here; the organiser keeps
 * everything they have today on the control panel and can still overrule
 * (last-write-wins, no locking — Director decision 2026-08-26). The phone
 * hand-raise placard toggle itself is organiser-only — this screen only ever
 * reports whether it's on or off, with a plain explanation when it's off
 * (never an empty queue that looks broken).
 */
export function SpeakerSpeakingFloor({
  eventId,
  participantId,
}: {
  eventId: string;
  participantId: string;
}) {
  const { data } = useSpeakingFloorLive<SpeakingFloorState>(
    eventId,
    useCallback(async () => {
      const res = await getSpeakerSpeakingFloor(eventId, participantId);
      return res.success ? res.data : null;
    }, [eventId, participantId]),
    { trackTurns: true }
  );

  const [pending, startTransition] = useTransition();
  const run = (fn: () => Promise<unknown>) =>
    startTransition(async () => {
      await fn();
    });

  if (!data) {
    return (
      <SectionShell>
        <div className="px-5 py-6 text-center text-sm" style={{ color: inkA(0.45) }}>
          Loading the speaking floor…
        </div>
      </SectionShell>
    );
  }

  const { board, queue, calledEntry, spokenCount, totalParticipants, placardEnabled } = data;
  const pct =
    totalParticipants > 0 ? Math.round((spokenCount / totalParticipants) * 100) : 0;
  const yetToSpeak = board.filter((m) => m.turns === 0);

  return (
    <div className="space-y-3">
      {/* Fairness meter — same wording as the organiser panel. */}
      <SectionShell accent={GOLD}>
        <div className="px-5 py-4">
          <div className="mb-1 flex items-center justify-between text-xs">
            <span className="font-medium" style={{ color: inkA(0.7) }}>
              {spokenCount} of {totalParticipants} have spoken
            </span>
            <span className="font-mono tabular-nums" style={{ color: inkA(0.45) }}>
              {pct}%
            </span>
          </div>
          <div
            className="h-2 w-full overflow-hidden rounded-full"
            style={{ background: inkA(0.06) }}
          >
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${pct}%`,
                background: pct >= 66 ? GREEN : pct >= 33 ? "#FF9933" : "#e0902f",
              }}
            />
          </div>
        </div>
      </SectionShell>

      {/* Phone-free fairness board — who still needs a turn. */}
      <SectionShell>
        <div className="space-y-1.5 px-5 py-4">
          <p
            className="text-[11px] font-bold uppercase tracking-wider"
            style={{ color: inkA(0.45) }}
          >
            {yetToSpeak.length > 0
              ? `Yet to speak — ${yetToSpeak.length}`
              : "Everyone has spoken"}
          </p>
          {yetToSpeak.length > 0 ? (
            <div className="flex max-h-40 flex-wrap gap-1.5 overflow-y-auto">
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
          <p className="text-[11px]" style={{ color: inkA(0.35) }}>
            Turns are counted from the Now Speaking desk — call on someone above
            when hands go up to keep the floor fair.
          </p>
        </div>
      </SectionShell>

      {/* Phone hand-raise queue, or a plain explanation when it's off. The
          toggle itself lives only on the organiser's control panel. */}
      {!placardEnabled ? (
        <SectionShell>
          <div className="flex items-start gap-2.5 px-5 py-4">
            <Smartphone className="mt-0.5 size-4 shrink-0" style={{ color: inkA(0.35) }} />
            <p className="text-sm" style={{ color: inkA(0.6) }}>
              Phone hand-raise isn&apos;t turned on for this event. Ask an
              organiser to switch it on from the event control panel — the
              queue will appear here the moment it is.
            </p>
          </div>
        </SectionShell>
      ) : (
        <div className="space-y-2">
          {calledEntry && (
            <SectionShell accent={GREEN}>
              <div className="flex items-center justify-between gap-2 px-4 py-3">
                <div className="flex min-w-0 items-center gap-2">
                  <Mic className="size-4 shrink-0" style={{ color: GREEN }} />
                  <div className="min-w-0">
                    <p
                      className="truncate text-sm font-bold"
                      style={{ ...SERIF, color: INK }}
                    >
                      {calledEntry.name}
                      {calledEntry.constituencyNumber != null && (
                        <span
                          className="ml-1.5 font-mono text-xs font-normal"
                          style={{ color: inkA(0.4) }}
                        >
                          #{calledEntry.constituencyNumber}
                        </span>
                      )}
                    </p>
                    <p
                      className="text-[11px] font-medium uppercase tracking-wide"
                      style={{ color: GREEN }}
                    >
                      At the mic
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 gap-1.5">
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() =>
                      run(() =>
                        speakerMarkSpoken(eventId, participantId, calledEntry.requestId)
                      )
                    }
                    className="inline-flex items-center gap-1 rounded-lg bg-[#138808] px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                  >
                    <Check className="size-3.5" />
                    Spoken
                  </button>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() =>
                      run(() =>
                        speakerSkipSpeakingRequest(eventId, participantId, calledEntry.requestId)
                      )
                    }
                    className="inline-flex items-center gap-1 rounded-lg border-2 px-3 py-1.5 text-xs font-semibold disabled:opacity-50"
                    style={{ borderColor: inkA(0.12), color: inkA(0.6) }}
                  >
                    <SkipForward className="size-3.5" />
                  </button>
                </div>
              </div>
            </SectionShell>
          )}

          {queue.length === 0 ? (
            !calledEntry && (
              <SectionShell>
                <p className="px-5 py-4 text-center text-sm" style={{ color: inkA(0.45) }}>
                  No hands raised yet. Members tap “I wish to speak” on their
                  phones.
                </p>
              </SectionShell>
            )
          ) : (
            <ul className="space-y-1.5">
              {queue.map((entry, idx) => (
                <SpeakerQueueRow
                  key={entry.requestId}
                  entry={entry}
                  position={idx + 1}
                  pending={pending}
                  onCall={() =>
                    run(() => speakerCallSpeaker(eventId, participantId, entry.requestId))
                  }
                  onSkip={() =>
                    run(() =>
                      speakerSkipSpeakingRequest(eventId, participantId, entry.requestId)
                    )
                  }
                />
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

function SpeakerQueueRow({
  entry,
  position,
  pending,
  onCall,
  onSkip,
}: {
  entry: SpeakingFloorEntry;
  position: number;
  pending: boolean;
  onCall: () => void;
  onSkip: () => void;
}) {
  // Turn badge: 0 = "yet to speak" (highlighted — prioritise), else "N spoken".
  const fresh = entry.turns === 0;

  return (
    <li
      className="flex items-center justify-between gap-2 rounded-lg px-3 py-2"
      style={{ background: "#ffffff", border: `1px solid ${inkA(0.08)}` }}
    >
      <div className="flex min-w-0 items-center gap-2.5">
        <span
          className="flex size-6 shrink-0 items-center justify-center rounded-full font-mono text-[11px] font-semibold"
          style={{ background: inkA(0.06), color: inkA(0.5) }}
        >
          {position}
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium" style={{ color: INK }}>
            {entry.name}
            {entry.constituencyNumber != null && (
              <span
                className="ml-1.5 font-mono text-xs font-normal"
                style={{ color: inkA(0.35) }}
              >
                #{entry.constituencyNumber}
              </span>
            )}
          </p>
          <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
            <span
              className={
                fresh
                  ? "inline-flex items-center rounded-full bg-green-100 px-1.5 py-0.5 text-[10px] font-semibold text-green-700"
                  : "inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold"
              }
              style={fresh ? undefined : { background: inkA(0.06), color: inkA(0.5) }}
            >
              {fresh ? "Yet to speak" : `${entry.turns} turn${entry.turns === 1 ? "" : "s"}`}
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
      <div className="flex shrink-0 gap-1.5">
        <button
          type="button"
          disabled={pending}
          onClick={onCall}
          className="inline-flex items-center gap-1 rounded-lg bg-[#FF9933] px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
        >
          <Mic className="size-3.5" />
          Call
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={onSkip}
          className="inline-flex items-center gap-1 rounded-lg border-2 px-3 py-1.5 text-xs font-semibold disabled:opacity-50"
          style={{ borderColor: inkA(0.12), color: inkA(0.6) }}
        >
          <SkipForward className="size-3.5" />
        </button>
      </div>
    </li>
  );
}
