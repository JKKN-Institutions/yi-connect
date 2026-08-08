"use client";

import { useEffect, useState } from "react";
import {
  copyScoreToTeammates,
  listTeammates,
  type TeammateOption,
} from "@/app/yip/actions/batch-scores";
import { ROLE_LABELS } from "@/lib/yip/constants";
import { juryLabel } from "@/lib/yip/pii";
import { ChevronDown, ChevronUp, Copy, Loader2, Users } from "lucide-react";
import { GOLD, GREEN, INK, SERIF, inkA } from "@/app/yip/me/credential-ui";

// S2-6: after a juror scores one bill presenter, apply the same marks to the
// rest of the committee as per-person DRAFTS. Each teammate's score stays
// individually editable and must still be submitted per person. Name-blind:
// team-mates are labelled by number + role only, never by name.

interface Props {
  juryAssignmentId: string;
  eventId: string;
  agendaItemId: string;
  sourceParticipantId: string;
  // Refresh hook so the parent's score map picks up the new drafts (status
  // dots + Unfinished strip) without a page reload.
  onCopied?: () => void;
}

export function BatchCopyPanel({
  juryAssignmentId,
  eventId,
  agendaItemId,
  sourceParticipantId,
  onCopied,
}: Props) {
  const [open, setOpen] = useState(false);
  const [teammates, setTeammates] = useState<TeammateOption[] | null>(null);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [copying, setCopying] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Load the committee roster once per (participant, session). The parent
  // can't gate on committee membership (the jury roster is committee-blind),
  // so the panel self-hides when the source has no committee or no team-mates.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await listTeammates(
          juryAssignmentId,
          eventId,
          sourceParticipantId
        );
        if (cancelled) return;
        if (res.success && res.teammates.length > 0) {
          setTeammates(res.teammates);
          // Default to the whole team selected — one tap covers the common case.
          setChecked(new Set(res.teammates.map((t) => t.id)));
        } else {
          setTeammates([]);
        }
      } catch {
        // Offline / failed — copying needs the server anyway; stay hidden.
        if (!cancelled) setTeammates([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [juryAssignmentId, eventId, sourceParticipantId]);

  // Nothing to offer: still loading, no committee, or a committee of one.
  if (!teammates || teammates.length === 0) return null;

  const toggle = (id: string) => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleCopy = async () => {
    if (checked.size === 0 || copying) return;
    setCopying(true);
    setError(null);
    setNotice(null);
    try {
      const res = await copyScoreToTeammates({
        juryAssignmentId,
        eventId,
        agendaItemId,
        sourceParticipantId,
        targetParticipantIds: [...checked],
      });
      if (res.success) {
        setNotice(
          `Copied to ${res.copied} as draft${res.copied === 1 ? "" : "s"} — open each to fine-tune and submit` +
            (res.skipped > 0
              ? `; ${res.skipped} skipped, already submitted`
              : "")
        );
        onCopied?.();
      } else {
        setError(res.error);
      }
    } catch {
      setError("Couldn't copy — check your connection and try again.");
    }
    setCopying(false);
  };

  const roleLabel = (role: string | null) =>
    role ? ROLE_LABELS[role] ?? role : "Member";

  return (
    <div
      className="rounded-xl border-2 bg-white"
      style={{ borderColor: `${GOLD}66` }}
    >
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-2 px-4 py-2.5 touch-manipulation"
        style={{ minHeight: "44px" }}
      >
        <span
          className="flex items-center gap-2 text-sm font-semibold"
          style={{ ...SERIF, color: INK }}
        >
          <Users className="size-4 shrink-0" style={{ color: GOLD }} />
          <span>Apply these marks to team-mates</span>
        </span>
        {open ? (
          <ChevronUp className="size-5 shrink-0" style={{ color: inkA(0.5) }} />
        ) : (
          <ChevronDown
            className="size-5 shrink-0"
            style={{ color: inkA(0.5) }}
          />
        )}
      </button>

      {open && (
        <div className="px-4 pb-3">
          <p className="text-xs" style={{ color: inkA(0.55) }}>
            Copies this score to the selected committee members as drafts. Each
            one stays editable — open every team-mate to fine-tune and submit
            their score.
          </p>

          <div className="mt-3 grid grid-cols-1 gap-2">
            {teammates.map((t) => {
              const isChecked = checked.has(t.id);
              return (
                <label
                  key={t.id}
                  className={`flex items-center gap-3 rounded-lg border bg-white px-3 py-2 touch-manipulation cursor-pointer transition-colors ${
                    isChecked
                      ? "ring-1"
                      : "border-gray-200 hover:bg-gray-50"
                  }`}
                  style={
                    isChecked
                      ? {
                          minHeight: "48px",
                          borderColor: `${GOLD}AA`,
                          // ring-1 colour via CSS var used by Tailwind ring
                          boxShadow: `0 0 0 1px ${GOLD}66`,
                        }
                      : { minHeight: "48px" }
                  }
                >
                  <input
                    type="checkbox"
                    className="size-5 rounded border-gray-300 text-amber-600 focus:ring-amber-500"
                    checked={isChecked}
                    onChange={() => toggle(t.id)}
                  />
                  <span className="text-sm font-medium text-gray-900">
                    {juryLabel(t.constituency_number, t.id)}
                    <span
                      className="font-normal"
                      style={{ color: inkA(0.55) }}
                    >
                      {" "}
                      — {roleLabel(t.parliament_role)}
                    </span>
                  </span>
                </label>
              );
            })}
          </div>

          <button
            type="button"
            onClick={() => void handleCopy()}
            disabled={copying || checked.size === 0}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-white touch-manipulation disabled:opacity-50"
            style={{ minHeight: "48px", background: INK }}
          >
            {copying ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Copy className="size-4" />
            )}
            {copying
              ? "Copying…"
              : `Copy marks to ${checked.size} team-mate${checked.size === 1 ? "" : "s"} as drafts`}
          </button>

          {notice && (
            <p
              className="mt-2 rounded-lg px-3 py-2 text-xs font-medium"
              style={{ background: `${GREEN}14`, color: GREEN }}
              role="status"
            >
              {notice}
            </p>
          )}
          {error && (
            <p
              className="mt-2 rounded-lg bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700"
              role="alert"
            >
              {error}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
