"use client";

import { useCallback, useState, useTransition } from "react";
import { Hand, Mic, Loader2, X, Users } from "lucide-react";
import { useSpeakingFloorLive } from "@/lib/yip/hooks/use-speaking-floor";
import {
  getMySpeakingStatus,
  requestToSpeak,
  withdrawSpeakingRequest,
  type MySpeakingStatus,
} from "@/app/yip/actions/speaking-floor";

const SAFFRON = "#FF9933";
const GREEN = "#138808";

/**
 * SpeakCard — the student's "I wish to speak" placard on /yip/me.
 *
 * Renders ONLY while a session is live (a current agenda item is set), so it
 * stays out of the way otherwise — same self-hiding rule as LiveNowCard and
 * VoteNowCard. Three states, driven realtime via useSpeakingFloorLive:
 *   • none    → "✋ I wish to speak" (tap to raise your hand)
 *   • waiting → "You're #N in the queue" (+ lower hand)
 *   • called  → "You're up — go to the microphone" (pulsing)
 *
 * All three actions trust the participant cookie server-side (requestToSpeak /
 * withdrawSpeakingRequest read yip_session), so no id is passed from the client.
 */
export function SpeakCard({ eventId }: { eventId: string }) {
  const { data } = useSpeakingFloorLive<MySpeakingStatus>(
    eventId,
    useCallback(async () => {
      const res = await getMySpeakingStatus();
      return res.success ? res.data : null;
    }, [])
  );

  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Nothing live → keep the dashboard uncluttered.
  if (!data || !data.hasLiveItem) return null;

  const raise = () =>
    startTransition(async () => {
      setError(null);
      const res = await requestToSpeak();
      if (!res.success) setError(res.error);
    });

  const withdraw = () =>
    startTransition(async () => {
      setError(null);
      const res = await withdrawSpeakingRequest();
      if (!res.success) setError(res.error);
    });

  // ─── Called to the mic ────────────────────────────────────────────
  if (data.myStatus === "called") {
    return (
      <div
        className="overflow-hidden rounded-2xl"
        style={{ background: `${GREEN}0f`, border: `2px solid ${GREEN}` }}
      >
        <div
          className="h-1 w-full animate-pulse"
          style={{ background: GREEN }}
        />
        <div className="flex items-center gap-3 px-5 py-4">
          <span
            className="flex size-11 shrink-0 items-center justify-center rounded-full"
            style={{ background: GREEN }}
          >
            <Mic className="size-5 text-white animate-pulse" />
          </span>
          <div className="min-w-0">
            <p
              className="text-[10px] font-bold uppercase tracking-[0.16em]"
              style={{ color: GREEN }}
            >
              You&apos;re up
            </p>
            <p className="text-base font-bold" style={{ color: "#1a1a3e" }}>
              Go to the microphone
            </p>
            <p className="text-xs" style={{ color: "#1a1a3e99" }}>
              The Chair has called on you to speak.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ─── Waiting in the queue ─────────────────────────────────────────
  if (data.myStatus === "waiting") {
    return (
      <div
        className="overflow-hidden rounded-2xl"
        style={{ background: `${SAFFRON}0f`, border: `1px solid ${SAFFRON}55` }}
      >
        <div className="flex items-center justify-between gap-3 px-5 py-4">
          <div className="flex items-center gap-3 min-w-0">
            <span
              className="flex size-11 shrink-0 items-center justify-center rounded-full"
              style={{ background: `${SAFFRON}1f`, color: "#b56a1f" }}
            >
              <Hand className="size-5" />
            </span>
            <div className="min-w-0">
              <p
                className="text-[10px] font-bold uppercase tracking-[0.16em]"
                style={{ color: "#b56a1f" }}
              >
                Hand raised
              </p>
              <p className="text-base font-bold" style={{ color: "#1a1a3e" }}>
                {data.position != null
                  ? `You're #${data.position} in the queue`
                  : "You're in the queue"}
              </p>
              <p
                className="mt-0.5 flex items-center gap-1 text-xs"
                style={{ color: "#1a1a3e99" }}
              >
                <Users className="size-3" />
                {data.waitingCount} waiting · the Chair prioritises members who
                haven&apos;t spoken yet
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={withdraw}
            disabled={pending}
            className="inline-flex shrink-0 items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors disabled:opacity-50"
            style={{ background: "#1a1a3e0d", color: "#1a1a3e99" }}
          >
            {pending ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <X className="size-3.5" />
            )}
            Lower
          </button>
        </div>
        {error && (
          <p className="px-5 pb-3 text-xs" style={{ color: "#9A3324" }}>
            {error}
          </p>
        )}
      </div>
    );
  }

  // ─── Not in the queue → invite to raise a hand ────────────────────
  return (
    <div
      className="overflow-hidden rounded-2xl"
      style={{ background: "#ffffff", border: "1px solid #1a1a3e14" }}
    >
      <button
        type="button"
        onClick={raise}
        disabled={pending}
        className="flex w-full items-center gap-3 px-5 py-4 text-left transition-colors disabled:opacity-60"
      >
        <span
          className="flex size-11 shrink-0 items-center justify-center rounded-full"
          style={{ background: `${SAFFRON}1f`, color: "#b56a1f" }}
        >
          {pending ? (
            <Loader2 className="size-5 animate-spin" />
          ) : (
            <Hand className="size-5" />
          )}
        </span>
        <div className="min-w-0">
          <p
            className="text-[10px] font-bold uppercase tracking-[0.16em]"
            style={{ color: "#b56a1f" }}
          >
            The Floor
          </p>
          <p className="text-base font-bold" style={{ color: "#1a1a3e" }}>
            I wish to speak
          </p>
          <p className="text-xs" style={{ color: "#1a1a3e99" }}>
            Raise your hand — you&apos;ll join the queue for the mic.
          </p>
        </div>
      </button>
      {error && (
        <p className="px-5 pb-3 text-xs" style={{ color: "#9A3324" }}>
          {error}
        </p>
      )}
    </div>
  );
}
