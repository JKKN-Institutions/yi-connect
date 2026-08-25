"use client";

/**
 * The organiser's second-chance panel.
 *
 * A restart is a RESUME, not a re-sit: same paper, same questions, the
 * answers already saved, and only the time that was actually left. Every
 * number on this screen is computed server-side from the attempt row — this
 * component never calculates a duration and never sends one back.
 *
 * DESIGNED FOR A PHONE FIRST. An organiser uses this standing next to a
 * distressed student on event day, on a 390px screen, so everything stacks,
 * every tap target is full width, and the reason box is a real textarea
 * rather than a modal that needs two hands.
 *
 * WHY THE REFUSALS ARE SHOWN AND NOT HIDDEN. An organiser who cannot find a
 * student in an "eligible" list has no idea whether the platform lost them or
 * the answer is simply no. Every closed paper can be shown, each with the
 * plain-English reason it cannot be restarted.
 */

import { useCallback, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  grantRestart,
  listRestartCandidates,
  type RestartCandidate,
} from "@/app/yiq/actions/restart";
import { REASON_MIN, validateReason } from "@/lib/yiq/restart";

const INK = "#0a1633";
const PAPER = "#f7f4ed";
const SAFFRON = "#e8a33d";
const GREEN = "#14795a";
const VERMILION = "#c8452f";
const DIM = "#9fb0d4";
const RULE = "rgba(247,244,237,0.14)";

function statusLabel(status: string): string {
  if (status === "auto_submitted") return "Time ran out";
  if (status === "submitted") return "Submitted";
  if (status === "disqualified") return "Disqualified";
  return status.replace(/_/g, " ");
}

export function RestartPanel({ eventId }: { eventId: string }) {
  const router = useRouter();
  const [candidates, setCandidates] = useState<RestartCandidate[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [openFor, setOpenFor] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [pending, start] = useTransition();

  const load = useCallback(() => {
    start(async () => {
      const res = await listRestartCandidates(eventId);
      if (!res.success) {
        setLoadError(res.error);
        setCandidates([]);
        return;
      }
      setLoadError(null);
      setCandidates(res.candidates);
    });
  }, [eventId]);

  useEffect(load, [load]);

  function submit(c: RestartCandidate) {
    const problem = validateReason(reason);
    if (problem) {
      toast.error(problem);
      return;
    }
    start(async () => {
      const res = await grantRestart({ attemptId: c.attemptId, reason });
      if (!res.success) {
        toast.error(res.error);
        return;
      }
      toast.success(
        res.alreadyGranted
          ? `${c.studentName} already had a restart of ${res.grantedLabel}.`
          : `${c.studentName} can resume with ${res.grantedLabel} left.`
      );
      setOpenFor(null);
      setReason("");
      load();
      router.refresh();
    });
  }

  const eligible = (candidates ?? []).filter((c) => c.eligible);
  const granted = (candidates ?? []).filter((c) => !c.eligible && c.grant);
  const refused = (candidates ?? []).filter((c) => !c.eligible && !c.grant);
  const shown = showAll ? [...eligible, ...granted, ...refused] : [...eligible, ...granted];

  return (
    <section className="mt-9 rounded-2xl border p-4 sm:p-6" style={{ borderColor: RULE }}>
      <h2 className="yiq-display text-[1.5rem]">Second chances</h2>
      <p className="mt-2 text-[0.9375rem] leading-relaxed" style={{ color: DIM }}>
        If a student&apos;s paper closed on them — a dead phone, a dropped
        connection — you can hand back{" "}
        <strong style={{ color: PAPER }}>only the time that was left</strong>.
        They resume the same paper with the answers they had already saved.{" "}
        <strong style={{ color: PAPER }}>One restart per student, ever.</strong>
      </p>

      {candidates === null ? (
        <p className="mt-5 text-[0.875rem]" style={{ color: DIM }}>
          Loading papers…
        </p>
      ) : loadError ? (
        <p
          className="mt-5 rounded-xl p-4 text-[0.875rem]"
          style={{ background: "rgba(200,69,47,0.14)", color: PAPER }}
        >
          {loadError}
        </p>
      ) : candidates.length === 0 ? (
        <p className="mt-5 text-[0.875rem]" style={{ color: DIM }}>
          No papers have been closed in this chapter yet.
        </p>
      ) : (
        <>
          <p className="yiq-eyebrow mt-5" style={{ color: SAFFRON }}>
            {eligible.length} can be restarted · {granted.length} already given
          </p>

          <ul className="mt-4 flex flex-col gap-3">
            {shown.map((c) => {
              const isOpen = openFor === c.attemptId;
              return (
                <li
                  key={c.attemptId}
                  className="rounded-xl border p-4"
                  style={{
                    borderColor: c.eligible ? `${SAFFRON}55` : RULE,
                    background: c.eligible ? "rgba(232,163,61,0.07)" : "transparent",
                  }}
                >
                  <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
                    <p className="text-[1rem] font-bold" style={{ color: PAPER }}>
                      {c.studentName}
                    </p>
                    <span
                      className="yiq-data text-[0.8125rem] font-semibold"
                      style={{ color: c.eligible ? SAFFRON : DIM }}
                    >
                      {c.remainingMs > 0 ? `${c.remainingLabel} left` : "no time left"}
                    </span>
                  </div>

                  <p className="mt-1 text-[0.8125rem] leading-snug" style={{ color: DIM }}>
                    {[c.schoolName, c.teamName, c.category].filter(Boolean).join(" · ") ||
                      "No school on record"}
                  </p>
                  <p className="yiq-eyebrow mt-2" style={{ color: DIM }}>
                    {statusLabel(c.status)} · scored {c.score}
                  </p>

                  {/* Already granted — the permanent record, shown in full. */}
                  {c.grant ? (
                    <div
                      className="mt-3 rounded-lg p-3"
                      style={{ background: "rgba(20,121,90,0.16)" }}
                    >
                      <p className="text-[0.8125rem] font-bold" style={{ color: PAPER }}>
                        Restart given · {c.grant.grantedLabel}
                        {c.grant.consumedAt ? " · used" : " · not used yet"}
                      </p>
                      <p className="mt-1 text-[0.8125rem] leading-snug" style={{ color: DIM }}>
                        “{c.grant.reason}”
                      </p>
                      <p className="yiq-eyebrow mt-1.5" style={{ color: DIM }}>
                        {c.grant.grantedBy ?? "organiser"} ·{" "}
                        {new Date(c.grant.grantedAt).toLocaleString()}
                      </p>
                    </div>
                  ) : null}

                  {/* Refused — say WHY, in a sentence an organiser can repeat. */}
                  {!c.eligible && !c.grant && c.refusalText ? (
                    <p className="mt-3 text-[0.8125rem] leading-snug" style={{ color: VERMILION }}>
                      {c.refusalText}
                    </p>
                  ) : null}

                  {c.eligible && !isOpen ? (
                    <button
                      onClick={() => {
                        setOpenFor(c.attemptId);
                        setReason("");
                      }}
                      disabled={pending}
                      className="mt-3 w-full rounded-full px-5 py-3 text-[0.875rem] font-bold disabled:opacity-60 sm:w-auto"
                      style={{ background: SAFFRON, color: INK }}
                    >
                      Give back {c.remainingLabel}
                    </button>
                  ) : null}

                  {/* The confirm step: a reason is REQUIRED before the button
                      does anything. A granted restart has to be defensible. */}
                  {isOpen ? (
                    <div
                      className="mt-3 rounded-lg p-3"
                      style={{ background: "rgba(232,163,61,0.12)", border: `1px solid ${SAFFRON}55` }}
                    >
                      <label
                        htmlFor={`reason-${c.attemptId}`}
                        className="block text-[0.875rem] font-semibold"
                        style={{ color: PAPER }}
                      >
                        Why does {c.studentName} get a restart?
                      </label>
                      <p className="mt-1 text-[0.8125rem]" style={{ color: DIM }}>
                        This is recorded against your name, permanently.
                      </p>
                      <textarea
                        id={`reason-${c.attemptId}`}
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        rows={3}
                        maxLength={500}
                        placeholder="Phone battery died at 12 minutes — confirmed by the invigilator."
                        className="mt-2 w-full rounded-lg border px-3 py-2.5 text-[0.9375rem]"
                        style={{
                          borderColor: RULE,
                          background: "rgba(10,22,51,0.55)",
                          color: PAPER,
                        }}
                      />
                      <p className="yiq-eyebrow mt-1" style={{ color: DIM }}>
                        {reason.trim().length < REASON_MIN
                          ? `${REASON_MIN - reason.trim().length} more characters needed`
                          : `${reason.trim().length}/500`}
                      </p>

                      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                        <button
                          onClick={() => submit(c)}
                          disabled={pending || validateReason(reason) !== null}
                          className="rounded-full px-5 py-3 text-[0.875rem] font-bold disabled:opacity-50"
                          style={{ background: GREEN, color: PAPER }}
                        >
                          {pending ? "Working…" : `Yes — give back ${c.remainingLabel}`}
                        </button>
                        <button
                          onClick={() => {
                            setOpenFor(null);
                            setReason("");
                          }}
                          disabled={pending}
                          className="rounded-full border px-5 py-3 text-[0.875rem] font-semibold disabled:opacity-60"
                          style={{ borderColor: RULE, color: PAPER }}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>

          {shown.length === 0 ? (
            <p className="mt-4 text-[0.875rem]" style={{ color: DIM }}>
              No paper in this chapter can be restarted right now.
            </p>
          ) : null}

          {refused.length > 0 ? (
            <button
              onClick={() => setShowAll((v) => !v)}
              className="mt-4 text-[0.875rem] font-semibold underline underline-offset-4"
              style={{ color: DIM }}
            >
              {showAll
                ? "Hide the papers that cannot be restarted"
                : `Show the ${refused.length} paper${refused.length === 1 ? "" : "s"} that cannot be restarted`}
            </button>
          ) : null}
        </>
      )}
    </section>
  );
}
