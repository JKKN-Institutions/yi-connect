"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { computeChapterStandings, setChapterEventStatus } from "@/app/yiq/actions/admin";
import { STATUS_LABELS, type ChapterEventStatus } from "@/lib/yiq/constants";

const PAPER = "#f7f4ed";
const SAFFRON = "#e8a33d";
const DIM = "#9fb0d4";
const RULE = "rgba(247,244,237,0.14)";

/**
 * The lifecycle is linear, so the console offers exactly one forward step and
 * one back step rather than a free-for-all dropdown — an organiser under
 * pressure on event day should not be able to jump the event to a state that
 * skips the round.
 */
const NEXT: Partial<Record<ChapterEventStatus, ChapterEventStatus>> = {
  draft: "registration_open",
  registration_open: "registration_closed",
  registration_closed: "online_round_live",
  online_round_live: "online_round_closed",
  online_round_closed: "finals_scheduled",
  finals_scheduled: "finals_live",
  finals_live: "finals_complete",
};

const BACK: Partial<Record<ChapterEventStatus, ChapterEventStatus>> = {
  registration_open: "draft",
  registration_closed: "registration_open",
  online_round_live: "registration_closed",
  online_round_closed: "online_round_live",
  finals_scheduled: "online_round_closed",
  finals_live: "finals_scheduled",
};

export function EventControls({
  eventId,
  status,
  resultsPublished,
}: {
  eventId: string;
  status: ChapterEventStatus;
  resultsPublished: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [confirm, setConfirm] = useState<ChapterEventStatus | null>(null);

  const next = NEXT[status];
  const back = BACK[status];

  function move(to: ChapterEventStatus) {
    start(async () => {
      const res = await setChapterEventStatus(eventId, to);
      if (!res.success) {
        toast.error(res.error);
        return;
      }
      toast.success(`Moved to ${STATUS_LABELS[to]}`);
      setConfirm(null);
      router.refresh();
    });
  }

  function publish() {
    start(async () => {
      const res = await computeChapterStandings(eventId, { persist: true });
      if (!res.success) {
        toast.error(res.error);
        return;
      }
      toast.success("Standings computed and published");
      router.refresh();
    });
  }

  return (
    <section className="mt-9 rounded-2xl border p-6" style={{ borderColor: RULE }}>
      <h2 className="yiq-display text-[1.5rem]">Run the round</h2>
      <p className="mt-2 text-[0.9375rem]" style={{ color: DIM }}>
        Currently: <strong style={{ color: PAPER }}>{STATUS_LABELS[status]}</strong>
      </p>

      <div className="mt-5 flex flex-wrap gap-3">
        {next ? (
          <button
            onClick={() => setConfirm(next)}
            disabled={pending}
            className="rounded-full px-5 py-3 text-[0.875rem] font-bold disabled:opacity-60"
            style={{ background: SAFFRON, color: "#0a1633" }}
          >
            {next === "online_round_live"
              ? "Open the online round"
              : next === "online_round_closed"
                ? "Close the online round"
                : `Move to ${STATUS_LABELS[next]}`}
          </button>
        ) : null}

        {back ? (
          <button
            onClick={() => move(back)}
            disabled={pending}
            className="rounded-full border px-5 py-3 text-[0.875rem] font-semibold disabled:opacity-60"
            style={{ borderColor: RULE, color: PAPER }}
          >
            Back to {STATUS_LABELS[back]}
          </button>
        ) : null}

        {(status === "online_round_closed" ||
          status === "finals_scheduled" ||
          status === "finals_complete") ? (
          <button
            onClick={publish}
            disabled={pending}
            className="rounded-full px-5 py-3 text-[0.875rem] font-bold disabled:opacity-60"
            style={{ background: "#14795a", color: PAPER }}
          >
            {resultsPublished ? "Recompute and republish" : "Compute and publish standings"}
          </button>
        ) : null}
      </div>

      {confirm ? (
        <div
          className="mt-5 rounded-xl p-4"
          style={{ background: "rgba(232,163,61,0.12)", border: `1px solid ${SAFFRON}55` }}
        >
          <p className="text-[0.9375rem] font-semibold">
            {confirm === "online_round_live"
              ? "Open the online round for every registered student in this chapter?"
              : confirm === "online_round_closed"
                ? "Close the round? Students who have not submitted will lose access."
                : `Move this chapter to ${STATUS_LABELS[confirm]}?`}
          </p>
          <div className="mt-3 flex gap-3">
            <button
              onClick={() => move(confirm)}
              disabled={pending}
              className="rounded-full px-4 py-2.5 text-[0.8125rem] font-bold disabled:opacity-60"
              style={{ background: SAFFRON, color: "#0a1633" }}
            >
              {pending ? "Working…" : "Yes, do it"}
            </button>
            <button
              onClick={() => setConfirm(null)}
              className="rounded-full border px-4 py-2.5 text-[0.8125rem] font-semibold"
              style={{ borderColor: RULE, color: PAPER }}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
